/* End-to-end Forest Story runtime driven by authored scene data. */
(() => {
  const WORLD_ID = "forest";
  const PACKAGE_VERSION = "0.03";
  const SCENES_FILE = "data/scenes.json";
  const DEFAULT_SCENE_ID = "SCN_FOREST_L001_CORE";
  const ACTIVE_META_KEY = "story:forest:active";
  const SCENES_SCHEMA = 1;
  const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.:-]*$/;
  const FLOW_STEP_TYPES = new Set(["forced-perspective"]);
  let loaded = null;
  let onlineSyncInstalled = false;

  function beforeGameplaySteps(scene) {
    return Array.isArray(scene?.flow?.beforeGameplay) ? scene.flow.beforeGameplay : [];
  }

  function forcedPerspectiveSteps(scene) {
    return beforeGameplaySteps(scene).filter((step) => step?.type === "forced-perspective");
  }

  function validateScenesDocument(value) {
    const errors = [];
    if (!value || typeof value !== "object" || Array.isArray(value)) errors.push("scenes_not_object");
    if (value?.schemaVersion !== SCENES_SCHEMA) errors.push("unsupported_scenes_schema");
    if (value?.worldId !== WORLD_ID) errors.push("invalid_scenes_world");
    if (value?.packageVersion !== PACKAGE_VERSION) errors.push("invalid_scenes_package");
    if (value?.campaign != null) {
      if (!Number.isInteger(value.campaign?.totalLevels) || value.campaign.totalLevels < 1) errors.push("invalid_campaign_total_levels");
      if (!String(value.campaign?.worldLabel || "").trim()) errors.push("invalid_campaign_world_label");
    }
    if (!Array.isArray(value?.scenes) || !value.scenes.length) errors.push("missing_scenes");
    else {
      const ids = new Set();
      for (const scene of value.scenes) {
        const id = String(scene?.id || "");
        if (!ID_PATTERN.test(id)) errors.push("invalid_scene_id");
        else if (ids.has(id)) errors.push("duplicate_scene_id");
        else ids.add(id);
        if (!Number.isInteger(scene?.level) || scene.level < 1) errors.push("invalid_scene_level");
        if (!ID_PATTERN.test(String(scene?.areaId || ""))) errors.push("invalid_scene_area");
        if (scene?.status !== "BOUND") errors.push("scene_not_bound");
        const encounterId = scene?.presentation?.encounterId;
        if (encounterId != null && !ID_PATTERN.test(String(encounterId))) errors.push("invalid_scene_encounter");
        if (scene?.presentation?.startsEncounter === true && !encounterId) errors.push("missing_scene_encounter");
        for (const fact of Array.isArray(scene?.worldFacts) ? scene.worldFacts : []) {
          if (!ID_PATTERN.test(String(fact?.id || ""))) errors.push("invalid_world_fact_id");
          if (!String(fact?.exposureMode || "").trim()) errors.push("invalid_world_fact_exposure");
        }
        for (const step of beforeGameplaySteps(scene)) {
          if (!FLOW_STEP_TYPES.has(String(step?.type || ""))) {
            errors.push("unsupported_story_flow_step");
            continue;
          }
          if (step.type === "forced-perspective") {
            if (!ID_PATTERN.test(String(step.sceneId || ""))) errors.push("invalid_tutorial_scene");
            if (!ID_PATTERN.test(String(step.perspectiveId || ""))) errors.push("invalid_tutorial_perspective");
            if (!ID_PATTERN.test(String(step.characterId || ""))) errors.push("invalid_tutorial_character");
            if (!ID_PATTERN.test(String(step.threadId || ""))) errors.push("invalid_tutorial_thread");
            if (step.forced !== true) errors.push("tutorial_not_forced");
          }
        }
      }
      for (const scene of value.scenes) {
        if (scene?.nextSceneId != null && (!ID_PATTERN.test(String(scene.nextSceneId)) || !ids.has(String(scene.nextSceneId))))
          errors.push("invalid_next_scene");
      }
    }
    return { ok: errors.length === 0, errors };
  }

  function sceneById(document, sceneId) {
    return document.scenes.find((scene) => scene.id === sceneId) || null;
  }

  async function load() {
    if (loaded) return loaded;
    const content = globalThis.SolivocWorldContent;
    if (!content?.loadManifest || !content?.loadRuntimeFile) throw new Error("world_content_loader_unavailable");
    const manifest = await content.loadManifest(WORLD_ID, PACKAGE_VERSION);
    const document = await content.loadRuntimeFile(manifest, SCENES_FILE);
    const validation = validateScenesDocument(document);
    if (!validation.ok) throw Object.assign(new Error("invalid_story_scenes"), { validation });
    if (manifest.runtimeFiles?.includes(content.rulesFile) && typeof content.loadAndRegisterRelations === "function")
      await content.loadAndRegisterRelations(WORLD_ID, PACKAGE_VERSION);
    loaded = Object.freeze({ manifest, document });
    return loaded;
  }

  function stateFor(scene, status, previous = null) {
    const now = new Date().toISOString();
    const sameScene = previous?.sceneId === scene.id;
    return Object.freeze({
      worldId: WORLD_ID,
      packageVersion: PACKAGE_VERSION,
      sceneId: scene.id,
      areaId: scene.areaId,
      levelId: scene.level,
      encounterId: scene?.presentation?.encounterId || previous?.encounterId || null,
      nextSceneId: scene.nextSceneId || null,
      forcedTutorials: sameScene ? { ...(previous?.forcedTutorials || {}) } : {},
      status,
      startedAt: sameScene ? (previous?.startedAt || now) : now,
      completedAt: status === "completed" ? now : null,
    });
  }

  function semanticEvent(scene, eventKey, semanticScope, payload = {}, semanticTags = []) {
    return {
      eventKey,
      semanticScope,
      areaId: scene.areaId,
      levelId: scene.level,
      sceneId: scene.id,
      payload,
      semanticTags: [...new Set(["story", "first-pass", ...semanticTags])],
      canonVersion: { worldPackage: PACKAGE_VERSION },
    };
  }

  function commandFor(scene, phase, events) {
    const commandId = `forest:${scene.id}:${phase}:v${PACKAGE_VERSION}`;
    return { commandId, transactionId: commandId, worldId: WORLD_ID, events };
  }

  async function restore() {
    const store = globalThis.SolivocNarrativeStore;
    if (!store?.getMeta) throw new Error("narrative_store_unavailable");
    const current = await store.getMeta(ACTIVE_META_KEY);
    if (!current || current.worldId !== WORLD_ID || current.packageVersion !== PACKAGE_VERSION) return null;
    const { document } = await load();
    return sceneById(document, current.sceneId) ? Object.freeze(current) : null;
  }

  async function sync() {
    const store = globalThis.SolivocNarrativeStore;
    if (!store?.flush) return { attempted: 0, acknowledged: 0, stoppedReason: "store_unavailable" };
    return store.flush();
  }

  function installOnlineSync() {
    if (onlineSyncInstalled || typeof globalThis.addEventListener !== "function") return;
    onlineSyncInstalled = true;
    globalThis.addEventListener("online", () => { sync().catch(() => {}); }, { passive: true });
  }

  async function bootstrap() {
    const packageData = await load();
    installOnlineSync();
    const active = await restore();
    return Object.freeze({ ...packageData, active });
  }

  async function beginScene(sceneId = DEFAULT_SCENE_ID) {
    const store = globalThis.SolivocNarrativeStore;
    if (!store?.commit) throw new Error("narrative_store_unavailable");
    const { document } = await load();
    const scene = sceneById(document, String(sceneId || ""));
    if (!scene) throw new Error("unknown_story_scene");
    const current = await restore();
    if (current?.sceneId === scene.id && ["active", "completed"].includes(current.status)) {
      sync().catch(() => {});
      return Object.freeze({ state: current, replayed: true });
    }
    const state = stateFor(scene, "active");
    const events = [semanticEvent(scene, "FOREST_LEVEL_STARTED", `${scene.id}:started:first-pass`)];
    const encounterId = scene?.presentation?.encounterId;
    if (scene?.presentation?.startsEncounter === true && encounterId) {
      events.push(semanticEvent(scene, "FOREST_ENCOUNTER_STARTED", `${encounterId}:started:first-pass`, { encounterId }, ["encounter"]));
    }
    for (const fact of Array.isArray(scene.worldFacts) ? scene.worldFacts : []) {
      events.push(semanticEvent(scene, "FOREST_WORLD_FACT_EXPOSED", `${fact.id}:exposed:${scene.id}:first-pass`, {
        world_fact_id: fact.id,
        exposure_mode: fact.exposureMode,
        visibility_strength: fact.visibilityStrength || "subtle",
        required_for_core_progression: fact.requiredForCoreProgression === true,
      }, ["world-fact", "exposure"]));
    }
    await store.commit(commandFor(scene, "started", events), ACTIVE_META_KEY, state);
    sync().catch(() => {});
    return Object.freeze({ state, replayed: false });
  }

  async function useForcedPerspective(sceneId, perspectiveId) {
    const store = globalThis.SolivocNarrativeStore;
    if (!store?.commit) throw new Error("narrative_store_unavailable");
    const { document } = await load();
    const scene = sceneById(document, String(sceneId || ""));
    if (!scene) throw new Error("unknown_story_scene");
    const tutorial = forcedPerspectiveSteps(scene).find((step) => step.perspectiveId === String(perspectiveId || ""));
    if (!tutorial) throw new Error("unknown_forced_perspective");
    const current = await restore();
    if (!current || current.sceneId !== scene.id || current.status !== "active") throw new Error("story_scene_not_active");
    if (current.forcedTutorials?.[tutorial.perspectiveId]?.used === true) {
      sync().catch(() => {});
      return Object.freeze({ state: current, replayed: true });
    }
    const nextState = Object.freeze({
      ...current,
      forcedTutorials: {
        ...(current.forcedTutorials || {}),
        [tutorial.perspectiveId]: {
          used: true,
          tutorialSceneId: tutorial.sceneId,
          characterId: tutorial.characterId,
          profileEligible: false,
          preferenceEligible: false,
          reason: "forced_tutorial",
          usedAt: new Date().toISOString(),
        },
      },
    });
    const event = semanticEvent(scene, "FOREST_THREAD_STATE_CHANGED", `${tutorial.sceneId}:${tutorial.perspectiveId}:forced-tutorial:first-pass`, {
      threadId: tutorial.threadId,
      characterId: tutorial.characterId,
      perspectiveId: tutorial.perspectiveId,
      borrowedPerspective: { seen: true, forcedTutorialUsed: true },
      familiarityEligible: true,
      profileEligible: false,
      preferenceEligible: false,
      reason: "forced_tutorial",
      effectStatus: tutorial.effectStatus || "TBD_AUTHORED",
    }, ["forced-tutorial", "perspective", tutorial.characterId]);
    await store.commit(commandFor(scene, `forced-perspective:${tutorial.perspectiveId}`, [event]), ACTIVE_META_KEY, nextState);
    sync().catch(() => {});
    return Object.freeze({ state: nextState, replayed: false });
  }

  async function completeScene(sceneId = DEFAULT_SCENE_ID) {
    const store = globalThis.SolivocNarrativeStore;
    if (!store?.commit) throw new Error("narrative_store_unavailable");
    const { document } = await load();
    const scene = sceneById(document, String(sceneId || ""));
    if (!scene) throw new Error("unknown_story_scene");
    const current = await restore();
    if (!current || current.sceneId !== scene.id) throw new Error("story_scene_not_active");
    if (current.status === "completed") {
      sync().catch(() => {});
      return Object.freeze({ state: current, replayed: true });
    }
    const incomplete = forcedPerspectiveSteps(scene).find((step) => current.forcedTutorials?.[step.perspectiveId]?.used !== true);
    if (incomplete) throw new Error("story_forced_tutorial_incomplete");
    const state = stateFor(scene, "completed", current);
    const event = semanticEvent(scene, "FOREST_LEVEL_COMPLETED", `${scene.id}:completed:first-pass`);
    await store.commit(commandFor(scene, "completed", [event]), ACTIVE_META_KEY, state);
    sync().catch(() => {});
    return Object.freeze({ state, replayed: false });
  }

  globalThis.SolivocForestStory = Object.freeze({
    bootstrap,
    beginScene,
    useForcedPerspective,
    completeScene,
    restore,
    sync,
    validateScenesDocument,
    beforeGameplaySteps,
    forcedPerspectiveSteps,
    defaultSceneId: DEFAULT_SCENE_ID,
    scenesFile: SCENES_FILE,
  });
})();
