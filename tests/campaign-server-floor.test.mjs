import test from "node:test";
import assert from "node:assert/strict";
import { applyCampaignFloor, profileBehindCampaignFloor } from "../api/_campaign-floor-lib.mjs";

test("server campaign floor restores a profile that trails the leaderboard", () => {
  const profile = {
    currentLevel: 641,
    totalStars: 1920,
    starsByLevel: Object.fromEntries(Array.from({ length: 640 }, (_, i) => [i + 1, 3])),
    stats: { levelsCompleted: 640, chapterFinalsCompleted: 64, tripleStarWins: 640 },
    campaignProgressVersion: 2,
    campaignProgressFloor: 640,
  };

  assert.equal(profileBehindCampaignFloor(profile, { levels: 685, stars: 2055 }), true);
  const fixed = applyCampaignFloor(profile, { levels: 685, stars: 2055 });
  assert.equal(fixed.stats.levelsCompleted, 685);
  assert.equal(fixed.currentLevel, 686);
  assert.equal(fixed.totalStars, 2055);
  assert.equal(fixed.campaignProgressFloor, 685);
  assert.equal(fixed.stats.tripleStarWins, 685);
});

test("server campaign floor never reduces newer cloud progress", () => {
  const profile = {
    currentLevel: 701,
    totalStars: 2090,
    starsByLevel: Object.fromEntries(Array.from({ length: 700 }, (_, i) => [i + 1, i < 690 ? 3 : 2])),
    stats: { levelsCompleted: 700 },
    campaignProgressVersion: 2,
    campaignProgressFloor: 700,
  };

  assert.equal(profileBehindCampaignFloor(profile, { levels: 685, stars: 2055 }), false);
  const fixed = applyCampaignFloor(profile, { levels: 685, stars: 2055 });
  assert.equal(fixed.stats.levelsCompleted, 700);
  assert.equal(fixed.currentLevel, 701);
  assert.ok(fixed.totalStars >= 2055);
});
