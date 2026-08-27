import test from 'node:test';
import assert from 'node:assert/strict';
import { projectForestEvents, buildRoutingSnapshot, PRIMARY_DIMENSIONS } from '../api/_forest-projection-lib.mjs';

const e = (sequence_no, event_key, payload = {}, extra = {}) => ({ event_id:`e${sequence_no}`, sequence_no, event_key, world_id:'forest', level_id: extra.level_id || null, scene_id: extra.scene_id || null, payload });

test('deterministic event replay builds exposure and world progress', () => {
  const events = [
    e(3,'FOREST_LEVEL_COMPLETED',{}, {level_id:1}),
    e(1,'FOREST_LEVEL_STARTED',{}, {level_id:1}),
    e(2,'FOREST_WORLD_FACT_EXPOSED',{world_fact_id:'WF_F01'}, {level_id:1,scene_id:'SCN1'}),
  ];
  const p = projectForestEvents(events);
  assert.equal(p.source_sequence,3);
  assert.equal(p.world.highest_completed_level,1);
  assert.equal(p.exposure.by_world_fact.WF_F01.exposure_count,1);
  assert.equal(p.exposure.by_world_fact.WF_F01.first_scene_id,'SCN1');
});

test('forced tutorial updates familiarity but not cognition preference evidence', () => {
  const p = projectForestEvents([
    e(1,'FOREST_THREAD_STATE_CHANGED',{threadId:'THREAD_FOREST_CAT',characterId:'cat',borrowedPerspective:{seen:true,forcedTutorialUsed:true},profileEligible:false,reason:'forced_tutorial'}),
  ]);
  assert.equal(p.relationships.cat.borrowed_perspective.seen,true);
  assert.equal(p.relationships.cat.borrowed_perspective.forced_tutorial_used,true);
  assert.equal(p.cognition.eligible_event_ids.length,0);
});

test('authored choice applies only direct primary weights and leaves conditional evidence unapplied', () => {
  const p = projectForestEvents([
    e(1,'FOREST_CHOICE_SELECTED',{choiceKind:'attention',optionId:'bent_grass',profileEligible:true,authoredWeights:{discovery:2,intuition:1,cat_thread:1},conditionalWeights:[{key:'fox_thread',delta:1,condition:'factual_evidence'}]}),
  ]);
  assert.equal(p.cognition.primary.discovery.authored_evidence_total,2);
  assert.equal(p.cognition.primary.intuition.authored_evidence_total,1);
  assert.equal(p.cognition.authored_signals.cat_thread.authored_evidence_total,1);
  assert.equal(p.threads.THREAD_FOREST_CAT.status,'active');
  assert.equal(p.threads.THREAD_FOREST_FOX.status,'dormant');
  assert.equal(p.cognition.conditional_authored_evidence[0].applied,false);
  for (const key of PRIMARY_DIMENSIONS) assert.ok(p.cognition.primary[key]);
});

test('voluntary perspective is distinct from forced tutorial', () => {
  const p = projectForestEvents([
    e(1,'FOREST_CHOICE_SELECTED',{choiceKind:'perspective',optionId:'owl_close_look',profileEligible:true,authoredWeights:{observation:2,verification:1,owl_thread:1}}),
  ]);
  assert.equal(p.relationships.owl.borrowed_perspective.voluntarily_used,true);
  assert.equal(p.relationships.owl.borrowed_perspective.forced_tutorial_used,false);
});

test('encounter history and milestones become routing-ready relationships', () => {
  const p = projectForestEvents([
    e(1,'FOREST_ENCOUNTER_STARTED',{encounterId:'ENC_FOREST_02',variantId:'ENC_FOREST_02_OWL',participants:['owl']}),
    e(2,'FOREST_RELATIONSHIP_MILESTONE',{characterId:'owl',milestone:'understanding_established'}),
    e(3,'FOREST_ENCOUNTER_COMPLETED',{encounterId:'ENC_FOREST_02'}),
  ]);
  assert.equal(p.relationships.owl.identity_known,true);
  assert.equal(p.relationships.owl.acquainted,true);
  assert.equal(p.relationships.owl.milestones.understanding_established,true);
  assert.deepEqual(p.encounters.completed_ids,['ENC_FOREST_02']);
  assert.deepEqual(p.threads.THREAD_FOREST_OWL.encounter_ids_completed,['ENC_FOREST_02']);
  const snapshot = buildRoutingSnapshot(p);
  assert.equal(snapshot.relationships.owl.identityKnown,true);
  assert.equal(snapshot.threads.owl.active,true);
});

test('knowledge, world effects and synthesis remain separate projections', () => {
  const p = projectForestEvents([
    e(1,'FOREST_OBSERVATION_CREATED',{knowledgeRecordId:'KR1',sourceWorldFactIds:['WF_F04'],displayStateKey:'forest.obs.partial_track'}),
    e(2,'FOREST_KNOWLEDGE_CONFIRMED',{knowledgeRecordId:'KR1'}),
    e(3,'FOREST_WORLD_EVENT_OCCURRED',{worldEventId:'WE_FOREST_RESPONSE_01',effects:[{type:'set_world_flag',key:'forest_response_occurred',value:true}]}),
    e(4,'FOREST_SYNTHESIS_COMPLETED',{}),
  ]);
  assert.equal(p.knowledge.records.KR1.confidence,'CONFIRMED');
  assert.equal(p.world.world_flags.forest_response_occurred,true);
  assert.equal(p.world.world_flags.forest_synthesis_complete,true);
});

test('second first companion is surfaced as an invariant violation, not silently overwritten', () => {
  const p = projectForestEvents([
    e(1,'FOREST_COMPANION_ACQUIRED',{characterId:'cat'}),
    e(2,'FOREST_COMPANION_ACQUIRED',{characterId:'owl'}),
  ]);
  assert.equal(p.synthesis.first_companion,'cat');
  assert.equal(p.invariant_violations[0].code,'forest_multiple_first_companions');
});

test('incremental projection produces the same result as full rebuild', async () => {
  const { advanceForestProjection } = await import('../api/_forest-projection-lib.mjs');
  const first = [
    e(1,'FOREST_LEVEL_STARTED',{}, {level_id:1}),
    e(2,'FOREST_CHOICE_SELECTED',{choiceKind:'attention',optionId:'x',profileEligible:true,authoredWeights:{memory:2}}),
  ];
  const second = [
    e(3,'FOREST_WORLD_FACT_EXPOSED',{world_fact_id:'WF_F01'}, {level_id:1,scene_id:'SCN1'}),
    e(4,'FOREST_LEVEL_COMPLETED',{}, {level_id:1}),
  ];
  const incremental = advanceForestProjection(projectForestEvents(first), second);
  const rebuilt = projectForestEvents([...first, ...second]);
  assert.deepEqual(incremental, rebuilt);
});

test('projection API preserves canonical append before cache maintenance', async () => {
  const { readFile } = await import('node:fs/promises');
  const endpoint = await readFile(new URL('../api/semantic-events.mjs', import.meta.url), 'utf8');
  const store = await readFile(new URL('../api/_forest-projection-store.mjs', import.meta.url), 'utf8');
  const appendAt = endpoint.indexOf('appendSemanticCommand(command)');
  const projectAt = endpoint.indexOf('advanceForestProjectionCache');
  assert.ok(appendAt >= 0 && projectAt >= 0 && appendAt < endpoint.lastIndexOf('advanceForestProjectionCache'));
  assert.match(endpoint, /projection_update_failed/);
  assert.match(endpoint, /ensureForestProjection\(session\.userId\)/);
  assert.match(store, /projection_source_sequence_mismatch/);
  assert.match(store, /firstAccepted !== currentSequence \+ 1/);
  assert.match(store, /newer_projection_exists/);
});
