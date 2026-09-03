import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const recovery = await readFile(new URL("../api/_admin-recovery-lib.mjs", import.meta.url), "utf8");
const endpoint = await readFile(new URL("../api/admin-recovery.mjs", import.meta.url), "utf8");
const account = await readFile(new URL("../api/account.mjs", import.meta.url), "utf8");
const gateway = await readFile(new URL("../yandex/index.mjs", import.meta.url), "utf8");
const html = await readFile(new URL("../admin.html", import.meta.url), "utf8");
const client = await readFile(new URL("../js/admin-recovery.js", import.meta.url), "utf8");
const build = await readFile(new URL("../scripts/build-frontend.mjs", import.meta.url), "utf8");

test("admin recovery covers daily streaks and daily quests", () => {
  assert.match(recovery, /currentStreak/);
  assert.match(recovery, /bestStreak/);
  assert.match(recovery, /completedDates/);
  assert.match(recovery, /dailyQuests/);
  assert.match(recovery, /mascotDaily/);
  assert.match(recovery, /weekly/);
  assert.match(recovery, /monthly/);
});

test("recovery creates rollback checkpoints and is idempotent", () => {
  assert.match(recovery, /createCheckpoint/);
  assert.match(recovery, /progress_restore_checkpoint/);
  assert.match(recovery, /RECOVERY_COMMAND_PREFIX/);
  assert.match(recovery, /"pending", "NX"/);
  assert.match(recovery, /CHECKPOINT_TTL/);
});

test("full progress snapshot excludes authentication and device state", () => {
  assert.match(recovery, /PROGRESS_ROOTS/);
  assert.doesNotMatch(recovery, /PROGRESS_ROOTS[\s\S]{0,600}passwordHash/);
  assert.doesNotMatch(recovery, /PROGRESS_ROOTS[\s\S]{0,600}analyticsClientId/);
  assert.doesNotMatch(recovery, /PROGRESS_ROOTS[\s\S]{0,600}pushClientId/);
});

test("old devices cannot overwrite newer admin-restored domains", () => {
  assert.match(recovery, /reconcileAdminRecoveryDomains/);
  assert.match(recovery, /adminRecovery/);
  assert.match(account, /reconcileAdminRecoveryDomains\(current, incoming, profile\)/);
});

test("admin recovery endpoint is protected and routed under admin cookie path", () => {
  assert.match(endpoint, /currentAdminSession/);
  assert.match(endpoint, /admin-recovery-write/);
  assert.match(gateway, /\/api\/admin\/recovery/);
  assert.match(gateway, /adminRecovery\[request\.method\]/);
});

test("admin UI exposes recovery forms and cache-busts their assets", () => {
  assert.match(html, /id="adminRecovery"/);
  assert.match(html, /id="recoveryCurrentStreak"/);
  assert.match(html, /id="recoveryDailyQuests"/);
  assert.match(html, /id="recoveryFullSnapshot"/);
  assert.match(client, /Восстановить ежедневный прогресс/);
  assert.match(client, /data-recovery-user/);
  assert.match(build, /admin-recovery\.js/);
  assert.match(build, /admin-recovery\.css/);
});
