/* iOS round stability v2: reduce synchronous work during active gameplay. */
(() => {
  if (window.__solivocIosRoundStabilityV2) return;
  window.__solivocIosRoundStabilityV2 = true;

  const constrained = () => typeof stabilityConstrainedMode === "function" && stabilityConstrainedMode();
  let renderDepth = 0;
  let deferredProfileTimer = null;
  let lastProfileFlushAt = 0;
  let lastProfileFlushResult = true;

  if (typeof render === "function") {
    const baseRender = render;
    render = function stabilityBudgetedRender(...args) {
      renderDepth++;
      try { return baseRender(...args); }
      finally { renderDepth = Math.max(0, renderDepth - 1); }
    };
  }

  if (typeof saveProfile === "function") {
    const baseSaveProfile = saveProfile;
    const flushDeferredProfile = () => {
      deferredProfileTimer = null;
      try { baseSaveProfile(); } catch (error) { console.warn("Deferred profile save failed", error); }
    };
    saveProfile = function stabilityBudgetedProfileSave(options = {}) {
      const explicit = options && Object.prototype.hasOwnProperty.call(options, "skipCloud");
      const activeRound = !!state && !state.rewarded && !state.failed;
      if (constrained() && !explicit && (renderDepth > 0 || activeRound)) {
        clearTimeout(deferredProfileTimer);
        deferredProfileTimer = setTimeout(flushDeferredProfile, renderDepth > 0 ? 1100 : 850);
        return true;
      }
      clearTimeout(deferredProfileTimer);
      deferredProfileTimer = null;
      return baseSaveProfile(options);
    };
  }

  if (typeof flushProfileSave === "function") {
    const baseFlushProfileSave = flushProfileSave;
    flushProfileSave = function stabilityDedupedProfileFlush(options = {}) {
      const now = Date.now();
      if (constrained() && document.visibilityState === "hidden" && now - lastProfileFlushAt < 700) return lastProfileFlushResult;
      lastProfileFlushAt = now;
      const normalized = document.visibilityState === "hidden" ? { ...options, skipCloud: true } : options;
      lastProfileFlushResult = baseFlushProfileSave(normalized);
      return lastProfileFlushResult;
    };
  }

  if (typeof animatePendingReveal === "function") {
    const baseAnimatePendingReveal = animatePendingReveal;
    animatePendingReveal = function stabilityRevealAnimation() {
      if (!constrained()) return baseAnimatePendingReveal();
      pendingRevealUid = null;
    };
  }

  if (typeof animateRecycle === "function") {
    const baseAnimateRecycle = animateRecycle;
    animateRecycle = function stabilityRecycleAnimation() {
      if (!constrained()) return baseAnimateRecycle();
      pendingRecycle = false;
      stockEl?.classList.remove("deal-pulse");
    };
  }

  if (typeof animateCategoryCompletion === "function") {
    const baseAnimateCategoryCompletion = animateCategoryCompletion;
    animateCategoryCompletion = async function stabilityCategoryCompletion(...args) {
      if (!constrained()) return baseAnimateCategoryCompletion(...args);
      try { playSfx?.("category", 0.55); } catch {}
      return undefined;
    };
  }

  const checkpointRuntimeFault = (kind, detail = "") => {
    if (!constrained()) return;
    try { save?.({ immediate: true }); } catch {}
    try { flushProfileSave?.({ skipCloud: true }); } catch {}
    try { recordStabilityEvent?.("runtime_fault_checkpoint", { kind, detail: String(detail || "").slice(0, 160) }); } catch {}
  };

  SolivocLifecycle.on("error", "ios.runtime-fault", ({ message }) => checkpointRuntimeFault("error", message));
  SolivocLifecycle.on("unhandledrejection", "ios.runtime-fault", ({ reason }) => checkpointRuntimeFault("promise", reason?.message || reason));
})();
