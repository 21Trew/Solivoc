import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const state = await readFile(new URL("../js/game/state.js", import.meta.url), "utf8");
const guard = await readFile(new URL("../js/ios-round-stability-v2.js", import.meta.url), "utf8");
const build = await readFile(new URL("../scripts/build-frontend.mjs", import.meta.url), "utf8");

test("round backup is never deleted to rescue a primary write", () => {
  assert.doesNotMatch(state, /removeItem\(SAVE_BACKUP_KEY\);\s*localStorage\.setItem\(SAVE_KEY/);
  assert.match(state, /Never delete the previous recovery point/);
  assert.match(state, /round_save_failed/);
});

test("constrained devices keep a smaller undo memory budget", () => {
  assert.match(state, /IOS_UNDO_SNAPSHOTS = 2/);
  assert.match(state, /Date\.now\(\) - lastStateWriteAt < 420/);
});

test("valid backup is promoted after round recovery", () => {
  assert.match(state, /round_restored_from_backup/);
  assert.match(state, /localStorage\.setItem\(SAVE_KEY, JSON\.stringify\(state\)\)/);
});

test("active round profile writes are coalesced outside explicit commits", () => {
  assert.match(guard, /stabilityBudgetedProfileSave/);
  assert.match(guard, /activeRound/);
  assert.match(guard, /Object\.prototype\.hasOwnProperty\.call\(options, "skipCloud"\)/);
  assert.match(guard, /setTimeout\(flushDeferredProfile/);
});

test("hidden lifecycle profile flushes are deduplicated", () => {
  assert.match(guard, /stabilityDedupedProfileFlush/);
  assert.match(guard, /now - lastProfileFlushAt < 700/);
  assert.match(guard, /skipCloud: true/);
});

test("ios skips nonessential gameplay web animations", () => {
  assert.match(guard, /stabilityRevealAnimation/);
  assert.match(guard, /stabilityRecycleAnimation/);
  assert.match(guard, /stabilityCategoryCompletion/);
});

test("frontend loads the v2 guard last before app bootstrap", () => {
  const canonical = build.indexOf("canonical-sync-hardening.js");
  const ios = build.indexOf("ios-round-stability-v2.js");
  assert.ok(canonical >= 0 && ios > canonical);
});
