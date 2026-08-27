import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../js/narrative/story-presentation.js", import.meta.url), "utf8");
const perspectiveSource = await readFile(new URL("../js/narrative/story-perspective-runtime.js", import.meta.url), "utf8");
const choiceSource = await readFile(new URL("../js/narrative/story-choice-runtime.js", import.meta.url), "utf8");
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

test("presentation is scene-driven instead of hardcoding individual levels", () => {
  assert.doesNotMatch(source, /SCN_FOREST_L00[1-9]_CORE|SCN_FOREST_L010_CORE/);
  assert.doesNotMatch(source, /STORY_SEED|levelOneConfig|levelTwoConfig|forestLevelOneConfig|forestLevelTwoConfig/);
  assert.match(source, /SolivocStoryGeneration\?\.prepare/);
  assert.match(source, /runPhase\(scene, "beforeGameplay"/);
  assert.match(source, /runPhase\(scene, "afterGameplay"/);
});

test("Level 1 onboarding remains a reusable gameplayGuide declaration", () => {
  const first = scenes.scenes.find((scene) => scene.id === "SCN_FOREST_L001_CORE");
  assert.equal(first.presentation.gameplayGuide.type, "core-loop-intro");
  assert.deepEqual(first.presentation.characters, ["cat", "owl"]);
  assert.match(source, /function guideCopy\(type, value\)/);
  assert.match(source, /type !== "core-loop-intro"/);
});

test("forced perspective runtime discovers both Cat and Owl tutorials from flow data", () => {
  const sandbox = { console };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(perspectiveSource, sandbox, { filename: "story-perspective-runtime.js" });
  const runtime = sandbox.SolivocStoryPerspective;
  const second = scenes.scenes.find((scene) => scene.id === "SCN_FOREST_L002_CORE");
  const third = scenes.scenes.find((scene) => scene.id === "SCN_FOREST_L003_CORE");
  assert.equal(runtime.pendingStep(second, { forcedTutorials: {} }).perspectiveId, "cat_memory_echo");
  assert.equal(runtime.pendingStep(third, { forcedTutorials: {} }).perspectiveId, "owl_close_look");
  assert.equal(runtime.pendingStep(second, { forcedTutorials: { cat_memory_echo: { used: true } } }), null);
});

test("choice runtime discovers choices generically in before and after gameplay phases", () => {
  const sandbox = { console };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(choiceSource, sandbox, { filename: "story-choice-runtime.js" });
  const runtime = sandbox.SolivocStoryChoice;
  const level5 = scenes.scenes.find((scene) => scene.level === 5);
  const level8 = scenes.scenes.find((scene) => scene.level === 8);
  assert.equal(runtime.pendingStep(level5, { choiceSelections: {} }, "afterGameplay").choiceId, "CHOICE_FOREST_L05_ATTENTION");
  assert.equal(runtime.pendingStep(level8, { choiceSelections: {} }, "beforeGameplay").choiceId, "CHOICE_FOREST_L08_PERSPECTIVE");
});

test("Story completion stays out of legacy Classic progression and finalizes semantic scene after post-game flow", () => {
  const finishStart = source.indexOf("function finishStory()");
  const finishEnd = source.indexOf("function handleError", finishStart);
  const finishSource = source.slice(finishStart, finishEnd);
  const finalizeStart = source.indexOf("async function finalizeScene");
  const finalizeEnd = source.indexOf("async function startScene", finalizeStart);
  const finalizeSource = source.slice(finalizeStart, finalizeEnd);
  assert.match(finishSource, /finalizeScene\(scene, stars\)/);
  assert.doesNotMatch(finishSource, /currentLevel|starsByLevel|levelsCompleted/);
  assert.match(finishSource, /profile\.stats\.gamesPlayed/);
  assert.match(finalizeSource, /runPhase\(scene, "afterGameplay"/);
  assert.match(finalizeSource, /SolivocForestStory\.completeScene/);
});

test("Story bootstrap loads reusable runtimes in dependency order and PWA precaches them", () => {
  const generationAt = relationSource.indexOf('"story-generation"');
  const perspectiveAt = relationSource.indexOf('"story-perspective-runtime"');
  const choiceAt = relationSource.indexOf('"story-choice-runtime"');
  const presentationAt = relationSource.indexOf('"story-presentation"');
  assert.ok(generationAt >= 0 && perspectiveAt > generationAt && choiceAt > perspectiveAt && presentationAt > choiceAt);
  assert.doesNotMatch(relationSource, /story-level1|story-level2|story-level3/);
  for (const asset of [
    "./js/narrative/story-generation.js",
    "./js/narrative/story-perspective-runtime.js",
    "./js/narrative/story-choice-runtime.js",
    "./js/narrative/story-presentation.js",
    "./js/narrative/content-loader.js",
    "./js/narrative/event-store.js",
    "./js/narrative/story-runtime.js",
    "./content/worlds/forest/v0.03/package.manifest.json",
    "./content/worlds/forest/v0.03/data/scenes.json",
    "./content/worlds/forest/v0.03/data/rules.json",
  ]) assert.ok(swSource.includes(JSON.stringify(asset)), `missing SW asset: ${asset}`);
  assert.doesNotMatch(swSource, /story-level1\.js|story-level2\.js|story-level3\.js/);
});
