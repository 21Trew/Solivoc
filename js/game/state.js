/* Game state lifecycle, history and persistence. */
function makeLevel(level = 1, opts = {}) {
  dealAnimationToken++;
  dealAnimating = false;
  stockEl?.classList.remove("deal-pulse");
  state = opts.mode === "tutorial" ? makeTutorial(opts.step || 1) : buildGeneratedLevel(level, opts);
  history = [];
  initialDealPending = true;
  if (state.mode === "regular") rememberCategories(state.categoryIds);
  track("level_started", { level: state.level, mode: state.mode, seed: state.seed });
  render();
  updateCoach();
}
function snapshot() {
  return structuredClone(state);
}
function pushHistory() {
  history.push(snapshot());
  if (history.length > 80) history.shift();
}
function save() {
  if (state) localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  saveProfile();
}
function load() {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (s?.columns) {
      const restored = normalizeLoadedLayout(s);
      state = restored.state;
      render();
      updateCoach();
      if (restored.migrated) setTimeout(() => showToast("Расклад адаптирован под 5 колонок"), 120);
      return;
    }
  } catch {}
  try {
    const s = JSON.parse(localStorage.getItem(OLD_SAVE_KEY));
    if (s?.columns) {
      profile.tutorialComplete = true;
      const restored = normalizeLoadedLayout(s);
      state = restored.state;
      saveProfile();
      render();
      updateCoach();
      if (restored.migrated) setTimeout(() => showToast("Расклад адаптирован под 5 колонок"), 120);
      return;
    }
  } catch {}
  if (!profile.tutorialComplete) makeLevel(1, { mode: "tutorial", step: 1 });
  else makeLevel(profile.currentLevel || 1);
}

function catOfGroup(g) {
  return g.cards[0].cat;
}
function categoryCard(g) {
  return g.cards.find((c) => c.type === "category");
}
function wordCount(g) {
  return g.cards.filter((c) => c.type === "word").length;
}
function groupLabel(g) {
  const cc = categoryCard(g);
  return cc ? `${cc.label} ${wordCount(g)}/${cc.total}` : g.cards[0].label;
}
function canMerge(a, b) {
  return a && b && catOfGroup(a) === catOfGroup(b);
}
function firstOpenIndex(col) {
  const i = col.findIndex((g) => g.faceUp);
  return i < 0 ? col.length : i;
}
function revealLast(col) {
  if (col.length && !col[col.length - 1].faceUp) {
    col[col.length - 1].faceUp = true;
    pendingRevealUid = col[col.length - 1].cards?.[0]?.uid || null;
    return pendingRevealUid;
  }
  return null;
}
