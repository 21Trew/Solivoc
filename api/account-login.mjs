import {
  checkRateLimit,
  cleanEmail,
  createSession,
  emailKey,
  json,
  readJsonKey,
  sameOrigin,
  sessionCookie,
  sha256,
  userKey,
  validPassword,
  verifySecret,
} from "./_auth-lib.mjs";
import { mutateCloudProfileAtomic } from "./_profile-sync-lib.mjs";
import { applyCampaignFloor, leaderboardCampaignFloor, profileBehindCampaignFloor } from "./_campaign-floor-lib.mjs";
import { redis } from "./_push-lib.mjs";

const DUMMY_PASSWORD_HASH = "s2:5elS335qSlz8bHnQ8mH52A:LG4krNk_ezI-y9ZCSPG5fqC8HU-Y9Sn48nrdSDWm0D_NtWHr2bRktSw3Rak_n4Eth9HE_JUrE3wi3joSatEm-A";
const leaderboardPlayerKey = (userId) => `worditaire:leaderboard:player:${String(userId || "").slice(0, 64)}`;

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

async function readLoginProfile(userId) {
  const raw = await redis(["GET", leaderboardPlayerKey(userId)]).catch(() => null);
  let floor = { levels: 0, stars: 0 };
  try {
    const record = raw ? JSON.parse(raw) : null;
    if (record?.account) floor = leaderboardCampaignFloor(record);
  } catch {}
  const result = await mutateCloudProfileAtomic(userId, ({ current }) => {
    if (!profileBehindCampaignFloor(current, floor)) return current;
    return applyCampaignFloor(current, floor);
  });
  return result;
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

    // Вход на втором устройстве не принимает профиль клиента. Перед выдачей
    // профиля дополнительно поднимаем кампанию до уже подтверждённого сервером
    // результата лидерборда, если облачная копия почему-то отстала.
    const resolved = await readLoginProfile(existingId);
    const token = await createSession(existingId, user.sessionVersion);
    const now = Date.now();
    return json({
      ok: true,
      user: publicUser(user),
      profile: resolved.profile,
      version: resolved.version,
      serverNow: now,
      gameDayId: gameDayId(now),
    }, 200, { "Set-Cookie": requestSessionCookie(request, token) });
  } catch (error) {
    if (error?.message === "REDIS_NOT_CONFIGURED") return json({ error: "redis_not_configured" }, 503);
    if (["profile_busy", "profile_lock_lost"].includes(error?.message) || ["profile_busy", "profile_lock_lost"].includes(error?.code)) {
      return json({ error: error?.code || error?.message, retryable: true }, 409);
    }
    console.error("account login", error);
    return json({ error: "server_error" }, 500);
  }
}
