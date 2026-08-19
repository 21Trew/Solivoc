import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { redis } from "./_push-lib.mjs";

const scrypt = promisify(scryptCb);
const SESSION_TTL = 60 * 60 * 24 * 30;
const MAX_PROFILE_BYTES = 420000;
const CAMPAIGN_CHAPTER_SIZE = 10;

export function json(data, status = 200, extraHeaders = {}) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "Content-Type": "application/json; charset=utf-8",
      ...extraHeaders,
    },
  });
}

export function cleanEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  if (email.length < 5 || email.length > 160) return "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u.test(email)) return "";
  return email;
}

export function validPassword(value) {
  const password = String(value || "");
  if (password.length < 8 || password.length > 128) return false;
  if (/\p{Cc}/u.test(password)) return false;
  return password.trim().length >= 8;
}

export function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function base64url(buffer) {
  return Buffer.from(buffer).toString("base64url");
}

export async function hashSecret(secret) {
  const salt = randomBytes(16);
  const derived = await scrypt(String(secret), salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return `s2:${base64url(salt)}:${base64url(derived)}`;
}

export async function verifySecret(secret, encoded) {
  try {
    const [version, saltText, hashText] = String(encoded || "").split(":");
    if (version !== "s2" || !saltText || !hashText) return false;
    const salt = Buffer.from(saltText, "base64url");
    const expected = Buffer.from(hashText, "base64url");
    const actual = await scrypt(String(secret), salt, expected.length, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

export function newUserId() {
  return `u_${randomBytes(12).toString("hex")}`;
}


export function emailKey(email) { return `worditaire:auth:email:${sha256(cleanEmail(email))}`; }
export function userKey(userId) { return `worditaire:auth:user:${String(userId || "").slice(0, 64)}`; }
export function profileKey(userId) { return `worditaire:auth:profile:${String(userId || "").slice(0, 64)}`; }
export function profileVersionKey(userId) { return `worditaire:auth:profile-version:${String(userId || "").slice(0, 64)}`; }
export function sessionKey(token) { return `worditaire:auth:session:${sha256(token)}`; }

export async function readJsonKey(key) {
  const raw = await redis(["GET", key]);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export async function writeJsonKey(key, value, ...tail) {
  return redis(["SET", key, JSON.stringify(value), ...tail]);
}

export function requestIp(request) {
  return String(request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown").split(",")[0].trim().slice(0, 80);
}

export async function checkRateLimit(request, bucket, limit = 12, windowSec = 900) {
  const key = `worditaire:auth:rate:${bucket}:${sha256(requestIp(request))}`;
  const count = Number(await redis(["INCR", key])) || 0;
  if (count === 1) await redis(["EXPIRE", key, windowSec]);
  return count <= limit;
}

function allowedAppOrigins() {
  const defaults = ["https://solivoc.ru", "https://www.solivoc.ru", "https://admin.solivoc.ru"];
  const configured = String(process.env.APP_ORIGINS || "")
    .split(",")
    .map((value) => value.trim().replace(/\/$/, ""))
    .filter(Boolean);
  return new Set([...defaults, ...configured]);
}

export function sameOrigin(request) {
  const fetchSite = String(request.headers.get("sec-fetch-site") || "").toLowerCase();
  if (fetchSite === "cross-site") return false;
  const origin = String(request.headers.get("origin") || "").replace(/\/$/, "");
  if (!origin) return true;
  try {
    if (origin === new URL(request.url).origin) return true;
    if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) return true;
    return allowedAppOrigins().has(origin);
  } catch { return false; }
}

function parseCookies(request) {
  const out = {};
  for (const part of String(request.headers.get("cookie") || "").split(";")) {
    const index = part.indexOf("=");
    if (index < 1) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    try { out[key] = decodeURIComponent(value); } catch { out[key] = value; }
  }
  return out;
}

export function sessionCookie(token, maxAge = SESSION_TTL) {
  const secure = (process.env.VERCEL || process.env.NODE_ENV === "production") ? "; Secure" : "";
  return `solivoc_session=${encodeURIComponent(token || "")}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.max(0, maxAge)}${secure}`;
}

export async function createSession(userId, sessionVersion = 1) {
  const token = base64url(randomBytes(32));
  await redis(["SET", sessionKey(token), JSON.stringify({ userId, sessionVersion: Math.max(1, Number(sessionVersion) || 1) }), "EX", SESSION_TTL]);
  return token;
}

export async function deleteSession(request) {
  const token = parseCookies(request).solivoc_session || "";
  if (token) await redis(["DEL", sessionKey(token)]).catch(() => {});
}

export async function currentSession(request) {
  const token = parseCookies(request).solivoc_session || "";
  if (!token) return null;
  const raw = await redis(["GET", sessionKey(token)]);
  if (!raw) return null;
  let userId = "", sessionVersion = 1;
  try { const parsed = JSON.parse(raw); userId = String(parsed?.userId || ""); sessionVersion = Math.max(1, Number(parsed?.sessionVersion) || 1); }
  catch { userId = String(raw || ""); }
  if (!userId) return null;
  const user = await readJsonKey(userKey(userId));
  if (!user || Math.max(1, Number(user.sessionVersion) || 1) !== sessionVersion) {
    await redis(["DEL", sessionKey(token)]).catch(() => {});
    return null;
  }
  return { token, userId, user };
}

function jsonClone(value) {
  try { return JSON.parse(JSON.stringify(value)); } catch { return null; }
}

export function sanitizeProfile(input, userId) {
  const profile = input && typeof input === "object" ? jsonClone(input) : {};
  if (!profile || typeof profile !== "object" || Array.isArray(profile)) return {};
  const text = JSON.stringify(profile);
  if (Buffer.byteLength(text, "utf8") > MAX_PROFILE_BYTES) throw new Error("profile_too_large");

  // Device-scoped state must never jump to another phone/browser.
  delete profile.analyticsClientId;
  delete profile.pushClientId;
  delete profile.retention;
  delete profile.activeMarathon;
  delete profile.sentChallenges;
  delete profile.receivedChallenges;
  delete profile.pendingChallengeSubmissions;
  delete profile.pendingRankUp;
  if (profile.settings && typeof profile.settings === "object") {
    profile.settings = { ...profile.settings };
    delete profile.settings.notifications;
    delete profile.settings.notificationPrompted;
  }
  const pruneRecordMap = (map, limit) => {
    if (!map || typeof map !== "object" || Array.isArray(map)) return {};
    const entries = Object.entries(map);
    if (entries.length <= limit) return map;
    return Object.fromEntries(entries
      .sort((a, b) => (+b[1]?.at || 0) - (+a[1]?.at || 0))
      .slice(0, limit));
  };
  profile.dailyRecords = pruneRecordMap(profile.dailyRecords, 800);
  profile.challengeRecords = pruneRecordMap(profile.challengeRecords, 200);
  profile.playerId = String(userId || profile.playerId || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
  return profile;
}

const PREFERENCE_ROOTS = new Set([
  "playerName", "avatarEmoji", "titleId", "theme", "cardBack", "effect", "frame", "soundPack",
  "favoriteCategory", "featuredAchievements", "settings", "customRules", "patchSeenVersion", "onboardingComplete",
  "onboardingVersion", "tutorialComplete"
]);

function scalarKey(value) {
  if (value === null || ["string", "number", "boolean"].includes(typeof value)) return `${typeof value}:${String(value)}`;
  try { return `json:${JSON.stringify(value)}`; } catch { return `obj:${Math.random()}`; }
}

function mergeProgress(base, incoming, path = "") {
  if (incoming == null) return base;
  if (base == null) return jsonClone(incoming);
  if (Array.isArray(base) && Array.isArray(incoming)) {
    const seen = new Set();
    const out = [];
    for (const item of [...base, ...incoming]) {
      const key = scalarKey(item);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(jsonClone(item));
    }
    return out.slice(-1000);
  }
  if (typeof base === "number" && typeof incoming === "number") return Math.max(base, incoming);
  if (typeof base === "boolean" && typeof incoming === "boolean") return base || incoming;
  if (typeof base === "object" && typeof incoming === "object" && !Array.isArray(base) && !Array.isArray(incoming)) {
    const out = { ...base };
    for (const [key, value] of Object.entries(incoming)) out[key] = mergeProgress(out[key], value, path ? `${path}.${key}` : key);
    return out;
  }
  return jsonClone(incoming);
}

function mergeDailyQuestSnapshots(baseValue, incomingValue) {
  const base = baseValue && typeof baseValue === "object" ? baseValue : {}, incoming = incomingValue && typeof incomingValue === "object" ? incomingValue : {};
  const bd=String(base.date||""), id=String(incoming.date||"");
  if (bd && id && bd !== id) return jsonClone(bd > id ? base : incoming);
  if (!bd) return jsonClone(incoming);
  if (!id) return jsonClone(base);
  const modes = Array.isArray(incoming.modes) && incoming.modes.length ? incoming.modes.slice(0,3) : (Array.isArray(base.modes)?base.modes.slice(0,3):[]), progress={}, rewarded={};
  for (const mode of modes) {
    progress[mode]=Math.max(0,Math.min(5,Math.max(Number(base.progress?.[mode])||0,Number(incoming.progress?.[mode])||0)));
    rewarded[mode]=!!base.rewarded?.[mode]||!!incoming.rewarded?.[mode];
  }
  return { date: bd || id, modes, progress, rewarded };
}

function normalizeCampaignProfile(profile) {
  const stars = {};
  for (const [rawLevel, rawStars] of Object.entries(profile?.starsByLevel || {})) {
    const level = Math.trunc(Number(rawLevel)), value = Math.trunc(Number(rawStars));
    if (!Number.isFinite(level) || level < 1 || level > 10000 || value < 1) continue;
    stars[level] = Math.max(1, Math.min(3, value));
  }

  // Old clients could migrate a corrupted currentLevel by manufacturing one-star
  // clears for every preceding level. Apply the same conservative repair as the
  // client before deriving canonical campaign counters, so stale cloud data cannot
  // reintroduce a synthetic tail during account sync.
  const rawCurrent = Math.max(1, Math.trunc(Number(profile?.currentLevel) || 1));
  const storedCompleted = Math.max(0, Math.trunc(Number(profile?.stats?.levelsCompleted) || 0));
  const storedFinals = Math.max(0, Math.trunc(Number(profile?.stats?.chapterFinalsCompleted) || 0));
  const previousTotal = Math.max(0, Number(profile.totalStars) || 0);
  let syntheticTailRemoved = false;
  const recordedLevels = new Set(Object.entries(profile?.levelRecords || {})
    .filter(([key, record]) => Number(key) >= 1 && (Number(record?.stars) > 0 || Number(record?.moves) > 0))
    .map(([key]) => Math.trunc(Number(key)))
    .filter(Number.isFinite));
  let credibleThrough = storedFinals * CAMPAIGN_CHAPTER_SIZE;
  while (recordedLevels.has(credibleThrough + 1)) credibleThrough++;
  if (profile?.legacyStarsMigrated && credibleThrough >= CAMPAIGN_CHAPTER_SIZE && rawCurrent - 1 > credibleThrough + CAMPAIGN_CHAPTER_SIZE * 3) {
    const tailLevels = Object.keys(stars).map(Number).filter((level) => level > credibleThrough);
    if (tailLevels.length >= CAMPAIGN_CHAPTER_SIZE * 2 && tailLevels.every((level) => stars[level] === 1)) {
      for (const level of tailLevels) delete stars[level];
      syntheticTailRemoved = true;
      if (profile.xpMigrated && !profile.campaignRepairXpAdjusted) {
        profile.xp = Math.max(0, (Number(profile.xp) || 0) - tailLevels.length * 45);
        profile.campaignRepairXpAdjusted = true;
      }
    }
  }

  let completedThrough = 0;
  while (Number(stars[completedThrough + 1]) > 0) completedThrough++;
  const highestStarLevel = Math.max(0, ...Object.keys(stars).map(Number).filter(Number.isFinite));
  const highestRecordLevel = Math.max(0, ...[...recordedLevels]);
  const progressFloor = Math.max(0, Math.trunc(Number(profile.campaignProgressFloor) || 0));
  const versionedFloor = !syntheticTailRemoved && Number(profile.campaignProgressVersion || 0) >= 2 ? Math.max(storedCompleted, rawCurrent - 1) : 0;
  const evidenceThrough = Math.max(completedThrough, highestStarLevel, highestRecordLevel, progressFloor, versionedFloor);
  const hadMissingStarHistory = evidenceThrough > Object.keys(stars).length;
  if (evidenceThrough > completedThrough && evidenceThrough <= 10000) {
    for (let level = 1; level <= evidenceThrough; level++) if (!stars[level]) stars[level] = 1;
    completedThrough = evidenceThrough;
  }
  if (hadMissingStarHistory && completedThrough > 0) {
    let runningTotal = Object.values(stars).reduce((sum, value) => sum + Math.max(1, Math.min(3, Number(value) || 1)), 0);
    const target = Math.min(completedThrough * 3, Math.max(runningTotal, previousTotal));
    for (let level = 1; level <= completedThrough && runningTotal < target; level++) {
      const room = 3 - (Number(stars[level]) || 1); if (room <= 0) continue;
      const add = Math.min(room, target - runningTotal); stars[level] += add; runningTotal += add;
    }
  }
  const campaignStars = Math.min(completedThrough * 3, Object.values(stars).reduce((sum, value) => sum + Math.max(0, Math.min(3, Number(value) || 0)), 0));
  const dailyStars = Object.values(profile?.dailyStars || {}).reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0);
  profile.starsByLevel = stars;
  profile.currentLevel = completedThrough + 1;
  // totalStars is the campaign counter shown in profile/leaderboards. Daily stars
  // stay separate so a three-star-level count can never disagree with the total.
  profile.totalStars = campaignStars;
  profile.dailyStarTotal = dailyStars;
  profile.cosmeticStarsPeak = Math.max(0, Number(profile.cosmeticStarsPeak) || 0, previousTotal, campaignStars + dailyStars);
  profile.stats = { ...(profile.stats || {}), levelsCompleted: completedThrough, chapterFinalsCompleted: Math.floor(completedThrough / CAMPAIGN_CHAPTER_SIZE), tripleStarWins: Object.values(stars).filter((value) => Number(value) === 3).length };
  profile.campaignProgressVersion = Math.max(2, Number(profile.campaignProgressVersion) || 0);
  return profile;
}

export function mergeProfiles(current, incoming, userId, { preferIncomingPreferences = true } = {}) {
  const a = sanitizeProfile(current || {}, userId);
  const b = sanitizeProfile(incoming || {}, userId);
  const aCampaignVersion = Number(a.campaignProgressVersion) || 0, bCampaignVersion = Number(b.campaignProgressVersion) || 0;
  const merged = mergeProgress(a, b);
  merged.dailyQuests = mergeDailyQuestSnapshots(a.dailyQuests, b.dailyQuests);
  if (bCampaignVersion >= 2 && aCampaignVersion < 2) {
    merged.starsByLevel = jsonClone(b.starsByLevel || {});
    if (b.campaignRepairXpAdjusted) { merged.xp = Math.max(0, Number(b.xp) || 0); merged.campaignRepairXpAdjusted = true; }
  } else if (aCampaignVersion >= 2 && bCampaignVersion < 2) {
    merged.starsByLevel = jsonClone(a.starsByLevel || {});
    if (a.campaignRepairXpAdjusted) { merged.xp = Math.max(0, Number(a.xp) || 0); merged.campaignRepairXpAdjusted = true; }
  }
  const validBirth = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
  if (validBirth(a.birthDate)) merged.birthDate = a.birthDate;
  else if (validBirth(b.birthDate)) merged.birthDate = b.birthDate;
  if (preferIncomingPreferences) {
    for (const key of PREFERENCE_ROOTS) {
      if (Object.prototype.hasOwnProperty.call(b, key)) merged[key] = jsonClone(b[key]);
    }
  } else {
    for (const key of PREFERENCE_ROOTS) {
      if (Object.prototype.hasOwnProperty.call(a, key)) merged[key] = jsonClone(a[key]);
    }
  }
  merged.playerId = userId;
  return normalizeCampaignProfile(merged);
}

export async function readCloudProfile(userId) {
  return (await readJsonKey(profileKey(userId))) || {};
}

export async function mergeCloudProfile(userId, incoming, { clientVersion = null, preferIncomingPreferences = null } = {}) {
  const [current, currentVersion] = await Promise.all([readCloudProfile(userId), cloudProfileVersion(userId)]);
  const prefer = preferIncomingPreferences == null ? (clientVersion == null || Number(clientVersion) >= currentVersion) : !!preferIncomingPreferences;
  const merged = mergeProfiles(current, incoming, userId, { preferIncomingPreferences: prefer });
  await writeJsonKey(profileKey(userId), merged);
  const version = Number(await redis(["INCR", profileVersionKey(userId)])) || Math.max(1, currentVersion + 1);
  return { profile: merged, version };
}

export async function cloudProfileVersion(userId) {
  return Number(await redis(["GET", profileVersionKey(userId)])) || 0;
}
