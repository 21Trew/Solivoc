import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../js/narrative/story-presentation.js", import.meta.url), "utf8");
const perspectiveSource = await readFile(new URL("../js/narrative/story-perspective-runtime.js", import.meta.url), "utf8");
const choiceSource = await readFile(new URL("../js/narrative/story-choice-runtime.js", import.meta.url), "utf8");
const runtimeSource = await readFile(new URL("../js/narrative/story-runtime.js", import.meta.url), "utf8");
const relationSource = await readFile(new URL("../js/narrative/relation-rule-engine.js", import.meta.url), "utf8");
const swSource = await readFile(new URL("../sw.js", import.meta.url), "utf8");
const rawScenes = JSON.parse(await readFile(new URL("../content/worlds/forest/v0.03/data/scenes.json", import.meta.url), "utf8"));
const choices = JSON.parse(await readFile(new URL("../content/worlds/forest/v0.03/data/choices.json", import.meta.url), "utf8"));

const runtimeSandbox = { console }; runtimeSandbox.globalThis = runtimeSandbox; vm.runInNewContext(runtimeSource, runtimeSandbox, { filename: "story-runtime.js" });
const scenes = runtimeSandbox.SolivocForestStory.normalizeScenesDocument(rawScenes, choices);

test("Story gateway remains separate from free-play Layouts and reads campaign metadata", () => { assert.match(source, /story-gateway/); assert.match(source, /<b>Расклады<\/b><small>Свободная игра и режимы<\/small>/); assert.match(source, /campaign\(\)/); assert.match(source, /totalLevels/); });

test("presentation is scene-driven instead of hardcoding individual levels", () => { assert.doesNotMatch(source, /SCN_FOREST_L00[1-9]_CORE|SCN_FOREST_L010_CORE/); assert.doesNotMatch(source, /STORY_SEED|levelOneConfig|levelTwoConfig/); assert.match(source, /SolivocStoryGeneration\?\.prepare/); assert.match(source, /runPhase\(scene, "beforeGameplay"/); assert.match(source, /runPhase\(scene, "afterGameplay"/); });

test("Level 1 onboarding survives compact-scene normalization", () => { const first = scenes.scenes[0]; assert.equal(first.presentation.gameplayGuide.type, "core-loop-intro"); assert.deepEqual(Array.from(first.presentation.characters), ["cat", "owl"]); assert.match(source, /function guideCopy\(type, value\)/); });

test("forced perspective runtime discovers Cat and Owl tutorials from normalized flow", () => {
  const sandbox = { console }; sandbox.globalThis = sandbox; vm.runInNewContext(perspectiveSource, sandbox, { filename: "story-perspective-runtime.js" }); const runtime = sandbox.SolivocStoryPerspective;
  assert.equal(runtime.pendingStep(scenes.scenes[1], { forcedTutorials: {} }).perspectiveId, "cat_memory_echo"); assert.equal(runtime.pendingStep(scenes.scenes[2], { forcedTutorials: {} }).perspectiveId, "owl_close_look");
});

test("choice runtime discovers registry-bound before and after gameplay choices", () => {
  const sandbox = { console }; sandbox.globalThis = sandbox; vm.runInNewContext(choiceSource, sandbox, { filename: "story-choice-runtime.js" }); const runtime = sandbox.SolivocStoryChoice;
  assert.equal(runtime.pendingStep(scenes.scenes[4], { choiceSelections: {} }, "afterGameplay").choiceId, "CHOICE_FOREST_L05_ATTENTION"); assert.equal(runtime.pendingStep(scenes.scenes[7], { choiceSelections: {} }, "beforeGameplay").choiceId, "CHOICE_FOREST_L08_PERSPECTIVE"); assert.equal(runtime.pendingStep(scenes.scenes[11], { choiceSelections: {} }, "afterGameplay").choiceId, "CHOICE_FOREST_L12_FOREGROUND");
});

test("Story completion stays out of legacy Classic progression", () => { const finishStart = source.indexOf("function finishStory()"), finishEnd = source.indexOf("function handleError", finishStart), finishSource = source.slice(finishStart, finishEnd); assert.match(finishSource, /finalizeScene\(scene, stars\)/); assert.doesNotMatch(finishSource, /currentLevel|starsByLevel|levelsCompleted/); assert.match(finishSource, /profile\.stats\.gamesPlayed/); });

test("Story runtime modules and all Forest registries are precached", () => {
  const generationAt = relationSource.indexOf('"story-generation"'), perspectiveAt = relationSource.indexOf('"story-perspective-runtime"'), choiceAt = relationSource.indexOf('"story-choice-runtime"'), presentationAt = relationSource.indexOf('"story-presentation"'); assert.ok(generationAt >= 0 && perspectiveAt > generationAt && choiceAt > perspectiveAt && presentationAt > choiceAt);
  for (const asset of ["./js/narrative/story-generation.js","./js/narrative/story-perspective-runtime.js","./js/narrative/story-choice-runtime.js","./js/narrative/story-encounter-routing.js","./content/worlds/forest/v0.03/data/scenes.json","./content/worlds/forest/v0.03/data/encounters.json","./content/worlds/forest/v0.03/data/choices.json","./content/worlds/forest/v0.03/data/world-facts.json","./content/worlds/forest/v0.03/data/world-structures.json"]) assert.ok(swSource.includes(JSON.stringify(asset)), `missing SW asset: ${asset}`);
});
