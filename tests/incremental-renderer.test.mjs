import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

async function loadDirtyPlanner() {
  const source = await read("js/game/renderer/dirty-zones.js");
  const context = vm.createContext({ window: {} });
  vm.runInContext(source, context, { filename: "dirty-zones.js" });
  return context.window.SolivocDirtyZones;
}

test("dirty planner updates only move source and target", async () => {
  const planner = await loadDirtyPlanner();
  const dirty = planner.plan([
    {
      type: "MOVE_APPLIED",
      source: { source: "column", ci: 3 },
      target: { zone: "slot", index: 1 },
    },
    { type: "CARD_REVEALED", columnIndex: 3 },
  ]);
  assert.deepEqual(Array.from(dirty.columns), [3]);
  assert.deepEqual(Array.from(dirty.slots), [1]);
  assert.equal(dirty.stock, false);
  assert.equal(dirty.waste, false);
  assert.equal(dirty.full, false);
});

test("dirty planner limits draw and recycle to stock and waste", async () => {
  const planner = await loadDirtyPlanner();
  for (const type of ["STOCK_DRAWN", "STOCK_RECYCLED"]) {
    const dirty = planner.plan([{ type }]);
    assert.deepEqual(Array.from(dirty.columns), []);
    assert.deepEqual(Array.from(dirty.slots), []);
    assert.equal(dirty.stock, true);
    assert.equal(dirty.waste, true);
    assert.equal(dirty.full, false);
  }
});

test("dirty planner limits category completion to its slot", async () => {
  const planner = await loadDirtyPlanner();
  const dirty = planner.plan([{ type: "CATEGORY_COMPLETED", slotIndex: 4 }]);
  assert.deepEqual(Array.from(dirty.slots), [4]);
  assert.deepEqual(Array.from(dirty.columns), []);
  assert.equal(dirty.full, false);
});

test("undo explicitly requests a full board render", async () => {
  const planner = await loadDirtyPlanner();
  const dirty = planner.plan([{ type: "UNDO_APPLIED" }]);
  assert.equal(dirty.full, true);
});

test("board facade no longer rebuilds the board itself", async () => {
  const source = await read("js/components/board.js");
  assert.match(source, /SolivocGameRenderer\.renderBoard\(\)/);
  assert.match(source, /SolivocGameRenderer\.paint\(result\)/);
  assert.doesNotMatch(source, /tableau\.innerHTML/);
  assert.doesNotMatch(source, /slotsAnchor\.innerHTML/);
});

test("normal move and category completion use incremental paint", async () => {
  const source = await read("js/game/rules.js");
  assert.match(source, /SolivocGameRenderer\.paint\(result\)/);
  assert.doesNotMatch(source, /\brender\(\);/);
});

test("renderer exposes zone-specific update functions", async () => {
  const source = await read("js/game/renderer/board-renderer.js");
  for (const name of ["updateColumn", "updateSlot", "updateStock", "updateWaste", "updateHud", "renderBoard", "paint"]) {
    assert.match(source, new RegExp(`function ${name}\\b`));
  }
  assert.doesNotMatch(source, /tableau\.innerHTML\s*=/);
  assert.doesNotMatch(source, /slotsAnchor\.innerHTML\s*=/);
  assert.match(source, /if \(full\) recordVisibleKnowledge/);
  assert.match(source, /else recordEffectKnowledge\(result\)/);
});

test("incremental knowledge tracking is reveal and draw driven", async () => {
  const renderer = await read("js/game/renderer/board-renderer.js");
  const knowledge = await read("js/game/renderer/knowledge-events.js");
  assert.match(renderer, /CARD_REVEALED/);
  assert.match(renderer, /STOCK_DRAWN/);
  assert.match(renderer, /recordKnowledgeCards\(cards, state\)/);
  assert.match(knowledge, /registerVisibleCategoryDiscovery/);
  assert.match(knowledge, /categoryStat\(card\.cat\)/);
});

test("frontend build loads renderer before legacy patches", async () => {
  const source = await read("scripts/build-frontend.mjs");
  const engine = source.indexOf("./js/game/engine/controller.js");
  const dirty = source.indexOf("./js/game/renderer/dirty-zones.js");
  const renderer = source.indexOf("./js/game/renderer/board-renderer.js");
  const v30 = source.indexOf("./js/v30-patch.js");
  assert.ok(engine >= 0);
  assert.ok(dirty > engine);
  assert.ok(renderer > dirty);
  assert.ok(v30 > renderer);
});
