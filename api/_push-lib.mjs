import webpush from "web-push";
import { namespaceRedisCommand } from "./_redis-namespace.mjs";

const REDIS_TIMEOUT_MS = 4000;

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
