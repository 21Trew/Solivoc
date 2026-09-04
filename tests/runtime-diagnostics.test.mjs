import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { RUNTIME_BASELINE_SCENARIOS } from "../scripts/runtime-baseline-scenarios.mjs";

const diagnostics = await readFile(new URL("../js/core/runtime-diagnostics.js", import.meta.url), "utf8");
const build = await readFile(new URL("../scripts/build-frontend.mjs", import.meta.url), "utf8");

test("runtime diagnostics stay opt-in", () => {
  assert.match(diagnostics, /runtimeDiagnostics/);
  assert.match(diagnostics, /runtimeDiagnostics"\) === "1"/);
  assert.match(diagnostics, /solivoc-runtime-diagnostics/);
  assert.match(diagnostics, /if \(!enabled\) return false/);
});

test("diagnostics measure plan stage zero hot-path metrics", () => {
  for (const token of ["networkCalls", "roundSaves", "profileSaves", "stateBytes", "profileBytes", "domNodes", "activeAnimations", "trackedActiveTimers"]) {
    assert.match(diagnostics, new RegExp(token));
  }
  assert.match(diagnostics, /begin\("render"\)/);
  assert.match(diagnostics, /begin\("roundPersist"\)/);
  assert.match(diagnostics, /begin\("profileSave"\)/);
});

test("long tasks are observed where supported", () => {
  assert.match(diagnostics, /PerformanceObserver/);
  assert.match(diagnostics, /type: "longtask"/);
});

test("baseline scenarios cover mandatory soak families", () => {
  const ids = new Set(RUNTIME_BASELINE_SCENARIOS.map((scenario) => scenario.id));
  for (const id of ["actions-1000", "profile-100", "lifecycle-100", "drag-cancel-100", "levels-50", "offline-reconnect", "sw-active-round"]) {
    assert.ok(ids.has(id), `missing ${id}`);
  }
});

test("frontend build installs diagnostics after legacy guards", () => {
  const diagnosticsIndex = build.indexOf("runtime-diagnostics.js");
  const iosIndex = build.indexOf("ios-round-stability-v2.js");
  assert.ok(diagnosticsIndex > iosIndex, "diagnostics must wrap the effective post-hardening runtime");
});
