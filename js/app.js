/* UI event binding, hint/undo orchestration, PWA registration and application bootstrap. */
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

  $("#undo").onclick = () => {
    if (autoMoveBusy || categoryAnimating || !history.length) return;
    const limit = state.special?.maxUndos;
    if (Number.isFinite(limit) && state.run.undos >= limit) {
      feedbackWrongMove([$("#undo")], $("#undo"), `В этом уровне доступно только ${limit} отмена`);
      return;
    }
    const previous = history.pop(),
      undoCount = (state.run?.undos || 0) + 1;
    state = normalizeState(previous);
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
      setTimeout(() => n?.classList.remove("hint"), 1400);
      const actionText = hint.zone === "slot" ? "в категорию" : "на связанную стопку";
      showToast(`Ход: ${groupLabel(p.groups[0])} → ${actionText}`);
    } else if (hint?.action === "draw") {
      stockEl.classList.add("hint-stock");
      setTimeout(() => stockEl.classList.remove("hint-stock"), 1100);
      showToast("Открой следующую карту колоды");
    } else if (hint?.action === "recycle") {
      stockEl.classList.add("hint-stock");
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
      const reg = await navigator.serviceWorker.register("./sw.js");
      const banner = $("#updateBanner"), updateBtn = $("#updateNow"), updateReloadKey = "solivoc-explicit-update";
      const showUpdate = (worker) => {
        if (!worker || !navigator.serviceWorker.controller) return;
        banner?.classList.add("show");
        banner?.setAttribute("aria-hidden", "false");
        if (updateBtn) updateBtn.onclick = () => {
          try { sessionStorage.setItem(updateReloadKey, "1"); } catch {}
          updateBtn.disabled = true;
          updateBtn.textContent = "Обновляю…";
          worker.postMessage({ type: "SKIP_WAITING" });
        };
      };
      if (reg.waiting) showUpdate(reg.waiting);
      reg.addEventListener("updatefound", () => {
        const worker = reg.installing;
        worker?.addEventListener("statechange", () => {
          if (worker.state === "installed") showUpdate(worker);
        });
      });
      let refreshing = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (refreshing) return;
        let explicit = false;
        try { explicit = sessionStorage.getItem(updateReloadKey) === "1"; } catch {}
        // A newly installed service worker can take control on first launch.
        // Never reload the game for that event: on iOS/PWA it can briefly leave
        // a white screen or restart an active session. Reload only when the
        // player explicitly pressed the update button.
        if (!explicit) return;
        refreshing = true;
        try { sessionStorage.removeItem(updateReloadKey); } catch {}
        location.reload();
      });
    } catch (err) {
      console.warn("Service worker:", err);
    }
  });
}

let challengeSyncTimer = null;
function startChallengeSyncLoop() {
  clearInterval(challengeSyncTimer);
  challengeSyncTimer = setInterval(() => {
    if (document.visibilityState !== "visible") return;
    flushPendingChallengeSubmissions?.();
    refreshOwnedChallenges?.({ notify: true });
    refreshReceivedChallenges?.();
    syncPushState?.();
  }, 20000);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    flushPendingChallengeSubmissions?.();
    refreshOwnedChallenges?.({ notify: true });
    refreshReceivedChallenges?.();
    syncPushState?.();
  });
}

async function boot() {
  try {
    bindFeedbackEvents();
    bindAppEvents();
    bindRetentionUi?.();
    bindEngagementUi?.();
    registerPwa();
    retentionSessionStart?.();
    prepareWeeklyDigest?.();

    setSplashProgress?.(18,"Загружаю словарь…");
    await loadCategoryBank();
    setSplashProgress?.(55,"Собираю прогресс…");
    migrateCategoryMasteryProgress?.();
    ensureWeeklyChallenge();
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
        load();
        openHomeAfterLoad = profile.settings?.startupScreen !== "game";
      }
    }

    setSplashProgress?.(82,"Проверяю награды…");
    syncDuelStats?.();
    checkAchievements();
    saveProfile();
    startChallengeSyncLoop();

    if (!onboardingRan) {
      setSplashProgress?.(94,"Почти готово…");
      await hideSplash?.();
    }

    if (openHomeAfterLoad && !startedChallenge) openHub("home");
    else setBackgroundMusic(musicModeForState?.() || "game");
    renderGlobalProfileHeaders?.();

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
    setTimeout(() => scheduleDeadlockCheck(1000), 300);
  } catch (err) {
    console.error(err);
    if ($("#splash")) showSplashError?.("Не удалось загрузить игру");
    else showToast("Ошибка запуска игры");
  }
}

boot();
