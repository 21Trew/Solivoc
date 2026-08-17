/* Move payloads, validation, state mutations, hint search and deadlock analysis. */
function getDragPayload(card) {
  const source = card.dataset.source;
  if (source === "column") {
    const ci = +card.dataset.col,
      col = state.columns[ci],
      start = firstOpenIndex(col);
    if (start >= col.length) return null;
    return { source, ci, start, groups: col.slice(start) };
  }
  if (source === "waste") {
    const c = state.waste[state.waste.length - 1];
    return c ? { source, groups: [{ cards: [c], faceUp: true }] } : null;
  }
  if (source === "slot") {
    const si = +card.dataset.index;
    return { source, si, groups: [state.slots[si]] };
  }
  return null;
}
function targetFromPoint(x, y) {
  const e = document.elementFromPoint(x, y);
  return e?.closest("[data-zone]") || null;
}
function payloadGroup(p) {
  return { cards: p.groups.flatMap((g) => g.cards), faceUp: true };
}
function canDropTo(p, zone, idx) {
  const moving = payloadGroup(p),
    cc = categoryCard(moving);
  if (zone === "slot") {
    if (state.special?.lockedSlot && idx === state.slots.length - 1 && state.completed < (state.special.unlockAfter || 1)) return false;
    const dest = state.slots[idx];
    if (!dest) return !!cc;
    return canMerge(dest, moving) && !!categoryCard(dest);
  }
  if (zone === "column") {
    if (cc) return false;
    const col = state.columns[idx];
    if (p.source === "column" && p.ci === idx) return false;
    if (!col.length) return true;
    const last = col[col.length - 1];
    return last.faceUp && canMerge(last, moving);
  }
  return false;
}
function canDrop(p, target) {
  return !!target && canDropTo(p, target.dataset.zone, +target.dataset.index);
}
function isProductiveDrop(p, zone, idx) {
  if (zone === "slot") return true;
  if (zone !== "column") return false;
  const dest = state.columns[idx];
  if (dest.length) return canMerge(dest[dest.length - 1], payloadGroup(p));
  if (p.source !== "column") return false;
  return p.start > 0; // moving to empty column matters only when it exposes a hidden card.
}
function detachPayload(p) {
  if (p.source === "column") {
    const col = state.columns[p.ci],
      start = firstOpenIndex(col),
      groups = col.slice(start);
    col.splice(start);
    revealLast(col);
    return groups;
  }
  if (p.source === "waste") return [{ cards: [state.waste.pop()], faceUp: true }];
  if (p.source === "slot") {
    const g = state.slots[p.si];
    state.slots[p.si] = null;
    return [g];
  }
  return [];
}
function slotIsComplete(i) {
  const g = state.slots[i],
    cc = g && categoryCard(g);
  return !!(cc && wordCount(g) === cc.total);
}
async function finalizeCompletedSlot(i) {
  const before = state.slots[i],
    cc = before && categoryCard(before);
  if (!cc || !slotIsComplete(i)) {
    categoryAnimating = false;
    return;
  }
  await animateCategoryCompletion(i, cc.label);
  const current = state.slots[i],
    currentCc = current && categoryCard(current);
  if (!currentCc || currentCc.cat !== cc.cat || !slotIsComplete(i)) {
    categoryAnimating = false;
    return;
  }
  state.slots[i] = null;
  state.completed++;
  if (state.mode !== "tutorial") {
    profile.stats.categoriesCompleted++;
    if (typeof recordCategoryCompletion === "function") recordCategoryCompletion(cc.cat);
    if (!String(cc.cat).startsWith("visual:") && !profile.discovered.includes(cc.cat)) profile.discovered.push(cc.cat);
    track("category_completed", { category: cc.cat, mode: state.mode, collectionId: state.collectionId || null });
    checkAchievements();
  }
  showToast(`✓ Категория «${cc.label}» собрана!`);
  categoryAnimating = false;
  render();
  markStateChanged();
}
function performDrop(p, target, options = {}) {
  if (!canDrop(p, target) || categoryAnimating) return false;
  const zone = target.dataset.zone,
    idx = +target.dataset.index,
    productive = isProductiveDrop(p, zone, idx);
  pushHistory();
  const groups = detachPayload(p),
    moving = { cards: groups.flatMap((g) => g.cards), faceUp: true };
  if (zone === "slot") {
    if (state.slots[idx]) state.slots[idx].cards.push(...moving.cards);
    else state.slots[idx] = moving;
  } else {
    const col = state.columns[idx];
    if (col.length) col[col.length - 1].cards.push(...moving.cards);
    else col.push(moving);
  }
  state.run.moves++;
  if (typeof checkActiveRuleFailure === "function" && checkActiveRuleFailure()) return true;
  if (options.comboEligible) {
    if (productive) registerCombo(true, options.comboSource || "manual");
    else resetCombo();
  } else resetCombo();
  playSfx("drop");
  haptic(9);
  render();
  if (zone === "slot" && slotIsComplete(idx)) {
    categoryAnimating = true;
    setTimeout(() => finalizeCompletedSlot(idx), 35);
  } else markStateChanged();
  return true;
}

function maxStockRecycles() {
  const specialLimit = state?.special?.maxRecycles, ruleLimit = state?.rules?.maxRecycles;
  const limits = [specialLimit, ruleLimit].filter(Number.isFinite);
  return limits.length ? Math.min(...limits) : Infinity;
}
function canRecycleStock() {
  return !!state?.waste?.length && (state.run?.recycles || 0) < maxStockRecycles();
}
function currentMovePayloads() {
  const payloads = [];
  state.columns.forEach((col, ci) => {
    const start = firstOpenIndex(col);
    if (start < col.length) payloads.push({ source: "column", ci, start, groups: col.slice(start) });
  });
  if (state.waste.length)
    payloads.push({ source: "waste", groups: [{ cards: [state.waste.at(-1)], faceUp: true }] });
  return payloads;
}
function findUsefulBoardMove() {
  const payloads = currentMovePayloads();
  const zones = [
    ...state.slots.map((_, index) => ({ zone: "slot", index })),
    ...state.columns.map((_, index) => ({ zone: "column", index })),
  ];
  for (const p of payloads) {
    // Category slots and same-category merges are more useful than temporary empty-column moves.
    const ranked = zones.slice().sort((a, b) => (a.zone === "slot" ? -1 : 1) - (b.zone === "slot" ? -1 : 1));
    for (const t of ranked)
      if (canDropTo(p, t.zone, t.index) && isProductiveDrop(p, t.zone, t.index)) return { payload: p, ...t };
  }
  return null;
}
function accessibleReserveCards() {
  const out = [...state.stock];
  if (canRecycleStock()) out.push(...state.waste);
  else if (state.waste.length) out.push(state.waste.at(-1));
  return out;
}
function reserveHasFutureMove() {
  const reserve = accessibleReserveCards();
  if (!reserve.length) return false;
  const freeSlot = state.slots.some((g) => !g),
    activeCats = new Set(state.slots.filter(Boolean).map(catOfGroup));
  return reserve.some((c) => (c.type === "category" ? freeSlot : activeCats.has(c.cat)));
}
function isDeadlockedState() {
  if (!state || state.rewarded || state.completed >= state.totalCategories) return false;
  if (findUsefulBoardMove()) return false;
  if (reserveHasFutureMove()) return false;
  return true;
}
function findHintMove() {
  const board = findUsefulBoardMove();
  if (board) return board;
  if (state.stock.length) return { action: "draw" };
  if (canRecycleStock()) return { action: "recycle" };
  return null;
}
