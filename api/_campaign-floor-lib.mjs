const CHAPTER_SIZE = 10;

const int = (value, min = 0, max = 10_000_000) => Math.max(min, Math.min(max, Math.trunc(Number(value) || 0)));

export function cleanCampaignStars(input = {}) {
  const out = {};
  for (const [rawLevel, rawStars] of Object.entries(input && typeof input === "object" ? input : {})) {
    const level = int(rawLevel, 1, 10000);
    const stars = int(rawStars, 0, 3);
    if (level >= 1 && stars >= 1) out[level] = stars;
  }
  return out;
}

export function campaignProgress(profile = {}) {
  const stars = cleanCampaignStars(profile.starsByLevel);
  const highestStar = Math.max(0, ...Object.keys(stars).map(Number).filter(Number.isFinite));
  const highestRecord = Math.max(0, ...Object.entries(profile.levelRecords || {})
    .filter(([key, record]) => Number(key) >= 1 && (Number(record?.stars) > 0 || Number(record?.moves) > 0))
    .map(([key]) => Number(key))
    .filter(Number.isFinite));
  return Math.min(10000, Math.max(
    int(profile.currentLevel, 1, 10001) - 1,
    int(profile.stats?.levelsCompleted, 0, 10000),
    int(profile.campaignProgressFloor, 0, 10000),
    highestStar,
    highestRecord,
  ));
}

export function profileBehindCampaignFloor(profile = {}, floor = {}) {
  return campaignProgress(profile) < int(floor.levels, 0, 10000)
    || int(profile.totalStars, 0, 30000) < int(floor.stars, 0, 30000);
}

export function applyCampaignFloor(profile = {}, floor = {}) {
  const floorLevels = int(floor.levels, 0, 10000);
  const floorStars = int(floor.stars, 0, 30000);
  const completed = Math.max(campaignProgress(profile), floorLevels);
  const starsByLevel = cleanCampaignStars(profile.starsByLevel);

  for (let level = 1; level <= completed; level++) if (!starsByLevel[level]) starsByLevel[level] = 1;
  for (const key of Object.keys(starsByLevel)) if (Number(key) > completed) delete starsByLevel[key];

  let runningStars = Object.values(starsByLevel).reduce((sum, value) => sum + int(value, 0, 3), 0);
  const targetStars = Math.min(completed * 3, Math.max(runningStars, int(profile.totalStars, 0, 30000), floorStars));
  for (let level = 1; level <= completed && runningStars < targetStars; level++) {
    const current = int(starsByLevel[level], 1, 3);
    const add = Math.min(3 - current, targetStars - runningStars);
    if (add <= 0) continue;
    starsByLevel[level] = current + add;
    runningStars += add;
  }

  profile.starsByLevel = starsByLevel;
  profile.currentLevel = completed + 1;
  profile.totalStars = runningStars;
  profile.stats = { ...(profile.stats || {}) };
  profile.stats.levelsCompleted = completed;
  profile.stats.chapterFinalsCompleted = Math.floor(completed / CHAPTER_SIZE);
  profile.stats.tripleStarWins = Object.values(starsByLevel).filter((value) => Number(value) === 3).length;
  profile.campaignProgressVersion = Math.max(2, Number(profile.campaignProgressVersion) || 0);
  profile.campaignProgressFloor = Math.max(int(profile.campaignProgressFloor, 0, 10000), completed);
  profile.cosmeticStarsPeak = Math.max(int(profile.cosmeticStarsPeak), runningStars + int(profile.dailyStarTotal));
  return profile;
}

export function leaderboardCampaignFloor(record = {}) {
  return { levels: int(record?.values?.levels, 0, 10000), stars: int(record?.values?.stars, 0, 30000) };
}
