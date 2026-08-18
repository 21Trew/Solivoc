import { randomInt } from "node:crypto";
import {
  checkRateLimit, cleanEmail, cloudProfileVersion, createSession, currentSession, deleteSession,
  emailKey, hashSecret, json, mergeCloudProfile, newRecoveryCode, newUserId, readCloudProfile, readJsonKey,
  profileKey, profileVersionKey, sameOrigin, sessionCookie, sha256, userKey, validPassword, verifySecret, writeJsonKey
} from "./_auth-lib.mjs";
import { sendRegistrationCode } from "./_mail-lib.mjs";
import { redis } from "./_push-lib.mjs";

const VERIFICATION_TTL = 10 * 60;
const VERIFICATION_COOLDOWN = 60;
const VERIFICATION_MAX_ATTEMPTS = 6;
const VERIFICATION_DAILY_SEND_LIMIT = 180;
const VERIFICATION_ROLLING_MONTH_SEND_LIMIT = 1800;

function publicUser(user) {
  return user ? { id: user.id, email: user.email, createdAt: user.createdAt || 0 } : null;
}

function verificationKey(email) { return `worditaire:auth:verify:${sha256(cleanEmail(email))}`; }
function verificationAttemptsKey(email) { return `worditaire:auth:verify-attempts:${sha256(cleanEmail(email))}`; }
function verificationCooldownKey(email) { return `worditaire:auth:verify-cooldown:${sha256(cleanEmail(email))}`; }

async function consumeCounter(key, limit, windowSec) {
  const count = Number(await redis(["INCR", key])) || 0;
  if (count === 1) await redis(["EXPIRE", key, windowSec]);
  const ttl = Math.max(1, Number(await redis(["TTL", key])) || windowSec);
  return { allowed: count <= limit, count, retryAfter: ttl };
}

async function reserveVerificationSendQuota() {
  // Default Postbox quota is one message per second. Keep an application-side
  // gate as well so concurrent registrations fail predictably instead of
  // turning into provider-level SMTP errors.
  const burst = await redis(["SET", "worditaire:auth:verify-send:second", "1", "EX", 1, "NX"]);
  if (!burst) return { allowed: false, retryAfter: 1 };
  const day = await consumeCounter("worditaire:auth:verify-send:rolling-day", VERIFICATION_DAILY_SEND_LIMIT, 24 * 60 * 60);
  if (!day.allowed) return day;
  const month = await consumeCounter("worditaire:auth:verify-send:rolling-31d", VERIFICATION_ROLLING_MONTH_SEND_LIMIT, 31 * 24 * 60 * 60);
  return month;
}

async function claimVerificationCooldown(email) {
  const key = verificationCooldownKey(email);
  const claimed = await redis(["SET", key, "1", "EX", VERIFICATION_COOLDOWN, "NX"]);
  if (claimed) return { allowed: true, retryAfter: 0 };
  return { allowed: false, retryAfter: Math.max(1, Number(await redis(["TTL", key])) || VERIFICATION_COOLDOWN) };
}

function newVerificationCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

async function issueRegistrationCode(email, passwordHash, { requirePending = false } = {}) {
  const key = verificationKey(email);
  let pending = requirePending ? await readJsonKey(key) : null;
  if (requirePending && (!pending?.passwordHash || Number(pending.expiresAt) <= Date.now())) {
    await Promise.allSettled([redis(["DEL", key]), redis(["DEL", verificationAttemptsKey(email)])]);
    return { error: "verification_not_started", status: 410 };
  }

  const cooldown = await claimVerificationCooldown(email);
  if (!cooldown.allowed) return { error: "verification_resend_too_soon", status: 429, retryAfter: cooldown.retryAfter };

  const quota = await reserveVerificationSendQuota();
  if (!quota.allowed) {
    await redis(["DEL", verificationCooldownKey(email)]).catch(() => {});
    return { error: "verification_send_limit", status: 429, retryAfter: quota.retryAfter };
  }

  const code = newVerificationCode();
  const now = Date.now();
  pending = {
    passwordHash: passwordHash || pending.passwordHash,
    codeHash: await hashSecret(code),
    createdAt: now,
    expiresAt: now + VERIFICATION_TTL * 1000,
  };

  await Promise.all([
    writeJsonKey(key, pending, "EX", VERIFICATION_TTL),
    redis(["DEL", verificationAttemptsKey(email)]),
  ]);

  try {
    await sendRegistrationCode(email, code);
  } catch (error) {
    await Promise.allSettled([
      redis(["DEL", key]),
      redis(["DEL", verificationAttemptsKey(email)]),
      redis(["DEL", verificationCooldownKey(email)]),
    ]);
    if (error?.message === "POSTBOX_NOT_CONFIGURED") return { error: "email_not_configured", status: 503 };
    console.error("auth verification send", error?.code || error?.responseCode || error?.message || "smtp_error");
    return { error: "email_send_failed", status: 502 };
  }

  return {
    ok: true,
    email,
    expiresIn: VERIFICATION_TTL,
    resendAfter: VERIFICATION_COOLDOWN,
  };
}

async function createRegisteredAccount(email, passwordHash, profile) {
  const userId = newUserId(), recoveryCode = newRecoveryCode(), now = Date.now();
  const user = {
    id: userId,
    email,
    passwordHash,
    recoveryHash: await hashSecret(recoveryCode.replace(/-/g, "")),
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
        { ok: true, user: publicUser(user), profile: merged.profile, version: merged.version, recoveryCode },
        201,
        { "Set-Cookie": sessionCookie(token) },
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
      return json({ ok: true }, 200, { "Set-Cookie": sessionCookie("", 0) });
    }

    const allowedActions = ["register_start", "register_resend", "register_verify", "login", "recover"];
    if (!allowedActions.includes(action)) return json({ error: action === "register" ? "verification_required" : "bad_action" }, 400);
    const limits = {
      register_start: [6, 900],
      register_resend: [6, 900],
      register_verify: [16, 900],
      login: [16, 900],
      recover: [8, 900],
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

      const pendingKey = verificationKey(email);
      const pending = await readJsonKey(pendingKey);
      if (!pending?.codeHash || !pending?.passwordHash || Number(pending.expiresAt) <= Date.now()) {
        await Promise.allSettled([redis(["DEL", pendingKey]), redis(["DEL", verificationAttemptsKey(email)])]);
        return json({ error: "verification_expired" }, 410);
      }

      const attempts = Number(await redis(["INCR", verificationAttemptsKey(email)])) || 0;
      if (attempts === 1) await redis(["EXPIRE", verificationAttemptsKey(email), VERIFICATION_TTL]);
      if (attempts > VERIFICATION_MAX_ATTEMPTS) {
        await Promise.allSettled([redis(["DEL", pendingKey]), redis(["DEL", verificationAttemptsKey(email)])]);
        return json({ error: "verification_attempts_exceeded" }, 429);
      }
      if (!(await verifySecret(code, pending.codeHash))) {
        return json({ error: "invalid_verification_code", attemptsLeft: Math.max(0, VERIFICATION_MAX_ATTEMPTS - attempts) }, 401);
      }

      const created = await createRegisteredAccount(email, pending.passwordHash, body.profile || {});
      if (created.error) return json({ error: created.error }, created.status);
      await Promise.allSettled([
        redis(["DEL", pendingKey]),
        redis(["DEL", verificationAttemptsKey(email)]),
        redis(["DEL", verificationCooldownKey(email)]),
      ]);
      return created.response;
    }

    if (!existingId) return json({ error: "invalid_credentials" }, 401);
    const user = await readJsonKey(userKey(existingId));
    if (!user) return json({ error: "invalid_credentials" }, 401);

    if (action === "login") {
      if (!validPassword(body.password) || !(await verifySecret(body.password, user.passwordHash))) return json({ error: "invalid_credentials" }, 401);
      const merged = await mergeCloudProfile(existingId, body.profile || {}, { preferIncomingPreferences: false });
      const token = await createSession(existingId, user.sessionVersion);
      return json({ ok: true, user: publicUser(user), profile: merged.profile, version: merged.version }, 200, { "Set-Cookie": sessionCookie(token) });
    }

    const recovery = String(body.recoveryCode || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (recovery.length < 16 || !validPassword(body.newPassword)) return json({ error: "invalid_recovery" }, 400);
    if (!(await verifySecret(recovery, user.recoveryHash))) return json({ error: "invalid_recovery" }, 401);
    user.passwordHash = await hashSecret(body.newPassword);
    user.passwordChangedAt = Date.now();
    user.sessionVersion = Math.max(1, Number(user.sessionVersion) || 1) + 1;
    await writeJsonKey(userKey(existingId), user);
    const token = await createSession(existingId, user.sessionVersion);
    const profile = await readCloudProfile(existingId), version = await cloudProfileVersion(existingId);
    return json({ ok: true, user: publicUser(user), profile, version }, 200, { "Set-Cookie": sessionCookie(token) });
  } catch (error) {
    if (error?.message === "REDIS_NOT_CONFIGURED") return json({ error: "redis_not_configured" }, 503);
    if (error?.message === "profile_too_large") return json({ error: "profile_too_large" }, 413);
    console.error("auth POST", error);
    return json({ error: "server_error" }, 500);
  }
}
