import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const storySource = await readFile(new URL("../js/narrative/story-runtime.js", import.meta.url), "utf8");
const storeSource = await readFile(new URL("../js/narrative/event-store.js", import.meta.url), "utf8");
const scenes = JSON.parse(await readFile(new URL("../content/worlds/forest/v0.03/data/scenes.json", import.meta.url), "utf8"));
const manifest = JSON.parse(await readFile(new URL("../content/worlds/forest/v0.03/package.manifest.json", import.meta.url), "utf8"));

function makeRuntime(shared = {}) {
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
      return scenes;
    },
    async loadAndRegisterRelations() {
      shared.relations = (shared.relations || 0) + 1;
      return { report: { ok: true } };
    },
  };
  const sandbox = {
    console,
    Date,
    setTimeout,
    clearTimeout,
    SolivocNarrativeStore: store,
    SolivocWorldContent: content,
    addEventListener() {},
  };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(storySource, sandbox, { filename: "story-runtime.js" });
  return sandbox.SolivocForestStory;
}

test("Forest scene export contains only the authored first vertical-slice anchor", () => {
  assert.ok(manifest.runtimeFiles.includes("data/scenes.json"));
  assert.equal(scenes.scenes.length, 1);
  const scene = scenes.scenes[0];
  assert.deepEqual(
    { id: scene.id, level: scene.level, areaId: scene.areaId, status: scene.status, meaning: scene.meaning },
    {
      id: "SCN_FOREST_L001_CORE",
      level: 1,
      areaId: "AREA_FOREST_CLEARING",
      status: "BOUND",
      meaning: "Появление",
    },
  );
});

test("bootstrap loads authored content without implicitly starting the scene", async () => {
  const shared = {};
  const story = makeRuntime(shared);
  const result = await story.bootstrap();
  assert.equal(result.document.scenes[0].id, "SCN_FOREST_L001_CORE");
  assert.equal(result.active, null);
  assert.equal(shared.relations, 1);
});

test("beginScene records FOREST_LEVEL_STARTED with stable authored anchors", async () => {
  const shared = { commands: [] };
  const story = makeRuntime(shared);
  const result = await story.beginScene();
  assert.equal(result.replayed, false);
  assert.equal(result.state.status, "active");
  const event = shared.commands[0].command.events[0];
  assert.equal(event.eventKey, "FOREST_LEVEL_STARTED");
  assert.equal(event.sceneId, "SCN_FOREST_L001_CORE");
  assert.equal(event.areaId, "AREA_FOREST_CLEARING");
  assert.equal(event.levelId, 1);
  assert.equal(shared.commands[0].key, "story:forest:active");
});

test("reload restores active Story state without duplicating the start command", async () => {
  const shared = { commands: [] };
  await makeRuntime(shared).beginScene();
  const reloaded = makeRuntime(shared);
  assert.equal((await reloaded.restore()).sceneId, "SCN_FOREST_L001_CORE");
  assert.equal((await reloaded.beginScene()).replayed, true);
  assert.equal(shared.commands.length, 1);
});

test("completion records FOREST_LEVEL_COMPLETED and is idempotent across reload", async () => {
  const shared = { commands: [] };
  const story = makeRuntime(shared);
  await story.beginScene();
  const completed = await story.completeScene();
  assert.equal(completed.state.status, "completed");
  assert.equal(shared.commands[1].command.events[0].eventKey, "FOREST_LEVEL_COMPLETED");
  const reloaded = makeRuntime(shared);
  assert.equal((await reloaded.restore()).status, "completed");
  assert.equal((await reloaded.completeScene()).replayed, true);
  assert.equal(shared.commands.length, 2);
});

test("scene validation rejects malformed or non-executable authored content", () => {
  const story = makeRuntime({});
  const bad = {
    schemaVersion: 1,
    worldId: "forest",
    packageVersion: "0.03",
    scenes: [{ id: "bad id", level: 0, areaId: "", status: "TBD_AUTHORED" }],
  };
  const result = story.validateScenesDocument(bad);
  assert.equal(result.ok, false);
  for (const expected of ["invalid_scene_id", "invalid_scene_level", "invalid_scene_area", "scene_not_bound"])
    assert.ok(result.errors.includes(expected));
});

test("semantic sidecar atomically stores command plus Story meta and syncs through semantic-events", () => {
  assert.match(storeSource, /db\.transaction\(\[PENDING, META\], "readwrite"\)/);
  assert.match(storeSource, /apiFetch\("\/api\/semantic-events"/);
  assert.match(storeSource, /await acknowledge\(command\.commandId\)/);
  assert.match(storeSource, /await markAttempt\(command/);
});
