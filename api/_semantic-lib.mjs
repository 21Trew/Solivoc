import { randomUUID } from "node:crypto";
import { redis } from "./_push-lib.mjs";

const PREFIX = "worditaire:narrative:v1";
const COMMAND_TTL_SECONDS = 60 * 60 * 24 * 30;
const MAX_EVENTS_PER_COMMAND = 32;
const MAX_PAYLOAD_BYTES = 24000;

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

  const events = rawEvents.map((raw, index) => {
    const eventKey = cleanEventKey(raw?.eventKey);
    if (!/^FOREST_[A-Z0-9_]+$/.test(eventKey)) throw Object.assign(new Error("invalid_event_key"), { code: "invalid_event_key", status: 400 });
    const semanticScope = cleanId(raw?.semanticScope || `${eventKey}:${index}`, 160);
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
      idempotency_key: `${userId}|${eventKey}|${semanticScope}`,
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
local accepted = {}
for i = 2, #ARGV do
  local event = cjson.decode(ARGV[i])
  seq = seq + 1
  event['sequence_no'] = seq
  event['recorded_at'] = recordedAt
  local encoded = cjson.encode(event)
  redis.call('RPUSH', KEYS[2], encoded)
  accepted[#accepted + 1] = event
end
redis.call('SET', KEYS[1], tostring(seq))
local result = cjson.encode({ ok = true, accepted = accepted, last_sequence = seq, replayed = false })
redis.call('SET', KEYS[3], result, 'EX', ARGV[#ARGV + 1] or '2592000')
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
  // EVAL keeps sequence assignment, append and command idempotency inside one Redis transaction.
  const script = APPEND_SCRIPT.replace("ARGV[#ARGV + 1] or '2592000'", `'${COMMAND_TTL_SECONDS}'`);
  const raw = await redis(["EVAL", script, "3", keys.sequence, keys.events, commandKey, recordedAt, ...command.events.map((event) => JSON.stringify(event))]);
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

export async function purgeSemanticData(userIdValue) {
  const keys = semanticKeys(userIdValue);
  const userId = cleanUserId(userIdValue);
  if (!userId) return 0;
  let cursor = "0", commandKeys = [];
  do {
    const result = await redis(["SCAN", cursor, "MATCH", `${PREFIX}:command:${userId}:*`, "COUNT", 200]);
    cursor = String(result?.[0] ?? "0");
    if (Array.isArray(result?.[1])) commandKeys.push(...result[1]);
  } while (cursor !== "0" && commandKeys.length < 5000);
  const fixed = [keys.sequence, keys.events, keys.projection("forest"), keys.projectionVersion("forest")];
  const all = [...new Set([...fixed, ...commandKeys])];
  for (let i = 0; i < all.length; i += 80) await redis(["DEL", ...all.slice(i, i + 80)]);
  return all.length;
}
