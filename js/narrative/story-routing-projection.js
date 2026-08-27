/* Bridges server rebuildable Forest projections into deterministic Story encounter routing. */
(() => {
  if (globalThis.SolivocStoryProjectionRouting) return;

  const WORLD_ID = "forest";
  const PROJECTION_URL = "/api/semantic-events?projection=1&view=routing&world=forest";
  const RUNTIME_MARK = "__solivocProjectionRoutingIntegrated";
  let lastDecision = null;
  let runtimeValue = globalThis.SolivocForestStory;
  let onlineRetryInstalled = false;

  const array = (value) => Array.isArray(value) ? value : [];
  const object = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const number = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;

  function encounterForLevel(definitions, level) {
    const current = Number(level);
    return array(definitions?.encounters).find((encounter) => {
      const window = array(encounter?.window).map(Number);
      return window.length === 2 && current >= window[0] && current <= window[1];
    }) || null;
  }

  function isEncounterDeadline(definitions, level) {
    const encounter = encounterForLevel(definitions, level);
    return !!encounter && Number(level) === Number(encounter.window?.[1]);
  }

  function deadlineBlocked(definitions, level, decision) {
    if (!isEncounterDeadline(definitions, level)) return false;
    return ["routing-unavailable", "deadline-unresolved", "p0-no-eligible-variant"].includes(String(decision?.status || ""));
  }

  function sceneSignals(packageData, state, extras = []) {
    const scene = array(packageData?.document?.scenes).find((item) => item?.id === state?.sceneId) || null;
    return [...new Set([
      ...array(scene?.routingSignals),
      ...array(scene?.encounterRouting?.sceneSignals),
      ...array(extras),
    ].map(String).filter(Boolean))];
  }

  async function routingProjection(runtime) {
    if (typeof globalThis.accountSignedIn === "function") {
      try {
        if (!globalThis.accountSignedIn()) return { status: "unavailable", reason: "auth_required", retryable: false };
      } catch {}
    }
    if (typeof globalThis.apiFetch !== "function")
      return { status: "unavailable", reason: "api_unavailable", retryable: true };

    try { await runtime?.sync?.(); }
    catch { return { status: "unavailable", reason: "semantic_sync_failed", retryable: true }; }

    try {
      const pending = globalThis.SolivocNarrativeStore?.pending
        ? await globalThis.SolivocNarrativeStore.pending(1)
        : [];
      if (array(pending).length)
        return { status: "unavailable", reason: "semantic_commands_pending", retryable: true };
    } catch {
      return { status: "unavailable", reason: "pending_state_unavailable", retryable: true };
    }

    let response;
    try {
      response = await globalThis.apiFetch(PROJECTION_URL, { cache: "no-store" });
    } catch {
      return { status: "unavailable", reason: "projection_network_error", retryable: true };
    }
    if (!response?.ok) {
      const status = Math.max(0, Number(response?.status) || 0);
      return {
        status: "unavailable",
        reason: status === 401 ? "auth_required" : status === 429 ? "rate_limited" : `projection_http_${status || "error"}`,
        retryable: status !== 401,
      };
    }

    const data = await response.json().catch(() => ({}));
    const projection = object(data?.projection);
    const snapshot = object(projection.routing_snapshot);
    if (projection.world_id !== WORLD_ID || !Object.keys(snapshot).length) {
      return { status: "unavailable", reason: "invalid_routing_projection", retryable: true };
    }

    return Object.freeze({
      status: "ready",
      snapshot,
      completedEncounterIds: Object.freeze([...array(projection?.encounters?.completed_ids)]),
      sourceSequence: Math.max(0, number(projection.source_sequence)),
      projectionVersion: Math.max(0, number(projection.projection_version || data.version)),
      projectionMode: String(data.mode || "cache"),
      projectionRebuilt: data.rebuilt === true,
    });
  }

  async function decide(runtime, packageData, state, options = {}) {
    const level = Number(options.level ?? state?.levelId);
    const encounter = encounterForLevel(packageData?.encounters, level);
    if (!encounter) return Object.freeze({ status: "no-window", level });

    if (state?.encounterRouting?.selectedVariant) {
      return Object.freeze({
        status: "selected",
        encounterId: state.encounterRouting.encounterId || state.encounterId,
        selectedVariant: state.encounterRouting.selectedVariant,
        participants: Object.freeze([...array(state.encounterRouting.participants)]),
        eligibleVariants: Object.freeze([...array(state.encounterRouting.eligibleVariants)]),
        reasons: Object.freeze([...array(state.encounterRouting.reasons)]),
        routingContractVersion: state.encounterRouting.routingContractVersion || packageData?.encounters?.routingContractVersion,
        deadline: state.encounterRouting.deadline === true,
        replayed: true,
      });
    }

    const projection = await routingProjection(runtime);
    if (projection.status !== "ready") {
      return Object.freeze({
        status: "routing-unavailable",
        encounterId: encounter.id,
        level,
        reason: projection.reason,
        retryable: projection.retryable !== false,
      });
    }

    const router = globalThis.SolivocStoryEncounterRouting;
    if (!router?.routeForLevel) throw new Error("story_encounter_router_unavailable");
    const routed = router.routeForLevel({
      definitions: packageData.encounters,
      level,
      snapshot: projection.snapshot,
      sceneSignals: sceneSignals(packageData, state, options.sceneSignals),
      completedEncounterIds: projection.completedEncounterIds,
    });

    return Object.freeze({
      ...routed,
      projectionSourceSequence: projection.sourceSequence,
      projectionVersion: projection.projectionVersion,
      projectionMode: projection.projectionMode,
      projectionRebuilt: projection.projectionRebuilt,
    });
  }

  async function decideAndCommit(runtime, packageData, state, options = {}) {
    if (!state || state.status !== "active") return { state, decision: Object.freeze({ status: "inactive-scene" }) };
    const decision = await decide(runtime, packageData, state, options);
    lastDecision = decision;
    if (decision.status !== "selected" || decision.replayed === true)
      return { state, decision };

    const result = await runtime.beginRoutedEncounter(state.sceneId, decision);
    return { state: result?.state || state, decision: Object.freeze({ ...decision, committed: true, replayed: result?.replayed === true }) };
  }

  function wrapRuntime(runtime) {
    if (!runtime?.bootstrap || runtime[RUNTIME_MARK] === true) return runtime;

    let packageData = null;
    const originalBootstrap = runtime.bootstrap.bind(runtime);
    const originalBeginScene = runtime.beginScene?.bind(runtime);
    const originalCompleteScene = runtime.completeScene?.bind(runtime);

    async function packageSnapshot() {
      if (packageData) return packageData;
      packageData = await originalBootstrap();
      return packageData;
    }

    async function bootstrap(...args) {
      const snapshot = await originalBootstrap(...args);
      packageData = snapshot;
      if (snapshot?.active?.status !== "active") return snapshot;
      const routed = await decideAndCommit(runtime, snapshot, snapshot.active);
      packageData = Object.freeze({ ...snapshot, active: routed.state });
      return Object.freeze({ ...snapshot, active: routed.state, routingDecision: routed.decision });
    }

    async function beginScene(...args) {
      if (!originalBeginScene) throw new Error("story_begin_scene_unavailable");
      const result = await originalBeginScene(...args);
      const snapshot = await packageSnapshot();
      const routed = await decideAndCommit(runtime, { ...snapshot, active: result.state }, result.state);
      packageData = Object.freeze({ ...snapshot, active: routed.state });
      return Object.freeze({ ...result, state: routed.state, routingDecision: routed.decision });
    }

    async function routeEncounterForLevel(level, options = {}) {
      const snapshot = await packageSnapshot();
      const active = options?.state || snapshot?.active || {
        status: "active",
        levelId: Number(level),
        sceneId: options?.sceneId || null,
      };
      const decision = await decide(runtime, snapshot, active, { ...options, level });
      lastDecision = decision;
      return decision;
    }

    async function completeScene(...args) {
      if (!originalCompleteScene) throw new Error("story_complete_scene_unavailable");
      let snapshot = await packageSnapshot();
      const active = await runtime.restore?.();
      if (active?.status === "active") {
        const routed = await decideAndCommit(runtime, { ...snapshot, active }, active);
        if (deadlineBlocked(snapshot.encounters, active.levelId, routed.decision)) {
          const error = new Error(`story_encounter_routing_blocked:${routed.decision.status}`);
          error.code = "story_encounter_routing_blocked";
          error.routingDecision = routed.decision;
          throw error;
        }
        snapshot = Object.freeze({ ...snapshot, active: routed.state });
        packageData = snapshot;
      }
      return originalCompleteScene(...args);
    }

    return Object.freeze({
      ...runtime,
      bootstrap,
      beginScene,
      completeScene,
      routeEncounterForLevel,
      [RUNTIME_MARK]: true,
    });
  }

  function installRuntimeBinding() {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, "SolivocForestStory");
    if (descriptor && descriptor.configurable === false) {
      if (runtimeValue && runtimeValue[RUNTIME_MARK] !== true) {
        try { globalThis.SolivocForestStory = wrapRuntime(runtimeValue); } catch {}
      }
      return false;
    }
    runtimeValue = wrapRuntime(runtimeValue);
    try {
      Object.defineProperty(globalThis, "SolivocForestStory", {
        configurable: true,
        enumerable: true,
        get() { return runtimeValue; },
        set(value) { runtimeValue = wrapRuntime(value); },
      });
      return true;
    } catch {
      return false;
    }
  }

  function installOnlineRetry() {
    if (onlineRetryInstalled || typeof globalThis.addEventListener !== "function") return;
    onlineRetryInstalled = true;
    globalThis.addEventListener("online", () => {
      const runtime = globalThis.SolivocForestStory;
      if (runtime?.bootstrap) runtime.bootstrap().catch(() => {});
    }, { passive: true });
  }

  globalThis.SolivocStoryProjectionRouting = Object.freeze({
    projectionUrl: PROJECTION_URL,
    routingProjection: () => routingProjection(globalThis.SolivocForestStory),
    lastDecision: () => lastDecision,
    installRuntimeBinding,
  });

  installRuntimeBinding();
  installOnlineRetry();
})();