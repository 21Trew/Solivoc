import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../js/narrative/story-generation.js", import.meta.url), "utf8");
const scenes = JSON.parse(await readFile(new URL("../content/worlds/forest/v0.03/data/scenes.json", import.meta.url), "utf8"));

function load(extra = {}) { const sandbox = { console, ...extra }; sandbox.globalThis = sandbox; vm.runInNewContext(source, sandbox, { filename: "story-generation.js" }); return sandbox; }

test("guided profile is shared by onboarding levels instead of level-specific config", () => {
  const { SolivocStoryGeneration } = load();
  for (const level of [1, 2, 3]) assert.equal(JSON.stringify(SolivocStoryGeneration.configForLevel(level, () => 0.5)), JSON.stringify({ cols: 3, cats: 3, difficulty: 1, words: [3, 3] }));
  assert.equal(SolivocStoryGeneration.profileFor(4), "standard");
});

test("standard Story profile reuses the existing procedural difficulty curve", () => {
  let calls = 0;
  const { SolivocStoryGeneration } = load({ regularConfig(level, rng, special) { calls++; return { cols: 4, cats: 5, difficulty: 2, words: [4, 6], level, special }; } });
  const cfg = SolivocStoryGeneration.configForLevel(20, () => 0.5);
  assert.equal(calls, 1); assert.equal(cfg.level, 20); assert.equal(cfg.special, null);
});

test("Story seed is deterministic per player but different between players", () => {
  const { SolivocStoryGeneration } = load(); const context = { worldId: "forest", sceneId: "SCN_FOREST_L002_CORE", level: 2 };
  const first = SolivocStoryGeneration.seedFor(context, "account:a");
  assert.equal(first, SolivocStoryGeneration.seedFor(context, "account:a")); assert.notEqual(first, SolivocStoryGeneration.seedFor(context, "account:b")); assert.match(first, /^story:forest:SCN_FOREST_L002_CORE:g1:p/);
});

test("active Story seed survives restart and account transition", () => {
  const { SolivocStoryGeneration } = load({ state: { mode: "story", worldId: "forest", sceneId: "SCN_FOREST_L002_CORE", level: 2, seed: "persisted-seed" } });
  assert.equal(SolivocStoryGeneration.optionsForLevel(2, { mode: "story", storySceneId: "SCN_FOREST_L002_CORE" }, "account:new").seed, "persisted-seed");
});

test("Story generation always requests solver guard and owns only Story mode", () => {
  const sandbox = load({ configForMode: (level, mode) => ({ level, mode, legacy: true }), buildGeneratedLevel: (level, options) => ({ level, options }), makeLevel: (level, options) => ({ level, options }) });
  sandbox.SolivocStoryGeneration.installHooks();
  assert.equal(sandbox.configForMode(7, "daily").legacy, true);
  assert.equal(JSON.stringify(sandbox.configForMode(2, "story", () => 0.5)), JSON.stringify({ cols: 3, cats: 3, difficulty: 1, words: [3, 3] }));
  const built = sandbox.buildGeneratedLevel(42, { mode: "story", seed: "legacy-global-seed" });
  assert.equal(built.options.forceSolvable, true); assert.notEqual(built.options.seed, "legacy-global-seed");
});

test("Forest exports 100 core anchors without authored card sets", () => {
  assert.equal(scenes.exportStatus, "full-world-core-export");
  assert.equal(scenes.coreScenes.length, 100);
  assert.equal(scenes.runtimeDefaults.generationProfile, "standard");
  assert.equal(scenes.runtimeDefaults.cardSourceMode, "words");
  assert.equal(scenes.runtimeDefaults.forceSolvable, true);
  assert.equal(JSON.stringify(scenes).includes('"cards"'), false);
  assert.equal(JSON.stringify(scenes).includes('"categories"'), false);
});

test("Story generation is loaded once before reusable flow and presentation runtimes", async () => {
  const engine = await readFile(new URL("../js/narrative/relation-rule-engine.js", import.meta.url), "utf8");
  const sw = await readFile(new URL("../sw.js", import.meta.url), "utf8");
  const generationAt = engine.indexOf('"story-generation"'), perspectiveAt = engine.indexOf('"story-perspective-runtime"'), choiceAt = engine.indexOf('"story-choice-runtime"'), presentationAt = engine.indexOf('"story-presentation"');
  assert.ok(generationAt >= 0 && perspectiveAt > generationAt && choiceAt > perspectiveAt && presentationAt > choiceAt);
  assert.doesNotMatch(engine, /story-level1|story-level2|story-level3/);
  assert.match(sw, /"\.\/js\/narrative\/story-generation\.js"/);
  assert.match(sw, /"\.\/js\/narrative\/story-perspective-runtime\.js"/);
  assert.match(sw, /"\.\/js\/narrative\/story-choice-runtime\.js"/);
});
