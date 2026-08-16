/* Card DOM creation, text fitting and stack geometry. */
function cardNode(g, extra = "") {
  const card = document.createElement("div"),
    cc = categoryCard(g);
  card.className = `card ${extra}${cc ? " category" : ""}`.trim();
  const displayCard = cc || g.cards?.[0];
  if (displayCard?.uid) card.dataset.uid = displayCard.uid;
  if (cc) {
    card.style.setProperty("--cat-hue", catHue(cc.cat));
    const mystery = !!state?.special?.mysteryCategories && wordCount(g) === 0, label = mystery ? "???" : cc.label;
    card.classList.toggle("mystery-category", mystery);
    card.innerHTML = `<span class="name ${String(label).length <= 6 ? "short-title" : "long-title"}">${label}</span><span class="count">${wordCount(g)}/${cc.total}</span>`;
  } else {
    const single = g.cards[0];
    card.classList.add("word-card");
    if (single.visual) {
      card.classList.add("visual-association-card");
      const art = document.createElement("span");
      art.className = "visual-association-emoji";
      art.textContent = single.label;
      art.setAttribute("role", "img");
      art.setAttribute("aria-label", single.visualAlt || "Картинка-ассоциация");
      card.append(art);
    } else card.textContent = single.label;
  }
  card.title = g.cards.map((c) => c.visualAlt || c.label).join(", ");
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

/* Card geometry is deliberately stable for the whole round.
   Long columns use the fixed cascade step instead of resizing the cards at runtime. */
function resetTableauGeometryFit() {
  const root = document.documentElement;
  root.style.removeProperty("--ch");
  root.style.removeProperty("--stack-step");
  delete root.dataset.stackFit;
}
function visualUnitsInColumn(col) {
  return Math.max(1, col.reduce((sum, g) => sum + Math.max(1, g.faceUp ? g.cards.length : 1), 0));
}
function fitTableauGeometry() {
  resetTableauGeometryFit();
}

