import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const lifecycle = await readFile(new URL("../js/core/lifecycle.js", import.meta.url), "utf8");
const scheduler = await readFile(new URL("../js/core/scheduler.js", import.meta.url), "utf8");
const syncManager = await readFile(new URL("../js/core/sync-manager.js", import.meta.url), "utf8");
const updateManager = await readFile(new URL("../js/core/update-manager.js", import.meta.url), "utf8");
const build = await readFile(new URL("../scripts/build-frontend.mjs", import.meta.url), "utf8");
const durability = await readFile(new URL("../js/client-stability-hardening.js", import.meta.url), "utf8");
const cloud = await readFile(new URL("../js/cross-device-sync-hardening.js", import.meta.url), "utf8");
const ios = await readFile(new URL("../js/ios-round-stability-v2.js", import.meta.url), "utf8");
const apiClient = await readFile(new URL("../js/api-client.js", import.meta.url), "utf8");
const app = await readFile(new URL("../js/app.js", import.meta.url), "utf8");
const auth = await readFile(new URL("../js/auth.js", import.meta.url), "utf8");
const v34 = await readFile(new URL("../js/v34-product-update.js", import.meta.url), "utf8");

const directLifecycleListener = /(?:window|document)\.addEventListener\("(?:visibilitychange|pagehide|pageshow|online|offline|freeze|beforeunload|error|unhandledrejection)"/;

test("lifecycle core owns browser lifecycle listeners", () => {
  for (const token of ["visibilitychange", "pagehide", "pageshow", "online", "offline", "focus", "freeze", "beforeunload", "unhandledrejection"]) {
    assert.match(lifecycle, new RegExp(token));
  }
  for (const phase of ["suspend", "resume", "terminate"]) assert.match(lifecycle, new RegExp(`emit\\(\"${phase}\"`));
  assert.match(lifecycle, /PHASE_DEDUPE_MS/);
  assert.match(lifecycle, /SolivocLifecycle/);
});

test("scheduler owns keyed replaceable timers", () => {
  assert.match(scheduler, /const tasks = new Map\(\)/);
  assert.match(scheduler, /const aliases = new Map\(\)/);
  assert.match(scheduler, /function timeout/);
  assert.match(scheduler, /function interval/);
  assert.match(scheduler, /function cancelPrefix/);
  assert.match(scheduler, /function alias/);
  assert.match(scheduler, /activeCount/);
});

test("lifecycle core loads before hardening and app bootstrap", () => {
  const schedulerIndex = build.indexOf("./js/core/scheduler.js");
  const lifecycleIndex = build.indexOf("./js/core/lifecycle.js");
  const hardeningIndex = build.indexOf("./js/client-stability-hardening.js");
  assert.ok(schedulerIndex >= 0 && lifecycleIndex > schedulerIndex && hardeningIndex > lifecycleIndex);
});

test("durability keeps semantic lifecycle checkpoints", () => {
  assert.match(durability, /SolivocLifecycle\.on\("suspend", "durability\.profile"/);
  assert.match(durability, /SolivocLifecycle\.on\("terminate", "durability\.profile"/);
  assert.match(durability, /SolivocLifecycle\.on\("resume", "durability\.profile-resume"/);
  assert.match(durability, /SolivocScheduler\.timeout\("sync\.pending-account"/);
  assert.match(durability, /SolivocScheduler\.cancel\("sync\.account"/);
  assert.doesNotMatch(durability, directLifecycleListener);
  assert.match(syncManager, /lifecycle\.off\("suspend", "durability\.profile"/);
  assert.match(syncManager, /localCheckpoint\(\)/);
});

test("cloud refresh scheduling belongs to sync manager", () => {
  assert.doesNotMatch(cloud, /SolivocLifecycle\.on\("(?:online|focus|visible)", "sync\.cloud-refresh"/);
  assert.doesNotMatch(cloud, directLifecycleListener);
  assert.match(syncManager, /lifecycle\.on\("online", "sync\.manager"/);
  assert.match(syncManager, /lifecycle\.on\("resume", "sync\.manager"/);
  assert.match(syncManager, /"sync\.cloud-refresh"/);
  assert.match(syncManager, /scheduler\.claim\(TIMER_KEY/);
});

test("iOS fault guard uses lifecycle manager only", () => {
  assert.match(ios, /SolivocLifecycle\.on\("error", "ios\.runtime-fault"/);
  assert.match(ios, /SolivocLifecycle\.on\("unhandledrejection", "ios\.runtime-fault"/);
  assert.doesNotMatch(ios, /window\.addEventListener\("(?:error|unhandledrejection)"/);
});

test("developer alerts use shared lifecycle and scheduler", () => {
  assert.match(apiClient, /SolivocScheduler\.interval\("developer-alerts\.poll"/);
  assert.match(apiClient, /SolivocLifecycle\.on\("online", "developer-alerts"/);
  assert.match(apiClient, /SolivocLifecycle\.on\("visible", "developer-alerts"/);
  assert.doesNotMatch(apiClient, directLifecycleListener);
});

test("account UI uses shared lifecycle and legacy sync alias", () => {
  assert.match(auth, /SolivocLifecycle\.on\("online", "account\.ui"/);
  assert.match(auth, /SolivocLifecycle\.on\("offline", "account\.ui"/);
  assert.match(auth, /SolivocLifecycle\.on\("visible", "account\.ui"/);
  assert.match(auth, /SolivocScheduler\.timeout\("sync\.account"/);
  assert.match(syncManager, /"sync\.account"/);
  assert.doesNotMatch(auth, directLifecycleListener);
  assert.doesNotMatch(auth, /accountSyncTimer/);
});

test("app lifecycle and recurring runtime work use shared owners", () => {
  assert.match(app, /SolivocLifecycle\.on\("suspend", "game\.round"/);
  assert.match(app, /SolivocLifecycle\.on\("resume", "game\.round"/);
  assert.match(app, /SolivocLifecycle\.on\("terminate", "game\.round"/);
  assert.match(app, /SolivocScheduler\.interval\("sync\.challenges"/);
  assert.match(app, /SolivocScheduler\.interval\("ui\.rule-metric"/);
  assert.match(app, /SolivocUpdateManager\?\.start\?\.\(\)/);
  assert.doesNotMatch(app, /pwa\.update-check/);
  assert.match(updateManager, /lifecycle\(\)\?\.on\?\.\("resume", "pwa\.update"/);
  assert.match(updateManager, /lifecycle\(\)\?\.on\?\.\("online", "pwa\.update"/);
  assert.match(updateManager, /scheduler\(\)\?\.interval\?\.\("pwa\.update-check"/);
  assert.doesNotMatch(app, directLifecycleListener);
  assert.doesNotMatch(app, /(?:challengeSyncTimer|resumeSyncTimer|ruleMetricTimer)/);
});

test("v34 developer mail uses shared lifecycle and scheduler", () => {
  assert.match(v34, /SolivocScheduler\.timeout\("developer-mail\.initial"/);
  assert.match(v34, /SolivocScheduler\.interval\("developer-mail\.poll"/);
  assert.match(v34, /SolivocLifecycle\.on\("online","developer-mail"/);
  assert.match(v34, /SolivocLifecycle\.on\("visible","developer-mail"/);
  assert.doesNotMatch(v34, directLifecycleListener);
});
