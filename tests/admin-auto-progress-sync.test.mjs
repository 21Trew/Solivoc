import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../admin.html", import.meta.url), "utf8");
const leaderboard = await readFile(new URL("../api/leaderboard.mjs", import.meta.url), "utf8");
const autoSync = await readFile(new URL("../js/admin-auto-sync.js", import.meta.url), "utf8");

test("leaderboard post is projection-only", () => {
  assert.match(leaderboard, /Client payload is intentionally ignored/);
  assert.match(leaderboard, /syncLeaderboardProjection\(playerId,profile,session\.user\)/);
  assert.doesNotMatch(leaderboard, /syncCampaignFloor/);
  assert.doesNotMatch(leaderboard, /profileBehindCampaignFloor/);
  assert.doesNotMatch(leaderboard, /applyCampaignFloor/);
});

test("admin loads canonical projection guard", () => {
  assert.match(html, /js\/admin-auto-sync\.js/);
  assert.match(autoSync, /Проекция лидерборда устарела/);
  assert.match(autoSync, /Канонический профиль игрока имеет приоритет/);
});

test("legacy admin repair cannot use leaderboard as profile floor", () => {
  assert.match(autoSync, /data-player-command="repair_player"/);
  assert.match(autoSync, /stopImmediatePropagation/);
  assert.doesNotMatch(autoSync, /command:\s*"repair_player"/);
  assert.doesNotMatch(autoSync, /Автоматическая синхронизация профиля с серверным лидербордом/);
});
