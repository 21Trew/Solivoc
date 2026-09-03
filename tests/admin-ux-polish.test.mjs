import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../admin.html", import.meta.url), "utf8");
const ux = await readFile(new URL("../js/admin-ux.js", import.meta.url), "utf8");
const css = await readFile(new URL("../styles/admin-ux.css", import.meta.url), "utf8");

test("admin loads dedicated ux layer", () => {
  assert.match(html, /styles\/admin-ux\.css/);
  assert.match(html, /js\/admin-ux\.js/);
});

test("admin readability is deliberately larger", () => {
  assert.match(css, /--admin-font:16px/);
  assert.match(css, /\.main-nav button b\{font-size:15px\}/);
  assert.match(css, /\.player-list b\{font-size:14px\}/);
  assert.match(css, /\.player-tabs button\{[^}]*font-size:13px/);
});

test("global status is an overlay and cannot shift content", () => {
  assert.match(css, /\.global-status\{[\s\S]*position:fixed/);
  assert.match(css, /pointer-events:none/);
  assert.match(ux, /toastTimer/);
});

test("player navigation has cache prefetch and quick switch", () => {
  assert.match(ux, /const cache = new Map\(\)/);
  assert.match(ux, /prefetchPlayer/);
  assert.match(ux, /admin-player-quick-switch/);
  assert.match(ux, /Быстро перейти к игроку/);
  assert.match(ux, /ArrowDown/);
});

test("structured profile data is rendered for humans first", () => {
  assert.match(ux, /admin-friendly-data/);
  assert.match(ux, /humanKey/);
  assert.match(ux, /Технические данные/);
  assert.match(ux, /upgradeJsonBlocks/);
  assert.match(ux, /upgradeRecovery/);
  assert.match(css, /\.technical-json/);
  assert.match(css, /\.admin-technical-recovery/);
});
