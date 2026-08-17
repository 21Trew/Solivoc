/* Level rewards, achievements, win screen and tutorial coach. */

function comboXpBonusInfo(s = state) {
  const combo = Math.max(0, +(s?.run?.maxCombo || 0));
  if (combo >= 20) return { combo, multiplier: 1.30, percent: 30 };
  if (combo >= 10) return { combo, multiplier: 1.10, percent: 10 };
  return { combo, multiplier: 1, percent: 0 };
}
function awardLevelXpWithCombo(baseXp, reason) {
  const bonus = comboXpBonusInfo(state), total = Math.round(baseXp * bonus.multiplier);
  if (state?.run) {
    state.run.comboXpBonus = Math.max(0, total - Math.round(baseXp));
    state.run.comboXpPercent = bonus.percent;
    state.run.comboXpCombo = bonus.combo;
  }
  return awardXp(total, reason, { notifyRank: false });
}

let specialIntroStartCallback = null;
function specialLevelRuleText(special) {
  if (!special) return "";
  if (special.noHints && special.maxRecycles === 1) return "Подсказки отключены · колоду можно вернуть только один раз";
  if (special.noHints) return "Подсказки отключены на весь уровень";
  if (Number.isFinite(special.maxUndos)) return `${ruPlural(special.maxUndos, "Доступна", "Доступны", "Доступно")} ${ruCount(special.maxUndos, "отмена", "отмены", "отмен")}`;
  if (Number.isFinite(special.maxRecycles)) return `Колоду можно вернуть ${ruCount(special.maxRecycles, "раз", "раза", "раз")}`;
  if (special.lockedSlot) return "Один слот откроется только после первой собранной категории";
  if (special.mysteryCategories) return "Названия категорий будут открываться по ходу решения";
  if (special.bigMix) return "Больше категорий и слов, чем в обычном раскладе";
  return special.desc || "Особое правило действует до конца уровня";
}
function closeSpecialLevelIntro({ start = false } = {}) {
  const modal = $("#specialLevelModal");
  if (!modal) return;
  modal.classList.remove("show");
  modal.setAttribute("aria-hidden", "true");
  const callback = specialIntroStartCallback;
  specialIntroStartCallback = null;
  if (start && callback) callback();
}
function showSpecialLevelIntro(special, onStart) {
  const modal = $("#specialLevelModal");
  if (!modal || !special) { onStart?.(); return; }
  specialIntroStartCallback = typeof onStart === "function" ? onStart : null;
  $("#specialLevelIcon").textContent = special.icon || "◆";
  $("#specialLevelEyebrow").textContent = special.boss ? "ФИНАЛ ГЛАВЫ" : "ОСОБЫЙ УРОВЕНЬ";
  $("#specialLevelTitle").textContent = special.title || "Испытание";
  $("#specialLevelDesc").textContent = special.desc || "В этом раскладе действует особое правило.";
  $("#specialLevelRule").textContent = specialLevelRuleText(special);
  $("#specialLevelStart").textContent = special.boss ? "Начать финал →" : "Начать испытание →";
  $("#specialLevelStart").onclick = () => closeSpecialLevelIntro({ start: true });
  modal.classList.add("show");
  modal.setAttribute("aria-hidden", "false");
  playSfx?.("combo", 0.45);
  haptic?.(8);
}
function specialWinPraise(special, perfect = false) {
  if (!special) return "";
  if (special.boss) return perfect ? "Вот это финал! Глава закрыта на ★★★ — великолепная партия!" : "Глава пройдена! Финал позади — можно двигаться дальше ✨";
  return perfect ? `Испытание «${special.title}» пройдено идеально — отличная работа!` : `Испытание «${special.title}» пройдено. Сильная партия!`;
}

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
  setBackgroundMusic?.(musicModeForState?.() || "game");
}
function finishLevel() {
  const rewardable = !!state && state.totalCategories > 0 && state.completed === state.totalCategories && (state.run?.moves || 0) > 0 && (state.mode === "tutorial" || isPlayableGeneratedState(state));
  if (!rewardable) {
    console.error("invalid completion blocked", { mode: state?.mode, seed: state?.seed, completed: state?.completed, totalCategories: state?.totalCategories, moves: state?.run?.moves });
    track?.("invalid_completion_blocked", { mode: state?.mode || "unknown", completed: state?.completed || 0, totalCategories: state?.totalCategories || 0, moves: state?.run?.moves || 0 });
    return false;
  }
  const ruleFailure = typeof activeRuleFailureReason === "function" ? activeRuleFailureReason(state, { completion: true }) : "";
  if (ruleFailure) return finishFailedRun(ruleFailure);
  state.rewarded = true;
  const stars = calculateStars();
  state.lastStars = stars;
  let newAchievements = [], firstRegularClear = false, firstDailyClear = false;
  state.run.xpEarned = 0;
  if (state.mode !== "tutorial") {
    profile.stats.gamesPlayed = (profile.stats.gamesPlayed || 0) + 1;
    profile.stats.totalMoves = (profile.stats.totalMoves || 0) + (state.run.moves || 0);
    recordDailyModeGame?.(state);
  }
  if (state.mode === "regular") {
    const old = profile.starsByLevel[state.level] || 0,
      firstClear = old === 0;
    firstRegularClear = firstClear;
    profile.starsByLevel[state.level] = Math.max(old, stars);
    profile.currentLevel = Math.max(profile.currentLevel, state.level + 1);
    if (firstClear) profile.stats.levelsCompleted++;
    if (stars === 3 && old < 3) profile.stats.tripleStarWins++;
    if (firstClear && state.special) profile.stats.specialCompleted = (profile.stats.specialCompleted || 0) + 1;
    if (state.run.hints === 0) profile.stats.noHintWins++;
    if (state.run.undos === 0) profile.stats.noUndoWins++;
    track("level_completed", { level: state.level, stars, moves: state.run.moves });
    if (firstClear && state.level === 1) track("funnel_level_1_complete");
    if (firstClear && state.level === 2) track("funnel_level_2_complete");
    if (firstClear && state.level === 5) track("funnel_level_5_complete");
    if (typeof awardXp === "function") {
      const baseXp = (firstClear ? 45 : 18) + stars * (firstClear ? 10 : 6);
      awardLevelXpWithCombo(baseXp, firstClear ? `Уровень ${state.level}` : "Повтор уровня");
    }
  } else if (state.mode === "daily") {
    const date = todayKey();
    firstDailyClear = !profile.daily.completedDates.includes(date);
    profile.dailyStars[date] = Math.max(profile.dailyStars[date] || 0, stars);
    if (firstDailyClear) profile.stats.dailyCompleted++;
    updateDailyStreak(date);
    track("daily_completed", { date, stars, moves: state.run.moves });
    if (typeof awardXp === "function") awardLevelXpWithCombo((firstDailyClear ? 70 : 25) + stars * 10, firstDailyClear ? "Ежедневный" : "Повтор ежедневного");
  } else if (state.mode === "challenge") {
    profile.stats.challengesCompleted = (profile.stats.challengesCompleted || 0) + 1;
    if (state.challengeRole === "creator") recordCreatorChallengeResult(state, stars);
    else if (state.challengeRole === "guest") enqueueGuestChallengeSubmission(state, stars);
    track("challenge_completed", { seed: state.seed, stars, moves: state.run.moves, duelMode: state.duelMode || "classic", role: state.challengeRole || "legacy" });
    if (typeof awardXp === "function") awardXp(55 + stars * 10, "Дуэль", { notifyRank: false });
  } else if (state.mode === "collection") {
    const collection = associationCollectionById(state.collectionId);
    profile.associationCollections ||= {};
    const progress = profile.associationCollections[collection.id] ||= { plays: 0, wins: 0, completedCategories: [] };
    progress.plays = (+progress.plays || 0) + 1;
    progress.wins = (+progress.wins || 0) + 1;
    progress.completedCategories = [...new Set([...(progress.completedCategories || []), ...(state.categoryIds || [])])];
    profile.stats.collectionGamesCompleted = (profile.stats.collectionGamesCompleted || 0) + 1;
    track("collection_completed", { collectionId: collection.id, categories: state.categoryIds?.length || 0, stars, moves: state.run.moves });
    if (typeof awardXp === "function") awardLevelXpWithCombo(40 + stars * 8, `Картинки: ${collection.name}`);
  } else if (state.mode === "calm") {
    profile.stats.calmCompleted = (profile.stats.calmCompleted || 0) + 1;
    track("calm_completed", { stars, moves: state.run.moves });
    if (typeof awardXp === "function") awardLevelXpWithCombo(20 + stars * 5, "Дзен");
  } else if (state.mode === "marathon") {
    state.marathonSuccess = stars === 3;
    if (state.marathonSuccess) {
      profile.stats.bestMarathon = Math.max(profile.stats.bestMarathon || 0, state.marathonRound || 1);
      const nextRound=(state.marathonRound||1)+1, runId=state.marathonId||`marathon:${Date.now().toString(36)}`;
      profile.activeMarathon={level:nextRound,seed:`${runId}:${nextRound}`,marathonRound:nextRound,marathonId:runId,cardSourceMode:state.cardSourceMode};
    } else profile.activeMarathon=null;
    track("marathon_round_completed", { round: state.marathonRound || 1, stars, moves: state.run.moves });
    if (typeof awardXp === "function") awardLevelXpWithCombo(30 + stars * 8, "Марафон");
  } else if (["time","moves","combo","noMistakes","onePass","custom"].includes(state.mode)) {
    profile.stats.specialCompleted=(profile.stats.specialCompleted||0)+1;
    track("rule_mode_completed",{mode:state.mode,moves:state.run.moves,maxCombo:state.run.maxCombo||0,durationMs:activeRunElapsedMs?.(state)||0});
    const modeLabel=(GAME_MODE_DEFS.find((x)=>x.id===state.mode)?.label||"Особый режим");
    if(typeof awardXp==="function")awardLevelXpWithCombo(35+stars*7,modeLabel);
  } else if (state.mode === "tutorial") {
    track("tutorial_completed", { step: state.tutorialStep });
    if (state.tutorialStep === 3) { profile.tutorialComplete = true; track("tutorial_all_complete"); }
  }

  recordChallengeEligibleProgress?.(state, stars);
  if (state.mode === "regular") updateAdaptiveDifficulty?.(state, stars);
  recomputeStars();
  if (typeof rewardChapterFinal === "function") rewardChapterFinal(state, firstRegularClear);
  if (state.mode === "daily" && firstDailyClear && typeof awardDailyWeekMilestones === "function") awardDailyWeekMilestones();
  const bonusDone = typeof awardBonusObjective === "function" ? awardBonusObjective(state) : false;
  const record = typeof updatePersonalRecord === "function" ? updatePersonalRecord(stars, state) : null;
  if (typeof updateWeeklyChallenge === "function") updateWeeklyChallenge();
  if (typeof updateMonthlyChallenge === "function") updateMonthlyChallenge();
  newAchievements = checkAchievements();
  flushProfileSave?.({ skipCloud: true });
  save();
  scheduleAccountSync?.(1800);
  if (typeof syncPushState === "function") syncPushState();
  syncLeaderboardNonBlocking?.();
  showWin(stars, newAchievements, record, bonusDone);
  resetCombo();
}
function finishFailedRun(reason="Ошибка") {
  if(!state||state.rewarded)return; state.rewarded=true; state.failed=true; state.failureReason=String(reason||"Условие не выполнено"); state.lastStars=0; state.run.xpEarned=0;
  if(state.mode!=="tutorial"){profile.stats.gamesPlayed=(profile.stats.gamesPlayed||0)+1;profile.stats.totalMoves=(profile.stats.totalMoves||0)+(state.run.moves||0);recordDailyModeGame?.(state);}
  if(state.mode==="challenge"){profile.stats.challengesCompleted=(profile.stats.challengesCompleted||0)+1;if(state.challengeRole==="creator")recordCreatorChallengeResult(state,0);else if(state.challengeRole==="guest")enqueueGuestChallengeSubmission(state,0);}
  if(state.mode==="marathon")profile.activeMarathon=null;
  track("run_failed",{mode:state.mode,reason,moves:state.run.moves||0}); checkAchievements(); flushProfileSave?.({ skipCloud: true }); save(); scheduleAccountSync?.(1800); showWin(0,[],null,false); resetCombo();
}

function showWin(stars, newAchievements = [], record = null, bonusDone = false) {
  const winKey = `${state?.seed || ""}:${state?.mode || ""}:${state?.level || 0}:${state?.run?.moves || 0}`;
  if (modal?.classList.contains("show") && modal.dataset.winKey === winKey) return;
  if (modal) modal.dataset.winKey = winKey;
  clearWinRevealTimers();
  const noHints = state.run.hints === 0,
    noUndos = state.run.undos === 0,
    perfect = stars === 3,
    moves = state.run.moves || 0;

  const titles = {
    daily: "Ежедневный расклад пройден!",
    challenge: "Дуэль завершена!",
    collection: `Коллекция «${associationCollectionById(state.collectionId).name}» собрана!`,
    calm: "Дзен завершён",
    marathon: state.marathonSuccess ? `Марафон · раунд ${state.marathonRound}` : "Марафон окончен",
    time: "Готово вовремя!", moves: "Лимит ходов соблюдён!", combo: "Комбо собрано!", noMistakes: "Без ошибки — отлично!", onePass: "Колода пройдена за один круг!", custom: "Твои правила выполнены!",
  };
  $("#winTitle").textContent =
    state.failed ? "Почти! Попробуй ещё раз" : state.mode === "tutorial" ? `Обучение ${state.tutorialStep}/3` : titles[state.mode] || `Уровень ${state.level} пройден`;

  $("#winText").textContent =
    state.failed ? `${state.failureReason || "Условие режима не выполнено"}. Новый расклад уже ждёт!` :
    state.mode === "regular" && state.special
      ? specialWinPraise(state.special, perfect)
      : state.mode === "daily"
      ? `Серия: ${ruCount(profile.daily.currentStreak, "день", "дня", "дней")}`
      : state.mode === "challenge"
        ? perfect ? "Идеальная дуэль!" : "Расклад решён. Можно улучшить результат."
        : state.mode === "collection"
          ? (() => { const p = associationCollectionProgress(state.collectionId); return `Освоено ассоциаций: ${p.completed}/${p.total}`; })()
        : state.mode === "calm"
          ? "Без спешки. Просто хороший расклад."
          : state.mode === "marathon"
            ? state.marathonSuccess ? `Серия продолжается: ${state.marathonRound} ★★★ подряд` : `Результат серии: ${ruCount(Math.max(0, (state.marathonRound || 1) - 1), "идеальный расклад", "идеальных расклада", "идеальных раскладов")}`
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
    { earned: stars > 0, label: "За уровень" },
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
    const metric = typeof ruleMetricText === "function" ? ruleMetricText(state) : "";
    const recordText = metric ? `${metric}${record?.isNew?" · Новый личный рекорд!":""}` : record?.isNew
      ? `↯ ${ruCount(moves, "ход", "хода", "ходов")} · Новый личный рекорд!`
      : record?.best
        ? `↯ ${ruCount(moves, "ход", "хода", "ходов")} · Лучший: ${record.best}`
        : `↯ ${ruCount(moves, "ход", "хода", "ходов")}`;
    recordEl.textContent = recordText;
    recordEl.classList.toggle("new-record", !!record?.isNew);
  }

  const xpEl = $("#winXp");
  if (xpEl) {
    const comboBonus = state.run?.comboXpPercent ? ` · комбо ×${state.run.comboXpCombo}: +${state.run.comboXpPercent}%` : "";
    xpEl.innerHTML = `<b>+${state.run?.xpEarned || 0} XP</b><span>${comboBonus}${bonusDone ? ` · бонус «${state.bonusObjective?.title || "цель"}» ✓` : ""}</span>`;
  }
  const goalsEl = $("#winGoals");
  if (goalsEl && typeof nearGoalsMarkup === "function") goalsEl.innerHTML = nearGoalsMarkup(2);

  const shareBtn = $("#winShare");
  if (shareBtn) {
    shareBtn.hidden = state.mode === "tutorial";
    shareBtn.textContent = state.mode === "challenge" ? "⚔ Поделиться дуэлью" : "↗ Поделиться уровнем";
  }

  const nt = nextTheme();
  $("#winUnlock").textContent =
    state.mode === "regular" && state.special
      ? `Усложнение пройдено: ${state.special.desc}`
      : state.mode === "calm"
      ? "Дзен не влияет на кампанию и звёзды"
      : state.mode === "marathon"
        ? `Лучший марафон: ${profile.stats.bestMarathon || 0}`
        : state.mode === "challenge"
          ? state.challengeRole === "guest" ? "Результат отправляется сопернику" : state.challengeRole === "creator" ? "Твой результат сохранён. Ждём соперника." : "Результат сохранён для этой дуэли"
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
            ? "К дуэлям →"
            : ["time","moves","combo","noMistakes","onePass","custom"].includes(state.mode)
              ? "Ещё расклад →"
            : state.mode === "marathon"
              ? state.marathonSuccess ? "Продолжить марафон →" : "Новый марафон →"
              : "Следующий уровень →";

  const winIcon = modal.querySelector(".win-icon");
  if (winIcon) winIcon.textContent = state.mode === "challenge" ? "⚔" : state.mode === "daily" ? "☀" : perfect ? "🏆" : "★";
  modal.classList.remove("perfect", "perfect-burst");
  if (perfect) modal.classList.add("perfect");
  modal.setAttribute("aria-hidden", "false");
  modal.classList.add("show");

  playVictoryJingle?.(perfect);
  playSfx("win", perfect ? 0.9 : 0.72, 0.08);
  haptic(perfect ? [14, 24, 20] : [12, 22, 14]);
  // Keep the dialog itself still; celebration lives in the confetti layer.
  showVictoryCosmeticEffect?.();
  confettiRain?.(perfect);

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
        burst(true);
      }
    }, 760 + i * 460);
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
