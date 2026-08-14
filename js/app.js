/* UI event binding, hint/undo orchestration, PWA registration and application bootstrap. */
function bindAppEvents() {
  let lastTouchEndAt = 0;
  document.addEventListener(
    "touchend",
    (e) => {
      if (!e.target.closest(".card,.stock,.waste,.slot,button,.brand")) return;
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

  $(".brand").addEventListener("click", openHub);
  $("#menuButton").onclick = openHub;
  $("#hubClose").onclick = closeHub;

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
    if (state.mode === "tutorial") {
      if (state.tutorialStep < 3)
        makeLevel(state.tutorialStep + 1, { mode: "tutorial", step: state.tutorialStep + 1 });
      else makeLevel(profile.currentLevel || 1);
    } else if (state.mode === "daily") makeLevel(profile.currentLevel || 1);
    else if (state.mode === "challenge") openHub("play");
    else if (state.mode === "collection") makeLevel(1, { mode: "collection", collectionId: state.collectionId, seed: `collection:${state.collectionId}:${Date.now()}` });
    else if (state.mode === "calm") makeLevel(1, { mode: "calm", seed: `calm:${Date.now()}:${Math.random()}` });
    else if (state.mode === "marathon") {
      const nextRound = state.marathonSuccess ? (state.marathonRound || 1) + 1 : 1;
      const runId = state.marathonSuccess ? state.marathonId : `marathon:${Date.now().toString(36)}`;
      makeLevel(nextRound, { mode: "marathon", seed: `${runId}:${nextRound}`, marathonRound: nextRound, marathonId: runId });
    } else makeLevel(state.level + 1);
  };
  $("#winRestart").onclick = () => {
    closeWinModal();
    resetCombo();
    restartCurrentLevel();
  };
  $("#winMenu").onclick = () => {
    closeWinModal();
    resetCombo();
    openHub();
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
      const banner = $("#updateBanner"), updateBtn = $("#updateNow");
      const showUpdate = (worker) => {
        if (!worker || !navigator.serviceWorker.controller) return;
        banner?.classList.add("show");
        banner?.setAttribute("aria-hidden", "false");
        if (updateBtn) updateBtn.onclick = () => worker.postMessage({ type: "SKIP_WAITING" });
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
        refreshing = true;
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

function boot() {
  bindFeedbackEvents();
  bindAppEvents();
  bindRetentionUi?.();
  registerPwa();
  retentionSessionStart?.();
  setSplashProgress?.(18,"Загружаю словарь…");
  loadCategoryBank()
    .then(async () => {
      setSplashProgress?.(55,"Собираю прогресс…");
      migrateCategoryMasteryProgress?.();
      ensureWeeklyChallenge();
      const challenge = challengeCodeFromUrl();
      let startedChallenge = false;
      if (challenge) {
        setSplashProgress?.(72,"Открываю вызов…");
        startedChallenge = await startChallengeCode(challenge);
      }
      if (!startedChallenge) load();
      setSplashProgress?.(82,"Проверяю награды…");
      checkAchievements();
      saveProfile();
      flushPendingChallengeSubmissions?.();
      const gotResult = await refreshOwnedChallenges?.({ notify: true });
      const gotReceivedResult = await refreshReceivedChallenges?.();
      syncPushState?.();
      startChallengeSyncLoop();
      setBackgroundMusic("game");
      setSplashProgress?.(94,"Почти готово…");
      hideSplash?.();
      if (!startedChallenge && (gotResult || gotReceivedResult || unseenDuelEntry?.())) setTimeout(()=>showPendingDuelReveal?.(),900);
      setTimeout(() => scheduleDeadlockCheck(1000), 300);
    })
    .catch((err) => {
      console.error(err);
      showSplashError?.("Не удалось загрузить базу категорий");
      showToast("Ошибка загрузки базы категорий");
    });
}

boot();
