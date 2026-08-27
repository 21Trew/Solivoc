import { advanceForestProjection, projectForestEvents, PROJECTION_VERSION } from "./_forest-projection-lib.mjs";
import { readSemanticEvents, readSemanticProjection, semanticKeys } from "./_semantic-lib.mjs";
import { redis } from "./_push-lib.mjs";

const WORLD_ID = "forest";
const PAGE_SIZE = 250;

const WRITE_SCRIPT = String.raw`
local incomingSequence = tonumber(ARGV[1]) or 0
local incomingVersion = tonumber(ARGV[2]) or 0
local existingRaw = redis.call('GET', KEYS[1])
if existingRaw then
  local ok, existing = pcall(cjson.decode, existingRaw)
  if ok and existing then
    local existingSequence = tonumber(existing['source_sequence'] or 0) or 0
    local existingVersion = tonumber(existing['projection_version'] or 0) or 0
    if existingSequence > incomingSequence or (existingSequence == incomingSequence and existingVersion > incomingVersion) then
      return cjson.encode({ written = false, reason = 'newer_projection_exists', source_sequence = existingSequence, projection_version = existingVersion })
    end
  end
end
redis.call('SET', KEYS[1], ARGV[3])
redis.call('SET', KEYS[2], tostring(incomingVersion))
return cjson.encode({ written = true, source_sequence = incomingSequence, projection_version = incomingVersion })
`;

async function writeForestProjection(userId, projection) {
  const keys = semanticKeys(userId);
  const raw = await redis([
    "EVAL", WRITE_SCRIPT, "2", keys.projection(WORLD_ID), keys.projectionVersion(WORLD_ID),
    String(Number(projection?.source_sequence) || 0),
    String(Number(projection?.projection_version) || PROJECTION_VERSION),
    JSON.stringify(projection),
  ]);
  return JSON.parse(raw);
}

export async function readAllForestSemanticEvents(userId) {
  const events = [];
  let after = 0;
  let lastSequence = 0;
  for (;;) {
    const page = await readSemanticEvents(userId, { after, limit: PAGE_SIZE });
    lastSequence = Math.max(lastSequence, Number(page.lastSequence) || 0);
    if (!page.events.length) break;
    events.push(...page.events);
    const lastEventSequence = Math.max(...page.events.map((event) => Number(event.sequence_no) || 0));
    if (lastEventSequence <= after) break;
    after = lastEventSequence;
    if (after >= lastSequence) break;
  }
  return { events, lastSequence };
}

export async function rebuildForestProjection(userId) {
  const { events, lastSequence } = await readAllForestSemanticEvents(userId);
  const projection = projectForestEvents(events);
  if (projection.source_sequence !== lastSequence) {
    throw Object.assign(new Error("projection_source_sequence_mismatch"), {
      code: "projection_source_sequence_mismatch",
      projectionSequence: projection.source_sequence,
      lastSequence,
    });
  }
  const write = await writeForestProjection(userId, projection);
  if (write.written === false && Number(write.source_sequence) > projection.source_sequence) return ensureForestProjection(userId);
  return { projection, version: PROJECTION_VERSION, rebuilt: true, mode: "full", write };
}

export async function advanceForestProjectionCache(userId, acceptedEvents = []) {
  const accepted = Array.isArray(acceptedEvents) ? acceptedEvents.filter(Boolean) : [];
  if (!accepted.length) return ensureForestProjection(userId);
  const current = await readSemanticProjection(userId, WORLD_ID);
  const currentProjection = current.projection;
  const currentSequence = Number(currentProjection?.source_sequence) || 0;
  const currentVersion = Number(currentProjection?.projection_version) || 0;
  const firstAccepted = Math.min(...accepted.map((event) => Number(event.sequence_no) || 0).filter((value) => value > 0));
  if (!currentProjection || currentVersion !== PROJECTION_VERSION || firstAccepted !== currentSequence + 1) return rebuildForestProjection(userId);
  const projection = advanceForestProjection(currentProjection, accepted);
  const write = await writeForestProjection(userId, projection);
  if (write.written === false && Number(write.source_sequence) > projection.source_sequence) return ensureForestProjection(userId);
  return { projection, version: PROJECTION_VERSION, rebuilt: false, mode: "incremental", write };
}

export async function ensureForestProjection(userId) {
  const [current, head] = await Promise.all([
    readSemanticProjection(userId, WORLD_ID),
    readSemanticEvents(userId, { after: 0, limit: 1 }),
  ]);
  const sourceSequence = Number(current.projection?.source_sequence) || 0;
  const projectionVersion = Number(current.projection?.projection_version) || 0;
  const lastSequence = Number(head.lastSequence) || 0;
  if (current.projection && sourceSequence === lastSequence && projectionVersion === PROJECTION_VERSION) {
    return { projection: current.projection, version: current.version || PROJECTION_VERSION, rebuilt: false, mode: "cache" };
  }
  return rebuildForestProjection(userId);
}
