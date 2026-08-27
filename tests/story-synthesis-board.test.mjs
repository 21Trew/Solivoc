import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const contract = JSON.parse(await readFile(new URL('../content/worlds/forest/v0.03/data/primitives.json', import.meta.url), 'utf8'));
const preflightSource = await readFile(new URL('../js/narrative/story-synthesis-board-runtime.js', import.meta.url), 'utf8');

function validateBoard(definition) {
  const board=definition?.board, req=definition?.boardRequirements || {}, errors=[];
  if(!board) return ['missing'];
  const nodes=board.nodes || [], relations=board.relations || [], phases=board.phases || [];
  const nodeIds=new Set(nodes.map(x=>x.id)), relationIds=new Set(relations.map(x=>x.id));
  if(nodes.length < (req.minNodes||6)) errors.push('nodes');
  if(relations.length < (req.minRelations||7)) errors.push('relations');
  if(new Set(relations.map(x=>x.family)).size < (req.minRelationFamilies||4)) errors.push('families');
  if(req.requiresMultiRoleNode && !nodes.some(x=>(x.roles||[]).length>1)) errors.push('multi-role');
  if(req.requiresDirectionalRelation && !relations.some(x=>x.directional===true)) errors.push('direction');
  if(req.requiresMediatedRelation && !relations.some(x=>x.mediated===true)) errors.push('mediated');
  if(req.requiresTemporalContinuation && !relations.some(x=>x.temporal===true)) errors.push('temporal');
  if(req.requiresFeedbackFragment && !relations.some(x=>x.feedback===true)) errors.push('feedback');
  for(const r of relations) if(!nodeIds.has(r.from)||!nodeIds.has(r.to)||!r.family||!r.label) errors.push('relation-ref');
  for(const p of phases) if(!(p.requiredRelationIds||[]).length || p.requiredRelationIds.some(id=>!relationIds.has(id))) errors.push('phase-ref');
  return [...new Set(errors)];
}

test('production board v0.01 closes the authoring gate',()=>{
  const d=contract.worldSynthesis;
  assert.equal(d.betaRunnable,true);
  assert.equal(d.contentVersion,'0.01');
  assert.equal(d.contentStatus,'BOUND_PRODUCTION_DRAFT_V0_01');
  assert.deepEqual(validateBoard(d),[]);
});

test('board is distributed, temporal and contains authored hypotheses',()=>{
  const b=contract.worldSynthesis.board;
  assert.equal(b.nodes.length,9);
  assert.equal(b.relations.filter(x=>x.truth==='core').length,12);
  assert.equal(b.relations.filter(x=>x.truth==='distractor').length,4);
  assert.ok(b.relations.some(x=>x.mediated===true));
  assert.ok(b.relations.some(x=>x.feedback===true));
  assert.ok(b.relations.filter(x=>x.temporal===true).length>=4);
  assert.ok(b.relations.every(x=>x.truth!=='distractor'||typeof x.feedback==='string'));
});

test('all companion routes share one hard board and optional knowledge is not a gate',()=>{
  const b=contract.worldSynthesis.board;
  assert.equal(b.requiredHistoryPolicy,'CORE_1_98_ONLY');
  assert.equal(b.optionalHistoryPolicy,'PROVENANCE_AND_ECHO_ONLY');
  assert.deepEqual(Object.keys(b.companionLenses).sort(),['cat','fox','owl']);
  assert.equal(Object.keys(b.companionLenses).some(k=>b.companionLenses[k].requiredRelationIds),false);
});

function sandboxFor({completed=98,companion='cat',ready=true}={}) {
  const scene={id:'SCN_FOREST_L099_CORE',requiredPrimitive:'world-synthesis'};
  let beginCalls=0;
  const runtime={defaultSceneId:scene.id,async bootstrap(){return{document:{scenes:[scene]}};},async beginScene(){beginCalls++;return{ok:true};}};
  const primitives={
    async loadContract(){return contract;},
    validateWorldSynthesisBoard(){return {ok:true,errors:[]};},
    async primitiveProjection(){return ready?{status:'ready',projection:{world:{highest_completed_level:completed},synthesis:{first_companion:companion}}}:{status:'unavailable',reason:'offline'};}
  };
  const sandbox={console,SolivocForestStory:runtime,SolivocStoryPrimitives:primitives}; sandbox.globalThis=sandbox;
  vm.runInNewContext(preflightSource,sandbox,{filename:'story-synthesis-board-runtime.js'});
  return {sandbox,get beginCalls(){return beginCalls;}};
}

test('L99 preflight accepts completed L98 plus first companion',async()=>{
  const x=sandboxFor();
  await x.sandbox.SolivocForestStory.beginScene('SCN_FOREST_L099_CORE');
  assert.equal(x.beginCalls,1);
});

test('L99 preflight rejects incomplete Forest progression',async()=>{
  const x=sandboxFor({completed:97});
  await assert.rejects(()=>x.sandbox.SolivocForestStory.beginScene('SCN_FOREST_L099_CORE'),/story_world_synthesis_prerequisite_missing/);
  assert.equal(x.beginCalls,0);
});

test('L99 preflight fails closed when projection is unavailable',async()=>{
  const x=sandboxFor({ready:false});
  await assert.rejects(()=>x.sandbox.SolivocForestStory.beginScene('SCN_FOREST_L099_CORE'),/story_primitive_projection_unavailable/);
  assert.equal(x.beginCalls,0);
});
