import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { checkRateLimit, sameOrigin, sha256, verifySecret } from "./_auth-lib.mjs";

const COOKIE = "solivoc_backup_session";
const ADMIN_COOKIE = "solivoc_admin_session";
const SESSION_TTL = 60 * 60;
const PAGE_SIZE = 64;

function json(data, status = 200, headers = {}) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "Content-Type": "application/json; charset=utf-8",
      ...headers,
    },
  });
}

function firstEnv(...names) {
  for (const name of names) if (process.env[name]) return process.env[name];
  return "";
}

function redisConfig() {
  return {
    url: firstEnv(
      "UPSTASH_REDIS_REST_URL",
      "KV_REST_API_URL",
      "UPSTASH_REDIS_REST_KV_REST_API_URL",
    ).replace(/\/$/, ""),
    token: firstEnv(
      "UPSTASH_REDIS_REST_TOKEN",
      "KV_REST_API_TOKEN",
      "UPSTASH_REDIS_REST_KV_REST_API_TOKEN",
    ),
  };
}

async function redisRequest(path, body, { base64 = false } = {}) {
  const { url, token } = redisConfig();
  if (!url || !token) throw new Error("REDIS_NOT_CONFIGURED");
  const response = await fetch(`${url}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(base64 ? { "Upstash-Encoding": "base64" } : {}),
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || `Redis HTTP ${response.status}`);
  return data;
}

async function redis(command) {
  const data = await redisRequest("", command);
  if (data?.error) throw new Error(data.error);
  return data?.result;
}

async function redisPipeline(commands, { base64 = false } = {}) {
  if (!commands.length) return [];
  const data = await redisRequest("/pipeline", commands, { base64 });
  if (!Array.isArray(data)) throw new Error("REDIS_PIPELINE_UNAVAILABLE");
  return data;
}

function configuredLogin() {
  return String(process.env.ADMIN_LOGIN || "").trim().toLowerCase();
}
function configuredPasswordHash() {
  return String(process.env.ADMIN_PASSWORD_HASH || "").trim();
}
function configuredPassword() {
  return String(process.env.ADMIN_PASSWORD || "");
}
function configured() {
  return !!configuredLogin() && !!(configuredPasswordHash() || configuredPassword());
}
function constantTimeText(a, b) {
  const left = createHash("sha256").update(String(a || "")).digest();
  const right = createHash("sha256").update(String(b || "")).digest();
  return timingSafeEqual(left, right);
}
async function validCredentials(login, password) {
  const loginOk = constantTimeText(String(login || "").trim().toLowerCase(), configuredLogin());
  let passwordOk = false;
  if (configuredPasswordHash()) passwordOk = await verifySecret(String(password || ""), configuredPasswordHash());
  else passwordOk = constantTimeText(String(password || ""), configuredPassword());
  return loginOk && passwordOk;
}
function credentialVersion() {
  const marker = configuredPasswordHash() || sha256(configuredPassword());
  return sha256(`${configuredLogin()}\n${marker}`);
}

function cookieValue(request, name) {
  for (const part of String(request.headers.get("cookie") || "").split(";")) {
    const index = part.indexOf("=");
    if (index < 1) continue;
    if (part.slice(0, index).trim() !== name) continue;
    const raw = part.slice(index + 1).trim();
    try { return decodeURIComponent(raw); } catch { return raw; }
  }
  return "";
}
function sessionKey(token) {
  return `worditaire:backup:session:${sha256(token)}`;
}
function adminSessionKey(token) {
  return `worditaire:admin:session:${sha256(token)}`;
}
function sessionCookie(request, token, maxAge = SESSION_TTL) {
  let secure = "";
  try { secure = new URL(request.url).protocol === "https:" ? "; Secure" : ""; } catch {}
  return `${COOKIE}=${encodeURIComponent(token || "")}; Path=/api/backup; HttpOnly; SameSite=Strict; Max-Age=${Math.max(0, maxAge)}${secure}`;
}
async function createSession() {
  const token = randomBytes(32).toString("base64url");
  await redis(["SET", sessionKey(token), JSON.stringify({
    version: credentialVersion(),
    createdAt: Date.now(),
  }), "EX", SESSION_TTL]);
  return token;
}
async function readSession(request, cookieName, keyForToken, removeInvalid = false) {
  const token = cookieValue(request, cookieName);
  if (!token) return null;
  const key = keyForToken(token);
  const raw = await redis(["GET", key]);
  if (!raw) return null;
  let stored = null;
  try { stored = JSON.parse(raw); } catch {}
  if (!stored?.version || !constantTimeText(stored.version, credentialVersion())) {
    if (removeInvalid) await redis(["DEL", key]).catch(() => {});
    return null;
  }
  return { token };
}
async function currentSession(request) {
  return readSession(request, COOKIE, sessionKey, true);
}
async function currentAdminSession(request) {
  return readSession(request, ADMIN_COOKIE, adminSessionKey, false);
}
async function deleteSession(request) {
  const token = cookieValue(request, COOKIE);
  if (token) await redis(["DEL", sessionKey(token)]).catch(() => {});
}

async function backupPage(cursor) {
  const result = await redis(["SCAN", cursor, "COUNT", PAGE_SIZE]);
  const nextCursor = String(result?.[0] ?? "0");
  const keys = (Array.isArray(result?.[1]) ? result[1] : [])
    .map((key) => String(key))
    .filter(Boolean);

  if (!keys.length) {
    return { cursor: nextCursor, entries: [], scanned: 0 };
  }

  const commands = [];
  for (const key of keys) {
    commands.push(["DUMP", key], ["PTTL", key]);
  }
  const rows = await redisPipeline(commands, { base64: true });

  const entries = [];
  for (let i = 0; i < keys.length; i++) {
    const dumpRow = rows[i * 2] || {};
    const ttlRow = rows[i * 2 + 1] || {};
    if (dumpRow.error) throw new Error(`DUMP_FAILED:${keys[i]}:${dumpRow.error}`);
    if (ttlRow.error) throw new Error(`PTTL_FAILED:${keys[i]}:${ttlRow.error}`);
    if (typeof dumpRow.result !== "string" || !dumpRow.result) continue;
    entries.push({
      key: keys[i],
      dump: dumpRow.result,
      pttl: Number.isFinite(Number(ttlRow.result)) ? Number(ttlRow.result) : -1,
    });
  }

  return { cursor: nextCursor, entries, scanned: keys.length };
}

export function OPTIONS() {
  return json({ ok: true });
}

export async function GET(request) {
  if (!sameOrigin(request)) return json({ error: "bad_origin" }, 403);
  try {
    if (!configured()) return json({ error: "admin_not_configured" }, 503);

    const adminSession = await currentAdminSession(request);
    const backupSession = adminSession ? null : await currentSession(request);
    if (!adminSession && !backupSession) return json({ authenticated: false, error: "unauthorized" }, 401);

    const url = new URL(request.url);
    if (url.searchParams.get("session") === "1") return json({ ok: true, authenticated: true });

    if (!(await checkRateLimit(request, "redis-backup-export", 2500, 60 * 60))) {
      return json({ error: "rate_limited" }, 429);
    }
    const cursor = /^\d+$/.test(String(url.searchParams.get("cursor") || "0"))
      ? String(url.searchParams.get("cursor") || "0")
      : "0";
    const page = await backupPage(cursor);
    return json({
      ok: true,
      authenticated: true,
      format: "solivoc-redis-dump-v1",
      generatedAt: new Date().toISOString(),
      ...page,
    });
  } catch (error) {
    console.error("backup GET", error);
    return json({ error: "server_error", message: String(error?.message || error) }, 500);
  }
}

export async function POST(request) {
  if (!sameOrigin(request)) return json({ error: "bad_origin" }, 403);
  try {
    const body = await request.json().catch(() => ({}));
    const action = String(body.action || "");
    if (action === "login") {
      if (!configured()) return json({ error: "admin_not_configured" }, 503);
      if (!(await checkRateLimit(request, "backup-login", 10, 15 * 60))) return json({ error: "rate_limited" }, 429);
      const login = String(body.login || "").trim();
      const password = String(body.password || "");
      if (login.length > 120 || password.length > 256 || !(await validCredentials(login, password))) {
        return json({ error: "invalid_credentials" }, 401);
      }
      const token = await createSession();
      return json({ ok: true, authenticated: true }, 200, {
        "Set-Cookie": sessionCookie(request, token),
      });
    }
    if (action === "logout") {
      await deleteSession(request);
      return json({ ok: true, authenticated: false }, 200, {
        "Set-Cookie": sessionCookie(request, "", 0),
      });
    }
    return json({ error: "unknown_action" }, 400);
  } catch (error) {
    console.error("backup POST", error);
    return json({ error: "server_error", message: String(error?.message || error) }, 500);
  }
}
