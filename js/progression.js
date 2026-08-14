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
  const newlyUnlockedBacks = CARD_BACK_DEFS.filter(
    (back) => back.id !== "classic" && cardBackUnlocked(back) && !profile.cardBackUnlocksSeen.includes(back.id),
  );
  const newlyUnlockedEffects = EFFECT_DEFS.filter(
    (effect) => effect.id !== "spark" && effectUnlocked(effect) && !profile.effectUnlocksSeen.includes(effect.id),
  );
  if (fresh.length || newlyUnlockedBacks.length || newlyUnlockedEffects.length) {
    newlyUnlockedBacks.forEach((back) => profile.cardBackUnlocksSeen.push(back.id));
    newlyUnlockedEffects.forEach((effect) => profile.effectUnlocksSeen.push(effect.id));
    saveProfile();
    queueAchievementNotifications([
      ...fresh,
      ...newlyUnlockedBacks.map((back) => ({
        icon: "🂠",
        title: `Новая рубашка: ${back.name}`,
        desc: back.rare ? "Редкая награда уже доступна в меню" : "Новая награда уже доступна в меню",
      })),
      ...newlyUnlockedEffects.map((effect) => ({ icon: "✦", title: `Новый эффект: ${effect.name}`, desc: effect.desc })),
    ]);
  }
  return fresh;
}
function nextTheme() {
  return THEME_DEFS.find((t) => t.stars > profile.totalStars) || null;
}
let winRevealTimers = [];
function clearWinRevealTimers() {
  winRevealTimers.forEach(clearTimeout);
  winRevealTimers = [];
}
function closeWinModal() {
  clearWinRevealTimers();
  modal.classList.remove("show", "perfect", "perfect-burst");
  modal.setAttribute("aria-hidden", "true");
}
function finishLevel() {
  state.rewarded = true;
  const stars = calculateStars();
  state.lastStars = stars;
  let newAchievements = [];
  if (state.mode !== "tutorial") {
    profile.stats.gamesPlayed = (profile.stats.gamesPlayed || 0) + 1;
    profile.stats.totalMoves = (profile.stats.totalMoves || 0) + (state.run.moves || 0);
  }
  if (state.mode === "regular") {
    const old = profile.starsByLevel[state.level] || 0,
      firstClear = old === 0;
    profile.starsByLevel[state.level] = Math.max(old, stars);
    profile.currentLevel = Math.max(profile.currentLevel, state.level + 1);
    if (firstClear) profile.stats.levelsCompleted++;
    if (stars === 3 && old < 3) profile.stats.tripleStarWins++;
    if (firstClear && state.special) profile.stats.specialCompleted = (profile.stats.specialCompleted || 0) + 1;
    if (state.run.hints === 0) profile.stats.noHintWins++;
    if (state.run.undos === 0) profile.stats.noUndoWins++;
    track("level_completed", { level: state.level, stars, moves: state.run.moves });
  } else if (state.mode === "daily") {
    const date = todayKey();
    profile.dailyStars[date] = Math.max(profile.dailyStars[date] || 0, stars);
    if (!profile.daily.completedDates.includes(date)) profile.stats.dailyCompleted++;
    updateDailyStreak(date);
    track("daily_completed", { date, stars, moves: state.run.moves });
  } else if (state.mode === "challenge") {
    profile.stats.challengesCompleted = (profile.stats.challengesCompleted || 0) + 1;
    track("challenge_completed", { seed: state.seed, stars, moves: state.run.moves });
  } else if (state.mode === "calm") {
    profile.stats.calmCompleted = (profile.stats.calmCompleted || 0) + 1;
    track("calm_completed", { stars, moves: state.run.moves });
  } else if (state.mode === "marathon") {
    state.marathonSuccess = stars === 3;
    if (state.marathonSuccess) {
      profile.stats.bestMarathon = Math.max(profile.stats.bestMarathon || 0, state.marathonRound || 1);
    }
    track("marathon_round_completed", { round: state.marathonRound || 1, stars, moves: state.run.moves });
  } else if (state.mode === "tutorial") {
    track("tutorial_completed", { step: state.tutorialStep });
    if (state.tutorialStep === 3) profile.tutorialComplete = true;
  }

  recomputeStars();
  const record = typeof updatePersonalRecord === "function" ? updatePersonalRecord(stars, state) : null;
  if (typeof updateWeeklyChallenge === "function") updateWeeklyChallenge();
  newAchievements = checkAchievements();
  save();
  showWin(stars, newAchievements, record);
  resetCombo();
}
function showWin(stars, newAchievements = [], record = null) {
  clearWinRevealTimers();
  const noHints = state.run.hints === 0,
    noUndos = state.run.undos === 0,
    perfect = stars === 3,
    moves = state.run.moves || 0;

  const titles = {
    daily: "Daily пройден!",
    challenge: "Вызов пройден!",
    calm: "Спокойный расклад завершён",
    marathon: state.marathonSuccess ? `Марафон · раунд ${state.marathonRound}` : "Марафон окончен",
  };
  $("#winTitle").textContent =
    state.mode === "tutorial" ? `Обучение ${state.tutorialStep}/3` : titles[state.mode] || `Уровень ${state.level} пройден`;

  $("#winText").textContent =
    state.mode === "daily"
      ? `Серия: ${profile.daily.currentStreak} дн.`
      : state.mode === "challenge"
        ? perfect ? "Идеальный ответ на вызов!" : "Расклад решён. Можно улучшить результат."
        : state.mode === "calm"
          ? "Без спешки. Просто хороший расклад."
          : state.mode === "marathon"
            ? state.marathonSuccess ? `Серия продолжается: ${state.marathonRound} ★★★ подряд` : `Результат серии: ${Math.max(0, (state.marathonRound || 1) - 1)} идеальных раскладов`
            : state.mode === "tutorial"
              ? state.tutorialStep < 3
                ? "Отлично. Переходим к следующей механике."
                : "Обучение закончено. Теперь начинается настоящая игра."
              : perfect
                ? "Идеальное прохождение!"
                : state.special
                  ? state.special.title
                  : "Расклад завершён";

  const rewards = [
    { earned: true, label: "За уровень" },
    { earned: noHints, label: "Без подсказок" },
    { earned: noUndos, label: "Без отмен" },
  ];
  $("#winStars").innerHTML = rewards
    .map(
      (reward, i) =>
        `<div class="win-star-item ${reward.earned ? "earned" : "missed"}" data-win-star="${i}"><span class="win-star-symbol">★</span><span class="win-star-label">${reward.label}</span></div>`,
    )
    .join("");

  const recordEl = $("#winRecord");
  if (recordEl) {
    const recordText = record?.isNew
      ? `↯ ${moves} ходов · Новый личный рекорд!`
      : record?.best
        ? `↯ ${moves} ходов · Лучший: ${record.best}`
        : `↯ ${moves} ходов`;
    recordEl.textContent = recordText;
    recordEl.classList.toggle("new-record", !!record?.isNew);
  }

  const shareBtn = $("#winShare");
  if (shareBtn) {
    shareBtn.hidden = state.mode === "tutorial";
    shareBtn.textContent = state.mode === "challenge" ? "⇄ Поделиться вызовом" : "⇄ Поделиться результатом";
  }

  const nt = nextTheme();
  $("#winUnlock").textContent =
    state.mode === "calm"
      ? "Спокойный режим не расходует и не требует наград"
      : state.mode === "marathon"
        ? `Лучший марафон: ${profile.stats.bestMarathon || 0}`
        : state.mode === "challenge"
          ? "Результат сохранён для этого кода"
          : nt
            ? `До темы ${nt.name}: ${nt.stars - profile.totalStars} ★`
            : "Все темы за звёзды открыты";
  $("#next").textContent =
    state.mode === "tutorial"
      ? state.tutorialStep < 3
        ? "Дальше →"
        : "Начать игру →"
      : state.mode === "daily"
        ? "Новый уровень →"
        : state.mode === "calm"
          ? "Ещё расклад →"
          : state.mode === "challenge"
            ? "Новый вызов →"
            : state.mode === "marathon"
              ? state.marathonSuccess ? "Продолжить марафон →" : "Новый марафон →"
              : "Следующий уровень →";

  modal.classList.remove("show", "perfect", "perfect-burst");
  if (perfect) modal.classList.add("perfect");
  modal.setAttribute("aria-hidden", "false");
  void modal.offsetWidth;
  modal.classList.add("show");

  playSfx("win", perfect ? 0.9 : 0.72, 0.08);
  haptic(perfect ? [14, 24, 20] : [12, 22, 14]);
  burst(false);

  rewards.forEach((reward, i) => {
    const timer = setTimeout(() => {
      const item = $(`[data-win-star="${i}"]`);
      if (!item || !modal.classList.contains("show")) return;
      item.classList.add("revealed");
      if (reward.earned) {
        playSfx("star", 0.8 + i * 0.08);
        haptic(i === 2 && perfect ? [10, 20, 16] : 9);
      }
      if (i === 2 && perfect) {
        modal.classList.add("perfect-burst");
        burst(true);
        setTimeout(() => modal.classList.remove("perfect-burst"), 720);
      }
    }, 420 + i * 430);
    winRevealTimers.push(timer);
  });
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
