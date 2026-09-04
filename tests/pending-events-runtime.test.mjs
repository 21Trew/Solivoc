import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../js/core/pending-events.js", import.meta.url), "utf8");

function memoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem(key) { return map.has(String(key)) ? map.get(String(key)) : null; },
    setItem(key, value) { map.set(String(key), String(value)); },
    removeItem(key) { map.delete(String(key)); },
    dump() { return Object.fromEntries(map); },
  };
}

function loadQueue(localStorage, mirror = new Map()) {
  const window = {
    localStorage,
    crypto: { getRandomValues(values) { for (let i = 0; i < values.length; i++) values[i] = 100 + i; return values; } },
    dispatchEvent() {},
    document: { querySelector() { return { content: "test-build" }; } },
    SolivocPersistence: {
      async put(key, value) { mirror.set(key, value); return true; },
      async get(key) { return mirror.has(key) ? { key, value: mirror.get(key) } : null; },
    },
  };
  window.window = window;
  const context = vm.createContext({
    window,
    localStorage,
    crypto: window.crypto,
    CustomEvent: class CustomEvent { constructor(type, init = {}) { this.type = type; this.detail = init.detail; } },
    console,
    structuredClone,
  });
  vm.runInContext(source, context, { filename: "pending-events.js" });
  return window.SolivocPendingEvents;
}

function completion(index) {
  return {
    owner: "u_player12345",
    eventType: "completion",
    transactionId: `tx_${index}`,
    occurredAt: 1000 + index,
    payload: { type: "completion", campaign: true, level: index, stars: 1, xpDelta: 3 },
  };
}

test("100 unacked events survive queue runtime reload", async () => {
  const localStorage = memoryStorage();
  const mirror = new Map();
  const queue = loadQueue(localStorage, mirror);
  for (let index = 1; index <= 100; index++) {
    const result = queue.enqueue(completion(index));
    assert.ok(result.event);
    assert.equal(result.persistedLocal, true);
  }
  assert.equal(queue.count("u_player12345"), 100);

  await Promise.resolve();
  const reloaded = loadQueue(localStorage, mirror);
  assert.equal(reloaded.count("u_player12345"), 100);
  const pending = reloaded.pending({ owner: "u_player12345", limit: 100 });
  assert.equal(pending.length, 100);
  assert.deepEqual(Array.from(pending, (event) => event.sequenceNo), Array.from({ length: 100 }, (_, index) => index + 1));
});

test("ACK removes only confirmed events after reload", () => {
  const localStorage = memoryStorage();
  const queue = loadQueue(localStorage);
  const ids = [];
  for (let index = 1; index <= 5; index++) ids.push(queue.enqueue(completion(index)).event.eventId);
  assert.equal(queue.ack(ids.slice(0, 3)), 3);
  assert.equal(queue.count("u_player12345"), 2);

  const reloaded = loadQueue(localStorage);
  assert.equal(reloaded.count("u_player12345"), 2);
  assert.equal(reloaded.hasTransaction("tx_1"), true);
  assert.equal(reloaded.hasTransaction("tx_5"), true);
});
