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
    async commit(command, key, value) {
      commands.push({ command, key, value });
      meta = value;
      shared.meta = value;
      return command;
    },
    async flush() {
      shared.flushes = (shared.flushes || 0) + 1;
      return { attempted: commands.length, acknowledged: 0, stoppedReason: null };
    },
  };
  const content = {
    rulesFile: "data/rules.json",
    async loadManifest() { return manifest; },
    async loadRuntimeFile(_manifest, file) {
      if (file !== "data/scenes.json") throw new Error("unexpected_runtime_file");
      return document;
    },
    async loadAndRegisterRelations() {
      shared.relations = (shared.relations || 0) + 1;
      return { report: { ok: true } };
    },
  };
  const sandbox = { console, Date, setTimeout, clearTimeout, SolivocNarrativeStore: store, SolivocWorldContent: content, addEventListener() {} };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(storySource, sandbox, { filename: "story-runtime.js" });
  return sandbox.SolivocForestStory;
}

test("Story content declares campaign metadata and reusable flow primitives", () => {
  assert.ok(manifest.runtimeFiles.includes("data/scenes.json"));
  assert.equal(scenes.campaign.worldLabel, "Мир Леса");
  assert.equal(scenes.campaign.totalLevels, 100);
  const first = scenes.scenes.find((scene) => scene.id === "SCN_FOREST_L001_CORE");
  const second = scenes.scenes.find((scene) => scene.id === "SCN_FOREST_L002_CORE");
  assert.equal(first.presentation.gameplayGuide.type, "core-loop-intro");
  assert.equal(second.flow.beforeGameplay[0].type, "forced-perspective");
  assert.equal(second.flow.beforeGameplay[0].perspectiveId, "cat_memory_echo");
  assert.equal("tutorial" in second.presentation, false);
});

test("bootstrap loads authored content without implicitly starting a scene", async () => {
  const shared = {};
  const story = makeRuntime(shared);
  const result = await story.bootstrap();
  assert.equal(result.document.scenes[0].id, "SCN_FOREST_L001_CORE");
  assert.equal(result.active, null);
  assert.equal(shared.relations, 1);
});

test("Level 1 starts level and Encounter 1 atomically", async () => {
  const shared = { commands: [] }, story = makeRuntime(shared);
  const result = await story.beginScene();
  assert.equal(result.state.sceneId, "SCN_FOREST_L001_CORE");
  assert.equal(result.state.encounterId, "ENC_FOREST_01_CAT_OWL");
  assert.deepEqual(Array.from(shared.commands[0].command.events, (event) => event.eventKey), ["FOREST_LEVEL_STARTED", "FOREST_ENCOUNTER_STARTED"]);
});

test("reload restores active Story state without duplicate start", async () => {
  const shared = { commands: [] };
  await makeRuntime(shared).beginScene();
  const reloaded = makeRuntime(shared);
  assert.equal((await reloaded.restore()).sceneId, "SCN_FOREST_L001_CORE");
  assert.equal((await reloaded.beginScene()).replayed, true);
  assert.equal(shared.commands.length, 1);
});

test("Level 2 exposes authored world fact without restarting Encounter 1", async () => {
  const shared = { commands: [] }, story = makeRuntime(shared);
  await story.beginScene();
  await story.completeScene();
  const result = await story.beginScene("SCN_FOREST_L002_CORE");
  assert.equal(result.state.encounterId, "ENC_FOREST_01_CAT_OWL");
  const events = Array.from(shared.commands[2].command.events);
  assert.deepEqual(events.map((event) => event.eventKey), ["FOREST_LEVEL_STARTED", "FOREST_WORLD_FACT_EXPOSED"]);
  assert.equal(events[1].payload.world_fact_id, "WF_F03");
});

test("generic forced-perspective primitive blocks completion and stays preference-ineligible", async () => {
  const shared = { commands: [] }, story = makeRuntime(shared);
  await story.beginScene();
  await story.completeScene();
  await story.beginScene("SCN_FOREST_L002_CORE");
  await assert.rejects(() => story.completeScene("SCN_FOREST_L002_CORE"), /story_forced_tutorial_incomplete/);
  const used = await story.useForcedPerspective("SCN_FOREST_L002_CORE", "cat_memory_echo");
  assert.equal(used.state.forcedTutorials.cat_memory_echo.used, true);
  const event = shared.commands[3].command.events[0];
  assert.equal(event.eventKey, "FOREST_THREAD_STATE_CHANGED");
  assert.equal(event.payload.profileEligible, false);
  assert.equal(event.payload.preferenceEligible, false);
  assert.equal(event.payload.reason, "forced_tutorial");
  assert.equal((await story.useForcedPerspective("SCN_FOREST_L002_CORE", "cat_memory_echo")).replayed, true);
  assert.equal(shared.commands.length, 4);
  await story.completeScene("SCN_FOREST_L002_CORE");
  assert.equal(shared.commands[4].command.events[0].eventKey, "FOREST_LEVEL_COMPLETED");
});

test("the same primitive accepts a future Owl Level 3 without level-specific runtime code", async () => {
  const future = structuredClone(scenes);
  future.scenes[1].nextSceneId = "SCN_FOREST_L003_CORE";
  future.scenes.push({
    id: "SCN_FOREST_L003_CORE",
    level: 3,
    areaId: "AREA_FOREST_CLEARING",
    status: "BOUND",
    meaning: "Посмотреть точнее",
    generation: { profile: "guided", cardSourceMode: "words", forceSolvable: true },
    flow: { beforeGameplay: [{ type: "forced-perspective", sceneId: "SCN_FOREST_L003_OWL_PERSPECTIVE_TUTORIAL", perspectiveId: "owl_close_look", label: "Пристальный взгляд", characterId: "owl", threadId: "THREAD_FOREST_OWL", forced: true, effectStatus: "TBD_AUTHORED" }] },
    presentation: { worldLabel: "Мир Леса", areaLabel: "Поляна", gameplaySummary: "", characters: ["owl"], encounterId: "ENC_FOREST_01_CAT_OWL" },
  });
  const shared = { commands: [] };
  shared.meta = { worldId: "forest", packageVersion: "0.03", sceneId: "SCN_FOREST_L002_CORE", areaId: "AREA_FOREST_CLEARING", levelId: 2, status: "completed", forcedTutorials: {}, startedAt: "x", completedAt: "y" };
  const story = makeRuntime(shared, future);
  assert.equal(story.validateScenesDocument(future).ok, true);
  const started = await story.beginScene("SCN_FOREST_L003_CORE");
  assert.equal(started.state.levelId, 3);
  const used = await story.useForcedPerspective("SCN_FOREST_L003_CORE", "owl_close_look");
  assert.equal(used.state.forcedTutorials.owl_close_look.characterId, "owl");
});

test("scene validation fails closed on malformed or unknown flow primitives", () => {
  const story = makeRuntime({});
  const bad = structuredClone(scenes);
  bad.scenes[0].flow = { beforeGameplay: [{ type: "magic-unicorn" }] };
  const result = story.validateScenesDocument(bad);
  assert.equal(result.ok, false);
  assert.ok(result.errors.includes("unsupported_story_flow_step"));
});

test("semantic sidecar atomically stores command plus Story meta and syncs through semantic-events", () => {
  assert.match(storeSource, /db\.transaction\(\[PENDING, META\], "readwrite"\)/);
  assert.match(storeSource, /apiFetch\("\/api\/semantic-events"/);
  assert.match(storeSource, /await acknowledge\(command\.commandId\)/);
  assert.match(storeSource, /await markAttempt\(command/);
});
