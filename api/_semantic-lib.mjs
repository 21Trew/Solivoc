import { randomUUID } from "node:crypto";
import { redis, redisKey } from "./_push-lib.mjs";

const PREFIX = "worditaire:narrative:v1";
const COMMAND_TTL_SECONDS = 60 * 60 * 24 * 30;
const MAX_EVENTS_PER_COMMAND = 32;
const MAX_PAYLOAD_BYTES = 24000;

const EVENT_KEYS = new Set([
  "FOREST_LEVEL_STARTED",
  "FOREST_LEVEL_COMPLETED",
  "FOREST_CHOICE_SELECTED",
  "FOREST_WORLD_FACT_EXPOSED",
  "FOREST_WORLD_EVENT_OCCURRED",
  "FOREST_OBSERVATION_CREATED",
  "FOREST_OBSERVATION_UPDATED",
  "FOREST_INTERPRETATION_ADDED",
  "FOREST_INTERPRETATION_REVISED",
  "FOREST_KNOWLEDGE_CONFIRMED",
  "FOREST_KNOWLEDGE_LINKED",
  "FOREST_KNOWLEDGE_REVELATION_READY",
  "FOREST_KNOWLEDGE_REVELATION_STARTED",
  "FOREST_KNOWLEDGE_REVELATION_COMPLETED",
  "FOREST_RECONSTRUCTION_CREATED",
  "FOREST_RECONSTRUCTION_REVISED",
  "FOREST_RECONSTRUCTION_CONFIRMED",
  "FOREST_ENCOUNTER_STARTED",
  "FOREST_ENCOUNTER_COMPLETED",
  "FOREST_RELATIONSHIP_MILESTONE",
  "FOREST_TEMPORARY_ALLIANCE_STARTED",
  "FOREST_TEMPORARY_ALLIANCE_COMPLETED",
  "FOREST_RELATIONSHIP_SYNTHESIS_COMPLETED",
  "FOREST_COMPANION_ACQUIRED",
  "FOREST_THREAD_OPENED",
  "FOREST_THREAD_STATE_CHANGED",
  "FOREST_REVISIT_STARTED",
  "FOREST_REVISIT_COMPLETED",
  "FOREST_SYNTHESIS_STARTED",
  "FOREST_SYNTHESIS_PHASE_COMPLETED",
  "FOREST_SYNTHESIS_MODEL_SOLVED",
  "FOREST_SYNTHESIS_COMPLETED",
  "FOREST_ELEMENTAL_STAGE_CHANGED",
  "FOREST_CONTENT_MIGRATION_APPLIED",
  "FOREST_STATE_REPAIR_APPLIED",
]);

const cleanId = (value, max = 120) => String(value || "").replace(/[^a-zA-Z0-9_.:-]/g, "_").slice(0, max);
const cleanUserId = (value) => String(value || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
const cleanWorldId = (value) => cleanId(value, 40).toLowerCase();
const cleanEventKey = (value) => String(value || "").trim().toUpperCase().replace(/[^A-Z0-9_]/g, "_").slice(0, 96);
const clone = (value) => { try { return JSON.parse(JSON.stringify(value)); } catch { return null; } };

export function semanticKeys(userIdValue) {
  const userId = cleanUserId(userIdValue);
  return {
    sequence: `${PREFIX}:seq:${userId}`,
    events: `${PREFIX}:events:${userId}`,
    projection: (worldId = "forest") => `${PREFIX}:projection:${userId}:${cleanWorldId(worldId)}`,
    projectionVersion: (worldId = "forest") => `${PREFIX}:projection-version:${userId}:${cleanWorldId(worldId)}`,
    command: (commandId) => `${PREFIX}:command:${userId}:${cleanId(commandId, 96)}`,
    eventGuardPrefix: `${PREFIX}:event-key:${userId}:`,
  };
}

export function normalizeSemanticCommand(userIdValue, input = {}) {
  const userId = cleanUserId(userIdValue);
  const commandId = cleanId(input.commandId, 96);
  const transactionId = cleanId(input.transactionId || commandId, 96);
  const worldId = cleanWorldId(input.worldId || "forest");
  const rawEvents = Array.isArray(input.events) ? input.events : [];
  if (!userId || !commandId || !transactionId) throw Object.assign(new Error("invalid_command"), { code: "invalid_command", status: 400 });
  if (worldId !== "forest") throw Object.assign(new Error("unsupported_world"), { code: "unsupported_world", status: 400 });
  if (!rawEvents.length || rawEvents.length > MAX_EVENTS_PER_COMMAND) throw Object.assign(new Error("invalid_event_count"), { code: "invalid_event_count", status: 400 });

  const events = rawEvents.map((raw) => {
    const eventKey = cleanEventKey(raw?.eventKey);
    if (!EVENT_KEYS.has(eventKey)) throw Object.assign(new Error("invalid_event_key"), { code: "invalid_event_key", status: 400 });
    const semanticScope = cleanId(raw?.semanticScope, 160);
    if (!semanticScope) throw Object.assign(new Error("missing_semantic_scope"), { code: "missing_semantic_scope", status: 400 });
    const payload = clone(raw?.payload ?? {}) ?? {};
    if (Buffer.byteLength(JSON.stringify(payload), "utf8") > MAX_PAYLOAD_BYTES) throw Object.assign(new Error("payload_too_large"), { code: "payload_too_large", status: 413 });
    const tags = [...new Set((Array.isArray(raw?.semanticTags) ? raw.semanticTags : []).map((value) => cleanId(value, 80)).filter(Boolean))].slice(0, 32);
    const canonVersion = clone(raw?.canonVersion || {}) || {};
    return {
      event_id: randomUUID(),
      event_key: eventKey,
      player_id: userId,
      world_id: worldId,
      area_id: raw?.areaId ? cleanId(raw.areaId, 96) : null,
      chapter_id: Number.isFinite(Number(raw?.chapterId)) ? Math.max(0, Math.trunc(Number(raw.chapterId))) : null,
      level_id: Number.isFinite(Number(raw?.levelId)) ? Math.max(0, Math.trunc(Number(raw.levelId))) : null,
      scene_id: raw?.sceneId ? cleanId(raw.sceneId, 160) : null,
      sequence_no: 0,
      command_id: commandId,
      transaction_id: transactionId,
      idempotency_key: `${eventKey}|${semanticScope}`,
      payload,
      semantic_tags: tags,
      canon_version: canonVersion,
      occurred_at: raw?.occurredAt ? String(raw.occurredAt).slice(0, 40) : null,
      recorded_at: null,
      origin: "server",
    };
  });
  return { userId, commandId, transactionId, worldId, events };
}

const APPEND_SCRIPT = String.raw`
local cached = redis.call('GET', KEYS[3])
if cached then return cached end
local seq = tonumber(redis.call('GET', KEYS[1]) or '0')
local recordedAt = ARGV[1]
local guardPrefix = ARGV[2]
local accepted = {}
local duplicates = {}
for i = 3, #ARGV do
  local event = cjson.decode(ARGV[i])
  local guardKey = guardPrefix .. event['idempotency_key']
  local existingEventId = redis.call('GET', guardKey)
  if existingEventId then
    duplicates[#duplicates + 1] = {
      event_key = event['event_key'],
      idempotency_key = event['idempotency_key'],
      existing_event_id = existingEventId
    }
  else
    seq = seq + 1
    event['sequence_no'] = seq
    event['recorded_at'] = recordedAt
    local encoded = cjson.encode(event)
    redis.call('RPUSH', KEYS[2], encoded)
    redis.call('SET', guardKey, event['event_id'])
    accepted[#accepted + 1] = event
  end
end
redis.call('SET', KEYS[1], tostring(seq))
local result = cjson.encode({ ok = true, accepted = accepted, duplicates = duplicates, last_sequence = seq, replayed = false })
redis.call('SET', KEYS[3], result, 'EX', '${COMMAND_TTL_SECONDS}')
return result
`;

export async function appendSemanticCommand(command) {
  const keys = semanticKeys(command.userId);
  const commandKey = keys.command(command.commandId);
  const cached = await redis(["GET", commandKey]);
  if (cached) {
    const result = JSON.parse(cached);
    result.replayed = true;
    return result;
  }
  const recordedAt = new Date().toISOString();
  // EVAL keeps sequence assignment, semantic deduplication, append and command idempotency atomic.
  // The Lua script also constructs event guard keys internally, so pass a
  // fully namespaced guard prefix rather than relying only on KEYS[] rewriting.
  const raw = await redis([
    "EVAL", APPEND_SCRIPT, "3", keys.sequence, keys.events, commandKey,
    recordedAt, redisKey(keys.eventGuardPrefix), ...command.events.map((event) => JSON.stringify(event)),
  ]);
  return JSON.parse(raw);
}

export async function readSemanticEvents(userIdValue, { after = 0, limit = 100 } = {}) {
  const keys = semanticKeys(userIdValue);
  const start = Math.max(0, Math.trunc(Number(after) || 0));
  const count = Math.max(1, Math.min(250, Math.trunc(Number(limit) || 100)));
  const [rows, lastSequence] = await Promise.all([
    redis(["LRANGE", keys.events, String(start), String(start + count - 1)]),
    redis(["GET", keys.sequence]),
  ]);
  return {
    events: (Array.isArray(rows) ? rows : []).map((raw) => { try { return JSON.parse(raw); } catch { return null; } }).filter(Boolean),
    lastSequence: Math.max(0, Number(lastSequence) || 0),
  };
}

export async function readSemanticProjection(userIdValue, worldId = "forest") {
  const keys = semanticKeys(userIdValue);
  const [raw, version] = await Promise.all([
    redis(["GET", keys.projection(worldId)]),
    redis(["GET", keys.projectionVersion(worldId)]),
  ]);
  let projection = null;
  try { projection = raw ? JSON.parse(raw) : null; } catch {}
  return { projection, version: Math.max(0, Number(version) || 0) };
}

async function scanKeys(pattern, limit = 5000) {
  let cursor = "0", out = [];
  do {
    const result = await redis(["SCAN", cursor, "MATCH", pattern, "COUNT", 200]);
    cursor = String(result?.[0] ?? "0");
    if (Array.isArray(result?.[1])) out.push(...result[1]);
  } while (cursor !== "0" && out.length < limit);
  return out.slice(0, limit);
}

export async function purgeSemanticData(userIdValue) {
  const keys = semanticKeys(userIdValue);
  const userId = cleanUserId(userIdValue);
  if (!userId) return 0;
  const [commandKeys, eventGuardKeys] = await Promise.all([
    scanKeys(`${PREFIX}:command:${userId}:*`),
    scanKeys(`${PREFIX}:event-key:${userId}:*`),
  ]);
  const fixed = [keys.sequence, keys.events, keys.projection("forest"), keys.projectionVersion("forest")];
  const all = [...new Set([...fixed, ...commandKeys, ...eventGuardKeys])];
  for (let i = 0; i < all.length; i += 80) await redis(["DEL", ...all.slice(i, i + 80)]);
  return all.length;
}
