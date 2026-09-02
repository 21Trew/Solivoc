import { checkRateLimit, cloudProfileVersion, currentSession, json, readCloudProfile, sameOrigin, sessionCookie, sessionKey, userKey } from "./_auth-lib.mjs";
import { redis } from "./_push-lib.mjs";
import { mergeEntityProgressDomains } from "./_progression-merge-lib.mjs";
import { mergeMascotDailySnapshots } from "./_v34-profile-merge-lib.mjs";
import { mergeCloudProfileAtomic } from "./_profile-sync-lib.mjs";

const SESSION_REFRESH_TTL = 60 * 60 * 24 * 30;

function accountHeaders(session) {
  if (!session?.token) return {};
  return { "Set-Cookie": sessionCookie(session.token, SESSION_REFRESH_TTL) };
}

async function refreshSession(session) {
  if (!session?.token) return;
  await redis(["EXPIRE", sessionKey(session.token), SESSION_REFRESH_TTL]).catch(() => {});
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

function reconcileCompletionLedger(current, incoming, profile) {
  const ledgers = [current?.completionLedgerBase, incoming?.completionLedgerBase]
    .map(Number).filter((value) => Number.isFinite(value) && value >= 0);
  if (ledgers.length) profile.completionLedgerBase = Math.min(...ledgers);
  const transactions = profile?.completionTransactions && typeof profile.completionTransactions === "object"
    ? profile.completionTransactions : {};
  let ledgerXp = Number(profile.completionLedgerBase) || 0;
  for (const tx of Object.values(transactions)) ledgerXp += Math.max(0, Number(tx?.xpDelta) || 0);
  profile.xp = Math.max(0, Number(profile.xp) || 0, ledgerXp);
  return profile;
}

export async function GET(request) {
  try {
    if (!(await checkRateLimit(request, "account-read", 300, 900))) return json({ error: "rate_limited" }, 429);
    const session = await currentSession(request);
    if (!session) return json({ error: "unauthorized" }, 401);
    await refreshSession(session);
    const headers = accountHeaders(session);
    const url = new URL(request.url);
    const requestedPlayers = [...new Set(String(url.searchParams.get("players") || "").split(",")
      .map((id) => String(id || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64))
      .filter((id) => /^u_[a-zA-Z0-9_-]{8,62}$/.test(id)))]
      .slice(0, 100);
    if (requestedPlayers.length) {
      const rows = await redis(["MGET", ...requestedPlayers.map((id) => userKey(id))]);
      return json({ ok: true, players: Object.fromEntries(requestedPlayers.map((id, index) => [id, { deleted: !rows?.[index] }])) }, 200, headers);
    }
    const [profile, version] = await Promise.all([readCloudProfile(session.userId), cloudProfileVersion(session.userId)]);
    return json({ ok: true, user: { id: session.user.id, email: session.user.email }, profile, version, serverNow: Date.now(), gameDayId: gameDayId() }, 200, headers);
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
    const incomingProfile = body.profile && typeof body.profile === "object" ? body.profile : {};
    const merged = await mergeCloudProfileAtomic(session.userId, incomingProfile, {
      clientVersion: Number(body.version) || 0,
      finalize: ({ current, incoming, merged: profile }) => {
        Object.assign(profile, mergeEntityProgressDomains(current, incoming));
        const mascotDaily = mergeMascotDailySnapshots(current.mascotDaily, incoming.mascotDaily);
        if (mascotDaily?.date) profile.mascotDaily = mascotDaily;
        return reconcileCompletionLedger(current, incoming, profile);
      },
    });
    await refreshSession(session);
    return json({ ok: true, profile: merged.profile, version: merged.version, previousVersion: merged.previousVersion, staleClient: merged.staleClient, syncedAt: Date.now(), serverNow: Date.now(), gameDayId: gameDayId() }, 200, accountHeaders(session));
  } catch (error) {
    if (error?.message === "REDIS_NOT_CONFIGURED") return json({ error: "redis_not_configured" }, 503);
    if (error?.message === "profile_too_large") return json({ error: "profile_too_large" }, 413);
    if (["profile_busy", "profile_lock_lost"].includes(error?.message) || ["profile_busy", "profile_lock_lost"].includes(error?.code)) {
      return json({ error: error?.code || error?.message, retryable: true }, 409);
    }
    console.error("account POST", error);
    return json({ error: "server_error" }, 500);
  }
}
