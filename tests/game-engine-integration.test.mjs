import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("frontend bundle loads engine core before controller and app", async () => {
  const source = await read("scripts/build-frontend.mjs");
  const core = source.indexOf("./js/game/engine/core.js");
  const controller = source.indexOf("./js/game/engine/controller.js");
  const patches = source.indexOf("./js/v30-patch.js");
  const app = source.indexOf('const appScriptTag');
  assert.ok(core >= 0);
  assert.ok(controller > core);
  assert.ok(patches > controller);
  assert.ok(app >= 0);
});

test("rules facade delegates validation and board mutations to engine", async () => {
  const source = await read("js/game/rules.js");
  assert.match(source, /SolivocGameEngine\.canDropTo\(state/);
  assert.match(source, /SolivocGameController\.dispatch\(\{/);
  assert.match(source, /COMMAND\.MOVE_CARD/);
  assert.match(source, /COMMAND\.AUTO_MOVE/);
  assert.match(source, /COMMAND\.COMPLETE_CATEGORY/);
  assert.doesNotMatch(source, /state\.run\.moves\+\+/);
  assert.doesNotMatch(source, /state\.slots\[i\] = null/);
  assert.doesNotMatch(source, /function detachPayload/);
});

test("stock UI delegates stock and recycle mutation to engine", async () => {
  const source = await read("js/components/board.js");
  assert.match(source, /COMMAND\.DRAW_STOCK/);
  assert.match(source, /COMMAND\.RECYCLE_WASTE/);
  assert.match(source, /SolivocGameController\.dispatch/);
  assert.doesNotMatch(source, /state\.waste\.push\(state\.stock\.pop\(\)\)/);
  assert.doesNotMatch(source, /state\.stock = state\.waste\.reverse\(\)/);
  assert.doesNotMatch(source, /state\.run\.recycles = \(state\.run\.recycles/);
  assert.doesNotMatch(source, /state\.run\.moves\+\+/);
});

test("undo and hint state transitions are owned by engine", async () => {
  const source = await read("js/app.js");
  assert.match(source, /COMMAND\.UNDO/);
  assert.match(source, /COMMAND\.USE_HINT/);
  assert.match(source, /HINT_REQUESTED/);
  assert.doesNotMatch(source, /state\.run\.hints\+\+/);
  assert.doesNotMatch(source, /state = restoreHistorySnapshot\(previous\)/);
  assert.doesNotMatch(source, /state\.run\.undos = undoCount/);
});

test("controller only bridges command results into global state", async () => {
  const source = await read("js/game/engine/controller.js");
  assert.match(source, /engine\.reduce\(currentState, command\)/);
  assert.match(source, /state = result\.state/);
  for (const forbidden of [/document/, /localStorage/, /fetch\s*\(/, /render\s*\(/, /save\s*\(/, /playSfx/, /haptic/]) {
    assert.doesNotMatch(source, forbidden);
  }
});

test("engine command surface contains staged gameplay commands", async () => {
  const source = await read("js/game/engine/core.js");
  for (const command of [
    "MOVE_CARD",
    "AUTO_MOVE",
    "DRAW_STOCK",
    "RECYCLE_WASTE",
    "USE_HINT",
    "UNDO",
    "RESTART",
    "START_LEVEL",
    "COMPLETE_CATEGORY",
    "FINISH_LEVEL",
  ]) assert.ok(source.includes(`${command}: "${command}"`), `missing ${command}`);
});
