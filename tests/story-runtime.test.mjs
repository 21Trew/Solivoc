import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const storySource = await readFile(new URL("../js/narrative/story-runtime.js", import.meta.url), "utf8");
const storeSource = await readFile(new URL("../js/narrative/event-store.js", import.meta.url), "utf8");
const scenes = JSON.parse(await readFile(new URL("../content/worlds/forest/v0.03/data/scenes.json", import.meta.url), "utf8"));
const encounters = JSON.parse(await readFile(new URL("../content/worlds/forest/v0.03/data/encounters.json", import.meta.url), "utf8"));
const choices = JSON.parse(await readFile(new URL("../content/worlds/forest/v0.03/data/choices.json", import.meta.url), "utf8"));
const facts = JSON.parse(await readFile(new URL("../content/worlds/forest/v0.03/data/world-facts.json", import.meta.url), "utf8"));
const structures = JSON.parse(await readFile(new URL("../content/worlds/forest/v0.03/data/world-structures.json", import.meta.url), "utf8"));
const manifest = JSON.parse(await readFile(new URL("../content/worlds/forest/v0.03/package.manifest.json", import.meta.url), "utf8"));

function makeRuntime(shared = {}, document = scenes) {
  let meta = shared.meta ?? null; const commands = shared.commands ?? [];
  const store = { async getMeta() { return meta; }, async commit(command, key, value) { commands.push({ command, key, value }); meta = value; shared.meta = value; return command; }, async flush() { return { attempted: commands.length, acknowledged: 0, stoppedReason: null }; } };
  const docs = { "data/scenes.json": document, "data/encounters.json": encounters, "data/choices.json": choices, "data/world-facts.json": facts, "data/world-structures.json": structures };
  const content = { rulesFile: "data/rules.json", async loadManifest() { return manifest; }, async loadRuntimeFile(_manifest, file) { if (!(file in docs)) throw new Error(`unexpected_runtime_file:${file}`); return docs[file]; }, async loadAndRegisterRelations() { return { report: { ok: true } }; } };
  const sandbox = { console, Date, setTimeout, clearTimeout, SolivocNarrativeStore: store, SolivocWorldContent: content, addEventListener() {} }; sandbox.globalThis = sandbox;
  vm.runInNewContext(storySource, sandbox, { filename: "story-runtime.js" }); return sandbox.SolivocForestStory;
}

async function completeThrough(story, sceneId, perspectiveId = null) { await story.beginScene(sceneId); if (perspectiveId) await story.useForcedPerspective(sceneId, perspectiveId); return story.completeScene(sceneId); }

test("bootstrap normalizes the complete 100-level Forest export without implicitly starting", async () => {
  const story = makeRuntime({}), result = await story.bootstrap();
  assert.equal(result.document.scenes.length, 100); assert.equal(result.document.scenes[0].id, "SCN_FOREST_L001_CORE"); assert.equal(result.document.scenes.at(-1).id, "SCN_FOREST_L100_CORE"); assert.equal(result.active, null);
  assert.equal(result.facts.facts.length, 70); assert.equal(result.choices.choices.length, 17); assert.equal(story.validateScenesDocument(result.document).ok, true); assert.equal(story.validateEncounterDefinitions(result.encounters).ok, true);
});

test("compact core scenes normalize to continuous authored area-aware objects", () => {
  const story = makeRuntime({}), normalized = story.normalizeScenesDocument(scenes, choices);
  assert.equal(normalized.scenes.length, 100);
  for (let index = 0; index < 100; index++) {
    const scene = normalized.scenes[index], level = index + 1;
    assert.equal(scene.level, level); assert.equal(scene.id, `SCN_FOREST_L${String(level).padStart(3, "0")}_CORE`);
    if (level < 100) assert.equal(scene.nextSceneId, `SCN_FOREST_L${String(level + 1).padStart(3, "0")}_CORE`); else assert.equal(scene.nextSceneId, undefined);
  }
  assert.equal(normalized.scenes[10].areaId, "AREA_FOREST_TREES"); assert.equal(normalized.scenes[90].areaId, "AREA_FOREST_WHOLE");
});

test("Level 1 atomically starts Encounter 1 and exposes two latent world facts", async () => {
  const shared = { commands: [] }, story = makeRuntime(shared); await story.beginScene(); const events = Array.from(shared.commands[0].command.events);
  assert.deepEqual(events.map((event) => event.eventKey), ["FOREST_LEVEL_STARTED", "FOREST_ENCOUNTER_STARTED", "FOREST_WORLD_FACT_EXPOSED", "FOREST_WORLD_FACT_EXPOSED"]); assert.deepEqual(events.slice(2).map((event) => event.payload.world_fact_id), ["WF_F01", "WF_F02"]);
});

test("forced Cat and Owl tutorials use one primitive", async () => {
  const shared = { commands: [] }, story = makeRuntime(shared); await completeThrough(story, "SCN_FOREST_L001_CORE"); await story.beginScene("SCN_FOREST_L002_CORE");
  await assert.rejects(() => story.completeScene("SCN_FOREST_L002_CORE"), /story_required_flow_incomplete/); const cat = await story.useForcedPerspective("SCN_FOREST_L002_CORE", "cat_memory_echo"); assert.equal(cat.state.forcedTutorials.cat_memory_echo.preferenceEligible, false);
  await story.completeScene("SCN_FOREST_L002_CORE"); await story.beginScene("SCN_FOREST_L003_CORE"); assert.equal((await story.useForcedPerspective("SCN_FOREST_L003_CORE", "owl_close_look")).state.forcedTutorials.owl_close_look.characterId, "owl");
});

test("Encounter 1 closes only on Level 4", async () => {
  const shared = { commands: [] }, story = makeRuntime(shared); await completeThrough(story, "SCN_FOREST_L001_CORE"); await completeThrough(story, "SCN_FOREST_L002_CORE", "cat_memory_echo"); await completeThrough(story, "SCN_FOREST_L003_CORE", "owl_close_look"); await story.beginScene("SCN_FOREST_L004_CORE"); const completed = await story.completeScene("SCN_FOREST_L004_CORE");
  assert.equal(completed.state.encounterId, "ENC_FOREST_01_CAT_OWL"); assert.deepEqual(Array.from(shared.commands.at(-1).command.events, (event) => event.eventKey), ["FOREST_LEVEL_COMPLETED", "FOREST_ENCOUNTER_COMPLETED"]);
});

test("choice registry automatically binds only choices with authored phase", async () => {
  const story = makeRuntime({}), document = story.normalizeScenesDocument(scenes, choices);
  assert.equal(document.scenes[11].flow.afterGameplay[0].choiceId, "CHOICE_FOREST_L12_FOREGROUND");
  assert.equal(document.scenes[14].choiceRefs[0], "CHOICE_FOREST_L15_METHOD"); assert.equal(document.scenes[14].flow, undefined);
  assert.equal(document.scenes[19].flow.afterGameplay[0].choiceId, "CHOICE_FOREST_L20_ROUTING");
});

test("late unique mechanics are hard-blocked before semantic start", async () => {
  const shared = { commands: [] }, story = makeRuntime(shared);
  for (const [sceneId, primitive] of [["SCN_FOREST_L090_CORE", "relationship-synthesis"], ["SCN_FOREST_L098_CORE", "authored-revisit"], ["SCN_FOREST_L099_CORE", "world-synthesis"], ["SCN_FOREST_L100_CORE", "elemental-manifestation"]]) await assert.rejects(() => story.beginScene(sceneId), new RegExp(`story_scene_primitive_unavailable:${primitive}`));
  assert.equal(shared.commands.length, 0);
});

test("routed encounter decision is persisted exactly once", async () => {
  const shared = { commands: [] }, story = makeRuntime(shared); shared.meta = { worldId: "forest", packageVersion: "0.03", sceneId: "SCN_FOREST_L016_CORE", areaId: "AREA_FOREST_TREES", levelId: 16, nextSceneId: "SCN_FOREST_L017_CORE", forcedTutorials: {}, choiceSelections: {}, status: "active", startedAt: "x", completedAt: null };
  const decision = { status: "selected", encounterId: "ENC_FOREST_02", selectedVariant: "ENC_FOREST_02_CAT", participants: ["cat"], eligibleVariants: ["ENC_FOREST_02_CAT", "ENC_FOREST_02_OWL"], reasons: ["THREAD_CONTINUITY"], routingContractVersion: "forest-routing@1", deadline: false };
  const first = await story.beginRoutedEncounter("SCN_FOREST_L016_CORE", decision); assert.equal(first.state.encounterVariantId, "ENC_FOREST_02_CAT"); assert.equal(shared.commands[0].command.events[0].eventKey, "FOREST_ENCOUNTER_STARTED"); assert.equal((await story.beginRoutedEncounter("SCN_FOREST_L016_CORE", decision)).replayed, true); assert.equal(shared.commands.length, 1);
});

test("semantic sidecar remains atomic and syncs through semantic-events", () => { assert.match(storeSource, /db\.transaction\(\[PENDING, META\], "readwrite"\)/); assert.match(storeSource, /apiFetch\("\/api\/semantic-events"/); assert.match(storeSource, /await acknowledge\(command\.commandId\)/); assert.match(storeSource, /await markAttempt\(command/); });
