import test from "node:test";
import assert from "node:assert/strict";
import {
  TUTORIAL_STEPS,
  tutorialPhase,
  tutorialDescriptor,
  applyTutorialAction,
  tutorialActionExpected,
} from "../js/tutorial-engine.mjs";

test("tutorial has a descriptor for every interactive phase", () => {
  assert.deepEqual(
    TUTORIAL_STEPS.map(({step, phase}) => `${step}:${phase}`),
    [
      "1:category", "1:collect",
      "2:manual", "2:manual-done",
      "3:auto", "3:auto-done",
      "4:stock", "4:undo", "4:hint", "4:finish",
    ],
  );
});

test("step 1 advances immediately after category placement", () => {
  assert.equal(tutorialPhase(1, {}), "category");
  const actions = applyTutorialAction(1, {}, "category");
  assert.equal(actions.category, true);
  assert.equal(tutorialPhase(1, actions), "collect");
  assert.match(tutorialDescriptor(1, actions).prompt, /собери/i);
});

test("step 2 waits for the manual drag", () => {
  assert.equal(tutorialPhase(2, {}), "manual");
  assert.equal(tutorialActionExpected(2, {}, "manual"), true);
  assert.equal(tutorialPhase(2, applyTutorialAction(2, {}, "manual")), "manual-done");
});

test("step 3 waits for the automatic double tap", () => {
  assert.equal(tutorialPhase(3, {}), "auto");
  assert.equal(tutorialActionExpected(3, {}, "auto"), true);
  assert.equal(tutorialPhase(3, applyTutorialAction(3, {}, "auto")), "auto-done");
});

test("step 4 enforces stock → undo → hint sequence", () => {
  let actions = {};
  assert.equal(tutorialPhase(4, actions), "stock");
  actions = applyTutorialAction(4, actions, "stock");
  assert.equal(tutorialPhase(4, actions), "undo");
  actions = applyTutorialAction(4, actions, "undo");
  assert.equal(tutorialPhase(4, actions), "hint");
  actions = applyTutorialAction(4, actions, "hint");
  assert.equal(tutorialPhase(4, actions), "finish");
});

test("actions from another tutorial step cannot skip the active phase", () => {
  assert.equal(applyTutorialAction(1, {}, "hint").hint, false);
  assert.equal(applyTutorialAction(2, {}, "auto").auto, false);
  assert.equal(applyTutorialAction(3, {}, "manual").manual, false);
});

test("descriptor always exposes a concrete target", () => {
  for (const item of TUTORIAL_STEPS) {
    assert.equal(typeof item.target, "string");
    assert.ok(item.target.length > 0);
  }
});
