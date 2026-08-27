import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../js/narrative/story-encounter-routing.js", import.meta.url), "utf8");
const definitions = JSON.parse(await readFile(new URL("../content/worlds/forest/v0.03/data/encounters.json", import.meta.url), "utf8"));

function load() {
  const sandbox = { console };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(source, sandbox, { filename: "story-encounter-routing.js" });
  return sandbox.SolivocStoryEncounterRouting;
}

function encounter(id) {
  return definitions.encounters.find((item) => item.id === id);
}

test("routing is deterministic and never uses RNG", () => {
  const router = load();
  const snapshot = {
    threads: {
      cat: { active: true, freshVoluntaryContinuation: true },
      owl: { active: false },
    },
  };
  const first = router.routeEncounter({ encounter: encounter("ENC_FOREST_02"), level: 17, snapshot });
  const second = router.routeEncounter({ encounter: encounter("ENC_FOREST_02"), level: 17, snapshot });
  assert.equal(first.status, "selected");
  assert.equal(first.selectedVariant, "ENC_FOREST_02_CAT");
  assert.equal(JSON.stringify(first), JSON.stringify(second));
  assert.doesNotMatch(source, /Math\.random|crypto\.getRandomValues/);
});

test("router defers inside a window when no meaningful evidence exists", () => {
  const router = load();
  const result = router.routeEncounter({ encounter: encounter("ENC_FOREST_02"), level: 16, snapshot: {} });
  assert.equal(result.status, "defer");
  assert.deepEqual(Array.from(result.eligibleVariants), ["ENC_FOREST_02_CAT", "ENC_FOREST_02_OWL"]);
});

test("window deadline uses an eligible authored variant instead of random selection", () => {
  const router = load();
  const result = router.routeEncounter({ encounter: encounter("ENC_FOREST_02"), level: 19, snapshot: {} });
  assert.equal(result.status, "selected");
  assert.equal(result.selectedVariant, "ENC_FOREST_02_CAT");
  assert.ok(result.reasons.includes("WINDOW_DEADLINE"));
  assert.equal(result.deadline, true);
});

test("joint Cat+Owl variant requires its authored scene signal", () => {
  const router = load();
  const enc = encounter("ENC_FOREST_02");
  const withoutSignal = router.routeEncounter({ encounter: enc, level: 19, snapshot: {} });
  assert.ok(!withoutSignal.eligibleVariants.includes("ENC_FOREST_02_CAT_OWL"));
  const withSignal = router.routeEncounter({ encounter: enc, level: 19, snapshot: {}, sceneSignals: ["then_now_change_task"] });
  assert.ok(withSignal.eligibleVariants.includes("ENC_FOREST_02_CAT_OWL"));
});

test("Fox first/continuation variants obey relationship state instead of a cognition maximum", () => {
  const router = load();
  const enc = encounter("ENC_FOREST_04");
  const first = router.routeEncounter({ encounter: enc, level: 39, snapshot: { relationships: { fox: { acquainted: false } } } });
  assert.ok(first.eligibleVariants.includes("ENC_FOREST_04_FOX_FIRST"));
  assert.ok(!first.eligibleVariants.includes("ENC_FOREST_04_FOX_CONTINUATION"));
  const continuation = router.routeEncounter({ encounter: enc, level: 39, snapshot: { relationships: { fox: { acquainted: true } } } });
  assert.ok(!continuation.eligibleVariants.includes("ENC_FOREST_04_FOX_FIRST"));
  assert.ok(continuation.eligibleVariants.includes("ENC_FOREST_04_FOX_CONTINUATION"));
});

test("Encounter 8 hard requirements reject relationships that are not ready", () => {
  const router = load();
  const enc = encounter("ENC_FOREST_08");
  const notReady = router.routeEncounter({ encounter: enc, level: 79, snapshot: {} });
  assert.equal(notReady.status, "deadline-unresolved");
  const ready = router.routeEncounter({
    encounter: enc,
    level: 79,
    snapshot: {
      relationships: {
        cat: { identityKnown: true, acquainted: true, milestones: { understanding_established: true, reciprocity_established: true } },
      },
    },
  });
  assert.equal(ready.status, "selected");
  assert.equal(ready.selectedVariant, "ENC_FOREST_08_CAT");
});

test("Encounter 10 returns an explicit P0 state instead of fabricating missing milestones", () => {
  const router = load();
  const result = router.routeEncounter({ encounter: encounter("ENC_FOREST_10"), level: 90, snapshot: {} });
  assert.equal(result.status, "p0-no-eligible-variant");
  assert.deepEqual(result.eligibleVariants, []);
});

test("completed encounter ids suppress replay", () => {
  const router = load();
  const result = router.routeEncounter({ encounter: encounter("ENC_FOREST_03"), level: 27, completedEncounterIds: ["ENC_FOREST_03"] });
  assert.equal(result.status, "already-completed");
});
