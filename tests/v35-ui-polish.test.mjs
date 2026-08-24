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
  assert.match(css, /border:2px solid var\(--cardback-rarity\)!important/);
  assert.match(css, /outline-offset:-5px!important/);
  assert.match(css, /cardback-tile\[data-card-back-rarity\]::before/);
});


test("fox info and mascot portrait entry points stay clean", async () => {
  const fox = await readFile(new URL("../js/v33-fox-journey.js", import.meta.url), "utf8");
  assert.match(fox, /<small>ЛОВКИЙ СТРАТЕГ<\/small>/);
  assert.doesNotMatch(fox, /МАСКОТ · ЛОВКИЙ СТРАТЕГ/);
  assert.match(ui, /closest\?\.\(\"\.companion-info-hero img,\.fox-page-hero>img\"\)/);
  assert.doesNotMatch(ui, /fox-journey-image img,\.companion-tile img,\.fox-evolution-form img/);
});

test("card backs have no visible rarity badge and borders stay inside", () => {
  assert.match(ui, /rarityNames = new Set/);
  assert.match(ui, /cardback-rarity-label/);
  assert.match(css, /box-sizing:border-box!important/);
  assert.match(css, /overflow:hidden/);
  assert.match(css, /outline-offset:-5px!important/);
});

test("folklore rarity vocabulary replaces generic RPG labels", () => {
  for (const label of ["Простые", "Дивные", "Вещие", "Заповедные", "Сокровенные"]) {
    assert.match(ui, new RegExp(`label:\"${label}\"`));
  }
  for (const oldLabel of ["Обычные", "Необычные", "Редкие", "Эпические", "Легендарные"]) {
    assert.doesNotMatch(ui, new RegExp(`label:\"${oldLabel}\"`));
  }
  assert.match(ui, /common: \{ label:"Простые", singular:"Простая"/);
  assert.match(ui, /legendary: \{ label:"Сокровенные", singular:"Сокровенная"/);
  assert.match(ui, /Степень: \${CARD_BACK_RARITY_META\[rarity\]\?\.singular/);
});

test("rarity visuals use restrained folklore tier accents", () => {
  assert.match(css, /data-card-back-rarity=\"common\"/);
  assert.match(css, /data-card-back-rarity=\"uncommon\"/);
  assert.match(css, /data-card-back-rarity=\"rare\"/);
  assert.match(css, /data-card-back-rarity=\"epic\"/);
  assert.match(css, /data-card-back-rarity=\"legendary\"/);
  assert.match(css, /rgba\(201,170,98,\.14\)/);
});
