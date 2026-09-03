import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../admin.html", import.meta.url), "utf8");
const ux = await readFile(new URL("../js/admin-ux.js", import.meta.url), "utf8");
const css = await readFile(new URL("../styles/admin-ux.css", import.meta.url), "utf8");

test("admin loads versioned ux layer", () => {
  assert.match(html, /styles\/admin-ux\.css\?v=2/);
  assert.match(html, /js\/admin-ux\.js\?v=2/);
});

test("admin stays readable but uses space compactly", () => {
  assert.match(css, /--admin-font:16px/);
  assert.match(css, /\.main-nav button b\{font-size:15px\}/);
  assert.match(css, /\.view\{padding:10px 12px 26px!important/);
  assert.match(css, /\.players-sidebar\{position:static!important/);
  assert.match(css, /\.player-list\{overflow:visible!important/);
});

test("status overlay never shifts layout and hides fast loads", () => {
  assert.match(css, /\.global-status\{[\s\S]*position:fixed!important/);
  assert.match(css, /ux-status-visible/);
  assert.match(ux, /toastDelay/);
  assert.match(ux, /260/);
});

test("read requests are cached, deduplicated and warmed", () => {
  assert.match(ux, /const readCache = new Map\(\)/);
  assert.match(ux, /const inflight = new Map\(\)/);
  assert.match(ux, /endpointPolicy/);
  assert.match(ux, /warmupCommonData/);
  assert.match(ux, /audit=1&limit=200/);
  assert.match(ux, /leaderboard\?board=all/);
  assert.match(ux, /prefetchPlayer/);
  assert.match(ux, /recovery=1&userId/);
});

test("player navigation has fast switch and keyboard shortcuts", () => {
  assert.match(ux, /admin-player-quick-switch/);
  assert.match(ux, /Предыдущий игрок/);
  assert.match(ux, /Следующий игрок/);
  assert.match(ux, /ArrowDown/);
});

test("operator-facing structured data is Russian first", () => {
  assert.match(ux, /challengeMetrics: "Метрики испытаний"/);
  assert.match(ux, /challengeRecords: "Результаты испытаний"/);
  assert.match(ux, /noHints: "Без подсказок"/);
  assert.match(ux, /perfect: "Идеальные прохождения"/);
  assert.match(ux, /recordTitle/);
  assert.match(ux, /Технические данные/);
  assert.match(ux, /Дополнительный параметр/);
});

test("leaderboards use mode tabs", () => {
  assert.match(ux, /upgradeLeaderboards/);
  assert.match(ux, /leaderboard-tabs/);
  assert.match(ux, /data-board-value/);
  assert.match(css, /\.leaderboard-tabs/);
  assert.match(css, /\.ux-native-board-select/);
});

test("desktop sidebar can collapse to icons", () => {
  assert.match(ux, /setupSidebarCollapse/);
  assert.match(ux, /solivoc-admin-sidebar-collapsed-v1/);
  assert.match(css, /\.sidebar-collapsed \.app-shell\{grid-template-columns:68px/);
  assert.match(css, /\.sidebar-collapse-toggle/);
});
