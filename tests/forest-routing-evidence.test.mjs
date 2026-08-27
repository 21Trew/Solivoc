import test from 'node:test';
import assert from 'node:assert/strict';
import { applyForestRoutingEvidence, QUESTION_BY_COMPLETED_VARIANT } from '../api/_forest-routing-evidence.mjs';
import { routingProjectionView } from '../api/_forest-projection-views.mjs';

test('completed reciprocal encounter rebuilds unresolved question deterministically',()=>{
 const projection={world_id:'forest',source_sequence:5,projection_version:1,routing_snapshot:{threads:{fox:{},THREAD_FOREST_FOX:{}}},threads:{THREAD_FOREST_FOX:{readiness_evidence_event_ids:[],last_meaningful_sequence:5}},cognition:{authored_signals:{}},encounters:{history:[],completed_ids:[]},relationships:{}};
 const events=[{sequence_no:5,event_key:'FOREST_ENCOUNTER_COMPLETED',payload:{encounterId:'ENC_FOREST_04',variantId:'ENC_FOREST_04_FOX_CONTINUATION',participants:['fox']}}];
 applyForestRoutingEvidence(projection,events,0);
 assert.deepEqual(projection.threads.THREAD_FOREST_FOX.unresolved_question_keys,[QUESTION_BY_COMPLETED_VARIANT.ENC_FOREST_04_FOX_CONTINUATION]);
 const view=routingProjectionView(projection).routing_snapshot;
 assert.equal(view.threads.fox.unfinishedQuestion,true);
 assert.deepEqual(view.threads.fox.unresolvedQuestionKeys,['FOX_ROUTE_NEEDS_VERIFICATION']);
 applyForestRoutingEvidence(projection,events,0);
 assert.deepEqual(projection.threads.THREAD_FOREST_FOX.unresolved_question_keys,['FOX_ROUTE_NEEDS_VERIFICATION']);
});
