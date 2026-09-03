import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { mergeProfiles } from "../api/_auth-lib.mjs";

const syncSource = await readFile(new URL("../api/_profile-sync-lib.mjs", import.meta.url), "utf8");
const accountSource = await readFile(new URL("../api/account.mjs", import.meta.url), "utf8");

function profile(overrides = {}) {
  return {
    playerId: "u_testplayer123",
    currentLevel: 2,
    starsByLevel: { 1: 1 },
    totalStars: 1,
    campaignProgressVersion: 2,
    campaignProgressFloor: 1,
    xp: 45,
    discovered: [],
    achievements: [],
    levelRecords: {},
    stats: { levelsCompleted: 1, chapterFinalsCompleted: 0, tripleStarWins: 0 },
    ...overrides,
  };
}

test("stale profile merge cannot roll permanent campaign progress back", () => {
  const cloud = profile({
    currentLevel: 5,
    starsByLevel: { 1: 3, 2: 2, 3: 1, 4: 3 },
    totalStars: 9,
    campaignProgressFloor: 4,
    xp: 640,
    discovered: ["alpha", "beta"],
    achievements: ["first_win"],
    stats: { levelsCompleted: 4, chapterFinalsCompleted: 0, tripleStarWins: 2 },
  });
  const staleDevice = profile({
    currentLevel: 3,
    starsByLevel: { 1: 1, 2: 1 },
    totalStars: 2,
    campaignProgressFloor: 2,
    xp: 120,
    discovered: ["gamma"],
    achievements: [],
    stats: { levelsCompleted: 2, chapterFinalsCompleted: 0, tripleStarWins: 0 },
  });

  const merged = mergeProfiles(cloud, staleDevice, "u_testplayer123", { preferIncomingPreferences: false });
  assert.equal(merged.currentLevel, 5);
  assert.equal(merged.stats.levelsCompleted, 4);
  assert.equal(merged.starsByLevel[1], 3);
  assert.equal(merged.starsByLevel[4], 3);
  assert.ok(merged.xp >= 640);
  assert.ok(merged.discovered.includes("alpha"));
  assert.ok(merged.discovered.includes("gamma"));
  assert.ok(merged.achievements.includes("first_win"));
});

test("disjoint device progress survives repeated merge order", () => {
  const base = profile({ discovered: ["base"] });
  const phone = profile({ xp: 200, discovered: ["phone"], achievements: ["phone_badge"] });
  const tablet = profile({ xp: 170, discovered: ["tablet"], achievements: ["tablet_badge"] });

  const phoneFirst = mergeProfiles(base, phone, "u_testplayer123");
  const both = mergeProfiles(phoneFirst, tablet, "u_testplayer123", { preferIncomingPreferences: false });
  assert.ok(both.discovered.includes("phone"));
  assert.ok(both.discovered.includes("tablet"));
  assert.ok(both.achievements.includes("phone_badge"));
  assert.ok(both.achievements.includes("tablet_badge"));
  assert.equal(both.xp, 200);
});

test("account sync is serialized and persisted once", () => {
  assert.match(syncSource, /SET[^\n]*NX[^\n]*PX/);
  assert.match(syncSource, /PROFILE_LOCK_TTL_MS = 15000/);
  assert.match(syncSource, /profile-lock/);
  assert.match(syncSource, /EVAL/);
  assert.match(syncSource, /redis\.call\('GET', KEYS\[1\]\) ~= ARGV\[1\]/);
  assert.match(syncSource, /redis\.call\('SET', KEYS\[2\], ARGV\[2\]\)/);
  assert.match(syncSource, /redis\.call\('INCR', KEYS\[3\]\)/);
  assert.match(syncSource, /profile_lock_lost/);
  assert.match(accountSource, /mergeCloudProfileAtomic/);
  assert.doesNotMatch(accountSource, /writeJsonKey\(profileKey/);
  assert.doesNotMatch(accountSource, /cloudBeforeMerge/);
});

test("stale clients and lock contention are explicit protocol states", () => {
  assert.match(accountSource, /staleClient: merged\.staleClient/);
  assert.match(accountSource, /profile_busy/);
  assert.match(accountSource, /profile_lock_lost/);
  assert.match(accountSource, /retryable: true/);
});

test("active account traffic refreshes session and exposes server game day", () => {
  assert.match(accountSource, /EXPIRE/);
  assert.match(accountSource, /Set-Cookie/);
  assert.match(accountSource, /Europe\/Warsaw/);
  assert.match(accountSource, /gameDayId/);
  assert.match(accountSource, /serverNow/);
});
