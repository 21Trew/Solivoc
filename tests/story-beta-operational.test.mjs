import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const routingSource = await readFile(new URL("../js/narrative/story-routing-projection.js", import.meta.url), "utf8");
const storySource = await readFile(new URL("../js/narrative/story-runtime.js", import.meta.url), "utf8");
const scenes = JSON.parse(await readFile(new URL("../content/worlds/forest/v0.03/data/scenes.json", import.meta.url), "utf8"));
const encounters = JSON.parse(await readFile(new URL("../content/worlds/forest/v0.03/data/encounters.json", import.meta.url), "utf8"));
const choices = JSON.parse(await readFile(new URL("../content/worlds/forest/v0.03/data/choices.json", import.meta.url), "utf8"));
const facts = JSON.parse(await readFile(new URL("../content/worlds/forest/v0.03/data/world-facts.json", import.meta.url), "utf8"));
const structures = JSON.parse(await readFile(new URL("../content/worlds/forest/v0.03/data/world-structures.json", import.meta.url), "utf8"));
const manifest = JSON.parse(await readFile(new URL("../content/worlds/forest/v0.03/package.manifest.json", import.meta.url), "utf8"));

function routingSandbox({ signedIn = true, pending = [], fetchImpl = null } = {}) {
  const calls = { api: 0, sync: 0, bootstrap: 0 };
  const listeners = {};
  const runtime = {
    async bootstrap() { calls.bootstrap++; return { active: null, encounters: { encounters: [] }, document: { scenes: [] } }; },
    async sync() { calls.sync++; return { attempted: 0, acknowledged: 0, stoppedReason: null }; },
    async restore() { return null; },
  };
  const sandbox = {
    console,
    accountSignedIn: () => signedIn,
    SolivocNarrativeStore: { async pending() { return pending; } },
    SolivocForestStory: runtime,
    apiFetch: async (...args) => { calls.api++; if (fetchImpl) return fetchImpl(...args); throw new Error("network_down"); },
    addEventListener(type, callback) { listeners[type] = callback; },
  };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(routingSource, sandbox, { filename: "story-routing-projection.js" });
  return { sandbox, calls, listeners };
}

function storyRuntime(meta) {
  const docs = {
    "data/scenes.json": scenes,
    "data/encounters.json": encounters,
    "data/choices.json": choices,
    "data/world-facts.json": facts,
    "data/world-structures.json": structures,
  };
  const store = {
    async getMeta() { return meta; },
    async commit(_command, _key, value) { meta = value; return value; },
    async flush() { return { attempted: 0, acknowledged: 0, stoppedReason: null }; },
  };
  const content = {
    rulesFile: "data/rules.json",
    async loadManifest() { return manifest; },
    async loadRuntimeFile(_manifest, file) { return docs[file]; },
    async loadAndRegisterRelations() { return { report: { ok: true } }; },
  };
  const sandbox = { console, Date, setTimeout, clearTimeout, SolivocNarrativeStore: store, SolivocWorldContent: content, addEventListener() {} };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(storySource, sandbox, { filename: "story-runtime.js" });
  return sandbox.SolivocForestStory;
}

test("signed-out personalized routing fails closed without touching the projection API", async () => {
  const ctx = routingSandbox({ signedIn: false });
  const result = await ctx.sandbox.SolivocStoryProjectionRouting.routingProjection();
  assert.equal(result.status, "unavailable");
  assert.equal(result.reason, "auth_required");
  assert.equal(result.retryable, false);
  assert.equal(ctx.calls.api, 0);
  assert.equal(ctx.calls.sync, 0);
});

test("projection network failure fails closed instead of routing from stale local state", async () => {
  const ctx = routingSandbox({ signedIn: true, fetchImpl: async () => { throw new Error("offline"); } });
  const result = await ctx.sandbox.SolivocStoryProjectionRouting.routingProjection();
  assert.equal(result.status, "unavailable");
  assert.equal(result.reason, "projection_network_error");
  assert.equal(result.retryable, true);
  assert.equal(ctx.calls.sync, 1);
  assert.equal(ctx.calls.api, 1);
});

test("online transition retries Story bootstrap after an offline routing failure", async () => {
  const ctx = routingSandbox({ signedIn: true });
  assert.equal(typeof ctx.listeners.online, "function");
  ctx.listeners.online();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(ctx.calls.bootstrap, 1);
});

test("Story restore ignores stale world/package and unknown-scene local state", async () => {
  const wrongPackage = storyRuntime({ worldId: "forest", packageVersion: "0.02", sceneId: "SCN_FOREST_L016_CORE", status: "active" });
  assert.equal(await wrongPackage.restore(), null);
  const wrongWorld = storyRuntime({ worldId: "other", packageVersion: "0.03", sceneId: "SCN_FOREST_L016_CORE", status: "active" });
  assert.equal(await wrongWorld.restore(), null);
  const unknownScene = storyRuntime({ worldId: "forest", packageVersion: "0.03", sceneId: "SCN_FOREST_L999_CORE", status: "active" });
  assert.equal(await unknownScene.restore(), null);
});

test("valid active Story state survives a runtime reload", async () => {
  const meta = { worldId: "forest", packageVersion: "0.03", sceneId: "SCN_FOREST_L016_CORE", areaId: "AREA_FOREST_TREES", levelId: 16, status: "active", forcedTutorials: {}, choiceSelections: {} };
  const story = storyRuntime(meta);
  const restored = await story.restore();
  assert.equal(restored.sceneId, "SCN_FOREST_L016_CORE");
  assert.equal(restored.levelId, 16);
  assert.equal(restored.status, "active");
});
