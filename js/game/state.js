/* Game state lifecycle, history and persistence. */
function makeLevel(level = 1, opts = {}) {
  dealAnimationToken++;
  resetCombo();
  hideDeadlock();
  lastDeadlockSignature = "";
  dealAnimating = false;
  stockEl?.classList.remove("deal-pulse");
  try {
    state = opts.mode === "tutorial" ? makeTutorial(opts.step || 1) : buildGeneratedLevel(level, opts);
  } catch (error) {
    console.error("level generation failed", error);
    showToast?.("Не удалось создать расклад. Попробуй ещё раз");
    openHub?.("modes");
    return false;
  }
  if (state?.mode !== "tutorial" && !isPlayableGeneratedState(state)) {
    console.error("invalid generated level blocked", { mode: state?.mode, seed: state?.seed, totalCategories: state?.totalCategories });
    showToast?.("Повреждённый расклад не был засчитан");
    openHub?.("modes");
    return false;
  }
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
  // Commit a new round synchronously. On iOS the tab can be killed before the
  // normal debounced render save gets a chance to run.
  save?.({ immediate: true });
  updateCoach();
  setBackgroundMusic?.(musicModeForState?.(state) || "game");
  if (needsSpecialIntro && typeof showSpecialLevelIntro === "function") {
    showSpecialLevelIntro(state.special, () => {
      initialDealPending = true;
      render();
      save?.({ immediate: true });
      setTimeout(() => scheduleDeadlockCheck(900), 250);
    });
  } else {
    setTimeout(() => scheduleDeadlockCheck(900), 250);
    if (state.mode !== "tutorial") setTimeout(() => showCompanionBubble?.(companionStartLine?.(), 3600), 620);
  }
}
function restartCurrentLevel() {
  if (!state) return;
  if (state.mode === "tutorial") return makeLevel(state.tutorialStep, { mode: "tutorial", step: state.tutorialStep });
  if (state.mode === "challenge") return makeLevel(state.level, { mode: "challenge", seed: state.seed, challengeCode: state.challengeCode, challengeRole: state.challengeRole, challengeCreatorName: state.challengeCreatorName, challengeCreatorAvatar: state.challengeCreatorAvatar, challengeCreatorResult: state.challengeCreatorResult, challengeGuestToken: state.challengeGuestToken, duelMode: state.duelMode, duelModeChoice: state.duelModeChoice, seriesId: state.seriesId, seriesRound: state.seriesRound, seriesScoreCreator: state.seriesScoreCreator, seriesScoreGuest: state.seriesScoreGuest, cardSourceMode: state.cardSourceMode });
  const reshuffled = typeof reshuffleStateFromBlueprint === "function" ? reshuffleStateFromBlueprint(state) : null;
  if (reshuffled) {
    state = reshuffled; history = []; resetCombo(); initialDealPending = true; recordLevelKnowledge?.(state); render(); updateCoach(); setBackgroundMusic?.(musicModeForState?.(state)||"game"); markStateChanged?.(); save?.({ immediate:true });
    setTimeout(()=>showCompanionBubble?.(companionStartLine?.(),3200),520);
    return true;
  }
  return makeLevel(state.level, { mode: state.mode, seed: `${state.seed}:retry:${Date.now()}`, cardSourceMode: state.cardSourceMode, categoryCooldownIds: state.categoryCooldownIds, specialIntro: false, customRules: state.customRules || null, forceSolvable: true });
}
const MAX_UNDO_SNAPSHOTS = 10;
const IOS_UNDO_SNAPSHOTS = 4;
let stateSaveTimer = null, lastPersistedStateJson = "", lastBackupAt = 0;
function snapshot() {
  try { return JSON.stringify(state); } catch { return null; }
}
function restoreHistorySnapshot(value) {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return normalizeState(parsed);
  } catch { return null; }
}
function pushHistory() {
  const snap = snapshot();
  if (!snap) return;
  history.push(snap);
  const limit = typeof stabilityConstrainedMode === "function" && stabilityConstrainedMode() ? IOS_UNDO_SNAPSHOTS : MAX_UNDO_SNAPSHOTS;
  if (history.length > limit) history.splice(0, history.length - limit);
}
function persistStateNow() {
  clearTimeout(stateSaveTimer);
  stateSaveTimer = null;
  try {
    if (state) {
      const json = JSON.stringify(state);
      if (json !== lastPersistedStateJson) {
        const now = Date.now();
        if (lastPersistedStateJson && now - lastBackupAt > 15000) {
          try { localStorage.setItem(SAVE_BACKUP_KEY, lastPersistedStateJson); lastBackupAt = now; } catch {}
        }
        try { localStorage.setItem(SAVE_KEY, json); }
        catch (error) {
          try { localStorage.removeItem(SAVE_BACKUP_KEY); localStorage.setItem(SAVE_KEY, json); }
          catch { throw error; }
        }
        lastPersistedStateJson = json;
        checkpointStabilityRuntime?.();
      }
    }
    return true;
  } catch (err) {
    console.warn("save failed", err);
    return false;
  }
}
function save(options = {}) {
  const immediate = options === true || options?.immediate === true;
  if (immediate) return persistStateNow();
  clearTimeout(stateSaveTimer);
  const delay = typeof stabilityConstrainedMode === "function" && stabilityConstrainedMode() ? 110 : 220;
  stateSaveTimer = setTimeout(persistStateNow, delay);
  return true;
}
function scheduleSave() { return save(); }
function flushSave() { return persistStateNow(); }
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
function savedRoundAlreadyCompleted(s) {
  return !!s && s.mode === "regular" && (
    s.rewarded === true ||
    (Number(s.totalCategories) > 0 && Number(s.completed) >= Number(s.totalCategories))
  );
}
function clearCompletedSavedRound() {
  try { localStorage.removeItem(SAVE_KEY); } catch {}
  try { localStorage.removeItem(SAVE_BACKUP_KEY); } catch {}
  lastPersistedStateJson = "";
  lastBackupAt = 0;
}
function load({ render: shouldRender = true } = {}) {
  for (const key of [SAVE_KEY, SAVE_BACKUP_KEY]) {
    try {
      const raw = localStorage.getItem(key);
      const s = JSON.parse(raw);
      if (savedRoundAlreadyCompleted(s)) {
        // Never reopen a regular round that has already been rewarded. This was
        // the source of the "вернулся в уровень, а он уже пройден" state.
        clearCompletedSavedRound();
        break;
      }
      if (s?.columns) {
        lastPersistedStateJson = key === SAVE_KEY ? raw : "";
        const restored = normalizeLoadedLayout(s); state = restored.state;
        if (state.mode === "marathon" && state.rewarded && state.marathonSuccess) {
          const nextRound = (state.marathonRound || 1) + 1, runId = state.marathonId || `marathon:${Date.now().toString(36)}`;
          makeLevel(nextRound, { mode:"marathon", seed:`${runId}:${nextRound}`, marathonRound:nextRound, marathonId:runId });
          return true;
        }
        if (typeof assignBonusObjective === "function") assignBonusObjective(state);
        if (shouldRender) { render(); updateCoach(); }
        if (shouldRender && restored.repairedInvalidState) setTimeout(() => showToast("Сломанный расклад восстановлен без награды"), 120);
        else if (shouldRender && restored.migrated) setTimeout(() => showToast("Расклад адаптирован под 5 колонок"), 120);
        return true;
      }
    } catch {}
  }
  try {
    const s = JSON.parse(localStorage.getItem(OLD_SAVE_KEY));
    if (savedRoundAlreadyCompleted(s)) {
      try { localStorage.removeItem(OLD_SAVE_KEY); } catch {}
    } else if (s?.columns) {
      profile.tutorialComplete = true;
      const restored = normalizeLoadedLayout(s);
      state = restored.state;
      if (typeof assignBonusObjective === "function") assignBonusObjective(state);
      saveProfile();
      if (shouldRender) { render(); updateCoach(); }
      if (shouldRender && restored.repairedInvalidState) setTimeout(() => showToast("Сломанный расклад восстановлен без награды"), 120);
      else if (shouldRender && restored.migrated) setTimeout(() => showToast("Расклад адаптирован под 5 колонок"), 120);
      return true;
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
  return !!(a && b && globalThis.relationRuleEngine?.canRelate(a, b, { purpose: "gameplay-merge", state }));
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
