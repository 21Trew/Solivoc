import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const sw = await readFile(new URL("../sw.js", import.meta.url), "utf8");
const loader = await readFile(new URL("../js/narrative/relation-rule-engine.js", import.meta.url), "utf8");
const ui = await readFile(new URL("../js/narrative/story-knowledge-ui.js", import.meta.url), "utf8");

test("Knowledge UX assets are explicitly precached", () => {
  assert.match(sw, /\.\/js\/narrative\/story-knowledge-ui\.js/);
  assert.match(sw, /\.\/content\/worlds\/forest\/v0\.03\/data\/knowledge-ui\.json/);
});

test("Knowledge UX loads after Story presentation", () => {
  const presentation = loader.indexOf('["story-presentation", "./js/narrative/story-presentation.js"]');
  const knowledge = loader.indexOf('["story-knowledge-ui", "./js/narrative/story-knowledge-ui.js"]');
  assert.ok(presentation >= 0 && knowledge > presentation);
});

test("Knowledge provenance copy does not claim an unproven first connection", () => {
  assert.doesNotMatch(ui, /Впервые связано с ур\./);
  assert.match(ui, /Основание: ур\./);
});
