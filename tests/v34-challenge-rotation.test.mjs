import test from "node:test";
import assert from "node:assert/strict";

await import(new URL(`../js/v34-product-update.js?test=${Date.now()}`, import.meta.url));
const api = globalThis.__solivocV34Test;

test("v34 exposes deterministic rotation helpers", () => {
  assert.ok(api);
  const defs = Array.from({ length: 10 }, (_, i) => ({ id:`q${i}` }));
  assert.equal(api.chooseRotatingDefinition(defs, [], "same").id, api.chooseRotatingDefinition(defs, [], "same").id);
});

test("weekly/monthly challenge cannot repeat inside previous five periods", () => {
  const defs = Array.from({ length: 10 }, (_, i) => ({ id:`q${i}` }));
  const history = [];
  for (let i = 0; i < 120; i++) {
    const picked = api.chooseRotatingDefinition(defs, history.slice(-5), `period:${i}`);
    assert.ok(picked);
    assert.equal(history.slice(-5).includes(picked.id), false, `repeat too early at period ${i}: ${picked.id}`);
    history.push(picked.id);
  }
});

test("world/chapter mapping stays stable", () => {
  assert.equal(api.worldForChapter(1), 1);
  assert.equal(api.worldForChapter(10), 1);
  assert.equal(api.worldForChapter(11), 2);
  assert.equal(api.chapterInWorld(17), 7);
});
