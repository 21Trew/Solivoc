import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const lifecycle = await readFile(new URL("../js/core/lifecycle.js", import.meta.url), "utf8");
const scheduler = await readFile(new URL("../js/core/scheduler.js", import.meta.url), "utf8");
const build = await readFile(new URL("../scripts/build-frontend.mjs", import.meta.url), "utf8");
const durability = await readFile(new URL("../js/client-stability-hardening.js", import.meta.url), "utf8");
const cloud = await readFile(new URL("../js/cross-device-sync-hardening.js", import.meta.url), "utf8");

test("lifecycle core owns browser lifecycle listeners", () => {
  for (const token of ["visibilitychange", "pagehide", "pageshow", "online", "offline", "focus", "freeze", "beforeunload", "unhandledrejection"]) {
    assert.match(lifecycle, new RegExp(token));
  }
  assert.match(lifecycle, /SolivocLifecycle/);
});

test("scheduler owns keyed replaceable timers", () => {
  assert.match(scheduler, /const tasks = new Map\(\)/);
  assert.match(scheduler, /function timeout/);
  assert.match(scheduler, /function interval/);
  assert.match(scheduler, /function cancelPrefix/);
  assert.match(scheduler, /activeCount/);
});

test("lifecycle core loads before hardening and app bootstrap", () => {
  const schedulerIndex = build.indexOf("./js/core/scheduler.js");
  const lifecycleIndex = build.indexOf("./js/core/lifecycle.js");
  const hardeningIndex = build.indexOf("./js/client-stability-hardening.js");
  assert.ok(schedulerIndex >= 0 && lifecycleIndex > schedulerIndex && hardeningIndex > lifecycleIndex);
});

test("durability callbacks register with lifecycle manager", () => {
  assert.match(durability, /SolivocLifecycle\.on\("pagehide", "durability\.profile"/);
  assert.match(durability, /SolivocLifecycle\.on\("freeze", "durability\.profile"/);
  assert.match(durability, /SolivocLifecycle\.on\("hidden", "durability\.profile"/);
  assert.match(durability, /SolivocScheduler\.timeout\("sync\.pending-account"/);
});

test("cloud refresh callbacks use shared lifecycle and scheduler", () => {
  assert.match(cloud, /SolivocLifecycle\.on\("online", "sync\.cloud-refresh"/);
  assert.match(cloud, /SolivocLifecycle\.on\("focus", "sync\.cloud-refresh"/);
  assert.match(cloud, /SolivocLifecycle\.on\("visible", "sync\.cloud-refresh"/);
  assert.match(cloud, /SolivocScheduler\.timeout\("sync\.cloud-refresh"/);
});
