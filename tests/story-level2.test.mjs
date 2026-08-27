import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../js/narrative/story-level2.js", import.meta.url), "utf8");
const relationSource = await readFile(new URL("../js/narrative/relation-rule-engine.js", import.meta.url), "utf8");
const swSource = await readFile(new URL("../sw.js", import.meta.url), "utf8");

test("Level 2 keeps the generated puzzle deliberately small and safe", () => {
  assert.match(source, /return \{ cols: 3, cats: 3, difficulty: 1, words: \[3, 3\] \}/);
  assert.match(source, /mode === "story" && \+level === 2/);
  assert.match(source, /forceSolvable: true/);
});

test("Echo of Memory is an explicit player action before gameplay", () => {
  const beginAt = source.indexOf("await runtime.beginScene(SCENE_ID)");
  const perspectiveAt = source.indexOf("await runtime.useForcedPerspective(SCENE_ID, PERSPECTIVE_ID)");
  const launchAt = source.indexOf("launchGeneratedLevel(scene)");
  assert.ok(beginAt >= 0 && perspectiveAt > beginAt && launchAt > perspectiveAt);
  assert.match(source, /Попробовать «Эхо памяти»/);
  assert.match(source, /не считается выбором предпочтительной перспективы/);
});

test("Level 2 does not fabricate a gameplay effect for Echo of Memory", () => {
  assert.doesNotMatch(source, /autoMove|performDrop|revealCard|highlightMatching/);
  assert.match(source, /story_forced_perspective_used/);
  assert.match(source, /profileEligible: false/);
});

test("Level 2 module is ordered after presentation and Level 1 and is precached", () => {
  const presentationAt = relationSource.indexOf("story-presentation.js");
  const level1At = relationSource.indexOf("story-level1.js");
  const level2At = relationSource.indexOf("story-level2.js");
  assert.ok(presentationAt >= 0 && level1At > presentationAt && level2At > level1At);
  assert.match(relationSource, /script\.async = false/);
  assert.match(swSource, /"\.\/js\/narrative\/story-level2\.js"/);
});
