import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const ui = await readFile(new URL("../js/v34-product-update.js", import.meta.url), "utf8");
const css = await readFile(new URL("../styles/v34-product.css", import.meta.url), "utf8");

const expectedBacks = [
  "classic", "midnight-grid", "prism", "sunrise", "constellation",
  "trophy", "mosaic", "duelist", "crown", "ember", "master",
  "velvet", "glacier", "lotus", "chronicle", "phoenix", "lion", "parrot",
  "anniversary", "atlas", "legend", "obsidian", "grand-trophy",
];

test("mascot daily header does not mention player XP", () => {
  assert.match(ui, /ЕЖЕДНЕВКА ОТ МАСКОТА/);
  assert.doesNotMatch(ui, /БЕЗ XP ИГРОКА/);
});

test("challenge reward is text-only and daily titles have explicit contrast", () => {
  assert.match(css, /\.v32-challenge-reward\{[\s\S]*background:transparent!important/);
  assert.match(css, /\.daily-quest > b\{[\s\S]*color:#f9f8ff!important/);
});

test("card back rarity filter covers every current back", () => {
  const start = ui.indexOf("const CARD_BACK_RARITY_BY_ID");
  const end = ui.indexOf("let cardBackRarityFilter", start);
  assert.ok(start >= 0 && end > start, "rarity map must exist");
  const block = ui.slice(start, end);
  for (const id of expectedBacks) assert.ok(block.includes(id), `missing rarity for ${id}`);
  assert.match(ui, /data-v35-cardback-filter/);
  assert.match(ui, /v35-rarity-hidden/);
  assert.match(css, /--cardback-rarity/);
});

test("rarity groups use five distinct visual tiers", () => {
  for (const tier of ["common", "uncommon", "rare", "epic", "legendary"]) {
    assert.match(ui, new RegExp(`${tier}: \\{ label:`));
  }
  assert.match(css, /\.cardback-tile\[data-card-back-rarity\]/);
  assert.match(css, /box-shadow:0 0 0 1\.5px var\(--cardback-rarity\)/);
});
