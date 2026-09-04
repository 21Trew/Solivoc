import test from "node:test";
import assert from "node:assert/strict";
import {
  mergeCanonicalProfile,
  mergeCompletionTransactions,
  normalizeCanonicalProfile,
} from "../api/_canonical-profile-lib.mjs";
import { leaderboardValuesFromProfile } from "../api/_leaderboard-projection-lib.mjs";

function profile({ completed = 0, stars = {}, xp = 0, transactions = {}, modeStats = {}, levelRecords = {} } = {}) {
  return {
    currentLevel: completed + 1,
    campaignProgressVersion: 3,
    campaignProgressFloor: completed,
    starsByLevel: stars,
    totalStars: Object.values(stars).reduce((sum, value) => sum + value, 0),
    xp,
    completionLedgerBase: 0,
    completionTransactions: transactions,
    completionTransactionsVersion: 2,
    modeStats,
    levelRecords,
    stats: { levelsCompleted: completed, chapterFinalsCompleted: Math.floor(completed / 10), tripleStarWins: Object.values(stars).filter((x) => x === 3).length },
  };
}

test("completed levels never manufacture stars", () => {
  const canonical = normalizeCanonicalProfile(profile({
    completed: 5,
    stars: { 1: 3, 2: 1, 3: 2 },
  }));
  assert.equal(canonical.stats.levelsCompleted, 5);
  assert.equal(canonical.currentLevel, 6);
  assert.deepEqual(canonical.starsByLevel, { 1: 3, 2: 1, 3: 2 });
  assert.equal(canonical.totalStars, 6);
  assert.equal(canonical.starsByLevel[4], undefined);
  assert.equal(canonical.starsByLevel[5], undefined);
});

test("two offline devices merge stars per exact level", () => {
  const server = profile({ completed: 2, stars: { 1: 3, 2: 1 } });
  const offline = profile({ completed: 3, stars: { 2: 2, 3: 1 } });
  const merged = mergeCanonicalProfile(server, offline, { ...server });
  assert.deepEqual(merged.starsByLevel, { 1: 3, 2: 2, 3: 1 });
  assert.equal(merged.totalStars, 6);
  assert.equal(merged.stats.levelsCompleted, 3);
});

test("replaying a level can upgrade only that level stars", () => {
  const server = profile({ completed: 3, stars: { 1: 2, 2: 1, 3: 2 } });
  const incoming = profile({
    completed: 3,
    stars: { 1: 2, 2: 3, 3: 2 },
    transactions: {
      tx_upgrade: { version: 2, type: "completion", mode: "regular", campaign: true, level: 2, stars: 3, xpDelta: 45, at: 10 },
    },
  });
  const merged = mergeCanonicalProfile(server, incoming, server);
  assert.deepEqual(merged.starsByLevel, { 1: 2, 2: 3, 3: 2 });
  assert.equal(merged.totalStars, 7);
});

test("same transaction id contributes xp once", () => {
  const tx = { version: 2, type: "completion", mode: "regular", campaign: true, level: 10, stars: 2, xpDelta: 50, at: 100 };
  const transactions = mergeCompletionTransactions({ same: tx }, { same: tx });
  const merged = mergeCanonicalProfile(
    profile({ completed: 9, xp: 0, transactions: { same: tx } }),
    profile({ completed: 10, xp: 0, transactions: { same: tx } }),
    {},
  );
  assert.equal(Object.keys(transactions).length, 1);
  assert.equal(merged.xp, 50);
});

test("different offline transactions accumulate without double count", () => {
  const a = { version: 2, type: "completion", mode: "regular", campaign: true, level: 10, stars: 1, xpDelta: 40, at: 100 };
  const b = { version: 2, type: "completion", mode: "regular", campaign: true, level: 11, stars: 2, xpDelta: 60, at: 200 };
  const merged = mergeCanonicalProfile(
    profile({ completed: 10, transactions: { a } }),
    profile({ completed: 11, transactions: { b } }),
    {},
  );
  assert.equal(Object.keys(merged.completionTransactions).length, 2);
  assert.equal(merged.xp, 100);
  assert.equal(merged.starsByLevel[10], 1);
  assert.equal(merged.starsByLevel[11], 2);
});

test("lower time and moves are preserved as better records", () => {
  const server = profile({ modeStats: { time: { bestTimeMs: 60000 }, moves: { bestMoves: 80 } } });
  const offline = profile({ modeStats: { time: { bestTimeMs: 55000 }, moves: { bestMoves: 70 } } });
  const merged = mergeCanonicalProfile(server, offline, { modeStats: { time: { bestTimeMs: 60000 }, moves: { bestMoves: 80 } } });
  assert.equal(merged.modeStats.time.bestTimeMs, 55000);
  assert.equal(merged.modeStats.moves.bestMoves, 70);
});

test("leaderboard is an exact projection of canonical campaign", () => {
  const canonical = normalizeCanonicalProfile(profile({ completed: 5, stars: { 1: 3, 2: 1, 3: 2, 4: 1, 5: 3 } }));
  const values = leaderboardValuesFromProfile(canonical);
  assert.equal(values.levels, 5);
  assert.equal(values.stars, 10);
  assert.notEqual(values.stars, values.levels * 3);
});

test("stale client cannot reduce exact star history", () => {
  const server = profile({ completed: 5, stars: { 1: 3, 2: 3, 3: 2, 4: 2, 5: 1 } });
  const stale = profile({ completed: 3, stars: { 1: 1, 2: 2, 3: 1 } });
  const merged = mergeCanonicalProfile(server, stale, stale);
  assert.deepEqual(merged.starsByLevel, server.starsByLevel);
  assert.equal(merged.stats.levelsCompleted, 5);
  assert.equal(merged.totalStars, 11);
});
