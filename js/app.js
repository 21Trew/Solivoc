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
    bubble.className = "companion-bubble companion-bubble-floating";
    document.body.appendChild(bubble);
  }
  const rect = host.getBoundingClientRect();
  bubble.textContent = text;
  bubble.style.left = `${Math.max(10, rect.left - 168)}px`;
  bubble.style.top = `${Math.max(10, rect.top - 18)}px`;
  bubble.hidden = false;
  clearTimeout(showCompanionBubble.timer);
  showCompanionBubble.timer = setTimeout(() => { bubble.hidden = true; }, ms);
}
function clearMascotHintLine() { document.querySelector(".mascot-hint-line")?.remove(); $("#gameCompanion")?.classList.remove("pointing"); }
function pointCompanionAt(target, text = "Смотри сюда!") {
  clearMascotHintLine();
  const mascot = $("#gameCompanion"); if (!mascot || mascot.hidden || !target) return;
  mascot.classList.add("pointing"); showCompanionBubble(text, 2200);
  const a = mascot.getBoundingClientRect(), b = target.getBoundingClientRect();
  const x1=a.left+a.width*.2, y1=a.top+a.height*.72, x2=b.left+b.width*.5, y2=b.top+b.height*.45;
  const dx=x2-x1, dy=y2-y1, len=Math.max(24,Math.hypot(dx,dy));
  const line=document.createElement("div"); line.className="mascot-hint-line"; line.style.left=`${x1}px`; line.style.top=`${y1}px`; line.style.width=`${len}px`; line.style.transform=`rotate(${Math.atan2(dy,dx)*180/Math.PI}deg)`;
  document.body.appendChild(line); setTimeout(clearMascotHintLine, 1500);
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
      undoCount = (state.run?.undos || 0) + 1;
    state = restoreHistorySnapshot(previous);
    if (!state) return;
    state.run.undos = undoCount;
    profile.stats.undos++;
    track("undo", { mode: state.mode });
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
    if (state.special?.noHints) {
      feedbackWrongMove([$("#hint")], $("#hint"), "На этом уровне подсказки отключены");
      return;
    }
    state.run.hints++;
    profile.stats.hints++;
    scheduleProfileSave?.();
    track("hint_used", { mode: state.mode });
    resetCombo();
    const hint = findHintMove();
    if (hint?.payload) {
      const p = hint.payload;
      let q;
      if (p.source === "column") q = `.card[data-source="column"][data-col="${p.ci}"]`;
      else if (p.source === "waste") q = ".waste .card.movable";
      const n = q ? document.querySelector(q) : null;
      n?.classList.add("hint");
      pointCompanionAt(n, companionDef(profile.settings.companion).id === "cat" ? "Мяу! Вот эта карта." : "Подсказка: начни с этой карты.");
      setTimeout(() => n?.classList.remove("hint"), 1400);
      const actionText = hint.zone === "slot" ? "в категорию" : "на связанную стопку";
      showToast(`Ход: ${groupLabel(p.groups[0])} → ${actionText}`);
    } else if (hint?.action === "draw") {
      stockEl.classList.add("hint-stock");
      pointCompanionAt(stockEl, "Загляни в колоду!");
      setTimeout(() => stockEl.classList.remove("hint-stock"), 1100);
      showToast("Открой следующую карту колоды");
    } else if (hint?.action === "recycle") {
      stockEl.classList.add("hint-stock");
      pointCompanionAt(stockEl, "Верни сброс сюда.");
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
        if (state.tutorialStep < 3) makeLevel(state.tutorialStep + 1, { mode: "tutorial", step: state.tutorialStep + 1 });
        else makeLevel(profile.currentLevel || 1);
      } else if (state.mode === "daily") makeLevel(profile.currentLevel || 1);
      else if (state.mode === "challenge") openHub("modes");
      else if (state.mode === "collection") makeLevel(1, { mode: "collection", collectionId: state.collectionId, seed: `collection:${state.collectionId}:${Date.now()}` });
      else if (state.mode === "calm") makeLevel(1, { mode: "calm", seed: `calm:${Date.now()}:${Math.random()}` });
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
  if (!("serviceWorker" in navigator) || !/^https?:$/.test(location.protocol)) return;
  window.addEventListener("load", async () => {
    try {
      const reg = await navigator.serviceWorker.register("./sw.js", { updateViaCache: "none" });
      const banner = $("#updateBanner"), updateBtn = $("#updateNow"), updateReloadKey = "solivoc-explicit-update";
      const currentBuild = document.querySelector('meta[name="slovasyans-build"]')?.content || "";
      let pendingWorker = reg.waiting || null,
        updateRequested = false,
        refreshing = false,
        checkBusy = false,
        lastCheckAt = 0;

      const requestActivation = (worker) => {
        if (!worker || worker.state !== "installed") return false;
        pendingWorker = worker;
        if (!updateRequested) return true;
        try { worker.postMessage({ type: "SKIP_WAITING" }); } catch {}
        return true;
      };
      const showUpdate = (worker = null) => {
        if (!navigator.serviceWorker.controller) return;
        if (worker) pendingWorker = worker;
        banner?.classList.add("show");
        banner?.setAttribute("aria-hidden", "false");
      };
      const watchWorker = (worker) => {
        if (!worker) return;
        const onState = () => {
          if (worker.state !== "installed") return;
          pendingWorker = worker;
          showUpdate(worker);
          requestActivation(worker);
        };
        onState();
        worker.addEventListener("statechange", onState);
      };

      if (reg.waiting) showUpdate(reg.waiting);
      watchWorker(reg.installing);
      reg.addEventListener("updatefound", () => watchWorker(reg.installing));

      const checkForUpdate = async ({ force = false } = {}) => {
        if (checkBusy || navigator.onLine === false || document.visibilityState === "hidden") return false;
        const now = Date.now();
        if (!force && now - lastCheckAt < 15000) return false;
        lastCheckAt = now;
        checkBusy = true;
        try {
          await reg.update().catch(() => {});
          if (reg.waiting) showUpdate(reg.waiting);
          const response = await fetch(`/api/version?t=${now}`, { cache: "no-store", credentials: "same-origin" });
          if (!response.ok) return false;
          const data = await response.json().catch(() => ({}));
          if (currentBuild && data?.build && String(data.build) !== String(currentBuild)) {
            showUpdate(reg.waiting || pendingWorker);
            // Start downloading the new worker immediately, even before the player taps the banner.
            reg.update().catch(() => {});
            return true;
          }
          return !!reg.waiting;
        } catch {
          return false;
        } finally {
          checkBusy = false;
        }
      };

      if (updateBtn) updateBtn.onclick = async () => {
        updateRequested = true;
        try { sessionStorage.setItem(updateReloadKey, "1"); } catch {}
        updateBtn.disabled = true;
        updateBtn.textContent = "Обновляю…";
        const ready = reg.waiting || pendingWorker;
        if (requestActivation(ready)) return;
        try { await reg.update(); } catch {}
        if (requestActivation(reg.waiting || pendingWorker)) return;
        watchWorker(reg.installing);
        // If installation is still downloading, keep the request armed. The
        // statechange handler will activate it as soon as it reaches installed.
        setTimeout(() => {
          if (!updateRequested || refreshing || reg.waiting || pendingWorker?.state === "installed") return;
          updateBtn.disabled = false;
          updateBtn.textContent = "Повторить";
        }, 8000);
      };

      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (refreshing) return;
        let explicit = false;
        try { explicit = sessionStorage.getItem(updateReloadKey) === "1"; } catch {}
        if (!explicit) return;
        refreshing = true;
        try { sessionStorage.removeItem(updateReloadKey); } catch {}
        markStabilityStage?.("updating");
        location.reload();
      });

      // iOS can keep a PWA alive in the background for a long time. Recheck
      // whenever the player returns, not only on a cold launch.
      const visibleCheck = () => { if (document.visibilityState === "visible") checkForUpdate({ force: true }); };
      document.addEventListener("visibilitychange", visibleCheck, { passive: true });
      window.addEventListener("pageshow", () => checkForUpdate({ force: true }), { passive: true });
      window.addEventListener("focus", () => checkForUpdate(), { passive: true });
      window.addEventListener("online", () => checkForUpdate({ force: true }), { passive: true });
      setInterval(() => checkForUpdate(), 120000);
      checkForUpdate({ force: true });
    } catch (err) {
      console.warn("Service worker:", err);
    }
  });
}

let challengeSyncTimer = null, resumeSyncTimer = null, ruleMetricTimer = null, challengeSyncBusy = false, lifecycleHandlersBound = false;
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
    else setTimeout(invoke, 100);
  });
}
function startChallengeSyncLoop() {
  clearInterval(challengeSyncTimer);
  clearInterval(ruleMetricTimer);
  challengeSyncTimer = setInterval(() => syncChallengesNonBlocking(), 60000);
  ruleMetricTimer = setInterval(() => {
    if (document.visibilityState !== "visible" || !state) return;
    const el = $("#ruleMetric");
    if (!el || el.hidden || typeof ruleMetricText !== "function") return;
    el.textContent = ruleMetricText(state);
    if (typeof checkActiveRuleFailure === "function") checkActiveRuleFailure();
  }, 500);
  // startChallengeSyncLoop can be called again after a soft re-initialization.
  // Timers are replaceable; lifecycle listeners are not, so bind them once.
  if (!lifecycleHandlersBound) {
    lifecycleHandlersBound = true;
    document.addEventListener("visibilitychange", () => {
      clearTimeout(resumeSyncTimer);
      if (document.visibilityState === "hidden") {
        markStabilityStage?.("hidden");
        cancelActiveDragForLifecycle?.();
        cancelAutoMoveForLifecycle?.();
        pauseActiveRun?.();
        compactTransientRuntimeForBackground?.();
        save?.({ immediate: true });
        flushProfileSave?.({ skipCloud: true });
        return;
      }
      markStabilityStage?.("active");
      resumeActiveRun?.();
      resumeAudioForLifecycle?.();
      scheduleAccountSync?.(1800);
      // Let WebKit paint the restored board before any optional network work.
      if (navigator.onLine !== false) resumeSyncTimer = setTimeout(() => syncChallengesNonBlocking(), 1200);
    });
    window.addEventListener("pagehide", () => {
      const priorStage = readStabilityState?.()?.current?.stage;
      if (priorStage !== "closed") markStabilityStage?.("hidden", { pagehide: true });
      cancelActiveDragForLifecycle?.(); cancelAutoMoveForLifecycle?.(); pauseActiveRun?.(); compactTransientRuntimeForBackground?.();
      save?.({ immediate: true }); flushProfileSave?.({ skipCloud: true });
    });
    window.addEventListener("pageshow", (event) => {
      markStabilityStage?.("active", { persisted: !!event.persisted });
      resumeActiveRun?.(); resumeAudioForLifecycle?.(); scheduleAccountSync?.(1800);
    });
    window.addEventListener("freeze", () => {
      markStabilityStage?.("hidden", { freeze: true });
      cancelActiveDragForLifecycle?.(); cancelAutoMoveForLifecycle?.(); pauseActiveRun?.(); compactTransientRuntimeForBackground?.();
      save?.({ immediate: true }); flushProfileSave?.({ skipCloud: true });
    });
    window.addEventListener("beforeunload", () => { markStabilityStage?.("closed", { beforeunload: true }); save?.({ immediate: true }); flushProfileSave?.({ skipCloud: true }); });
    window.addEventListener("error", (event) => markStabilityFault?.("error", event?.message || event?.error?.message));
    window.addEventListener("unhandledrejection", (event) => markStabilityFault?.("promise", event?.reason?.message || event?.reason));
  }
}

async function fetchServerBootstrap() {
  if (!/^https?:$/.test(location.protocol) || navigator.onLine === false) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 1800);
  try {
    const response = await fetch("/api/bootstrap", { cache: "no-store", signal: controller.signal });
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
    saveProfile?.({ skipCloud: true });
    setSplashProgress?.(55,"Собираю прогресс…");
    migrateCategoryMasteryProgress?.();
    ensureWeeklyChallenge();
    ensureMonthlyChallenge?.();
    setSplashProgress?.(64,"Синхронизирую с сервером…");
    await syncServerDataOnBoot();
    runQualityAudit?.();

    // First-run onboarding is interactive. The splash must be fully removed
    // before we wait for the player, otherwise it sits above the modal and
    // the bootstrap promise can never resolve.
    let onboardingRan = false;
    if (!profile.onboardingComplete) {
      setSplashProgress?.(68,"Первый запуск…");
      await hideSplash?.();
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
