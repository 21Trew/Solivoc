/* Game state lifecycle, history and persistence. */
function makeLevel(level = 1, opts = {}) {
  dealAnimationToken++;
  resetCombo();
  hideDeadlock();
  lastDeadlockSignature = "";
  dealAnimating = false;
  stockEl?.classList.remove("deal-pulse");
  state = opts.mode === "tutorial" ? makeTutorial(opts.step || 1) : buildGeneratedLevel(level, opts);
  if (state?.mode === "marathon") {
    profile.activeMarathon = { level: state.level, seed: state.seed, marathonRound: state.marathonRound || 1, marathonId: state.marathonId, cardSourceMode: state.cardSourceMode };
    saveProfile();
  }
  if (typeof assignBonusObjective === "function") assignBonusObjective(state);
  history = [];
  if (typeof recordLevelKnowledge === "function") recordLevelKnowledge(state);
  const needsSpecialIntro = state.mode === "regular" && !!state.special && opts.specialIntro !== false;
  initialDealPending = !needsSpecialIntro;
  if (state.mode === "regular") rememberCategories(state.categoryIds);
  track("level_started", { level: state.level, mode: state.mode, seed: state.seed, special: state.special?.id || "" });
  render();
  updateCoach();
  setBackgroundMusic?.(musicModeForState?.(state) || "game");
  if (needsSpecialIntro && typeof showSpecialLevelIntro === "function") {
    showSpecialLevelIntro(state.special, () => {
      initialDealPending = true;
      render();
      setTimeout(() => scheduleDeadlockCheck(900), 250);
    });
  } else {
    setTimeout(() => scheduleDeadlockCheck(900), 250);
  }
}
function restartCurrentLevel() {
  if (!state) return;
  if (state.mode === "tutorial") return makeLevel(state.tutorialStep, { mode: "tutorial", step: state.tutorialStep });
  if (state.mode === "challenge") return makeLevel(state.level, { mode: "challenge", seed: state.seed, challengeCode: state.challengeCode, challengeRole: state.challengeRole, challengeCreatorName: state.challengeCreatorName, challengeCreatorAvatar: state.challengeCreatorAvatar, challengeCreatorResult: state.challengeCreatorResult, challengeGuestToken: state.challengeGuestToken, duelMode: state.duelMode, duelModeChoice: state.duelModeChoice, seriesId: state.seriesId, seriesRound: state.seriesRound, seriesScoreCreator: state.seriesScoreCreator, seriesScoreGuest: state.seriesScoreGuest, cardSourceMode: state.cardSourceMode });
  if (state.mode === "marathon") return makeLevel(state.level, { mode: "marathon", seed: state.seed, marathonRound: state.marathonRound, marathonId: state.marathonId, cardSourceMode: state.cardSourceMode });
  if (state.mode === "calm") return makeLevel(state.level || 1, { mode: "calm", seed: state.seed, cardSourceMode: state.cardSourceMode });
  if (state.mode === "collection") return makeLevel(state.level || 1, { mode: "collection", seed: state.seed, collectionId: state.collectionId });
  if (state.mode === "regular" && state.riskDeal) return makeLevel(state.level, { mode: "regular", seed: `level:${state.level}:retry:${Date.now()}`, cardSourceMode: state.cardSourceMode, categoryCooldownIds: state.categoryCooldownIds, specialIntro: false, forceSolvable: true });
  return makeLevel(state.level, { mode: state.mode, seed: state.seed, cardSourceMode: state.cardSourceMode, categoryCooldownIds: state.categoryCooldownIds, specialIntro: false });
}
function snapshot() {
  return structuredClone(state);
}
function pushHistory() {
  history.push(snapshot());
  if (history.length > 80) history.shift();
}
function save() {
  try {
    if (state) {
      const current = localStorage.getItem(SAVE_KEY);
      if (current) localStorage.setItem(SAVE_BACKUP_KEY, current);
      localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    }
    saveProfile();
  } catch (err) { console.warn("save failed", err); }
}
function activeRunElapsedMs(s = state) {
  if (!s?.run?.startedAt) return 0;
  const end = s.run.pausedAt || Date.now();
  return Math.max(0, end - s.run.startedAt - (+s.run.pausedDurationMs || 0));
}
function pauseActiveRun() {
  if (state?.run && !state.run.pausedAt && !state.rewarded) state.run.pausedAt = Date.now();
}
function resumeActiveRun() {
  if (state?.run?.pausedAt) { state.run.pausedDurationMs = (+state.run.pausedDurationMs || 0) + Math.max(0, Date.now() - state.run.pausedAt); state.run.pausedAt = 0; }
}
function load({ render: shouldRender = true } = {}) {
  for (const key of [SAVE_KEY, SAVE_BACKUP_KEY]) {
    try {
      const s = JSON.parse(localStorage.getItem(key));
      if (s?.columns) {
        const restored = normalizeLoadedLayout(s); state = restored.state;
        if (state.mode === "marathon" && state.rewarded && state.marathonSuccess) {
          const nextRound = (state.marathonRound || 1) + 1, runId = state.marathonId || `marathon:${Date.now().toString(36)}`;
          makeLevel(nextRound, { mode:"marathon", seed:`${runId}:${nextRound}`, marathonRound:nextRound, marathonId:runId });
          return true;
        }
        if (typeof assignBonusObjective === "function") assignBonusObjective(state);
        if (shouldRender) { render(); updateCoach(); }
        if (shouldRender && restored.migrated) setTimeout(() => showToast("Расклад адаптирован под 5 колонок"), 120);
        return true;
      }
    } catch {}
  }
  try {
    const s = JSON.parse(localStorage.getItem(OLD_SAVE_KEY));
    if (s?.columns) {
      profile.tutorialComplete = true;
      const restored = normalizeLoadedLayout(s);
      state = restored.state;
      if (typeof assignBonusObjective === "function") assignBonusObjective(state);
      saveProfile();
      if (shouldRender) { render(); updateCoach(); }
      if (shouldRender && restored.migrated) setTimeout(() => showToast("Расклад адаптирован под 5 колонок"), 120);
      return;
    }
  } catch {}
  if (profile.activeMarathon?.marathonId) {
    const m = profile.activeMarathon;
    makeLevel(m.level || m.marathonRound || 1, { mode:"marathon", seed:m.seed || `${m.marathonId}:${m.marathonRound || 1}`, marathonRound:m.marathonRound || 1, marathonId:m.marathonId, cardSourceMode:m.cardSourceMode });
    return true;
  }
  if (!shouldRender) { state = null; return false; }
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
