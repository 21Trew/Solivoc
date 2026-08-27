import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../js/narrative/story-level1.js", import.meta.url), "utf8");
const scenes = JSON.parse(await readFile(new URL("../content/worlds/forest/v0.03/data/scenes.json", import.meta.url), "utf8"));

test("Level 1 uses a deliberately small unambiguous generated layout", () => {
  assert.match(source, /return \{ cols: 3, cats: 3, difficulty: 1, words: \[3, 3\] \}/);
  assert.match(source, /mode === "story" && \+level === 1/);
});

test("Cat and Owl stay present in Story gameplay without masquerading as the collection companion", () => {
  assert.match(source, /mascot-cat\.svg/);
  assert.match(source, /mascot-owl\.svg/);
  assert.match(source, /ПОЛЯНА · КОТ И СОВА/);
  assert.match(source, /globalThis\.state\.encounterId = ENCOUNTER_ID/);
});

test("onboarding reacts to actual progress instead of forcing a scripted move", () => {
  assert.match(source, /Начни с самой очевидной связи/);
  assert.match(source, /Связь найдена/);
  assert.match(source, /Первая категория собрана/);
  assert.doesNotMatch(source, /performDrop\s*=/);
});

test("completed Level 1 points back into Story toward Level 2", () => {
  assert.match(source, /1\/100 · дальше: «Уже увиденное»/);
  assert.match(source, /Вернуться в Историю →/);
  const first = scenes.scenes.find((scene) => scene.id === "SCN_FOREST_L001_CORE");
  assert.equal(first.nextSceneId, "SCN_FOREST_L002_CORE");
});
