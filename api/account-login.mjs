import {
  checkRateLimit,
  cleanEmail,
  cloudProfileVersion,
  createSession,
  emailKey,
  json,
  readCloudProfile,
  readJsonKey,
  sameOrigin,
  sessionCookie,
  sha256,
  userKey,
  validPassword,
  verifySecret,
} from "./_auth-lib.mjs";
import { redis } from "./_push-lib.mjs";

const DUMMY_PASSWORD_HASH = "s2:5elS335qSlz8bHnQ8mH52A:LG4krNk_ezI-y9ZCSPG5fqC8HU-Y9Sn48nrdSDWm0D_NtWHr2bRktSw3Rak_n4Eth9HE_JUrE3wi3joSatEm-A";

function requestSessionCookie(request, token, maxAge) {
  const base = sessionCookie(token, maxAge).replace(/;\s*Secure/gi, "");
  let secure = "";
  try { secure = new URL(request.url).protocol === "https:" ? "; Secure" : ""; } catch {}
  return `${base}${secure}`;
}

function publicUser(user) {
  return user ? { id: user.id, email: user.email, createdAt: user.createdAt || 0 } : null;
}

async function consumeCounter(key, limit, windowSec) {
  const count = Number(await redis(["INCR", key])) || 0;
  if (count === 1) await redis(["EXPIRE", key, windowSec]);
  const ttl = Math.max(1, Number(await redis(["TTL", key])) || windowSec);
  return { allowed: count <= limit, retryAfter: ttl };
}

function gameDayId(now = Date.now()) {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Warsaw",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date(now));
    const get = (type) => parts.find((part) => part.type === type)?.value || "";
    const y = get("year"), m = get("month"), d = get("day");
    if (y && m && d) return `${y}-${m}-${d}`;
  } catch {}
  return new Date(now).toISOString().slice(0, 10);
}

export async function POST(request) {
  try {
    if (!sameOrigin(request)) return json({ error: "bad_origin" }, 403);
    if (!(await checkRateLimit(request, "account-login", 16, 900))) return json({ error: "rate_limited" }, 429);

    const body = await request.json().catch(() => ({}));
    const email = cleanEmail(body.email);
    if (!email) return json({ error: "invalid_email" }, 400);

    const emailLimit = await consumeCounter(`worditaire:auth:login-email-rate:${sha256(email)}`, 24, 60 * 60);
    if (!emailLimit.allowed) return json({ error: "rate_limited", retryAfter: emailLimit.retryAfter }, 429);

    const existingId = await redis(["GET", emailKey(email)]);
    const user = existingId ? await readJsonKey(userKey(existingId)) : null;
    const passwordLooksValid = validPassword(body.password);
    const passwordMatches = passwordLooksValid
      && await verifySecret(body.password, user?.passwordHash || DUMMY_PASSWORD_HASH);
    if (!user || !passwordMatches) return json({ error: "invalid_credentials" }, 401);

    // Login is deliberately read-only for profile data. A second device must first
    // receive the account's current cloud state instead of writing its stale local
    // snapshot into the account during authentication.
    const [profile, version] = await Promise.all([
      readCloudProfile(existingId),
      cloudProfileVersion(existingId),
    ]);
    const token = await createSession(existingId, user.sessionVersion);
    const now = Date.now();
    return json({
      ok: true,
      user: publicUser(user),
      profile,
      version,
      serverNow: now,
      gameDayId: gameDayId(now),
    }, 200, { "Set-Cookie": requestSessionCookie(request, token) });
  } catch (error) {
    if (error?.message === "REDIS_NOT_CONFIGURED") return json({ error: "redis_not_configured" }, 503);
    console.error("account login", error);
    return json({ error: "server_error" }, 500);
  }
}
