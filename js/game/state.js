/* Game state lifecycle, history and persistence. */
function makeLevel(level = 1, opts = {}) {
  dealAnimationToken++;
  resetCombo();
  hideDeadlock();
  lastDeadlockSignature = "";
  dealAnimating = false;
  stockEl?.classList.remove("deal-pulse");
  state = opts.mode === "tutorial" ? makeTutorial(opts.step || 1) : buildGeneratedLevel(level, opts);
  if (typeof assignBonusObjective === "function") assignBonusObjective(state);
  history = [];
  if (typeof recordLevelKnowledge === "function") recordLevelKnowledge(state);
  initialDealPending = true;
  if (state.mode === "regular") rememberCategories(state.categoryIds);
  track("level_started", { level: state.level, mode: state.mode, seed: state.seed });
  render();
  updateCoach();
  if (state.mode === "regular" && state.special)
    setTimeout(() => {
      showToast(`${state.special.icon} ${state.special.title}: ${state.special.desc}`);
      playSfx("combo", 0.65);
    }, 850);
  setTimeout(() => scheduleDeadlockCheck(900), 250);
}
function restartCurrentLevel() {
  if (!state) return;
  if (state.mode === "tutorial") return makeLevel(state.tutorialStep, { mode: "tutorial", step: state.tutorialStep });
  if (state.mode === "challenge") return makeLevel(state.level, { mode: "challenge", seed: state.seed, challengeCode: state.challengeCode, challengeRole: state.challengeRole, challengeCreatorName: state.challengeCreatorName, challengeCreatorAvatar: state.challengeCreatorAvatar, challengeCreatorResult: state.challengeCreatorResult, challengeGuestToken: state.challengeGuestToken, seriesId: state.seriesId, seriesRound: state.seriesRound, seriesScoreCreator: state.seriesScoreCreator, seriesScoreGuest: state.seriesScoreGuest, cardSourceMode: state.cardSourceMode });
  if (state.mode === "marathon") return makeLevel(state.level, { mode: "marathon", seed: state.seed, marathonRound: state.marathonRound, marathonId: state.marathonId, cardSourceMode: state.cardSourceMode });
  if (state.mode === "calm") return makeLevel(state.level || 1, { mode: "calm", seed: state.seed, cardSourceMode: state.cardSourceMode });
  if (state.mode === "collection") return makeLevel(state.level || 1, { mode: "collection", seed: state.seed, collectionId: state.collectionId });
  return makeLevel(state.level, { mode: state.mode, seed: state.seed, cardSourceMode: state.cardSourceMode });
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
      if (typeof assignBonusObjective === "function") assignBonusObjective(state);
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
      if (typeof assignBonusObjective === "function") assignBonusObjective(state);
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
