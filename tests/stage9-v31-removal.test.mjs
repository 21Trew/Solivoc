import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFile(path.join(root, file), "utf8");

async function missing(file) {
  try { await access(path.join(root, file), constants.F_OK); return false; }
  catch { return true; }
}

test("v31 versioned runtime layers are removed", async () => {
  assert.equal(await missing("js/v31-patch.js"), true);
  assert.equal(await missing("js/v31-first-run-ui.js"), true);

  const guard = await read("scripts/check-source.mjs");
  assert.doesNotMatch(guard, /js\/v31-patch\.js/);
  assert.doesNotMatch(guard, /js\/v31-first-run-ui\.js/);
});

test("first run account behavior has a normal feature owner", async () => {
  const feature = await read("js/features/account/first-run.js");
  assert.match(feature, /SolivocFirstRunAccount/);
  assert.match(feature, /data-first-run-login/);
  assert.match(feature, /data-account-oauth/);
  assert.doesNotMatch(feature, /serviceWorker|controllerchange|reg\.update/);
});

test("frontend build excludes v31 scripts", async () => {
  await execFileAsync(process.execPath, ["scripts/build-frontend.mjs"], {
    cwd: root,
    env: { ...process.env, GITHUB_SHA: "", SOLIVOC_BUILD_ID: "stage9btest" },
  });
  const html = await read("dist-frontend/index.html");
  assert.match(html, /\.\/js\/features\/account\/first-run\.js/);
  assert.doesNotMatch(html, /\.\/js\/v31-patch\.js/);
  assert.doesNotMatch(html, /\.\/js\/v31-first-run-ui\.js/);
  assert.match(html, /\.\/js\/core\/update-manager\.js/);
});
