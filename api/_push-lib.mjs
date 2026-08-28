import webpush from "web-push";

const REDIS_TIMEOUT_MS = 4000;
const SINGLE_KEY_COMMANDS = new Set([
  "GET", "SET", "SETNX", "GETSET", "GETDEL", "INCR", "INCRBY", "DECR", "DECRBY",
  "EXPIRE", "PEXPIRE", "TTL", "PTTL", "PERSIST", "TYPE", "DUMP", "RESTORE",
  "SADD", "SREM", "SMEMBERS", "SCARD", "SISMEMBER",
  "HSET", "HGET", "HGETALL", "HDEL", "HEXISTS", "HINCRBY",
  "LPUSH", "RPUSH", "LPOP", "RPOP", "LRANGE", "LLEN", "LREM", "LTRIM",
  "ZADD", "ZREM", "ZRANGE", "ZREVRANGE", "ZCARD", "ZSCORE", "ZINCRBY", "ZRANK", "ZREVRANK",
  "XADD", "XRANGE", "XREVRANGE", "XLEN",
]);
const MULTI_KEY_COMMANDS = new Set(["DEL", "UNLINK", "EXISTS", "MGET"]);

function legacyVercelRuntime() {
  return !!process.env.VERCEL;
}
function firstEnv(...names) {
  for (const name of names) if (process.env[name]) return process.env[name];
  return "";
}
function redisConfig() {
  if (legacyVercelRuntime()) return { url: "", token: "" };
  return {
    url: firstEnv("UPSTASH_REDIS_REST_URL", "KV_REST_API_URL", "UPSTASH_REDIS_REST_KV_REST_API_URL").replace(/\/$/, ""),
    token: firstEnv("UPSTASH_REDIS_REST_TOKEN", "KV_REST_API_TOKEN", "UPSTASH_REDIS_REST_KV_REST_API_TOKEN"),
  };
}
function redisNotConfigured() {
  const error = new Error("REDIS_NOT_CONFIGURED");
  error.code = "REDIS_NOT_CONFIGURED";
  return error;
}
function namespacePrefix() {
  const raw = String(process.env.REDIS_KEY_PREFIX || "").trim();
  if (!raw) return "";
  if (!/^[a-zA-Z0-9:_-]{1,48}$/.test(raw)) throw new Error("REDIS_KEY_PREFIX_INVALID");
  return raw.endsWith(":") ? raw : `${raw}:`;
}
export function redisKey(value) {
  const key = String(value ?? "");
  const prefix = namespacePrefix();
  if (!prefix || key.startsWith(prefix)) return key;
  return `${prefix}${key}`;
}
function namespacePattern(value) {
  const pattern = String(value ?? "*");
  const prefix = namespacePrefix();
  if (!prefix || pattern.startsWith(prefix)) return pattern;
  return `${prefix}${pattern}`;
}
function namespaceEval(out) {
  const keyCount = Math.max(0, Math.trunc(Number(out[2]) || 0));
  for (let index = 0; index < keyCount; index++) out[3 + index] = redisKey(out[3 + index]);
  return out;
}
function namespaceScan(out) {
  const matchIndex = out.findIndex((value, index) => index >= 2 && String(value).toUpperCase() === "MATCH");
  if (matchIndex >= 0) out[matchIndex + 1] = namespacePattern(out[matchIndex + 1]);
  else out.push("MATCH", namespacePattern("*"));
  return out;
}
export function namespaceRedisCommand(command) {
  if (!Array.isArray(command) || !command.length) throw new Error("REDIS_COMMAND_INVALID");
  const prefix = namespacePrefix();
  const out = [...command];
  if (!prefix) return out;
  const name = String(out[0] || "").toUpperCase();

  if (SINGLE_KEY_COMMANDS.has(name)) {
    out[1] = redisKey(out[1]);
    return out;
  }
  if (MULTI_KEY_COMMANDS.has(name)) {
    for (let index = 1; index < out.length; index++) out[index] = redisKey(out[index]);
    return out;
  }
  if (name === "MSET") {
    for (let index = 1; index < out.length; index += 2) out[index] = redisKey(out[index]);
    return out;
  }
  if (name === "RENAME" || name === "RENAMENX" || name === "COPY") {
    out[1] = redisKey(out[1]);
    out[2] = redisKey(out[2]);
    return out;
  }
  if (name === "EVAL" || name === "EVALSHA") return namespaceEval(out);
  if (name === "SCAN") return namespaceScan(out);
  if (name === "KEYS") {
    out[1] = namespacePattern(out[1]);
    return out;
  }
  if (name === "PING" || name === "TIME") return out;

  throw new Error(`REDIS_NAMESPACE_UNSUPPORTED_COMMAND:${name || "UNKNOWN"}`);
}
async function redisRequest(path, body) {
  const { url, token } = redisConfig();
  if (!url || !token) throw redisNotConfigured();
  const response = await fetch(`${url}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(REDIS_TIMEOUT_MS),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.error) throw new Error(data?.error || `Redis ${response.status}`);
  return data;
}
export async function redis(command) {
  const data = await redisRequest("", namespaceRedisCommand(command));
  return data.result;
}
export async function redisPipeline(commands) {
  if (!Array.isArray(commands) || !commands.length) return [];
  const rows = await redisRequest("/pipeline", commands.map(namespaceRedisCommand));
  if (!Array.isArray(rows)) throw new Error("REDIS_PIPELINE_INVALID_RESPONSE");
  for (const row of rows) if (row?.error) throw new Error(row.error);
  return rows.map((row) => row?.result);
}
export function pushKey(clientId) {
  return `worditaire:push:${String(clientId || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64)}`;
}
export function configureWebPush() {
  if (legacyVercelRuntime()) return false;
  const publicKey = process.env.VAPID_PUBLIC_KEY || "";
  const privateKey = process.env.VAPID_PRIVATE_KEY || "";
  const subject = process.env.VAPID_SUBJECT || "https://solivoc.ru/";
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  return true;
}
export async function sendPushToClient(clientId, payload) {
  if (!clientId || !configureWebPush()) return false;
  const recordRaw = await redis(["GET", pushKey(clientId)]);
  const record = recordRaw ? JSON.parse(recordRaw) : null;
  if (!record?.subscription) return false;
  try {
    await webpush.sendNotification(record.subscription, JSON.stringify(payload), { TTL: 3600, urgency: "normal" });
    return true;
  } catch (err) {
    if (err?.statusCode === 404 || err?.statusCode === 410) {
      await redis(["DEL", pushKey(clientId)]).catch(() => {});
      await redis(["SREM", "worditaire:push:clients", clientId]).catch(() => {});
    }
    console.warn("push send", err?.statusCode || err?.message || err);
    return false;
  }
}
