import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const scenes = JSON.parse(await readFile(new URL("../content/worlds/forest/v0.03/data/scenes.json", import.meta.url), "utf8"));
const choices = JSON.parse(await readFile(new URL("../content/worlds/forest/v0.03/data/choices.json", import.meta.url), "utf8"));
const runtime = await readFile(new URL("../js/narrative/story-runtime.js", import.meta.url), "utf8");
const choiceRuntime = await readFile(new URL("../js/narrative/story-choice-runtime.js", import.meta.url), "utf8");
const presentation = await readFile(new URL("../js/narrative/story-presentation.js", import.meta.url), "utf8");
const engine = await readFile(new URL("../js/narrative/relation-rule-engine.js", import.meta.url), "utf8");
const sw = await readFile(new URL("../sw.js", import.meta.url), "utf8");

const overlay = (level) => scenes.sceneOverlays[String(level)] || {};
const choiceById = (id) => choices.choices.find((choice) => choice.id === id);

test("chapter one anchors remain the first ten scenes of the full 100-level export", () => {
  assert.equal(scenes.exportStatus, "full-world-core-export"); assert.equal(scenes.campaign.totalLevels, 100); assert.equal(scenes.coreScenes.length, 100);
  for (let level = 1; level <= 10; level++) { const row = scenes.coreScenes[level - 1]; assert.equal(row[0], level); assert.equal(row[1], `SCN_FOREST_L${String(level).padStart(3, "0")}_CORE`); }
});

test("Encounter 1 remains one node spanning L1-L4", () => {
  for (let level = 1; level <= 4; level++) assert.equal(overlay(level).presentation.encounterId, "ENC_FOREST_01_CAT_OWL");
  assert.equal(overlay(1).presentation.startsEncounter, true); assert.equal(overlay(4).presentation.endsEncounter, true); assert.match(runtime, /FOREST_ENCOUNTER_STARTED/); assert.match(runtime, /FOREST_ENCOUNTER_COMPLETED/);
});

test("Level 2 and Level 3 share forced-perspective primitive without per-level JS", () => {
  assert.equal(overlay(2).flow.beforeGameplay[0].perspectiveId, "cat_memory_echo"); assert.equal(overlay(3).flow.beforeGameplay[0].perspectiveId, "owl_close_look"); assert.match(runtime, /useForcedPerspective/); assert.doesNotMatch(engine, /story-level[123]/);
});

test("L5 L8 and L10 stable choices remain authored in shared registry", () => {
  for (const [id, count] of [["CHOICE_FOREST_L05_ATTENTION",4],["CHOICE_FOREST_L08_PERSPECTIVE",3],["CHOICE_FOREST_L10_ROUTING",4]]) assert.equal(choiceById(id).options.length, count);
  assert.deepEqual(choiceById("CHOICE_FOREST_L08_PERSPECTIVE").options.find((option) => option.id === "cat_memory_echo").weights, { memory: 2, cat_understanding: 1, cat_thread: 1 });
  assert.deepEqual(choiceById("CHOICE_FOREST_L10_ROUTING").options.find((option) => option.id === "old_tree").weights, { memory: 3, depth: 2, comparison: 1, cat_thread: 2 });
  assert.match(choiceRuntime, /SolivocStoryChoice/); assert.match(runtime, /FOREST_CHOICE_SELECTED/); assert.match(runtime, /projectionStatus: "EVENT_ONLY"/);
});

test("conditional Fox weights remain conditional provenance", () => {
  const grass = choiceById("CHOICE_FOREST_L05_ATTENTION").options.find((option) => option.id === "bent_grass"); const path = choiceById("CHOICE_FOREST_L10_ROUTING").options.find((option) => option.id === "narrow_path");
  for (const option of [grass, path]) { assert.equal(option.weights.fox_thread, undefined); assert.deepEqual(option.conditionalWeights, [{ key: "fox_thread", delta: 1, condition: "factual_evidence" }]); }
});

test("Level 7 leaves un-authored perception gate non-executable", () => { const marker = overlay(7).authoredMarkers[0]; assert.equal(marker.type, "perception-gate"); assert.equal(marker.status, "NON_EXECUTABLE_UNTIL_AUTHORED"); assert.equal(marker.failurePenalty, "none"); });

test("generic presentation executes before and after gameplay phases", () => { assert.match(presentation, /runPhase\(scene, "beforeGameplay"/); assert.match(presentation, /runPhase\(scene, "afterGameplay"/); assert.match(presentation, /SolivocStoryPerspective\.runStep/); assert.match(presentation, /SolivocStoryChoice\.runStep/); });

test("shared Story runtimes and full registries are available offline", () => {
  const choiceAt = engine.indexOf('"story-choice-runtime"'), presentationAt = engine.indexOf('"story-presentation"'); assert.ok(choiceAt >= 0 && presentationAt > choiceAt);
  for (const asset of ["./content/worlds/forest/v0.03/data/scenes.json","./content/worlds/forest/v0.03/data/choices.json","./content/worlds/forest/v0.03/data/world-facts.json","./content/worlds/forest/v0.03/data/world-structures.json"]) assert.ok(sw.includes(JSON.stringify(asset)), `missing SW asset: ${asset}`);
});
