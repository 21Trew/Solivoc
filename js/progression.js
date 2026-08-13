/* Level rewards, achievements, win screen and tutorial coach. */
function calculateStars() {
  return Math.min(3, 1 + (state.run.hints === 0 ? 1 : 0) + (state.run.undos === 0 ? 1 : 0));
}
function updateDailyStreak(date) {
  const d = profile.daily;
  if (d.completedDates.includes(date)) return;
  const diff = d.lastDate ? daysBetween(d.lastDate, date) : null;
  if (diff === 1) d.currentStreak++;
  else if (diff === 2 && d.freezeWeek !== weekKey(date)) {
    d.currentStreak = Math.max(1, d.currentStreak + 1);
    d.freezeWeek = weekKey(date);
  } else if (diff === 0) {
  } else d.currentStreak = 1;
  d.lastDate = date;
  d.bestStreak = Math.max(d.bestStreak, d.currentStreak);
  d.completedDates.push(date);
  if (d.completedDates.length > 120) d.completedDates = d.completedDates.slice(-120);
}
let achievementQueue = [],
  achievementNoticeBusy = false,
  achievementNoticeTimer = null;
function showNextAchievement() {
  if (achievementNoticeBusy || !achievementQueue.length) return;
  const a = achievementQueue.shift();
  achievementNoticeBusy = true;
  $("#achievementNoticeIcon").textContent = a.icon || "🏆";
  $("#achievementNoticeTitle").textContent = a.title;
  $("#achievementNoticeDesc").textContent = a.desc;
  achievementNotice.classList.add("show");
  haptic([12, 35, 18]);
  clearTimeout(achievementNoticeTimer);
  achievementNoticeTimer = setTimeout(() => {
    achievementNotice.classList.remove("show");
    setTimeout(() => {
      achievementNoticeBusy = false;
      showNextAchievement();
    }, 260);
  }, 2700);
}
function queueAchievementNotifications(items) {
  if (!items?.length) return;
  achievementQueue.push(...items);
  showNextAchievement();
}
achievementNotice.addEventListener("click", () => {
  clearTimeout(achievementNoticeTimer);
  achievementNotice.classList.remove("show");
  setTimeout(() => {
    achievementNoticeBusy = false;
    showNextAchievement();
  }, 180);
});
function checkAchievements() {
  const fresh = [];
  for (const a of ACHIEVEMENTS)
    if (!profile.achievements.includes(a.id) && a.test(profile)) {
      profile.achievements.push(a.id);
      fresh.push(a);
    }
  if (fresh.length) {
    saveProfile();
    queueAchievementNotifications(fresh);
  }
  return fresh;
}
function nextTheme() {
  return THEME_DEFS.find((t) => t.stars > profile.totalStars) || null;
}
function finishLevel() {
  state.rewarded = true;
  const stars = calculateStars();
  let newAchievements = [];
  if (state.mode === "regular") {
    const old = profile.starsByLevel[state.level] || 0;
    profile.starsByLevel[state.level] = Math.max(old, stars);
    profile.currentLevel = Math.max(profile.currentLevel, state.level + 1);
    profile.stats.levelsCompleted++;
    if (stars === 3) profile.stats.tripleStarWins++;
    if (state.run.hints === 0) profile.stats.noHintWins++;
    if (state.run.undos === 0) profile.stats.noUndoWins++;
    track("level_completed", { level: state.level, stars });
  } else if (state.mode === "daily") {
    const date = todayKey();
    profile.dailyStars[date] = Math.max(profile.dailyStars[date] || 0, stars);
    if (!profile.daily.completedDates.includes(date)) profile.stats.dailyCompleted++;
    updateDailyStreak(date);
    track("daily_completed", { date, stars });
  } else if (state.mode === "tutorial") {
    track("tutorial_completed", { step: state.tutorialStep });
    if (state.tutorialStep === 3) profile.tutorialComplete = true;
  }
  recomputeStars();
  newAchievements = checkAchievements();
  save();
  showWin(stars, newAchievements);
  burst(true);
  haptic([20, 35, 45]);
}
function showWin(stars, newAchievements = []) {
  $("#winTitle").textContent =
    state.mode === "daily"
      ? "Daily пройден!"
      : state.mode === "tutorial"
        ? `Обучение ${state.tutorialStep}/3`
        : `Уровень ${state.level} пройден`;
  $("#winStars").innerHTML = [1, 2, 3]
    .map((i) => `<span class="${i <= stars ? "earned" : ""}">★</span>`)
    .join("");
  $("#winText").textContent =
    state.mode === "daily"
      ? `Серия: ${profile.daily.currentStreak} дн.`
      : state.mode === "tutorial"
        ? state.tutorialStep < 3
          ? "Отлично. Переходим к следующей механике."
          : "Обучение закончено. Теперь начинается настоящая игра."
        : `${state.totalCategories} категорий собрано.`;
  $("#winMetrics").innerHTML =
    `<span class="win-chip ${state.run.hints === 0 ? "good" : ""}">${state.run.hints ? "Подсказки: " + state.run.hints : "Без подсказок"}</span><span class="win-chip ${state.run.undos === 0 ? "good" : ""}">${state.run.undos ? "Отмены: " + state.run.undos : "Без отмен"}</span>`;
  $("#winStarTotal").textContent = `★ ${profile.totalStars} всего`;
  const nt = nextTheme();
  $("#winUnlock").textContent = nt
    ? `До темы ${nt.name}: ${nt.stars - profile.totalStars} ★`
    : "Все темы открыты";
  $("#next").textContent =
    state.mode === "tutorial"
      ? state.tutorialStep < 3
        ? "Дальше →"
        : "Начать игру →"
      : state.mode === "daily"
        ? "Новый уровень →"
        : "Следующий уровень →";
  $("#replay").style.display = state.mode === "tutorial" ? "none" : "block";
  modal.classList.add("show");
}
function updateCoach() {
  if (state.mode !== "tutorial") {
    coach.classList.remove("show", "tutorial");
    return;
  }
  coach.classList.add("show", "tutorial");
  const texts = {
    1: ["Шаг 1 из 3", "Дважды нажми на карточку категории — она сама отправится в свободный слот сверху."],
    2: [
      "Шаг 2 из 3",
      "Связанные слова можно складывать друг на друга или дважды нажимать, чтобы отправить их в открытую категорию.",
    ],
    3: [
      "Шаг 3 из 3",
      "Нажми на колоду, чтобы открыть карту. Двойной тап по сбросу отправит подходящее слово в категорию.",
    ],
  };
  $("#coachStep").textContent = texts[state.tutorialStep][0];
  $("#coachText").textContent = texts[state.tutorialStep][1];
}
