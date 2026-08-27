import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../js/narrative/story-primitives.js', import.meta.url), 'utf8');
const contract = JSON.parse(await readFile(new URL('../content/worlds/forest/v0.03/data/primitives.json', import.meta.url), 'utf8'));

function setup({ level=98, sceneId='SCN_FOREST_L098_CORE', highestCompleted=97 }={}) {
  let state = { worldId:'forest', packageVersion:'0.03', sceneId, areaId:'AREA_FOREST_WHOLE', levelId:level, status:'active' };
  const meta = new Map(); const commands=[];
  const store = { async getMeta(k){ return meta.get(k) ?? null; }, async setMeta(k,v){ meta.set(k,v); }, async commit(c,k,v){ commands.push(c); meta.set(k,v); return c; }, async pending(){ return []; } };
  const projection = { world_id:'forest', world:{highest_completed_level:highestCompleted,world_flags:{forest_synthesis_complete:false}}, synthesis:{first_companion:'cat'}, routing_snapshot:{relationships:{cat:{identityKnown:true,acquainted:true,narrativeCompatibility:true,milestones:{understanding_established:true,reciprocity_established:true,cooperation_established:true}}}}, encounters:{completed_ids:[]}, revisits:{completed_ids:[]} };
  const content = { async loadManifest(){return {runtimeFiles:['data/primitives.json']};}, async loadRuntimeFile(){return contract;} };
  const base = { async bootstrap(){return {document:{scenes:[]}};}, async restore(){return state;}, async sync(){return {ok:true};}, async beginScene(){return {state};}, async completeScene(){return {state:{...state,status:'completed'}};} };
  const sandbox = { console, Date, SolivocNarrativeStore:store, SolivocWorldContent:content, SolivocForestStory:base, accountSignedIn:()=>true, apiFetch:async()=>({ok:true,status:200,json:async()=>({projection})}) };
  sandbox.globalThis=sandbox; vm.runInNewContext(source,sandbox,{filename:'story-primitives.js'});
  return {sandbox,commands,meta,projection,setState(v){state=v;}};
}

test('contract exposes all four late-world primitives and stable knowledge actions',()=>{
  const x=setup(); const p=x.sandbox.SolivocStoryPrimitives;
  for(const id of ['relationship-synthesis','authored-revisit','world-synthesis','elemental-manifestation']) assert.equal(p.supports(id),true);
  assert.equal(p.validateContract(contract).ok,true);
  assert.equal(contract.knowledgeActions.find(a=>a.id==='KACT_FOREST_CONTINUE_TOGETHER').action,'CONTINUE_TOGETHER');
});

test('world synthesis production board v0.01 is structurally authored and beta-runnable',()=>{
  const x=setup({level:99,sceneId:'SCN_FOREST_L099_CORE',highestCompleted:98}); const p=x.sandbox.SolivocStoryPrimitives;
  const definition=contract.worldSynthesis, board=definition.board;
  assert.equal(definition.betaRunnable,true);
  assert.equal(definition.contentVersion,'0.01');
  assert.equal(definition.contentStatus,'BOUND_PRODUCTION_DRAFT_V0_01');
  assert.equal(p.validateWorldSynthesisBoard(definition).ok,true);
  assert.equal(board.id,'SYN_FOREST_WORLD_01_BOARD');
  assert.ok(board.nodes.length>=9);
  assert.ok(board.relations.filter(r=>r.truth==='core').length>=12);
  assert.ok(board.relations.filter(r=>r.truth==='distractor').length>=4);
  const relationIds=new Set(board.relations.map(r=>r.id));
  for(const phase of board.phases){
    assert.ok(phase.requiredRelationIds.length>0);
    assert.ok(phase.candidateRelationIds.length>=phase.requiredRelationIds.length);
    for(const id of phase.requiredRelationIds){
      assert.ok(relationIds.has(id));
      assert.notEqual(board.relations.find(r=>r.id===id)?.truth,'distractor');
    }
  }
});

test('L99 board keeps the same hard target for all companions and no optional-history gate',()=>{
  const board=contract.worldSynthesis.board;
  assert.equal(board.requiredHistoryPolicy,'CORE_1_98_ONLY');
  assert.equal(board.optionalHistoryPolicy,'PROVENANCE_AND_ECHO_ONLY');
  assert.deepEqual(Object.keys(board.companionLenses).sort(),['cat','fox','owl']);
  const whole=board.phases.find(p=>p.id==='SYN_FOREST_WORLD_01_WHOLE');
  assert.ok(whole.requiredRelationIds.includes('SYN_REL_WOOD_MEDIATES_BERRY'));
  assert.ok(whole.requiredRelationIds.includes('SYN_REL_SOIL_SUPPORTS_BERRY'));
  assert.ok(!whole.requiredRelationIds.includes('SYN_REL_BIRD_PRESSURES_BERRY'));
});

test('required L98 revisit records start and completion without inventing knowledge transitions',async()=>{
  const x=setup(); const p=x.sandbox.SolivocStoryPrimitives; const scene={id:'SCN_FOREST_L098_CORE',level:98,requiredPrimitive:'authored-revisit'};
  await p.assertSceneStart(scene); await p.prepareScenePrimitive(scene,await x.sandbox.SolivocForestStory.restore()); await p.runScenePrimitive(scene,await x.sandbox.SolivocForestStory.restore());
  assert.deepEqual(x.commands.flatMap(c=>c.events.map(e=>e.eventKey)),['FOREST_REVISIT_STARTED','FOREST_REVISIT_COMPLETED']);
  assert.deepEqual(Array.from(x.commands.at(-1).events[0].payload.forcedKnowledgeTransitions),[]);
});

test('perception gate remains non-blocking when authoring has no explicit fact target',async()=>{
  const x=setup({level:7,sceneId:'SCN_FOREST_L007_CORE'}); const result=await x.sandbox.SolivocStoryPrimitives.runPerceptionGate({id:'SCN_FOREST_L007_CORE'},{type:'perception-gate',failurePenalty:'none'});
  assert.equal(result.status,'nonblocking-authoring-missing'); assert.equal(result.failurePenalty,'none'); assert.equal(x.commands.length,0);
});

test('reconstruction refuses inference without explicit authored sources',async()=>{
  const x=setup({level:69,sceneId:'SCN_FOREST_L069_CORE'}); const p=x.sandbox.SolivocStoryPrimitives;
  await assert.rejects(()=>p.createReconstruction({definitionId:'REC_FOREST_EVENT_CREATURE_PASSAGE_01',sourceKnowledgeRecordIds:[]}),/reconstruction_explicit_sources_required/);
  const result=await p.createReconstruction({definitionId:'REC_FOREST_EVENT_CREATURE_PASSAGE_01',sourceKnowledgeRecordIds:['kr:a','kr:b']});
  assert.equal(result.definitionId,'REC_FOREST_EVENT_CREATURE_PASSAGE_01'); assert.equal(x.commands.at(-1).events[0].eventKey,'FOREST_RECONSTRUCTION_CREATED');
});

test('implemented primitive scenes bypass the base non-executable guard without bypassing authored checks',async()=>{
  const scene={id:'SCN_FOREST_L098_CORE',level:98,areaId:'AREA_FOREST_WHOLE',nextSceneId:'SCN_FOREST_L099_CORE',requiredPrimitive:'authored-revisit'};
  let baseBeginCalls=0; const meta=new Map(); const commands=[];
  const store={async getMeta(k){return meta.get(k)??null;},async setMeta(k,v){meta.set(k,v);},async commit(c,k,v){commands.push(c);meta.set(k,v);return c;},async pending(){return [];}};
  const projection={world_id:'forest',world:{highest_completed_level:97,world_flags:{}},synthesis:{first_companion:'cat'},routing_snapshot:{relationships:{}},encounters:{completed_ids:[]},revisits:{completed_ids:[]}};
  const content={async loadManifest(){return{runtimeFiles:['data/primitives.json']};},async loadRuntimeFile(){return contract;}};
  const base={defaultSceneId:'SCN_FOREST_L001_CORE',async bootstrap(){return{document:{scenes:[scene]}};},async restore(){return meta.get('story:forest:active')??null;},async sync(){return{ok:true};},async beginScene(){baseBeginCalls++;throw new Error('base_guard_should_not_run');},async completeScene(){throw new Error('base_guard_should_not_run');}};
  const sandbox={console,Date,SolivocNarrativeStore:store,SolivocWorldContent:content,SolivocForestStory:base,accountSignedIn:()=>true,apiFetch:async()=>({ok:true,status:200,json:async()=>({projection})})}; sandbox.globalThis=sandbox; vm.runInNewContext(source,sandbox,{filename:'story-primitives.js'});
  const result=await sandbox.SolivocForestStory.beginScene(scene.id);
  assert.equal(baseBeginCalls,0); assert.equal(result.state.status,'active'); assert.equal(commands[0].events[0].levelId,98);
  assert.deepEqual(commands.flatMap(c=>c.events.map(e=>e.eventKey)),['FOREST_LEVEL_STARTED','FOREST_REVISIT_STARTED']);
  await sandbox.SolivocForestStory.completeScene(scene.id);
  assert.deepEqual(commands.flatMap(c=>c.events.map(e=>e.eventKey)),['FOREST_LEVEL_STARTED','FOREST_REVISIT_STARTED','FOREST_REVISIT_COMPLETED','FOREST_LEVEL_COMPLETED']);
});

test('world synthesis engine accepts a structurally authored board without hardcoded Forest content',()=>{
  const x=setup({level:99,sceneId:'SCN_FOREST_L099_CORE'}); const p=x.sandbox.SolivocStoryPrimitives;
  const relations=[{id:'r1',from:'n1',to:'n2',family:'resource',label:'r1',directional:true},{id:'r2',from:'n2',to:'n3',family:'movement',label:'r2',mediated:true},{id:'r3',from:'n3',to:'n4',family:'time',label:'r3',temporal:true},{id:'r4',from:'n4',to:'n5',family:'feedback',label:'r4',feedback:true},{id:'r5',from:'n5',to:'n6',family:'resource',label:'r5'},{id:'r6',from:'n6',to:'n1',family:'movement',label:'r6'},{id:'r7',from:'n1',to:'n3',family:'time',label:'r7'}];
  const definition={...contract.worldSynthesis,board:{nodes:[{id:'n1',label:'1',roles:['a','b']},{id:'n2',label:'2'},{id:'n3',label:'3'},{id:'n4',label:'4'},{id:'n5',label:'5'},{id:'n6',label:'6'}],relations,phases:contract.worldSynthesis.phases.map((phase,index)=>({id:phase.id,requiredRelationIds:[relations[index].id]}))}};
  const validation=p.validateWorldSynthesisBoard(definition); assert.equal(validation.ok,true); assert.equal(Array.from(validation.errors).length,0);
});
