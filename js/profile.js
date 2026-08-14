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
    tutorialComplete: false,
    legacyStarsMigrated: false,
    settings: { sound: true, music: true, haptics: true },
    stats: { ...DEFAULT_STATS },
    daily: { lastDate: null, currentStreak: 0, bestStreak: 0, completedDates: [], freezeWeek: null },
  };
}
function loadProfile() {
  const keys = [PROFILE_KEY, PREV_PROFILE_KEY];
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
function saveProfile() {
  recomputeStars();
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  applyTheme(profile.theme);
  applyCardBack(profile.cardBack);
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
