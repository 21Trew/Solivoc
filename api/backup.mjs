import { createHash, timingSafeEqual } from "node:crypto";
import { checkRateLimit, sameOrigin, sha256 } from "./_auth-lib.mjs";

const ADMIN_COOKIE = "solivoc_admin_session";
const PAGE_SIZE = 20;

function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "Content-Type": "application/json; charset=utf-8",
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

function configuredPasswordMarker() {
  const passwordHash = String(process.env.ADMIN_PASSWORD_HASH || "").trim();
  if (passwordHash) return passwordHash;
  const password = String(process.env.ADMIN_PASSWORD || "");
  return password ? sha256(password) : "";
}

function adminConfigured() {
  return !!configuredLogin() && !!configuredPasswordMarker();
}

function credentialVersion() {
  return sha256(`${configuredLogin()}\n${configuredPasswordMarker()}`);
}

function constantTimeText(a, b) {
  const left = createHash("sha256").update(String(a || "")).digest();
  const right = createHash("sha256").update(String(b || "")).digest();
  return timingSafeEqual(left, right);
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

function adminSessionKey(token) {
  return `worditaire:admin:session:${sha256(token)}`;
}

async function currentAdminSession(request) {
  const token = cookieValue(request, ADMIN_COOKIE);
  if (!token) return null;

  const raw = await redis(["GET", adminSessionKey(token)]);
  if (!raw) return null;

  let stored = null;
  try { stored = JSON.parse(raw); } catch {}
  if (!stored?.version || !constantTimeText(stored.version, credentialVersion())) return null;
  return { token };
}

async function backupPage(cursor) {
  const result = await redis(["SCAN", cursor, "COUNT", PAGE_SIZE]);
  const nextCursor = String(result?.[0] ?? "0");
  const keys = [...new Set((Array.isArray(result?.[1]) ? result[1] : [])
    .map((key) => String(key))
    .filter(Boolean))];

  if (!keys.length) {
    return { cursor: nextCursor, entries: [], scanned: 0 };
  }

  const commands = [];
  for (const key of keys) commands.push(["DUMP", key], ["PTTL", key]);

  // DUMP is binary. Upstash-Encoding=base64 makes it safe to transport in JSON.
  const rows = await redisPipeline(commands, { base64: true });
  const entries = [];

  for (let index = 0; index < keys.length; index++) {
    const dumpRow = rows[index * 2] || {};
    const ttlRow = rows[index * 2 + 1] || {};

    if (dumpRow.error) throw new Error(`DUMP_FAILED:${keys[index]}:${dumpRow.error}`);
    if (ttlRow.error) throw new Error(`PTTL_FAILED:${keys[index]}:${ttlRow.error}`);

    // A key can expire between SCAN and DUMP.
    if (typeof dumpRow.result !== "string" || !dumpRow.result) continue;

    entries.push({
      key: keys[index],
      dump: dumpRow.result,
      pttl: Number.isFinite(Number(ttlRow.result)) ? Number(ttlRow.result) : -1,
    });
  }

  return { cursor: nextCursor, entries, scanned: keys.length };
}

export async function GET(request) {
  if (!sameOrigin(request)) return json({ error: "bad_origin" }, 403);

  try {
    if (!adminConfigured()) return json({ error: "admin_not_configured" }, 503);
    if (!(await currentAdminSession(request))) {
      return json({ authenticated: false, error: "unauthorized" }, 401);
    }

    if (!(await checkRateLimit(request, "redis-backup-export", 2500, 60 * 60))) {
      return json({ error: "rate_limited" }, 429);
    }

    const url = new URL(request.url);
    const rawCursor = String(url.searchParams.get("cursor") || "0");
    const cursor = /^\d+$/.test(rawCursor) ? rawCursor : "0";
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
    return json({
      error: "server_error",
      message: String(error?.message || error),
    }, 500);
  }
}
