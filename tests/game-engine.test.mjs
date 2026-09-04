import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../js/game/engine/core.js", import.meta.url), "utf8");

function loadEngine() {
  const root = {};
  const context = vm.createContext({
    window: root,
    globalThis: root,
    structuredClone,
    JSON,
    Number,
    Math,
    Object,
    Array,
    String,
    Set,
  });
  vm.runInContext(source, context, { filename: "game-engine/core.js" });
  return root.SolivocGameEngine;
}

function card(uid, cat, type = "word", total = 0, label = uid) {
  return { uid, cat, type, total, label };
}

function group(cards, faceUp = true) {
  return { cards, faceUp };
}

function baseState() {
  return {
    level: 1,
    mode: "regular",
    completed: 0,
    totalCategories: 2,
    columns: [
      [
        group([card("hidden-a", "a")], false),
        group([card("cat-a", "a", "category", 2, "А")], true),
      ],
      [group([card("word-a1", "a")], true)],
      [],
    ],
    slots: [null, null],
    stock: [card("stock-a", "a"), card("stock-b", "b")],
    waste: [],
    run: { moves: 0, recycles: 0, hints: 0, undos: 0 },
  };
}

const json = (value) => JSON.parse(JSON.stringify(value));

test("engine has no DOM, storage, network or presentation calls", () => {
  for (const forbidden of [
    /\bdocument\b/,
    /localStorage/,
    /sessionStorage/,
    /\bfetch\s*\(/,
    /playSfx/,
    /\bhaptic\b/,
    /\bprofile\b/,
    /\brender\s*\(/,
    /\bsave\s*\(/,
  ]) assert.doesNotMatch(source, forbidden);
});

test("same state and command produce the same transition", () => {
  const engine = loadEngine();
  const initial = baseState();
  const command = {
    type: engine.COMMAND.MOVE_CARD,
    source: { zone: "column", index: 0, start: 1 },
    target: { zone: "slot", index: 0 },
  };
  const first = json(engine.reduce(initial, command));
  const second = json(engine.reduce(initial, command));
  assert.deepEqual(first, second);
  assert.deepEqual(initial, baseState());
});

test("move validation rejects malformed indexes instead of clamping", () => {
  const engine = loadEngine();
  const state = baseState();
  const badSource = engine.reduce(state, {
    type: engine.COMMAND.MOVE_CARD,
    source: { zone: "column", index: 99 },
    target: { zone: "slot", index: 0 },
  });
  assert.equal(badSource.accepted, false);
  assert.equal(badSource.reason, "invalid_source");

  const badTarget = engine.reduce(state, {
    type: engine.COMMAND.MOVE_CARD,
    source: { zone: "column", index: 0, start: 1 },
    target: { zone: "slot", index: -1 },
  });
  assert.equal(badTarget.accepted, false);
  assert.equal(badTarget.reason, "invalid_target");
});

test("moving from a column reveals the previous card via effect", () => {
  const engine = loadEngine();
  const result = engine.reduce(baseState(), {
    type: engine.COMMAND.MOVE_CARD,
    source: { zone: "column", index: 0, start: 1 },
    target: { zone: "slot", index: 0 },
  });
  assert.equal(result.accepted, true);
  assert.equal(result.state.columns[0][0].faceUp, true);
  assert.equal(result.state.run.moves, 1);
  assert.ok(result.effects.some((effect) => effect.type === "CARD_REVEALED" && effect.uid === "hidden-a"));
  assert.ok(result.effects.some((effect) => effect.type === "MOVE_APPLIED"));
});

test("stock draw and recycle are deterministic commands", () => {
  const engine = loadEngine();
  const first = engine.reduce(baseState(), { type: engine.COMMAND.DRAW_STOCK });
  assert.equal(first.accepted, true);
  assert.equal(first.state.stock.length, 1);
  assert.equal(first.state.waste.at(-1).uid, "stock-b");
  assert.equal(first.state.run.moves, 1);

  const recycleState = { ...baseState(), stock: [], waste: [card("one", "a"), card("two", "b")], run: { moves: 4, recycles: 0 } };
  const recycled = engine.reduce(recycleState, { type: engine.COMMAND.RECYCLE_WASTE });
  assert.equal(recycled.accepted, true);
  assert.deepEqual(Array.from(recycled.state.stock, (item) => item.uid), ["two", "one"]);
  assert.equal(recycled.state.waste.length, 0);
  assert.equal(recycled.state.run.recycles, 1);
  assert.equal(recycled.state.run.moves, 5);
});

test("recycle limit is enforced without mutating input", () => {
  const engine = loadEngine();
  const initial = { ...baseState(), stock: [], waste: [card("one", "a")], special: { maxRecycles: 1 }, run: { moves: 4, recycles: 1 } };
  const before = json(initial);
  const result = engine.reduce(initial, { type: engine.COMMAND.RECYCLE_WASTE });
  assert.equal(result.accepted, false);
  assert.equal(result.reason, "recycle_limit");
  assert.deepEqual(initial, before);
});

test("hint query and USE_HINT are pure and deterministic", () => {
  const engine = loadEngine();
  const initial = baseState();
  const queryOne = json(engine.findHint(initial));
  const queryTwo = json(engine.findHint(initial));
  assert.deepEqual(queryOne, queryTwo);
  assert.deepEqual(initial, baseState());

  const result = engine.reduce(initial, { type: engine.COMMAND.USE_HINT });
  assert.equal(result.accepted, true);
  assert.equal(result.state.run.hints, 1);
  assert.ok(result.effects.some((effect) => effect.type === "HINT_REQUESTED"));
});

test("complete category is a separate state command", () => {
  const engine = loadEngine();
  const initial = baseState();
  initial.slots[0] = group([
    card("cat-a", "a", "category", 2, "А"),
    card("word-a1", "a"),
    card("word-a2", "a"),
  ]);
  const result = engine.reduce(initial, { type: engine.COMMAND.COMPLETE_CATEGORY, slotIndex: 0 });
  assert.equal(result.accepted, true);
  assert.equal(result.state.slots[0], null);
  assert.equal(result.state.completed, 1);
  assert.deepEqual(initial.slots[0].cards.map((item) => item.uid), ["cat-a", "word-a1", "word-a2"]);
  assert.ok(result.effects.some((effect) => effect.type === "CATEGORY_COMPLETED" && effect.category.cat === "a"));
});

test("undo replaces state from explicit snapshot only", () => {
  const engine = loadEngine();
  const current = baseState();
  current.run.moves = 9;
  const previous = baseState();
  previous.run.moves = 3;
  const result = engine.reduce(current, { type: engine.COMMAND.UNDO, snapshot: previous, undoCount: 2 });
  assert.equal(result.accepted, true);
  assert.equal(result.state.run.moves, 3);
  assert.equal(result.state.run.undos, 2);
  assert.equal(current.run.moves, 9);
});

test("command sequence has reproducible final state", () => {
  const engine = loadEngine();
  const commands = [
    { type: engine.COMMAND.DRAW_STOCK },
    { type: engine.COMMAND.DRAW_STOCK },
    { type: engine.COMMAND.RECYCLE_WASTE },
  ];
  const run = () => commands.reduce((state, command) => {
    const result = engine.reduce(state, command);
    assert.equal(result.accepted, true);
    return result.state;
  }, baseState());
  assert.deepEqual(json(run()), json(run()));
});
