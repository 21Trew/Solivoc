import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFile(path.join(root, file), "utf8");

let built = false;
async function ensureBuild() {
  if (built) return;
  await execFileAsync(process.execPath, ["scripts/build-frontend.mjs"], {
    cwd: root,
    env: { ...process.env, GITHUB_SHA: "", SOLIVOC_BUILD_ID: "stage8test" },
  });
  built = true;
}

test("critical shell is generated from final frontend bundle", async () => {
  await ensureBuild();
  const html = await read("dist-frontend/index.html");
  const manifest = JSON.parse(await read("dist-frontend/critical-shell.json"));
  const assets = new Set(manifest.assets);

  assert.equal(manifest.build, "stage8test");
  assert.ok(assets.has("./"));
  assert.ok(assets.has("./index.html"));
  for (const match of html.matchAll(/(?:src|href)="(\.\/[^"?#]+)(?:[?#][^"]*)?"/g)) {
    if (/\.(?:js|css)$/i.test(match[1])) assert.ok(assets.has(match[1]), `missing critical asset ${match[1]}`);
  }
  assert.ok(assets.has("./data/categories.json"), "boot-time category data must be discovered from JS fetch");
  assert.equal([...assets].some((asset) => /icons\/mascots\/fox\/fox-\d+\.webp/.test(asset)), false);
  assert.equal([...assets].some((asset) => /manifest-(?:classic|owl|cat)-/.test(asset)), false);
});

test("built worker cannot mix cache generations", async () => {
  await ensureBuild();
  const sw = await read("dist-frontend/sw.js");
  assert.doesNotMatch(sw, /__SOLIVOC_(?:BUILD|CORE)__/);
  assert.match(sw, /const CACHE = "worditaire-build-stage8test"/);
  assert.match(sw, /const cache = await currentCache\(\)/);
  assert.doesNotMatch(sw, /\bcaches\.match\(/);
  assert.doesNotMatch(sw, /NETWORK_FIRST/);

  const installStart = sw.indexOf('self.addEventListener("install"');
  const messageStart = sw.indexOf('self.addEventListener("message"');
  assert.ok(installStart >= 0 && messageStart > installStart);
  assert.doesNotMatch(sw.slice(installStart, messageStart), /skipWaiting/);
  assert.match(sw.slice(messageStart), /event\.waitUntil\(self\.skipWaiting\(\)\)/);
});

test("production app has one update owner", async () => {
  await ensureBuild();
  const app = await read("dist-frontend/js/app.js");
  const update = await read("js/core/update-manager.js");
  const build = await read("scripts/build-frontend.mjs");

  assert.match(app, /function registerPwa\(\) \{\s*return window\.SolivocUpdateManager\?\.start\?\.\(\);\s*\}/);
  assert.doesNotMatch(app, /SolivocLifecycle\.on\("resume", "pwa\.update"/);
  assert.doesNotMatch(app, /SolivocScheduler\.interval\("pwa\.update-check"/);
  assert.match(build, /\.\/js\/core\/update-manager\.js/);
  assert.match(update, /if \(activeRound\(\)\) return false/);
  assert.match(update, /checkpointBeforeReload\(\)/);
  assert.match(update, /worker\.postMessage\(\{ type: "SKIP_WAITING" \}\)/);
  assert.match(update, /save\?\.\(\{ immediate: true \}\)/);
});
