/* Crash-safe lifecycle for routed Forest encounters. Milestones require explicit authored outcomes. */
(() => {
  if (globalThis.SolivocStoryEncounterLifecycle) return;

  const WORLD_ID = "forest";
  const PACKAGE_VERSION = "0.03";
  const CONTRACT_VERSION = "forest-encounter-lifecycle@1";
  const META_KEY = "story:forest:encounter-lifecycle";
  const RUNTIME_MARK = "__solivocEncounterLifecycleIntegrated";
  const ROUTER_MARK = "__solivocEncounterLifecycleGuard";
  const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.:-]*$/;
  const ALLOWED_MILESTONES = new Set([
    "understanding_established",
    "reciprocity_established",
    "cooperation_established",
  ]);
  const THREAD_IDS = Object.freeze({
    cat: "THREAD_FOREST_CAT",
    owl: "THREAD_FOREST_OWL",
    fox: "THREAD_FOREST_FOX",
    forest_elemental: "THREAD_FOREST_ELEMENTAL",
  });

  let activeLifecycle = null;
  let lastPackageData = null;
  let runtimeValue = globalThis.SolivocForestStory;

  const array = (value) => Array.isArray(value) ? value : [];
  const text = (value) => String(value ?? "").trim();
  const now = () => new Date().toISOString();

  function validLifecycle(value) {
    return !!value && value.worldId === WORLD_ID && value.packageVersion === PACKAGE_VERSION &&
      ID_PATTERN.test(text(value.encounterId)) && ID_PATTERN.test(text(value.variantId)) &&
      ["active", "completed"].includes(value.status);
  }

  function encounterDefinition(packageData, encounterId) {
    return array(packageData?.encounters?.encounters).find((item) => item?.id === encounterId) || null;
  }

  function lifecycleFromRouting(state, packageData) {
    const routing = state?.encounterRouting;
    if (!routing?.selectedVariant || !routing?.encounterId) return null;
    const definition = encounterDefinition(packageData, routing.encounterId);
    if (!definition || !Array.isArray(definition.window) || definition.window.length !== 2) return null;
    return Object.freeze({
      worldId: WORLD_ID,
      packageVersion: PACKAGE_VERSION,
      contractVersion: CONTRACT_VERSION,
      encounterId: routing.encounterId,
      variantId: routing.selectedVariant,
      participants: Object.freeze([...array(routing.participants).map(text).filter(Boolean)]),
      window: Object.freeze(definition.window.map(Number)),
      status: "active",
      startedLevel: Number(routing.routedAtLevel || state.levelId),
      startedSceneId: state.sceneId || null,
      startedAt: routing.committedAt || now(),
      beats: Object.freeze({}),
      beatOrder: Object.freeze([]),
      temporaryAllianceStarted: false,
      completedAt: null,
      outcomeKey: null,
    });
  }

  async function readStored() {
    const store = globalThis.SolivocNarrativeStore;
    if (!store?.getMeta) return null;
    const value = await store.getMeta(META_KEY);
    return validLifecycle(value) ? Object.freeze(value) : null;
  }

  async function writeStored(value) {
    const store = globalThis.SolivocNarrativeStore;
    if (!store?.setMeta) throw new Error("narrative_store_unavailable");
    await store.setMeta(META_KEY, value);
    activeLifecycle = Object.freeze(value);
    return activeLifecycle;
  }

  async function refreshStored() {
    activeLifecycle = await readStored();
    return activeLifecycle;
  }

  async function reconcile(state, packageData = lastPackageData) {
    if (packageData) lastPackageData = packageData;
    const stored = activeLifecycle || await readStored();
    const routed = lifecycleFromRouting(state, packageData);
    if (!routed) {
      activeLifecycle = stored;
      return stored;
    }
    if (stored?.status === "active" && stored.encounterId === routed.encounterId && stored.variantId === routed.variantId) {
      activeLifecycle = stored;
      return stored;
    }
    if (stored?.status === "active" && stored.encounterId !== routed.encounterId)
      throw new Error("encounter_lifecycle_conflict");
    return writeStored(routed);
  }

  function encounterForLevel(definitions, level) {
    const current = Number(level);
    return array(definitions?.encounters).find((encounter) => {
      const window = array(encounter?.window).map(Number);
      return window.length === 2 && current >= window[0] && current <= window[1];
    }) || null;
  }

  function installRouterGuard() {
    const router = globalThis.SolivocStoryEncounterRouting;
    if (!router?.routeForLevel || router[ROUTER_MARK] === true) return false;
    const original = router.routeForLevel.bind(router);
    globalThis.SolivocStoryEncounterRouting = Object.freeze({
      ...router,
      routeForLevel(args = {}) {
        const encounter = encounterForLevel(args?.definitions, args?.level);
        if (activeLifecycle?.status === "active" && encounter?.id === activeLifecycle.encounterId) {
          return Object.freeze({
            status: "already-active",
            encounterId: activeLifecycle.encounterId,
            level: Number(args.level),
            selectedVariant: activeLifecycle.variantId,
            participants: Object.freeze([...array(activeLifecycle.participants)]),
            lifecycleContractVersion: CONTRACT_VERSION,
          });
        }
        return original(args);
      },
      [ROUTER_MARK]: true,
    });
    return true;
  }

  function semanticEvent(state, eventKey, semanticScope, payload = {}, tags = []) {
    return {
      eventKey,
      semanticScope,
      areaId: state.areaId || null,
      levelId: Number(state.levelId) || null,
      sceneId: state.sceneId || null,
      payload,
      semanticTags: [...new Set(["story", "encounter", ...tags])],
      canonVersion: { worldPackage: PACKAGE_VERSION, encounterLifecycle: CONTRACT_VERSION },
    };
  }

  function commandFor(state, phase, events) {
    const commandId = `forest:${state.sceneId}:${phase}:v${PACKAGE_VERSION}`;
    return { commandId, transactionId: commandId, worldId: WORLD_ID, events };
  }

  function threadId(characterId) {
    return THREAD_IDS[text(characterId).toLowerCase()] || null;
  }

  async function requireActive() {
    const lifecycle = activeLifecycle || await refreshStored();
    if (!lifecycle || lifecycle.status !== "active") throw new Error("encounter_lifecycle_not_active");
    return lifecycle;
  }

  async function recordBeat(beatId, { kind = "authored", evidenceStatus = "BOUND" } = {}) {
    beatId = text(beatId);
    if (!ID_PATTERN.test(beatId)) throw new Error("invalid_encounter_beat_id");
    const runtime = globalThis.SolivocForestStory;
    const store = globalThis.SolivocNarrativeStore;
    if (!runtime?.restore || !store?.commit) throw new Error("encounter_lifecycle_runtime_unavailable");
    const state = await runtime.restore();
    if (!state || state.status !== "active") throw new Error("story_scene_not_active");
    const lifecycle = await requireActive();
    if (lifecycle.beats?.[beatId]) return Object.freeze({ lifecycle, replayed: true });

    const completedAt = now();
    const beat = Object.freeze({ beatId, kind: text(kind) || "authored", evidenceStatus: text(evidenceStatus) || "BOUND", sceneId: state.sceneId, levelId: Number(state.levelId), completedAt });
    const next = Object.freeze({
      ...lifecycle,
      beats: Object.freeze({ ...(lifecycle.beats || {}), [beatId]: beat }),
      beatOrder: Object.freeze([...array(lifecycle.beatOrder), beatId]),
    });

    const events = [];
    for (const characterId of array(lifecycle.participants)) {
      const tid = threadId(characterId);
      if (!tid) continue;
      events.push(semanticEvent(
        state,
        "FOREST_THREAD_STATE_CHANGED",
        `${lifecycle.encounterId}:${lifecycle.variantId}:beat:${beatId}:${characterId}`,
        {
          threadId: tid,
          characterId,
          encounterProgress: { encounterId: lifecycle.encounterId, variantId: lifecycle.variantId, beatId, beatKind: beat.kind, evidenceStatus: beat.evidenceStatus },
          profileEligible: false,
          preferenceEligible: false,
          reason: "encounter_beat",
        },
        ["encounter-beat", characterId],
      ));
    }
    if (!events.length) throw new Error("encounter_beat_has_no_threads");
    await store.commit(commandFor(state, `encounter-beat:${lifecycle.encounterId}:${lifecycle.variantId}:${beatId}`, events), META_KEY, next);
    activeLifecycle = next;
    runtime.sync?.().catch(() => {});
    return Object.freeze({ lifecycle: next, replayed: false });
  }

  async function startTemporaryAlliance() {
    const runtime = globalThis.SolivocForestStory;
    const store = globalThis.SolivocNarrativeStore;
    if (!runtime?.restore || !store?.commit) throw new Error("encounter_lifecycle_runtime_unavailable");
    const state = await runtime.restore();
    if (!state || state.status !== "active") throw new Error("story_scene_not_active");
    const lifecycle = await requireActive();
    if (lifecycle.temporaryAllianceStarted === true) return Object.freeze({ lifecycle, replayed: true });
    const participants = array(lifecycle.participants).filter((id) => ["cat", "owl", "fox"].includes(id));
    if (!participants.length) throw new Error("temporary_alliance_requires_mascot");
    const next = Object.freeze({ ...lifecycle, temporaryAllianceStarted: true, temporaryAllianceStartedAt: now() });
    const event = semanticEvent(state, "FOREST_TEMPORARY_ALLIANCE_STARTED", `${lifecycle.encounterId}:${lifecycle.variantId}:temporary-alliance:started`, { encounterId: lifecycle.encounterId, variantId: lifecycle.variantId, participants }, ["temporary-alliance"]);
    await store.commit(commandFor(state, `temporary-alliance:${lifecycle.encounterId}:${lifecycle.variantId}:started`, [event]), META_KEY, next);
    activeLifecycle = next;
    runtime.sync?.().catch(() => {});
    return Object.freeze({ lifecycle: next, replayed: false });
  }

  function normalizeMilestones(lifecycle, input) {
    const result = [];
    const participants = new Set(array(lifecycle.participants));
    for (const [characterId, values] of Object.entries(input && typeof input === "object" ? input : {})) {
      if (!participants.has(characterId)) throw new Error("encounter_outcome_character_not_participant");
      for (const milestone of array(values).map(text).filter(Boolean)) {
        if (!ALLOWED_MILESTONES.has(milestone)) throw new Error("unsupported_encounter_milestone");
        result.push({ characterId, milestone });
      }
    }
    return result;
  }

  async function completeEncounter({ outcomeKey = "authored-outcome", milestones = {}, temporaryAllianceCompleted = false, evidenceBeatIds = [] } = {}) {
    outcomeKey = text(outcomeKey);
    if (!ID_PATTERN.test(outcomeKey)) throw new Error("invalid_encounter_outcome_key");
    const runtime = globalThis.SolivocForestStory;
    const store = globalThis.SolivocNarrativeStore;
    if (!runtime?.restore || !store?.commit) throw new Error("encounter_lifecycle_runtime_unavailable");
    const state = await runtime.restore();
    if (!state || state.status !== "active") throw new Error("story_scene_not_active");
    const lifecycle = activeLifecycle || await refreshStored();
    if (!lifecycle) throw new Error("encounter_lifecycle_not_active");
    if (lifecycle.status === "completed") return Object.freeze({ lifecycle, replayed: true });

    const milestoneRows = normalizeMilestones(lifecycle, milestones);
    const knownBeats = new Set(array(lifecycle.beatOrder));
    const evidence = [...new Set(array(evidenceBeatIds).map(text).filter((id) => knownBeats.has(id)))];
    const events = milestoneRows.map(({ characterId, milestone }) => semanticEvent(
      state,
      "FOREST_RELATIONSHIP_MILESTONE",
      `${lifecycle.encounterId}:${lifecycle.variantId}:milestone:${characterId}:${milestone}`,
      { characterId, milestone, encounterId: lifecycle.encounterId, variantId: lifecycle.variantId, evidenceBeatIds: evidence },
      ["relationship", "milestone", characterId],
    ));

    if (temporaryAllianceCompleted === true) {
      if (lifecycle.temporaryAllianceStarted !== true) throw new Error("temporary_alliance_not_started");
      const participants = array(lifecycle.participants).filter((id) => ["cat", "owl", "fox"].includes(id));
      events.push(semanticEvent(state, "FOREST_TEMPORARY_ALLIANCE_COMPLETED", `${lifecycle.encounterId}:${lifecycle.variantId}:temporary-alliance:completed`, { encounterId: lifecycle.encounterId, variantId: lifecycle.variantId, participants, evidenceBeatIds: evidence }, ["temporary-alliance"]));
    }

    events.push(semanticEvent(
      state,
      "FOREST_ENCOUNTER_COMPLETED",
      `${lifecycle.encounterId}:${lifecycle.variantId}:completed`,
      { encounterId: lifecycle.encounterId, variantId: lifecycle.variantId, participants: [...array(lifecycle.participants)], outcomeKey, completedBeatIds: [...array(lifecycle.beatOrder)], evidenceBeatIds: evidence },
      ["encounter-complete"],
    ));

    const next = Object.freeze({ ...lifecycle, status: "completed", completedAt: now(), outcomeKey, temporaryAllianceCompleted: temporaryAllianceCompleted === true });
    await store.commit(commandFor(state, `encounter:${lifecycle.encounterId}:${lifecycle.variantId}:completed`, events), META_KEY, next);
    activeLifecycle = next;
    runtime.sync?.().catch(() => {});
    return Object.freeze({ lifecycle: next, replayed: false });
  }

  async function recordGameplayBeatIfNeeded(state) {
    const lifecycle = activeLifecycle || await refreshStored();
    if (!lifecycle || lifecycle.status !== "active" || !state?.sceneId) return lifecycle;
    const [start, end] = array(lifecycle.window).map(Number);
    const level = Number(state.levelId);
    if (level < start || level > end) return lifecycle;
    const beatId = `gameplay:${state.sceneId}`;
    if (!lifecycle.beats?.[beatId]) await recordBeat(beatId, { kind: "core-gameplay", evidenceStatus: "OBSERVED" });
    return activeLifecycle;
  }

  function deadlineRequiresOutcome(state, lifecycle) {
    if (!state || !lifecycle || lifecycle.status !== "active") return false;
    const end = Number(lifecycle.window?.[1]);
    return Number.isInteger(end) && Number(state.levelId) >= end;
  }

  function wrapRuntime(runtime) {
    if (!runtime?.bootstrap || runtime[RUNTIME_MARK] === true) return runtime;
    const originalBootstrap = runtime.bootstrap.bind(runtime);
    const originalBeginScene = runtime.beginScene?.bind(runtime);
    const originalBeginRoutedEncounter = runtime.beginRoutedEncounter?.bind(runtime);
    const originalCompleteScene = runtime.completeScene?.bind(runtime);

    async function bootstrap(...args) {
      await refreshStored();
      installRouterGuard();
      const snapshot = await originalBootstrap(...args);
      lastPackageData = snapshot;
      await reconcile(snapshot?.active, snapshot);
      return Object.freeze({ ...snapshot, encounterLifecycle: activeLifecycle });
    }

    async function beginScene(...args) {
      await refreshStored();
      installRouterGuard();
      const result = await originalBeginScene(...args);
      await reconcile(result?.state, lastPackageData);
      return Object.freeze({ ...result, encounterLifecycle: activeLifecycle });
    }

    async function beginRoutedEncounter(...args) {
      if (!originalBeginRoutedEncounter) throw new Error("story_begin_routed_encounter_unavailable");
      const result = await originalBeginRoutedEncounter(...args);
      await reconcile(result?.state, lastPackageData);
      return Object.freeze({ ...result, encounterLifecycle: activeLifecycle });
    }

    async function completeScene(...args) {
      if (!originalCompleteScene) throw new Error("story_complete_scene_unavailable");
      await refreshStored();
      installRouterGuard();
      const state = await runtime.restore?.();
      if (state?.status === "active") {
        await recordGameplayBeatIfNeeded(state);
        if (deadlineRequiresOutcome(state, activeLifecycle)) {
          const error = new Error("story_encounter_outcome_required");
          error.code = "story_encounter_outcome_required";
          error.encounterLifecycle = activeLifecycle;
          throw error;
        }
      }
      return originalCompleteScene(...args);
    }

    return Object.freeze({
      ...runtime,
      bootstrap,
      beginScene,
      beginRoutedEncounter,
      completeScene,
      encounterLifecycle: () => activeLifecycle,
      recordEncounterBeat: recordBeat,
      startTemporaryAlliance,
      completeRoutedEncounter: completeEncounter,
      [RUNTIME_MARK]: true,
    });
  }

  function installRuntimeBinding() {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, "SolivocForestStory");
    if (descriptor?.configurable === false) return false;
    const previousGet = typeof descriptor?.get === "function" ? descriptor.get.bind(globalThis) : null;
    const previousSet = typeof descriptor?.set === "function" ? descriptor.set.bind(globalThis) : null;
    let localValue = previousGet ? previousGet() : runtimeValue;
    const getUnderlying = () => previousGet ? previousGet() : localValue;
    const setUnderlying = (value) => { if (previousSet) previousSet(value); else localValue = value; };

    const installValue = (value) => {
      setUnderlying(value);
      const routed = getUnderlying();
      if (routed) setUnderlying(wrapRuntime(routed));
      runtimeValue = getUnderlying();
      return runtimeValue;
    };

    if (localValue) installValue(localValue);
    try {
      Object.defineProperty(globalThis, "SolivocForestStory", {
        configurable: true,
        enumerable: true,
        get() { return getUnderlying(); },
        set(value) { installValue(value); },
      });
      return true;
    } catch {
      return false;
    }
  }

  globalThis.SolivocStoryEncounterLifecycle = Object.freeze({
    contractVersion: CONTRACT_VERSION,
    metaKey: META_KEY,
    current: () => activeLifecycle,
    reconcile,
    recordBeat,
    startTemporaryAlliance,
    completeEncounter,
    deadlineRequiresOutcome,
    installRuntimeBinding,
    installRouterGuard,
  });

  installRouterGuard();
  installRuntimeBinding();
})();
