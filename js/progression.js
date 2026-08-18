/* Level rewards, achievements, win screen and tutorial coach. */

function comboXpBonusInfo(s = state) {
  const combo = Math.max(0, +(s?.run?.maxCombo || 0));
  if (combo >= 20) return { combo, multiplier: 1.30, percent: 30 };
  if (combo >= 10) return { combo, multiplier: 1.10, percent: 10 };
  return { combo, multiplier: 1, percent: 0 };
}
function awardLevelXpWithCombo(baseXp, reason) {
  baseXp = Math.max(0, Math.round(+baseXp || 0));
  const bonus = comboXpBonusInfo(state), total = Math.round(baseXp * bonus.multiplier);
  if (state?.run) {
    state.run.xpBaseEarned = (state.run.xpBaseEarned || 0) + baseXp;
    state.run.comboXpBonus = Math.max(0, total - baseXp);
    state.run.comboXpPercent = bonus.percent;
    state.run.comboXpCombo = bonus.combo;
  }
  return awardXp(total, reason, { notifyRank: false });
}

let specialIntroStartCallback = null;
function specialLevelInfoLines(special) {
  if (!special) return { desc: "", rule: "", quote: "" };
  const desc = String(special.desc || "").trim();
  let rule = "";
  if (!special.boss) {
    if (special.noHints && special.maxRecycles === 1) rule = "Подсказки отключены, а колоду можно вернуть только 1 раз.";
    else if (special.noHints) rule = "Подсказки отключены — полагайся только на ассоциации.";
    else if (Number.isFinite(special.maxUndos)) rule = `Можно отменить ${special.maxUndos} ${ruPlural(special.maxUndos, "ход", "хода", "ходов")}.`;
    else if (Number.isFinite(special.maxRecycles)) rule = `Колоду можно вернуть только ${special.maxRecycles} ${ruPlural(special.maxRecycles, "раз", "раза", "раз")}.`;
    else if (special.lockedSlot) rule = "Последний слот откроется после 1 собранной категории.";
    else if (special.mysteryCategories) rule = "Названия категорий будут открываться по ходу решения.";
    else if (special.bigMix) rule = "Категорий и карточек здесь больше, чем в обычном уровне.";
  }
  return { desc, rule, quote: special.bossTaunt ? `«${special.bossTaunt}»` : "" };
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
  const iconEl = $("#specialLevelIcon");
  if (iconEl) {
    const companion = special.bossCompanionId ? companionDef(special.bossCompanionId) : null;
    iconEl.innerHTML = companion ? `<img src="${companionAsset(companion)}" alt="${escapeHtml(companion.name)}">` : `<span>${escapeHtml(special.icon || "✦")}</span>`;
  }
  $("#specialLevelEyebrow").textContent = special.boss ? "ФИНАЛ ГЛАВЫ" : "ОСОБЫЙ УРОВЕНЬ";
  $("#specialLevelTitle").textContent = special.title || "Испытание";
  const lines = specialLevelInfoLines(special);
  const descEl=$("#specialLevelDesc"), quoteEl=$("#specialLevelQuote"), ruleEl=$("#specialLevelRule");
  descEl.textContent = lines.desc || "Особый расклад — правило видно до старта.";
  if (quoteEl) { quoteEl.textContent = lines.quote || ""; quoteEl.hidden = !lines.quote; }
  ruleEl.textContent = lines.rule || "";
  ruleEl.hidden = !lines.rule;
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
    syncAchievementCompanions?.({ notify: true });
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
  const starProgress = Math.max(profile.totalStars || 0, profile.cosmeticStarsPeak || 0);
  return THEME_DEFS.find((t) => t.stars > starProgress) || null;
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
  state.run.xpBaseEarned = 0;
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
    if (typeof awardXp === "function") { const baseXp=55+stars*10; state.run.xpBaseEarned=(state.run.xpBaseEarned||0)+baseXp; awardXp(baseXp, "Дуэль", { notifyRank: false }); }
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
  } else if (state.mode === "hardcore") {
    profile.stats.specialCompleted=(profile.stats.specialCompleted||0)+1;
    profile.stats.bestHardcore=Math.max(profile.stats.bestHardcore||0,Math.max(1,+state.level||1));
    track("hardcore_completed",{round:Math.max(1,+state.level||1),moves:state.run.moves,maxCombo:state.run.maxCombo||0,riskDeal:!!state.riskDeal});
    if(typeof awardXp==="function") awardLevelXpWithCombo(65+Math.min(60,Math.max(1,+state.level||1)*5)+stars*10,"Хардкор!");
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
  if (state.mode === "regular" && state.special?.bossCompanionId && firstRegularClear) unlockCompanion?.(state.special.bossCompanionId, { notify: true, select: false });
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

  const cleanPraise = ["Идеальное прохождение!", "Безупречно!", "Ни единой ошибки!", "Вот это точность!", "Чистая победа!", "Сыграно идеально!", "Просто блеск!", "Ты разнёс этот уровень!"];
  const titles = {
    daily: "Ежедневный расклад пройден!",
    challenge: "Дуэль завершена!",
    collection: `Коллекция «${associationCollectionById(state.collectionId).name}» собрана!`,
    calm: "Дзен завершён",
    marathon: state.marathonSuccess ? `Марафон · раунд ${state.marathonRound}` : "Марафон окончен",
    hardcore: `Хардкор · раунд ${Math.max(1,+state.level||1)} пройден!`,
    time: "Готово вовремя!", moves: "Лимит ходов соблюдён!", combo: "Комбо собрано!", noMistakes: cleanPraise[Math.floor(Math.random()*cleanPraise.length)], onePass: "Колода пройдена за один круг!", custom: "Твои правила выполнены!",
  };
  $("#winTitle").textContent =
    state.failed ? "Почти! Попробуй ещё раз" : state.mode === "tutorial" ? `Обучение ${state.tutorialStep}/3` : (perfect && state.mode === "regular" ? cleanPraise[Math.floor(Math.random()*cleanPraise.length)] : (titles[state.mode] || `Уровень ${state.level} пройден`));

  const companion = typeof ensureCompanionSelection === "function" ? ensureCompanionSelection(profile) : (typeof companionDef === "function" ? companionDef(profile?.settings?.companion) : null);
  const companionImage = $("#winCompanionImage"), companionText = $("#winCompanionText");
  const companionWrap = $("#winCompanion");
  if (companion && companionImage && companionText) {
    companionImage.src = companionAsset(companion); companionImage.alt = companion.name;
    companionText.textContent = state.failed
      ? (companion.id === "cat" ? "Не беда — распутаем этот клубок со следующей попытки." : "Ошибки — тоже данные. Следующая попытка уже будет точнее.")
      : companionWinLine(companion.id, perfect);
    if (companionWrap) companionWrap.hidden = false;
  } else if (companionWrap) companionWrap.hidden = true;

  const winTextEl = $("#winText");
  const winTextValue =
    state.failed ? `${state.failureReason || "Условие режима не выполнено"}. Новый расклад уже ждёт!` :
    state.mode === "daily"
      ? `Серия: ${ruCount(profile.daily.currentStreak, "день", "дня", "дней")}`
      : state.mode === "challenge"
        ? perfect ? "Идеальная дуэль!" : "Расклад решён. Можно улучшить результат."
        : state.mode === "collection"
          ? (() => { const p = associationCollectionProgress(state.collectionId); return `Освоено ассоциаций: ${p.completed}/${p.total}`; })()
          : state.mode === "marathon"
            ? state.marathonSuccess ? `Серия продолжается: ${state.marathonRound} ★★★ подряд` : `Результат серии: ${ruCount(Math.max(0, (state.marathonRound || 1) - 1), "идеальный расклад", "идеальных расклада", "идеальных раскладов")}`
            : state.mode === "tutorial"
              ? state.tutorialStep < 3 ? "Переходим к следующей механике." : "Обучение закончено. Теперь начинается настоящая игра."
              : "";
  if (winTextEl) {
    winTextEl.textContent = winTextValue;
    winTextEl.hidden = !winTextValue;
  }

  const rewards = [
    { earned: stars > 0, label: "Уровень" },
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
    const metricModes = ["time","moves","combo","onePass","custom","challenge","marathon"];
    const metric = metricModes.includes(state.mode) && typeof ruleMetricText === "function" ? ruleMetricText(state) : "";
    const recordText = metric ? `${metric}${record?.isNew?" · рекорд":""}` : "";
    recordEl.textContent = recordText;
    recordEl.hidden = !recordText;
    recordEl.classList.toggle("new-record", !!record?.isNew);
  }

  const xpEl = $("#winXp");
  const totalXp = Math.max(0, +(state.run?.xpEarned || 0));
  const baseXp = Math.max(0, Math.min(totalXp, +(state.run?.xpBaseEarned || totalXp)));
  const bonusXp = Math.max(0, totalXp - baseXp);
  if (xpEl) xpEl.innerHTML = `<b data-win-xp-counter>+${baseXp} XP</b><span class="win-xp-seq" id="winXpSeq"></span>`;
  const goalsEl = $("#winGoals");
  if (goalsEl && typeof nearGoalsMarkup === "function") goalsEl.innerHTML = nearGoalsMarkup(2);

  const shareBtn = $("#winShare");
  if (shareBtn) {
    shareBtn.hidden = state.mode === "tutorial";
    shareBtn.textContent = state.mode === "challenge" ? "⚔ Поделиться дуэлью" : "↗ Поделиться";
  }

  const unlockEl = $("#winUnlock");
  const unlockText =
    state.mode === "regular" && state.special
      ? `Усложнение пройдено: ${state.special.desc}`
      : state.mode === "calm"
        ? "Дзен не влияет на кампанию и звёзды"
        : state.mode === "marathon"
          ? `Лучший марафон: ${profile.stats.bestMarathon || 0}`
          : state.mode === "hardcore"
            ? `Рекорд хардкора: ${profile.stats.bestHardcore || 0}`
            : state.mode === "challenge"
              ? state.challengeRole === "guest" ? "Результат отправляется сопернику" : state.challengeRole === "creator" ? "Твой результат сохранён. Ждём соперника." : "Результат сохранён для этой дуэли"
              : "";
  if (unlockEl) { unlockEl.textContent = unlockText; unlockEl.hidden = true; }
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
            : ["time","moves","combo","noMistakes","onePass","hardcore","custom"].includes(state.mode)
              ? "Следующий уровень →"
            : state.mode === "marathon"
              ? state.marathonSuccess ? "Продолжить марафон →" : "Новый марафон →"
              : "Следующий уровень →";

  const winIcon = modal.querySelector(".win-icon");
  if (winIcon) winIcon.textContent = state.mode === "challenge" ? "⚔" : state.mode === "daily" ? "☀" : perfect ? "🏆" : "★";
  modal.classList.remove("perfect", "perfect-burst");
  if (perfect) modal.classList.add("perfect");
  modal.setAttribute("aria-hidden", "false");
  modal.classList.add("show");

  if (!state.failed) {
    const timer = setTimeout(() => {
      if (!modal.classList.contains("show")) return;
      const popup = $("#xpBonusBurst"), counter = $("[data-win-xp-counter]"), seq = $("#winXpSeq");
      const bonuses = [];
      const comboBonus = Math.max(0, state.run?.comboXpBonus || 0);
      const objectiveBonus = bonusDone ? 35 : 0;
      const birthdayActive = typeof birthdayWeekInfo === "function" ? birthdayWeekInfo(profile).active : false;
      const birthdayBonus = birthdayActive ? Math.max(1, Math.round((baseXp + comboBonus) * 0.15)) + (objectiveBonus ? Math.max(1, Math.round(objectiveBonus * 0.15)) : 0) : 0;
      if (comboBonus > 0) bonuses.push({ amount: comboBonus, label: `за комбо ×${state.run.comboXpCombo || 0}` });
      if (objectiveBonus > 0) bonuses.push({ amount: objectiveBonus, label: `за бонус «${state.bonusObjective?.title || "цель"}»` });
      if (birthdayBonus > 0) bonuses.push({ amount: birthdayBonus, label: "за праздничную неделю" });
      let current = baseXp;
      const animateCounter = (from, to, duration = 420) => {
        const started = performance.now();
        const tick = (now) => {
          const p = Math.min(1, (now - started) / duration), eased = 1 - Math.pow(1-p, 3);
          counter.textContent = `+${Math.round(from + (to - from) * eased)} XP`;
          if (p < 1 && modal.classList.contains("show")) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      };
      bonuses.filter((bonus) => bonus.amount > 0).forEach((bonus, index) => {
        const innerTimer = setTimeout(() => {
          if (!modal.classList.contains("show")) return;
          if (seq) { seq.textContent = `+${bonus.amount} XP ${bonus.label}`; seq.classList.remove("show"); void seq.offsetWidth; seq.classList.add("show"); }
          if (popup) {
            popup.querySelector("b").textContent = `+${bonus.amount} XP`;
            popup.querySelector("span").textContent = bonus.label;
            popup.classList.remove("show"); void popup.offsetWidth; popup.classList.add("show");
            setTimeout(() => popup.classList.remove("show"), 1500);
          }
          animateCounter(current, current + bonus.amount);
          current += bonus.amount;
          playSfx?.("combo", .8); haptic?.([10,18,12]);
        }, index * 740);
        winRevealTimers.push(innerTimer);
      });
    }, 850);
    winRevealTimers.push(timer);
  }

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
