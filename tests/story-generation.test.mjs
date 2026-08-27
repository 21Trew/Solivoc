import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../js/narrative/story-generation.js", import.meta.url), "utf8");
const scenes = JSON.parse(await readFile(new URL("../content/worlds/forest/v0.03/data/scenes.json", import.meta.url), "utf8"));

function load(extra = {}) {
  const sandbox = { console, ...extra };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(source, sandbox, { filename: "story-generation.js" });
  return sandbox;
}

test("guided profile is shared by onboarding levels instead of level-specific config", () => {
  const { SolivocStoryGeneration } = load();
  for (const level of [1, 2, 3])
    assert.equal(JSON.stringify(SolivocStoryGeneration.configForLevel(level, () => 0.5)), JSON.stringify({ cols: 3, cats: 3, difficulty: 1, words: [3, 3] }));
  assert.equal(SolivocStoryGeneration.profileFor(4), "standard");
});

test("standard Story profile reuses the existing procedural difficulty curve", () => {
  let calls = 0;
  const { SolivocStoryGeneration } = load({
    regularConfig(level, rng, special) {
      calls++;
      return { cols: 4, cats: 5, difficulty: 2, words: [4, 6], level, special };
    },
  });
  const cfg = SolivocStoryGeneration.configForLevel(20, () => 0.5);
  assert.equal(calls, 1);
  assert.equal(cfg.level, 20);
  assert.equal(cfg.special, null);
});

test("Story seed is deterministic per player but different between players", () => {
  const { SolivocStoryGeneration } = load();
  const context = { worldId: "forest", sceneId: "SCN_FOREST_L002_CORE", level: 2 };
  const first = SolivocStoryGeneration.seedFor(context, "account:a");
  assert.equal(first, SolivocStoryGeneration.seedFor(context, "account:a"));
  assert.notEqual(first, SolivocStoryGeneration.seedFor(context, "account:b"));
  assert.match(first, /^story:forest:SCN_FOREST_L002_CORE:g1:p/);
});

test("active Story seed survives restart and account transition", () => {
  const { SolivocStoryGeneration } = load({
    state: { mode: "story", worldId: "forest", sceneId: "SCN_FOREST_L002_CORE", level: 2, seed: "persisted-seed" },
  });
  const options = SolivocStoryGeneration.optionsForLevel(2, { mode: "story", storySceneId: "SCN_FOREST_L002_CORE" }, "account:new");
  assert.equal(options.seed, "persisted-seed");
});

test("Story generation always requests solver guard and owns only Story mode", () => {
  const originalConfig = (level, mode) => ({ level, mode, legacy: true });
  const originalBuild = (level, options) => ({ level, options });
  const originalMake = (level, options) => ({ level, options });
  const sandbox = load({ configForMode: originalConfig, buildGeneratedLevel: originalBuild, makeLevel: originalMake });
  sandbox.SolivocStoryGeneration.installHooks();
  assert.equal(sandbox.configForMode(7, "daily").legacy, true);
  assert.equal(JSON.stringify(sandbox.configForMode(2, "story", () => 0.5)), JSON.stringify({ cols: 3, cats: 3, difficulty: 1, words: [3, 3] }));
  const built = sandbox.buildGeneratedLevel(2, { mode: "story", seed: "legacy-global-seed" });
  assert.equal(built.options.forceSolvable, true);
  assert.notEqual(built.options.seed, "legacy-global-seed");
});

test("scene data declares generation profiles instead of authored card sets", () => {
  const level1 = scenes.scenes.find((scene) => scene.id === "SCN_FOREST_L001_CORE");
  const level2 = scenes.scenes.find((scene) => scene.id === "SCN_FOREST_L002_CORE");
  for (const scene of [level1, level2]) {
    assert.equal(scene.generation.profile, "guided");
    assert.equal(scene.generation.cardSourceMode, "words");
    assert.equal(scene.generation.forceSolvable, true);
    assert.equal("cards" in scene.generation, false);
    assert.equal("categories" in scene.generation, false);
  }
});

test("level-specific Story modules no longer own procedural configuration", async () => {
  const level1 = await readFile(new URL("../js/narrative/story-level1.js", import.meta.url), "utf8");
  const level2 = await readFile(new URL("../js/narrative/story-level2.js", import.meta.url), "utf8");
  assert.doesNotMatch(level1, /levelOneConfig|forestLevelOneConfig|configForMode\s*=/);
  assert.doesNotMatch(level2, /levelTwoConfig|forestLevelTwoConfig|STORY_SEED|configForMode\s*=/);
  assert.match(level2, /storySceneId: SCENE_ID/);
});

test("Story generation loads after presentation and before level-specific UI, and is precached", async () => {
  const engine = await readFile(new URL("../js/narrative/relation-rule-engine.js", import.meta.url), "utf8");
  const sw = await readFile(new URL("../sw.js", import.meta.url), "utf8");
  assert.ok(engine.indexOf('"story-presentation"') < engine.indexOf('"story-generation"'));
  assert.ok(engine.indexOf('"story-generation"') < engine.indexOf('"story-level1"'));
  assert.ok(engine.indexOf('"story-generation"') < engine.indexOf('"story-level2"'));
  assert.match(sw, /"\.\/js\/narrative\/story-generation\.js"/);
});
