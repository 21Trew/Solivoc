import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../js/narrative/story-presentation.js", import.meta.url), "utf8");
const levelOneSource = await readFile(new URL("../js/narrative/story-level1.js", import.meta.url), "utf8");
const relationSource = await readFile(new URL("../js/narrative/relation-rule-engine.js", import.meta.url), "utf8");
const swSource = await readFile(new URL("../sw.js", import.meta.url), "utf8");
const scenes = JSON.parse(await readFile(new URL("../content/worlds/forest/v0.03/data/scenes.json", import.meta.url), "utf8"));

test("Story gateway presents Story and free-play Layouts as separate product intents", () => {
  assert.match(source, /<small>ИСТОРИЯ<\/small><h2>Мир Леса<\/h2>/);
  assert.match(source, /<b>Расклады<\/b><small>Свободная игра и режимы<\/small>/);
  assert.match(source, /replace\("<span>Режимы<\/span>", "<span>Расклады<\/span>"\)/);
});

test("first Forest presentation uses exported authored scene and encounter metadata", () => {
  const scene = scenes.scenes.find((item) => item.id === "SCN_FOREST_L001_CORE");
  assert.equal(scene?.meaning, "Появление");
  assert.equal(scene?.presentation?.areaLabel, "Поляна");
  assert.equal(scene?.presentation?.gameplaySummary, "Самое базовое различение и очевидная связь.");
  assert.deepEqual(scene?.presentation?.characters, ["cat", "owl"]);
  assert.equal(scene?.presentation?.encounterId, "ENC_FOREST_01_CAT_OWL");
  assert.equal(scene?.presentation?.startsEncounter, true);
});

test("Story launch preflights gameplay before committing the semantic start", () => {
  const preflight = source.indexOf("buildGeneratedLevel?.(scene.level");
  const semanticStart = source.indexOf("await runtime.beginScene(scene.id)");
  const launch = source.indexOf("makeLevel?.(scene.level");
  assert.ok(preflight >= 0 && semanticStart > preflight && launch > semanticStart);
  assert.match(source, /mode: "story"/);
  assert.match(source, /cardSourceMode: "words"/);
});

test("Story completion stays out of legacy Classic progression", () => {
  const start = source.indexOf("function finishStoryLevel()");
  const end = source.indexOf("function installHooks()", start);
  const finishSource = source.slice(start, end);
  assert.match(finishSource, /SolivocForestStory\.completeScene/);
  assert.doesNotMatch(finishSource, /currentLevel|starsByLevel|levelsCompleted/);
  assert.match(finishSource, /profile\.stats\.gamesPlayed/);
});

test("collection mascot presence is suppressed while authored Cat and Owl presence comes from Level 1", () => {
  assert.match(source, /if \(state\?\.mode === "story"\)[\s\S]*gameCompanion[\s\S]*hidden = true/);
  assert.match(levelOneSource, /mascot-cat\.svg/);
  assert.match(levelOneSource, /mascot-owl\.svg/);
});

test("Story presentation and Level 1 onboarding are lazy-loaded and precached", () => {
  assert.match(relationSource, /story-presentation/);
  assert.match(relationSource, /story-level1/);
  assert.match(relationSource, /typeof document === "undefined"/);
  for (const asset of [
    "./js/narrative/story-presentation.js",
    "./js/narrative/story-level1.js",
    "./js/narrative/content-loader.js",
    "./js/narrative/event-store.js",
    "./js/narrative/story-runtime.js",
    "./content/worlds/forest/v0.03/package.manifest.json",
    "./content/worlds/forest/v0.03/data/scenes.json",
    "./content/worlds/forest/v0.03/data/rules.json",
  ]) assert.ok(swSource.includes(JSON.stringify(asset)), `missing SW asset: ${asset}`);
});
