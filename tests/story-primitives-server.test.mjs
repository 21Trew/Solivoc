import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { routingProjectionView, primitiveProjectionView } from '../api/_forest-projection-views.mjs';

function sampleProjection(){
  return { world_id:'forest',source_sequence:42,projection_version:1, world:{highest_completed_level:99,world_flags:{forest_synthesis_complete:true,forest_elemental_encountered:true}}, knowledge:{records:{secret:{subject_ref:'forest_elemental'}}}, routing_snapshot:{relationships:{owl:{identityKnown:true,acquainted:true,narrativeCompatibility:false,narrative_compatibility:false,milestones:{understanding_established:true,reciprocity_established:true,cooperation_established:true}}},threads:{}}, encounters:{completed_ids:['ENC_FOREST_09','ENC_FOREST_11'],history:[{type:'completed',encounter_id:'ENC_FOREST_09',participants:['owl']}]}, revisits:{completed_ids:['REV_FOREST_CLEARING_L98']}, synthesis:{first_companion:'owl',started:true,phases_completed:['A'],model_solved:true,completed:true,elemental_stage:'FULL_MANIFESTATION'} };
}

test('Encounter 9 transfer becomes explicit narrative compatibility in the safe routing view',()=>{
  const view=routingProjectionView(sampleProjection());
  assert.equal(view.routing_snapshot.relationships.owl.narrativeCompatibility,true);
  assert.equal(view.routing_snapshot.relationships.owl.narrative_compatibility,true);
});

test('primitive projection exposes guards but never hidden KnowledgeProjection',()=>{
  const view=primitiveProjectionView(sampleProjection());
  assert.equal(view.world.highest_completed_level,99);
  assert.equal(view.world.world_flags.forest_synthesis_complete,true);
  assert.equal(view.world.world_flags.forest_world_complete,true);
  assert.equal(view.synthesis.first_companion,'owl');
  assert.deepEqual(view.revisits.completed_ids,['REV_FOREST_CLEARING_L98']);
  assert.equal('knowledge' in view,false);
  assert.equal(JSON.stringify(view).includes('subject_ref'),false);
});

test('semantic endpoint chooses primitive-safe view explicitly',async()=>{
  const source=await readFile(new URL('../api/semantic-events.mjs',import.meta.url),'utf8');
  assert.match(source,/view"\) === "primitives"/);
  assert.match(source,/primitiveProjectionView/);
  assert.match(source,/Hidden KnowledgeProjection/);
});

test('Encounter 9 alone cannot fabricate narrative compatibility without earned cooperation',()=>{
  const projection=sampleProjection(); projection.routing_snapshot.relationships.owl.milestones.cooperation_established=false;
  const view=routingProjectionView(projection);
  assert.equal(view.routing_snapshot.relationships.owl.narrativeCompatibility,false);
});
