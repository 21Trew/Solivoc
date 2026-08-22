/* Conflict-aware cloud merge for mascot, elemental and god progression. */
const ENTITY_STATUS = Object.freeze({ locked: 0, encountered: 1, captured: 2, companion: 3, mastered: 4 });
const GOD_STATUS = Object.freeze({ locked: 0, encountered: 1, recognized: 2, worshipped: 3, exalted: 4 });
const MILESTONE_STATUS = Object.freeze({ locked: 0, available: 1, completed: 2 });

function obj(value) { return value && typeof value === "object" && !Array.isArray(value) ? value : {}; }
function copy(value) { try { return JSON.parse(JSON.stringify(value)); } catch { return {}; } }
function n(value, max = Number.MAX_SAFE_INTEGER) { return Math.max(0, Math.min(max, Math.trunc(Number(value) || 0))); }
function ts(value) { return Math.max(0, Number(value) || 0); }
function id(value) { return String(value || "").trim().replace(/[^a-zA-Z0-9:_-]/g, "").slice(0, 64); }
function uniqueIds(value, limit) {
  const out = [];
  for (const item of Array.isArray(value) ? value : []) {
    const clean = id(item);
    if (clean && !out.includes(clean)) out.push(clean);
    if (out.length >= limit) break;
  }
  return out;
}
function traits(value) {
  const out = [];
  for (const item of Array.isArray(value) ? value : []) {
    const clean = String(item || "").trim().slice(0, 32);
    if (clean && !out.includes(clean)) out.push(clean);
    if (out.length >= 2) break;
  }
  return out;
}
function status(a, b, order) {
  const aa = Object.prototype.hasOwnProperty.call(order, a) ? a : "locked";
  const bb = Object.prototype.hasOwnProperty.call(order, b) ? b : "locked";
  return order[aa] >= order[bb] ? aa : bb;
}
function newer(aValue, bValue, key = "updatedAt") {
  const a = obj(aValue), b = obj(bValue);
  return ts(a[key]) > ts(b[key]) ? a : b;
}
function union(a, b, limit) { return uniqueIds([...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])], limit); }
function mergeLevelMap(aValue, bValue) {
  const out = {};
  for (const [key, value] of Object.entries(obj(aValue))) { const clean = id(key); if (clean) out[clean] = n(value, 10); }
  for (const [key, value] of Object.entries(obj(bValue))) { const clean = id(key); if (clean) out[clean] = Math.max(out[clean] || 0, n(value, 10)); }
  return out;
}
function mergeCountMap(aValue, bValue) {
  const out = {};
  for (const [key, value] of Object.entries(obj(aValue))) { const clean = id(key); if (clean) out[clean] = n(value); }
  for (const [key, value] of Object.entries(obj(bValue))) { const clean = id(key); if (clean) out[clean] = Math.max(out[clean] || 0, n(value)); }
  return out;
}
function safeOpaqueMerge(aValue, bValue) {
  const a = obj(aValue), b = obj(bValue);
  const preferred = ts(a.updatedAt) > ts(b.updatedAt) ? a : b;
  const fallback = preferred === a ? b : a;
  return copy({ ...fallback, ...preferred });
}

function mergeMascotEntry(aValue, bValue) {
  const a = obj(aValue), b = obj(bValue);
  const traitSource = newer(a, b, "traitsUpdatedAt");
  const loadoutSource = newer(a.equippedAbilities, b.equippedAbilities);
  const evolutionSource = newer(a, b, "evolutionUpdatedAt");
  const captured = [ts(a.capturedAt), ts(b.capturedAt)].filter(Boolean);
  const type = ["mascot", "elemental", "special"].includes(String(b.type)) ? String(b.type)
    : ["mascot", "elemental", "special"].includes(String(a.type)) ? String(a.type) : "mascot";
  return {
    ...safeOpaqueMerge(a, b),
    version: Math.max(1, n(a.version, 100), n(b.version, 100)),
    type,
    status: status(a.status, b.status, ENTITY_STATUS),
    level: Math.max(n(a.level, 10), n(b.level, 10)),
    progressXp: Math.max(n(a.progressXp), n(b.progressXp)),
    evolutionStage: Math.max(n(a.evolutionStage, 10), n(b.evolutionStage, 10)),
    evolutionBranch: id(evolutionSource.evolutionBranch),
    evolutionUpdatedAt: Math.max(ts(a.evolutionUpdatedAt), ts(b.evolutionUpdatedAt)),
    developedTraits: traits(traitSource.developedTraits),
    traitsUpdatedAt: Math.max(ts(a.traitsUpdatedAt), ts(b.traitsUpdatedAt)),
    abilities: mergeLevelMap(a.abilities, b.abilities),
    equippedAbilities: {
      active: uniqueIds(loadoutSource.active, 2),
      passive: id(loadoutSource.passive),
      updatedAt: Math.max(ts(obj(a.equippedAbilities).updatedAt), ts(obj(b.equippedAbilities).updatedAt)),
    },
    trainingLevel: Math.max(n(a.trainingLevel, 3), n(b.trainingLevel, 3)),
    completedQuests: union(a.completedQuests, b.completedQuests, 200),
    cosmeticsUnlocked: union(a.cosmeticsUnlocked, b.cosmeticsUnlocked, 100),
    capturedAt: captured.length ? Math.min(...captured) : 0,
    updatedAt: Math.max(ts(a.updatedAt), ts(b.updatedAt)),
  };
}
function mergeGodEntry(aValue, bValue) {
  const a = obj(aValue), b = obj(bValue);
  const loadoutSource = newer(a, b, "loadoutUpdatedAt");
  const attentionSource = newer(a, b, "attentionUpdatedAt");
  return {
    ...safeOpaqueMerge(a, b),
    version: Math.max(1, n(a.version, 100), n(b.version, 100)),
    type: "god",
    status: status(a.status, b.status, GOD_STATUS),
    favorLevel: Math.max(n(a.favorLevel, 10), n(b.favorLevel, 10)),
    favorXp: Math.max(n(a.favorXp), n(b.favorXp)),
    gracesUnlocked: union(a.gracesUnlocked, b.gracesUnlocked, 50),
    activeGraceIds: uniqueIds(loadoutSource.activeGraceIds, 3),
    loadoutUpdatedAt: Math.max(ts(a.loadoutUpdatedAt), ts(b.loadoutUpdatedAt)),
    attention: n(attentionSource.attention),
    attentionUpdatedAt: Math.max(ts(a.attentionUpdatedAt), ts(b.attentionUpdatedAt)),
    offerings: mergeCountMap(a.offerings, b.offerings),
    updatedAt: Math.max(ts(a.updatedAt), ts(b.updatedAt)),
  };
}
function mergeDomain(aValue, bValue, entryMerge) {
  const a = obj(aValue), b = obj(bValue), out = {};
  for (const rawId of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const cleanId = id(rawId);
    if (!cleanId) continue;
    out[cleanId] = entryMerge(a[rawId], b[rawId]);
  }
  return out;
}
function mergeMilestones(aValue, bValue) {
  const a = obj(aValue), b = obj(bValue), out = {};
  for (const rawLevel of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const level = n(rawLevel, 1000000);
    if (!level) continue;
    const aa = obj(a[rawLevel]), bb = obj(b[rawLevel]);
    const preferred = newer(aa, bb);
    const inferredType = level % 1000 === 0 ? "god" : level % 100 === 0 ? "elemental" : "";
    out[level] = {
      ...safeOpaqueMerge(aa, bb),
      type: ["god", "elemental"].includes(preferred.type) ? preferred.type : inferredType,
      entityId: id(preferred.entityId || aa.entityId || bb.entityId),
      status: status(aa.status, bb.status, MILESTONE_STATUS),
      updatedAt: Math.max(ts(aa.updatedAt), ts(bb.updatedAt)),
    };
  }
  return out;
}

export function mergeEntityProgressDomains(currentProfile, incomingProfile) {
  const current = obj(currentProfile), incoming = obj(incomingProfile);
  return {
    mascotProgress: mergeDomain(current.mascotProgress, incoming.mascotProgress, mergeMascotEntry),
    godProgress: mergeDomain(current.godProgress, incoming.godProgress, mergeGodEntry),
    progressionMilestones: mergeMilestones(current.progressionMilestones, incoming.progressionMilestones),
  };
}
