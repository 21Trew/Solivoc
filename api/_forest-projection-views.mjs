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
