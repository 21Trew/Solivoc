/* Hard boundary between authored Forest encounter definitions and persisted routed decisions. */
(() => {
  if (globalThis.SolivocStoryRuntimeBoundary) return;

  const WORLD_ID = "forest";
  const RUNTIME_MARK = "__solivocStoryRuntimeBoundary";
  const PROVENANCE_KEYS = Object.freeze([
    "projectionSourceSequence",
    "projectionVersion",
    "projectionMode",
    "projectionRebuilt",
  ]);

  const array = (value) => Array.isArray(value) ? value : [];
  const text = (value) => String(value ?? "").trim();
  const sameList = (left, right) => left.length === right.length && left.every((value, index) => value === right[index]);

  function sceneFor(snapshot, sceneId) {
    return array(snapshot?.document?.scenes).find((scene) => scene?.id === sceneId) || null;
  }

  function encounterFor(snapshot, encounterId) {
    return array(snapshot?.encounters?.encounters).find((encounter) => encounter?.id === encounterId) || null;
  }

  function canonicalDecision(snapshot, sceneId, decision) {
    if (decision?.status !== "selected") throw new Error("invalid_encounter_routing_decision");
    const scene = sceneFor(snapshot, text(sceneId));
    if (!scene) throw new Error("unknown_story_scene");
    const encounter = encounterFor(snapshot, text(decision?.encounterId));
    if (!encounter) throw new Error("unknown_routed_encounter");
    const window = array(encounter.window).map(Number);
    if (window.length !== 2 || Number(scene.level) < window[0] || Number(scene.level) > window[1]) throw new Error("encounter_routing_outside_window");
    if (decision.level != null && Number(decision.level) !== Number(scene.level)) throw new Error("encounter_routing_level_mismatch");
    if (text(decision.routingContractVersion) !== text(snapshot?.encounters?.routingContractVersion)) throw new Error("encounter_routing_contract_mismatch");

    const variant = array(encounter.variants).find((candidate) => candidate?.id === decision?.selectedVariant) || null;
    if (!variant) throw new Error("unknown_routed_encounter_variant");
    const participants = array(variant.participants).map(text).filter(Boolean);
    const suppliedParticipants = array(decision.participants).map(text).filter(Boolean);
    if (suppliedParticipants.length && !sameList(suppliedParticipants, participants)) throw new Error("encounter_routing_participants_mismatch");

    const authoredVariantIds = new Set(array(encounter.variants).map((candidate) => text(candidate?.id)).filter(Boolean));
    const eligibleVariants = array(decision.eligibleVariants).map(text).filter(Boolean);
    if (!eligibleVariants.length || !eligibleVariants.includes(variant.id) || eligibleVariants.some((id) => !authoredVariantIds.has(id))) throw new Error("invalid_encounter_routing_eligible_variants");

    return Object.freeze({
      ...decision,
      encounterId: encounter.id,
      selectedVariant: variant.id,
      participants: Object.freeze([...participants]),
      eligibleVariants: Object.freeze([...eligibleVariants]),
      routingContractVersion: snapshot.encounters.routingContractVersion,
      level: Number(scene.level),
    });
  }

  function provenance(decision) {
    return Object.freeze({
      projectionSourceSequence: Math.max(0, Number(decision?.projectionSourceSequence) || 0),
      projectionVersion: Math.max(0, Number(decision?.projectionVersion) || 0),
      projectionMode: text(decision?.projectionMode) || null,
      projectionRebuilt: decision?.projectionRebuilt === true,
    });
  }

  function enrichValue(value, data) {
    if (!value || typeof value !== "object" || !value.encounterRouting) return value;
    return Object.freeze({
      ...value,
      encounterRouting: Object.freeze({ ...value.encounterRouting, ...data }),
    });
  }

  function enrichCommand(command, data) {
    if (!command || !Array.isArray(command.events)) return command;
    let changed = false;
    const events = command.events.map((event) => {
      if (event?.eventKey !== "FOREST_ENCOUNTER_STARTED") return event;
      changed = true;
      return Object.freeze({ ...event, payload: Object.freeze({ ...(event.payload || {}), ...data }) });
    });
    return changed ? Object.freeze({ ...command, events: Object.freeze(events) }) : command;
  }

  async function withProvenanceCommit(decision, work) {
    const store = globalThis.SolivocNarrativeStore;
    if (!store?.commit) return work();
    const data = provenance(decision);
    const proxy = Object.freeze({
      ...store,
      async commit(command, key, value) {
        return store.commit(enrichCommand(command, data), key, enrichValue(value, data));
      },
    });
    globalThis.SolivocNarrativeStore = proxy;
    try { return await work(data); }
    finally { globalThis.SolivocNarrativeStore = store; }
  }

  function wrapRuntime(runtime) {
    if (!runtime?.bootstrap || !runtime?.beginRoutedEncounter || runtime[RUNTIME_MARK] === true) return runtime;
    const originalBegin = runtime.beginRoutedEncounter.bind(runtime);
    const originalBootstrap = runtime.bootstrap.bind(runtime);

    async function beginRoutedEncounter(sceneId, decision) {
      const snapshot = await originalBootstrap();
      if (snapshot?.document == null || snapshot?.encounters == null) throw new Error("story_runtime_contract_unavailable");
      const canonical = canonicalDecision(snapshot, sceneId, decision);
      return withProvenanceCommit(canonical, async (data) => {
        const result = await originalBegin(sceneId, canonical);
        if (!result?.state || result.replayed === true) return result;
        return Object.freeze({ ...result, state: enrichValue(result.state, data) });
      });
    }

    return Object.freeze({ ...runtime, beginRoutedEncounter, [RUNTIME_MARK]: true });
  }

  function install() {
    const runtime = globalThis.SolivocForestStory;
    if (!runtime) return false;
    globalThis.SolivocForestStory = wrapRuntime(runtime);
    return globalThis.SolivocForestStory?.[RUNTIME_MARK] === true;
  }

  globalThis.SolivocStoryRuntimeBoundary = Object.freeze({
    canonicalDecision,
    provenance,
    wrapRuntime,
    install,
    provenanceKeys: PROVENANCE_KEYS,
  });

  install();
})();
