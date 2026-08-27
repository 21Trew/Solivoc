import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../js/narrative/story-encounter-presentation.js", import.meta.url), "utf8");
const contract = JSON.parse(await readFile(new URL("../content/worlds/forest/v0.03/data/encounter-presentation.json", import.meta.url), "utf8"));
const manifest = JSON.parse(await readFile(new URL("../content/worlds/forest/v0.03/package.manifest.json", import.meta.url), "utf8"));
const engine = await readFile(new URL("../js/narrative/relation-rule-engine.js", import.meta.url), "utf8");
const sw = await readFile(new URL("../sw.js", import.meta.url), "utf8");

function load(extra = {}) {
  const sandbox = { console, ...extra };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(source, sandbox, { filename: "story-encounter-presentation.js" });
  return sandbox;
}

test("Forest encounter presentation exports authored kernels for every routed mascot variant", () => {
  assert.equal(contract.schemaVersion, 1);
  assert.equal(contract.copyStatus, "AUTHORED_KERNEL_NOT_FINAL_DIALOGUE");
  assert.equal(Object.keys(contract.variants).length, 35);
  for (const [variantId, entry] of Object.entries(contract.variants)) {
    assert.match(variantId, /^ENC_FOREST_(?:0[2-9]|10)_/);
    assert.ok(entry.coreContradiction.length > 8);
    assert.equal(typeof entry.outcome, "object");
  }
  assert.equal(contract.encounterPolicies.ENC_FOREST_08.requiredStartLevel, 76);
});

test("Encounter 8 outcome requires the complete 76-79 shared-task evidence and preserves authored prerequisites", () => {
  const { SolivocStoryEncounterPresentation: runtime } = load();
  const definition = { id: "ENC_FOREST_08", function: "cooperation + temporary alliance", variants: [{ id: "ENC_FOREST_08_CAT", relationshipTarget: "COOPERATION_TEMPORARY_ALLIANCE" }] };
  const lifecycle = { status: "active", encounterId: "ENC_FOREST_08", variantId: "ENC_FOREST_08_CAT", participants: ["cat"], window: [76,79], beatOrder: ["gameplay:a","gameplay:b","gameplay:c","gameplay:d"] };
  const presentation = runtime.modelFor(lifecycle, contract, { encounters: { encounters: [definition] } });
  const readyProjection = { snapshot: { relationships: { cat: { milestones: { understanding_established: true, reciprocity_established: true, cooperation_established: false } } } } };
  assert.equal(runtime.outcomePlan({ ...lifecycle, beatOrder: ["gameplay:a"] }, presentation, readyProjection).status, "evidence-incomplete");
  assert.equal(runtime.outcomePlan(lifecycle, presentation, { snapshot: { relationships: { cat: { milestones: { understanding_established: true } } } } }).status, "prerequisite-missing");
  const plan = runtime.outcomePlan(lifecycle, presentation, readyProjection);
  assert.equal(plan.status, "ready");
  assert.equal(plan.temporaryAlliance, true);
  assert.deepEqual(JSON.parse(JSON.stringify(plan.milestones)), { cat: ["cooperation_established"] });
});

test("candidate reciprocity encounters do not silently grant reciprocity", () => {
  const { SolivocStoryEncounterPresentation: runtime } = load();
  const definition = { id: "ENC_FOREST_03", function: "first true divergence", variants: [{ id: "ENC_FOREST_03_CAT", relationshipTarget: "RECIPROCITY_CANDIDATE" }] };
  const lifecycle = { status: "active", encounterId: "ENC_FOREST_03", variantId: "ENC_FOREST_03_CAT", participants: ["cat"], window: [25,29], beatOrder: ["gameplay:a"] };
  const presentation = runtime.modelFor(lifecycle, contract, { encounters: { encounters: [definition] } });
  const plan = runtime.outcomePlan(lifecycle, presentation, { snapshot: { relationships: { cat: { milestones: {} } } } });
  assert.equal(plan.status, "ready");
  assert.deepEqual(JSON.parse(JSON.stringify(plan.milestones)), {});
  assert.equal(plan.outcomeKey, "RELATIONSHIP_HISTORY_EARNED");
});

test("Encounter 10 cannot be completed by the generic presenter", () => {
  const { SolivocStoryEncounterPresentation: runtime } = load();
  const lifecycle = { status: "active", encounterId: "ENC_FOREST_10", variantId: "ENC_FOREST_10_OWL", participants: ["owl"], window: [89,90], beatOrder: ["gameplay:a"] };
  const presentation = runtime.modelFor(lifecycle, contract, { encounters: { encounters: [{ id: "ENC_FOREST_10", function: "Relationship Synthesis", variants: [{ id: "ENC_FOREST_10_OWL", relationshipTarget: "RELATIONSHIP_SYNTHESIS_COMPANION" }] }] } });
  const plan = runtime.outcomePlan(lifecycle, presentation, {});
  assert.equal(plan.status, "primitive-required");
  assert.equal(plan.requiredPrimitive, "relationship-synthesis");
});

test("required multi-level encounter start fails closed instead of allowing Level 76 to pass without Encounter 8", async () => {
  const sandbox = load({
    SolivocWorldContent: {
      async loadManifest() { return { runtimeFiles: ["data/encounter-presentation.json"] }; },
      async loadRuntimeFile() { return contract; },
    },
    SolivocForestStory: {
      encounterLifecycle: () => null,
      routeEncounterForLevel: async () => ({ status: "defer", encounterId: "ENC_FOREST_08" }),
    },
  });
  await sandbox.SolivocStoryEncounterPresentation.loadContract();
  await assert.rejects(() => sandbox.SolivocStoryEncounterPresentation.ensureRequiredStartResolved({ levelId: 76, sceneId: "SCN_FOREST_L076_CORE" }), /story_encounter_required_start_unresolved:ENC_FOREST_08/);
});

test("presenter is packaged between lifecycle and Story presentation and is available offline", () => {
  assert.ok(manifest.runtimeFiles.includes("data/encounter-presentation.json"));
  const lifecycleAt = engine.indexOf('"story-encounter-lifecycle"');
  const encounterPresentationAt = engine.indexOf('"story-encounter-presentation"');
  const storyPresentationAt = engine.indexOf('"story-presentation"');
  assert.ok(lifecycleAt >= 0 && encounterPresentationAt > lifecycleAt && storyPresentationAt > encounterPresentationAt);
  for (const asset of ["./js/narrative/story-encounter-presentation.js", "./content/worlds/forest/v0.03/data/encounter-presentation.json"]) assert.ok(sw.includes(JSON.stringify(asset)), `missing SW asset: ${asset}`);
});
