import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../js/narrative/story-presentation.js", import.meta.url), "utf8");
const perspectiveSource = await readFile(new URL("../js/narrative/story-perspective-runtime.js", import.meta.url), "utf8");
const relationSource = await readFile(new URL("../js/narrative/relation-rule-engine.js", import.meta.url), "utf8");
const swSource = await readFile(new URL("../sw.js", import.meta.url), "utf8");
const scenes = JSON.parse(await readFile(new URL("../content/worlds/forest/v0.03/data/scenes.json", import.meta.url), "utf8"));

test("Story gateway remains separate from free-play Layouts and reads campaign metadata", () => {
  assert.match(source, /story-gateway/);
  assert.match(source, /<b>Расклады<\/b><small>Свободная игра и режимы<\/small>/);
  assert.match(source, /campaign\(\)/);
  assert.match(source, /totalLevels/);
  assert.match(source, /replace\("<span>Режимы<\/span>", "<span>Расклады<\/span>"\)/);
});

test("presentation is scene-driven instead of hardcoding Level 1 or Level 2", () => {
  assert.doesNotMatch(source, /SCN_FOREST_L00[12]_CORE/);
  assert.doesNotMatch(source, /STORY_SEED|levelOneConfig|levelTwoConfig|forestLevelOneConfig|forestLevelTwoConfig/);
  assert.match(source, /SolivocStoryGeneration\?\.prepare/);
  assert.match(source, /SolivocStoryPerspective/);
  assert.match(source, /presentation\?\.gameplayGuide/);
});

test("Level 1 onboarding is now a reusable gameplayGuide declaration", () => {
  const first = scenes.scenes.find((scene) => scene.id === "SCN_FOREST_L001_CORE");
  assert.equal(first.presentation.gameplayGuide.type, "core-loop-intro");
  assert.deepEqual(first.presentation.characters, ["cat", "owl"]);
  assert.match(source, /function guideCopy\(type, value\)/);
  assert.match(source, /type !== "core-loop-intro"/);
});

test("forced perspective runtime discovers Level 2 from flow data", () => {
  const sandbox = { console };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(perspectiveSource, sandbox, { filename: "story-perspective-runtime.js" });
  const second = scenes.scenes.find((scene) => scene.id === "SCN_FOREST_L002_CORE");
  const runtime = sandbox.SolivocStoryPerspective;
  assert.equal(runtime.pendingStep(second, { forcedTutorials: {} }).perspectiveId, "cat_memory_echo");
  assert.equal(runtime.pendingStep(second, { forcedTutorials: { cat_memory_echo: { used: true } } }), null);
});

test("Story completion stays out of legacy Classic progression", () => {
  const start = source.indexOf("function finishStory()");
  const end = source.indexOf("function handleError", start);
  const finishSource = source.slice(start, end);
  assert.match(finishSource, /SolivocForestStory\.completeScene/);
  assert.doesNotMatch(finishSource, /currentLevel|starsByLevel|levelsCompleted/);
  assert.match(finishSource, /profile\.stats\.gamesPlayed/);
});

test("Story bootstrap loads reusable runtimes and PWA no longer references per-level modules", () => {
  assert.ok(relationSource.indexOf('"story-generation"') < relationSource.indexOf('"story-perspective-runtime"'));
  assert.ok(relationSource.indexOf('"story-perspective-runtime"') < relationSource.indexOf('"story-presentation"'));
  assert.doesNotMatch(relationSource, /story-level1|story-level2/);
  for (const asset of [
    "./js/narrative/story-generation.js",
    "./js/narrative/story-perspective-runtime.js",
    "./js/narrative/story-presentation.js",
    "./js/narrative/content-loader.js",
    "./js/narrative/event-store.js",
    "./js/narrative/story-runtime.js",
    "./content/worlds/forest/v0.03/package.manifest.json",
    "./content/worlds/forest/v0.03/data/scenes.json",
    "./content/worlds/forest/v0.03/data/rules.json",
  ]) assert.ok(swSource.includes(JSON.stringify(asset)), `missing SW asset: ${asset}`);
  assert.doesNotMatch(swSource, /story-level1\.js|story-level2\.js/);
});
