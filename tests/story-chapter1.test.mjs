import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const scenes = JSON.parse(await readFile(new URL("../content/worlds/forest/v0.03/data/scenes.json", import.meta.url), "utf8"));
const runtime = await readFile(new URL("../js/narrative/story-runtime.js", import.meta.url), "utf8");
const choiceRuntime = await readFile(new URL("../js/narrative/story-choice-runtime.js", import.meta.url), "utf8");
const presentation = await readFile(new URL("../js/narrative/story-presentation.js", import.meta.url), "utf8");
const engine = await readFile(new URL("../js/narrative/relation-rule-engine.js", import.meta.url), "utf8");
const sw = await readFile(new URL("../sw.js", import.meta.url), "utf8");

const byLevel = new Map(scenes.scenes.map((scene) => [scene.level, scene]));

test("Forest chapter one exports a continuous authored L1-L10 chain", () => {
  assert.equal(scenes.exportStatus, "chapter-1-runtime");
  assert.equal(scenes.campaign.totalLevels, 100);
  assert.equal(scenes.scenes.length, 10);
  for (let level = 1; level <= 10; level++) {
    const scene = byLevel.get(level);
    assert.ok(scene, `missing level ${level}`);
    assert.equal(scene.id, `SCN_FOREST_L${String(level).padStart(3, "0")}_CORE`);
    assert.equal(scene.areaId, "AREA_FOREST_CLEARING");
    assert.equal(scene.status, "BOUND");
    if (level < 10) assert.equal(scene.nextSceneId, `SCN_FOREST_L${String(level + 1).padStart(3, "0")}_CORE`);
    else assert.equal(scene.nextSceneId, undefined);
  }
});

test("chapter one uses shared generation profiles rather than authored card sets", () => {
  for (let level = 1; level <= 10; level++) {
    const generation = byLevel.get(level).generation;
    assert.equal(generation.profile, level <= 3 ? "guided" : "standard");
    assert.equal(generation.forceSolvable, true);
    assert.equal("cards" in generation, false);
    assert.equal("categories" in generation, false);
  }
});

test("Encounter 1 is one node spanning L1-L4 and closes on Level 4", () => {
  for (let level = 1; level <= 4; level++) assert.equal(byLevel.get(level).presentation.encounterId, "ENC_FOREST_01_CAT_OWL");
  assert.equal(byLevel.get(1).presentation.startsEncounter, true);
  assert.equal(byLevel.get(4).presentation.endsEncounter, true);
  assert.match(runtime, /FOREST_ENCOUNTER_STARTED/);
  assert.match(runtime, /FOREST_ENCOUNTER_COMPLETED/);
});

test("Level 2 and Level 3 share the forced-perspective primitive without per-level JS", () => {
  const l2 = byLevel.get(2).flow.beforeGameplay[0];
  const l3 = byLevel.get(3).flow.beforeGameplay[0];
  assert.equal(l2.type, "forced-perspective");
  assert.equal(l2.perspectiveId, "cat_memory_echo");
  assert.equal(l3.type, "forced-perspective");
  assert.equal(l3.perspectiveId, "owl_close_look");
  assert.match(runtime, /useForcedPerspective/);
  assert.doesNotMatch(engine, /story-level[123]/);
});

test("L5 L8 and L10 use one authored choice primitive with exact stable choice IDs", () => {
  const l5 = byLevel.get(5).flow.afterGameplay[0];
  const l8 = byLevel.get(8).flow.beforeGameplay[0];
  const l10 = byLevel.get(10).flow.afterGameplay[0];
  assert.deepEqual([l5.choiceId, l8.choiceId, l10.choiceId], [
    "CHOICE_FOREST_L05_ATTENTION",
    "CHOICE_FOREST_L08_PERSPECTIVE",
    "CHOICE_FOREST_L10_ROUTING",
  ]);
  assert.equal(l5.options.length, 4);
  assert.equal(l8.options.length, 3);
  assert.equal(l10.options.length, 4);
  assert.deepEqual(l8.options.find((option) => option.id === "cat_memory_echo").weights, { memory: 2, cat_understanding: 1, cat_thread: 1 });
  assert.deepEqual(l10.options.find((option) => option.id === "old_tree").weights, { memory: 3, depth: 2, comparison: 1, cat_thread: 2 });
  assert.match(choiceRuntime, /SolivocStoryChoice/);
  assert.match(runtime, /FOREST_CHOICE_SELECTED/);
  assert.match(runtime, /projectionStatus: "EVENT_ONLY"/);
});

test("conditional Fox weights remain conditional authored provenance", () => {
  const grass = byLevel.get(5).flow.afterGameplay[0].options.find((option) => option.id === "bent_grass");
  const path = byLevel.get(10).flow.afterGameplay[0].options.find((option) => option.id === "narrow_path");
  for (const option of [grass, path]) {
    assert.equal(option.weights.fox_thread, undefined);
    assert.deepEqual(option.conditionalWeights, [{ key: "fox_thread", delta: 1, condition: "factual_evidence" }]);
  }
});

test("Level 7 leaves the un-authored perception gate non-executable", () => {
  const marker = byLevel.get(7).authoredMarkers[0];
  assert.equal(marker.type, "perception-gate");
  assert.equal(marker.status, "NON_EXECUTABLE_UNTIL_AUTHORED");
  assert.equal(marker.failurePenalty, "none");
});

test("generic presentation executes before and after gameplay phases", () => {
  assert.match(presentation, /runPhase\(scene, "beforeGameplay"/);
  assert.match(presentation, /runPhase\(scene, "afterGameplay"/);
  assert.match(presentation, /SolivocStoryPerspective\.runStep/);
  assert.match(presentation, /SolivocStoryChoice\.runStep/);
});

test("choice runtime is ordered before presentation and available offline", () => {
  const choiceAt = engine.indexOf('"story-choice-runtime"');
  const presentationAt = engine.indexOf('"story-presentation"');
  assert.ok(choiceAt >= 0 && presentationAt > choiceAt);
  assert.match(sw, /"\.\/js\/narrative\/story-choice-runtime\.js"/);
});
