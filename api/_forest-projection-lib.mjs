const VERSION = 1;
const WORLD = "forest";
const COGNITION_FORMULA = "forest-authored-evidence@1";
const PRIMARY = Object.freeze(["memory", "observation", "comparison", "verification", "intuition", "reinterpretation", "depth", "discovery"]);
const MASCOTS = new Set(["cat", "owl", "fox"]);
const THREADS = Object.freeze({ cat: "THREAD_FOREST_CAT", owl: "THREAD_FOREST_OWL", fox: "THREAD_FOREST_FOX", forest_elemental: "THREAD_FOREST_ELEMENTAL" });
const PERSPECTIVES = Object.freeze({ cat_memory_echo: "cat", owl_close_look: "owl" });
const MILESTONES = Object.freeze(["understanding_established", "reciprocity_established", "cooperation_established", "temporary_alliance_completed", "relationship_synthesis_completed", "companion"]);

const list = (v) => Array.isArray(v) ? v : [];
const object = (v) => v && typeof v === "object" && !Array.isArray(v) ? v : {};
const text = (v) => String(v ?? "").trim();
const number = (v) => Number.isFinite(Number(v)) ? Number(v) : 0;
const seq = (e) => Math.max(0, Math.trunc(Number(e?.sequence_no ?? e?.sequenceNo) || 0));
const eid = (e) => text(e?.event_id ?? e?.eventId ?? e?.idempotency_key ?? e?.idempotencyKey) || `seq:${seq(e)}`;
const key = (e) => text(e?.event_key ?? e?.eventKey).toUpperCase();
const payload = (e) => object(e?.payload);
const level = (e) => Math.max(0, Math.trunc(Number(e?.level_id ?? e?.levelId) || 0));
const scene = (e) => text(e?.scene_id ?? e?.sceneId) || null;
const addUnique = (xs, value) => { if (value != null && value !== "" && !xs.includes(value)) xs.push(value); };

function relationship(id) {
  return { character_id: id, identity_known: false, acquainted: false, narrative_compatibility: null,
    borrowed_perspective: { seen: false, forced_tutorial_used: false, voluntarily_used: false },
    milestones: Object.fromEntries(MILESTONES.map((m) => [m, false])),
    evidence: { understanding_event_ids: [], reciprocity_event_ids: [], cooperation_event_ids: [], shared_history_event_ids: [] },
    unresolved_question_keys: [], meaningful_relationship_events: 0 };
}
function thread(id, character = null) {
  return { thread_id: id, status: "dormant", identity_state: "unknown", relationship_character_id: character,
    readiness_evidence_event_ids: [], encounter_ids_completed: [], shared_history_event_ids: [],
    temporary_alliance_completed: false, companion: false, last_meaningful_sequence: 0, authored_evidence: {} };
}
function empty() {
  return { schema_version: 1, projection_version: VERSION, formula_version: { cognition: COGNITION_FORMULA }, world_id: WORLD, source_sequence: 0,
    world: { world_id: WORLD, campaign_phase: "chapter_1", highest_started_level: 0, highest_completed_level: 0,
      world_flags: { forest_response_occurred: false, forest_synthesis_complete: false, forest_elemental_encountered: false },
      levels: {}, area_states: {}, path_states: {}, persistent_consequences: [], expired_event_ids: [], occurred_world_events: {} },
    exposure: { by_world_fact: {} }, knowledge: { records: {}, links: [], reconstructions: {}, revelation_transitions: {} },
    relationships: { cat: relationship("cat"), owl: relationship("owl"), fox: relationship("fox") },
    threads: { THREAD_FOREST_CAT: thread("THREAD_FOREST_CAT", "cat"), THREAD_FOREST_OWL: thread("THREAD_FOREST_OWL", "owl"),
      THREAD_FOREST_FOX: thread("THREAD_FOREST_FOX", "fox"), THREAD_FOREST_ELEMENTAL: thread("THREAD_FOREST_ELEMENTAL", "forest_elemental") },
    cognition: { formula_version: COGNITION_FORMULA, formula_status: "AUTHORED_EVIDENCE_ONLY", horizons_status: "TBD_AUTHORED",
      primary: Object.fromEntries(PRIMARY.map((d) => [d, { authored_evidence_total: 0, evidence_event_ids: [] }])),
      authored_signals: {}, eligible_event_ids: [], conditional_authored_evidence: [], derived: {} },
    encounters: { active: {}, completed_ids: [], history: [] }, revisits: { active_ids: [], completed_ids: [], history: [] },
    synthesis: { started: false, phases_completed: [], model_solved: false, completed: false, first_companion: null, elemental_stage: null, elemental_stage_history: [] },
    invariant_violations: [] };
}
function rel(p, id) { id = text(id).toLowerCase(); if (!MASCOTS.has(id)) return null; return p.relationships[id] ||= relationship(id); }
function thr(p, id, character = null) { id = text(id); if (!id) return null; const t = p.threads[id] ||= thread(id, character); if (character && !t.relationship_character_id) t.relationship_character_id = character; return t; }
function touch(p, character, e, signal = null, amount = 0) {
  character = text(character).toLowerCase(); const id = THREADS[character]; if (!id) return null; const t = thr(p, id, character);
  t.status = "active"; t.last_meaningful_sequence = Math.max(t.last_meaningful_sequence, seq(e)); addUnique(t.readiness_evidence_event_ids, eid(e));
  if (signal) t.authored_evidence[signal] = number(t.authored_evidence[signal]) + number(amount); return t;
}
function relationshipEvidence(p, character, e, bucket = "shared_history_event_ids") {
  const r = rel(p, character); if (!r) return; r.meaningful_relationship_events += 1; addUnique(r.evidence[bucket] ||= [], eid(e)); touch(p, character, e);
}
function milestone(p, character, name, e) {
  const r = rel(p, character); if (!r || !MILESTONES.includes(name)) return; r.milestones[name] = true;
  const bucket = name === "understanding_established" ? "understanding_event_ids" : name === "reciprocity_established" ? "reciprocity_event_ids" : name === "cooperation_established" ? "cooperation_event_ids" : "shared_history_event_ids";
  relationshipEvidence(p, character, e, bucket); const t = touch(p, character, e); if (name === "temporary_alliance_completed" && t) t.temporary_alliance_completed = true; if (name === "companion" && t) t.companion = true;
}
function participants(data, encounterId = null) {
  const ids = list(data.participants).map((x) => text(x).toLowerCase()).filter(Boolean); if (ids.length) return ids;
  if (["ENC_FOREST_01", "ENC_FOREST_01_CAT_OWL"].includes(encounterId)) return ["cat", "owl"]; if (encounterId === "ENC_FOREST_11") return ["forest_elemental"]; return [];
}
function cognition(p, e, d) {
  if (d.profileEligible === false || d.profile_eligible === false) return;
  const weights = object(d.resolvedWeights ?? d.resolved_weights ?? d.authoredWeights ?? d.authored_weights ?? d.weights); addUnique(p.cognition.eligible_event_ids, eid(e));
  for (const [name, raw] of Object.entries(weights)) { const value = number(raw); if (!value) continue;
    if (PRIMARY.includes(name)) { p.cognition.primary[name].authored_evidence_total += value; addUnique(p.cognition.primary[name].evidence_event_ids, eid(e)); }
    else { const s = p.cognition.authored_signals[name] ||= { authored_evidence_total: 0, evidence_event_ids: [] }; s.authored_evidence_total += value; addUnique(s.evidence_event_ids, eid(e)); const m = /^(cat|owl|fox)_thread$/.exec(name); if (m) touch(p, m[1], e, name, value); }
  }
  for (const c of list(d.conditionalWeights ?? d.conditional_weights)) p.cognition.conditional_authored_evidence.push({ event_id: eid(e), key: text(c?.key), delta: number(c?.delta), condition: text(c?.condition), applied: false });
  const character = text(d.choiceKind ?? d.choice_kind) === "perspective" ? PERSPECTIVES[text(d.optionId ?? d.option_id)] : null;
  if (character) { const r = rel(p, character); r.borrowed_perspective.seen = true; r.borrowed_perspective.voluntarily_used = true; touch(p, character, e); }
}
function expose(p, e, d) {
  const id = text(d.world_fact_id ?? d.worldFactId); if (!id) return; const s = seq(e), sc = scene(e);
  const x = p.exposure.by_world_fact[id] ||= { world_fact_id: id, exposed: false, first_exposed_sequence: null, last_exposed_sequence: null, exposure_count: 0, first_scene_id: null, last_scene_id: null };
  x.exposed = true; x.first_exposed_sequence ??= s; x.last_exposed_sequence = s; x.exposure_count += 1; x.first_scene_id ??= sc; x.last_scene_id = sc;
}
function knowledgeId(d) { return text(d.knowledge_record_id ?? d.knowledgeRecordId ?? d.observation_id ?? d.observationId ?? d.record_id ?? d.recordId); }
function knowledge(p, d, e) {
  const id = knowledgeId(d); if (!id) return null; const s = seq(e); const r = p.knowledge.records[id] ||= { knowledge_record_id: id, record_kind: text(d.record_kind ?? d.recordKind) || "observation", presentation_group: text(d.presentation_group ?? d.presentationGroup) || "observation", subject_ref: d.subject_ref ?? d.subjectRef ?? null, subject_visibility: text(d.subject_visibility ?? d.subjectVisibility) || "hidden", display_state_key: text(d.display_state_key ?? d.displayStateKey) || null, confidence: text(d.confidence) || "SUSPECTED", source_world_fact_ids: [], linked_record_ids: [], reconstruction_ids: [], interpretations: [], pending_transition: null, first_created_sequence: s, last_changed_sequence: s };
  for (const id of list(d.source_world_fact_ids ?? d.sourceWorldFactIds)) addUnique(r.source_world_fact_ids, text(id)); r.last_changed_sequence = Math.max(r.last_changed_sequence, s); return r;
}
function patchKnowledge(r, d) { if (!r) return; for (const [snake, camel] of [["record_kind","recordKind"],["presentation_group","presentationGroup"],["subject_visibility","subjectVisibility"],["display_state_key","displayStateKey"],["confidence","confidence"]]) { const v = d[snake] ?? d[camel]; if (v != null && text(v)) r[snake] = text(v); } if (d.subject_ref != null || d.subjectRef != null) r.subject_ref = d.subject_ref ?? d.subjectRef; }
function worldEffects(p, d, e) {
  const id = text(d.world_event_id ?? d.worldEventId ?? d.event_definition_id ?? d.eventDefinitionId ?? d.definition_id ?? d.definitionId); if (id) p.world.occurred_world_events[id] = { occurred: true, sequence: seq(e), event_id: eid(e) };
  for (const x of list(d.effects)) { const type = text(x?.type), k = text(x?.key); if (type === "set_world_flag" && k) p.world.world_flags[k] = x.value; else if ((type === "set_area_state" || type === "set_environment_state") && k) p.world.area_states[k] = x.value; else if (type === "add_persistent_consequence") p.world.persistent_consequences.push({ ...x, event_id: eid(e) }); else if (type === "expire_event" && (x.event_id || x.eventId)) addUnique(p.world.expired_event_ids, x.event_id ?? x.eventId); else if (["open_path","close_path","transform_path"].includes(type) && k) p.world.path_states[k] = { type, value: x.value ?? true, sequence: seq(e) }; }
}
function reduce(p, e) {
  const k = key(e), d = payload(e), s = seq(e), id = eid(e), l = level(e); p.source_sequence = Math.max(p.source_sequence, s);
  if (k === "FOREST_LEVEL_STARTED" || k === "FOREST_LEVEL_COMPLETED") { if (!l) return; const done = k.endsWith("COMPLETED"); p.world[done ? "highest_completed_level" : "highest_started_level"] = Math.max(p.world[done ? "highest_completed_level" : "highest_started_level"], l); const x = p.world.levels[l] ||= {}; x[done ? "completed" : "started"] = true; x[done ? "completed_sequence" : "started_sequence"] = s; }
  else if (k === "FOREST_WORLD_FACT_EXPOSED") expose(p, e, d);
  else if (k === "FOREST_CHOICE_SELECTED") cognition(p, e, d);
  else if (k === "FOREST_WORLD_EVENT_OCCURRED") worldEffects(p, d, e);
  else if (k === "FOREST_THREAD_OPENED" || k === "FOREST_THREAD_STATE_CHANGED") { const c = text(d.characterId ?? d.character_id).toLowerCase(), t = thr(p, text(d.threadId ?? d.thread_id) || THREADS[c], c || null); if (t) { t.status = text(d.status) || "active"; if (d.identityState ?? d.identity_state) t.identity_state = text(d.identityState ?? d.identity_state); t.last_meaningful_sequence = Math.max(t.last_meaningful_sequence, s); addUnique(t.readiness_evidence_event_ids, id); } const b = object(d.borrowedPerspective ?? d.borrowed_perspective), r = c ? rel(p,c) : null; if (r) { if (b.seen === true) r.borrowed_perspective.seen = true; if (b.forcedTutorialUsed === true || b.forced_tutorial_used === true) r.borrowed_perspective.forced_tutorial_used = true; if (b.voluntarilyUsed === true || b.voluntarily_used === true) r.borrowed_perspective.voluntarily_used = true; } }
  else if (k === "FOREST_ENCOUNTER_STARTED") { const enc = text(d.encounterId ?? d.encounter_id); if (!enc) return; const ps = participants(d, enc); p.encounters.active[enc] = { encounter_id: enc, variant_id: text(d.variantId ?? d.variant_id) || null, participants: ps, started_sequence: s, scene_id: scene(e) }; p.encounters.history.push({ type:"started", encounter_id:enc, participants:ps, sequence:s, event_id:id }); for (const c of ps) { const r=rel(p,c); if (r) { r.identity_known=true; r.acquainted=true; relationshipEvidence(p,c,e); } else if (c === "forest_elemental") thr(p,THREADS.forest_elemental,c).status="active"; } }
  else if (k === "FOREST_ENCOUNTER_COMPLETED") { const enc = text(d.encounterId ?? d.encounter_id); if (!enc) return; const active=p.encounters.active[enc], explicit=participants(d,enc), ps=explicit.length?explicit:list(active?.participants); delete p.encounters.active[enc]; addUnique(p.encounters.completed_ids,enc); p.encounters.history.push({type:"completed",encounter_id:enc,participants:ps,sequence:s,event_id:id}); for(const c of ps){const t=touch(p,c,e);if(t)addUnique(t.encounter_ids_completed,enc);if(MASCOTS.has(c))relationshipEvidence(p,c,e);} }
  else if (k === "FOREST_RELATIONSHIP_MILESTONE") { const c=text(d.characterId??d.character_id).toLowerCase(), ms=list(d.milestones).length?list(d.milestones):[d.milestone??d.milestone_key]; for(const m of ms.map(text).filter(Boolean)) milestone(p,c,m,e); }
  else if (k === "FOREST_TEMPORARY_ALLIANCE_STARTED") for(const c of participants(d)) relationshipEvidence(p,c,e);
  else if (k === "FOREST_TEMPORARY_ALLIANCE_COMPLETED") for(const c of participants(d)) milestone(p,c,"temporary_alliance_completed",e);
  else if (k === "FOREST_RELATIONSHIP_SYNTHESIS_COMPLETED") milestone(p,text(d.characterId??d.character_id).toLowerCase(),"relationship_synthesis_completed",e);
  else if (k === "FOREST_COMPANION_ACQUIRED") { const c=text(d.characterId??d.character_id??d.companionId??d.companion_id).toLowerCase(); if(!MASCOTS.has(c))return; milestone(p,c,"companion",e); if(p.synthesis.first_companion&&p.synthesis.first_companion!==c)p.invariant_violations.push({code:"forest_multiple_first_companions",sequence:s,event_id:id,existing:p.synthesis.first_companion,attempted:c}); else p.synthesis.first_companion=c; }
  else if (k === "FOREST_OBSERVATION_CREATED" || k === "FOREST_OBSERVATION_UPDATED") patchKnowledge(knowledge(p,d,e),d);
  else if (k === "FOREST_INTERPRETATION_ADDED" || k === "FOREST_INTERPRETATION_REVISED") { const r=knowledge(p,d,e); if(r)r.interpretations.push({event_id:id,sequence:s,kind:k.endsWith("REVISED")?"revised":"added",value:d.interpretation??d.value??null}); }
  else if (k === "FOREST_KNOWLEDGE_CONFIRMED") { const r=knowledge(p,d,e); if(r)r.confidence=text(d.confidence)||"CONFIRMED"; }
  else if (k === "FOREST_KNOWLEDGE_LINKED") { const from=text(d.from_record_id??d.fromRecordId),to=text(d.to_record_id??d.toRecordId); if(from&&to){p.knowledge.links.push({from_record_id:from,to_record_id:to,relation:text(d.relation)||"supports",confidence:text(d.confidence)||"LIKELY",created_sequence:s,event_id:id});if(p.knowledge.records[from])addUnique(p.knowledge.records[from].linked_record_ids,to);if(p.knowledge.records[to])addUnique(p.knowledge.records[to].linked_record_ids,from);} }
  else if (["FOREST_KNOWLEDGE_REVELATION_READY","FOREST_KNOWLEDGE_REVELATION_STARTED","FOREST_KNOWLEDGE_REVELATION_COMPLETED"].includes(k)) { const tid=text(d.transition_id??d.transitionId); if(!tid)return; const t=p.knowledge.revelation_transitions[tid]||={transition_id:tid,status:"unknown"};t.status=k.endsWith("READY")?"ready":k.endsWith("STARTED")?"started":"completed";t.last_sequence=s;t.target_display_state_key=text(d.target_display_state_key??d.targetDisplayStateKey)||t.target_display_state_key||null;const r=knowledge(p,d,e);if(r){r.pending_transition=t.status==="completed"?null:{...t};if(t.status==="completed")patchKnowledge(r,d.target_state??d.targetState??d);} }
  else if (["FOREST_RECONSTRUCTION_CREATED","FOREST_RECONSTRUCTION_REVISED","FOREST_RECONSTRUCTION_CONFIRMED"].includes(k)) { const rid=text(d.reconstruction_instance_id??d.reconstructionInstanceId); if(!rid)return; const r=p.knowledge.reconstructions[rid]||={reconstruction_instance_id:rid,definition_id:text(d.definition_id??d.definitionId)||null,current_revision:0,confidence:"SUSPECTED",confirmation_state:"unconfirmed",source_knowledge_record_ids:[],first_created_sequence:s,last_revised_sequence:s};for(const x of list(d.source_knowledge_record_ids??d.sourceKnowledgeRecordIds))addUnique(r.source_knowledge_record_ids,text(x));if(k.endsWith("CREATED"))r.current_revision=Math.max(1,r.current_revision);if(k.endsWith("REVISED")){r.current_revision+=1;r.last_revised_sequence=s;}if(k.endsWith("CONFIRMED")){r.confirmation_state="confirmed";r.confidence=text(d.confidence)||"CONFIRMED";} }
  else if (k === "FOREST_REVISIT_STARTED" || k === "FOREST_REVISIT_COMPLETED") { const rid=text(d.revisitId??d.revisit_id??d.definitionId??d.definition_id);if(!rid)return;const started=k.endsWith("STARTED");addUnique(started?p.revisits.active_ids:p.revisits.completed_ids,rid);if(!started)p.revisits.active_ids=p.revisits.active_ids.filter(x=>x!==rid);p.revisits.history.push({type:started?"started":"completed",revisit_id:rid,sequence:s,event_id:id}); }
  else if (k === "FOREST_SYNTHESIS_STARTED") p.synthesis.started=true;
  else if (k === "FOREST_SYNTHESIS_PHASE_COMPLETED") { const x=text(d.phaseId??d.phase_id);if(x)addUnique(p.synthesis.phases_completed,x); }
  else if (k === "FOREST_SYNTHESIS_MODEL_SOLVED") p.synthesis.model_solved=true;
  else if (k === "FOREST_SYNTHESIS_COMPLETED") { p.synthesis.completed=true;p.world.world_flags.forest_synthesis_complete=true; }
  else if (k === "FOREST_ELEMENTAL_STAGE_CHANGED") { const stage=text(d.stage);if(stage){p.synthesis.elemental_stage=stage;addUnique(p.synthesis.elemental_stage_history,stage);const t=thr(p,THREADS.forest_elemental,"forest_elemental");t.status="active";if(stage==="FULL_MANIFESTATION"){t.identity_state="revealed";p.world.world_flags.forest_elemental_encountered=true;}t.last_meaningful_sequence=Math.max(t.last_meaningful_sequence,s);} }
}

export function buildRoutingSnapshot(p) {
  const relationships = {}, threads = {};
  for (const [id,r] of Object.entries(object(p?.relationships))) if (r && typeof r === "object" && r.character_id) relationships[id] = { identityKnown:r.identity_known===true,identity_known:r.identity_known===true,acquainted:r.acquainted===true,narrativeCompatibility:r.narrative_compatibility===true,narrative_compatibility:r.narrative_compatibility===true,milestones:{...object(r.milestones)},meaningfulRelationshipEvents:number(r.meaningful_relationship_events),temporaryAllianceCompleted:r?.milestones?.temporary_alliance_completed===true };
  for (const [id,t] of Object.entries(object(p?.threads))) if (t && typeof t === "object" && t.thread_id) { const v={active:t.status==="active",status:t.status,unfinishedQuestion:list(t.unresolved_question_keys).length>0,lastMeaningfulSequence:number(t.last_meaningful_sequence),readinessEvidenceEventIds:[...list(t.readiness_evidence_event_ids)],authoredEvidence:{...object(t.authored_evidence)}};threads[id]=v;if(t.relationship_character_id)threads[t.relationship_character_id]=v; }
  const recentEncounterParticipants=[];for(const x of list(p?.encounters?.history).filter(x=>x.type==="completed").slice(-3))recentEncounterParticipants.push(...list(x.participants));
  return { sourceSequence:number(p?.source_sequence),relationships,threads,recentEncounterParticipants,knowledge:{recordCount:Object.keys(object(p?.knowledge?.records)).length},cognitionEvidence:Object.fromEntries(Object.entries(object(p?.cognition?.primary)).map(([k,v])=>[k,number(v.authored_evidence_total)])) };
}
function finish(p) {
  const l=Math.max(p.world.highest_started_level,p.world.highest_completed_level,1);p.world.campaign_phase=`chapter_${Math.min(10,Math.max(1,Math.ceil(l/10)))}`;p.routing_snapshot=buildRoutingSnapshot(p);const s=p.source_sequence;
  for(const x of [p.world,p.exposure,p.knowledge,p.relationships,p.threads,p.cognition,p.encounters,p.revisits,p.synthesis])if(x&&typeof x==="object"&&!Array.isArray(x)){x.source_sequence=s;x.projection_version=VERSION;}return p;
}
function clone(base){if(!base||Number(base.projection_version)!==VERSION||base.world_id!==WORLD)return empty();try{return JSON.parse(JSON.stringify(base));}catch{return empty();}}
export function advanceForestProjection(base, events=[]) { const p=clone(base);delete p.routing_snapshot;const start=Math.max(0,Number(p.source_sequence)||0),seen=new Set();const ordered=[...list(events)].filter(e=>e&&(e.world_id==null||e.world_id===WORLD)&&seq(e)>start).sort((a,b)=>seq(a)-seq(b));for(const e of ordered){const d=text(e.event_id??e.eventId)||`${seq(e)}|${text(e.idempotency_key??e.idempotencyKey)}|${key(e)}`;if(seen.has(d))continue;seen.add(d);reduce(p,e);}return finish(p); }
export function projectForestEvents(events=[]) { return advanceForestProjection(null,events); }
export { VERSION as PROJECTION_VERSION, COGNITION_FORMULA as COGNITION_FORMULA_VERSION, PRIMARY as PRIMARY_DIMENSIONS };
