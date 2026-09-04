/* UI-facing game rules facade. Pure validation and mutations live in GameEngine. */
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
  if (source === "slot") return null;
  return null;
}
function targetFromPoint(x, y) {
  const e = document.elementFromPoint(x, y);
  return e?.closest("[data-zone]") || null;
}
function payloadGroup(p) {
  return SolivocGameEngine.payloadGroup(p);
}
function canDropTo(p, zone, idx) {
  return SolivocGameEngine.canDropTo(state, p, zone, idx);
}
function canDrop(p, target) {
  return !!target && canDropTo(p, target.dataset.zone, +target.dataset.index);
}
function isProductiveDrop(p, zone, idx) {
  return SolivocGameEngine.isProductiveDrop(state, p, zone, idx);
}
function slotIsComplete(i) {
  return SolivocGameEngine.slotIsComplete(state, i);
}
async function finalizeCompletedSlot(i) {
  const before = state.slots[i], cc = before && categoryCard(before);
  if (!cc || !slotIsComplete(i)) { categoryAnimating = false; return; }
  await animateCategoryCompletion(i, cc.label);
  const current = state.slots[i], currentCc = current && categoryCard(current);
  if (!currentCc || currentCc.cat !== cc.cat || !slotIsComplete(i)) { categoryAnimating = false; return; }
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
  save?.({ immediate: true });
  markStateChanged();
}
function performDrop(p, target, options = {}) {
  if (!target || categoryAnimating) return false;
  const zone = target.dataset.zone, idx = +target.dataset.index;
  if (!canDropTo(p, zone, idx)) return false;
  pushHistory();
  const result = SolivocGameController.dispatch({
    type: SolivocGameEngine.COMMAND.MOVE_CARD,
    source: p.source === "column"
      ? { zone: "column", index: p.ci, start: p.start }
      : p.source === "slot"
        ? { zone: "slot", index: p.si }
        : { zone: "waste" },
    target: { zone, index: idx },
  });
  if (!result.accepted) {
    history.pop();
    return false;
  }
  const moveEffect = SolivocGameController.effect(result, "MOVE_APPLIED");
  const revealEffect = SolivocGameController.effect(result, "CARD_REVEALED");
  if (revealEffect?.uid) pendingRevealUid = revealEffect.uid;
  if (state.mode === "tutorial") {
    const manual = (options.comboSource || "manual") !== "auto";
    if (zone === "slot" && moveEffect?.categoryCard) noteTutorialAction?.("category");
    else if (manual) noteTutorialAction?.("manual");
  }
  if (typeof checkActiveRuleFailure === "function" && checkActiveRuleFailure()) return true;
  if (options.comboEligible && moveEffect?.productive) registerCombo(true, options.comboSource || "manual");
  playSfx("drop");
  haptic(9);
  save?.({ immediate: true });
  render();
  const completeEffect = SolivocGameController.effect(result, "SLOT_COMPLETED");
  if (completeEffect) {
    categoryAnimating = true;
    setTimeout(() => finalizeCompletedSlot(completeEffect.slotIndex), 35);
  } else markStateChanged();
  return true;
}

function maxStockRecycles() {
  const specialLimit = state?.special?.maxRecycles, ruleLimit = state?.rules?.maxRecycles;
  const limits = [specialLimit, ruleLimit].filter(Number.isFinite);
  return limits.length ? Math.min(...limits) : Infinity;
}
function canRecycleStock() {
  return SolivocGameEngine.canRecycleStock(state);
}
function findUsefulBoardMove() {
  return SolivocGameEngine.findUsefulBoardMove(state);
}
function isDeadlockedState() {
  return SolivocGameEngine.isDeadlocked(state);
}
function findHintMove() {
  return SolivocGameEngine.findHint(state);
}