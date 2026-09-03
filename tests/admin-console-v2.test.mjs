import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../admin.html", import.meta.url), "utf8");
const client = await readFile(new URL("../js/admin.js", import.meta.url), "utf8");
const css = await readFile(new URL("../styles/admin.css", import.meta.url), "utf8");

test("admin console has stable top-level information architecture", () => {
  for (const section of ["overview", "players", "messages", "leaderboards", "audit", "system"]) {
    assert.match(html, new RegExp(`data-section="${section}"`));
  }
  assert.match(client, /SECTION_META/);
  assert.match(client, /location\.hash/);
});

test("player 360 covers operational domains", () => {
  for (const tab of ["summary", "progress", "daily", "rewards", "characters", "modes", "recovery", "history", "danger"]) {
    assert.match(client, new RegExp(`\\["${tab}"`));
  }
  for (const command of ["xp_adjust", "xp_set", "level_stars_set", "campaign_complete_through", "achievement_", "collectible_", "companion_force_", "adaptive_reset", "repair_player"]) {
    assert.match(client, new RegExp(command));
  }
});

test("console surfaces cloud versus leaderboard consistency", () => {
  assert.match(client, /ОБЛАЧНЫЙ ПРОФИЛЬ/);
  assert.match(client, /ЛИДЕРБОРД/);
  assert.match(client, /Облачный профиль отстаёт от серверного лидерборда/);
  assert.match(client, /repair_player/);
});

test("dangerous actions require explicit confirmations", () => {
  assert.match(client, /askConfirm/);
  assert.match(client, /DELETE \$\{userId\}/);
  assert.match(client, /Удалить аккаунт безвозвратно/);
  assert.match(html, /adminConfirmDialog/);
});

test("messages leaderboards audit and system tools remain first-class", () => {
  assert.match(client, /send_mail/);
  assert.match(client, /\/api\/leaderboard\?board=all/);
  assert.match(client, /\?audit=1&limit=200/);
  assert.match(client, /repair_all/);
  assert.match(client, /dedupe/);
  assert.match(client, /backup=1/);
});

test("layout is responsive and uses progressive disclosure", () => {
  assert.match(css, /@media\(max-width:860px\)/);
  assert.match(css, /\.players-layout/);
  assert.match(client, /<details class="details-box">/);
  assert.match(client, /РАСШИРЕННОЕ/);
});
