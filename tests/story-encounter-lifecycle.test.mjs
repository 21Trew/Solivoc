import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../js/narrative/story-encounter-lifecycle.js', import.meta.url), 'utf8');
const loader = await readFile(new URL('../js/narrative/relation-rule-engine.js', import.meta.url), 'utf8');
const sw = await readFile(new URL('../sw.js', import.meta.url), 'utf8');

function setup({ level=16, sceneId='SCN_FOREST_L016_CORE', encounterId='ENC_FOREST_02', variantId='ENC_FOREST_02_CAT', participants=['cat'], window=[16,19] }={}) {
  let storyMeta = { worldId:'forest', packageVersion:'0.03', sceneId, areaId:'AREA_FOREST_TREES', levelId:level, status:'active', encounterRouting:{encounterId,selectedVariant:variantId,participants,routedAtLevel:level,committedAt:'x'} };
  const meta = new Map(); const commands=[];
  const store = {
    async getMeta(key){ return key === 'story:forest:active' ? storyMeta : (meta.get(key) ?? null); },
    async setMeta(key,value){ meta.set(key,value); },
    async commit(command,key,value){ commands.push(command); meta.set(key,value); return command; },
  };
  const definitions = { encounters:[{id:encounterId,window}] };
  const base = {
    async restore(){ return storyMeta; }, async sync(){ return {ok:true}; },
    async bootstrap(){ return { encounters:definitions, active:storyMeta }; },
    async beginScene(){ return {state:storyMeta,replayed:false}; },
    async beginRoutedEncounter(){ return {state:storyMeta,replayed:false}; },
    async completeScene(){ return {state:{...storyMeta,status:'completed'},replayed:false}; },
  };
  const router = { routeForLevel(){ return {status:'selected',encounterId}; } };
  const sandbox = { console, Date, SolivocNarrativeStore:store, SolivocForestStory:base, SolivocStoryEncounterRouting:router }; sandbox.globalThis=sandbox;
  vm.runInNewContext(source,sandbox,{filename:'story-encounter-lifecycle.js'});
  return { sandbox, commands, meta, get story(){ return sandbox.SolivocForestStory; }, setStory(value){ storyMeta=value; } };
}

test('routed encounter becomes an independent crash-safe lifecycle', async()=>{
  const x=setup(); const boot=await x.story.bootstrap();
  assert.equal(boot.encounterLifecycle.status,'active');
  assert.equal(boot.encounterLifecycle.variantId,'ENC_FOREST_02_CAT');
  assert.deepEqual(Array.from(boot.encounterLifecycle.window),[16,19]);
  assert.equal(x.meta.get('story:forest:encounter-lifecycle').encounterId,'ENC_FOREST_02');
});

test('active lifecycle suppresses re-routing through the same encounter window', async()=>{
  const x=setup(); await x.story.bootstrap();
  const decision=x.sandbox.SolivocStoryEncounterRouting.routeForLevel({definitions:{encounters:[{id:'ENC_FOREST_02',window:[16,19]}]},level:18});
  assert.equal(decision.status,'already-active');
  assert.equal(decision.selectedVariant,'ENC_FOREST_02_CAT');
});

test('semantic encounter beats are idempotent and never become preference evidence', async()=>{
  const x=setup(); await x.story.bootstrap();
  assert.equal((await x.story.recordEncounterBeat('shared-task')).replayed,false);
  assert.equal((await x.story.recordEncounterBeat('shared-task')).replayed,true);
  assert.equal(x.commands.length,1);
  const event=x.commands[0].events[0];
  assert.equal(event.eventKey,'FOREST_THREAD_STATE_CHANGED');
  assert.equal(event.payload.reason,'encounter_beat');
  assert.equal(event.payload.profileEligible,false);
  assert.equal(event.payload.preferenceEligible,false);
});

test('relationship milestones require an explicit authored encounter outcome', async()=>{
  const x=setup(); await x.story.bootstrap(); await x.story.recordEncounterBeat('shared-task');
  const done=await x.story.completeRoutedEncounter({outcomeKey:'cat-understanding',milestones:{cat:['understanding_established']},evidenceBeatIds:['shared-task']});
  assert.equal(done.lifecycle.status,'completed');
  assert.deepEqual(Array.from(x.commands.at(-1).events,e=>e.eventKey),['FOREST_RELATIONSHIP_MILESTONE','FOREST_ENCOUNTER_COMPLETED']);
  assert.equal(x.commands.at(-1).events[0].payload.milestone,'understanding_established');
  const y=setup(); await y.story.bootstrap();
  await assert.rejects(()=>y.story.completeRoutedEncounter({milestones:{owl:['understanding_established']}}),/encounter_outcome_character_not_participant/);
});

test('temporary alliance has separate start and completion events', async()=>{
  const x=setup({level:76,sceneId:'SCN_FOREST_L076_CORE',encounterId:'ENC_FOREST_08',variantId:'ENC_FOREST_08_CAT',participants:['cat'],window:[76,79]});
  await x.story.bootstrap();
  await assert.rejects(()=>x.story.completeRoutedEncounter({temporaryAllianceCompleted:true}),/temporary_alliance_not_started/);
  await x.story.startTemporaryAlliance();
  const done=await x.story.completeRoutedEncounter({outcomeKey:'alliance-complete',milestones:{cat:['cooperation_established']},temporaryAllianceCompleted:true});
  assert.equal(done.lifecycle.temporaryAllianceCompleted,true);
  assert.deepEqual(Array.from(x.commands.at(-1).events,e=>e.eventKey),['FOREST_RELATIONSHIP_MILESTONE','FOREST_TEMPORARY_ALLIANCE_COMPLETED','FOREST_ENCOUNTER_COMPLETED']);
});

test('encounter deadline cannot complete before its authored outcome', async()=>{
  const x=setup({level:19,sceneId:'SCN_FOREST_L019_CORE'}); await x.story.bootstrap();
  await assert.rejects(()=>x.story.completeScene('SCN_FOREST_L019_CORE'),/story_encounter_outcome_required/);
  assert.equal(x.commands[0].events[0].payload.encounterProgress.beatKind,'core-gameplay');
});

test('loader and service worker place lifecycle after routing and before presentation',()=>{
  const routing=loader.indexOf('story-routing-projection');
  const lifecycle=loader.indexOf('story-encounter-lifecycle');
  const presentation=loader.indexOf('story-presentation');
  assert.ok(routing>=0 && lifecycle>routing && presentation>lifecycle);
  assert.match(sw,/\.\/js\/narrative\/story-encounter-lifecycle\.js/);
});
