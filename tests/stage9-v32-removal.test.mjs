import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFile(path.join(root, file), "utf8");

async function missing(file) {
  try { await access(path.join(root, file), constants.F_OK); return false; }
  catch { return true; }
}

test("исторический слой v32 удалён из исходников и сборки", async () => {
  assert.equal(await missing("js/v32-ui-fixes.js"), true);
  const build = await read("scripts/build-frontend.mjs");
  const guard = await read("scripts/check-source.mjs");
  assert.doesNotMatch(build, /v32-ui-fixes\.js/);
  assert.doesNotMatch(guard, /js\/v32-ui-fixes\.js/);
});

test("компактные испытания имеют штатного владельца", async () => {
  const feature = await read("js/features/challenges/compact-cards.js");
  assert.match(feature, /SolivocChallengeCards/);
  assert.match(feature, /weeklyCardMarkup/);
  assert.match(feature, /monthlyCardMarkup/);
  assert.match(feature, /challenge-reward/);
  assert.match(feature, /background:transparent/);
});

test("выбор кампании сохраняет оформление без v32 runtime", async () => {
  const styleOwner = await read("js/features/campaign/picker-style.js");
  const css = await read("styles/campaign-picker.css");
  const v34 = await read("js/v34-product-update.js");
  assert.match(styleOwner, /styles\/campaign-picker\.css/);
  assert.match(css, /\.v32-campaign-picker/);
  assert.match(css, /\.v32-level-grid/);
  assert.match(v34, /function openCampaignPicker/);
  assert.match(v34, /#v34CampaignPicker/);
});

test("динамический CSS входит в critical shell", async () => {
  const build = await read("scripts/build-frontend.mjs");
  assert.match(build, /dependencyPatterns/);
  assert.match(build, /\.href\|href/);
});
