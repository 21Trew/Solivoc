/* Main board renderer and stock interaction. */
function render() {
  document.documentElement.style.setProperty("--cols", state.cols);
  document.documentElement.dataset.cols = String(state.cols);
  tableau.innerHTML = "";
  slotsAnchor.innerHTML = "";
  const step = stackStep();
  state.slots.forEach((g, i) => {
    const slot = document.createElement("div");
    slot.className = "slot " + (g ? "" : "empty");
    slot.dataset.zone = "slot";
    slot.dataset.index = i;
    if (g) {
      const card = cardNode(g, "movable");
      card.dataset.source = "slot";
      card.dataset.index = i;
      slot.appendChild(card);
    }
    slotsAnchor.appendChild(slot);
  });
  stockEl.innerHTML = "";
  stockEl.className = "stock " + (state.stock.length ? "" : "empty");
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
  const left =
    state.stock.length +
    state.waste.length +
    state.columns.reduce((n, c) => n + c.reduce((m, g) => m + g.cards.length, 0), 0) +
    state.slots.reduce((n, g) => n + (g ? g.cards.length : 0), 0);
  fitAllCardText();
  $("#level").textContent =
    state.mode === "daily" ? "D" : state.mode === "tutorial" ? `T${state.tutorialStep}` : state.level;
  $("#left").textContent = left;
  $("#progressText").textContent = `${state.completed}/${state.totalCategories}`;
  $("#progressBar").style.width = (state.completed / state.totalCategories) * 100 + "%";
  $("#starTotal").textContent = profile.totalStars;
  $("#undo").disabled = !history.length;
  save();
  queuePostRenderCardAnimations();
  if (state.completed === state.totalCategories && !state.rewarded) finishLevel();
}
function drawStock() {
  if (autoMoveBusy || dealAnimating) return;
  pushHistory();
  if (state.stock.length) {
    const next = state.stock[state.stock.length - 1],
      from = stockEl.getBoundingClientRect();
    pendingStockDraw = {
      uid: next?.uid || null,
      from: { left: from.left, top: from.top, width: from.width, height: from.height },
    };
    state.waste.push(state.stock.pop());
  } else if (state.waste.length) {
    state.stock = state.waste.reverse();
    state.waste = [];
    pendingRecycle = true;
  } else {
    history.pop();
    return;
  }
  state.run.moves++;
  profile.stats.stockDraws++;
  track("stock_draw", { mode: state.mode });
  haptic(7);
  render();
}
stockEl.addEventListener("click", () => {
  if (!drag) drawStock();
});
