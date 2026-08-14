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
    if (state.mode === "tutorial") makeLevel(state.tutorialStep, { mode: "tutorial", step: state.tutorialStep });
    else makeLevel(state.level, { mode: state.mode, seed: state.seed });
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
    else makeLevel(state.level + 1);
  };
  $("#winRestart").onclick = () => {
    closeWinModal();
    resetCombo();
    if (state.mode === "daily") makeLevel(0, { mode: "daily", seed: state.seed });
    else if (state.mode === "tutorial") makeLevel(state.tutorialStep, { mode: "tutorial", step: state.tutorialStep });
    else makeLevel(state.level, { mode: "regular", seed: state.seed });
  };
  $("#winMenu").onclick = () => {
    closeWinModal();
    resetCombo();
    openHub();
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
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch((err) => console.warn("Service worker:", err));
  });
}

function boot() {
  bindFeedbackEvents();
  bindAppEvents();
  registerPwa();
  loadCategoryBank()
    .then(() => {
      load();
      checkAchievements();
      saveProfile();
      setBackgroundMusic("game");
      setTimeout(() => scheduleDeadlockCheck(1000), 300);
    })
    .catch((err) => {
      console.error(err);
      showToast("Ошибка загрузки базы категорий");
    });
}

boot();
