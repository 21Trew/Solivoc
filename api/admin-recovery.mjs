import { createHash, timingSafeEqual } from "node:crypto";
import { checkRateLimit, sameOrigin, sha256 } from "./_auth-lib.mjs";
import { redis } from "./_push-lib.mjs";
import { getAdminRecoveryDetail, runAdminRecovery } from "./_admin-recovery-lib.mjs";

const ADMIN_COOKIE = "solivoc_admin_session";
const ADMIN_SESSION_TTL = 8 * 60 * 60;

const json = (data, status = 200, extraHeaders = {}) => Response.json(data, {
  status,
  headers: {
    "Cache-Control": "no-store, max-age=0",
    "Content-Type": "application/json; charset=utf-8",
    ...extraHeaders,
  },
});
function configuredLogin() { return String(process.env.ADMIN_LOGIN || "").trim().toLowerCase(); }
function configuredPasswordMarker() {
  const hash = String(process.env.ADMIN_PASSWORD_HASH || "").trim();
  return hash || sha256(String(process.env.ADMIN_PASSWORD || ""));
}
function credentialVersion() { return sha256(`${configuredLogin()}\n${configuredPasswordMarker()}`); }
function constantTimeText(a, b) {
  const left = createHash("sha256").update(String(a || "")).digest();
  const right = createHash("sha256").update(String(b || "")).digest();
  return timingSafeEqual(left, right);
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
async function currentAdminSession(request) {
  if (!configuredLogin() || !configuredPasswordMarker()) return null;
  const token = cookieValue(request, ADMIN_COOKIE);
  if (!token) return null;
  const raw = await redis(["GET", `worditaire:admin:session:${sha256(token)}`]);
  if (!raw) return null;
  let stored = null;
  try { stored = JSON.parse(raw); } catch {}
  if (!stored?.version || !constantTimeText(stored.version, credentialVersion())) return null;
  await redis(["EXPIRE", `worditaire:admin:session:${sha256(token)}`, ADMIN_SESSION_TTL]).catch(() => {});
  return { login: configuredLogin() };
}
function errorResponse(error) {
  const code = error?.code || error?.message || "server_error";
  const status = Number(error?.status) || (["profile_busy", "profile_lock_lost"].includes(code) ? 409 : 500);
  return json({ error: code, message: String(error?.message || error) }, status);
}

export function OPTIONS() { return json({ ok: true }); }

export async function GET(request) {
  if (!sameOrigin(request)) return json({ error: "bad_origin" }, 403);
  try {
    if (!(await checkRateLimit(request, "admin-recovery-read", 240, 900))) return json({ error: "rate_limited" }, 429);
    const session = await currentAdminSession(request);
    if (!session) return json({ error: "unauthorized", authenticated: false }, 401);
    const url = new URL(request.url);
    const userId = String(url.searchParams.get("userId") || "");
    if (!userId) return json({ error: "invalid_user_id", message: "Укажи игрока." }, 400);
    return json({ ok: true, authenticated: true, detail: await getAdminRecoveryDetail(userId) });
  } catch (error) {
    console.error("admin recovery GET", error);
    if (error?.message === "REDIS_NOT_CONFIGURED") return json({ error: "redis_not_configured" }, 503);
    return errorResponse(error);
  }
}

export async function POST(request) {
  if (!sameOrigin(request)) return json({ error: "bad_origin" }, 403);
  try {
    if (!(await checkRateLimit(request, "admin-recovery-write", 80, 900))) return json({ error: "rate_limited" }, 429);
    const session = await currentAdminSession(request);
    if (!session) return json({ error: "unauthorized", authenticated: false }, 401);
    const body = await request.json().catch(() => ({}));
    return json(await runAdminRecovery({ actor: session.login, body }));
  } catch (error) {
    console.error("admin recovery POST", error);
    if (error?.message === "REDIS_NOT_CONFIGURED") return json({ error: "redis_not_configured" }, 503);
    return errorResponse(error);
  }
}
