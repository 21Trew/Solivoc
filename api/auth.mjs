import { randomInt } from "node:crypto";
import {
  checkRateLimit, cleanEmail, cloudProfileVersion, createSession, currentSession, deleteSession,
  emailKey, hashSecret, json, mergeCloudProfile, newUserId, readCloudProfile, readJsonKey,
  profileKey, profileVersionKey, sameOrigin, sessionCookie, sha256, userKey, validPassword, verifySecret, writeJsonKey
} from "./_auth-lib.mjs";
import { sendPasswordResetCode, sendRegistrationCode } from "./_mail-lib.mjs";
import { redis } from "./_push-lib.mjs";

const CODE_TTL = 10 * 60;
const CODE_COOLDOWN = 60;
const CODE_MAX_ATTEMPTS = 6;
const AUTH_MAIL_DAILY_LIMIT = 180;
const AUTH_MAIL_ROLLING_MONTH_LIMIT = 1800;
const DUMMY_PASSWORD_HASH = "s2:5elS335qSlz8bHnQ8mH52A:LG4krNk_ezI-y9ZCSPG5fqC8HU-Y9Sn48nrdSDWm0D_NtWHr2bRktSw3Rak_n4Eth9HE_JUrE3wi3joSatEm-A";

function requestSessionCookie(request, token, maxAge) {
  // _auth-lib historically keyed Secure off Vercel/NODE_ENV. Production now
  // runs in Yandex Cloud, so derive the flag from the actual request URL.
  const base = sessionCookie(token, maxAge).replace(/;\s*Secure/gi, "");
  let secure = "";
  try { secure = new URL(request.url).protocol === "https:" ? "; Secure" : ""; } catch {}
  return `${base}${secure}`;
}

function publicUser(user) {
  return user ? { id: user.id, email: user.email, createdAt: user.createdAt || 0 } : null;
}

function flowKey(kind, email) { return `worditaire:auth:${kind}:${sha256(cleanEmail(email))}`; }
function flowErrorPrefix(kind) { return kind === "verify" ? "verification" : kind; }
function flowAttemptsKey(kind, email) { return `worditaire:auth:${kind}-attempts:${sha256(cleanEmail(email))}`; }
function flowCooldownKey(kind, email) { return `worditaire:auth:${kind}-cooldown:${sha256(cleanEmail(email))}`; }

async function consumeCounter(key, limit, windowSec) {
  const count = Number(await redis(["INCR", key])) || 0;
  if (count === 1) await redis(["EXPIRE", key, windowSec]);
  const ttl = Math.max(1, Number(await redis(["TTL", key])) || windowSec);
  return { allowed: count <= limit, count, retryAfter: ttl };
}

async function reserveAuthMailQuota() {
  // Default Postbox quota is one message per second and 200 per rolling 24h.
  // Keep our own combined registration/recovery ceiling below the provider quota.
  const burst = await redis(["SET", "worditaire:auth:mail-send:second", "1", "EX", 1, "NX"]);
  if (!burst) return { allowed: false, retryAfter: 1 };
  const day = await consumeCounter("worditaire:auth:mail-send:rolling-day", AUTH_MAIL_DAILY_LIMIT, 24 * 60 * 60);
  if (!day.allowed) return day;
  return consumeCounter("worditaire:auth:mail-send:rolling-31d", AUTH_MAIL_ROLLING_MONTH_LIMIT, 31 * 24 * 60 * 60);
}

async function claimFlowCooldown(kind, email) {
  const key = flowCooldownKey(kind, email);
  const claimed = await redis(["SET", key, "1", "EX", CODE_COOLDOWN, "NX"]);
  if (claimed) return { allowed: true, retryAfter: 0 };
  return { allowed: false, retryAfter: Math.max(1, Number(await redis(["TTL", key])) || CODE_COOLDOWN) };
}

function newCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

async function clearFlow(kind, email) {
  await Promise.allSettled([
    redis(["DEL", flowKey(kind, email)]),
    redis(["DEL", flowAttemptsKey(kind, email)]),
    redis(["DEL", flowCooldownKey(kind, email)]),
  ]);
}

async function issueCode({ kind, email, payload = {}, requirePending = false, sender }) {
  const key = flowKey(kind, email);
  let pending = requirePending ? await readJsonKey(key) : null;
  if (requirePending && (!pending || Number(pending.expiresAt) <= Date.now())) {
    await clearFlow(kind, email);
    return { error: `${flowErrorPrefix(kind)}_not_started`, status: 410 };
  }

  const cooldown = await claimFlowCooldown(kind, email);
  if (!cooldown.allowed) return { error: `${flowErrorPrefix(kind)}_resend_too_soon`, status: 429, retryAfter: cooldown.retryAfter };

  const quota = await reserveAuthMailQuota();
  if (!quota.allowed) {
    await redis(["DEL", flowCooldownKey(kind, email)]).catch(() => {});
    return { error: "verification_send_limit", status: 429, retryAfter: quota.retryAfter };
  }

  const code = newCode();
  const now = Date.now();
  pending = {
    ...(pending || {}),
    ...payload,
    codeHash: await hashSecret(code),
    createdAt: now,
    expiresAt: now + CODE_TTL * 1000,
  };

  await Promise.all([
    writeJsonKey(key, pending, "EX", CODE_TTL),
    redis(["DEL", flowAttemptsKey(kind, email)]),
  ]);

  try {
    await sender(email, code);
  } catch (error) {
    await clearFlow(kind, email);
    if (error?.message === "POSTBOX_NOT_CONFIGURED") return { error: "email_not_configured", status: 503 };
    console.error(`auth ${kind} send`, error?.code || error?.responseCode || error?.message || "smtp_error");
    return { error: "email_send_failed", status: 502 };
  }

  return { ok: true, email, expiresIn: CODE_TTL, resendAfter: CODE_COOLDOWN };
}

async function issueRegistrationCode(email, passwordHash, { requirePending = false } = {}) {
  return issueCode({
    kind: "verify",
    email,
    payload: passwordHash ? { passwordHash } : {},
    requirePending,
    sender: sendRegistrationCode,
  });
}

async function issueRecoveryCode(email, userId) {
  return issueCode({
    kind: "recover",
    email,
    payload: { userId },
    sender: sendPasswordResetCode,
  });
}

async function verifyFlowCode(kind, email, code) {
  const pendingKey = flowKey(kind, email);
  const pending = await readJsonKey(pendingKey);
  if (!pending?.codeHash || Number(pending.expiresAt) <= Date.now()) {
    await clearFlow(kind, email);
    return { error: `${flowErrorPrefix(kind)}_expired`, status: 410 };
  }

  const attemptsKey = flowAttemptsKey(kind, email);
  const attempts = Number(await redis(["INCR", attemptsKey])) || 0;
  if (attempts === 1) await redis(["EXPIRE", attemptsKey, CODE_TTL]);
  if (attempts > CODE_MAX_ATTEMPTS) {
    await clearFlow(kind, email);
    return { error: `${flowErrorPrefix(kind)}_attempts_exceeded`, status: 429 };
  }
  if (!(await verifySecret(code, pending.codeHash))) {
    return {
      error: kind === "verify" ? "invalid_verification_code" : "invalid_recovery_code",
      status: 401,
      attemptsLeft: Math.max(0, CODE_MAX_ATTEMPTS - attempts),
    };
  }
  return { ok: true, pending };
}

async function createRegisteredAccount(email, passwordHash, profile) {
  const userId = newUserId(), now = Date.now();
  const user = {
    id: userId,
    email,
    passwordHash,
    createdAt: now,
    passwordChangedAt: now,
    sessionVersion: 1,
  };
  const reserved = await redis(["SET", emailKey(email), userId, "NX"]);
  if (!reserved) return { error: "email_exists", status: 409 };
  try {
    await writeJsonKey(userKey(userId), user);
    const merged = await mergeCloudProfile(userId, profile || {}, { preferIncomingPreferences: true });
    const token = await createSession(userId, user.sessionVersion);
    return {
      response: json(
        { ok: true, user: publicUser(user), profile: merged.profile, version: merged.version },
        201,
        { "Set-Cookie": requestSessionCookie(request, token) },
      ),
    };
  } catch (error) {
    await Promise.allSettled([
      redis(["DEL", emailKey(email)]),
      redis(["DEL", userKey(userId)]),
      redis(["DEL", profileKey(userId)]),
      redis(["DEL", profileVersionKey(userId)]),
    ]);
    throw error;
  }
}

function genericRecoveryStarted(email) {
  return { ok: true, email, expiresIn: CODE_TTL, resendAfter: CODE_COOLDOWN };
}

export async function GET(request) {
  try {
    if (!(await checkRateLimit(request, "auth-read", 300, 900))) return json({ error: "rate_limited" }, 429);
    const session = await currentSession(request);
    if (!session) return json({ authenticated: false }, 401);
    const [profile, version] = await Promise.all([readCloudProfile(session.userId), cloudProfileVersion(session.userId)]);
    return json({ authenticated: true, user: publicUser(session.user), profile, version });
  } catch (error) {
    if (error?.message === "REDIS_NOT_CONFIGURED") return json({ error: "redis_not_configured" }, 503);
    console.error("auth GET", error);
    return json({ error: "server_error" }, 500);
  }
}

export async function POST(request) {
  try {
    if (!sameOrigin(request)) return json({ error: "bad_origin" }, 403);
    const body = await request.json().catch(() => ({}));
    const action = String(body.action || "");

    if (action === "logout") {
      await deleteSession(request);
      return json({ ok: true }, 200, { "Set-Cookie": requestSessionCookie(request, "", 0) });
    }

    const allowedActions = [
      "register_start", "register_resend", "register_verify",
      "login",
      "recover_start", "recover_resend", "recover_verify",
    ];
    if (!allowedActions.includes(action)) return json({ error: action === "register" ? "verification_required" : "bad_action" }, 400);

    const limits = {
      register_start: [6, 900],
      register_resend: [6, 900],
      register_verify: [16, 900],
      login: [16, 900],
      recover_start: [6, 900],
      recover_resend: [6, 900],
      recover_verify: [16, 900],
    };
    const [limit, windowSec] = limits[action];
    if (!(await checkRateLimit(request, action, limit, windowSec))) return json({ error: "rate_limited" }, 429);

    const email = cleanEmail(body.email);
    if (!email) return json({ error: "invalid_email" }, 400);
    const existingId = await redis(["GET", emailKey(email)]);

    if (action === "register_start") {
      if (!validPassword(body.password)) return json({ error: "weak_password" }, 400);
      if (existingId) return json({ error: "email_exists" }, 409);
      const perEmail = await consumeCounter(`worditaire:auth:verify-email-rate:${sha256(email)}`, 4, 15 * 60);
      if (!perEmail.allowed) return json({ error: "rate_limited", retryAfter: perEmail.retryAfter }, 429);
      const result = await issueRegistrationCode(email, await hashSecret(body.password));
      if (result.error) return json({ error: result.error, retryAfter: result.retryAfter || 0 }, result.status);
      return json(result, 202);
    }

    if (action === "register_resend") {
      if (existingId) return json({ error: "email_exists" }, 409);
      const perEmail = await consumeCounter(`worditaire:auth:verify-email-rate:${sha256(email)}`, 4, 15 * 60);
      if (!perEmail.allowed) return json({ error: "rate_limited", retryAfter: perEmail.retryAfter }, 429);
      const result = await issueRegistrationCode(email, null, { requirePending: true });
      if (result.error) return json({ error: result.error, retryAfter: result.retryAfter || 0 }, result.status);
      return json(result, 202);
    }

    if (action === "register_verify") {
      if (existingId) return json({ error: "email_exists" }, 409);
      const code = String(body.code || "").replace(/\D/g, "").slice(0, 6);
      if (code.length !== 6) return json({ error: "verification_code_required" }, 400);
      const checked = await verifyFlowCode("verify", email, code);
      if (checked.error) return json({ error: checked.error, attemptsLeft: checked.attemptsLeft ?? 0 }, checked.status);
      if (!checked.pending?.passwordHash) {
        await clearFlow("verify", email);
        return json({ error: "verification_expired" }, 410);
      }
      const created = await createRegisteredAccount(email, checked.pending.passwordHash, body.profile || {});
      if (created.error) return json({ error: created.error }, created.status);
      await clearFlow("verify", email);
      return created.response;
    }

    if (action === "login") {
      const loginEmailRate = await consumeCounter(`worditaire:auth:login-email-rate:${sha256(email)}`, 24, 60 * 60);
      if (!loginEmailRate.allowed) return json({ error: "rate_limited", retryAfter: loginEmailRate.retryAfter }, 429);
      const user = existingId ? await readJsonKey(userKey(existingId)) : null;
      const passwordLooksValid = validPassword(body.password);
      const passwordMatches = passwordLooksValid && await verifySecret(body.password, user?.passwordHash || DUMMY_PASSWORD_HASH);
      if (!user || !passwordMatches) return json({ error: "invalid_credentials" }, 401);
      const merged = await mergeCloudProfile(existingId, body.profile || {}, { preferIncomingPreferences: false });
      const token = await createSession(existingId, user.sessionVersion);
      return json({ ok: true, user: publicUser(user), profile: merged.profile, version: merged.version }, 200, { "Set-Cookie": requestSessionCookie(request, token) });
    }

    if (action === "recover_start" || action === "recover_resend") {
      const perEmail = await consumeCounter(`worditaire:auth:recover-email-rate:${sha256(email)}`, 5, 30 * 60);
      if (!perEmail.allowed) return json({ error: "rate_limited", retryAfter: perEmail.retryAfter }, 429);

      // Do not disclose whether the email is registered. Unknown addresses get the
      // same successful response but no message is sent.
      const user = existingId ? await readJsonKey(userKey(existingId)) : null;
      if (!user) {
        const cooldown = await claimFlowCooldown("recover", email).catch(() => ({ allowed: true, retryAfter: 0 }));
        return json({ ...genericRecoveryStarted(email), resendAfter: cooldown.allowed ? CODE_COOLDOWN : cooldown.retryAfter }, 202);
      }

      // Keep the response deliberately generic even if a resend is too early or
      // the provider is temporarily unavailable. This prevents the reset endpoint
      // from becoming an account-enumeration oracle. Provider failures are logged
      // inside issueCode and remain visible in Vercel logs.
      const result = await issueRecoveryCode(email, existingId);
      return json({ ...genericRecoveryStarted(email), resendAfter: result.retryAfter || result.resendAfter || CODE_COOLDOWN }, 202);
    }

    if (!validPassword(body.newPassword)) return json({ error: "weak_password" }, 400);
    const code = String(body.code || "").replace(/\D/g, "").slice(0, 6);
    if (code.length !== 6) return json({ error: "recovery_code_required" }, 400);
    if (!existingId) return json({ error: "recovery_expired" }, 410);
    const user = await readJsonKey(userKey(existingId));
    if (!user) return json({ error: "recovery_expired" }, 410);

    const checked = await verifyFlowCode("recover", email, code);
    if (checked.error) return json({ error: checked.error, attemptsLeft: checked.attemptsLeft ?? 0 }, checked.status);
    if (String(checked.pending?.userId || "") !== String(existingId)) {
      await clearFlow("recover", email);
      return json({ error: "recovery_expired" }, 410);
    }

    // Compare only after the one-time code is verified. Doing this earlier would
    // let an unauthenticated caller probe whether a guessed password matches.
    if (await verifySecret(body.newPassword, user.passwordHash)) {
      return json({ error: "password_unchanged" }, 400);
    }

    user.passwordHash = await hashSecret(body.newPassword);
    user.passwordChangedAt = Date.now();
    user.sessionVersion = Math.max(1, Number(user.sessionVersion) || 1) + 1;
    // Legacy recovery hashes may exist on accounts created before email recovery.
    // Remove them when the password is next reset so the old mechanism disappears.
    delete user.recoveryHash;
    await writeJsonKey(userKey(existingId), user);
    await clearFlow("recover", email);

    const token = await createSession(existingId, user.sessionVersion);
    const profile = await readCloudProfile(existingId), version = await cloudProfileVersion(existingId);
    return json({ ok: true, user: publicUser(user), profile, version }, 200, { "Set-Cookie": requestSessionCookie(request, token) });
  } catch (error) {
    if (error?.message === "REDIS_NOT_CONFIGURED") return json({ error: "redis_not_configured" }, 503);
    if (error?.message === "profile_too_large") return json({ error: "profile_too_large" }, 413);
    console.error("auth POST", error);
    return json({ error: "server_error" }, 500);
  }
}
