const MAX_LEVEL = 10000;
const MAX_STREAM_ACKS = 128;
const MAX_EVENT_BATCH = 100;

const int = (value, min = 0, max = Number.MAX_SAFE_INTEGER) => {
  const n = Math.trunc(Number(value));
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : min;
};
const object = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {};
const safeToken = (value, max = 120) => String(value || "").replace(/[^a-zA-Z0-9_.:-]/g, "").slice(0, max);
const clone = (value) => {
  try { return JSON.parse(JSON.stringify(value)); } catch { return {}; }
};

export function normalizePendingEvent(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const streamId = safeToken(raw.streamId, 48);
  const sequenceNo = int(raw.sequenceNo, 1, 1_000_000_000);
  const eventId = safeToken(raw.eventId || `${streamId}:${sequenceNo}`, 120);
  const eventType = safeToken(raw.eventType || "", 32);
  if (!streamId || !sequenceNo || !eventId || !eventType) return null;
  return {
    schemaVersion: int(raw.schemaVersion, 1, 10) || 1,
    eventId,
    streamId,
    sequenceNo,
    idempotencyKey: safeToken(raw.idempotencyKey || eventId, 120) || eventId,
    eventType,
    owner: safeToken(raw.owner, 64),
    occurredAt: int(raw.occurredAt, 0, 9_999_999_999_999),
    source: safeToken(raw.source || "game", 32),
    transactionId: safeToken(raw.transactionId, 120),
    payload: clone(object(raw.payload)),
  };
}

function normalizeAckMap(raw) {
  const entries = [];
  for (const [streamIdRaw, value] of Object.entries(object(raw))) {
    const streamId = safeToken(streamIdRaw, 48);
    if (!streamId) continue;
    if (typeof value === "number") entries.push([streamId, { sequenceNo: int(value, 0, 1_000_000_000), at: 0 }]);
    else entries.push([streamId, {
      sequenceNo: int(value?.sequenceNo, 0, 1_000_000_000),
      at: int(value?.at, 0, 9_999_999_999_999),
    }]);
  }
  return Object.fromEntries(entries
    .sort((a, b) => b[1].at - a[1].at)
    .slice(0, MAX_STREAM_ACKS));
}

function cleanStars(input) {
  const out = {};
  for (const [levelRaw, starsRaw] of Object.entries(object(input))) {
    const level = int(levelRaw, 1, MAX_LEVEL);
    const stars = int(starsRaw, 0, 3);
    if (level >= 1 && stars >= 1) out[level] = stars;
  }
  return out;
}

function minPositive(a, b) {
  const values = [a, b].map(Number).filter((value) => Number.isFinite(value) && value > 0);
  return values.length ? Math.min(...values) : 0;
}

function applyCompletion(profile, payload) {
  const xpDelta = int(payload?.xpDelta, 0, 1_000_000);
  profile.xp = int(profile.xp, 0, 1_000_000_000) + xpDelta;

  if (payload?.campaign === true) {
    const level = int(payload.level, 1, MAX_LEVEL);
    const stars = int(payload.stars, 0, 3);
    if (level >= 1) {
      const starMap = cleanStars(profile.starsByLevel);
      if (stars >= 1) starMap[level] = Math.max(int(starMap[level], 0, 3), stars);
      profile.starsByLevel = starMap;
      profile.currentLevel = Math.max(int(profile.currentLevel, 1, MAX_LEVEL + 1), level + 1);
      profile.campaignProgressFloor = Math.max(int(profile.campaignProgressFloor, 0, MAX_LEVEL), level);
      profile.stats = { ...object(profile.stats) };
      profile.stats.levelsCompleted = Math.max(int(profile.stats.levelsCompleted, 0, MAX_LEVEL), level);
      profile.stats.chapterFinalsCompleted = Math.max(int(profile.stats.chapterFinalsCompleted), Math.floor(level / 10));
      profile.stats.tripleStarWins = Object.values(starMap).filter((value) => int(value, 0, 3) === 3).length;
      profile.totalStars = Object.values(starMap).reduce((sum, value) => sum + int(value, 0, 3), 0);
      profile.campaignProgressVersion = Math.max(3, int(profile.campaignProgressVersion));
      profile.canonicalProgressVersion = 1;

      const moves = int(payload.moves, 0, 1_000_000);
      const durationMs = int(payload.durationMs, 0, 86_400_000);
      profile.levelRecords = { ...object(profile.levelRecords) };
      const previous = object(profile.levelRecords[level]);
      profile.levelRecords[level] = {
        ...previous,
        stars: Math.max(int(previous.stars, 0, 3), stars),
        moves: minPositive(previous.moves, moves) || undefined,
        timeMs: minPositive(previous.timeMs, durationMs) || undefined,
        at: Math.max(int(previous.at), int(payload.at), Date.now()),
      };
      if (profile.levelRecords[level].moves == null) delete profile.levelRecords[level].moves;
      if (profile.levelRecords[level].timeMs == null) delete profile.levelRecords[level].timeMs;
    }
  }
  profile.cosmeticStarsPeak = Math.max(int(profile.cosmeticStarsPeak), int(profile.totalStars) + int(profile.dailyStarTotal));
}

function applyEvent(profile, event) {
  if (event.eventType === "completion") applyCompletion(profile, event.payload);
}

export function applyPendingEvents(profileInput = {}, eventsInput = [], { userId = "", now = Date.now() } = {}) {
  const profile = clone(object(profileInput));
  const expectedOwner = safeToken(userId, 64);
  const normalized = (Array.isArray(eventsInput) ? eventsInput : [])
    .slice(0, MAX_EVENT_BATCH)
    .map(normalizePendingEvent)
    .filter(Boolean)
    .filter((event) => !event.owner || !expectedOwner || event.owner === expectedOwner);
  const acks = normalizeAckMap(profile.pendingEventAcks);
  const ackedEventIds = [];
  const blocked = [];

  const streams = new Map();
  for (const event of normalized) {
    if (!streams.has(event.streamId)) streams.set(event.streamId, []);
    streams.get(event.streamId).push(event);
  }

  for (const [streamId, streamEvents] of streams) {
    streamEvents.sort((a, b) => a.sequenceNo - b.sequenceNo);
    let last = int(acks[streamId]?.sequenceNo, 0, 1_000_000_000);
    for (const event of streamEvents) {
      if (event.sequenceNo <= last) {
        ackedEventIds.push(event.eventId);
        continue;
      }
      if (event.sequenceNo !== last + 1) {
        blocked.push({ streamId, expectedSequenceNo: last + 1, receivedSequenceNo: event.sequenceNo });
        break;
      }
      applyEvent(profile, event);
      last = event.sequenceNo;
      ackedEventIds.push(event.eventId);
    }
    if (last > int(acks[streamId]?.sequenceNo)) acks[streamId] = { sequenceNo: last, at: int(now, 0, 9_999_999_999_999) };
  }

  profile.pendingEventAcks = normalizeAckMap(acks);
  return { profile, ackedEventIds: [...new Set(ackedEventIds)], blocked };
}
