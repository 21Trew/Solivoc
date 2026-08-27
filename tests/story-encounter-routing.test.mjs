import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../js/narrative/story-encounter-routing.js', import.meta.url), 'utf8');
const definitions = JSON.parse(await readFile(new URL('../content/worlds/forest/v0.03/data/encounters.json', import.meta.url), 'utf8'));
import { routingProjectionView } from '../api/_forest-projection-views.mjs';

function load(){ const sandbox={console}; sandbox.globalThis=sandbox; vm.runInNewContext(source,sandbox); return sandbox.SolivocStoryEncounterRouting; }
function enc(id){ return definitions.encounters.find(x=>x.id===id); }
function ready(...milestones){ return { identityKnown:true, acquainted:true, milestones:Object.fromEntries(milestones.map(x=>[x,true])) }; }

test('generic active threads do not self-reinforce; one fresh initiative selects',()=>{
 const r=load();
 const activeOnly=r.routeEncounter({encounter:enc('ENC_FOREST_02'),level:17,snapshot:{threads:{cat:{active:true},owl:{active:true}}}});
 assert.equal(activeOnly.status,'defer');
 const cat=r.routeEncounter({encounter:enc('ENC_FOREST_02'),level:17,snapshot:{threads:{cat:{active:true,freshVoluntaryContinuation:true},owl:{active:true}}}});
 assert.equal(cat.status,'selected'); assert.equal(cat.selectedVariant,'ENC_FOREST_02_CAT');
});

test('multiple meaningful generic candidates defer instead of using an invented priority',()=>{
 const r=load();
 const result=r.routeEncounter({encounter:enc('ENC_FOREST_02'),level:17,snapshot:{threads:{cat:{freshVoluntaryContinuation:true},owl:{freshVoluntaryContinuation:true}}}});
 assert.equal(result.status,'defer');
});

test('generic deadline uses authored content order only',()=>{
 const r=load(); const result=r.routeEncounter({encounter:enc('ENC_FOREST_02'),level:19,snapshot:{threads:{owl:{freshVoluntaryContinuation:true}}}});
 assert.equal(result.status,'selected'); assert.equal(result.selectedVariant,'ENC_FOREST_02_CAT');
 assert.ok(result.reasons.includes('DETERMINISTIC_AUTHORED_ORDER'));
});

test('presentation prerequisites are hard routing eligibility',()=>{
 const r=load();
 const e4=enc('ENC_FOREST_04');
 const noUnderstanding=r.routeEncounter({encounter:e4,level:39,snapshot:{relationships:{fox:{acquainted:true},cat:{},owl:{}}}});
 assert.ok(!noUnderstanding.eligibleVariants.includes('ENC_FOREST_04_FOX_CONTINUATION'));
 const e5=enc('ENC_FOREST_05');
 const onlyCat=r.routeEncounter({encounter:e5,level:49,snapshot:{relationships:{cat:ready('understanding_established'),owl:ready(),fox:ready()}}});
 assert.equal(onlyCat.selectedVariant,'ENC_FOREST_05_CAT');
 assert.deepEqual(Array.from(onlyCat.eligibleVariants),['ENC_FOREST_05_CAT']);
});

test('Encounter 8 is selected at its authored required start level',()=>{
 const r=load(); const rel=ready('understanding_established','reciprocity_established');
 const result=r.routeEncounter({encounter:enc('ENC_FOREST_08'),level:76,snapshot:{relationships:{cat:rel,owl:rel}}});
 assert.equal(result.status,'selected'); assert.equal(result.selectedVariant,'ENC_FOREST_08_CAT');
 assert.equal(result.deadline,true); assert.ok(result.reasons.includes('REQUIRED_START_LEVEL'));
});

test('Encounter 9 permits ally continuity and only authored switch state',()=>{
 const r=load();
 const base={cat:{...ready('understanding_established','reciprocity_established'),meaningfulRelationshipEvents:4},owl:{...ready('understanding_established','reciprocity_established'),meaningfulRelationshipEvents:4,milestones:{understanding_established:true,reciprocity_established:true,temporary_alliance_completed:true}}};
 const noSwitch=r.routeEncounter({encounter:enc('ENC_FOREST_09'),level:84,snapshot:{relationships:base}});
 assert.equal(noSwitch.status,'selected'); assert.equal(noSwitch.selectedVariant,'ENC_FOREST_09_OWL');
 const withSwitch=r.routeEncounter({encounter:enc('ENC_FOREST_09'),level:84,snapshot:{relationships:base,variantEvidence:{ENC_FOREST_09_CAT:{unresolvedMutualContradiction:true}}}});
 assert.equal(withSwitch.status,'defer');
});

test('Encounter 10 uses only its exact authored tie break',()=>{
 const r=load();
 const mk=(depth)=>({...ready('understanding_established','reciprocity_established','cooperation_established'),narrativeCompatibility:true,meaningfulRelationshipEvents:depth});
 const result=r.routeEncounter({encounter:enc('ENC_FOREST_10'),level:89,snapshot:{relationships:{cat:mk(3),owl:mk(5),fox:mk(4)}}});
 assert.equal(result.status,'selected'); assert.equal(result.selectedVariant,'ENC_FOREST_10_OWL');
 const tied=r.routeEncounter({encounter:enc('ENC_FOREST_10'),level:89,snapshot:{relationships:{cat:mk(4),owl:mk(4),fox:mk(4)}}});
 assert.equal(tied.status,'defer');
 const deadline=r.routeEncounter({encounter:enc('ENC_FOREST_10'),level:90,snapshot:{relationships:{cat:mk(4),owl:mk(4),fox:mk(4)}}});
 assert.equal(deadline.selectedVariant,'ENC_FOREST_10_CAT'); assert.ok(deadline.reasons.includes('DETERMINISTIC_CHARACTER_ORDER'));
});

test('routing projection marks only a truly latest authored thread choice as fresh',()=>{
 const base={
   world_id:'forest', source_sequence:9, projection_version:1,
   routing_snapshot:{relationships:{},threads:{cat:{active:true},THREAD_FOREST_CAT:{active:true},owl:{active:true},THREAD_FOREST_OWL:{active:true}}},
   relationships:{},
   threads:{THREAD_FOREST_CAT:{readiness_evidence_event_ids:['enc2','choice3'],last_meaningful_sequence:3},THREAD_FOREST_OWL:{readiness_evidence_event_ids:['enc2','forced4'],last_meaningful_sequence:4}},
   cognition:{authored_signals:{cat_thread:{evidence_event_ids:['choice3']},owl_thread:{evidence_event_ids:['choice2']}}},
   encounters:{completed_ids:['ENC_FOREST_01'],history:[{type:'completed',encounter_id:'ENC_FOREST_01',participants:['cat','owl'],sequence:2,event_id:'enc2'}]},
 };
 const view=routingProjectionView(base).routing_snapshot;
 assert.equal(view.threads.cat.freshVoluntaryContinuation,true);
 assert.equal(view.threads.owl.freshVoluntaryContinuation,false);
});

test('encounter completion resets freshness until a later authored initiative',()=>{
 const p={world_id:'forest',source_sequence:6,projection_version:1,routing_snapshot:{relationships:{},threads:{cat:{},THREAD_FOREST_CAT:{}}},relationships:{},threads:{THREAD_FOREST_CAT:{readiness_evidence_event_ids:['choice3','enc5'],last_meaningful_sequence:5}},cognition:{authored_signals:{cat_thread:{evidence_event_ids:['choice3']}}},encounters:{completed_ids:['ENC_FOREST_02'],history:[{type:'completed',encounter_id:'ENC_FOREST_02',participants:['cat'],sequence:5,event_id:'enc5'}]}};
 assert.equal(routingProjectionView(p).routing_snapshot.threads.cat.freshVoluntaryContinuation,false);
 p.threads.THREAD_FOREST_CAT.readiness_evidence_event_ids.push('choice6'); p.threads.THREAD_FOREST_CAT.last_meaningful_sequence=6; p.cognition.authored_signals.cat_thread.evidence_event_ids.push('choice6');
 assert.equal(routingProjectionView(p).routing_snapshot.threads.cat.freshVoluntaryContinuation,true);
});

test('router source has no RNG, default semantic factor order or repetition sort',()=>{
 assert.doesNotMatch(source,/Math\.random|crypto\.getRandomValues/);
 assert.doesNotMatch(source,/DEFAULT_FACTOR_ORDER|repetitionCost/);
});
