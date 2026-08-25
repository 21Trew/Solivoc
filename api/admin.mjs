import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { checkRateLimit, sameOrigin, sha256, verifySecret, userKey } from "./_auth-lib.mjs";
import { redis } from "./_push-lib.mjs";
import { deleteAccountData } from "./_account-delete-lib.mjs";

const BOARDS = ["stars", "levels", "daily", "marathon", "combo", "duel", "time", "moves", "onePass"];
const CHAPTER_SIZE = 10;
const ADMIN_SESSION_TTL = 8 * 60 * 60;
const ADMIN_COOKIE = "solivoc_admin_session";
const ADMIN_LOGIN_FAILURES = 6;
const ADMIN_LOGIN_WINDOW = 15 * 60;
const AUDIT_KEY = "worditaire:admin:audit:v1";
const AUDIT_USER_PREFIX = "worditaire:admin:audit:v1:user:";
const ADMIN_COMMAND_PREFIX = "worditaire:admin:command:v1:";
const GLOBAL_MAIL_KEY = "worditaire:developer-mail:global";
const USER_MAIL_PREFIX = "worditaire:developer-mail:user:";
const MAX_MAIL = 60;

const clamp = (value, min = 0, max = 1e9) => Math.max(min, Math.min(max, Number(value) || 0));
const json = (data, status = 200, extraHeaders = {}) => Response.json(data, {
  status,
  headers: {
    "Cache-Control": "no-store, max-age=0",
    "Content-Type": "application/json; charset=utf-8",
    ...extraHeaders,
  },
});
const parse = (raw) => { try { return raw ? JSON.parse(raw) : null; } catch { return null; } };
const cleanText = (value, max = 240) => String(value ?? "")
  .replace(/[\u0000-\u001f\u007f]/g, " ")
  .replace(/\s+/g, " ")
  .trim()
  .slice(0, max);
const cleanUserId = (value) => String(value || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
const cleanId = (value, max = 100) => String(value || "").replace(/[^a-zA-Z0-9_:.\-]/g, "").slice(0, max);
const uniqueStrings = (value, max = 500) => [...new Set((Array.isArray(value) ? value : []).map(String).filter(Boolean))].slice(0, max);

const playerKey = (id) => `worditaire:leaderboard:player:${id}`;
const profileKey = (id) => `worditaire:auth:profile:${id}`;
const profileVersionKey = (id) => `worditaire:auth:profile-version:${id}`;
const boardKey = (id) => `worditaire:leaderboard:v1:${id}`;
const auditUserKey = (id) => `${AUDIT_USER_PREFIX}${cleanUserId(id)}`;
const commandKey = (id) => `${ADMIN_COMMAND_PREFIX}${cleanId(id, 96)}`;
const mailKeyForUser = (id) => `${USER_MAIL_PREFIX}${cleanUserId(id)}`;

function normalizedAdminLogin() { return String(process.env.ADMIN_LOGIN || "").trim().toLowerCase(); }
function configuredPasswordHash() { return String(process.env.ADMIN_PASSWORD_HASH || "").trim(); }
function configuredPassword() { return String(process.env.ADMIN_PASSWORD || ""); }
function adminConfigured() { return !!normalizedAdminLogin() && !!(configuredPasswordHash() || configuredPassword()); }
function constantTimeText(a, b) {
  const left = createHash("sha256").update(String(a || "")).digest();
  const right = createHash("sha256").update(String(b || "")).digest();
  return timingSafeEqual(left, right);
}
function adminCredentialVersion() {
  const passwordMarker = configuredPasswordHash() || sha256(configuredPassword());
  return sha256(`${normalizedAdminLogin()}\n${passwordMarker}`);
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
function adminCookie(request, token, maxAge = ADMIN_SESSION_TTL) {
  let secure = "";
  try { secure = new URL(request.url).protocol === "https:" ? "; Secure" : ""; } catch {}
  return `${ADMIN_COOKIE}=${encodeURIComponent(token || "")}; Path=/api/admin; HttpOnly; SameSite=Strict; Max-Age=${Math.max(0, maxAge)}${secure}`;
}
async function createAdminSession() {
  const token = randomBytes(32).toString("base64url");
  await redis(["SET", adminSessionKey(token), JSON.stringify({ version: adminCredentialVersion(), createdAt: Date.now() }), "EX", ADMIN_SESSION_TTL]);
  return token;
}
async function currentAdminSession(request) {
  const token = cookieValue(request, ADMIN_COOKIE);
  if (!token) return null;
  const raw = await redis(["GET", adminSessionKey(token)]);
  if (!raw) return null;
  const stored = parse(raw);
  if (!stored?.version || !constantTimeText(stored.version, adminCredentialVersion())) {
    await redis(["DEL", adminSessionKey(token)]).catch(() => {});
    return null;
  }
  return { token, stored, login: normalizedAdminLogin() };
}
async function deleteAdminSession(request) {
  const token = cookieValue(request, ADMIN_COOKIE);
  if (token) await redis(["DEL", adminSessionKey(token)]).catch(() => {});
}
function loginFailureKey(login) { return `worditaire:admin:login-fail:${sha256(String(login || "").trim().toLowerCase())}`; }
async function loginBlocked(login) { return (Number(await redis(["GET", loginFailureKey(login)])) || 0) >= ADMIN_LOGIN_FAILURES; }
async function recordLoginFailure(login) {
  const key = loginFailureKey(login);
  const count = Number(await redis(["INCR", key])) || 0;
  if (count === 1) await redis(["EXPIRE", key, ADMIN_LOGIN_WINDOW]);
  return count;
}
async function clearLoginFailures(login) { await redis(["DEL", loginFailureKey(login)]).catch(() => {}); }
async function validAdminCredentials(login, password) {
  const actualLogin = String(login || "").trim().toLowerCase();
  const loginOk = constantTimeText(actualLogin, normalizedAdminLogin());
  const passwordOk = configuredPasswordHash()
    ? await verifySecret(String(password || ""), configuredPasswordHash())
    : constantTimeText(String(password || ""), configuredPassword());
  return loginOk && passwordOk;
}

async function scanKeys(pattern, limit = 5000) {
  let cursor = "0";
  const out = [];
  do {
    const result = await redis(["SCAN", cursor, "MATCH", pattern, "COUNT", 200]);
    cursor = String(result?.[0] ?? "0");
    const keys = Array.isArray(result?.[1]) ? result[1] : [];
    out.push(...keys);
    if (out.length >= limit) break;
  } while (cursor !== "0");
  return out.slice(0, limit);
}
async function getMany(keys, batch = 80) {
  const out = [];
  for (let i = 0; i < keys.length; i += batch) {
    const part = keys.slice(i, i + batch);
    const values = part.length ? await redis(["MGET", ...part]) : [];
    for (let j = 0; j < part.length; j++) out.push({ key: part[j], raw: values?.[j] || null });
  }
  return out;
}
function scoreFor(board, value) {
  if (board === "time") return value > 0 ? 1_000_000_000 - value : 0;
  if (board === "moves") return value > 0 ? 1_000_000 - value : 0;
  return value;
}
function cleanLeaderboardValues(v = {}) {
  return {
    stars: Math.floor(clamp(v.stars, 0, 1e7)),
    levels: Math.floor(clamp(v.levels, 0, 1e7)),
    daily: Math.floor(clamp(v.daily, 0, 1e7)),
    marathon: Math.floor(clamp(v.marathon, 0, 1e7)),
    combo: Math.floor(clamp(v.combo, 0, 1e7)),
    duel: Math.floor(clamp(v.duel, 0, 1e8)),
    time: Math.floor(clamp(v.time, 0, 86400000)),
    moves: Math.floor(clamp(v.moves, 0, 100000)),
    onePass: Math.floor(clamp(v.onePass, 0, 1e7)),
  };
}
function fingerprint(rec = {}) { return `${String(rec.name || "Игрок").trim().toLowerCase()}|${String(rec.avatar || "🙂")}`; }
async function leaderboardRecords() {
  const keys = await scanKeys("worditaire:leaderboard:player:*", 5000);
  const rows = await getMany(keys);
  const records = [];
  for (const row of rows) {
    const rec = parse(row.raw);
    if (rec) records.push({ key: row.key, id: row.key.split(":").at(-1), rec });
  }
  return records;
}
async function dedupeLeaderboard(records = null) {
  const rows = records || await leaderboardRecords();
  const remove = new Set();
  const byAccount = new Map();
  for (const row of rows) {
    const accountKey = String(row.rec.accountKey || "");
    if (!accountKey) continue;
    const current = byAccount.get(accountKey);
    if (!current) byAccount.set(accountKey, row);
    else {
      const best = (+current.rec.updatedAt || 0) >= (+row.rec.updatedAt || 0) ? current : row;
      const loser = best === current ? row : current;
      remove.add(loser.id);
      byAccount.set(accountKey, best);
    }
  }
  const accountFp = new Set(rows.filter((row) => row.rec.accountKey && !remove.has(row.id)).map((row) => fingerprint(row.rec)));
  for (const row of rows) if (!row.rec.accountKey && accountFp.has(fingerprint(row.rec))) remove.add(row.id);
  for (const id of remove) {
    await redis(["DEL", playerKey(id)]).catch(() => {});
    for (const board of BOARDS) await redis(["ZREM", boardKey(board), id]).catch(() => {});
  }
  return remove.size;
}

function cleanStarsMap(input = {}) {
  const stars = {};
  for (const [key, value] of Object.entries(input && typeof input === "object" ? input : {})) {
    const level = Math.trunc(Number(key));
    const amount = Math.trunc(Number(value));
    if (!Number.isFinite(level) || level < 1 || level > 10000 || amount < 1) continue;
    stars[level] = Math.max(1, Math.min(3, amount));
  }
  return stars;
}
function evidenceCompleted(profile = {}) {
  const stars = cleanStarsMap(profile.starsByLevel);
  const highestStar = Math.max(0, ...Object.keys(stars).map(Number).filter(Number.isFinite));
  const highestRecord = Math.max(0, ...Object.entries(profile.levelRecords || {})
    .filter(([key, record]) => Number(key) >= 1 && (Number(record?.stars) > 0 || Number(record?.moves) > 0))
    .map(([key]) => Number(key))
    .filter(Number.isFinite));
  return Math.min(10000, Math.max(
    0,
    Math.trunc(Number(profile.currentLevel) || 1) - 1,
    Math.trunc(Number(profile.stats?.levelsCompleted) || 0),
    Math.trunc(Number(profile.campaignProgressFloor) || 0),
    highestStar,
    highestRecord,
  ));
}
function applyCampaignDerived(profile, completed = evidenceCompleted(profile), { fillMissing = true } = {}) {
  completed = Math.min(10000, Math.max(0, Math.trunc(Number(completed) || 0)));
  const stars = cleanStarsMap(profile.starsByLevel);
  if (fillMissing) for (let level = 1; level <= completed; level++) if (!stars[level]) stars[level] = 1;
  for (const key of Object.keys(stars)) if (Number(key) > completed && fillMissing) delete stars[key];
  const totalStars = Object.values(stars).reduce((sum, value) => sum + Math.max(0, Math.min(3, Number(value) || 0)), 0);
  profile.starsByLevel = stars;
  profile.currentLevel = Math.max(1, completed + 1);
  profile.totalStars = totalStars;
  profile.stats = { ...(profile.stats || {}) };
  profile.stats.levelsCompleted = completed;
  profile.stats.chapterFinalsCompleted = Math.floor(completed / CHAPTER_SIZE);
  profile.stats.tripleStarWins = Object.values(stars).filter((value) => Number(value) === 3).length;
  profile.campaignProgressVersion = Math.max(2, Number(profile.campaignProgressVersion) || 0);
  profile.campaignProgressFloor = Math.max(Number(profile.campaignProgressFloor) || 0, completed);
  profile.cosmeticStarsPeak = Math.max(Number(profile.cosmeticStarsPeak) || 0, totalStars + (Number(profile.dailyStarTotal) || 0));
  return profile;
}
function repairCampaign(profile = {}, progressFloor = 0, starFloor = 0) {
  const previousTotal = Math.max(0, Number(profile.totalStars) || 0, Number(starFloor) || 0);
  const stars = cleanStarsMap(profile.starsByLevel);
  profile.starsByLevel = stars;
  const completed = Math.max(evidenceCompleted(profile), Math.trunc(Number(progressFloor) || 0));
  applyCampaignDerived(profile, completed, { fillMissing: true });
  let running = Number(profile.totalStars) || 0;
  const target = Math.min(completed * 3, Math.max(running, previousTotal));
  for (let level = 1; level <= completed && running < target; level++) {
    const room = 3 - (Number(profile.starsByLevel[level]) || 1);
    if (room <= 0) continue;
    const add = Math.min(room, target - running);
    profile.starsByLevel[level] += add;
    running += add;
  }
  return { profile: applyCampaignDerived(profile, completed, { fillMissing: true }), completed, stars: running };
}

function integrityIssues(profile = {}, { account = true } = {}) {
  const issues = [];
  const stars = cleanStarsMap(profile.starsByLevel);
  const completed = Math.max(0, Math.trunc(Number(profile.stats?.levelsCompleted) || 0));
  const current = Math.max(1, Math.trunc(Number(profile.currentLevel) || 1));
  const calculatedStars = Object.values(stars).reduce((sum, value) => sum + Number(value || 0), 0);
  const calculatedTriple = Object.values(stars).filter((value) => Number(value) === 3).length;
  if (!account) issues.push({ code: "account_missing", severity: "danger", text: "Нет зарегистрированного аккаунта для профиля." });
  if ((Number(profile.xp) || 0) < 0) issues.push({ code: "xp_negative", severity: "danger", text: "XP меньше нуля." });
  if (current < completed + 1) issues.push({ code: "current_level_behind", severity: "danger", text: `Текущий уровень ${current} ниже завершённого прогресса ${completed}.` });
  if (current > completed + CHAPTER_SIZE * 3 + 1) issues.push({ code: "current_level_ahead", severity: "warning", text: `Текущий уровень ${current} сильно опережает счётчик завершённых (${completed}).` });
  if (Number(profile.totalStars || 0) !== calculatedStars) issues.push({ code: "stars_total_mismatch", severity: "warning", text: `totalStars=${Number(profile.totalStars) || 0}, по уровням=${calculatedStars}.` });
  if (Number(profile.stats?.tripleStarWins || 0) !== calculatedTriple) issues.push({ code: "triple_star_mismatch", severity: "warning", text: `★★★ счётчик=${Number(profile.stats?.tripleStarWins) || 0}, по уровням=${calculatedTriple}.` });
  const invalidStars = Object.entries(profile.starsByLevel || {}).filter(([key, value]) => !Number.isFinite(Number(key)) || Number(key) < 1 || Number(value) < 1 || Number(value) > 3);
  if (invalidStars.length) issues.push({ code: "invalid_star_rows", severity: "danger", text: `Некорректных записей звёзд: ${invalidStars.length}.` });
  const achievements = Array.isArray(profile.achievements) ? profile.achievements.map(String) : [];
  if (new Set(achievements).size !== achievements.length) issues.push({ code: "duplicate_achievements", severity: "warning", text: "Есть дубликаты достижений." });
  const collectibles = Array.isArray(profile.collectibles?.unlocked) ? profile.collectibles.unlocked.map(String) : [];
  if (new Set(collectibles).size !== collectibles.length) issues.push({ code: "duplicate_collectibles", severity: "warning", text: "Есть дубликаты предметов коллекции." });
  const companions = uniqueStrings(profile.companionsUnlocked);
  const activeCompanion = String(profile.settings?.companion || "");
  if (activeCompanion && companions.length && !companions.includes(activeCompanion)) issues.push({ code: "active_companion_locked", severity: "warning", text: `Выбран спутник «${activeCompanion}», которого нет среди открытых.` });
  return issues;
}
function compactProfileSnapshot(profile = {}) {
  return {
    xp: Math.max(0, Math.trunc(Number(profile.xp) || 0)),
    currentLevel: Math.max(1, Math.trunc(Number(profile.currentLevel) || 1)),
    levelsCompleted: Math.max(0, Math.trunc(Number(profile.stats?.levelsCompleted) || 0)),
    totalStars: Math.max(0, Math.trunc(Number(profile.totalStars) || 0)),
    tripleStarWins: Math.max(0, Math.trunc(Number(profile.stats?.tripleStarWins) || 0)),
    achievementCount: uniqueStrings(profile.achievements).length,
    collectibleCount: uniqueStrings(profile.collectibles?.unlocked).length,
    companionsUnlocked: uniqueStrings(profile.companionsUnlocked),
    adaptive: {
      bias: Number(profile.adaptive?.bias) || 0,
      history: Array.isArray(profile.adaptive?.history) ? profile.adaptive.history.slice(-12) : [],
      restartsSinceWin: Math.max(0, Number(profile.adaptive?.restartsSinceWin) || 0),
    },
  };
}

async function loadPlayer(userId) {
  const id = cleanUserId(userId);
  if (!/^u_[a-zA-Z0-9_-]{8,62}$/.test(id)) return null;
  const [userRaw, profileRaw, leaderboardRaw] = await Promise.all([
    redis(["GET", userKey(id)]),
    redis(["GET", profileKey(id)]),
    redis(["GET", playerKey(id)]),
  ]);
  const user = parse(userRaw);
  const profile = parse(profileRaw);
  if (!profile) return null;
  return { id, user, profile, leaderboard: parse(leaderboardRaw) || {} };
}
async function savePlayer(player, { syncLeaderboard = true } = {}) {
  await redis(["SET", profileKey(player.id), JSON.stringify(player.profile)]);
  await redis(["INCR", profileVersionKey(player.id)]).catch(() => {});
  if (syncLeaderboard) await syncPlayerLeaderboard(player.id, player.profile, player.leaderboard);
}
async function syncPlayerLeaderboard(userId, profile, previous = {}) {
  const stats = profile.stats || {};
  const oldValues = previous.values || {};
  const values = cleanLeaderboardValues({
    ...oldValues,
    stars: Number(profile.totalStars) || 0,
    levels: Number(stats.levelsCompleted) || 0,
    daily: Number(stats.dailyCompleted) || Number(oldValues.daily) || 0,
    marathon: Number(stats.bestMarathon) || Number(oldValues.marathon) || 0,
    combo: Math.max(Number(stats.maxCombo) || 0, Number(stats.maxDragCombo) || 0, Number(oldValues.combo) || 0),
    duel: Number(stats.duelRating) || Number(oldValues.duel) || 0,
    onePass: Number(profile.modeStats?.onePass?.completed) || Number(oldValues.onePass) || 0,
    time: Number(profile.modeStats?.time?.bestTimeMs) || Number(oldValues.time) || 0,
    moves: Number(profile.modeStats?.moves?.bestMoves) || Number(oldValues.moves) || 0,
  });
  const record = {
    ...previous,
    playerId: userId,
    name: String(profile.playerName || previous.name || "Игрок").slice(0, 20),
    avatar: String(profile.avatarEmoji || previous.avatar || "🙂").slice(0, 8),
    values,
    account: true,
    updatedAt: Date.now(),
  };
  await redis(["SET", playerKey(userId), JSON.stringify(record), "EX", 90 * 24 * 60 * 60]);
  for (const board of BOARDS) {
    const value = values[board];
    if (value > 0) await redis(["ZADD", boardKey(board), scoreFor(board, value), userId]);
    else await redis(["ZREM", boardKey(board), userId]).catch(() => {});
  }
  return record;
}

async function readAudit(key, limit = 100) {
  const rows = await redis(["LRANGE", key, "0", String(Math.max(0, Math.min(499, limit - 1)))]);
  return (Array.isArray(rows) ? rows : []).map(parse).filter((item) => item?.id);
}
async function writeAudit({ actor, action, userId = "", reason = "", ticket = "", before = null, after = null, meta = null }) {
  const event = {
    id: `adm-${Date.now().toString(36)}-${randomBytes(5).toString("hex")}`,
    at: Date.now(),
    actor: cleanText(actor, 120),
    action: cleanId(action, 80),
    userId: cleanUserId(userId),
    reason: cleanText(reason, 240),
    ticket: cleanText(ticket, 80),
    before,
    after,
    meta,
  };
  await redis(["LPUSH", AUDIT_KEY, JSON.stringify(event)]);
  await redis(["LTRIM", AUDIT_KEY, "0", "999"]);
  if (event.userId) {
    await redis(["LPUSH", auditUserKey(event.userId), JSON.stringify(event)]);
    await redis(["LTRIM", auditUserKey(event.userId), "0", "199"]);
  }
  return event;
}

async function repairAll() {
  const [profileKeys, records] = await Promise.all([
    scanKeys("worditaire:auth:profile:*", 5000),
    leaderboardRecords(),
  ]);
  const profileRows = await getMany(profileKeys);
  const lbMap = new Map(records.map((row) => [row.id, row.rec]));
  let repaired = 0, starsChanged = 0, levelsChanged = 0;
  const players = [];
  for (const row of profileRows) {
    const userId = row.key.split(":").at(-1);
    const raw = parse(row.raw);
    if (!raw) continue;
    const oldStars = Number(raw.totalStars) || 0;
    const oldLevels = Number(raw.stats?.levelsCompleted) || 0;
    const lb = lbMap.get(userId) || {};
    const fixed = repairCampaign(raw, Number(lb.values?.levels) || 0, Number(lb.values?.stars) || 0);
    await redis(["SET", row.key, JSON.stringify(fixed.profile)]);
    await redis(["INCR", profileVersionKey(userId)]).catch(() => {});
    const synced = await syncPlayerLeaderboard(userId, fixed.profile, lb);
    repaired++;
    if (oldStars !== fixed.stars) starsChanged++;
    if (oldLevels !== fixed.completed) levelsChanged++;
    players.push({ id: userId, name: synced.name, levels: fixed.completed, stars: fixed.stars });
  }
  const deduped = await dedupeLeaderboard(await leaderboardRecords());
  return { repaired, starsChanged, levelsChanged, deduped, players: players.sort((a, b) => b.stars - a.stars).slice(0, 300) };
}

async function summary() {
  const [profileKeys, userKeys, records] = await Promise.all([
    scanKeys("worditaire:auth:profile:*", 5000),
    scanKeys("worditaire:auth:user:*", 5000),
    leaderboardRecords(),
  ]);
  const [profileRows, userRows] = await Promise.all([getMany(profileKeys), getMany(userKeys)]);
  const profilesById = new Map();
  for (const row of profileRows) {
    const id = row.key.split(":").at(-1);
    const profile = parse(row.raw);
    if (profile) profilesById.set(id, profile);
  }
  const leaderboardById = new Map(records.map((row) => [row.id, row.rec]));
  const accounts = [], accountIds = new Set();
  for (const row of userRows) {
    const id = row.key.split(":").at(-1);
    const user = parse(row.raw);
    if (!user?.email) continue;
    accountIds.add(id);
    const profile = profilesById.get(id) || {};
    const lb = leaderboardById.get(id) || {};
    const stats = profile.stats || {};
    const issues = integrityIssues(profile, { account: true });
    accounts.push({
      id,
      email: String(user.email || "").slice(0, 160),
      name: String(profile.playerName || lb.name || "Игрок").slice(0, 20),
      levels: Number(lb.values?.levels) || Number(stats.levelsCompleted) || 0,
      stars: Number(lb.values?.stars) || Number(profile.totalStars) || 0,
      xp: Math.max(0, Math.trunc(Number(profile.xp) || 0)),
      duel: Number(lb.duelStats?.matches) || Number(stats.duelMatches) || 0,
      account: true,
      createdAt: Number(user.createdAt) || 0,
      lastSeenAt: Number(profile.retention?.lastSessionAt) || 0,
      healthIssues: issues.length,
    });
  }
  const legacy = records.filter((row) => !accountIds.has(row.id)).map((row) => ({
    id: row.id,
    email: "",
    name: String(row.rec.name || "Игрок"),
    levels: Number(row.rec.values?.levels) || 0,
    stars: Number(row.rec.values?.stars) || 0,
    xp: 0,
    duel: Number(row.rec.duelStats?.matches) || 0,
    account: false,
    createdAt: 0,
    lastSeenAt: 0,
    healthIssues: 0,
  }));
  return {
    profiles: profileKeys.length,
    accounts: accounts.length,
    leaderboardRecords: records.length,
    adminConfigured: adminConfigured(),
    players: [...accounts, ...legacy]
      .sort((a, b) => (b.account - a.account) || (b.lastSeenAt - a.lastSeenAt) || (b.stars - a.stars))
      .slice(0, 500),
  };
}
async function playerDetail(userId) {
  const player = await loadPlayer(userId);
  if (!player) return null;
  const issues = integrityIssues(player.profile, { account: !!player.user });
  return {
    id: player.id,
    identity: {
      email: String(player.user?.email || "").slice(0, 160),
      createdAt: Number(player.user?.createdAt) || 0,
      name: String(player.profile.playerName || player.leaderboard.name || "Игрок").slice(0, 40),
      avatar: String(player.profile.avatarEmoji || player.leaderboard.avatar || "🙂").slice(0, 16),
    },
    campaign: {
      currentLevel: Math.max(1, Math.trunc(Number(player.profile.currentLevel) || 1)),
      levelsCompleted: Math.max(0, Math.trunc(Number(player.profile.stats?.levelsCompleted) || 0)),
      totalStars: Math.max(0, Math.trunc(Number(player.profile.totalStars) || 0)),
      starsByLevel: cleanStarsMap(player.profile.starsByLevel),
      chapterFinalsCompleted: Math.max(0, Math.trunc(Number(player.profile.stats?.chapterFinalsCompleted) || 0)),
      tripleStarWins: Math.max(0, Math.trunc(Number(player.profile.stats?.tripleStarWins) || 0)),
    },
    xp: Math.max(0, Math.trunc(Number(player.profile.xp) || 0)),
    achievements: uniqueStrings(player.profile.achievements),
    collectibles: {
      unlocked: uniqueStrings(player.profile.collectibles?.unlocked),
      discovered: uniqueStrings(player.profile.collectibles?.discovered),
      seen: uniqueStrings(player.profile.collectibles?.seen),
    },
    companionsUnlocked: uniqueStrings(player.profile.companionsUnlocked),
    selectedCompanion: String(player.profile.settings?.companion || ""),
    mascotProgress: player.profile.mascotProgress && typeof player.profile.mascotProgress === "object" ? player.profile.mascotProgress : {},
    godProgress: player.profile.godProgress && typeof player.profile.godProgress === "object" ? player.profile.godProgress : {},
    adaptive: {
      bias: Number(player.profile.adaptive?.bias) || 0,
      history: Array.isArray(player.profile.adaptive?.history) ? player.profile.adaptive.history.slice(-20) : [],
      restartsSinceWin: Math.max(0, Number(player.profile.adaptive?.restartsSinceWin) || 0),
    },
    health: { ok: issues.length === 0, issues },
    audit: await readAudit(auditUserKey(player.id), 40),
    leaderboard: player.leaderboard,
  };
}

function requireReason(body) {
  const reason = cleanText(body.reason, 240);
  if (reason.length < 3) throw Object.assign(new Error("Укажи причину изменения (минимум 3 символа)."), { code: "reason_required", status: 400 });
  return reason;
}
function validateCollectionId(value, label) {
  const id = cleanId(value, 100);
  if (!id) throw Object.assign(new Error(`Укажи ${label}.`), { code: "invalid_id", status: 400 });
  return id;
}
function setArrayMembership(list, id, enabled, max = 500) {
  const set = new Set(uniqueStrings(list, max));
  if (enabled) set.add(id); else set.delete(id);
  return [...set].slice(0, max);
}
function commandDisplayMeta(command, args) {
  const out = { command };
  for (const key of ["delta", "value", "level", "stars", "mode", "targetLevel", "id"]) if (args?.[key] != null) out[key] = args[key];
  return out;
}
async function executePlayerCommand(player, command, args = {}) {
  const profile = player.profile;
  switch (command) {
    case "xp_adjust": {
      const delta = Math.trunc(Number(args.delta));
      if (!Number.isFinite(delta) || delta === 0 || Math.abs(delta) > 10_000_000) throw Object.assign(new Error("XP: укажи ненулевое изменение до 10 000 000."), { code: "invalid_xp_delta", status: 400 });
      profile.xp = Math.max(0, Math.min(1_000_000_000, Math.trunc(Number(profile.xp) || 0) + delta));
      profile.pendingRankUp = null;
      return { changed: true, syncLeaderboard: false };
    }
    case "xp_set": {
      const value = Math.trunc(Number(args.value));
      if (!Number.isFinite(value) || value < 0 || value > 1_000_000_000) throw Object.assign(new Error("XP должен быть от 0 до 1 000 000 000."), { code: "invalid_xp", status: 400 });
      profile.xp = value;
      profile.pendingRankUp = null;
      return { changed: true, syncLeaderboard: false };
    }
    case "level_stars_set": {
      const level = Math.trunc(Number(args.level));
      const stars = Math.trunc(Number(args.stars));
      const mode = args.mode === "at_least" ? "at_least" : "exact";
      const completed = evidenceCompleted(profile);
      if (!Number.isFinite(level) || level < 1 || level > 10000 || stars < 1 || stars > 3) throw Object.assign(new Error("Уровень или число звёзд некорректны."), { code: "invalid_level_stars", status: 400 });
      if (level > completed) throw Object.assign(new Error(`Уровень ${level} ещё не считается пройденным. Для продвижения используй «Пройти до уровня».`), { code: "level_not_completed", status: 409 });
      profile.starsByLevel = cleanStarsMap(profile.starsByLevel);
      const old = Number(profile.starsByLevel[level]) || 1;
      profile.starsByLevel[level] = mode === "at_least" ? Math.max(old, stars) : stars;
      applyCampaignDerived(profile, completed, { fillMissing: true });
      return { changed: profile.starsByLevel[level] !== old, syncLeaderboard: true };
    }
    case "campaign_complete_through": {
      const targetLevel = Math.trunc(Number(args.targetLevel));
      const stars = Math.trunc(Number(args.stars));
      const mode = ["new_only", "at_least", "exact"].includes(args.mode) ? args.mode : "new_only";
      const completed = evidenceCompleted(profile);
      if (!Number.isFinite(targetLevel) || targetLevel < 1 || targetLevel > 10000 || stars < 1 || stars > 3) throw Object.assign(new Error("Уровень или число звёзд некорректны."), { code: "invalid_campaign_target", status: 400 });
      if (targetLevel < completed) throw Object.assign(new Error(`Нельзя этим действием откатить кампанию ниже ${completed}.`), { code: "campaign_downgrade_blocked", status: 409 });
      profile.starsByLevel = cleanStarsMap(profile.starsByLevel);
      for (let level = 1; level <= targetLevel; level++) {
        const old = Number(profile.starsByLevel[level]) || 0;
        if (!old || mode === "exact") profile.starsByLevel[level] = stars;
        else if (mode === "at_least") profile.starsByLevel[level] = Math.max(old, stars);
      }
      applyCampaignDerived(profile, targetLevel, { fillMissing: true });
      return { changed: targetLevel !== completed || mode !== "new_only", syncLeaderboard: true };
    }
    case "achievement_grant":
    case "achievement_revoke": {
      const id = validateCollectionId(args.id, "ID достижения");
      profile.achievements = setArrayMembership(profile.achievements, id, command.endsWith("grant"), 500);
      profile.featuredAchievements = uniqueStrings(profile.featuredAchievements).filter((value) => profile.achievements.includes(value)).slice(0, 3);
      return { changed: true, syncLeaderboard: false };
    }
    case "collectible_grant":
    case "collectible_revoke": {
      const id = validateCollectionId(args.id, "ID предмета");
      const grant = command.endsWith("grant");
      profile.collectibles = profile.collectibles && typeof profile.collectibles === "object" ? profile.collectibles : { version: 1, unlocked: [], discovered: [], seen: [] };
      profile.collectibles.version = Math.max(1, Number(profile.collectibles.version) || 1);
      profile.collectibles.unlocked = setArrayMembership(profile.collectibles.unlocked, id, grant, 500);
      profile.collectibles.discovered = setArrayMembership(profile.collectibles.discovered, id, grant, 500);
      if (!grant) profile.collectibles.seen = setArrayMembership(profile.collectibles.seen, id, false, 500);
      return { changed: true, syncLeaderboard: false };
    }
    case "companion_force_grant":
    case "companion_force_revoke": {
      const id = validateCollectionId(args.id, "ID маскота");
      const grant = command.endsWith("grant");
      profile.companionsUnlocked = setArrayMembership(profile.companionsUnlocked, id, grant, 120);
      profile.settings = { ...(profile.settings || {}) };
      if (!grant && String(profile.settings.companion || "") === id) profile.settings.companion = "";
      return { changed: true, syncLeaderboard: false };
    }
    case "adaptive_reset": {
      profile.adaptive = { bias: 0, history: [], restartsSinceWin: 0 };
      return { changed: true, syncLeaderboard: false };
    }
    case "repair_player": {
      const fixed = repairCampaign(profile, Number(player.leaderboard?.values?.levels) || 0, Number(player.leaderboard?.values?.stars) || 0);
      player.profile = fixed.profile;
      return { changed: true, syncLeaderboard: true };
    }
    default:
      throw Object.assign(new Error("Неизвестная admin-команда."), { code: "unknown_command", status: 400 });
  }
}
async function runIdempotentCommand({ actor, body }) {
  const userId = cleanUserId(body.userId);
  const command = cleanId(body.command, 80);
  const commandId = cleanId(body.commandId || `auto-${randomBytes(10).toString("hex")}`, 96);
  const reason = requireReason(body);
  const ticket = cleanText(body.ticket, 80);
  if (!/^u_[a-zA-Z0-9_-]{8,62}$/.test(userId)) throw Object.assign(new Error("Некорректный user ID."), { code: "invalid_user_id", status: 400 });
  if (!command) throw Object.assign(new Error("Не выбрана команда."), { code: "invalid_command", status: 400 });

  const idempotencyKey = commandKey(commandId);
  const existing = await redis(["GET", idempotencyKey]);
  if (existing && existing !== "pending") {
    const replay = parse(existing);
    if (replay) return { ...replay, replayed: true };
  }
  if (existing === "pending") throw Object.assign(new Error("Команда уже выполняется."), { code: "command_in_progress", status: 409 });
  const accepted = await redis(["SET", idempotencyKey, "pending", "NX", "EX", 86400]);
  if (!accepted) throw Object.assign(new Error("Команда уже была принята."), { code: "duplicate_command", status: 409 });

  try {
    const player = await loadPlayer(userId);
    if (!player) throw Object.assign(new Error("Аккаунт игрока не найден."), { code: "account_not_found", status: 404 });
    const before = compactProfileSnapshot(player.profile);
    const result = await executePlayerCommand(player, command, body.args || {});
    await savePlayer(player, { syncLeaderboard: result.syncLeaderboard !== false });
    const after = compactProfileSnapshot(player.profile);
    const audit = await writeAudit({
      actor,
      action: command,
      userId,
      reason,
      ticket,
      before,
      after,
      meta: commandDisplayMeta(command, body.args || {}),
    });
    const response = { ok: true, command, commandId, userId, auditId: audit.id, detail: await playerDetail(userId) };
    await redis(["SET", idempotencyKey, JSON.stringify(response), "EX", 86400]);
    return response;
  } catch (error) {
    await redis(["DEL", idempotencyKey]).catch(() => {});
    throw error;
  }
}

function russianDate(date = new Date()) {
  try { return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Moscow" }).format(date); }
  catch { return date.toISOString().slice(0, 10); }
}
function safeCtaHref(value) {
  const href = String(value || "").trim().slice(0, 240);
  if (!href) return "";
  if (href.startsWith("//") || /^[a-z][a-z0-9+.-]*:/i.test(href)) return "";
  return href.startsWith("/") || href.startsWith("#") || href.startsWith("?") ? href : "";
}
function sanitizeAdminMessage(input = {}) {
  const title = cleanText(input.title, 80);
  const intro = cleanText(input.intro, 480);
  const items = (Array.isArray(input.items) ? input.items : [])
    .map((item) => cleanText(item, 200))
    .filter(Boolean)
    .slice(0, 8);
  if (!title || !intro) return null;
  const createdAt = Date.now();
  const presentation = input.presentation === "inbox_modal" ? "inbox_modal" : "inbox";
  const expiresHours = Math.max(0, Math.min(365 * 24, Number(input.expiresHours) || 0));
  const id = `admin-${createdAt.toString(36)}-${randomBytes(5).toString("hex")}`;
  return {
    id,
    version: id,
    major: false,
    date: russianDate(new Date(createdAt)),
    title,
    intro,
    items,
    createdAt,
    source: "admin",
    sender: cleanText(input.sender, 60) || "Команда Словасьянса",
    presentation,
    priority: input.priority === "important" ? "important" : "normal",
    ctaLabel: cleanText(input.ctaLabel, 48),
    ctaHref: safeCtaHref(input.ctaHref),
    expiresAt: expiresHours ? createdAt + Math.round(expiresHours * 60 * 60 * 1000) : 0,
  };
}
async function pushMail(key, message) {
  await redis(["LPUSH", key, JSON.stringify(message)]);
  await redis(["LTRIM", key, "0", String(MAX_MAIL - 1)]);
}
async function sendAdminMail(actor, body) {
  const message = sanitizeAdminMessage(body);
  if (!message) throw Object.assign(new Error("Нужны заголовок и текст письма."), { code: "invalid_message", status: 400 });
  const target = String(body.target || "all");
  if (target === "all") {
    await pushMail(GLOBAL_MAIL_KEY, message);
    await writeAudit({ actor, action: "mail_send_all", reason: cleanText(body.reason, 240) || `Рассылка: ${message.title}`, ticket: cleanText(body.ticket, 80), meta: { messageId: message.id, presentation: message.presentation } });
    return { ok: true, target: "all", message };
  }
  const userId = cleanUserId(target);
  if (!/^u_[a-zA-Z0-9_-]{8,62}$/.test(userId)) throw Object.assign(new Error("Некорректный user ID."), { code: "invalid_user_id", status: 400 });
  if (!(await redis(["GET", userKey(userId)]))) throw Object.assign(new Error("Аккаунт игрока не найден."), { code: "account_not_found", status: 404 });
  await pushMail(mailKeyForUser(userId), message);
  await writeAudit({ actor, action: "mail_send", userId, reason: cleanText(body.reason, 240) || `Письмо: ${message.title}`, ticket: cleanText(body.ticket, 80), meta: { messageId: message.id, presentation: message.presentation } });
  return { ok: true, target: userId, message };
}

export function OPTIONS() { return json({ ok: true }); }

export async function GET(request) {
  if (!sameOrigin(request)) return json({ error: "bad_origin" }, 403);
  try {
    if (!adminConfigured()) return json({ error: "admin_not_configured" }, 503);
    const session = await currentAdminSession(request);
    if (!session) return json({ authenticated: false, error: "unauthorized" }, 401);
    const url = new URL(request.url);
    if (url.searchParams.get("session") === "1") return json({ ok: true, authenticated: true });
    if (url.searchParams.get("audit") === "1") {
      const userId = cleanUserId(url.searchParams.get("userId") || "");
      const limit = Math.max(1, Math.min(200, Number(url.searchParams.get("limit")) || 100));
      return json({ ok: true, authenticated: true, audit: await readAudit(userId ? auditUserKey(userId) : AUDIT_KEY, limit) });
    }
    const userId = cleanUserId(url.searchParams.get("player") || "");
    if (userId) {
      const detail = await playerDetail(userId);
      if (!detail) return json({ error: "account_not_found" }, 404);
      return json({ ok: true, authenticated: true, detail });
    }
    return json({ ok: true, authenticated: true, ...await summary() });
  } catch (error) {
    console.error("admin GET", error);
    if (error?.message === "REDIS_NOT_CONFIGURED") return json({ error: "redis_not_configured" }, 503);
    return json({ error: "server_error", message: String(error?.message || error) }, 500);
  }
}

export async function POST(request) {
  if (!sameOrigin(request)) return json({ error: "bad_origin" }, 403);
  try {
    const body = await request.json().catch(() => ({}));
    const action = String(body.action || "");
    if (action === "login") {
      if (!adminConfigured()) return json({ error: "admin_not_configured" }, 503);
      if (!(await checkRateLimit(request, "admin-login", 12, ADMIN_LOGIN_WINDOW))) return json({ error: "rate_limited" }, 429, { "Retry-After": String(ADMIN_LOGIN_WINDOW) });
      const login = String(body.login || "").trim().toLowerCase();
      const password = String(body.password || "");
      if (login.length > 120 || password.length > 256 || await loginBlocked(login)) return json({ error: "rate_limited" }, 429, { "Retry-After": String(ADMIN_LOGIN_WINDOW) });
      if (!(await validAdminCredentials(login, password))) {
        await recordLoginFailure(login);
        return json({ error: "invalid_credentials" }, 401);
      }
      await clearLoginFailures(login);
      const token = await createAdminSession();
      return json({ ok: true, authenticated: true }, 200, { "Set-Cookie": adminCookie(request, token) });
    }
    if (action === "logout") {
      await deleteAdminSession(request);
      return json({ ok: true, authenticated: false }, 200, { "Set-Cookie": adminCookie(request, "", 0) });
    }
    if (!adminConfigured()) return json({ error: "admin_not_configured" }, 503);
    const session = await currentAdminSession(request);
    if (!session) return json({ authenticated: false, error: "unauthorized" }, 401);

    if (action === "repair_all") {
      if (!(await checkRateLimit(request, "admin-repair-all", 6, 900))) return json({ error: "rate_limited" }, 429);
      const result = await repairAll();
      await writeAudit({ actor: session.login, action: "repair_all", reason: cleanText(body.reason, 240) || "Массовая проверка и ремонт прогресса", meta: { repaired: result.repaired, starsChanged: result.starsChanged, levelsChanged: result.levelsChanged } });
      const overview = await summary();
      const { players: _repairPlayers, ...repairMeta } = result;
      return json({ ok: true, ...overview, ...repairMeta });
    }
    if (action === "dedupe") {
      if (!(await checkRateLimit(request, "admin-dedupe", 12, 900))) return json({ error: "rate_limited" }, 429);
      const deduped = await dedupeLeaderboard();
      await writeAudit({ actor: session.login, action: "leaderboard_dedupe", reason: cleanText(body.reason, 240) || "Удаление дублей лидерборда", meta: { deduped } });
      return json({ ok: true, deduped });
    }
    if (action === "command") {
      if (!(await checkRateLimit(request, "admin-player-command", 120, 900))) return json({ error: "rate_limited" }, 429);
      return json(await runIdempotentCommand({ actor: session.login, body }));
    }
    if (action === "send_mail") {
      if (!(await checkRateLimit(request, "admin-mail-send", 40, 900))) return json({ error: "rate_limited" }, 429);
      return json(await sendAdminMail(session.login, body));
    }
    if (action === "delete_account") {
      if (!(await checkRateLimit(request, "admin-delete-account", 30, 15 * 60))) return json({ error: "rate_limited" }, 429);
      const userId = cleanUserId(body.userId);
      if (!userId) return json({ error: "invalid_user_id" }, 400);
      const reason = cleanText(body.reason, 240);
      if (reason.length < 3) return json({ error: "reason_required", message: "Укажи причину удаления аккаунта." }, 400);
      const beforePlayer = await loadPlayer(userId);
      const deleted = await deleteAccountData(userId);
      if (!deleted.deleted) return json({ error: "account_not_found" }, 404);
      await writeAudit({ actor: session.login, action: "delete_account", userId, reason, ticket: cleanText(body.ticket, 80), before: beforePlayer ? compactProfileSnapshot(beforePlayer.profile) : null, after: { deleted: true } });
      return json({ ok: true, deleted: true, deletedAccount: deleted, ...await summary() });
    }
    return json({ error: "unknown_action" }, 400);
  } catch (error) {
    console.error("admin POST", error);
    if (error?.message === "REDIS_NOT_CONFIGURED") return json({ error: "redis_not_configured" }, 503);
    return json({ error: error?.code || "server_error", message: String(error?.message || error) }, Number(error?.status) || 500);
  }
}
