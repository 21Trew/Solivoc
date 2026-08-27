import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../js/narrative/story-routing-projection.js", import.meta.url), "utf8");
const engine = await readFile(new URL("../js/narrative/relation-rule-engine.js", import.meta.url), "utf8");
const sw = await readFile(new URL("../sw.js", import.meta.url), "utf8");
const endpoint = await readFile(new URL("../api/semantic-events.mjs", import.meta.url), "utf8");

function projectionResponse(snapshot, completedIds = [], sourceSequence = 42) {
  return {
    ok: true,
    status: 200,
    async json() {
      return {
        ok: true,
        mode: "cache",
        rebuilt: false,
        version: 1,
        projection: {
          world_id: "forest",
          source_sequence: sourceSequence,
          projection_version: 1,
          routing_snapshot: snapshot,
          encounters: { completed_ids: completedIds },
        },
      };
    },
  };
}

function makeSandbox({ pending = [], response = null, signedIn = true } = {}) {
  const calls = { api: 0, routed: 0, started: [] };
  const sandbox = {
    console,
    accountSignedIn: () => signedIn,
    SolivocNarrativeStore: { async pending() { return pending; } },
    apiFetch: async () => {
      calls.api++;
      return response || projectionResponse({ threads: {}, relationships: {} });
    },
    SolivocStoryEncounterRouting: {
      routeForLevel({ level, snapshot, completedEncounterIds }) {
        calls.routed++;
        if (completedEncounterIds.includes("ENC_FOREST_02")) return { status: "no-window", level };
        if (snapshot?.threads?.cat?.active) return {
          status: "selected",
          encounterId: "ENC_FOREST_02",
          level,
          selectedVariant: "ENC_FOREST_02_CAT",
          participants: ["cat"],
          eligibleVariants: ["ENC_FOREST_02_CAT", "ENC_FOREST_02_OWL"],
          reasons: ["THREAD_CONTINUITY"],
          routingContractVersion: "forest-routing@1",
          deadline: false,
        };
        return { status: "defer", encounterId: "ENC_FOREST_02", level, eligibleVariants: ["ENC_FOREST_02_CAT", "ENC_FOREST_02_OWL"] };
      },
    },
    addEventListener() {},
  };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(source, sandbox, { filename: "story-routing-projection.js" });
  return { sandbox, calls };
}

function installRuntime(sandbox, calls, level = 17) {
  let active = null;
  const encounters = {
    routingContractVersion: "forest-routing@1",
    encounters: [{ id: "ENC_FOREST_02", window: [16, 19], variants: [] }],
  };
  sandbox.SolivocForestStory = {
    async bootstrap() {
      return { encounters, document: { scenes: [{ id: `SCN_FOREST_L${String(level).padStart(3, "0")}_CORE`, level }] }, active };
    },
    async beginScene() {
      active = { worldId: "forest", sceneId: `SCN_FOREST_L${String(level).padStart(3, "0")}_CORE`, levelId: level, status: "active" };
      return { state: active, replayed: false };
    },
    async beginRoutedEncounter(_sceneId, decision) {
      calls.started.push(decision);
      active = {
        ...active,
        encounterId: decision.encounterId,
        encounterVariantId: decision.selectedVariant,
        encounterRouting: {
          encounterId: decision.encounterId,
          selectedVariant: decision.selectedVariant,
          participants: [...decision.participants],
          eligibleVariants: [...decision.eligibleVariants],
          reasons: [...decision.reasons],
          routingContractVersion: decision.routingContractVersion,
          deadline: decision.deadline,
        },
      };
      return { state: active, replayed: false };
    },
    async completeScene() { return { state: active }; },
    async restore() { return active; },
    async sync() { return { attempted: 0, acknowledged: 0, stoppedReason: null }; },
  };
  return sandbox.SolivocForestStory;
}

test("active Story level automatically routes from the server projection and persists the selected encounter", async () => {
  const { sandbox, calls } = makeSandbox({
    response: projectionResponse({ threads: { cat: { active: true }, owl: { active: false } }, relationships: {} }),
  });
  const story = installRuntime(sandbox, calls, 17);
  const result = await story.beginScene("SCN_FOREST_L017_CORE");
  assert.equal(story.__solivocProjectionRoutingIntegrated, true);
  assert.equal(calls.api, 1);
  assert.equal(calls.routed, 1);
  assert.equal(calls.started.length, 1);
  assert.equal(calls.started[0].selectedVariant, "ENC_FOREST_02_CAT");
  assert.equal(calls.started[0].projectionSourceSequence, 42);
  assert.equal(result.state.encounterVariantId, "ENC_FOREST_02_CAT");
});

test("unsynced semantic commands fail closed instead of routing against an empty or stale snapshot", async () => {
  const { sandbox, calls } = makeSandbox({ pending: [{ commandId: "pending-choice" }] });
  const story = installRuntime(sandbox, calls, 19);
  const decision = await story.routeEncounterForLevel(19);
  assert.equal(decision.status, "routing-unavailable");
  assert.equal(decision.reason, "semantic_commands_pending");
  assert.equal(calls.api, 0);
  assert.equal(calls.routed, 0);
  assert.equal(calls.started.length, 0);
});

test("levels outside authored encounter windows do not fetch a projection", async () => {
  const { sandbox, calls } = makeSandbox();
  const story = installRuntime(sandbox, calls, 12);
  const result = await story.beginScene("SCN_FOREST_L012_CORE");
  assert.equal(result.routingDecision.status, "no-window");
  assert.equal(calls.api, 0);
  assert.equal(calls.routed, 0);
});

test("completed encounter ids from projection suppress replay before client routing", async () => {
  const { sandbox, calls } = makeSandbox({
    response: projectionResponse({ threads: { cat: { active: true } }, relationships: {} }, ["ENC_FOREST_02"]),
  });
  const story = installRuntime(sandbox, calls, 17);
  const decision = await story.routeEncounterForLevel(17);
  assert.equal(decision.status, "no-window");
  assert.equal(calls.routed, 1);
  assert.equal(calls.started.length, 0);
});

test("routing projection module loads after the pure router and before presentation, and is precached", () => {
  const routerAt = engine.indexOf('"story-encounter-routing"');
  const projectionAt = engine.indexOf('"story-routing-projection"');
  const presentationAt = engine.indexOf('"story-presentation"');
  assert.ok(routerAt >= 0 && projectionAt > routerAt && presentationAt > projectionAt);
  assert.match(sw, /"\.\/js\/narrative\/story-routing-projection\.js"/);
});

test("projection API exposes only a routing-safe view instead of the full hidden KnowledgeProjection", () => {
  assert.match(endpoint, /function routingProjectionView\(projection\)/);
  assert.match(endpoint, /routing_snapshot/);
  assert.match(endpoint, /completed_ids/);
  assert.doesNotMatch(endpoint, /return json\(\{ ok: true, projection: data\.projection/);
  assert.doesNotMatch(endpoint, /knowledge:\s*projection/);
});
