import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const persistence = await readFile(new URL("../js/core/persistence.js", import.meta.url), "utf8");
const bridge = await readFile(new URL("../js/persistence-bridge.js", import.meta.url), "utf8");
const build = await readFile(new URL("../scripts/build-frontend.mjs", import.meta.url), "utf8");

test("indexeddb persistence core uses a versioned records store", () => {
  assert.match(persistence, /const DB_NAME = "solivoc-runtime-v1"/);
  assert.match(persistence, /const DB_VERSION = 1/);
  assert.match(persistence, /createObjectStore\(STORE_NAME, \{ keyPath: "key" \}\)/);
  assert.match(persistence, /schemaVersion: SCHEMA_VERSION/);
});

test("persistence core degrades safely when indexeddb is unavailable", () => {
  assert.match(persistence, /typeof indexedDB === "undefined"/);
  assert.match(persistence, /disabled = true/);
  assert.match(persistence, /return Promise\.resolve\(null\)/);
  assert.match(persistence, /solivoc:persistence-error/);
});

test("writes are serialized per persistence key", () => {
  assert.match(persistence, /const writeChains = new Map\(\)/);
  assert.match(persistence, /function enqueue\(key, operation\)/);
  assert.match(persistence, /writeChains\.set\(normalized, next\)/);
});

test("bridge mirrors profile and round owners without patching localStorage", () => {
  assert.match(bridge, /indexedDbMirroredProfileSave/);
  assert.match(bridge, /indexedDbMirroredRoundSave/);
  assert.match(bridge, /indexedDbMirroredRoundClear/);
  assert.match(bridge, /seedFromLocalStorage\(managedKeys\)/);
  assert.doesNotMatch(bridge, /localStorage\.setItem\s*=/);
  assert.doesNotMatch(bridge, /Storage\.prototype/);
});

test("persistence loads before bridge and app bootstrap", () => {
  const core = build.indexOf("./js/core/persistence.js");
  const bridgeIndex = build.indexOf("./js/persistence-bridge.js");
  const durability = build.indexOf("./js/client-stability-hardening.js");
  assert.ok(core >= 0 && bridgeIndex > core && durability > bridgeIndex);
});

test("stage three keeps localStorage as synchronous boot rollback source", () => {
  assert.match(bridge, /localStorage remains the authoritative synchronous boot source in Stage 3/);
  assert.match(persistence, /recoverMissing/);
});
