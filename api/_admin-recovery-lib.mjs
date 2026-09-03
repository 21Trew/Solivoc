import { randomBytes } from "node:crypto";
import { cloudProfileVersion, readCloudProfile, sanitizeProfile, userKey } from "./_auth-lib.mjs";
import { mutateCloudProfileAtomic } from "./_profile-sync-lib.mjs";
import { redis } from "./_push-lib.mjs";

const CHECKPOINT_PREFIX = "worditaire:admin:recovery-checkpoint:v1:";
const CHECKPOINT_LIST_PREFIX = "worditaire:admin:recovery-checkpoints:v1:user:";
const RECOVERY_COMMAND_PREFIX = "worditaire:admin:recovery-command:v1:";
const AUDIT_KEY = "worditaire:admin:audit:v1";
const AUDIT_USER_PREFIX = "worditaire:admin:audit:v1:user:";
const CHECKPOINT_TTL = 90 * 24 * 60 * 60;
const MAX_CHECKPOINTS = 30;
const CHAPTER_SIZE = 10;

const PROGRESS_ROOTS = Object.freeze([
  "xp", "currentLevel", "starsByLevel", "totalStars", "dailyStars", "dailyStarTotal", "cosmeticStarsPeak",
  "discovered", "achievements", "featuredAchievements", "companionsUnlocked", "mascotProgressVersion", "mascotProgress",
  "godProgress", "progressionMilestones", "retiredCompanionRewards", "mascotDaily", "collectibles", "visualDiscovered",
  "categoryStats", "associationCollections", "levelRecords", "dailyRecords", "challengeRecords", "duelHistoryRecords",
  "weekly", "monthly", "weeklyDigest", "challengeMetrics", "challengeMetricsVersion", "modeStats", "daily", "dailyQuests",
  "adaptive", "stats", "campaignProgressVersion", "campaignProgressFloor", "completionLedgerBase", "completionTransactions",
]);

const clone = (value) => {
  try { return JSON.parse(JSON.stringify(value)); } catch { return null; }
};
const cleanUserId = (value) => String(value || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
const cleanText = (value, max = 240) => String(value ?? "")
  .replace(/[\u0000-\u001f\u007f]/g, " ")
  .replace(/\s+/g, " ")
  .trim()
  .slice(0, max);
const cleanId = (value, max = 100) => String(value || "").replace(/[^a-zA-Z0-9_:.\-]/g, "").slice(0, max);
const validDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || "")) ? String(value) : "";
const int = (value, min = 0, max = 1_000_000_000) => Math.max(min, Math.min(max, Math.trunc(Number(value) || 0)));
const object = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {};
const uniqueStrings = (value, max = 5000) => [...new Set((Array.isArray(value) ? value : []).map(String).filter(Boolean))].slice(0, max);

function profileKey(userId) { return `worditaire:auth:profile:${cleanUserId(userId)}`; }
function auditUserKey(userId) { return `${AUDIT_USER_PREFIX}${cleanUserId(userId)}`; }
function checkpointKey(id) { return `${CHECKPOINT_PREFIX}${cleanId(id, 120)}`; }
function checkpointListKey(userId) { return `${CHECKPOINT_LIST_PREFIX}${cleanUserId(userId)}`; }
function recoveryCommandKey(id) { return `${RECOVERY_COMMAND_PREFIX}${cleanId(id, 120)}`; }

function cleanStarsMap(input = {}) {
  const out = {};
  for (const [rawLevel, rawStars] of Object.entries(object(input))) {
    const level = int(rawLevel, 1, 10000);
    const stars = int(rawStars, 0, 3);
    if (level >= 1 && stars >= 1) out[level] = stars;
  }
  return out;
}

function normalizeDailyQuests(value = {}) {
  const input = object(value);
  const date = validDate(input.date);
  const modes = uniqueStrings(input.modes, 3).slice(0, 3);
  const progress = {}, rewarded = {};
  for (const mode of modes) {
    progress[mode] = int(input.progress?.[mode], 0, 5);
    rewarded[mode] = !!input.rewarded?.[mode];
  }
  return { date, modes, progress, rewarded };
}

function normalizeDaily(profile) {
  const daily = object(profile.daily);
  daily.lastDate = validDate(daily.lastDate) || null;
  daily.currentStreak = int(daily.currentStreak, 0, 100000);
  daily.bestStreak = Math.max(daily.currentStreak, int(daily.bestStreak, 0, 100000));
  daily.completedDates = uniqueStrings(daily.completedDates, 10000).filter(validDate).sort();
  daily.freezeWeek = daily.freezeWeek == null ? null : String(daily.freezeWeek).slice(0, 40);
  daily.weekRewards = object(daily.weekRewards);
  profile.daily = daily;

  const dailyStars = {};
  for (const [date, stars] of Object.entries(object(profile.dailyStars))) {
    const cleanDate = validDate(date);
    if (cleanDate) dailyStars[cleanDate] = int(stars, 0, 3);
  }
  profile.dailyStars = dailyStars;
  profile.dailyStarTotal = Object.values(dailyStars).reduce((sum, stars) => sum + int(stars, 0, 3), 0);
  profile.dailyQuests = normalizeDailyQuests(profile.dailyQuests);
  profile.stats = object(profile.stats);
  profile.stats.dailyCompleted = Math.max(int(profile.stats.dailyCompleted), daily.completedDates.length);
  return profile;
}

function normalizeCampaign(profile) {
  const stars = cleanStarsMap(profile.starsByLevel);
  const highestStar = Math.max(0, ...Object.keys(stars).map(Number).filter(Number.isFinite));
  const completed = Math.min(10000, Math.max(
    highestStar,
    int(profile.currentLevel, 1, 10001) - 1,
    int(profile.stats?.levelsCompleted, 0, 10000),
    int(profile.campaignProgressFloor, 0, 10000),
  ));
  for (let level = 1; level <= completed; level++) if (!stars[level]) stars[level] = 1;
  for (const level of Object.keys(stars)) if (Number(level) > completed) delete stars[level];
  profile.starsByLevel = stars;
  profile.currentLevel = completed + 1;
  profile.totalStars = Object.values(stars).reduce((sum, value) => sum + int(value, 0, 3), 0);
  profile.stats = object(profile.stats);
  profile.stats.levelsCompleted = completed;
  profile.stats.chapterFinalsCompleted = Math.floor(completed / CHAPTER_SIZE);
  profile.stats.tripleStarWins = Object.values(stars).filter((value) => Number(value) === 3).length;
  profile.campaignProgressVersion = Math.max(2, int(profile.campaignProgressVersion, 0, 100));
  profile.campaignProgressFloor = Math.max(int(profile.campaignProgressFloor, 0, 10000), completed);
  profile.cosmeticStarsPeak = Math.max(int(profile.cosmeticStarsPeak), profile.totalStars + int(profile.dailyStarTotal));
  return profile;
}

function normalizeProgress(profile) {
  profile.xp = int(profile.xp, 0, 1_000_000_000);
  normalizeDaily(profile);
  normalizeCampaign(profile);
  return profile;
}

export function exportProgressSnapshot(profile = {}) {
  const out = { schema: "solivoc-admin-progress-v1" };
  for (const key of PROGRESS_ROOTS) if (Object.prototype.hasOwnProperty.call(profile, key)) out[key] = clone(profile[key]);
  out.settings = { companion: String(profile.settings?.companion || "").slice(0, 100) };
  return out;
}

function applySnapshotPatch(profile, snapshot) {
  const source = object(snapshot);
  const nested = object(source.progress);
  const input = Object.keys(nested).length ? nested : source;
  for (const key of PROGRESS_ROOTS) {
    if (!Object.prototype.hasOwnProperty.call(input, key)) continue;
    profile[key] = clone(input[key]);
  }
  if (input.settings && typeof input.settings === "object" && Object.prototype.hasOwnProperty.call(input.settings, "companion")) {
    profile.settings = { ...object(profile.settings), companion: String(input.settings.companion || "").slice(0, 100) };
  }
  return normalizeProgress(profile);
}

function applyDailyRestore(profile, input = {}) {
  const args = object(input);
  const daily = { ...object(profile.daily) };
  if (Object.prototype.hasOwnProperty.call(args, "currentStreak")) daily.currentStreak = int(args.currentStreak, 0, 100000);
  if (Object.prototype.hasOwnProperty.call(args, "bestStreak")) daily.bestStreak = int(args.bestStreak, 0, 100000);
  if (Object.prototype.hasOwnProperty.call(args, "lastDate")) daily.lastDate = validDate(args.lastDate) || null;
  if (Array.isArray(args.completedDates)) daily.completedDates = uniqueStrings(args.completedDates, 10000).filter(validDate).sort();
  if (args.weekRewards && typeof args.weekRewards === "object") daily.weekRewards = clone(args.weekRewards);
  profile.daily = daily;
  if (args.dailyStars && typeof args.dailyStars === "object") profile.dailyStars = clone(args.dailyStars);
  if (Object.prototype.hasOwnProperty.call(args, "dailyCompleted")) {
    profile.stats = object(profile.stats);
    profile.stats.dailyCompleted = int(args.dailyCompleted, 0, 100000);
  }
  if (args.dailyQuests && typeof args.dailyQuests === "object") profile.dailyQuests = normalizeDailyQuests(args.dailyQuests);
  if (args.mascotDaily && typeof args.mascotDaily === "object") profile.mascotDaily = clone(args.mascotDaily);
  return normalizeProgress(profile);
}

function applyPeriodicRestore(profile, input = {}) {
  const args = object(input);
  profile.stats = object(profile.stats);
  for (const period of ["weekly", "monthly"]) {
    if (args[period] && typeof args[period] === "object") profile[period] = clone(args[period]);
    const statKey = `${period}Completed`;
    if (Object.prototype.hasOwnProperty.call(args, statKey)) profile.stats[statKey] = int(args[statKey], 0, 100000);
  }
  if (args.weeklyDigest && typeof args.weeklyDigest === "object") profile.weeklyDigest = clone(args.weeklyDigest);
  return normalizeProgress(profile);
}

function recoveryMeta(profile) {
  const meta = object(profile.adminRecovery);
  const domains = object(meta.domains);
  return { version: Math.max(1, int(meta.version, 1, 100)), updatedAt: int(meta.updatedAt), domains: { ...domains } };
}

function stampRecovery(profile, domains) {
  const at = Date.now();
  const meta = recoveryMeta(profile);
  meta.version = 1;
  meta.updatedAt = at;
  for (const domain of domains) meta.domains[String(domain)] = at;
  profile.adminRecovery = meta;
  return at;
}

function copyRoot(target, source, key) {
  if (Object.prototype.hasOwnProperty.call(source || {}, key)) target[key] = clone(source[key]);
  else delete target[key];
}
function copyStatKeys(target, source, keys) {
  target.stats = object(target.stats);
  const stats = object(source?.stats);
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(stats, key)) target.stats[key] = clone(stats[key]);
    else delete target.stats[key];
  }
}
function copyDomain(target, source, domain) {
  if (domain === "allProgress") {
    for (const key of PROGRESS_ROOTS) copyRoot(target, source, key);
    if (source?.settings && Object.prototype.hasOwnProperty.call(source.settings, "companion")) {
      target.settings = { ...object(target.settings), companion: String(source.settings.companion || "") };
    }
    return;
  }
  if (domain === "daily") {
    for (const key of ["daily", "dailyStars", "dailyStarTotal", "dailyRecords"]) copyRoot(target, source, key);
    copyStatKeys(target, source, ["dailyCompleted"]);
    return;
  }
  if (domain === "dailyQuests") {
    for (const key of ["dailyQuests", "mascotDaily"]) copyRoot(target, source, key);
    return;
  }
  if (domain === "periodic") {
    for (const key of ["weekly", "monthly", "weeklyDigest"]) copyRoot(target, source, key);
    copyStatKeys(target, source, ["weeklyCompleted", "monthlyCompleted"]);
    return;
  }
}

export function reconcileAdminRecoveryDomains(current, incoming, merged) {
  const currentMeta = recoveryMeta(current);
  const incomingMeta = recoveryMeta(incoming);
  const allCurrent = int(currentMeta.domains.allProgress);
  const allIncoming = int(incomingMeta.domains.allProgress);
  if (allCurrent > allIncoming) {
    copyDomain(merged, current, "allProgress");
  } else {
    for (const domain of ["daily", "dailyQuests", "periodic"]) {
      if (int(currentMeta.domains[domain]) > int(incomingMeta.domains[domain])) copyDomain(merged, current, domain);
    }
  }
  const domains = { ...incomingMeta.domains };
  for (const [key, value] of Object.entries(currentMeta.domains)) domains[key] = Math.max(int(domains[key]), int(value));
  merged.adminRecovery = {
    version: 1,
    updatedAt: Math.max(int(currentMeta.updatedAt), int(incomingMeta.updatedAt)),
    domains,
  };
  return merged;
}

async function writeAudit({ actor, action, userId, reason, before, after, meta = null }) {
  const event = {
    id: `adm-${Date.now().toString(36)}-${randomBytes(5).toString("hex")}`,
    at: Date.now(),
    actor: cleanText(actor, 120),
    action: cleanId(action, 80),
    userId: cleanUserId(userId),
    reason: cleanText(reason, 240),
    ticket: "",
    before,
    after,
    meta,
  };
  await redis(["LPUSH", AUDIT_KEY, JSON.stringify(event)]);
  await redis(["LTRIM", AUDIT_KEY, "0", "999"]);
  await redis(["LPUSH", auditUserKey(userId), JSON.stringify(event)]);
  await redis(["LTRIM", auditUserKey(userId), "0", "199"]);
  return event;
}

function compact(profile = {}) {
  return {
    xp: int(profile.xp),
    levels: int(profile.stats?.levelsCompleted),
    stars: int(profile.totalStars),
    dailyCompleted: int(profile.stats?.dailyCompleted),
    streak: int(profile.daily?.currentStreak),
    bestStreak: int(profile.daily?.bestStreak),
    dailyQuestDate: validDate(profile.dailyQuests?.date),
    weeklyCompleted: int(profile.stats?.weeklyCompleted),
    monthlyCompleted: int(profile.stats?.monthlyCompleted),
  };
}

async function createCheckpoint(userId, profile, { actor = "", reason = "" } = {}) {
  const id = `rcv-${Date.now().toString(36)}-${randomBytes(6).toString("hex")}`;
  const payload = {
    id,
    userId: cleanUserId(userId),
    at: Date.now(),
    actor: cleanText(actor, 120),
    reason: cleanText(reason, 240),
    profile: clone(profile),
  };
  await redis(["SET", checkpointKey(id), JSON.stringify(payload), "EX", CHECKPOINT_TTL]);
  await redis(["LPUSH", checkpointListKey(userId), id]);
  await redis(["LTRIM", checkpointListKey(userId), "0", String(MAX_CHECKPOINTS - 1)]);
  await redis(["EXPIRE", checkpointListKey(userId), CHECKPOINT_TTL]);
  return { id, at: payload.at, actor: payload.actor, reason: payload.reason };
}

async function listCheckpoints(userId, limit = 10) {
  const ids = await redis(["LRANGE", checkpointListKey(userId), "0", String(Math.max(0, Math.min(MAX_CHECKPOINTS - 1, limit - 1)))]);
  const result = [];
  for (const id of Array.isArray(ids) ? ids : []) {
    const row = clone(JSON.parse((await redis(["GET", checkpointKey(id)])) || "null"));
    if (!row?.profile || row.userId !== cleanUserId(userId)) continue;
    result.push({ id: row.id, at: row.at, actor: row.actor, reason: row.reason, summary: compact(row.profile) });
  }
  return result;
}

export async function getAdminRecoveryDetail(userId) {
  const id = cleanUserId(userId);
  if (!/^u_[a-zA-Z0-9_-]{8,62}$/.test(id)) throw Object.assign(new Error("Некорректный идентификатор игрока."), { code: "invalid_user_id", status: 400 });
  const [profile, version, userRaw] = await Promise.all([
    readCloudProfile(id),
    cloudProfileVersion(id),
    redis(["GET", userKey(id)]),
  ]);
  if (!userRaw || !profile || !Object.keys(profile).length) throw Object.assign(new Error("Аккаунт игрока не найден."), { code: "account_not_found", status: 404 });
  let user = null;
  try { user = JSON.parse(userRaw); } catch {}
  return {
    userId: id,
    email: String(user?.email || "").slice(0, 160),
    version,
    summary: compact(profile),
    progress: exportProgressSnapshot(profile),
    checkpoints: await listCheckpoints(id, 12),
    recoveryMeta: recoveryMeta(profile),
  };
}

function requireReason(body) {
  const reason = cleanText(body.reason, 240);
  if (reason.length < 3) throw Object.assign(new Error("Укажи причину восстановления (минимум 3 символа)."), { code: "reason_required", status: 400 });
  return reason;
}

async function executeRecovery({ actor, body }) {
  const userId = cleanUserId(body.userId);
  const reason = requireReason(body);
  const action = cleanId(body.action, 80);
  if (!/^u_[a-zA-Z0-9_-]{8,62}$/.test(userId)) throw Object.assign(new Error("Некорректный идентификатор игрока."), { code: "invalid_user_id", status: 400 });
  if (!(await redis(["GET", userKey(userId)]))) throw Object.assign(new Error("Аккаунт игрока не найден."), { code: "account_not_found", status: 404 });

  let checkpoint = null;
  let before = null;
  let after = null;
  let stampedDomains = [];
  const result = await mutateCloudProfileAtomic(userId, async ({ current }) => {
    const working = clone(current) || {};
    before = compact(working);
    checkpoint = await createCheckpoint(userId, working, { actor, reason });

    if (action === "progress_restore_daily") {
      applyDailyRestore(working, body.daily || {});
      if (body.periodic && typeof body.periodic === "object") applyPeriodicRestore(working, body.periodic);
      stampedDomains = ["daily", "dailyQuests", ...(body.periodic ? ["periodic"] : [])];
    } else if (action === "progress_restore_snapshot") {
      const source = body.progress && typeof body.progress === "object" ? body.progress : body.profile;
      if (!source || typeof source !== "object") throw Object.assign(new Error("Не передан снимок прогресса."), { code: "invalid_progress_snapshot", status: 400 });
      applySnapshotPatch(working, source);
      stampedDomains = ["allProgress"];
    } else if (action === "progress_restore_checkpoint") {
      const restoreId = cleanId(body.checkpointId, 120);
      const raw = restoreId ? await redis(["GET", checkpointKey(restoreId)]) : null;
      let saved = null;
      try { saved = raw ? JSON.parse(raw) : null; } catch {}
      if (!saved?.profile || saved.userId !== userId) throw Object.assign(new Error("Контрольная точка не найдена или истекла."), { code: "checkpoint_not_found", status: 404 });
      const restored = sanitizeProfile(clone(saved.profile) || {}, userId);
      for (const key of Object.keys(working)) delete working[key];
      Object.assign(working, restored);
      stampedDomains = ["allProgress"];
    } else {
      throw Object.assign(new Error("Неизвестная команда восстановления."), { code: "unknown_recovery_action", status: 400 });
    }

    stampRecovery(working, stampedDomains);
    after = compact(working);
    return working;
  });

  const audit = await writeAudit({
    actor,
    action,
    userId,
    reason,
    before,
    after,
    meta: { checkpointId: checkpoint?.id || "", domains: stampedDomains },
  });
  return {
    ok: true,
    action,
    userId,
    version: result.version,
    checkpoint,
    auditId: audit.id,
    detail: await getAdminRecoveryDetail(userId),
  };
}

export async function runAdminRecovery({ actor, body }) {
  const commandId = cleanId(body.commandId || `auto-${randomBytes(10).toString("hex")}`, 120);
  const key = recoveryCommandKey(commandId);
  const existing = await redis(["GET", key]);
  if (existing && existing !== "pending") {
    try { return { ...JSON.parse(existing), replayed: true }; } catch {}
  }
  if (existing === "pending") throw Object.assign(new Error("Команда восстановления уже выполняется."), { code: "command_in_progress", status: 409 });
  const accepted = await redis(["SET", key, "pending", "NX", "EX", 86400]);
  if (!accepted) throw Object.assign(new Error("Команда восстановления уже была принята."), { code: "duplicate_command", status: 409 });
  try {
    const response = await executeRecovery({ actor, body });
    const stored = { ...response, detail: undefined };
    await redis(["SET", key, JSON.stringify(stored), "EX", 86400]);
    return response;
  } catch (error) {
    await redis(["DEL", key]).catch(() => {});
    throw error;
  }
}
