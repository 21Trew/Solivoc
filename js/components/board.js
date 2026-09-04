/* Main board renderer and stock interaction. */
function render() {
  renderGlobalProfileHeaders?.();
  syncGameCompanion?.();
  document.documentElement.style.setProperty("--cols", state.cols);
  document.documentElement.dataset.cols = String(state.cols);
  const chapter = state.mode === "regular" ? chapterInfo(state.level) : null;
  document.body.dataset.chapter = chapter ? String(chapter.number) : "0";
  document.body.dataset.chapterTone = chapter ? String(((chapter.number - 1) % 4) + 1) : "0";
  fitTableauGeometry();
  tableau.innerHTML = "";
  slotsAnchor.innerHTML = "";
  const step = stackStep();
  state.slots.forEach((g, i) => {
    const slot = document.createElement("div");
    const locked = !!state.special?.lockedSlot && i === state.slots.length - 1 && state.completed < (state.special.unlockAfter || 1);
    slot.className = "slot " + (g ? "" : "empty") + (locked ? " locked-slot" : "");
    slot.dataset.zone = "slot";
    slot.dataset.index = i;
    if (g) {
      const card = cardNode(g, "");
      card.dataset.source = "slot";
      card.dataset.index = i;
      slot.appendChild(card);
    }
    slotsAnchor.appendChild(slot);
  });
  stockEl.innerHTML = "";
  stockEl.className = "stock " + (state.stock.length ? "" : "empty");
  if (!state.stock.length && state.waste.length && !canRecycleStock()) stockEl.classList.add("exhausted");
  if (state.stock.length) {
    const back = document.createElement("div");
    back.className = "card face-down";
    stockEl.appendChild(back);
    const n = document.createElement("span");
    n.className = "stock-count";
    n.textContent = state.stock.length;
    stockEl.appendChild(n);
  }
  wasteEl.innerHTML = "";
  wasteEl.className = "waste " + (state.waste.length ? "" : "empty");
  if (state.waste.length) {
    const visible = state.waste.slice(-3);
    visible.forEach((data, i) => {
      const card = cardNode({ cards: [data], faceUp: true }, i === visible.length - 1 ? "movable" : "");
      card.dataset.source = "waste";
      card.style.setProperty("--waste-x", i * 6 + "px");
      card.style.zIndex = String(2 + i);
      wasteEl.appendChild(card);
    });
    const n = document.createElement("span");
    n.className = "pile-count";
    n.textContent = state.waste.length;
    wasteEl.appendChild(n);
  }
  state.columns.forEach((col, ci) => {
    const el = document.createElement("div");
    el.className = "column " + (col.length ? "" : "empty");
    el.dataset.zone = "column";
    el.dataset.index = ci;
    col.forEach((g, gi) => {
      const baseY = colY(col, gi, step);
      if (!g.faceUp) {
        const card = document.createElement("div");
        card.className = "card face-down";
        card.dataset.col = ci;
        card.dataset.groupIndex = gi;
        card.dataset.uid = g.cards?.[0]?.uid || "";
        card.style.setProperty("--y", baseY + "px");
        card.style.zIndex = String(1 + gi);
        el.appendChild(card);
      } else {
        const stackSize = g.cards.length;
        g.cards.forEach((single, si) => {
          const card = cardNode({ cards: [single], faceUp: true }, "movable");
          card.dataset.source = "column";
          card.dataset.col = ci;
          card.dataset.index = gi;
          card.dataset.cardIndex = si;
          card.dataset.groupIndex = gi;
          card.style.setProperty("--y", baseY + si * step + "px");
          card.style.zIndex = String(10 + gi * 10 + si);
          const isTopmost = gi === col.length - 1 && si === stackSize - 1;
          if (!isTopmost) card.classList.add("stack-under", "open-under");
          el.appendChild(card);
        });
      }
    });
    tableau.appendChild(el);
  });
  fitAllCardText();
  if (typeof recordVisibleKnowledge === "function") recordVisibleKnowledge(state);
  $("#level").textContent =
    state.mode === "daily"
      ? "D"
      : state.mode === "tutorial"
        ? `T${state.tutorialStep}`
        : state.mode === "challenge"
          ? "C"
          : state.mode === "marathon"
            ? `M${state.marathonRound || 1}`
            : state.mode === "collection"
              ? "▦"
            : state.mode === "calm"
              ? "☁"
              : ["time","moves","combo","noMistakes","onePass","hardcore","custom"].includes(state.mode)
                ? (GAME_MODE_DEFS.find((m)=>m.id===state.mode)?.icon || "◆")
                : state.level;
  $("#progressText").textContent = `${state.completed}/${state.totalCategories}`;
  $("#progressBar").style.width = (state.completed / state.totalCategories) * 100 + "%";
  const moveEl = $("#moveCount");
  if (moveEl) moveEl.textContent = state.run?.moves || 0;
  const ruleMetricEl = $("#ruleMetric");
  if (ruleMetricEl) {
    const metric = typeof ruleMetricText === "function" ? ruleMetricText(state) : "";
    ruleMetricEl.textContent = metric;
    ruleMetricEl.hidden = !metric;
  }
  const comboXpEl = $("#comboXpStatus");
  if (comboXpEl) {
    const text = typeof comboXpHudText === "function" ? comboXpHudText(state) : `Комбо ×${Math.max(0, +(state.run?.comboCurrent || 0))}`;
    comboXpEl.textContent = text;
    comboXpEl.hidden = false;
  }
  const bonusEl = $("#bonusObjective");
  if (bonusEl) {
    bonusEl.innerHTML = typeof bonusObjectiveMarkup === "function" ? bonusObjectiveMarkup(state) : "";
    bonusEl.hidden = !bonusEl.innerHTML;
  }
  const specialBadge = $("#specialBadge");
  if (state.mode === "regular" && state.special) {
    specialBadge.hidden = false;
    specialBadge.textContent = state.special.boss ? `${state.special.icon} Финал главы` : `${state.special.icon} ${state.special.title}`;
    specialBadge.title = state.special.desc;
  } else if (state.mode === "challenge") {
    const duelDef = duelModeDef(state.duelMode);
    specialBadge.hidden = false;
    specialBadge.textContent = `⚔ ${duelDef.label}`;
    specialBadge.title = duelDef.description || "Одинаковый расклад можно отправить другу";
  } else if (state.mode === "marathon") {
    specialBadge.hidden = false;
    specialBadge.textContent = `∞ Раунд ${state.marathonRound || 1}`;
    specialBadge.title = "Марафон продолжается только при ★★★";
  } else if (state.mode === "collection") {
    const collection = associationCollectionById(state.collectionId);
    specialBadge.hidden = false;
    specialBadge.textContent = `${collection.icon} ${collection.name}`;
    specialBadge.title = "Картинки: собирай карточки по ассоциациям";
  } else if (state.mode === "calm") {
    specialBadge.hidden = false;
    specialBadge.textContent = "☁ Дзен";
    specialBadge.title = "Лёгкие расклады без комбо и особых ограничений";
  } else if (["time","moves","combo","noMistakes","onePass","hardcore","custom"].includes(state.mode)) {
    const modeDef = GAME_MODE_DEFS.find((m)=>m.id===state.mode);
    specialBadge.hidden = false;
    specialBadge.textContent = state.mode === "hardcore" ? `☠ Хардкор! · ${Math.max(1,+state.level||1)}` : `${modeDef?.icon || "◆"} ${modeDef?.label || "Испытание"}`;
    specialBadge.title = modeDef?.desc || "Особый режим";
  } else {
    specialBadge.hidden = true;
    specialBadge.textContent = "";
  }
  const undoLimit = state.special?.maxUndos;
  $("#undo").disabled = !history.length || (Number.isFinite(undoLimit) && state.run.undos >= undoLimit);
  $("#hint").disabled = !!state.special?.noHints || !!state.rules?.noHints;
  scheduleSave?.();
  queuePostRenderCardAnimations();
  const validCompletion = state.totalCategories > 0 && state.completed === state.totalCategories && (state.run?.moves || 0) > 0;
  if (validCompletion && !state.rewarded) finishLevel();
}
function drawStock() {
  if (autoMoveBusy || dealAnimating || categoryAnimating) return;
  const recycling = !state.stock.length;
  if (recycling && state.waste.length && !canRecycleStock()) {
    feedbackWrongMove([stockEl], stockEl, "Эту колоду больше нельзя прокрутить");
    scheduleDeadlockCheck(180);
    return;
  }
  if (!state.stock.length && !state.waste.length) return;

  if (!recycling) {
    const next = state.stock[state.stock.length - 1],
      from = stockEl.getBoundingClientRect();
    pendingStockDraw = {
      uid: next?.uid || null,
      from: { left: from.left, top: from.top, width: from.width, height: from.height },
    };
  }

  pushHistory();
  const result = SolivocGameController.dispatch({
    type: recycling ? SolivocGameEngine.COMMAND.RECYCLE_WASTE : SolivocGameEngine.COMMAND.DRAW_STOCK,
  });
  if (!result.accepted) {
    history.pop();
    pendingStockDraw = null;
    return;
  }
  if (SolivocGameController.effect(result, "STOCK_RECYCLED")) pendingRecycle = true;
  if (state.mode === "tutorial") noteTutorialAction?.("stock");
  if (typeof checkActiveRuleFailure === "function" && checkActiveRuleFailure()) return;
  profile.stats.stockDraws++;
  track("stock_draw", { mode: state.mode });
  haptic(7);
  playSfx("flip", 0.8);
  resetCombo();
  render();
  markStateChanged();
}
stockEl.addEventListener("click", () => {
  if (!drag) drawStock();
});