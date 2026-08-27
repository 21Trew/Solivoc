import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../js/narrative/story-routing-projection.js", import.meta.url), "utf8");

test("mandatory encounter deadline cannot complete while projection routing is unavailable", async () => {
  let completed = false;
  const sandbox = {
    console,
    accountSignedIn: () => true,
    SolivocNarrativeStore: { async pending() { return [{ commandId: "unsynced" }]; } },
    apiFetch: async () => { throw new Error("must_not_fetch_with_pending_commands"); },
    SolivocStoryEncounterRouting: { routeForLevel() { throw new Error("must_not_route_without_projection"); } },
    addEventListener() {},
  };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(source, sandbox, { filename: "story-routing-projection.js" });

  const active = { worldId: "forest", sceneId: "SCN_FOREST_L019_CORE", levelId: 19, status: "active" };
  sandbox.SolivocForestStory = {
    async bootstrap() {
      return {
        encounters: { encounters: [{ id: "ENC_FOREST_02", window: [16, 19] }] },
        document: { scenes: [{ id: active.sceneId, level: 19 }] },
        active,
      };
    },
    async restore() { return active; },
    async sync() { return { attempted: 1, acknowledged: 0, stoppedReason: "unauthorized" }; },
    async beginRoutedEncounter() { throw new Error("must_not_begin_encounter"); },
    async completeScene() { completed = true; return { state: { ...active, status: "completed" } }; },
  };

  await assert.rejects(
    () => sandbox.SolivocForestStory.completeScene(active.sceneId),
    /story_encounter_routing_blocked:routing-unavailable/,
  );
  assert.equal(completed, false);
});
