/* Shared procedural generation policy for Story worlds. */
(() => {
  const GENERATION_VERSION = 1;
  const GUEST_SEED_KEY = "solivoc-story-player-seed-v1";
  const DEFAULT_WORLD_ID = "forest";
  const PROFILE_IDS = Object.freeze(["guided", "standard"]);
  const sceneRegistry = new Map();
  let preparedScene = null;

  function hash32(value) {
    let h = 2166136261;
    for (const ch of String(value || "")) {
      h ^= ch.charCodeAt(0);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function compactScope(value) {
    return `${hash32(`a:${value}`).toString(36)}${hash32(`b:${value}`).toString(36)}`;
  }

  function persistentGuestKey() {
    try {
      const existing = globalThis.localStorage?.getItem?.(GUEST_SEED_KEY);
      if (existing) return existing;
      const created = globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
      globalThis.localStorage?.setItem?.(GUEST_SEED_KEY, created);
      return created;
    } catch {
      return "guest-local";
    }
  }

  function currentPlayerKey() {
    try {
      if (typeof profile !== "undefined" && profile?.playerId) return `account:${profile.playerId}`;
    } catch {}
    return `guest:${persistentGuestKey()}`;
  }

  function normalizeContext(value = {}) {
    const level = Math.max(1, Math.trunc(Number(value.level) || 1));
    const worldId = String(value.worldId || DEFAULT_WORLD_ID).trim().toLowerCase() || DEFAULT_WORLD_ID;
    const sceneId = String(value.sceneId || "").trim();
    const generation = value.generation && typeof value.generation === "object" ? value.generation : {};
    return Object.freeze({ worldId, sceneId, level, generation });
  }

  function registryKey(worldId, level) {
    return `${String(worldId || DEFAULT_WORLD_ID).toLowerCase()}:${Math.max(1, Math.trunc(Number(level) || 1))}`;
  }

  function registerScene(scene, worldId = DEFAULT_WORLD_ID) {
    if (!scene || !Number.isInteger(scene.level) || scene.level < 1) return null;
    const context = normalizeContext({ ...scene, worldId });
    const profileId = context.generation?.profile;
    if (profileId != null && !PROFILE_IDS.includes(String(profileId))) throw new Error(`unknown_story_generation_profile:${profileId}`);
    sceneRegistry.set(registryKey(context.worldId, context.level), context);
    return context;
  }

  function registerDocument(document, fallbackWorldId = DEFAULT_WORLD_ID) {
    const worldId = String(document?.worldId || fallbackWorldId).toLowerCase();
    const scenes = Array.isArray(document?.scenes) ? document.scenes : [];
    for (const scene of scenes) registerScene(scene, worldId);
    return scenes.length;
  }

  function prepare(scene, worldId = DEFAULT_WORLD_ID) {
    preparedScene = registerScene(scene, worldId) || normalizeContext({ worldId, level: scene?.level || 1 });
    return preparedScene;
  }

  function defaultProfileForLevel(level) {
    return Math.max(1, Math.trunc(Number(level) || 1)) <= 3 ? "guided" : "standard";
  }

  function profileFor(level, context = null) {
    const explicit = context?.generation?.profile;
    return explicit && PROFILE_IDS.includes(String(explicit)) ? String(explicit) : defaultProfileForLevel(level);
  }

  function fallbackStandardConfig(level, rng = Math.random) {
    const l = Math.max(1, Math.trunc(Number(level) || 1));
    const cols = l <= 10 ? 3 : l <= 25 ? (rng() < 0.5 ? 3 : 4) : (rng() < 0.5 ? 4 : 5);
    const catRanges = { 3: [3, 4], 4: [4, 6], 5: [6, 7] };
    const [catMin, catMax] = catRanges[cols];
    const cats = catMin + Math.floor(rng() * (catMax - catMin + 1));
    const difficulty = l <= 12 ? 1 : l <= 35 ? 2 : l <= 80 ? 3 : l <= 160 ? 4 : 5;
    const words = difficulty === 1 ? [3, 5] : difficulty === 2 ? [4, 6] : difficulty === 3 ? [4, 7] : [5, 7];
    return { cols, cats, difficulty, words };
  }

  function configForLevel(level, rng = Math.random, context = null) {
    const selected = profileFor(level, context);
    if (selected === "guided") return { cols: 3, cats: 3, difficulty: 1, words: [3, 3] };
    try {
      if (typeof regularConfig === "function") return regularConfig(Math.max(1, Number(level) || 1), rng, null);
    } catch {}
    return fallbackStandardConfig(level, rng);
  }

  function legacySceneIdFromSeed(seed) {
    const match = String(seed || "").match(/:(SCN_[A-Za-z0-9_]+):/);
    return match?.[1] || "";
  }

  function contextFor(level, options = {}) {
    const worldId = String(options.storyWorldId || options.worldId || preparedScene?.worldId || DEFAULT_WORLD_ID).toLowerCase();
    const registered = sceneRegistry.get(registryKey(worldId, level));
    if (registered) return registered;
    if (preparedScene?.worldId === worldId && preparedScene?.level === +level) return preparedScene;
    let stateScene = null;
    try {
      const current = typeof state !== "undefined" ? state : globalThis.state;
      if (current?.mode === "story" && +current.level === +level) stateScene = current.sceneId;
    } catch {}
    return normalizeContext({
      worldId,
      level,
      sceneId: options.storySceneId || stateScene || legacySceneIdFromSeed(options.seed) || `level-${Math.max(1, Math.trunc(Number(level) || 1))}`,
    });
  }

  function seedFor(context, playerKey = null) {
    const c = normalizeContext(context);
    const playerScope = compactScope(playerKey || currentPlayerKey());
    const anchor = c.sceneId || `level-${c.level}`;
    return `story:${c.worldId}:${anchor}:g${GENERATION_VERSION}:p${playerScope}`;
  }

  function activeStorySeed(level, context) {
    try {
      const current = typeof state !== "undefined" ? state : globalThis.state;
      if (current?.mode !== "story" || +current.level !== +level || !current.seed) return null;
      if (context?.sceneId && current.sceneId && context.sceneId !== current.sceneId) return null;
      return String(current.seed);
    } catch {
      return null;
    }
  }

  function optionsForLevel(level, options = {}, playerKey = null) {
    const context = contextFor(level, options);
    const preservedSeed = options.preserveStorySeed === false ? null : activeStorySeed(level, context);
    return {
      ...options,
      mode: "story",
      seed: preservedSeed || seedFor(context, playerKey),
      cardSourceMode: context.generation?.cardSourceMode || options.cardSourceMode || "words",
      forceSolvable: context.generation?.forceSolvable !== false,
      storyWorldId: context.worldId,
      storySceneId: context.sceneId || undefined,
      storyGenerationVersion: GENERATION_VERSION,
    };
  }

  function mark(fn, kind) {
    try { Object.defineProperty(fn, "__solivocStoryGeneration", { value: kind, configurable: false }); } catch {}
    return fn;
  }

  function installConfigHook() {
    const current = globalThis.configForMode;
    if (typeof current !== "function" || current.__solivocStoryGeneration === "config") return false;
    globalThis.configForMode = mark(function storyGenerationConfig(level, mode, rng, special = null, opts = {}) {
      if (mode === "story") return configForLevel(level, rng, contextFor(level, opts));
      return current(level, mode, rng, special, opts);
    }, "config");
    return true;
  }

  function installBuildHook() {
    const current = globalThis.buildGeneratedLevel;
    if (typeof current !== "function" || current.__solivocStoryGeneration === "build") return false;
    globalThis.buildGeneratedLevel = mark(function storyGeneratedLevel(level, options = {}) {
      return current(level, options?.mode === "story" ? optionsForLevel(level, options) : options);
    }, "build");
    return true;
  }

  function installMakeHook() {
    const current = globalThis.makeLevel;
    if (typeof current !== "function" || current.__solivocStoryGeneration === "make") return false;
    globalThis.makeLevel = mark(function storyMakeLevel(level, options = {}) {
      return current(level, options?.mode === "story" ? optionsForLevel(level, options) : options);
    }, "make");
    return true;
  }

  function installRuntimeHook() {
    const runtime = globalThis.SolivocForestStory;
    if (!runtime?.bootstrap || runtime.bootstrap.__solivocStoryGenerationRuntime === true) return false;
    const originalBootstrap = runtime.bootstrap;
    const wrappedBootstrap = async (...args) => {
      const snapshot = await originalBootstrap(...args);
      if (snapshot?.document) registerDocument(snapshot.document, snapshot.document.worldId || DEFAULT_WORLD_ID);
      return snapshot;
    };
    try { Object.defineProperty(wrappedBootstrap, "__solivocStoryGenerationRuntime", { value: true }); } catch {}
    globalThis.SolivocForestStory = Object.freeze({ ...runtime, bootstrap: wrappedBootstrap });
    return true;
  }

  function installHooks() {
    installConfigHook();
    installBuildHook();
    installMakeHook();
    installRuntimeHook();
    return !!(
      globalThis.configForMode?.__solivocStoryGeneration === "config" &&
      globalThis.buildGeneratedLevel?.__solivocStoryGeneration === "build" &&
      globalThis.makeLevel?.__solivocStoryGeneration === "make"
    );
  }

  globalThis.SolivocStoryGeneration = Object.freeze({
    version: GENERATION_VERSION,
    profiles: PROFILE_IDS,
    registerScene,
    registerDocument,
    prepare,
    profileFor,
    configForLevel,
    contextFor,
    seedFor,
    activeStorySeed,
    optionsForLevel,
    installHooks,
    registerRuntimeSnapshot(snapshot) {
      if (snapshot?.document) return registerDocument(snapshot.document, snapshot.document.worldId || DEFAULT_WORLD_ID);
      return 0;
    },
  });

  if (typeof globalThis.setInterval === "function") {
    let stableTicks = 0, attempts = 0;
    const timer = globalThis.setInterval(() => {
      attempts++;
      const ready = installHooks();
      stableTicks = ready ? stableTicks + 1 : 0;
      if (stableTicks >= 20 || attempts >= 200) globalThis.clearInterval?.(timer);
    }, 50);
  }
  installHooks();
})();
