const CAMPAIGN_CHAPTER_SIZE = 10;
const MAX_LEVEL = 10000;
const MAX_TRANSACTIONS = 3000;

const int = (value, min = 0, max = Number.MAX_SAFE_INTEGER) => {
  const n = Math.trunc(Number(value));
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : min;
};
const clone = (value) => {
  try { return JSON.parse(JSON.stringify(value)); } catch { return null; }
};
const object = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {};

export function cleanCanonicalStars(input = {}) {
  const out = {};
  for (const [rawLevel, rawStars] of Object.entries(object(input))) {
    const level = int(rawLevel, 1, MAX_LEVEL);
    const stars = int(rawStars, 0, 3);
    if (level >= 1 && stars >= 1) out[level] = stars;
  }
  return out;
}

function mergeStars(...sources) {
  const out = {};
  for (const source of sources) {
    for (const [level, stars] of Object.entries(cleanCanonicalStars(source))) {
      out[level] = Math.max(int(out[level], 0, 3), int(stars, 0, 3));
    }
  }
  return out;
}

function normalizeTransaction(raw) {
  if (typeof raw === "number") return { version: 1, xpDelta: int(raw, 0, 1_000_000_000) };
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const out = {
    version: Math.max(2, int(raw.version, 2, 10)),
    type: String(raw.type || "completion").slice(0, 32),
    mode: String(raw.mode || "unknown").slice(0, 32),
    campaign: raw.campaign === true,
    level: int(raw.level, 0, MAX_LEVEL),
    stars: int(raw.stars, 0, 3),
    xpDelta: int(raw.xpDelta, 0, 1_000_000_000),
    at: int(raw.at, 0, 9_999_999_999_999),
    gameDayId: /^\d{4}-\d{2}-\d{2}$/.test(String(raw.gameDayId || "")) ? String(raw.gameDayId) : "",
  };
  return out;
}

function mergeTransactionValue(left, right) {
  const a = normalizeTransaction(left);
  const b = normalizeTransaction(right);
  if (!a) return b;
  if (!b) return a;
  return {
    version: Math.max(int(a.version), int(b.version)),
    type: b.type !== "completion" && a.type === "completion" ? b.type : a.type || b.type,
    mode: a.mode !== "unknown" ? a.mode : b.mode,
    campaign: !!a.campaign || !!b.campaign,
    level: Math.max(int(a.level), int(b.level)),
    stars: Math.max(int(a.stars, 0, 3), int(b.stars, 0, 3)),
    xpDelta: Math.max(int(a.xpDelta), int(b.xpDelta)),
    at: Math.max(int(a.at), int(b.at)),
    gameDayId: a.gameDayId || b.gameDayId,
  };
}

export function mergeCompletionTransactions(...sources) {
  const out = {};
  for (const source of sources) {
    for (const [id, raw] of Object.entries(object(source))) {
      const key = String(id || "").replace(/[^a-zA-Z0-9_.:-]/g, "").slice(0, 120);
      if (!key) continue;
      out[key] = mergeTransactionValue(out[key], raw);
    }
  }
  const entries = Object.entries(out);
  if (entries.length <= MAX_TRANSACTIONS) return out;
  return Object.fromEntries(entries
    .sort((a, b) => int(b[1]?.at) - int(a[1]?.at))
    .slice(0, MAX_TRANSACTIONS));
}

function highestStarLevel(stars) {
  return Math.max(0, ...Object.keys(stars || {}).map(Number).filter(Number.isFinite));
}

function highestRecordedLevel(profile = {}) {
  return Math.max(0, ...Object.entries(object(profile.levelRecords))
    .filter(([key, record]) => Number(key) >= 1 && (Number(record?.stars) > 0 || Number(record?.moves) > 0 || Number(record?.timeMs) > 0))
    .map(([key]) => int(key, 0, MAX_LEVEL)));
}

function highestTransactionLevel(transactions = {}) {
  let highest = 0;
  for (const tx of Object.values(transactions)) {
    if (tx?.campaign && tx?.type === "completion") highest = Math.max(highest, int(tx.level, 0, MAX_LEVEL));
  }
  return highest;
}

function explicitCompleted(profile = {}) {
  return Math.max(
    int(profile?.stats?.levelsCompleted, 0, MAX_LEVEL),
    int(profile?.currentLevel, 1, MAX_LEVEL + 1) - 1,
    int(profile?.campaignProgressFloor, 0, MAX_LEVEL),
    highestStarLevel(cleanCanonicalStars(profile?.starsByLevel)),
    highestRecordedLevel(profile),
  );
}

function minPositive(...values) {
  const positive = values.map(Number).filter((value) => Number.isFinite(value) && value > 0);
  return positive.length ? Math.min(...positive) : 0;
}

function mergeLevelRecords(current = {}, incoming = {}, merged = {}) {
  const out = clone(object(merged)) || {};
  const keys = new Set([...Object.keys(object(current)), ...Object.keys(object(incoming)), ...Object.keys(out)]);
  for (const key of keys) {
    const a = object(current?.[key]);
    const b = object(incoming?.[key]);
    const m = object(out?.[key]);
    if (!Object.keys(a).length && !Object.keys(b).length && !Object.keys(m).length) continue;
    const row = { ...m, ...a, ...b };
    const stars = Math.max(int(a.stars, 0, 3), int(b.stars, 0, 3), int(m.stars, 0, 3));
    if (stars) row.stars = stars;
    const moves = minPositive(a.moves, b.moves, m.moves);
    if (moves) row.moves = moves;
    const timeMs = minPositive(a.timeMs, b.timeMs, m.timeMs, a.bestTimeMs, b.bestTimeMs, m.bestTimeMs);
    if (timeMs) row.timeMs = timeMs;
    row.at = Math.max(int(a.at), int(b.at), int(m.at));
    out[key] = row;
  }
  return out;
}

function fixLowerIsBetter(current, incoming, merged) {
  const modeStats = { ...object(merged.modeStats) };
  const currentModes = object(current.modeStats);
  const incomingModes = object(incoming.modeStats);

  const time = { ...object(modeStats.time) };
  const bestTimeMs = minPositive(currentModes.time?.bestTimeMs, incomingModes.time?.bestTimeMs, time.bestTimeMs);
  if (bestTimeMs) time.bestTimeMs = bestTimeMs;
  if (Object.keys(time).length) modeStats.time = time;

  const moves = { ...object(modeStats.moves) };
  const bestMoves = minPositive(currentModes.moves?.bestMoves, incomingModes.moves?.bestMoves, moves.bestMoves);
  if (bestMoves) moves.bestMoves = bestMoves;
  if (Object.keys(moves).length) modeStats.moves = moves;

  merged.modeStats = modeStats;
  merged.levelRecords = mergeLevelRecords(current.levelRecords, incoming.levelRecords, merged.levelRecords);
}

function reconcileXp(current, incoming, merged, transactions) {
  const bases = [current?.completionLedgerBase, incoming?.completionLedgerBase, merged?.completionLedgerBase]
    .map(Number).filter((value) => Number.isFinite(value) && value >= 0);
  if (bases.length) merged.completionLedgerBase = Math.min(...bases);
  const base = bases.length ? Math.min(...bases) : 0;
  let ledgerXp = base;
  for (const tx of Object.values(transactions)) ledgerXp += int(tx?.xpDelta, 0, 1_000_000_000);
  merged.xp = Math.max(
    int(current?.xp, 0, 1_000_000_000),
    int(incoming?.xp, 0, 1_000_000_000),
    int(merged?.xp, 0, 1_000_000_000),
    int(ledgerXp, 0, 1_000_000_000),
  );
}

export function mergeCanonicalProfile(current = {}, incoming = {}, merged = {}) {
  const out = clone(object(merged)) || {};
  const transactions = mergeCompletionTransactions(current.completionTransactions, incoming.completionTransactions, out.completionTransactions);
  const stars = mergeStars(current.starsByLevel, incoming.starsByLevel);

  for (const tx of Object.values(transactions)) {
    if (tx?.campaign && tx?.type === "completion" && tx.level >= 1 && tx.stars >= 1) {
      stars[tx.level] = Math.max(int(stars[tx.level], 0, 3), int(tx.stars, 1, 3));
    }
  }

  const completed = Math.max(
    explicitCompleted(current),
    explicitCompleted(incoming),
    highestStarLevel(stars),
    highestTransactionLevel(transactions),
  );
  const totalStars = Object.values(stars).reduce((sum, value) => sum + int(value, 0, 3), 0);

  out.starsByLevel = stars;
  out.totalStars = totalStars;
  out.currentLevel = Math.max(1, completed + 1);
  out.stats = { ...object(out.stats) };
  out.stats.levelsCompleted = completed;
  out.stats.chapterFinalsCompleted = Math.max(
    int(current?.stats?.chapterFinalsCompleted),
    int(incoming?.stats?.chapterFinalsCompleted),
    Math.floor(completed / CAMPAIGN_CHAPTER_SIZE),
  );
  out.stats.tripleStarWins = Object.values(stars).filter((value) => int(value, 0, 3) === 3).length;
  out.campaignProgressFloor = completed;
  out.campaignProgressVersion = Math.max(3, int(current.campaignProgressVersion), int(incoming.campaignProgressVersion), int(out.campaignProgressVersion));
  out.canonicalProgressVersion = 1;
  out.completionTransactionsVersion = 2;
  out.completionTransactions = transactions;

  reconcileXp(current, incoming, out, transactions);
  fixLowerIsBetter(current, incoming, out);
  out.cosmeticStarsPeak = Math.max(int(out.cosmeticStarsPeak), totalStars + int(out.dailyStarTotal));
  return out;
}

export function normalizeCanonicalProfile(profile = {}) {
  return mergeCanonicalProfile({}, profile, profile);
}

export function canonicalProfileNeedsNormalization(profile = {}) {
  if (int(profile.canonicalProgressVersion) < 1) return true;
  const stars = cleanCanonicalStars(profile.starsByLevel);
  const totalStars = Object.values(stars).reduce((sum, value) => sum + int(value, 0, 3), 0);
  if (int(profile.totalStars) !== totalStars) return true;
  const completed = Math.max(explicitCompleted(profile), highestTransactionLevel(mergeCompletionTransactions(profile.completionTransactions)));
  if (int(profile.stats?.levelsCompleted) !== completed) return true;
  if (int(profile.currentLevel, 1, MAX_LEVEL + 1) !== completed + 1) return true;
  if (int(profile.stats?.tripleStarWins) !== Object.values(stars).filter((value) => int(value, 0, 3) === 3).length) return true;
  return false;
}
