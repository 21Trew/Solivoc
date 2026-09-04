import { checkRateLimit, currentSession, json, sameOrigin } from "./_auth-lib.mjs";
import { mutateCloudProfileAtomic } from "./_profile-sync-lib.mjs";
import { applyPendingEvents } from "./_pending-events-lib.mjs";
import { syncLeaderboardProjection } from "./_leaderboard-projection-lib.mjs";

export async function POST(request) {
  try {
    if (!sameOrigin(request)) return json({ error: "bad_origin" }, 403);
    if (!(await checkRateLimit(request, "pending-events", 240, 900))) return json({ error: "rate_limited" }, 429);
    const session = await currentSession(request);
    if (!session) return json({ error: "unauthorized" }, 401);
    const body = await request.json().catch(() => ({}));
    const events = Array.isArray(body.events) ? body.events.slice(0, 100) : [];
    if (!events.length) return json({ ok: true, ackedEventIds: [], blocked: [] });

    let ackedEventIds = [], blocked = [];
    const result = await mutateCloudProfileAtomic(session.userId, ({ current }) => {
      const applied = applyPendingEvents(current, events, { userId: session.userId });
      ackedEventIds = applied.ackedEventIds;
      blocked = applied.blocked;
      return applied.profile;
    });

    await syncLeaderboardProjection(session.userId, result.profile, session.user).catch(() => {});
    return json({
      ok: true,
      ackedEventIds,
      blocked,
      profile: result.profile,
      version: result.version,
      previousVersion: result.previousVersion,
      syncedAt: Date.now(),
    });
  } catch (error) {
    if (error?.message === "REDIS_NOT_CONFIGURED") return json({ error: "redis_not_configured" }, 503);
    if (error?.message === "profile_too_large") return json({ error: "profile_too_large" }, 413);
    if (["profile_busy", "profile_lock_lost"].includes(error?.message) || ["profile_busy", "profile_lock_lost"].includes(error?.code)) {
      return json({ error: error?.code || error?.message, retryable: true }, 409);
    }
    console.error("events POST", error);
    return json({ error: "server_error" }, 500);
  }
}
