/* End-to-end Forest Story runtime driven by authored world data. */
(() => {
  const WORLD_ID = "forest", PACKAGE_VERSION = "0.03";
  const FILES = Object.freeze({ scenes: "data/scenes.json", encounters: "data/encounters.json", choices: "data/choices.json", facts: "data/world-facts.json", structures: "data/world-structures.json" });
  const DEFAULT_SCENE_ID = "SCN_FOREST_L001_CORE", ACTIVE_META_KEY = "story:forest:active";
  const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.:-]*$/;
  const FLOW_PHASES = Object.freeze(["beforeGameplay", "afterGameplay"]), FLOW_STEP_TYPES = new Set(["forced-perspective", "choice"]);
  let loaded = null, onlineSyncInstalled = false;

  function flowSteps(scene, phase = "beforeGameplay") { return Array.isArray(scene?.flow?.[phase]) ? scene.flow[phase] : []; }
  function allFlowSteps(scene) { return FLOW_PHASES.flatMap((phase) => flowSteps(scene, phase).map((step) => ({ ...step, phase }))); }
  function forcedPerspectiveSteps(scene, phase = "beforeGameplay") { return flowSteps(scene, phase).filter((step) => step?.type === "forced-perspective"); }
  function choiceSteps(scene, phase = null) { return (phase ? flowSteps(scene, phase) : allFlowSteps(scene)).filter((step) => step?.type === "choice"); }

  function areaForLevel(campaign, level) {
    return (Array.isArray(campaign?.areas) ? campaign.areas : []).find((area) => Array.isArray(area?.levels) && area.levels.length === 2 && level >= area.levels[0] && level <= area.levels[1]) || null;
  }

  function choiceToFlowStep(definition) {
    return {
      type: "choice",
      choiceId: definition.id,
      kind: definition.kind,
      required: definition.required !== false,
      profileEligible: definition.profileEligible !== false,
      preferenceEligible: definition.preferenceEligible !== false,
      ...(definition.prompt ? { prompt: definition.prompt } : {}),
      options: (definition.options || []).map((option) => ({
        id: option.id,
        label: option.label,
        weights: option.weights || {},
        ...(option.conditionalWeights ? { conditionalWeights: option.conditionalWeights } : {}),
        ...(option.weightStatus ? { weightStatus: option.weightStatus } : {}),
      })),
    };
  }

  function normalizeScenesDocument(raw, choicesDocument = null) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
    if (Array.isArray(raw.scenes)) return raw;
    if (!Array.isArray(raw.coreScenes) || !Array.isArray(raw.coreSceneFormat)) return raw;
    const format = raw.coreSceneFormat;
    const levelIndex = format.indexOf("level"), idIndex = format.indexOf("id"), meaningIndex = format.indexOf("meaning");
    if (levelIndex < 0 || idIndex < 0 || meaningIndex < 0) return raw;
    const choiceDefs = new Map((Array.isArray(choicesDocument?.choices) ? choicesDocument.choices : []).map((choice) => [choice.id, choice]));
    const overlays = raw.sceneOverlays && typeof raw.sceneOverlays === "object" ? raw.sceneOverlays : {};
    const scenes = raw.coreScenes.map((row, index) => {
      const level = row[levelIndex], id = row[idIndex], meaning = row[meaningIndex], area = areaForLevel(raw.campaign, level);
      const overlay = overlays[String(level)] || {};
      const defaults = raw.runtimeDefaults || {};
      const scene = {
        id, level, areaId: area?.id || null, status: defaults.status || "BOUND", meaning,
        ...(index < raw.coreScenes.length - 1 ? { nextSceneId: raw.coreScenes[index + 1][idIndex] } : {}),
        executionStatus: overlay.executionStatus || "CORE_GAMEPLAY_READY",
        ...(overlay.requiredPrimitive ? { requiredPrimitive: overlay.requiredPrimitive } : {}),
        ...(overlay.executionStatus === "NON_EXECUTABLE_UNTIL_PRIMITIVE" ? {} : { generation: overlay.generation || { profile: defaults.generationProfile || "standard", cardSourceMode: defaults.cardSourceMode || "words", forceSolvable: defaults.forceSolvable !== false } }),
        presentation: { worldLabel: raw.campaign?.worldLabel || "Мир Леса", areaLabel: area?.label || "", characters: [], ...(overlay.presentation || {}) },
        ...overlay,
      };
      scene.presentation = { worldLabel: raw.campaign?.worldLabel || "Мир Леса", areaLabel: area?.label || "", characters: [], ...(overlay.presentation || {}) };
      const authoredChoiceRefs = [...new Set([...(scene.choiceRefs || []), ...[...choiceDefs.values()].filter((choice) => choice.level === level).map((choice) => choice.id)])];
      if (authoredChoiceRefs.length) scene.choiceRefs = authoredChoiceRefs;
      for (const choiceId of authoredChoiceRefs) {
        const definition = choiceDefs.get(choiceId);
        if (!definition?.phase || !FLOW_PHASES.includes(definition.phase)) continue;
        scene.flow ||= {};
        scene.flow[definition.phase] ||= [];
        if (!scene.flow[definition.phase].some((step) => step?.type === "choice" && step.choiceId === choiceId)) scene.flow[definition.phase].push(choiceToFlowStep(definition));
      }
      return Object.freeze(scene);
    });
    return Object.freeze({ ...raw, scenes: Object.freeze(scenes) });
  }

  function validateChoiceStep(step, errors) {
    if (!ID_PATTERN.test(String(step?.choiceId || ""))) errors.push("invalid_story_choice_id");
    if (!String(step?.kind || "").trim()) errors.push("invalid_story_choice_kind");
    if (!Array.isArray(step?.options) || step.options.length < 2) return errors.push("invalid_story_choice_options");
    const optionIds = new Set();
    for (const option of step.options) {
      const id = String(option?.id || "");
      if (!ID_PATTERN.test(id)) errors.push("invalid_story_choice_option_id"); else if (optionIds.has(id)) errors.push("duplicate_story_choice_option_id"); else optionIds.add(id);
      if (!String(option?.label || "").trim()) errors.push("invalid_story_choice_option_label");
      if (option?.weights != null && (typeof option.weights !== "object" || Array.isArray(option.weights))) errors.push("invalid_story_choice_weights");
    }
  }

  function validateScenesDocument(value) {
    const errors = [];
    if (!value || typeof value !== "object" || Array.isArray(value)) errors.push("scenes_not_object");
    if (value?.schemaVersion !== 1) errors.push("unsupported_scenes_schema");
    if (value?.worldId !== WORLD_ID) errors.push("invalid_scenes_world");
    if (value?.packageVersion !== PACKAGE_VERSION) errors.push("invalid_scenes_package");
    const totalLevels = value?.campaign?.totalLevels;
    if (!Number.isInteger(totalLevels) || totalLevels < 1) errors.push("invalid_campaign_total_levels");
    if (!String(value?.campaign?.worldLabel || "").trim()) errors.push("invalid_campaign_world_label");
    if (!Array.isArray(value?.scenes) || !value.scenes.length) errors.push("missing_scenes");
    else {
      if (Number.isInteger(totalLevels) && value.scenes.length !== totalLevels) errors.push("scene_count_mismatch");
      const ids = new Set(), levels = new Set();
      for (const scene of value.scenes) {
        const id = String(scene?.id || "");
        if (!ID_PATTERN.test(id)) errors.push("invalid_scene_id"); else if (ids.has(id)) errors.push("duplicate_scene_id"); else ids.add(id);
        if (!Number.isInteger(scene?.level) || scene.level < 1) errors.push("invalid_scene_level"); else if (levels.has(scene.level)) errors.push("duplicate_scene_level"); else levels.add(scene.level);
        if (!ID_PATTERN.test(String(scene?.areaId || ""))) errors.push("invalid_scene_area");
        if (scene?.status !== "BOUND") errors.push("scene_not_bound");
        if (!["CORE_GAMEPLAY_READY", "NON_EXECUTABLE_UNTIL_PRIMITIVE"].includes(scene?.executionStatus)) errors.push("invalid_scene_execution_status");
        if (scene.executionStatus === "NON_EXECUTABLE_UNTIL_PRIMITIVE" && !String(scene.requiredPrimitive || "").trim()) errors.push("missing_required_primitive");
        const encounterId = scene?.presentation?.encounterId;
        if (encounterId != null && !ID_PATTERN.test(String(encounterId))) errors.push("invalid_scene_encounter");
        if ((scene?.presentation?.startsEncounter === true || scene?.presentation?.endsEncounter === true) && !encounterId) errors.push("missing_scene_encounter");
        for (const fact of Array.isArray(scene?.worldFacts) ? scene.worldFacts : []) {
          if (!ID_PATTERN.test(String(fact?.id || ""))) errors.push("invalid_world_fact_id");
          if (!String(fact?.exposureMode || "").trim()) errors.push("invalid_world_fact_exposure");
        }
        for (const phase of FLOW_PHASES) for (const step of flowSteps(scene, phase)) {
          if (!FLOW_STEP_TYPES.has(String(step?.type || ""))) { errors.push("unsupported_story_flow_step"); continue; }
          if (step.type === "forced-perspective") {
            if (!ID_PATTERN.test(String(step.sceneId || ""))) errors.push("invalid_tutorial_scene");
            if (!ID_PATTERN.test(String(step.perspectiveId || ""))) errors.push("invalid_tutorial_perspective");
            if (!ID_PATTERN.test(String(step.characterId || ""))) errors.push("invalid_tutorial_character");
            if (!ID_PATTERN.test(String(step.threadId || ""))) errors.push("invalid_tutorial_thread");
            if (step.forced !== true) errors.push("tutorial_not_forced");
          } else validateChoiceStep(step, errors);
        }
      }
      for (let index = 0; index < value.scenes.length; index++) {
        const scene = value.scenes[index], expectedLevel = index + 1;
        if (scene.level !== expectedLevel) errors.push("non_contiguous_scene_levels");
        if (index < value.scenes.length - 1 && scene.nextSceneId !== value.scenes[index + 1].id) errors.push("invalid_next_scene");
        if (index === value.scenes.length - 1 && scene.nextSceneId != null) errors.push("terminal_scene_has_next");
      }
    }
    return { ok: errors.length === 0, errors };
  }

  function validateEncounterDefinitions(value) {
    const errors = [];
    if (!value || typeof value !== "object" || Array.isArray(value)) errors.push("encounters_not_object");
    if (value?.schemaVersion !== 1) errors.push("unsupported_encounters_schema");
    if (value?.worldId !== WORLD_ID) errors.push("invalid_encounters_world");
    if (value?.packageVersion !== PACKAGE_VERSION) errors.push("invalid_encounters_package");
    if (!String(value?.routingContractVersion || "").trim()) errors.push("missing_routing_contract_version");
    if (!Array.isArray(value?.encounters)) errors.push("missing_encounters");
    else {
      const ids = new Set(), variantIds = new Set();
      for (const encounter of value.encounters) {
        if (!ID_PATTERN.test(String(encounter?.id || ""))) errors.push("invalid_encounter_id"); else if (ids.has(encounter.id)) errors.push("duplicate_encounter_id"); else ids.add(encounter.id);
        if (!Array.isArray(encounter?.window) || encounter.window.length !== 2 || !encounter.window.every(Number.isInteger) || encounter.window[0] > encounter.window[1]) errors.push("invalid_encounter_window");
        if (encounter?.maxOccurrences !== 1) errors.push("unsupported_encounter_occurrences");
        if (!Array.isArray(encounter?.variants) || !encounter.variants.length) errors.push("missing_encounter_variants");
        else for (const variant of encounter.variants) {
          if (!ID_PATTERN.test(String(variant?.id || ""))) errors.push("invalid_encounter_variant_id"); else if (variantIds.has(variant.id)) errors.push("duplicate_encounter_variant_id"); else variantIds.add(variant.id);
          if (!Array.isArray(variant?.participants) || !variant.participants.length || variant.participants.some((id) => !ID_PATTERN.test(String(id || "")))) errors.push("invalid_encounter_participants");
        }
      }
    }
    return { ok: errors.length === 0, errors };
  }

  function sceneById(document, sceneId) { return document.scenes.find((scene) => scene.id === sceneId) || null; }
  function canExecuteScene(scene) { return !!scene && scene.executionStatus !== "NON_EXECUTABLE_UNTIL_PRIMITIVE"; }
  function assertExecutable(scene) { if (!canExecuteScene(scene)) throw new Error(`story_scene_primitive_unavailable:${scene?.requiredPrimitive || "unknown"}`); }

  async function load() {
    if (loaded) return loaded;
    const content = globalThis.SolivocWorldContent;
    if (!content?.loadManifest || !content?.loadRuntimeFile) throw new Error("world_content_loader_unavailable");
    const manifest = await content.loadManifest(WORLD_ID, PACKAGE_VERSION);
    const [rawScenes, encounters, choices, facts, structures] = await Promise.all([
      content.loadRuntimeFile(manifest, FILES.scenes), content.loadRuntimeFile(manifest, FILES.encounters), content.loadRuntimeFile(manifest, FILES.choices), content.loadRuntimeFile(manifest, FILES.facts), content.loadRuntimeFile(manifest, FILES.structures),
    ]);
    const document = normalizeScenesDocument(rawScenes, choices);
    const sceneValidation = validateScenesDocument(document); if (!sceneValidation.ok) throw Object.assign(new Error("invalid_story_scenes"), { validation: sceneValidation });
    const encounterValidation = validateEncounterDefinitions(encounters); if (!encounterValidation.ok) throw Object.assign(new Error("invalid_story_encounters"), { validation: encounterValidation });
    if (manifest.runtimeFiles?.includes(content.rulesFile) && typeof content.loadAndRegisterRelations === "function") await content.loadAndRegisterRelations(WORLD_ID, PACKAGE_VERSION);
    loaded = Object.freeze({ manifest, document, encounters, choices, facts, structures });
    return loaded;
  }

  function stateFor(scene, status, previous = null) {
    const now = new Date().toISOString(), sameScene = previous?.sceneId === scene.id;
    return Object.freeze({ worldId: WORLD_ID, packageVersion: PACKAGE_VERSION, sceneId: scene.id, areaId: scene.areaId, levelId: scene.level,
      encounterId: scene?.presentation?.encounterId || (sameScene ? previous?.encounterId || null : null), encounterVariantId: sameScene ? previous?.encounterVariantId || null : null,
      encounterRouting: sameScene ? previous?.encounterRouting || null : null, nextSceneId: scene.nextSceneId || null,
      forcedTutorials: sameScene ? { ...(previous?.forcedTutorials || {}) } : {}, choiceSelections: sameScene ? { ...(previous?.choiceSelections || {}) } : {},
      status, startedAt: sameScene ? (previous?.startedAt || now) : now, completedAt: status === "completed" ? now : null });
  }
  function semanticEvent(scene, eventKey, semanticScope, payload = {}, semanticTags = []) { return { eventKey, semanticScope, areaId: scene.areaId, levelId: scene.level, sceneId: scene.id, payload, semanticTags: [...new Set(["story", "first-pass", ...semanticTags])], canonVersion: { worldPackage: PACKAGE_VERSION } }; }
  function commandFor(scene, phase, events) { const commandId = `forest:${scene.id}:${phase}:v${PACKAGE_VERSION}`; return { commandId, transactionId: commandId, worldId: WORLD_ID, events }; }

  async function restore() { const store = globalThis.SolivocNarrativeStore; if (!store?.getMeta) throw new Error("narrative_store_unavailable"); const current = await store.getMeta(ACTIVE_META_KEY); if (!current || current.worldId !== WORLD_ID || current.packageVersion !== PACKAGE_VERSION) return null; const { document } = await load(); return sceneById(document, current.sceneId) ? Object.freeze(current) : null; }
  async function sync() { const store = globalThis.SolivocNarrativeStore; return store?.flush ? store.flush() : { attempted: 0, acknowledged: 0, stoppedReason: "store_unavailable" }; }
  function installOnlineSync() { if (onlineSyncInstalled || typeof globalThis.addEventListener !== "function") return; onlineSyncInstalled = true; globalThis.addEventListener("online", () => { sync().catch(() => {}); }, { passive: true }); }
  async function bootstrap() { const packageData = await load(); installOnlineSync(); return Object.freeze({ ...packageData, active: await restore() }); }

  async function routeEncounterForLevel(level, routingSnapshot = {}, sceneSignals = [], completedEncounterIds = []) { const router = globalThis.SolivocStoryEncounterRouting; if (!router?.routeForLevel) throw new Error("story_encounter_router_unavailable"); const { encounters } = await load(); return router.routeForLevel({ definitions: encounters, level, snapshot: routingSnapshot, sceneSignals, completedEncounterIds }); }
  async function beginRoutedEncounter(sceneId, decision) {
    const store = globalThis.SolivocNarrativeStore; if (!store?.commit) throw new Error("narrative_store_unavailable");
    if (decision?.status !== "selected" || !ID_PATTERN.test(String(decision.encounterId || "")) || !ID_PATTERN.test(String(decision.selectedVariant || ""))) throw new Error("invalid_encounter_routing_decision");
    const { document } = await load(), scene = sceneById(document, String(sceneId || "")); if (!scene) throw new Error("unknown_story_scene"); assertExecutable(scene);
    const current = await restore(); if (!current || current.sceneId !== scene.id || current.status !== "active") throw new Error("story_scene_not_active");
    if (current.encounterRouting?.selectedVariant) { if (current.encounterRouting.selectedVariant !== decision.selectedVariant || current.encounterRouting.encounterId !== decision.encounterId) throw new Error("encounter_routing_already_committed"); sync().catch(() => {}); return Object.freeze({ state: current, replayed: true }); }
    const routing = Object.freeze({ encounterId: decision.encounterId, selectedVariant: decision.selectedVariant, participants: [...(decision.participants || [])], eligibleVariants: [...(decision.eligibleVariants || [])], reasons: [...(decision.reasons || [])], routingContractVersion: decision.routingContractVersion, routedAtLevel: scene.level, deadline: decision.deadline === true, committedAt: new Date().toISOString() });
    const nextState = Object.freeze({ ...current, encounterId: decision.encounterId, encounterVariantId: decision.selectedVariant, encounterRouting: routing });
    const event = semanticEvent(scene, "FOREST_ENCOUNTER_STARTED", `${decision.encounterId}:${decision.selectedVariant}:started:${scene.id}:first-pass`, { encounterId: decision.encounterId, variantId: decision.selectedVariant, participants: routing.participants, eligibleVariants: routing.eligibleVariants, routingReasons: routing.reasons, routingContractVersion: routing.routingContractVersion, routedAtLevel: scene.level, deadline: routing.deadline }, ["encounter", "routing"]);
    await store.commit(commandFor(scene, `encounter:${decision.encounterId}:${decision.selectedVariant}`, [event]), ACTIVE_META_KEY, nextState); sync().catch(() => {}); return Object.freeze({ state: nextState, replayed: false });
  }

  async function beginScene(sceneId = DEFAULT_SCENE_ID) {
    const store = globalThis.SolivocNarrativeStore; if (!store?.commit) throw new Error("narrative_store_unavailable");
    const { document } = await load(), scene = sceneById(document, String(sceneId || "")); if (!scene) throw new Error("unknown_story_scene"); assertExecutable(scene);
    const current = await restore(); if (current?.sceneId === scene.id && ["active", "completed"].includes(current.status)) { sync().catch(() => {}); return Object.freeze({ state: current, replayed: true }); }
    const state = stateFor(scene, "active"), events = [semanticEvent(scene, "FOREST_LEVEL_STARTED", `${scene.id}:started:first-pass`)];
    const encounterId = scene?.presentation?.encounterId; if (scene?.presentation?.startsEncounter === true && encounterId) events.push(semanticEvent(scene, "FOREST_ENCOUNTER_STARTED", `${encounterId}:started:first-pass`, { encounterId }, ["encounter"]));
    for (const fact of Array.isArray(scene.worldFacts) ? scene.worldFacts : []) events.push(semanticEvent(scene, "FOREST_WORLD_FACT_EXPOSED", `${fact.id}:exposed:${scene.id}:first-pass`, { world_fact_id: fact.id, exposure_mode: fact.exposureMode, visibility_strength: fact.visibilityStrength || "subtle", required_for_core_progression: fact.requiredForCoreProgression === true }, ["world-fact", "exposure"]));
    await store.commit(commandFor(scene, "started", events), ACTIVE_META_KEY, state); sync().catch(() => {}); return Object.freeze({ state, replayed: false });
  }

  async function useForcedPerspective(sceneId, perspectiveId) {
    const store = globalThis.SolivocNarrativeStore; if (!store?.commit) throw new Error("narrative_store_unavailable"); const { document } = await load(), scene = sceneById(document, String(sceneId || "")); if (!scene) throw new Error("unknown_story_scene"); assertExecutable(scene);
    const tutorial = forcedPerspectiveSteps(scene).find((step) => step.perspectiveId === String(perspectiveId || "")); if (!tutorial) throw new Error("unknown_forced_perspective");
    const current = await restore(); if (!current || current.sceneId !== scene.id || current.status !== "active") throw new Error("story_scene_not_active"); if (current.forcedTutorials?.[tutorial.perspectiveId]?.used === true) { sync().catch(() => {}); return Object.freeze({ state: current, replayed: true }); }
    const nextState = Object.freeze({ ...current, forcedTutorials: { ...(current.forcedTutorials || {}), [tutorial.perspectiveId]: { used: true, tutorialSceneId: tutorial.sceneId, characterId: tutorial.characterId, profileEligible: false, preferenceEligible: false, reason: "forced_tutorial", usedAt: new Date().toISOString() } } });
    const event = semanticEvent(scene, "FOREST_THREAD_STATE_CHANGED", `${tutorial.sceneId}:${tutorial.perspectiveId}:forced-tutorial:first-pass`, { threadId: tutorial.threadId, characterId: tutorial.characterId, perspectiveId: tutorial.perspectiveId, borrowedPerspective: { seen: true, forcedTutorialUsed: true }, familiarityEligible: true, profileEligible: false, preferenceEligible: false, reason: "forced_tutorial", effectStatus: tutorial.effectStatus || "TBD_AUTHORED" }, ["forced-tutorial", "perspective", tutorial.characterId]);
    await store.commit(commandFor(scene, `forced-perspective:${tutorial.perspectiveId}`, [event]), ACTIVE_META_KEY, nextState); sync().catch(() => {}); return Object.freeze({ state: nextState, replayed: false });
  }

  async function selectChoice(sceneId, choiceId, optionId) {
    const store = globalThis.SolivocNarrativeStore; if (!store?.commit) throw new Error("narrative_store_unavailable"); const { document } = await load(), scene = sceneById(document, String(sceneId || "")); if (!scene) throw new Error("unknown_story_scene"); assertExecutable(scene);
    const step = choiceSteps(scene).find((candidate) => candidate.choiceId === String(choiceId || "")); if (!step) throw new Error("unknown_story_choice"); const option = step.options.find((candidate) => candidate.id === String(optionId || "")); if (!option) throw new Error("unknown_story_choice_option");
    const current = await restore(); if (!current || current.sceneId !== scene.id || current.status !== "active") throw new Error("story_scene_not_active"); const existing = current.choiceSelections?.[step.choiceId];
    if (existing?.optionId) { if (existing.optionId !== option.id) throw new Error("story_choice_already_selected"); sync().catch(() => {}); return Object.freeze({ state: current, replayed: true }); }
    const selection = Object.freeze({ optionId: option.id, kind: step.kind, phase: step.phase || null, selectedAt: new Date().toISOString() }), nextState = Object.freeze({ ...current, choiceSelections: { ...(current.choiceSelections || {}), [step.choiceId]: selection } });
    const event = semanticEvent(scene, "FOREST_CHOICE_SELECTED", `${step.choiceId}:${option.id}:first-pass`, { choiceId: step.choiceId, choiceKind: step.kind, optionId: option.id, authoredWeights: option.weights || {}, conditionalWeights: option.conditionalWeights || null, weightStatus: option.weightStatus || null, profileEligible: step.profileEligible !== false, preferenceEligible: step.preferenceEligible !== false, projectionStatus: "EVENT_ONLY" }, ["choice", step.kind]);
    await store.commit(commandFor(scene, `choice:${step.choiceId}`, [event]), ACTIVE_META_KEY, nextState); sync().catch(() => {}); return Object.freeze({ state: nextState, replayed: false });
  }

  function incompleteRequiredStep(scene, current) { for (const step of allFlowSteps(scene)) { if (step.required === false) continue; if (step.type === "forced-perspective" && current.forcedTutorials?.[step.perspectiveId]?.used !== true) return step; if (step.type === "choice" && !current.choiceSelections?.[step.choiceId]?.optionId) return step; } return null; }
  async function completeScene(sceneId = DEFAULT_SCENE_ID) {
    const store = globalThis.SolivocNarrativeStore; if (!store?.commit) throw new Error("narrative_store_unavailable"); const { document } = await load(), scene = sceneById(document, String(sceneId || "")); if (!scene) throw new Error("unknown_story_scene"); assertExecutable(scene);
    const current = await restore(); if (!current || current.sceneId !== scene.id) throw new Error("story_scene_not_active"); if (current.status === "completed") { sync().catch(() => {}); return Object.freeze({ state: current, replayed: true }); } if (incompleteRequiredStep(scene, current)) throw new Error("story_required_flow_incomplete");
    const state = stateFor(scene, "completed", current), events = [semanticEvent(scene, "FOREST_LEVEL_COMPLETED", `${scene.id}:completed:first-pass`)]; const encounterId = scene?.presentation?.encounterId; if (scene?.presentation?.endsEncounter === true && encounterId) events.push(semanticEvent(scene, "FOREST_ENCOUNTER_COMPLETED", `${encounterId}:completed:first-pass`, { encounterId }, ["encounter"]));
    await store.commit(commandFor(scene, "completed", events), ACTIVE_META_KEY, state); sync().catch(() => {}); return Object.freeze({ state, replayed: false });
  }

  globalThis.SolivocForestStory = Object.freeze({ bootstrap, beginScene, useForcedPerspective, selectChoice, completeScene, restore, sync, routeEncounterForLevel, beginRoutedEncounter, normalizeScenesDocument, validateScenesDocument, validateEncounterDefinitions, canExecuteScene, flowSteps, forcedPerspectiveSteps, choiceSteps, defaultSceneId: DEFAULT_SCENE_ID, scenesFile: FILES.scenes, encountersFile: FILES.encounters });
})();
