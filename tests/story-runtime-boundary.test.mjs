import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../js/narrative/story-runtime-boundary.js", import.meta.url), "utf8");
const loader = await readFile(new URL("../js/narrative/relation-rule-engine.js", import.meta.url), "utf8");
const sw = await readFile(new URL("../sw.js", import.meta.url), "utf8");

function makeSandbox() {
  const calls = { commits: [] };
  let persisted = null;
  const encounters = {
    routingContractVersion: "forest-routing@1",
    encounters: [{
      id: "ENC_FOREST_02",
      window: [16, 19],
      variants: [
        { id: "ENC_FOREST_02_CAT", participants: ["cat"] },
        { id: "ENC_FOREST_02_OWL", participants: ["owl"] },
      ],
    }],
  };
  const document = { scenes: [{ id: "SCN_FOREST_L016_CORE", level: 16 }] };
  const store = {
    async commit(command, key, value) { calls.commits.push({ command, key, value }); persisted = value; return command; },
  };
  const sandbox = { console, SolivocNarrativeStore: store };
  sandbox.SolivocForestStory = {
    async bootstrap() { return { document, encounters, active: persisted }; },
    async beginRoutedEncounter(sceneId, decision) {
      const routing = { encounterId: decision.encounterId, selectedVariant: decision.selectedVariant, participants: [...decision.participants], eligibleVariants: [...decision.eligibleVariants], reasons: [...(decision.reasons || [])], routingContractVersion: decision.routingContractVersion, routedAtLevel: 16 };
      const state = { worldId: "forest", sceneId, levelId: 16, status: "active", encounterRouting: routing };
      const event = { eventKey: "FOREST_ENCOUNTER_STARTED", payload: { encounterId: decision.encounterId, variantId: decision.selectedVariant, participants: [...decision.participants] } };
      await sandbox.SolivocNarrativeStore.commit({ commandId: "c1", events: [event] }, "story:forest:active", state);
      return { state, replayed: false };
    },
  };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(source, sandbox, { filename: "story-runtime-boundary.js" });
  return { sandbox, calls, get persisted() { return persisted; } };
}

function validDecision(overrides = {}) {
  return {
    status: "selected",
    encounterId: "ENC_FOREST_02",
    level: 16,
    selectedVariant: "ENC_FOREST_02_CAT",
    participants: ["cat"],
    eligibleVariants: ["ENC_FOREST_02_CAT", "ENC_FOREST_02_OWL"],
    reasons: ["PLAYER_INITIATIVE"],
    routingContractVersion: "forest-routing@1",
    projectionSourceSequence: 77,
    projectionVersion: 1,
    projectionMode: "incremental",
    projectionRebuilt: false,
    ...overrides,
  };
}

test("runtime boundary canonicalizes authored participants and persists projection provenance atomically", async () => {
  const ctx = makeSandbox();
  const result = await ctx.sandbox.SolivocForestStory.beginRoutedEncounter("SCN_FOREST_L016_CORE", validDecision());
  assert.equal(ctx.calls.commits.length, 1);
  assert.deepEqual(Array.from(result.state.encounterRouting.participants), ["cat"]);
  assert.equal(result.state.encounterRouting.projectionSourceSequence, 77);
  assert.equal(result.state.encounterRouting.projectionVersion, 1);
  assert.equal(result.state.encounterRouting.projectionMode, "incremental");
  assert.equal(result.state.encounterRouting.projectionRebuilt, false);
  const payload = ctx.calls.commits[0].command.events[0].payload;
  assert.equal(payload.projectionSourceSequence, 77);
  assert.equal(payload.projectionVersion, 1);
  assert.equal(payload.projectionMode, "incremental");
  assert.equal(ctx.persisted.encounterRouting.projectionSourceSequence, 77);
});

test("runtime boundary rejects forged participants", async () => {
  const ctx = makeSandbox();
  await assert.rejects(() => ctx.sandbox.SolivocForestStory.beginRoutedEncounter("SCN_FOREST_L016_CORE", validDecision({ participants: ["owl"] })), /encounter_routing_participants_mismatch/);
  assert.equal(ctx.calls.commits.length, 0);
});

test("runtime boundary rejects wrong encounter variant, level and contract", async () => {
  const ctx = makeSandbox();
  await assert.rejects(() => ctx.sandbox.SolivocForestStory.beginRoutedEncounter("SCN_FOREST_L016_CORE", validDecision({ selectedVariant: "ENC_FOREST_10_CAT", eligibleVariants: ["ENC_FOREST_10_CAT"] })), /unknown_routed_encounter_variant/);
  await assert.rejects(() => ctx.sandbox.SolivocForestStory.beginRoutedEncounter("SCN_FOREST_L016_CORE", validDecision({ level: 17 })), /encounter_routing_level_mismatch/);
  await assert.rejects(() => ctx.sandbox.SolivocForestStory.beginRoutedEncounter("SCN_FOREST_L016_CORE", validDecision({ routingContractVersion: "forest-routing@0" })), /encounter_routing_contract_mismatch/);
  assert.equal(ctx.calls.commits.length, 0);
});

test("runtime boundary rejects forged eligible variant ids", async () => {
  const ctx = makeSandbox();
  await assert.rejects(() => ctx.sandbox.SolivocForestStory.beginRoutedEncounter("SCN_FOREST_L016_CORE", validDecision({ eligibleVariants: ["ENC_FOREST_02_CAT", "ENC_FAKE"] })), /invalid_encounter_routing_eligible_variants/);
});

test("runtime boundary is loaded after pure router, before projection bridge, and is precached", () => {
  const routerAt = loader.indexOf('["story-encounter-routing"');
  const boundaryAt = loader.indexOf('["story-runtime-boundary"');
  const projectionAt = loader.indexOf('["story-routing-projection"');
  assert.ok(routerAt >= 0 && boundaryAt > routerAt && projectionAt > boundaryAt);
  assert.match(sw, /\.\/js\/narrative\/story-runtime-boundary\.js/);
});
