/* Board rendering facade and stock interaction. GameRenderer owns DOM paint. */
function render() {
  return SolivocGameRenderer.renderBoard();
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
  SolivocGameRenderer.paint(result);
  markStateChanged();
}

stockEl.addEventListener("click", () => {
  if (!drag) drawStock();
});
