import { createHash, timingSafeEqual } from "node:crypto";
import { checkRateLimit, readCloudProfile, readJsonKey, sameOrigin, sha256, userKey } from "./_auth-lib.mjs";
import { canonicalProfileNeedsNormalization, normalizeCanonicalProfile } from "./_canonical-profile-lib.mjs";
import { syncLeaderboardProjection } from "./_leaderboard-projection-lib.mjs";
import { mutateCloudProfileAtomic } from "./_profile-sync-lib.mjs";
import { redis } from "./_push-lib.mjs";

const ADMIN_COOKIE = "solivoc_admin_session";
const PROFILE_PREFIX = "worditaire:auth:profile:";

const json = (data, status = 200) => Response.json(data, {
  status,
  headers: { "Cache-Control": "no-store, max-age=0", "Content-Type": "application/json; charset=utf-8" },
});
const cleanUserId = (value) => String(value || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);

function configuredAdminLogin() { return String(process.env.ADMIN_LOGIN || "").trim().toLowerCase(); }
function configuredPasswordHash() { return String(process.env.ADMIN_PASSWORD_HASH || "").trim(); }
function configuredPassword() { return String(process.env.ADMIN_PASSWORD || ""); }
function constantTimeText(a, b) {
  const left = createHash("sha256").update(String(a || "")).digest();
  const right = createHash("sha256").update(String(b || "")).digest();
  return timingSafeEqual(left, right);
}
function adminCredentialVersion() {
  const passwordMarker = configuredPasswordHash() || sha256(configuredPassword());
  return sha256(`${configuredAdminLogin()}\n${passwordMarker}`);
}
function cookieValue(request, name) {
  for (const part of String(request.headers.get("cookie") || "").split(";")) {
    const index = part.indexOf("=");
    if (index < 1 || part.slice(0, index).trim() !== name) continue;
    const raw = part.slice(index + 1).trim();
    try { return decodeURIComponent(raw); } catch { return raw; }
  }
  return "";
}
function adminSessionKey(token) { return `worditaire:admin:session:${sha256(token)}`; }
async function currentAdminSession(request) {
  const token = cookieValue(request, ADMIN_COOKIE);
  if (!token) return null;
  const raw = await redis(["GET", adminSessionKey(token)]);
  if (!raw) return null;
  let stored = null;
  try { stored = JSON.parse(raw); } catch {}
  if (!stored?.version || !constantTimeText(stored.version, adminCredentialVersion())) return null;
  return { login: configuredAdminLogin() };
}

async function canonicalizeAndProject(userId) {
  const id = cleanUserId(userId);
  if (!/^u_[a-zA-Z0-9_-]{8,62}$/.test(id)) throw Object.assign(new Error("invalid_user_id"), { status: 400 });
  const existing = await readCloudProfile(id);
  if (!existing || !Object.keys(existing).length) throw Object.assign(new Error("profile_not_found"), { status: 404 });
  let profile = existing;
  let normalized = false;
  if (canonicalProfileNeedsNormalization(existing)) {
    const result = await mutateCloudProfileAtomic(id, ({ current }) => normalizeCanonicalProfile(current));
    profile = result.profile;
    normalized = true;
  }
  const user = await readJsonKey(userKey(id)).catch(() => null);
  const projection = await syncLeaderboardProjection(id, profile, user || {});
  return {
    userId: id,
    normalized,
    levels: Number(profile.stats?.levelsCompleted) || 0,
    stars: Number(profile.totalStars) || 0,
    projectionVersion: Number(projection?.projectionVersion) || 0,
  };
}

async function profileIds(limit = 5000) {
  let cursor = "0";
  const ids = [];
  do {
    const result = await redis(["SCAN", cursor, "MATCH", `${PROFILE_PREFIX}*`, "COUNT", 200]);
    cursor = String(result?.[0] ?? "0");
    for (const key of Array.isArray(result?.[1]) ? result[1] : []) {
      const id = String(key).slice(PROFILE_PREFIX.length);
      if (/^u_[a-zA-Z0-9_-]{8,62}$/.test(id)) ids.push(id);
      if (ids.length >= limit) return ids;
    }
  } while (cursor !== "0");
  return ids;
}

export function OPTIONS() { return json({ ok: true }); }

export async function POST(request) {
  if (!sameOrigin(request)) return json({ error: "bad_origin" }, 403);
  try {
    if (!(await checkRateLimit(request, "admin-canonical-projection", 90, 900))) return json({ error: "rate_limited" }, 429);
    const session = await currentAdminSession(request);
    if (!session) return json({ error: "unauthorized" }, 401);
    const body = await request.json().catch(() => ({}));
    const scope = String(body.scope || "player");
    if (scope === "player") {
      const result = await canonicalizeAndProject(body.userId);
      return json({ ok: true, scope, ...result });
    }
    if (scope === "all") {
      const ids = await profileIds();
      let projected = 0, normalized = 0, failed = 0;
      for (const id of ids) {
        try {
          const result = await canonicalizeAndProject(id);
          projected++;
          if (result.normalized) normalized++;
        } catch { failed++; }
      }
      return json({ ok: true, scope, profiles: ids.length, projected, normalized, failed });
    }
    return json({ error: "invalid_scope" }, 400);
  } catch (error) {
    if (error?.message === "REDIS_NOT_CONFIGURED") return json({ error: "redis_not_configured" }, 503);
    if (["profile_busy", "profile_lock_lost"].includes(error?.message) || ["profile_busy", "profile_lock_lost"].includes(error?.code)) {
      return json({ error: error?.code || error?.message, retryable: true }, 409);
    }
    return json({ error: String(error?.message || "server_error") }, Number(error?.status) || 500);
  }
}
