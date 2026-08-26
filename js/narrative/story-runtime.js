/* Minimal end-to-end Story runtime for the first Forest vertical slice. */
(() => {
  const WORLD_ID = "forest";
  const PACKAGE_VERSION = "0.03";
  const SCENES_FILE = "data/scenes.json";
  const DEFAULT_SCENE_ID = "SCN_FOREST_L001_CORE";
  const ACTIVE_META_KEY = "story:forest:active";
  const SCENES_SCHEMA = 1;
  const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.:-]*$/;
  let loaded = null;
  let onlineSyncInstalled = false;

  function validateScenesDocument(value) {
    const errors = [];
    if (!value || typeof value !== "object" || Array.isArray(value)) errors.push("scenes_not_object");
    if (value?.schemaVersion !== SCENES_SCHEMA) errors.push("unsupported_scenes_schema");
    if (value?.worldId !== WORLD_ID) errors.push("invalid_scenes_world");
    if (value?.packageVersion !== PACKAGE_VERSION) errors.push("invalid_scenes_package");
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
    return Object.freeze({
      worldId: WORLD_ID,
      packageVersion: PACKAGE_VERSION,
      sceneId: scene.id,
      areaId: scene.areaId,
      levelId: scene.level,
      status,
      startedAt: previous?.startedAt || now,
      completedAt: status === "completed" ? now : null,
    });
  }

  function commandFor(scene, eventKey, phase, payload = {}) {
    const semanticScope = `${scene.id}:${phase}:first-pass`;
    const commandId = `forest:${scene.id}:${phase}:v${PACKAGE_VERSION}`;
    return {
      commandId,
      transactionId: commandId,
      worldId: WORLD_ID,
      events: [{
        eventKey,
        semanticScope,
        areaId: scene.areaId,
        levelId: scene.level,
        sceneId: scene.id,
        payload,
        semanticTags: ["story", "first-pass"],
        canonVersion: { worldPackage: PACKAGE_VERSION },
      }],
    };
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
    await store.commit(commandFor(scene, "FOREST_LEVEL_STARTED", "started"), ACTIVE_META_KEY, state);
    sync().catch(() => {});
    return Object.freeze({ state, replayed: false });
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
    const state = stateFor(scene, "completed", current);
    await store.commit(commandFor(scene, "FOREST_LEVEL_COMPLETED", "completed"), ACTIVE_META_KEY, state);
    sync().catch(() => {});
    return Object.freeze({ state, replayed: false });
  }

  globalThis.SolivocForestStory = Object.freeze({
    bootstrap,
    beginScene,
    completeScene,
    restore,
    sync,
    validateScenesDocument,
    defaultSceneId: DEFAULT_SCENE_ID,
    scenesFile: SCENES_FILE,
  });
})();
