import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const storySource = await readFile(new URL("../js/narrative/story-runtime.js", import.meta.url), "utf8");
const scenes = JSON.parse(await readFile(new URL("../content/worlds/forest/v0.03/data/scenes.json", import.meta.url), "utf8"));
const manifest = JSON.parse(await readFile(new URL("../content/worlds/forest/v0.03/package.manifest.json", import.meta.url), "utf8"));

function makeRuntime(shared = {}) {
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
    async loadRuntimeFile(_manifest, file) { if (file !== "data/scenes.json") throw new Error("unexpected_runtime_file"); return scenes; },
    async loadAndRegisterRelations() { return { report: { ok: true } }; },
  };
  const sandbox = { console, Date, setTimeout, clearTimeout, SolivocNarrativeStore: store, SolivocWorldContent: content, addEventListener() {} };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(storySource, sandbox, { filename: "story-runtime.js" });
  return sandbox.SolivocForestStory;
}

test("Level 2 export binds the forced Cat perspective without inventing its effect", () => {
  const scene = scenes.scenes.find((item) => item.id === "SCN_FOREST_L002_CORE");
  assert.equal(scene?.meaning, "Уже увиденное");
  assert.equal(scene?.worldFacts?.[0]?.id, "WF_F03");
  assert.equal(scene?.presentation?.tutorial?.sceneId, "SCN_FOREST_L002_CAT_PERSPECTIVE_TUTORIAL");
  assert.equal(scene?.presentation?.tutorial?.perspectiveId, "cat_memory_echo");
  assert.equal(scene?.presentation?.tutorial?.forced, true);
  assert.equal(scene?.presentation?.tutorial?.effectStatus, "TBD_AUTHORED");
});

test("starting Level 2 records level start and authored world-fact exposure", async () => {
  const shared = { commands: [], meta: { worldId: "forest", packageVersion: "0.03", sceneId: "SCN_FOREST_L001_CORE", status: "completed" } };
  const story = makeRuntime(shared);
  await story.beginScene("SCN_FOREST_L002_CORE");
  const keys = shared.commands[0].command.events.map((event) => event.eventKey);
  assert.deepEqual(Array.from(keys), ["FOREST_LEVEL_STARTED", "FOREST_WORLD_FACT_EXPOSED"]);
  const exposure = shared.commands[0].command.events[1];
  assert.equal(exposure.payload.world_fact_id, "WF_F03");
  assert.equal(exposure.payload.exposure_mode, "background_visible");
});

test("forced Echo of Memory is durable, idempotent and profile-ineligible", async () => {
  const shared = { commands: [], meta: { worldId: "forest", packageVersion: "0.03", sceneId: "SCN_FOREST_L001_CORE", status: "completed" } };
  const story = makeRuntime(shared);
  await story.beginScene("SCN_FOREST_L002_CORE");
  const first = await story.useForcedPerspective("SCN_FOREST_L002_CORE", "cat_memory_echo");
  assert.equal(first.replayed, false);
  const event = shared.commands[1].command.events[0];
  assert.equal(event.eventKey, "FOREST_THREAD_STATE_CHANGED");
  assert.equal(event.payload.profileEligible, false);
  assert.equal(event.payload.preferenceEligible, false);
  assert.equal(event.payload.familiarityEligible, true);
  assert.equal(event.payload.reason, "forced_tutorial");
  assert.equal(first.state.forcedTutorials.cat_memory_echo.used, true);
  const replay = await story.useForcedPerspective("SCN_FOREST_L002_CORE", "cat_memory_echo");
  assert.equal(replay.replayed, true);
  assert.equal(shared.commands.length, 2);
});

test("Level 2 cannot complete before mandatory perspective action", async () => {
  const shared = { commands: [], meta: { worldId: "forest", packageVersion: "0.03", sceneId: "SCN_FOREST_L001_CORE", status: "completed" } };
  const story = makeRuntime(shared);
  await story.beginScene("SCN_FOREST_L002_CORE");
  await assert.rejects(story.completeScene("SCN_FOREST_L002_CORE"), /story_forced_tutorial_incomplete/);
  await story.useForcedPerspective("SCN_FOREST_L002_CORE", "cat_memory_echo");
  const completed = await story.completeScene("SCN_FOREST_L002_CORE");
  assert.equal(completed.state.status, "completed");
  assert.equal(shared.commands.at(-1).command.events[0].eventKey, "FOREST_LEVEL_COMPLETED");
});
