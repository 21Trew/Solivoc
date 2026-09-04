import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const lifecycle = await readFile(new URL("../js/core/lifecycle.js", import.meta.url), "utf8");
const scheduler = await readFile(new URL("../js/core/scheduler.js", import.meta.url), "utf8");
const build = await readFile(new URL("../scripts/build-frontend.mjs", import.meta.url), "utf8");
const durability = await readFile(new URL("../js/client-stability-hardening.js", import.meta.url), "utf8");
const cloud = await readFile(new URL("../js/cross-device-sync-hardening.js", import.meta.url), "utf8");
const ios = await readFile(new URL("../js/ios-round-stability-v2.js", import.meta.url), "utf8");
const apiClient = await readFile(new URL("../js/api-client.js", import.meta.url), "utf8");

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
  assert.match(durability, /SolivocLifecycle\.on\("beforeunload", "durability\.profile"/);
  assert.match(durability, /SolivocScheduler\.timeout\("sync\.pending-account"/);
  assert.doesNotMatch(durability, /addEventListener\("(?:pagehide|freeze|visibilitychange|online|offline|focus|pageshow|beforeunload|error|unhandledrejection)"/);
});

test("cloud refresh callbacks use shared lifecycle and scheduler", () => {
  assert.match(cloud, /SolivocLifecycle\.on\("online", "sync\.cloud-refresh"/);
  assert.match(cloud, /SolivocLifecycle\.on\("focus", "sync\.cloud-refresh"/);
  assert.match(cloud, /SolivocLifecycle\.on\("visible", "sync\.cloud-refresh"/);
  assert.match(cloud, /SolivocScheduler\.timeout\("sync\.cloud-refresh"/);
  assert.doesNotMatch(cloud, /addEventListener\("(?:online|offline|focus|visibilitychange|pagehide|pageshow|freeze|beforeunload|error|unhandledrejection)"/);
});

test("iOS fault guard uses lifecycle manager only", () => {
  assert.match(ios, /SolivocLifecycle\.on\("error", "ios\.runtime-fault"/);
  assert.match(ios, /SolivocLifecycle\.on\("unhandledrejection", "ios\.runtime-fault"/);
  assert.doesNotMatch(ios, /addEventListener\("(?:error|unhandledrejection)"/);
});

test("developer alerts use shared lifecycle and scheduler", () => {
  assert.match(apiClient, /SolivocScheduler\.interval\("developer-alerts\.poll"/);
  assert.match(apiClient, /SolivocLifecycle\.on\("online", "developer-alerts"/);
  assert.match(apiClient, /SolivocLifecycle\.on\("visible", "developer-alerts"/);
  assert.doesNotMatch(apiClient, /addEventListener\("(?:online|offline|visibilitychange|pagehide|pageshow|freeze|beforeunload)"/);
});
