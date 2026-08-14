import { pushKey, redis } from "./_push-lib.mjs";

const PUSH_TTL = 60 * 24 * 60 * 60;
const CLIENT_SET = "worditaire:push:clients";

function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    },
  });
}
function cleanClientId(value) {
  return String(value || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
}
function cleanText(value, max = 80) {
  return String(value || "").trim().slice(0, max);
}
function cleanSubscription(value) {
  if (!value || typeof value !== "object") return null;
  const endpoint = cleanText(value.endpoint, 2048), keys = value.keys || {};
  const p256dh = cleanText(keys.p256dh, 512), auth = cleanText(keys.auth, 512);
  if (!endpoint || !p256dh || !auth) return null;
  return { endpoint, expirationTime: value.expirationTime || null, keys: { p256dh, auth } };
}
function cleanState(body = {}) {
  return {
    timezoneOffset: Math.max(-840, Math.min(840, Number(body.timezoneOffset) || 0)),
    playerName: cleanText(body.playerName || "Игрок", 20) || "Игрок",
    dailyDoneKey: cleanText(body.dailyDoneKey, 16),
    weeklyKey: cleanText(body.weeklyKey, 24),
    weeklyCompleted: !!body.weeklyCompleted,
    preferences: {
      daily: body.preferences?.daily !== false,
      weekly: body.preferences?.weekly !== false,
    },
  };
}
async function readRecord(clientId) {
  const raw = await redis(["GET", pushKey(clientId)]);
  if (!raw) return null;
  try { return typeof raw === "object" ? raw : JSON.parse(raw); } catch { return null; }
}
async function writeRecord(clientId, record) {
  await redis(["SET", pushKey(clientId), JSON.stringify(record), "EX", PUSH_TTL]);
  await redis(["SADD", CLIENT_SET, clientId]);
}

export function OPTIONS() { return json({ ok: true }); }

export async function GET(request) {
  const url = new URL(request.url);
  if (url.searchParams.get("action") === "key") {
    const publicKey = process.env.VAPID_PUBLIC_KEY || "";
    if (!publicKey) return json({ error: "vapid_not_configured", message: "VAPID public key is not configured" }, 503);
    return json({ ok: true, publicKey });
  }
  return json({ ok: true, configured: !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) });
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({})), action = String(body.action || "");
    const clientId = cleanClientId(body.clientId);
    if (!clientId) return json({ error: "invalid_client" }, 400);

    if (action === "unregister") {
      await redis(["DEL", pushKey(clientId)]);
      await redis(["SREM", CLIENT_SET, clientId]);
      return json({ ok: true });
    }

    if (action === "register") {
      const subscription = cleanSubscription(body.subscription);
      if (!subscription) return json({ error: "invalid_subscription" }, 400);
      const previous = await readRecord(clientId);
      const record = {
        v: 1,
        clientId,
        subscription,
        ...cleanState(body),
        createdAt: previous?.createdAt || Date.now(),
        updatedAt: Date.now(),
        lastDailyNotice: previous?.lastDailyNotice || "",
        lastWeeklyNotice: previous?.lastWeeklyNotice || "",
      };
      await writeRecord(clientId, record);
      return json({ ok: true });
    }

    if (action === "sync") {
      const previous = await readRecord(clientId);
      if (!previous?.subscription) return json({ error: "not_registered" }, 404);
      const record = { ...previous, ...cleanState(body), clientId, updatedAt: Date.now() };
      await writeRecord(clientId, record);
      return json({ ok: true });
    }

    return json({ error: "unknown_action" }, 400);
  } catch (error) {
    if (error?.message === "REDIS_NOT_CONFIGURED") return json({ error: "redis_not_configured" }, 503);
    console.error("push API", error);
    return json({ error: "server_error" }, 500);
  }
}
