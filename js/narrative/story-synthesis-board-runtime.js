/* L99 production-board preflight. Keeps authored Synthesis progression fail-closed before scene start. */
(() => {
  if (globalThis.SolivocStorySynthesisBoard) return;
  const WORLD = "forest", MARK = "__solivocSynthesisBoardPreflight";
  let runtimeValue = globalThis.SolivocForestStory;
  const arr = (value) => Array.isArray(value) ? value : [];
  const txt = (value) => String(value ?? "").trim();
  const num = (value) => Math.max(0, Number(value) || 0);

  async function preflight(runtime, sceneId) {
    const snapshot = await runtime.bootstrap();
    const scene = arr(snapshot?.document?.scenes).find((item) => item?.id === txt(sceneId || runtime.defaultSceneId)) || null;
    if (!scene || scene.requiredPrimitive !== "world-synthesis") return { snapshot, scene };

    const primitives = globalThis.SolivocStoryPrimitives;
    if (!primitives?.loadContract || !primitives?.primitiveProjection) throw new Error("story_primitives_unavailable");
    const contract = await primitives.loadContract();
    const definition = contract?.worldSynthesis;
    const validation = primitives.validateWorldSynthesisBoard?.(definition) || { ok: false };
    if (definition?.betaRunnable !== true || validation.ok !== true) {
      const error = new Error("story_world_synthesis_authored_board_required");
      error.code = "story_world_synthesis_authored_board_required";
      error.validation = validation;
      throw error;
    }

    const projected = await primitives.primitiveProjection();
    if (projected?.status !== "ready") {
      const error = new Error(`story_primitive_projection_unavailable:${projected?.reason || "unknown"}`);
      error.code = "story_primitive_projection_unavailable";
      throw error;
    }
    const projection = projected.projection || {};
    if (num(projection?.world?.highest_completed_level) < 98 || !txt(projection?.synthesis?.first_companion)) {
      const error = new Error("story_world_synthesis_prerequisite_missing");
      error.code = "story_world_synthesis_prerequisite_missing";
      throw error;
    }
    return { snapshot, scene };
  }

  function wrap(runtime) {
    if (!runtime?.bootstrap || runtime[MARK] === true) return runtime;
    const beginScene = runtime.beginScene?.bind(runtime);
    if (!beginScene) return runtime;
    return Object.freeze({
      ...runtime,
      async beginScene(sceneId, ...args) {
        await preflight(runtime, sceneId);
        return beginScene(sceneId, ...args);
      },
      [MARK]: true,
    });
  }

  function bind() {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, "SolivocForestStory");
    if (descriptor?.configurable === false) return false;
    const previousGet = typeof descriptor?.get === "function" ? descriptor.get.bind(globalThis) : null;
    const previousSet = typeof descriptor?.set === "function" ? descriptor.set.bind(globalThis) : null;
    let local = previousGet ? previousGet() : runtimeValue;
    const read = () => previousGet ? previousGet() : local;
    const write = (value) => { if (previousSet) previousSet(value); else local = value; };
    const install = (value) => { write(value); if (read()) write(wrap(read())); runtimeValue = read(); };
    if (local) install(local);
    try {
      Object.defineProperty(globalThis, "SolivocForestStory", { configurable: true, enumerable: true, get: read, set: install });
      return true;
    } catch { return false; }
  }

  globalThis.SolivocStorySynthesisBoard = Object.freeze({ preflight, installRuntimeBinding: bind });
  bind();
})();
