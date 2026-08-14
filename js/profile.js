/* Persistent player profile, stars, analytics, settings and theme state. */
function defaultProfile() {
  return {
    currentLevel: 1,
    starsByLevel: {},
    dailyStars: {},
    totalStars: 0,
    discovered: [],
    achievements: [],
    theme: "violet",
    cardBack: "classic",
    cardBackUnlocksSeen: ["classic"],
    effect: "spark",
    effectUnlocksSeen: ["spark"],
    playerName: "Игрок",
    titleId: "player",
    categoryStats: {},
    levelRecords: {},
    dailyRecords: {},
    challengeRecords: {},
    sentChallenges: [],
    receivedChallenges: [],
    pendingChallengeSubmissions: [],
    weekly: { key: null, id: null, baseline: {}, completed: false, completedCount: 0 },
    tutorialComplete: false,
    legacyStarsMigrated: false,
    categoryAchievementModelMigrated: false,
    settings: { sound: true, music: true, haptics: true },
    stats: { ...DEFAULT_STATS },
    daily: { lastDate: null, currentStreak: 0, bestStreak: 0, completedDates: [], freezeWeek: null },
  };
}
function loadProfile() {
  const keys = [PROFILE_KEY, PREV_PROFILE_KEY, ...(typeof LEGACY_PROFILE_KEYS !== "undefined" ? LEGACY_PROFILE_KEYS : [])];
  for (const key of keys) {
    try {
      const p = JSON.parse(localStorage.getItem(key));
      if (!p) continue;
      return {
        ...defaultProfile(),
        ...p,
        stats: { ...DEFAULT_STATS, ...(p.stats || {}) },
        daily: { ...defaultProfile().daily, ...(p.daily || {}) },
        settings: { ...defaultProfile().settings, ...(p.settings || {}) },
        discovered: Array.isArray(p.discovered) ? p.discovered : [],
        achievements: Array.isArray(p.achievements) ? p.achievements : [],
        cardBackUnlocksSeen: Array.isArray(p.cardBackUnlocksSeen) ? p.cardBackUnlocksSeen : ["classic"],
        effectUnlocksSeen: Array.isArray(p.effectUnlocksSeen) ? p.effectUnlocksSeen : ["spark"],
        categoryStats: p.categoryStats && typeof p.categoryStats === "object" ? p.categoryStats : {},
        levelRecords: p.levelRecords && typeof p.levelRecords === "object" ? p.levelRecords : {},
        dailyRecords: p.dailyRecords && typeof p.dailyRecords === "object" ? p.dailyRecords : {},
        challengeRecords: p.challengeRecords && typeof p.challengeRecords === "object" ? p.challengeRecords : {},
        sentChallenges: Array.isArray(p.sentChallenges) ? p.sentChallenges : [],
        receivedChallenges: Array.isArray(p.receivedChallenges) ? p.receivedChallenges : [],
        pendingChallengeSubmissions: Array.isArray(p.pendingChallengeSubmissions) ? p.pendingChallengeSubmissions : [],
        weekly: { ...defaultProfile().weekly, ...(p.weekly || {}) },
      };
    } catch {}
  }
  return defaultProfile();
}
let profile = loadProfile();
function inferLegacyCompletedThrough() {
  let completed = Math.max(0, (+profile.currentLevel || 1) - 1);
  const keys = [SAVE_KEY, OLD_SAVE_KEY, "assoc-klondike-v6", "assoc-klondike-v5", "assoc-klondike-v4"];
  for (const key of keys) {
    try {
      const s = JSON.parse(localStorage.getItem(key));
      if (!s?.level) continue;
      const regular = !s.mode || s.mode === "regular";
      if (!regular) continue;
      const through = Math.max(0, (+s.level || 1) - (s.rewarded ? 0 : 1));
      completed = Math.max(completed, through);
    } catch {}
  }
  return completed;
}
function migrateLegacyStars() {
  if (profile.legacyStarsMigrated) return;
  const through = inferLegacyCompletedThrough();
  profile.starsByLevel = profile.starsByLevel || {};
  for (let level = 1; level <= through; level++)
    if (!(+profile.starsByLevel[level] > 0)) profile.starsByLevel[level] = 1;
  profile.currentLevel = Math.max(+profile.currentLevel || 1, through + 1);
  profile.stats.levelsCompleted = Math.max(+profile.stats.levelsCompleted || 0, through);
  profile.legacyStarsMigrated = true;
}
migrateLegacyStars();

function analyticsCount(name) {
  try {
    const data = JSON.parse(localStorage.getItem(ANALYTICS_KEY));
    return +(data?.counts?.[name] || 0);
  } catch {
    return 0;
  }
}
function migrateAchievementCounters() {
  if (!profile.categoryAchievementModelMigrated) {
    // Re-check every category achievement against UNIQUE discovered categories.
    // This also removes false positives awarded by the old cumulative counter.
    const categoryAchievementIds = new Set([
      "categories100",
      "categories1000",
      "categories2500",
      "collector",
      "encyclopedia",
      "collectorAll",
    ]);
    profile.achievements = (profile.achievements || []).filter((id) => !categoryAchievementIds.has(id));
    profile.categoryAchievementModelMigrated = true;
  }

  // A played game is a successfully completed regular or Daily round.
  // Rebuild as much historical progress as possible from persistent analytics.
  const analyticsGames = analyticsCount("level_completed") + analyticsCount("daily_completed");
  const minimumKnownGames = (+profile.stats.levelsCompleted || 0) + (+profile.stats.dailyCompleted || 0);
  profile.stats.gamesPlayed = Math.max(+profile.stats.gamesPlayed || 0, analyticsGames, minimumKnownGames);
}
migrateAchievementCounters();
function migrateMetaProfile() {
  profile.categoryStats = profile.categoryStats || {};
  for (const id of profile.discovered || []) {
    const old = profile.categoryStats[id] || {};
    profile.categoryStats[id] = { encounters: 1, completions: 1, firstLevel: null, words: [], ...old };
  }
  profile.levelRecords = profile.levelRecords || {};
  profile.dailyRecords = profile.dailyRecords || {};
  profile.challengeRecords = profile.challengeRecords || {};
  profile.sentChallenges = Array.isArray(profile.sentChallenges) ? profile.sentChallenges : [];
  profile.receivedChallenges = Array.isArray(profile.receivedChallenges) ? profile.receivedChallenges : [];
  profile.pendingChallengeSubmissions = Array.isArray(profile.pendingChallengeSubmissions) ? profile.pendingChallengeSubmissions : [];
  profile.weekly = { ...defaultProfile().weekly, ...(profile.weekly || {}) };
  profile.effectUnlocksSeen = Array.isArray(profile.effectUnlocksSeen) ? profile.effectUnlocksSeen : ["spark"];
  if (!titleDefById(profile.titleId) || !titleUnlocked(titleDefById(profile.titleId), profile)) profile.titleId = "player";
  if (!profile.playerName) profile.playerName = "Игрок";
}
migrateMetaProfile();
function recomputeStars() {
  profile.totalStars =
    Object.values(profile.starsByLevel || {}).reduce((a, b) => a + (+b || 0), 0) +
    Object.values(profile.dailyStars || {}).reduce((a, b) => a + (+b || 0), 0);
}
function cardBackUnlocked(def, p = profile) {
  if (!def) return false;
  if (def.achievement) return p.achievements.includes(def.achievement);
  return p.achievements.length >= (def.minAchievements || 0);
}
function cardBackUnlockLabel(def) {
  if (def.achievement) {
    const a = ACHIEVEMENTS.find((x) => x.id === def.achievement);
    return a ? `Достижение: ${a.title}` : def.desc;
  }
  return def.minAchievements ? `${def.minAchievements} достижений` : "Базовая";
}
function applyCardBack(id) {
  const def = CARD_BACK_DEFS.find((x) => x.id === id);
  const back = def && cardBackUnlocked(def) ? id : "classic";
  profile.cardBack = back;
  document.body.dataset.cardBack = back;
}
function effectUnlocked(def, p = profile) {
  if (!def) return false;
  if (def.achievement) return p.achievements.includes(def.achievement);
  if (def.minWeekly) return (p.stats.weeklyCompleted || 0) >= def.minWeekly;
  return p.achievements.length >= (def.minAchievements || 0);
}
function effectUnlockLabel(def) {
  if (def.achievement) {
    const a = ACHIEVEMENTS.find((x) => x.id === def.achievement);
    return a ? `Достижение: ${a.title}` : def.desc;
  }
  if (def.minWeekly) return `${def.minWeekly} недельных испытания`;
  return def.minAchievements ? `${def.minAchievements} достижений` : "Базовый";
}
function titleUnlocked(def, p = profile) {
  return !!def && (!def.achievement || p.achievements.includes(def.achievement));
}
function applyEffect(id) {
  const def = EFFECT_DEFS.find((x) => x.id === id);
  profile.effect = def && effectUnlocked(def) ? id : "spark";
  document.body.dataset.effect = profile.effect;
}
function applyTitle(id) {
  const def = titleDefById(id);
  profile.titleId = def && titleUnlocked(def) ? id : "player";
}
function saveProfile() {
  recomputeStars();
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  applyTheme(profile.theme);
  applyCardBack(profile.cardBack);
  applyEffect(profile.effect);
  applyTitle(profile.titleId);
}
function track(name, data = {}) {
  try {
    const a = JSON.parse(localStorage.getItem(ANALYTICS_KEY)) || { counts: {}, events: [] };
    a.counts[name] = (a.counts[name] || 0) + 1;
    a.events.push({ name, t: Date.now(), ...data });
    if (a.events.length > 250) a.events = a.events.slice(-250);
    localStorage.setItem(ANALYTICS_KEY, JSON.stringify(a));
  } catch {}
}
function applyTheme(id) {
  const def = THEME_DEFS.find((t) => t.id === id),
    allowed = def && profile.totalStars >= def.stars;
  const theme = allowed ? id : "violet";
  profile.theme = theme;
  document.body.dataset.theme = theme;
}
recomputeStars();
applyTheme(profile.theme);
applyCardBack(profile.cardBack);
applyEffect(profile.effect);
applyTitle(profile.titleId);
