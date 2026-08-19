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
      undoCount = (state.run?.undos || 0) + 1;
    state = restoreHistorySnapshot(previous);
    if (!state) return;
    state.run.undos = undoCount;
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
    state.run.hints++;
    profile.stats.hints++;
    scheduleProfileSave?.();
    track("hint_used", { mode: state.mode });
    resetCombo();
    const hint = findHintMove();
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
  if (!("serviceWorker" in navigator) || !/^https?:$/.test(location.protocol)) return;
  window.addEventListener("load", async () => {
    try {
      const reg = await navigator.serviceWorker.register("./sw.js", { updateViaCache: "none" });
      const banner = $("#updateBanner"), updateBtn = $("#updateNow"), updateReloadKey = "solivoc-explicit-update";
      const currentBuild = document.querySelector('meta[name="slovasyans-build"]')?.content || "";
      const deploymentKey = "solivoc-deployment-id";
      let pendingWorker = reg.waiting || null,
        pendingDeployment = "",
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
          const serverBuild = String(data?.build || "");
          const serverDeployment = String(data?.deployment || "");
          let savedDeployment = "";
          try { savedDeployment = localStorage.getItem(deploymentKey) || ""; } catch {}
          const buildChanged = !!(currentBuild && serverBuild && serverBuild !== String(currentBuild));
          const deploymentChanged = !!(serverDeployment && savedDeployment && serverDeployment !== savedDeployment);
          if (buildChanged || deploymentChanged) {
            pendingDeployment = serverDeployment || pendingDeployment;
            showUpdate(reg.waiting || pendingWorker);
            // Start downloading the new worker immediately, even before the player taps the banner.
            reg.update().catch(() => {});
            return true;
          }
          if (serverDeployment && (!savedDeployment || serverBuild === String(currentBuild))) {
            try { localStorage.setItem(deploymentKey, serverDeployment); } catch {}
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

        // A deployment id lets us detect a release even if somebody forgets to
        // bump the SW cache/version next time. In that case the player explicitly
        // asked to update, so clear the current offline generation and reload from
        // the network instead of leaving the button stuck on "Повторить".
        if (pendingDeployment && navigator.serviceWorker.controller) {
          const channel = new MessageChannel();
          const cleared = new Promise((resolve) => {
            const timeout = setTimeout(() => resolve(false), 2500);
            channel.port1.onmessage = () => { clearTimeout(timeout); resolve(true); };
          });
          try { navigator.serviceWorker.controller.postMessage({ type: "CLEAR_APP_CACHE" }, [channel.port2]); } catch {}
          await cleared;
          try { localStorage.setItem(deploymentKey, pendingDeployment); } catch {}
          refreshing = true;
          location.reload();
          return;
        }

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
        if (pendingDeployment) { try { localStorage.setItem(deploymentKey, pendingDeployment); } catch {} }
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
