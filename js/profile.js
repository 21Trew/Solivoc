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
    playerId: "",
    avatarEmoji: "🙂",
    titleId: "player",
    frame: "none",
    soundPack: "classic",
    dailyQuests: { date: "", modes: [], progress: {}, rewarded: {} },
    activeMarathon: null,
    xp: 0,
    pendingRankUp: null,
    xpMigrated: false,
    masteryMigrated: false,
    pushClientId: "",
    retention: { lastOpenDate: null, openDays: [], totalOpenDays: 0, lastSessionAt: 0, firstOpenAt: 0, d1Tracked: false, d7Tracked: false },
    onboardingComplete: false,
    onboardingVersion: 1,
    favoriteCategory: "",
    featuredAchievements: [],
    developerMailSeen: [],
    developerMailDeleted: [],
    patchSeenVersion: "",
    adaptive: { bias: 0, history: [], restartsSinceWin: 0 },
    weeklyDigest: { key: "", baseline: null, pending: null, seenKey: "" },
    challengeMetrics: { levels: 0, stars: 0, noHints: 0, perfect: 0, categories: 0, hints: 0, combo: 0, moves: 0 },
    challengeMetricsVersion: 2,
    modeStats: {},
    customRules: { timeLimitSec: 180, moveLimit: 90, comboTarget: 10, noMistakes: false, onePass: false },
    analyticsClientId: "",
    categoryStats: {},
    associationCollections: {},
    visualDiscovered: [],
    levelRecords: {},
    dailyRecords: {},
    challengeRecords: {},
    sentChallenges: [],
    receivedChallenges: [],
    pendingChallengeSubmissions: [],
    weekly: { key: null, id: null, baseline: {}, completed: false, rewarded: false, completedCount: 0 },
    monthly: { key: null, id: null, baseline: {}, completed: false, rewarded: false, completedCount: 0 },
    tutorialComplete: false,
    legacyStarsMigrated: false,
    categoryAchievementModelMigrated: false,
    settings: { sound: true, music: true, haptics: true, notifications: false, challengeReminders: true, dailyReminders: true, weeklyReminders: true, notificationPrompted: false, cardSourceMode: "all", startupScreen: "home" },
    stats: { ...DEFAULT_STATS },
    daily: { lastDate: null, currentStreak: 0, bestStreak: 0, completedDates: [], freezeWeek: null, weekRewards: {} },
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
        daily: { ...defaultProfile().daily, ...(p.daily || {}), weekRewards: { ...(p.daily?.weekRewards || {}) } },
        settings: { ...defaultProfile().settings, ...(p.settings || {}) },
        retention: { ...defaultProfile().retention, ...(p.retention || {}), openDays: Array.isArray(p.retention?.openDays) ? p.retention.openDays : [] },
        discovered: Array.isArray(p.discovered) ? p.discovered : [],
        achievements: Array.isArray(p.achievements) ? p.achievements : [],
        cardBackUnlocksSeen: Array.isArray(p.cardBackUnlocksSeen) ? p.cardBackUnlocksSeen : ["classic"],
        effectUnlocksSeen: Array.isArray(p.effectUnlocksSeen) ? p.effectUnlocksSeen : ["spark"],
        categoryStats: p.categoryStats && typeof p.categoryStats === "object" ? p.categoryStats : {},
        associationCollections: p.associationCollections && typeof p.associationCollections === "object" ? p.associationCollections : {},
        visualDiscovered: Array.isArray(p.visualDiscovered) ? p.visualDiscovered : [],
        levelRecords: p.levelRecords && typeof p.levelRecords === "object" ? p.levelRecords : {},
        dailyRecords: p.dailyRecords && typeof p.dailyRecords === "object" ? p.dailyRecords : {},
        challengeRecords: p.challengeRecords && typeof p.challengeRecords === "object" ? p.challengeRecords : {},
        sentChallenges: Array.isArray(p.sentChallenges) ? p.sentChallenges : [],
        receivedChallenges: Array.isArray(p.receivedChallenges) ? p.receivedChallenges : [],
        pendingChallengeSubmissions: Array.isArray(p.pendingChallengeSubmissions) ? p.pendingChallengeSubmissions : [],
        weekly: { ...defaultProfile().weekly, ...(p.weekly || {}) },
        monthly: { ...defaultProfile().monthly, ...(p.monthly || {}) },
        dailyQuests: { ...defaultProfile().dailyQuests, ...(p.dailyQuests || {}), modes: Array.isArray(p.dailyQuests?.modes) ? p.dailyQuests.modes : [], progress: { ...(p.dailyQuests?.progress || {}) }, rewarded: { ...(p.dailyQuests?.rewarded || {}) } },
        activeMarathon: p.activeMarathon && typeof p.activeMarathon === "object" ? p.activeMarathon : null,
        onboardingComplete: typeof p.onboardingComplete === "boolean" ? p.onboardingComplete : !!p.tutorialComplete,
        featuredAchievements: Array.isArray(p.featuredAchievements) ? p.featuredAchievements : [],
        developerMailSeen: Array.isArray(p.developerMailSeen) ? p.developerMailSeen : [],
        developerMailDeleted: Array.isArray(p.developerMailDeleted) ? p.developerMailDeleted : [],
        adaptive: { ...defaultProfile().adaptive, ...(p.adaptive || {}), history: Array.isArray(p.adaptive?.history) ? p.adaptive.history : [] },
        weeklyDigest: { ...defaultProfile().weeklyDigest, ...(p.weeklyDigest || {}) },
        challengeMetrics: { ...defaultProfile().challengeMetrics, ...(p.challengeMetrics || {}) },
        modeStats: p.modeStats && typeof p.modeStats === "object" ? p.modeStats : {},
        customRules: { ...defaultProfile().customRules, ...(p.customRules || {}) },
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
  profile.monthly = { ...defaultProfile().monthly, ...(profile.monthly || {}) };
  profile.dailyQuests = { ...defaultProfile().dailyQuests, ...(profile.dailyQuests || {}), modes: Array.isArray(profile.dailyQuests?.modes) ? profile.dailyQuests.modes : [], progress: { ...(profile.dailyQuests?.progress || {}) }, rewarded: { ...(profile.dailyQuests?.rewarded || {}) } };
  profile.activeMarathon = profile.activeMarathon && typeof profile.activeMarathon === "object" ? profile.activeMarathon : null;
  profile.effectUnlocksSeen = Array.isArray(profile.effectUnlocksSeen) ? profile.effectUnlocksSeen : ["spark"];
  profile.daily.weekRewards = profile.daily.weekRewards && typeof profile.daily.weekRewards === "object" ? profile.daily.weekRewards : {};
  profile.retention = { ...defaultProfile().retention, ...(profile.retention || {}) };
  profile.retention.openDays = Array.isArray(profile.retention.openDays) ? profile.retention.openDays : [];
  profile.retention.totalOpenDays = Math.max(+profile.retention.totalOpenDays || 0, profile.retention.openDays.length);
  profile.adaptive = { ...defaultProfile().adaptive, ...(profile.adaptive || {}) };
  profile.adaptive.history = Array.isArray(profile.adaptive.history) ? profile.adaptive.history.slice(-12) : [];
  profile.weeklyDigest = { ...defaultProfile().weeklyDigest, ...(profile.weeklyDigest || {}) };
  profile.featuredAchievements = Array.isArray(profile.featuredAchievements) ? profile.featuredAchievements.filter((id) => profile.achievements.includes(id)).slice(0, 3) : [];
  profile.developerMailSeen = Array.isArray(profile.developerMailSeen) ? [...new Set(profile.developerMailSeen.map(String))] : [];
  profile.developerMailDeleted = Array.isArray(profile.developerMailDeleted) ? [...new Set(profile.developerMailDeleted.map(String))] : [];
  profile.challengeMetrics = { ...defaultProfile().challengeMetrics, ...(profile.challengeMetrics || {}) };
  if ((+profile.challengeMetricsVersion || 0) < 2) {
    const weeklyCount = profile.weekly?.completedCount || profile.stats?.weeklyCompleted || 0;
    const monthlyCount = profile.monthly?.completedCount || profile.stats?.monthlyCompleted || 0;
    profile.weekly = { ...defaultProfile().weekly, completedCount: weeklyCount };
    profile.monthly = { ...defaultProfile().monthly, completedCount: monthlyCount };
    profile.challengeMetrics = { ...defaultProfile().challengeMetrics };
    profile.challengeMetricsVersion = 2;
  }
  profile.modeStats = profile.modeStats && typeof profile.modeStats === "object" ? profile.modeStats : {};
  profile.customRules = { ...defaultProfile().customRules, ...(profile.customRules || {}) };
  profile.favoriteCategory = String(profile.favoriteCategory || "");
  profile.playerId = String(profile.playerId || "");
  if (!profile.playerId) profile.playerId = `p_${Math.random().toString(36).slice(2,10)}${Date.now().toString(36).slice(-6)}`;
  profile.analyticsClientId = String(profile.analyticsClientId || "");
  if (!profile.analyticsClientId) profile.analyticsClientId = `a_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-5)}`;
  if (profile.tutorialComplete && profile.onboardingComplete == null) profile.onboardingComplete = true;
  profile.frame = FRAME_DEFS.some((f) => f.id === profile.frame) ? profile.frame : "none";
  profile.avatarEmoji = availableAvatarEmojis(profile).includes(profile.avatarEmoji) ? profile.avatarEmoji : "🙂";
  profile.associationCollections = profile.associationCollections && typeof profile.associationCollections === "object" ? profile.associationCollections : {};
  profile.pushClientId = String(profile.pushClientId || "");
  profile.settings.startupScreen = profile.settings.startupScreen === "game" ? "game" : "home";
  if (!profile.xpMigrated) {
    profile.xp = Math.max(+profile.xp || 0,
      (+profile.stats.levelsCompleted || 0) * 45 +
      (+profile.stats.dailyCompleted || 0) * 65 +
      (+profile.stats.challengesCompleted || 0) * 55 +
      (+profile.stats.specialCompleted || 0) * 20 +
      (+profile.stats.weeklyCompleted || 0) * 120 +
      (+profile.stats.masteredCategories || 0) * 100);
    profile.xpMigrated = true;
  }
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
  if (def.minMonthly) return (p.stats.monthlyCompleted || 0) >= def.minMonthly;
  return p.achievements.length >= (def.minAchievements || 0);
}
function effectUnlockLabel(def) {
  if (def.achievement) {
    const a = ACHIEVEMENTS.find((x) => x.id === def.achievement);
    return a ? `Достижение: ${a.title}` : def.desc;
  }
  if (def.minWeekly) return `${def.minWeekly} недельных испытания`;
  if (def.minMonthly) return `${def.minMonthly} месячное испытание`;
  return def.minAchievements ? `${def.minAchievements} достижений` : "Базовый";
}
function titleUnlocked(def, p = profile) {
  return !!def && (!def.achievement || p.achievements.includes(def.achievement)) && (!def.minXp || (+p.xp || 0) >= def.minXp);
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
function frameUnlocked(def, p = profile) {
  return !!def && (!def.chapter || completedChapterCount(p) >= def.chapter) && (!def.minDuelXp || (p.stats.duelXp || 0) >= def.minDuelXp);
}
function soundPackUnlocked(def, p = profile) { return !!def && (p.stats.duelXp || 0) >= (def.minDuelXp || 0); }
function applySoundPack(id) {
  const def = SOUND_PACK_DEFS.find((x) => x.id === id);
  profile.soundPack = def && soundPackUnlocked(def) ? id : "classic";
  document.body.dataset.soundPack = profile.soundPack;
}
function applyFrame(id) {
  const def = FRAME_DEFS.find((x) => x.id === id);
  profile.frame = def && frameUnlocked(def) ? def.id : "none";
  document.body.dataset.profileFrame = profile.frame;
}
function saveProfile() {
  recomputeStars();
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch (error) {
    console.warn("Profile save failed", error);
  }
  applyTheme(profile.theme);
  applyCardBack(profile.cardBack);
  applyEffect(profile.effect);
  applyTitle(profile.titleId);
  applyFrame(profile.frame);
  applySoundPack(profile.soundPack);
}
function track(name, data = {}) {
  try {
    const a = JSON.parse(localStorage.getItem(ANALYTICS_KEY)) || { counts: {}, events: [] };
    a.counts[name] = (a.counts[name] || 0) + 1;
    a.events.push({ name, t: Date.now(), ...data });
    if (a.events.length > 250) a.events = a.events.slice(-250);
    localStorage.setItem(ANALYTICS_KEY, JSON.stringify(a));
    if (typeof queueRemoteAnalytics === "function") queueRemoteAnalytics(name, data);
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
applyFrame(profile.frame);
applySoundPack(profile.soundPack);
