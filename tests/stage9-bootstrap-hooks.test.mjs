import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFile(path.join(root, file), "utf8");

test("первый запуск вызывается через явный feature hook", async () => {
  const app = await read("js/app.js");
  const feature = await read("js/features/account/first-run.js");

  assert.match(app, /await window\.SolivocFirstRunAccount\?\.runGate\?\.\(\)/);
  assert.match(app, /onboardingRan = !!\(await runFirstRunOnboarding\?\.\(\)\)/);
  assert.doesNotMatch(feature, /runFirstRunOnboarding\s*=/);
  assert.doesNotMatch(feature, /installOnboardingAdapter/);
});

test("исходный app делегирует обновления UpdateManager", async () => {
  const app = await read("js/app.js");
  const build = await read("scripts/build-frontend.mjs");

  assert.match(app, /function registerPwa\(\) \{\s*return window\.SolivocUpdateManager\?\.start\?\.\(\);\s*\}/);
  assert.doesNotMatch(app, /navigator\.serviceWorker\.register\(/);
  assert.doesNotMatch(app, /pwa\.update-check/);
  assert.doesNotMatch(build, /pwaStart|pwaFacade|PWA owner markers/);
});
