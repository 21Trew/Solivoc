/* Card DOM creation, text fitting and stack geometry. */
function cardNode(g, extra = "") {
  const card = document.createElement("div"),
    cc = categoryCard(g);
  card.className = `card ${extra}${cc ? " category" : ""}`.trim();
  const displayCard = cc || g.cards?.[0];
  if (displayCard?.uid) card.dataset.uid = displayCard.uid;
  if (cc) {
    card.style.setProperty("--cat-hue", catHue(cc.cat));
    card.innerHTML = `<span class="name ${String(cc.label).length <= 6 ? "short-title" : "long-title"}">${cc.label}</span><span class="count">${wordCount(g)}/${cc.total}</span>`;
  } else card.textContent = g.cards[0].label;
  card.title = g.cards.map((c) => c.label).join(", ");
  return card;
}
function fitText(el, min = 6, max = 10) {
  if (!el) return;
  let size = max;
  el.style.fontSize = size + "px";
  while (size > min && (el.scrollHeight > el.clientHeight || el.scrollWidth > el.clientWidth)) {
    size -= 0.5;
    el.style.fontSize = size + "px";
  }
}
function fitAllCardText(root = document) {
  const probe = root.querySelector?.(".card,.drag-main") || document.querySelector(".card"),
    cw = probe?.getBoundingClientRect().width || 54;
  let wordMin = 10,
    wordMax = 14,
    shortMin = 10,
    shortMax = 13,
    longMin = 8.5,
    longMax = 12;
  if (cw >= 88) {
    wordMin = 13;
    wordMax = 18;
    shortMin = 13;
    shortMax = 17;
    longMin = 10.5;
    longMax = 15.5;
  } else if (cw >= 72) {
    wordMin = 11.5;
    wordMax = 16;
    shortMin = 11.5;
    shortMax = 15;
    longMin = 9.5;
    longMax = 13.5;
  }
  root
    .querySelectorAll(".card:not(.face-down):not(.category), .drag-main:not(.category)")
    .forEach((el) => fitText(el, wordMin, wordMax));
  root.querySelectorAll(".card.category .name.short-title").forEach((el) => fitText(el, shortMin, shortMax));
  root
    .querySelectorAll(".card.category .name.long-title, .drag-main.category span:first-child")
    .forEach((el) => fitText(el, longMin, longMax));
}
function stackStep() {
  return parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--stack-step")) || 22;
}
function colY(col, index, step = stackStep()) {
  let y = 0;
  for (let i = 0; i < index; i++) y += Math.max(1, col[i].faceUp ? col[i].cards.length : 1) * step;
  return y;
}

/* Keep every tableau stack inside the fixed game viewport.
   CSS defines the preferred card size; this only shrinks geometry when a real
   column would otherwise cross the lower board edge. */
function resetTableauGeometryFit() {
  const root = document.documentElement;
  root.style.removeProperty("--cw");
  root.style.removeProperty("--stack-step");
  delete root.dataset.stackFit;
}
function visualUnitsInColumn(col) {
  return Math.max(1, col.reduce((sum, g) => sum + Math.max(1, g.faceUp ? g.cards.length : 1), 0));
}
function fitTableauGeometry() {
  resetTableauGeometryFit();
  if (!state?.columns?.length || !tableau) return;

  const root = document.documentElement,
    cs = getComputedStyle(root),
    baseCw = parseFloat(cs.getPropertyValue("--cw")) || 64,
    baseCh = parseFloat(cs.getPropertyValue("--ch")) || baseCw * 1.54,
    baseStep = parseFloat(cs.getPropertyValue("--stack-step")) || 24,
    ratio = baseCh / baseCw || 1.54,
    available = Math.max(120, tableau.clientHeight - 6),
    units = Math.max(...state.columns.map(visualUnitsInColumn)),
    required = baseCh + Math.max(0, units - 1) * baseStep;

  if (required <= available) return;

  const minCwByCols = { 3: 54, 4: 52, 5: 47 },
    minStepByCols = { 3: 15, 4: 15, 5: 14 },
    minCw = Math.min(baseCw, minCwByCols[state.cols] || 50),
    minStep = minStepByCols[state.cols] || 16;

  let cw = Math.min(baseCw, (available - Math.max(0, units - 1) * baseStep) / ratio);
  cw = Math.max(minCw, cw);
  let step = baseStep;

  if (baseCh * (cw / baseCw) + Math.max(0, units - 1) * step > available && units > 1) {
    step = Math.min(baseStep, (available - cw * ratio) / (units - 1));
    step = Math.max(minStep, step);
  }

  if (cw * ratio + Math.max(0, units - 1) * step > available) {
    cw = Math.max(42, Math.min(cw, (available - Math.max(0, units - 1) * step) / ratio));
  }
  if (cw * ratio + Math.max(0, units - 1) * step > available && units > 1) {
    step = Math.max(14, (available - cw * ratio) / (units - 1));
  }

  root.style.setProperty("--cw", `${Math.max(46, cw).toFixed(2)}px`);
  root.style.setProperty("--stack-step", `${Math.max(12, step).toFixed(2)}px`);
  root.dataset.stackFit = step < 19 ? "tight" : "compact";
}

