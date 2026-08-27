import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const runtimeSource = await readFile(new URL("../js/narrative/story-runtime.js", import.meta.url), "utf8");
const scenesRaw = JSON.parse(await readFile(new URL("../content/worlds/forest/v0.03/data/scenes.json", import.meta.url), "utf8"));
const choices = JSON.parse(await readFile(new URL("../content/worlds/forest/v0.03/data/choices.json", import.meta.url), "utf8"));
const facts = JSON.parse(await readFile(new URL("../content/worlds/forest/v0.03/data/world-facts.json", import.meta.url), "utf8"));
const structures = JSON.parse(await readFile(new URL("../content/worlds/forest/v0.03/data/world-structures.json", import.meta.url), "utf8"));
const manifest = JSON.parse(await readFile(new URL("../content/worlds/forest/v0.03/package.manifest.json", import.meta.url), "utf8"));

const sandbox = { console }; sandbox.globalThis = sandbox; vm.runInNewContext(runtimeSource, sandbox, { filename: "story-runtime.js" });
const runtime = sandbox.SolivocForestStory, normalized = runtime.normalizeScenesDocument(scenesRaw, choices);

test("Forest core export is exactly 100 stable authored anchors", () => {
  assert.equal(scenesRaw.exportStatus, "full-world-core-export"); assert.equal(scenesRaw.coreScenes.length, 100); assert.equal(normalized.scenes.length, 100);
  for (let level = 1; level <= 100; level++) { const scene = normalized.scenes[level - 1]; assert.equal(scene.level, level); assert.equal(scene.id, `SCN_FOREST_L${String(level).padStart(3, "0")}_CORE`); assert.equal(scene.status, "BOUND"); if (level < 100) assert.equal(scene.nextSceneId, `SCN_FOREST_L${String(level + 1).padStart(3, "0")}_CORE`); else assert.equal(scene.nextSceneId, undefined); }
  assert.equal(runtime.validateScenesDocument(normalized).ok, true);
});

test("ten authored areas cover exactly ten levels each", () => {
  assert.equal(scenesRaw.campaign.areas.length, 10);
  for (const area of scenesRaw.campaign.areas) { const [from, to] = area.levels; assert.equal(to - from + 1, 10); for (let level = from; level <= to; level++) assert.equal(normalized.scenes[level - 1].areaId, area.id); }
});

test("all authored world facts and choices are exported without invented values", () => {
  assert.equal(facts.facts.length, 70); assert.equal(new Set(facts.facts.map((fact) => fact.id)).size, 70); assert.equal(facts.facts[0].id, "WF_F01"); assert.equal(facts.facts.at(-1).id, "WF_F70");
  assert.equal(choices.choices.length, 17); assert.equal(new Set(choices.choices.map((choice) => choice.id)).size, 17);
  const routing20 = choices.choices.find((choice) => choice.id === "CHOICE_FOREST_L20_ROUTING"); assert.equal(routing20.status, "OPTIONS_BOUND_WEIGHTS_TBD"); assert.ok(routing20.options.every((option) => option.weightStatus === "TBD_WEIGHTS" && option.weights === undefined));
  const method15 = choices.choices.find((choice) => choice.id === "CHOICE_FOREST_L15_METHOD"); assert.equal(method15.phaseStatus, "TBD_AUTHORED"); assert.equal(method15.phase, undefined);
});

test("late Forest authored structures are exported as stable references", () => {
  assert.equal(structures.specialScenes.length, 10); assert.equal(structures.worldEvents.length, 4); assert.equal(structures.reconstructions.length, 5); assert.equal(structures.revisits.length, 11); assert.equal(structures.syntheses.length, 4); assert.equal(structures.threads.length, 5);
  const world = structures.syntheses.find((item) => item.id === "SYN_FOREST_WORLD_01"); assert.equal(world.phases.length, 5); assert.equal(world.revelationActionRef, "KACT_FOREST_INTEGRATE_SYSTEM");
  assert.equal(structures.threads.find((item) => item.id === "THREAD_FUTURE_GUARDIAN").availability, "dormant");
});

test("unique late mechanics remain exported but fail closed until their primitives exist", () => {
  const blocked = new Map([[90,"relationship-synthesis"],[98,"authored-revisit"],[99,"world-synthesis"],[100,"elemental-manifestation"]]);
  for (const [level, primitive] of blocked) { const scene = normalized.scenes[level - 1]; assert.equal(scene.executionStatus, "NON_EXECUTABLE_UNTIL_PRIMITIVE"); assert.equal(scene.requiredPrimitive, primitive); assert.equal(runtime.canExecuteScene(scene), false); assert.equal(scene.generation, undefined); }
  for (const level of [11,20,42,89,91,97]) { const scene = normalized.scenes[level - 1]; assert.equal(scene.executionStatus, "CORE_GAMEPLAY_READY"); assert.equal(scene.generation.profile, "standard"); assert.equal(scene.generation.forceSolvable, true); }
});

test("runtime manifest declares every Forest registry", () => {
  for (const file of ["data/scenes.json","data/encounters.json","data/world-facts.json","data/choices.json","data/world-structures.json","data/rules.json"]) assert.ok(manifest.runtimeFiles.includes(file), `missing runtime file ${file}`);
  assert.equal(manifest.status, "full-world-core-export");
});
