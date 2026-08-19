import { checkRateLimit, cloudProfileVersion, currentSession, json, mergeCloudProfile, readCloudProfile, sameOrigin } from "./_auth-lib.mjs";

export async function GET(request) {
  try {
    if (!(await checkRateLimit(request, "account-read", 300, 900))) return json({ error: "rate_limited" }, 429);
    const session = await currentSession(request);
    if (!session) return json({ error: "unauthorized" }, 401);
    const [profile, version] = await Promise.all([readCloudProfile(session.userId), cloudProfileVersion(session.userId)]);
    return json({ ok: true, user: { id: session.user.id, email: session.user.email }, profile, version });
  } catch (error) {
    if (error?.message === "REDIS_NOT_CONFIGURED") return json({ error: "redis_not_configured" }, 503);
    console.error("account GET", error);
    return json({ error: "server_error" }, 500);
  }
}

export async function POST(request) {
  try {
    if (!sameOrigin(request)) return json({ error: "bad_origin" }, 403);
    if (!(await checkRateLimit(request, "account-sync", 180, 900))) return json({ error: "rate_limited" }, 429);
    const session = await currentSession(request);
    if (!session) return json({ error: "unauthorized" }, 401);
    const body = await request.json().catch(() => ({}));
    const merged = await mergeCloudProfile(session.userId, body.profile || {}, { clientVersion: Number(body.version) || 0 });
    return json({ ok: true, profile: merged.profile, version: merged.version, syncedAt: Date.now() });
  } catch (error) {
    if (error?.message === "REDIS_NOT_CONFIGURED") return json({ error: "redis_not_configured" }, 503);
    if (error?.message === "profile_too_large") return json({ error: "profile_too_large" }, 413);
    console.error("account POST", error);
    return json({ error: "server_error" }, 500);
  }
}
