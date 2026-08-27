const list = (value) => Array.isArray(value) ? value : [];
const object = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {};
const clone = (value) => { try { return JSON.parse(JSON.stringify(value)); } catch { return {}; } };

function routingRelationships(projection) {
  const relationships = clone(object(projection?.routing_snapshot?.relationships));
  for (const entry of list(projection?.encounters?.history)) {
    if (entry?.type !== "completed" || entry?.encounter_id !== "ENC_FOREST_09") continue;
    for (const characterId of list(entry?.participants)) {
      const relationship = relationships[characterId];
      if (!relationship || relationship?.milestones?.cooperation_established !== true) continue;
      relationship.narrativeCompatibility = true;
      relationship.narrative_compatibility = true;
    }
  }
  return relationships;
}

export function routingProjectionView(projection) {
  const snapshot = clone(object(projection?.routing_snapshot));
  snapshot.relationships = routingRelationships(projection);
  return {
    world_id: projection?.world_id || "forest",
    source_sequence: Math.max(0, Number(projection?.source_sequence) || 0),
    projection_version: Math.max(0, Number(projection?.projection_version) || 0),
    routing_snapshot: snapshot,
    encounters: { completed_ids: [...list(projection?.encounters?.completed_ids)] },
  };
}

export function primitiveProjectionView(projection) {
  const flags = object(projection?.world?.world_flags);
  const completedEncounterIds = list(projection?.encounters?.completed_ids);
  const elementalComplete = projection?.synthesis?.elemental_stage === "FULL_MANIFESTATION" && completedEncounterIds.includes("ENC_FOREST_11");
  return {
    ...routingProjectionView(projection),
    world: {
      highest_completed_level: Math.max(0, Number(projection?.world?.highest_completed_level) || 0),
      world_flags: {
        forest_response_occurred: flags.forest_response_occurred === true,
        forest_synthesis_complete: flags.forest_synthesis_complete === true,
        forest_elemental_encountered: flags.forest_elemental_encountered === true,
        forest_world_complete: flags.forest_world_complete === true || elementalComplete,
      },
    },
    synthesis: {
      first_companion: projection?.synthesis?.first_companion || null,
      started: projection?.synthesis?.started === true,
      phases_completed: [...list(projection?.synthesis?.phases_completed)],
      model_solved: projection?.synthesis?.model_solved === true,
      completed: projection?.synthesis?.completed === true,
      elemental_stage: projection?.synthesis?.elemental_stage || null,
    },
    revisits: { completed_ids: [...list(projection?.revisits?.completed_ids)] },
  };
}

const GROUPS = new Set(["observation", "character", "companion"]);
const CONFIDENCE = new Set(["SUSPECTED", "LIKELY", "INFERRED", "CONFIRMED"]);
const CHARACTERS = ["cat", "owl", "fox"];

function visibleKnowledgeRecords(projection) {
  const records = object(projection?.knowledge?.records);
  const exposures = object(projection?.exposure?.by_world_fact);
  return Object.values(records).flatMap((record) => {
    const group = String(record?.presentation_group || "");
    const displayStateKey = String(record?.display_state_key || "");
    if (!GROUPS.has(group) || !displayStateKey) return [];
    const sourceFacts = list(record?.source_world_fact_ids);
    const sourceScenes = [];
    for (const factId of sourceFacts) {
      const exposure = exposures[factId];
      for (const sceneId of [exposure?.first_scene_id, exposure?.last_scene_id]) {
        if (sceneId && !sourceScenes.includes(sceneId)) sourceScenes.push(sceneId);
      }
    }
    const visibility = String(record?.subject_visibility || "hidden");
    const safe = {
      knowledge_record_id: String(record?.knowledge_record_id || ""),
      record_kind: String(record?.record_kind || "observation"),
      presentation_group: group,
      display_state_key: displayStateKey,
      confidence: CONFIDENCE.has(String(record?.confidence || "")) ? String(record.confidence) : "SUSPECTED",
      subject_visibility: visibility === "revealed" ? "revealed" : "hidden",
      linked_record_count: list(record?.linked_record_ids).length,
      reconstruction_count: list(record?.reconstruction_ids).length,
      first_created_sequence: Math.max(0, Number(record?.first_created_sequence) || 0),
      last_changed_sequence: Math.max(0, Number(record?.last_changed_sequence) || 0),
      provenance: { source_count: sourceFacts.length, scene_ids: sourceScenes },
    };
    if (visibility === "revealed" && record?.subject_ref) safe.subject_ref = clone(record.subject_ref);
    return [safe];
  });
}

function relationshipUI(projection, records) {
  const source = object(projection?.relationships);
  const visibleCharacters = new Set();
  for (const record of records) {
    if (!["character", "companion"].includes(record.presentation_group)) continue;
    const match = /^(?:character|companion)\.(cat|owl|fox)$/.exec(record.display_state_key);
    if (match) visibleCharacters.add(match[1]);
  }
  const result = {};
  for (const characterId of CHARACTERS) {
    const relationship = source[characterId];
    if (!relationship) continue;
    const directFirstEncounterCharacter = ["cat", "owl"].includes(characterId) && relationship.identity_known === true && relationship.acquainted === true;
    if (!visibleCharacters.has(characterId) && !directFirstEncounterCharacter) continue;
    const milestones = object(relationship.milestones);
    result[characterId] = {
      presentation_group: milestones.companion === true ? "companion" : "character",
      acquainted: relationship.acquainted === true,
      borrowed_perspective: { seen: relationship?.borrowed_perspective?.seen === true, voluntarily_used: relationship?.borrowed_perspective?.voluntarily_used === true },
      milestones: {
        understanding_established: milestones.understanding_established === true,
        reciprocity_established: milestones.reciprocity_established === true,
        cooperation_established: milestones.cooperation_established === true,
        temporary_alliance_completed: milestones.temporary_alliance_completed === true,
        relationship_synthesis_completed: milestones.relationship_synthesis_completed === true,
        companion: milestones.companion === true,
      },
      shared_history_count: new Set([
        ...list(relationship?.evidence?.shared_history_event_ids),
        ...list(relationship?.evidence?.understanding_event_ids),
        ...list(relationship?.evidence?.reciprocity_event_ids),
        ...list(relationship?.evidence?.cooperation_event_ids),
      ]).size,
    };
  }
  return result;
}

export function knowledgeUIProjectionView(projection) {
  const records = visibleKnowledgeRecords(projection);
  return {
    world_id: projection?.world_id || "forest",
    source_sequence: Math.max(0, Number(projection?.source_sequence) || 0),
    projection_version: Math.max(0, Number(projection?.projection_version) || 0),
    knowledge: { records },
    relationships: relationshipUI(projection, records),
    synthesis: { first_companion: projection?.synthesis?.first_companion || null },
  };
}
