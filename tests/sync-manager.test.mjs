import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const schedulerSource = fs.readFileSync(new URL("../js/core/scheduler.js", import.meta.url), "utf8");
const managerSource = fs.readFileSync(new URL("../js/core/sync-manager.js", import.meta.url), "utf8");
const pendingSource = fs.readFileSync(new URL("../js/core/pending-event-sync.js", import.meta.url), "utf8");
const bridgeSource = fs.readFileSync(new URL("../js/core/account-sync-bridge.js", import.meta.url), "utf8");
const buildSource = fs.readFileSync(new URL("../scripts/build-frontend.mjs", import.meta.url), "utf8");
const crossDeviceSource = fs.readFileSync(new URL("../js/cross-device-sync-hardening.js", import.meta.url), "utf8");

function schedulerContext() {
  const context = {
    console,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    queueMicrotask,
    CustomEvent: class CustomEvent { constructor(type, init = {}) { this.type = type; this.detail = init.detail; } },
  };
  context.window = context;
  context.globalThis = context;
  context.dispatchEvent = () => true;
  vm.createContext(context);
  vm.runInContext(schedulerSource, context);
  return context;
}

test("scheduler aliases legacy sync keys to one timer", () => {
  const context = schedulerContext();
  const scheduler = context.SolivocScheduler;
  scheduler.alias("sync.account", "sync.manager");
  scheduler.alias("sync.cloud-refresh", "sync.manager");
  scheduler.claim("sync.manager", () => {});
  scheduler.timeout("sync.account", () => {}, 10000);
  scheduler.timeout("sync.cloud-refresh", () => {}, 10000);
  const tasks = scheduler.snapshot();
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].key, "sync.manager");
  assert.equal(tasks[0].claimed, true);
  scheduler.cancel("sync.manager");
});

function managerContext({ request } = {}) {
  const context = schedulerContext();
  let owner = "user-a";
  let signedIn = true;
  const lifecycleHandlers = new Map();
  const lifecycle = {
    on(type, key, fn) { lifecycleHandlers.set(`${type}:${key}`, fn); },
    off(type, key) { return lifecycleHandlers.delete(`${type}:${key}`); },
  };
  context.document = { visibilityState: "visible" };
  context.AbortController = AbortController;
  context.addEventListener = () => {};
  context.SolivocLifecycle = lifecycle;
  context.activelyPlayingRound = () => false;
  context.SolivocAccountSyncBridge = {
    owner: () => owner,
    signedIn: () => signedIn,
    canUseServer: () => true,
    version: () => 1,
    snapshot: () => ({ xp: 10 }),
    request: request || (async () => ({ version: 2, syncedAt: 123, profile: { xp: 10 } })),
    applyProfile: () => true,
    updateMeta: () => true,
    markSignedOut: () => { signedIn = false; },
    updateUi: () => {},
  };
  context.__setOwner = (value) => { owner = value; };
  vm.runInContext(managerSource, context);
  return context;
}

test("sync manager drains pending events before profile upload", async () => {
  const order = [];
  const context = managerContext({
    request: async () => { order.push("profile"); return { version: 2, profile: {} }; },
  });
  let pending = true;
  context.SolivocPendingEventSync = {
    hasPendingForAccount: () => pending,
    flush: async () => { order.push("events"); pending = false; return true; },
  };
  const ok = await context.SolivocSyncManager.flush({ reason: "manual" });
  assert.equal(ok, true);
  assert.deepEqual(order, ["events", "profile"]);
});

test("owner change aborts obsolete profile request", async () => {
  let aborted = false;
  let resolveRequest;
  const context = managerContext({
    request: (_path, options) => new Promise((resolve) => {
      resolveRequest = resolve;
      options.signal.addEventListener("abort", () => { aborted = true; resolve({ version: 1, profile: {} }); }, { once: true });
    }),
  });
  const first = context.SolivocSyncManager.flush({ reason: "manual" });
  await Promise.resolve();
  context.__setOwner("user-b");
  context.SolivocSyncManager.schedule(10000, "owner-switch");
  assert.equal(aborted, true);
  resolveRequest?.({ version: 1, profile: {} });
  assert.equal(await first, false);
  context.SolivocScheduler.cancel("sync.manager");
});

test("sync manager owns lifecycle scheduling sources", () => {
  assert.match(managerSource, /lifecycle\.on\("online", "sync\.manager"/);
  assert.match(managerSource, /lifecycle\.on\("resume", "sync\.manager"/);
  assert.match(managerSource, /lifecycle\.off\("suspend", "durability\.profile"/);
  assert.doesNotMatch(pendingSource, /SolivocLifecycle\?\.on/);
  assert.doesNotMatch(crossDeviceSource, /SolivocLifecycle\.on/);
});

test("runtime load order installs account bridge before sync modules", () => {
  const bridge = buildSource.indexOf('"./js/core/account-sync-bridge.js"');
  const pending = buildSource.indexOf('"./js/core/pending-event-sync.js"');
  const manager = buildSource.indexOf('"./js/core/sync-manager.js"');
  assert.ok(bridge >= 0 && pending > bridge && manager > pending);
  assert.match(bridgeSource, /SolivocAccountSyncBridge/);
});
