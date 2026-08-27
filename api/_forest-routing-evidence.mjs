const THREADS = Object.freeze({ cat:'THREAD_FOREST_CAT', owl:'THREAD_FOREST_OWL', fox:'THREAD_FOREST_FOX' });
export const QUESTION_BY_COMPLETED_VARIANT = Object.freeze({
  ENC_FOREST_04_CAT:'CAT_MEMORY_NEEDS_CURRENT_CONTEXT',
  ENC_FOREST_04_OWL:'OWL_OBSERVATION_NEEDS_CAUSAL_CONTEXT',
  ENC_FOREST_04_FOX_CONTINUATION:'FOX_ROUTE_NEEDS_VERIFICATION',
});
const list = (v) => Array.isArray(v) ? v : [];
const text = (v) => String(v ?? '').trim();
const seq = (e) => Math.max(0, Math.trunc(Number(e?.sequence_no ?? e?.sequenceNo) || 0));
const key = (e) => text(e?.event_key ?? e?.eventKey).toUpperCase();
const payload = (e) => e?.payload && typeof e.payload === 'object' && !Array.isArray(e.payload) ? e.payload : {};
const addUnique = (xs, v) => { if (v && !xs.includes(v)) xs.push(v); };

export function applyForestRoutingEvidence(projection, events = [], afterSequence = 0) {
  if (!projection || typeof projection !== 'object') return projection;
  const ordered = [...list(events)].filter((e) => seq(e) > Number(afterSequence || 0)).sort((a,b)=>seq(a)-seq(b));
  for (const event of ordered) {
    const d = payload(event);
    let openKey = text(d.openUnresolvedQuestionKey ?? d.open_unresolved_question_key);
    if (!openKey && key(event) === 'FOREST_ENCOUNTER_COMPLETED') openKey = QUESTION_BY_COMPLETED_VARIANT[text(d.variantId ?? d.variant_id)] || '';
    const resolveKey = text(d.resolveUnresolvedQuestionKey ?? d.resolve_unresolved_question_key);
    if (!openKey && !resolveKey) continue;
    const participants = list(d.participants).map((id) => text(id).toLowerCase()).filter(Boolean);
    for (const characterId of participants) {
      const threadId = THREADS[characterId];
      const thread = threadId ? projection?.threads?.[threadId] : null;
      if (!thread) continue;
      thread.unresolved_question_keys ||= [];
      if (openKey) addUnique(thread.unresolved_question_keys, openKey);
      if (resolveKey) thread.unresolved_question_keys = thread.unresolved_question_keys.filter((value) => value !== resolveKey);
      for (const routingKey of [threadId, characterId]) {
        const routed = projection?.routing_snapshot?.threads?.[routingKey];
        if (!routed) continue;
        routed.unresolvedQuestionKeys = [...thread.unresolved_question_keys];
        routed.unfinishedQuestion = thread.unresolved_question_keys.length > 0;
      }
    }
  }
  return projection;
}
