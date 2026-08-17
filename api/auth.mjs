import {
  checkRateLimit, cleanEmail, cloudProfileVersion, createSession, currentSession, deleteSession,
  emailKey, hashSecret, json, mergeCloudProfile, newRecoveryCode, newUserId, readCloudProfile, readJsonKey,
  sameOrigin, sessionCookie, userKey, validPassword, verifySecret, writeJsonKey
} from "./_auth-lib.mjs";
import { redis } from "./_push-lib.mjs";

function publicUser(user) {
  return user ? { id: user.id, email: user.email, createdAt: user.createdAt || 0 } : null;
}

export async function GET(request) {
  try {
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

    if (!["register", "login", "recover"].includes(action)) return json({ error: "bad_action" }, 400);
    if (!(await checkRateLimit(request, action, action === "login" ? 16 : 8, 900))) return json({ error: "rate_limited" }, 429);

    const email = cleanEmail(body.email);
    if (!email) return json({ error: "invalid_email" }, 400);
    const existingId = await redis(["GET", emailKey(email)]);

    if (action === "register") {
      if (!validPassword(body.password)) return json({ error: "weak_password" }, 400);
      if (existingId) return json({ error: "email_exists" }, 409);
      const userId = newUserId(), recoveryCode = newRecoveryCode(), now = Date.now();
      const user = {
        id: userId,
        email,
        passwordHash: await hashSecret(body.password),
        recoveryHash: await hashSecret(recoveryCode.replace(/-/g, "")),
        createdAt: now,
        passwordChangedAt: now,
        sessionVersion: 1,
      };
      // Reserve the e-mail first. SET NX prevents duplicate concurrent registrations.
      const reserved = await redis(["SET", emailKey(email), userId, "NX"]);
      if (!reserved) return json({ error: "email_exists" }, 409);
      try {
        await writeJsonKey(userKey(userId), user);
        const merged = await mergeCloudProfile(userId, body.profile || {}, { preferIncomingPreferences: true });
        const token = await createSession(userId, user.sessionVersion);
        return json({ ok: true, user: publicUser(user), profile: merged.profile, version: merged.version, recoveryCode }, 201, { "Set-Cookie": sessionCookie(token) });
      } catch (error) {
        await redis(["DEL", emailKey(email)]).catch(() => {});
        throw error;
      }
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
