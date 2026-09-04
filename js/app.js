/* UI event binding, hint/undo orchestration, PWA registration and application bootstrap. */
function syncGameCompanion() {
  const button = $("#gameCompanion"), image = $("#gameCompanionImage");
  if (!button) return;
  const def = typeof ensureCompanionSelection === "function" ? ensureCompanionSelection(profile) : companionDef(profile?.settings?.companion);
  button.hidden = !def;
  if (!def) return;
  if (image) { image.src = companionAsset(def); image.alt = def.name; }
  button.title = `${def.name} — нажми для интересного факта`;
  button.dataset.companion = def.id;
}
function showCompanionBubble(text, ms = 5200) {
  const host = $("#gameCompanion");
  if (!host || host.hidden) return;
  let bubble = document.querySelector(".companion-bubble-floating");
  if (!bubble) {
    bubble = document.createElement("div");
    bubble.className = "companion-bubble-floating";
    bubble.innerHTML = `<div class="companion-bubble-card"></div>`;
    document.body.appendChild(bubble);
  }
  const card = bubble.querySelector(".companion-bubble-card");
  if (!card) return;
  card.innerHTML = `<span>${escapeHtml(String(text || ""))}</span>`;
  bubble.hidden = false;
  bubble.style.left = `10px`;
  bubble.style.top = `10px`;
  requestAnimationFrame(() => {
    const rect = host.getBoundingClientRect();
    const bw = bubble.offsetWidth || 270, bh = bubble.offsetHeight || 70;
    const left = Math.min(Math.max(10, rect.right - bw), Math.max(10, window.innerWidth - bw - 10));
    const above = rect.top - bh - 10;
    const top = above >= 10 ? above : Math.min(window.innerHeight - bh - 10, rect.bottom + 10);
    bubble.style.left = `${left}px`;
    bubble.style.top = `${Math.max(10, top)}px`;
  });
  clearTimeout(showCompanionBubble.timer);
  showCompanionBubble.timer = setTimeout(() => { bubble.hidden = true; }, ms);
}
function clearMascotHintLine() {
  document.querySelectorAll(".mascot-hint-line,.mascot-hint-route").forEach((el) => el.remove());
  document.querySelectorAll(".hint-source,.hint-target").forEach((el) => el.classList.remove("hint-source","hint-target"));
  $("#gameCompanion")?.classList.remove("pointing");
}
function drawMascotHintLine(fromRect, toRect, className = "mascot-hint-line") {
  const x1=fromRect.left+fromRect.width*.5, y1=fromRect.top+fromRect.height*.5;
  const x2=toRect.left+toRect.width*.5, y2=toRect.top+toRect.height*.5;
  const dx=x2-x1, dy=y2-y1, len=Math.max(24,Math.hypot(dx,dy));
  const line=document.createElement("div");
  line.className=className;
  line.style.left=`${x1}px`; line.style.top=`${y1}px`; line.style.width=`${len}px`; line.style.transform=`rotate(${Math.atan2(dy,dx)*180/Math.PI}deg)`;
  document.body.appendChild(line);
}
function pointCompanionAt(target, text = "Смотри сюда!") {
  clearMascotHintLine();
  const mascot = $("#gameCompanion"); if (!mascot || mascot.hidden || !target) return;
  mascot.classList.add("pointing"); target.classList.add("hint-source"); showCompanionBubble(text, 2400);
  const a = mascot.getBoundingClientRect(), b = target.getBoundingClientRect();
  drawMascotHintLine({left:a.left,width:a.width*.4,top:a.top+a.height*.55,height:a.height*.34}, b);
  setTimeout(clearMascotHintLine, 2100);
}
function pointCompanionAtMove(source, target, text = "Вот этот ход.") {
  clearMascotHintLine();
  const mascot = $("#gameCompanion"); if (!mascot || mascot.hidden || !source || !target) return;
  mascot.classList.add("pointing");
  source.classList.add("hint-source"); target.classList.add("hint-target");
  showCompanionBubble(text, 2800);
  const a=mascot.getBoundingClientRect(), b=source.getBoundingClientRect(), c=target.getBoundingClientRect();
  drawMascotHintLine({left:a.left,width:a.width*.4,top:a.top+a.height*.55,height:a.height*.34}, b);
  drawMascotHintLine(b, c, "mascot-hint-route");
  setTimeout(clearMascotHintLine, 2500);
}
function hintMoveElements(hint) {
  if (!hint?.payload) return { source:null, target:null };
  const p=hint.payload;
  let source=null;
  if (p.source === "column") {
    source = document.querySelector(`.card[data-source="column"][data-col="${p.ci}"][data-group-index="${p.start}"]`)
      || document.querySelector(`.card[data-source="column"][data-col="${p.ci}"]`);
  } else if (p.source === "waste") source = document.querySelector(".waste .card.movable:last-of-type") || document.querySelector(".waste .card.movable");
  const target = document.querySelector(`[data-zone="${hint.zone}"][data-index="${hint.index}"]`);
  return { source, target };
}

function bindAppEvents() {
  let lastTouchEndAt = 0;
  document.addEventListener(
    "touchend",
    (e) => {
      if (!e.target.closest(".card,.stock,.waste,.slot,button,.game-profile-button,.hub-profile-button")) return;
      const now = Date.now();
      if (now - lastTouchEndAt < 360) e.preventDefault();
      lastTouchEndAt = now;
    },
    { passive: false },
  );
  document.addEventListener(
    "dblclick",
    (e) => {
      if (e.target.closest(".app,.modal,.hub")) e.preventDefault();
    },
    { passive: false },
  );
  document.addEventListener("pointerdown", startDrag);
  window.addEventListener("pointermove", moveDrag, { passive: false });
  window.addEventListener("pointerup", endDrag);

  $("#gameProfileButton")?.addEventListener("click", openProfileEditorModal);
  $("#menuButton").onclick = openHub;
  $("#gameCompanion")?.addEventListener("click", () => {
    const def = ensureCompanionSelection?.(profile) || companionDef(profile.settings.companion);
    if (!def) return;
    const fact = companionFact(def.id);
    saveProfile?.();
    showCompanionBubble(fact);
    track?.("companion_fact", { companion: def.id });
  });
  syncGameCompanion();

  $("#undo").onclick = () => {
    if (autoMoveBusy || categoryAnimating || !history.length) return;
    const limit = state.special?.maxUndos;
    if (Number.isFinite(limit) && state.run.undos >= limit) {
      feedbackWrongMove([$("#undo")], $("#undo"), `На этом уровне ${ruPlural(limit, "доступна", "доступны", "доступно")} только ${ruCount(limit, "отмена", "отмены", "отмен")}`);
      return;
    }
    const previous = history.pop(),
      undoCount = (state.run?.undos || 0) + 1,
      snapshot = restoreHistorySnapshot(previous);
    if (!snapshot) return;
    const result = SolivocGameController.dispatch({
      type: SolivocGameEngine.COMMAND.UNDO,
      snapshot,
      undoCount,
    });
    if (!result.accepted) {
      history.push(previous);
      return;
    }
    profile.stats.undos++;
    track("undo", { mode: state.mode });
    if (state.mode === "tutorial") noteTutorialAction?.("undo");
    resetCombo();
    playSfx("drop", 0.65);
    render();
    markStateChanged();
  };
  $("#restart").onclick = () => {
    if (autoMoveBusy || categoryAnimating) return;
    profile.stats.restarts++;
    scheduleProfileSave?.();
    noteAdaptiveRestart?.();
    track("level_restarted", { level: state.level, mode: state.mode });
    resetCombo();
    restartCurrentLevel();
  };

  $("#hint").onclick = () => {
    if (autoMoveBusy || categoryAnimating) return;
    if (state.special?.noHints || state.rules?.noHints) {
      feedbackWrongMove([$("#hint")], $("#hint"), "На этом уровне подсказки отключены");
      return;
    }
    const result = SolivocGameController.dispatch({ type: SolivocGameEngine.COMMAND.USE_HINT });
    if (!result.accepted) return;
    profile.stats.hints++;
    scheduleProfileSave?.();
    track("hint_used", { mode: state.mode });
    resetCombo();
    const hint = SolivocGameController.effect(result, "HINT_REQUESTED")?.hint || null;
    if (hint?.payload) {
      const p = hint.payload;
      const { source, target } = hintMoveElements(hint);
      if (!source || !target || !canDropTo(p, hint.zone, hint.index)) {
        // The board may have rerendered between finding the move and resolving its DOM nodes.
        // Do not point at a stale/random card: ask the player to draw instead if possible.
        if (state.stock.length) {
          stockEl.classList.add("hint-stock");
          pointCompanionAt(stockEl, `${companionHintLine?.() || "Есть зацепка."} Загляни в колоду.`);
          setTimeout(() => stockEl.classList.remove("hint-stock"), 1100);
          showToast("Открой следующую карту колоды");
        } else showDeadlock();
      } else {
        source.classList.add("hint");
        const targetText = hint.zone === "slot" ? "сюда, в категорию" : "сюда, на подходящую карту";
        pointCompanionAtMove(source, target, `${companionHintLine?.() || "Вижу хороший ход."} Перенеси эту карту ${targetText}.`);
        setTimeout(() => source?.classList.remove("hint"), 2400);
        const actionText = hint.zone === "slot" ? "в категорию" : "на связанную стопку";
        showToast(`Ход: ${groupLabel(p.groups[0])} → ${actionText}`);
      }
    } else if (hint?.action === "draw") {
      stockEl.classList.add("hint-stock");
      pointCompanionAt(stockEl, `${companionHintLine?.() || "Есть зацепка."} Загляни в колоду.`);
      setTimeout(() => stockEl.classList.remove("hint-stock"), 1100);
      showToast("Открой следующую карту колоды");
    } else if (hint?.action === "recycle") {
      stockEl.classList.add("hint-stock");
      pointCompanionAt(stockEl, `${companionHintLine?.() || "Есть зацепка."} Верни сброс в колоду.`);
      setTimeout(() => stockEl.classList.remove("hint-stock"), 1100);
      showToast("Верни сброс в колоду");
    } else {
      showDeadlock();
    }
    save();
  };

  $("#next").onclick = () => {
    closeWinModal();
    resetCombo();
    const action = () => {
      if (state.mode === "tutorial") {
        if (state.tutorialStep < 4) makeLevel(state.tutorialStep + 1, { mode: "tutorial", step: state.tutorialStep + 1 });
        else makeLevel(profile.currentLevel || 1);
      } else if (state.mode === "daily") makeLevel(profile.currentLevel || 1);
      else if (state.mode === "challenge") openHub("modes");
      else if (state.mode === "collection") makeLevel(1, { mode: "collection", collectionId: state.collectionId, seed: `collection:${state.collectionId}:${Date.now()}` });
      else if (state.mode === "calm") makeLevel(1, { mode: "calm", seed: `calm:${Date.now()}:${Math.random()}` });
      else if (state.mode === "hardcore") {
        const nextRound = Math.max(1, (+state.level || 1) + 1);
        makeLevel(nextRound, { mode: "hardcore", seed: `hardcore:${Date.now().toString(36)}:${nextRound}:${Math.random()}` });
      }
      else if (["time","moves","combo","noMistakes","onePass","custom"].includes(state.mode)) makeLevel(1, { mode: state.mode, seed: `${state.mode}:${Date.now()}:${Math.random()}`, customRules: state.customRules || null });
      else if (state.mode === "marathon") {
        const nextRound = state.marathonSuccess ? (state.marathonRound || 1) + 1 : 1;
        const runId = state.marathonSuccess ? state.marathonId : `marathon:${Date.now().toString(36)}`;
        makeLevel(nextRound, { mode: "marathon", seed: `${runId}:${nextRound}`, marathonRound: nextRound, marathonId: runId });
      } else makeLevel(state.level + 1);
    };
    if (typeof showRankUpThen === "function") showRankUpThen(action); else action();
  };
  $("#winRestart").onclick = () => {
    closeWinModal();
    resetCombo();
    const action = () => restartCurrentLevel();
    if (typeof showRankUpThen === "function") showRankUpThen(action); else action();
  };
  $("#winMenu").onclick = () => {
    closeWinModal();
    resetCombo();
    const action = () => openHub();
    if (typeof showRankUpThen === "function") showRankUpThen(action); else action();
  };
  $("#winShare").onclick = () => {
    if (state?.mode === "challenge" && state.challengeRole === "creator") {
      const entry = ownedChallengeByCode(state.challengeCode);
      if (entry) return shareChallengeEntry(entry);
    }
    return shareCurrentResult();
  };

  let viewportResizeTimer;
  window.addEventListener(
    "resize",
    () => {
      clearTimeout(viewportResizeTimer);
      viewportResizeTimer = setTimeout(() => {
        if (state && !drag && !autoMoveBusy && !categoryAnimating) render();
      }, 120);
    },
    { passive: true },
  );
}

function registerPwa() {
  return window.SolivocUpdateManager?.start?.();
}

let challengeSyncBusy = false, lifecycleHandlersBound = false;
function activelyPlayingRound() {
  return !!(state && !state.rewarded && !hub?.classList.contains("show"));
}
function syncChallengesNonBlocking({ force = false } = {}) {
  if (challengeSyncBusy || document.visibilityState !== "visible" || navigator.onLine === false) return Promise.resolve(false);
  // Do not poll Redis/Push in the middle of a solitaire round. Results are
  // refreshed in the hub, after a round and when the app becomes visible.
  if (!force && activelyPlayingRound()) return Promise.resolve(false);
  challengeSyncBusy = true;
  const run = async () => {
    try {
      await Promise.allSettled([
        Promise.resolve(flushPendingChallengeSubmissions?.()),
        Promise.resolve(refreshOwnedChallenges?.({ notify: true })),
        Promise.resolve(refreshReceivedChallenges?.()),
        Promise.resolve(syncPushState?.()),
      ]);
      return true;
    } finally {
      challengeSyncBusy = false;
    }
  };
  return new Promise((resolve) => {
    const invoke = () => run().then(resolve, () => resolve(false));
    if ("requestIdleCallback" in window) requestIdleCallback(invoke, { timeout: 1400 });
    else SolivocScheduler.timeout("sync.challenge-idle", invoke, 100);
  });
}
function startChallengeSyncLoop() {
  SolivocScheduler.interval("sync.challenges", () => syncChallengesNonBlocking(), 60000, { visibleOnly: true });
  SolivocScheduler.interval("ui.rule-metric", () => {
    if (!state) return;
    const el = $("#ruleMetric");
    if (!el || el.hidden || typeof ruleMetricText !== "function") return;
    el.textContent = ruleMetricText(state);
    if (typeof checkActiveRuleFailure === "function") checkActiveRuleFailure();
  }, 500, { visibleOnly: true });
  if (!lifecycleHandlersBound) {
    lifecycleHandlersBound = true;
    SolivocLifecycle.on("suspend", "game.round", ({ reason }) => {
      markStabilityStage?.("hidden", reason ? { reason } : undefined);
      cancelActiveDragForLifecycle?.();
      cancelAutoMoveForLifecycle?.();
      pauseActiveRun?.();
      compactTransientRuntimeForBackground?.();
      save?.({ immediate: true });
      SolivocScheduler.cancel("sync.challenge-resume");
    });
    SolivocLifecycle.on("resume", "game.round", ({ persisted = false } = {}) => {
      markStabilityStage?.("active", persisted ? { persisted: true } : undefined);
      resumeActiveRun?.();
      resumeAudioForLifecycle?.();
      scheduleAccountSync?.(1800);
      if (navigator.onLine !== false) {
        SolivocScheduler.timeout("sync.challenge-resume", () => syncChallengesNonBlocking(), 1200);
      }
    });
    SolivocLifecycle.on("terminate", "game.round", () => {
      markStabilityStage?.("closed", { beforeunload: true });
      save?.({ immediate: true });
    });
    SolivocLifecycle.on("error", "stability.fault", ({ message }) => markStabilityFault?.("error", message));
    SolivocLifecycle.on("unhandledrejection", "stability.fault", ({ reason }) => markStabilityFault?.("promise", reason?.message || reason));
  }
}

async function fetchServerBootstrap() {
  if (!/^https?:$/.test(location.protocol) || navigator.onLine === false) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 1800);
  try {
    const response = await apiFetch("/api/bootstrap", { cache: "no-store", signal: controller.signal });
    if (!response.ok) return null;
    const data = await response.json();
    if (data && typeof data === "object") window.SERVER_BOOTSTRAP = data;
    return data;
  } catch { return null; } finally { clearTimeout(timer); }
}
async function syncServerDataOnBoot() {
  if (navigator.onLine === false || !/^https?:$/.test(location.protocol)) return [];
  const tasks = [
    fetchServerBootstrap(),
    Promise.resolve(flushPendingChallengeSubmissions?.()),
    Promise.resolve(refreshOwnedChallenges?.({ notify: false })),
    Promise.resolve(refreshReceivedChallenges?.()),
    Promise.resolve(syncPushState?.()),
  ];
  const timeout = new Promise((resolve) => setTimeout(resolve, 1900));
  await Promise.race([Promise.allSettled(tasks), timeout]);
}

async function boot() {
  try {
    initStabilityRuntime?.();
    bindFeedbackEvents();
    bindAppEvents();
    bindRetentionUi?.();
    bindEngagementUi?.();
    bindAccountUi?.();
    registerPwa();
    retentionSessionStart?.();
    prepareWeeklyDigest?.();

    setSplashProgress?.(18,"Загружаю словарь…");
    await loadCategoryBank();
    setSplashProgress?.(48,"Проверяю аккаунт…");
    await restoreAccountSessionOnBoot?.();
    if (typeof accountSignedIn === "function" && accountSignedIn()) grantStarterCompanions?.({ notify: false });
    syncBossCompanionsFromProgress?.({ notify: false });
    syncAchievementCompanions?.({ notify: false });
    syncBirthdayRewards?.();
    claimPwaInstallReward?.({ notify:false });
    saveProfile?.({ skipCloud: true });
    setSplashProgress?.(55,"Собираю прогресс…");
    migrateCategoryMasteryProgress?.();
    ensureWeeklyChallenge();
    ensureMonthlyChallenge?.();
    setSplashProgress?.(64,"Синхронизирую с сервером…");
    await syncServerDataOnBoot();
    syncBossCompanionsFromProgress?.({ notify: false });
    syncAchievementCompanions?.({ notify: false });
    syncBirthdayRewards?.();
    claimPwaInstallReward?.({ notify:false });
    saveProfile?.({ skipCloud: true });
    runQualityAudit?.();

    // First-run onboarding is interactive. The splash must be fully removed
    // before we wait for the player, otherwise it sits above the modal and
    // the bootstrap promise can never resolve.
    let onboardingRan = false;
    if (!profile.onboardingComplete) {
      setSplashProgress?.(68,"Первый запуск…");
      await hideSplash?.();
      await window.SolivocFirstRunAccount?.runGate?.();
      onboardingRan = !!(await runFirstRunOnboarding?.());
    }

    const challenge = challengeCodeFromUrl();
    let startedChallenge = false;
    if (challenge) {
      setSplashProgress?.(72,"Открываю дуэль…");
      startedChallenge = await startChallengeCode(challenge);
    }

    let openHomeAfterLoad = false;
    if (!startedChallenge) {
      if (onboardingRan) makeLevel(1,{mode:"tutorial",step:1});
      else {
        openHomeAfterLoad = profile.settings?.startupScreen !== "game";
        load({ render: !openHomeAfterLoad });
      }
    }

    setSplashProgress?.(82,"Проверяю награды…");
    syncDuelStats?.();
    checkAchievements();
    saveProfile();
    startChallengeSyncLoop();

    // Prepare the home hub while the splash is still covering the app. This
    // prevents a one-frame flash of the underlying game board on launch.
    if (openHomeAfterLoad && !startedChallenge) openHub("home");

    if (!onboardingRan) {
      setSplashProgress?.(94,"Почти готово…");
      await hideSplash?.();
    }

    if (!openHomeAfterLoad || startedChallenge) setBackgroundMusic(musicModeForState?.() || "game");
    renderGlobalProfileHeaders?.();
    updateProfileMailBadge?.();
    if (onboardingRan) { const currentPatch=latestMajorPatchMessage?.(); if(currentPatch?.version){ profile.patchSeenVersion=String(currentPatch.version); saveProfile(); } }
    else if (!startedChallenge) setTimeout(() => showPatchNotesIfNeeded?.(), 420);

    // Network synchronization must never keep the loading screen open.
    // Redis/Push/analytics can finish after the local game is already ready.
    Promise.allSettled([
      Promise.resolve(flushPendingChallengeSubmissions?.()),
      Promise.resolve(refreshOwnedChallenges?.({ notify: true })),
      Promise.resolve(refreshReceivedChallenges?.()),
      Promise.resolve(syncPushState?.()),
    ]).then(()=>{
      if (!startedChallenge && unseenDuelEntry?.()) setTimeout(()=>showPendingDuelReveal?.(),350);
      else setTimeout(()=>showPendingWeeklyDigest?.(),550);
    });

    flushRemoteAnalytics?.();
    syncLeaderboardNonBlocking?.();
    markStabilityStage?.("active");
    setTimeout(() => scheduleDeadlockCheck(1000), 300);
  } catch (err) {
    markStabilityFault?.("boot_error", err?.message || err);
    console.error(err);
    if ($("#splash")) showSplashError?.("Не удалось загрузить игру");
    else showToast("Ошибка запуска игры");
  }
}

boot();