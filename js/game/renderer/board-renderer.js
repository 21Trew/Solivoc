/* Incremental game renderer. Owns board DOM updates and post-paint lifecycle. */
(() => {
  "use strict";
  const root = typeof window !== "undefined" ? window : globalThis;
  if (root.SolivocGameRenderer) return;

  const validIndex = (value, length) => {
    const n = Number(value);
    return Number.isInteger(n) && n >= 0 && n < Math.max(0, Number(length) || 0) ? n : -1;
  };

  function ensureSlots() {
    const count = state?.slots?.length || 0;
    while (slotsAnchor.children.length > count) slotsAnchor.lastElementChild?.remove();
    while (slotsAnchor.children.length < count) {
      const slot = document.createElement("div");
      slot.className = "slot empty";
      slot.dataset.zone = "slot";
      slot.dataset.index = String(slotsAnchor.children.length);
      slotsAnchor.appendChild(slot);
    }
    [...slotsAnchor.children].forEach((slot, index) => {
      slot.dataset.zone = "slot";
      slot.dataset.index = String(index);
    });
  }

  function ensureColumns() {
    const count = state?.columns?.length || 0;
    while (tableau.children.length > count) tableau.lastElementChild?.remove();
    while (tableau.children.length < count) {
      const column = document.createElement("div");
      column.className = "column empty";
      column.dataset.zone = "column";
      column.dataset.index = String(tableau.children.length);
      tableau.appendChild(column);
    }
    [...tableau.children].forEach((column, index) => {
      column.dataset.zone = "column";
      column.dataset.index = String(index);
    });
  }

  function updateSlot(index, { fit = true } = {}) {
    const i = validIndex(index, state?.slots?.length);
    if (i < 0) return false;
    ensureSlots();
    const slot = slotsAnchor.children[i], group = state.slots[i];
    const locked = !!state.special?.lockedSlot && i === state.slots.length - 1 && state.completed < (state.special.unlockAfter || 1);
    slot.className = "slot " + (group ? "" : "empty") + (locked ? " locked-slot" : "");
    slot.replaceChildren();
    if (group) {
      const card = cardNode(group, "");
      card.dataset.source = "slot";
      card.dataset.index = String(i);
      slot.appendChild(card);
    }
    if (fit) fitAllCardText(slot);
    return true;
  }

  function updateColumn(index, { fit = true } = {}) {
    const i = validIndex(index, state?.columns?.length);
    if (i < 0) return false;
    ensureColumns();
    const column = tableau.children[i], groups = state.columns[i], step = stackStep();
    column.className = "column " + (groups.length ? "" : "empty");
    column.replaceChildren();
    groups.forEach((group, groupIndex) => {
      const baseY = colY(groups, groupIndex, step);
      if (!group.faceUp) {
        const card = document.createElement("div");
        card.className = "card face-down";
        card.dataset.col = String(i);
        card.dataset.groupIndex = String(groupIndex);
        card.dataset.uid = group.cards?.[0]?.uid || "";
        card.style.setProperty("--y", baseY + "px");
        card.style.zIndex = String(1 + groupIndex);
        column.appendChild(card);
        return;
      }
      const stackSize = group.cards.length;
      group.cards.forEach((single, cardIndex) => {
        const card = cardNode({ cards: [single], faceUp: true }, "movable");
        card.dataset.source = "column";
        card.dataset.col = String(i);
        card.dataset.index = String(groupIndex);
        card.dataset.cardIndex = String(cardIndex);
        card.dataset.groupIndex = String(groupIndex);
        card.style.setProperty("--y", baseY + cardIndex * step + "px");
        card.style.zIndex = String(10 + groupIndex * 10 + cardIndex);
        if (!(groupIndex === groups.length - 1 && cardIndex === stackSize - 1)) card.classList.add("stack-under", "open-under");
        column.appendChild(card);
      });
    });
    if (fit) fitAllCardText(column);
    return true;
  }

  function updateStock() {
    stockEl.replaceChildren();
    stockEl.className = "stock " + (state.stock.length ? "" : "empty");
    if (!state.stock.length && state.waste.length && !canRecycleStock()) stockEl.classList.add("exhausted");
    if (state.stock.length) {
      const back = document.createElement("div");
      back.className = "card face-down";
      stockEl.appendChild(back);
      const count = document.createElement("span");
      count.className = "stock-count";
      count.textContent = String(state.stock.length);
      stockEl.appendChild(count);
    }
    return true;
  }

  function updateWaste({ fit = true } = {}) {
    wasteEl.replaceChildren();
    wasteEl.className = "waste " + (state.waste.length ? "" : "empty");
    if (state.waste.length) {
      const visible = state.waste.slice(-3);
      visible.forEach((data, index) => {
        const card = cardNode({ cards: [data], faceUp: true }, index === visible.length - 1 ? "movable" : "");
        card.dataset.source = "waste";
        card.style.setProperty("--waste-x", index * 6 + "px");
        card.style.zIndex = String(2 + index);
        wasteEl.appendChild(card);
      });
      const count = document.createElement("span");
      count.className = "pile-count";
      count.textContent = String(state.waste.length);
      wasteEl.appendChild(count);
    }
    if (fit) fitAllCardText(wasteEl);
    return true;
  }

  function updateSpecialBadge() {
    const badge = $("#specialBadge");
    if (!badge) return;
    if (state.mode === "regular" && state.special) {
      badge.hidden = false;
      badge.textContent = state.special.boss ? `${state.special.icon} Финал главы` : `${state.special.icon} ${state.special.title}`;
      badge.title = state.special.desc;
    } else if (state.mode === "challenge") {
      const def = duelModeDef(state.duelMode);
      badge.hidden = false;
      badge.textContent = `⚔ ${def.label}`;
      badge.title = def.description || "Одинаковый расклад можно отправить другу";
    } else if (state.mode === "marathon") {
      badge.hidden = false;
      badge.textContent = `∞ Раунд ${state.marathonRound || 1}`;
      badge.title = "Марафон продолжается только при ★★★";
    } else if (state.mode === "collection") {
      const collection = associationCollectionById(state.collectionId);
      badge.hidden = false;
      badge.textContent = `${collection.icon} ${collection.name}`;
      badge.title = "Картинки: собирай карточки по ассоциациям";
    } else if (state.mode === "calm") {
      badge.hidden = false;
      badge.textContent = "☁ Дзен";
      badge.title = "Лёгкие расклады без комбо и особых ограничений";
    } else if (["time", "moves", "combo", "noMistakes", "onePass", "hardcore", "custom"].includes(state.mode)) {
      const def = GAME_MODE_DEFS.find((mode) => mode.id === state.mode);
      badge.hidden = false;
      badge.textContent = state.mode === "hardcore" ? `☠ Хардкор! · ${Math.max(1, +state.level || 1)}` : `${def?.icon || "◆"} ${def?.label || "Испытание"}`;
      badge.title = def?.desc || "Особый режим";
    } else {
      badge.hidden = true;
      badge.textContent = "";
      badge.title = "";
    }
  }

  function updateHud() {
    renderGlobalProfileHeaders?.();
    syncGameCompanion?.();
    document.documentElement.style.setProperty("--cols", state.cols);
    document.documentElement.dataset.cols = String(state.cols);
    const chapter = state.mode === "regular" ? chapterInfo(state.level) : null;
    document.body.dataset.chapter = chapter ? String(chapter.number) : "0";
    document.body.dataset.chapterTone = chapter ? String(((chapter.number - 1) % 4) + 1) : "0";

    $("#level").textContent = state.mode === "daily" ? "D"
      : state.mode === "tutorial" ? `T${state.tutorialStep}`
      : state.mode === "challenge" ? "C"
      : state.mode === "marathon" ? `M${state.marathonRound || 1}`
      : state.mode === "collection" ? "▦"
      : state.mode === "calm" ? "☁"
      : ["time", "moves", "combo", "noMistakes", "onePass", "hardcore", "custom"].includes(state.mode)
        ? (GAME_MODE_DEFS.find((mode) => mode.id === state.mode)?.icon || "◆")
        : state.level;
    $("#progressText").textContent = `${state.completed}/${state.totalCategories}`;
    $("#progressBar").style.width = `${state.totalCategories > 0 ? (state.completed / state.totalCategories) * 100 : 0}%`;
    const moveEl = $("#moveCount");
    if (moveEl) moveEl.textContent = state.run?.moves || 0;
    const metricEl = $("#ruleMetric");
    if (metricEl) {
      const metric = typeof ruleMetricText === "function" ? ruleMetricText(state) : "";
      metricEl.textContent = metric;
      metricEl.hidden = !metric;
    }
    const comboEl = $("#comboXpStatus");
    if (comboEl) {
      comboEl.textContent = typeof comboXpHudText === "function" ? comboXpHudText(state) : `Комбо ×${Math.max(0, +(state.run?.comboCurrent || 0))}`;
      comboEl.hidden = false;
    }
    const bonusEl = $("#bonusObjective");
    if (bonusEl) {
      bonusEl.innerHTML = typeof bonusObjectiveMarkup === "function" ? bonusObjectiveMarkup(state) : "";
      bonusEl.hidden = !bonusEl.innerHTML;
    }
    updateSpecialBadge();
    const undoLimit = state.special?.maxUndos;
    $("#undo").disabled = !history.length || (Number.isFinite(undoLimit) && state.run.undos >= undoLimit);
    $("#hint").disabled = !!state.special?.noHints || !!state.rules?.noHints;
  }

  function cardByUid(uid) {
    const key = String(uid || "");
    if (!key) return null;
    for (const column of state?.columns || []) for (const group of column || []) for (const card of group?.cards || []) if (String(card?.uid || "") === key) return card;
    for (const group of state?.slots || []) for (const card of group?.cards || []) if (String(card?.uid || "") === key) return card;
    for (const card of state?.waste || []) if (String(card?.uid || "") === key) return card;
    for (const card of state?.stock || []) if (String(card?.uid || "") === key) return card;
    return null;
  }

  function recordEffectKnowledge(result) {
    if (!result?.effects?.length || typeof recordKnowledgeCards !== "function") return;
    const cards = [], seen = new Set();
    for (const effect of result.effects) {
      if (!["CARD_REVEALED", "STOCK_DRAWN"].includes(effect?.type) || !effect.uid) continue;
      const card = cardByUid(effect.uid), key = String(effect.uid);
      if (!card || seen.has(key)) continue;
      seen.add(key);
      cards.push(card);
    }
    if (cards.length) recordKnowledgeCards(cards, state);
  }

  function finishPostPaint({ full = false, result = null } = {}) {
    if (full) recordVisibleKnowledge?.(state);
    else recordEffectKnowledge(result);
    scheduleSave?.();
    queuePostRenderCardAnimations?.();
    const validCompletion = state.totalCategories > 0 && state.completed === state.totalCategories && (state.run?.moves || 0) > 0;
    if (validCompletion && !state.rewarded) finishLevel();
  }

  function renderBoard() {
    if (!state) return false;
    const timing = runtimeDiagnostics?.begin?.("fullBoardRender");
    runtimeDiagnostics?.count?.("fullBoardRenders");
    try {
      fitTableauGeometry();
      ensureSlots();
      ensureColumns();
      for (let index = 0; index < state.slots.length; index++) updateSlot(index, { fit: false });
      updateStock();
      updateWaste({ fit: false });
      for (let index = 0; index < state.columns.length; index++) updateColumn(index, { fit: false });
      fitAllCardText(document);
      updateHud();
      finishPostPaint({ full: true });
      return true;
    } finally {
      runtimeDiagnostics?.end?.(timing);
    }
  }

  function paint(result) {
    if (!state || !result?.accepted) return false;
    const dirty = SolivocDirtyZones.plan(result.effects || []);
    if (dirty.full) return renderBoard();
    const timing = runtimeDiagnostics?.begin?.("incrementalBoardPaint");
    runtimeDiagnostics?.count?.("incrementalBoardPaints");
    try {
      dirty.columns.forEach((index) => updateColumn(index));
      dirty.slots.forEach((index) => updateSlot(index));
      if (dirty.stock) updateStock();
      if (dirty.waste) updateWaste();
      updateHud();
      finishPostPaint({ result });
      return true;
    } finally {
      runtimeDiagnostics?.end?.(timing);
    }
  }

  root.SolivocGameRenderer = Object.freeze({ renderBoard, paint, updateColumn, updateSlot, updateStock, updateWaste, updateHud });
})();
