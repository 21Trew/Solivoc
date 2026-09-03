import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../admin.html", import.meta.url), "utf8");
const leaderboard = await readFile(new URL("../api/leaderboard.mjs", import.meta.url), "utf8");
const autoSync = await readFile(new URL("../js/admin-auto-sync.js", import.meta.url), "utf8");

test("leaderboard writes immediately protect cloud campaign progress", () => {
  assert.match(leaderboard, /mutateCloudProfileAtomic/);
  assert.match(leaderboard, /profileBehindCampaignFloor/);
  assert.match(leaderboard, /applyCampaignFloor/);
  assert.match(leaderboard, /syncCampaignFloor\(playerId, values\)/);
});

test("admin loads automatic progress reconciliation", () => {
  assert.match(html, /js\/admin-auto-sync\.js/);
  assert.match(autoSync, /autoRepairMismatch/);
  assert.match(autoSync, /Автоматическая синхронизация профиля с серверным лидербордом/);
});

test("manual repair bypasses operator reason field", () => {
  assert.match(autoSync, /data-player-command="repair_player"/);
  assert.match(autoSync, /stopImmediatePropagation/);
  assert.match(autoSync, /command:\s*"repair_player"/);
  assert.match(autoSync, /reason:\s*AUTO_REASON/);
});
