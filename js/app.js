/* UI event binding and application bootstrap. */
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
    if (history.length && !autoMoveBusy) {
      const previous = history.pop();
      const undoCount = (state.run?.undos || 0) + 1;
      state = normalizeState(previous);
      state.run.undos = undoCount;
      profile.stats.undos++;
      track("undo", { mode: state.mode });
      render();
    }
  };
  $("#restart").onclick = () => {
    if (autoMoveBusy) return;
    profile.stats.restarts++;
    track("level_restarted", { level: state.level, mode: state.mode });
    if (state.mode === "tutorial") makeLevel(state.tutorialStep, { mode: "tutorial", step: state.tutorialStep });
    else makeLevel(state.level, { mode: state.mode, seed: state.seed });
  };
  $("#hint").onclick = () => {
    if (autoMoveBusy) return;
    state.run.hints++;
    profile.stats.hints++;
    track("hint_used", { mode: state.mode });
    const payloads = [];
    state.columns.forEach((col, ci) => {
      const start = firstOpenIndex(col);
      if (start < col.length) payloads.push({ source: "column", ci, start, groups: col.slice(start) });
    });
    if (state.waste.length)
      payloads.push({ source: "waste", groups: [{ cards: [state.waste.at(-1)], faceUp: true }] });
    state.slots.forEach((g, si) => {
      if (g) payloads.push({ source: "slot", si, groups: [g] });
    });
    const targets = [...document.querySelectorAll("[data-zone]")];
    for (const p of payloads)
      for (const t of targets)
        if (canDrop(p, t)) {
          let q;
          if (p.source === "column") q = `.card[data-source="column"][data-col="${p.ci}"]`;
          else if (p.source === "waste") q = ".waste .card.movable";
          else q = `.slot[data-index="${p.si}"] .card`;
          const n = document.querySelector(q);
          n?.classList.add("hint");
          setTimeout(() => n?.classList.remove("hint"), 1400);
          showToast(`Ход: ${groupLabel(p.groups[0])}`);
          save();
          return;
        }
    showToast(
      state.stock.length || state.waste.length ? "Открой следующую карту колоды" : "Доступных ходов не найдено",
    );
    save();
  };
  $("#next").onclick = () => {
    modal.classList.remove("show");
    if (state.mode === "tutorial") {
      if (state.tutorialStep < 3)
        makeLevel(state.tutorialStep + 1, { mode: "tutorial", step: state.tutorialStep + 1 });
      else makeLevel(profile.currentLevel || 1);
    } else if (state.mode === "daily") makeLevel(profile.currentLevel || 1);
    else makeLevel(state.level + 1);
  };
  $("#replay").onclick = () => {
    modal.classList.remove("show");
    if (state.mode === "daily") makeLevel(0, { mode: "daily", seed: state.seed });
    else makeLevel(state.level, { mode: "regular", seed: state.seed });
  };

  let viewportResizeTimer;
  window.addEventListener(
    "resize",
    () => {
      clearTimeout(viewportResizeTimer);
      viewportResizeTimer = setTimeout(() => {
        if (state && !drag && !autoMoveBusy) render();
      }, 120);
    },
    { passive: true },
  );
}

function boot() {
  bindAppEvents();
  loadCategoryBank()
    .then(() => {
      load();
      checkAchievements();
      saveProfile();
    })
    .catch((err) => {
      console.error(err);
      showToast("Ошибка загрузки базы категорий");
    });
}

boot();
