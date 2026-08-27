import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const storySource = await readFile(new URL("../js/narrative/story-runtime.js", import.meta.url), "utf8");
const storeSource = await readFile(new URL("../js/narrative/event-store.js", import.meta.url), "utf8");
const scenes = JSON.parse(await readFile(new URL("../content/worlds/forest/v0.03/data/scenes.json", import.meta.url), "utf8"));
const manifest = JSON.parse(await readFile(new URL("../content/worlds/forest/v0.03/package.manifest.json", import.meta.url), "utf8"));

function makeRuntime(shared = {}, document = scenes) {
  let meta = shared.meta ?? null;
  const commands = shared.commands ?? [];
  const store = {
    async getMeta() { return meta; },
    async commit(command, key, value) { commands.push({ command, key, value }); meta = value; shared.meta = value; return command; },
    async flush() { return { attempted: commands.length, acknowledged: 0, stoppedReason: null }; },
  };
  const content = {
    rulesFile: "data/rules.json",
    async loadManifest() { return manifest; },
    async loadRuntimeFile(_manifest, file) { if (file !== "data/scenes.json") throw new Error("unexpected_runtime_file"); return document; },
    async loadAndRegisterRelations() { return { report: { ok: true } }; },
  };
  const sandbox = { console, Date, setTimeout, clearTimeout, SolivocNarrativeStore: store, SolivocWorldContent: content, addEventListener() {} };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(storySource, sandbox, { filename: "story-runtime.js" });
  return sandbox.SolivocForestStory;
}

async function completeThrough(story, sceneId, perspectiveId = null) {
  await story.beginScene(sceneId);
  if (perspectiveId) await story.useForcedPerspective(sceneId, perspectiveId);
  return story.completeScene(sceneId);
}

test("bootstrap loads the ten-scene chapter without implicitly starting", async () => {
  const story = makeRuntime({});
  const result = await story.bootstrap();
  assert.equal(result.document.scenes.length, 10);
  assert.equal(result.active, null);
  assert.equal(story.validateScenesDocument(result.document).ok, true);
});

test("Level 1 atomically starts Encounter 1 and exposes its two latent world facts", async () => {
  const shared = { commands: [] }, story = makeRuntime(shared);
  await story.beginScene();
  const events = Array.from(shared.commands[0].command.events);
  assert.deepEqual(events.map((event) => event.eventKey), [
    "FOREST_LEVEL_STARTED",
    "FOREST_ENCOUNTER_STARTED",
    "FOREST_WORLD_FACT_EXPOSED",
    "FOREST_WORLD_FACT_EXPOSED",
  ]);
  assert.deepEqual(events.slice(2).map((event) => event.payload.world_fact_id), ["WF_F01", "WF_F02"]);
});

test("forced Cat and Owl tutorials use one primitive and cannot complete before use", async () => {
  const shared = { commands: [] }, story = makeRuntime(shared);
  await completeThrough(story, "SCN_FOREST_L001_CORE");
  await story.beginScene("SCN_FOREST_L002_CORE");
  await assert.rejects(() => story.completeScene("SCN_FOREST_L002_CORE"), /story_required_flow_incomplete/);
  const cat = await story.useForcedPerspective("SCN_FOREST_L002_CORE", "cat_memory_echo");
  assert.equal(cat.state.forcedTutorials.cat_memory_echo.preferenceEligible, false);
  await story.completeScene("SCN_FOREST_L002_CORE");
  await story.beginScene("SCN_FOREST_L003_CORE");
  const owl = await story.useForcedPerspective("SCN_FOREST_L003_CORE", "owl_close_look");
  assert.equal(owl.state.forcedTutorials.owl_close_look.characterId, "owl");
  assert.equal(owl.state.forcedTutorials.owl_close_look.profileEligible, false);
});

test("Encounter 1 is completed only when Level 4 completes", async () => {
  const shared = { commands: [] }, story = makeRuntime(shared);
  await completeThrough(story, "SCN_FOREST_L001_CORE");
  await completeThrough(story, "SCN_FOREST_L002_CORE", "cat_memory_echo");
  await completeThrough(story, "SCN_FOREST_L003_CORE", "owl_close_look");
  await story.beginScene("SCN_FOREST_L004_CORE");
  const completed = await story.completeScene("SCN_FOREST_L004_CORE");
  assert.equal(completed.state.encounterId, "ENC_FOREST_01_CAT_OWL");
  const finalCommand = shared.commands.at(-1).command;
  assert.deepEqual(Array.from(finalCommand.events, (event) => event.eventKey), ["FOREST_LEVEL_COMPLETED", "FOREST_ENCOUNTER_COMPLETED"]);
});

test("generic choice stores authored selection as event-only provenance", async () => {
  const shared = { commands: [] }, story = makeRuntime(shared);
  shared.meta = {
    worldId: "forest", packageVersion: "0.03", sceneId: "SCN_FOREST_L005_CORE", areaId: "AREA_FOREST_CLEARING",
    levelId: 5, encounterId: null, nextSceneId: "SCN_FOREST_L006_CORE", forcedTutorials: {}, choiceSelections: {}, status: "active", startedAt: "x", completedAt: null,
  };
  const selected = await story.selectChoice("SCN_FOREST_L005_CORE", "CHOICE_FOREST_L05_ATTENTION", "old_tree_mark");
  assert.equal(selected.state.choiceSelections.CHOICE_FOREST_L05_ATTENTION.optionId, "old_tree_mark");
  const event = shared.commands[0].command.events[0];
  assert.equal(event.eventKey, "FOREST_CHOICE_SELECTED");
  assert.equal(event.payload.choiceKind, "attention");
  assert.equal(event.payload.authoredWeights.memory, 2);
  assert.equal(event.payload.projectionStatus, "EVENT_ONLY");
  assert.equal((await story.selectChoice("SCN_FOREST_L005_CORE", "CHOICE_FOREST_L05_ATTENTION", "old_tree_mark")).replayed, true);
  await assert.rejects(() => story.selectChoice("SCN_FOREST_L005_CORE", "CHOICE_FOREST_L05_ATTENTION", "flower_pattern"), /story_choice_already_selected/);
});

test("required after-gameplay choices block semantic completion until selected", async () => {
  const shared = { commands: [] }, story = makeRuntime(shared);
  shared.meta = {
    worldId: "forest", packageVersion: "0.03", sceneId: "SCN_FOREST_L010_CORE", areaId: "AREA_FOREST_CLEARING",
    levelId: 10, encounterId: null, nextSceneId: null, forcedTutorials: {}, choiceSelections: {}, status: "active", startedAt: "x", completedAt: null,
  };
  await assert.rejects(() => story.completeScene("SCN_FOREST_L010_CORE"), /story_required_flow_incomplete/);
  await story.selectChoice("SCN_FOREST_L010_CORE", "CHOICE_FOREST_L10_ROUTING", "stay_on_clearing");
  assert.equal((await story.completeScene("SCN_FOREST_L010_CORE")).state.status, "completed");
});

test("scene validation fails closed on unknown flow primitive and malformed choice", () => {
  const story = makeRuntime({});
  const badType = structuredClone(scenes);
  badType.scenes[0].flow = { beforeGameplay: [{ type: "magic-unicorn" }] };
  assert.ok(story.validateScenesDocument(badType).errors.includes("unsupported_story_flow_step"));
  const badChoice = structuredClone(scenes);
  badChoice.scenes[4].flow.afterGameplay[0].options = [{ id: "only", label: "Only" }];
  assert.ok(story.validateScenesDocument(badChoice).errors.includes("invalid_story_choice_options"));
});

test("semantic sidecar remains atomic and syncs through semantic-events", () => {
  assert.match(storeSource, /db\.transaction\(\[PENDING, META\], "readwrite"\)/);
  assert.match(storeSource, /apiFetch\("\/api\/semantic-events"/);
  assert.match(storeSource, /await acknowledge\(command\.commandId\)/);
  assert.match(storeSource, /await markAttempt\(command/);
});
