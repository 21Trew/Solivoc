import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { checkRateLimit, currentSession, json, sameOrigin, sha256, userKey } from "./_auth-lib.mjs";
import { redis } from "./_push-lib.mjs";

const ADMIN_COOKIE = "solivoc_admin_session";
const GLOBAL_MAIL_KEY = "worditaire:developer-mail:global";
const USER_MAIL_PREFIX = "worditaire:developer-mail:user:";
const MAX_MAIL = 60;

function parse(raw) { try { return raw ? JSON.parse(raw) : null; } catch { return null; } }
function cleanText(value, max) {
  return String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}
function cleanUserId(value) { return String(value || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64); }
function mailKeyForUser(userId) { return `${USER_MAIL_PREFIX}${cleanUserId(userId)}`; }
function cookieValue(request, name) {
  for (const part of String(request.headers.get("cookie") || "").split(";")) {
    const index = part.indexOf("="); if (index < 1) continue;
    if (part.slice(0, index).trim() !== name) continue;
    const raw = part.slice(index + 1).trim();
    try { return decodeURIComponent(raw); } catch { return raw; }
  }
  return "";
}
function constantTimeText(a, b) {
  const left = createHash("sha256").update(String(a || "")).digest();
  const right = createHash("sha256").update(String(b || "")).digest();
  return timingSafeEqual(left, right);
}
function normalizedAdminLogin() { return String(process.env.ADMIN_LOGIN || "").trim().toLowerCase(); }
function configuredPasswordHash() { return String(process.env.ADMIN_PASSWORD_HASH || "").trim(); }
function configuredPassword() { return String(process.env.ADMIN_PASSWORD || ""); }
function adminConfigured() { return !!normalizedAdminLogin() && !!(configuredPasswordHash() || configuredPassword()); }
function adminCredentialVersion() {
  const passwordMarker = configuredPasswordHash() || sha256(configuredPassword());
  return sha256(`${normalizedAdminLogin()}\n${passwordMarker}`);
}
async function currentAdminSession(request) {
  if (!adminConfigured()) return null;
  const token = cookieValue(request, ADMIN_COOKIE); if (!token) return null;
  const raw = await redis(["GET", `worditaire:admin:session:${sha256(token)}`]);
  const stored = parse(raw);
  if (!stored?.version || !constantTimeText(stored.version, adminCredentialVersion())) return null;
  return { token, stored };
}
function russianDate(date = new Date()) {
  try { return new Intl.DateTimeFormat("ru-RU", { day:"numeric", month:"long", year:"numeric", timeZone:"Europe/Moscow" }).format(date); }
  catch { return date.toISOString().slice(0, 10); }
}
export function sanitizeDeveloperMessage(input = {}) {
  const title = cleanText(input.title, 80), intro = cleanText(input.intro, 320);
  const items = (Array.isArray(input.items) ? input.items : []).map((item) => cleanText(item, 180)).filter(Boolean).slice(0, 8);
  if (!title || !intro) return null;
  const createdAt = Date.now();
  const id = `admin-${createdAt.toString(36)}-${randomBytes(5).toString("hex")}`;
  return { id, version:id, major:false, date:russianDate(new Date(createdAt)), title, intro, items, createdAt, source:"admin" };
}
async function readMailList(key) {
  const rows = await redis(["LRANGE", key, "0", String(MAX_MAIL - 1)]);
  return (Array.isArray(rows) ? rows : []).map(parse).filter((x) => x?.id && x?.title).slice(0, MAX_MAIL);
}
async function pushMail(key, message) {
  await redis(["LPUSH", key, JSON.stringify(message)]);
  await redis(["LTRIM", key, "0", String(MAX_MAIL - 1)]);
}

export async function GET(request) {
  if (!sameOrigin(request)) return json({ error:"bad_origin" }, 403);
  try {
    if (!(await checkRateLimit(request, "developer-mail-read", 180, 900))) return json({ error:"rate_limited" }, 429);
    const session = await currentSession(request);
    if (!session) return json({ ok:true, messages:[] });
    const [globalMessages, personalMessages] = await Promise.all([readMailList(GLOBAL_MAIL_KEY), readMailList(mailKeyForUser(session.userId))]);
    const byId = new Map();
    [...personalMessages, ...globalMessages].sort((a,b)=>(+b.createdAt||0)-(+a.createdAt||0)).forEach((message) => { if (!byId.has(String(message.id))) byId.set(String(message.id), message); });
    return json({ ok:true, messages:[...byId.values()].slice(0, MAX_MAIL) });
  } catch (error) {
    if (error?.message === "REDIS_NOT_CONFIGURED") return json({ error:"redis_not_configured" }, 503);
    console.error("developer mail GET", error);
    return json({ error:"server_error" }, 500);
  }
}

export async function POST(request) {
  if (!sameOrigin(request)) return json({ error:"bad_origin" }, 403);
  try {
    if (!(await currentAdminSession(request))) return json({ error:"unauthorized" }, 401);
    if (!(await checkRateLimit(request, "admin-developer-mail", 30, 900))) return json({ error:"rate_limited" }, 429);
    const body = await request.json().catch(() => ({}));
    const message = sanitizeDeveloperMessage(body);
    if (!message) return json({ error:"invalid_message", message:"Нужны заголовок и вступление." }, 400);
    const target = String(body.target || "all");
    if (target === "all") {
      await pushMail(GLOBAL_MAIL_KEY, message);
      return json({ ok:true, target:"all", message });
    }
    const userId = cleanUserId(target);
    if (!/^u_[a-zA-Z0-9_-]{8,62}$/.test(userId)) return json({ error:"invalid_user_id" }, 400);
    const userExists = await redis(["GET", userKey(userId)]);
    if (!userExists) return json({ error:"account_not_found" }, 404);
    await pushMail(mailKeyForUser(userId), message);
    return json({ ok:true, target:userId, message });
  } catch (error) {
    if (error?.message === "REDIS_NOT_CONFIGURED") return json({ error:"redis_not_configured" }, 503);
    console.error("developer mail POST", error);
    return json({ error:"server_error" }, 500);
  }
}
