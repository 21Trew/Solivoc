/* L99 production-board preflight and data-driven phase presentation binding. */
(() => {
  if (globalThis.SolivocStorySynthesisBoard) return;
  const WORLD = "forest", MARK = "__solivocSynthesisBoardPreflight";
  let runtimeValue = globalThis.SolivocForestStory, presentationObserver = null, presentationBusy = false;
  const arr = (value) => Array.isArray(value) ? value : [];
  const txt = (value) => String(value ?? "").trim();
  const num = (value) => Math.max(0, Number(value) || 0);

  async function contractAndDefinition() {
    const primitives = globalThis.SolivocStoryPrimitives;
    if (!primitives?.loadContract) throw new Error("story_primitives_unavailable");
    const contract = await primitives.loadContract();
    return { primitives, contract, definition: contract?.worldSynthesis };
  }

  async function preflight(runtime, sceneId) {
    const snapshot = await runtime.bootstrap();
    const scene = arr(snapshot?.document?.scenes).find((item) => item?.id === txt(sceneId || runtime.defaultSceneId)) || null;
    if (!scene || scene.requiredPrimitive !== "world-synthesis") return { snapshot, scene };

    const { primitives, definition } = await contractAndDefinition();
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

  function phaseFromModal(modal, definition) {
    const label = txt(modal?.querySelector("small")?.textContent);
    const match = label.match(/СИНТЕЗ\s*·\s*ЭТАП\s*(\d+)/i);
    if (!match) return null;
    const authored = arr(definition?.phases).find((phase) => num(phase.order) === num(match[1]));
    return arr(definition?.board?.phases).find((phase) => phase.id === authored?.id) || null;
  }

  async function bindPhasePresentation() {
    if (presentationBusy || typeof document === "undefined") return;
    const modal = document.getElementById("storyPrimitiveModal");
    if (!modal || modal.hidden) return;
    presentationBusy = true;
    try {
      const { definition } = await contractAndDefinition();
      const phase = phaseFromModal(modal, definition);
      if (!phase) return;
      const relationMap = new Map(arr(definition?.board?.relations).map((relation) => [relation.id, relation]));
      const candidates = new Set(arr(phase.candidateRelationIds).length ? phase.candidateRelationIds : relationMap.keys());
      for (const button of modal.querySelectorAll(".story-primitive-relation[data-id]")) {
        button.hidden = !candidates.has(button.dataset.id);
      }

      const detail = modal.querySelector(".story-primitive-detail");
      if (!detail || !txt(detail.textContent).startsWith("Модель пока не выдерживает проверку")) return;
      const selected = [...modal.querySelectorAll(".story-primitive-relation.selected[data-id]:not([hidden])")].map((button) => relationMap.get(button.dataset.id)).filter(Boolean);
      const authoredFailure = selected.find((relation) => relation.truth === "distractor" && typeof relation.feedback === "string");
      detail.textContent = authoredFailure?.feedback || phase.hint || "Проверь, какая связь действительно подтверждается текущим состоянием участка.";
    } finally {
      presentationBusy = false;
    }
  }

  function installPresentationBinding() {
    if (typeof document === "undefined" || presentationObserver) return false;
    presentationObserver = new MutationObserver(() => { bindPhasePresentation().catch(() => {}); });
    presentationObserver.observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["hidden", "class"] });
    bindPhasePresentation().catch(() => {});
    return true;
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

  globalThis.SolivocStorySynthesisBoard = Object.freeze({ preflight, bindPhasePresentation, installPresentationBinding, installRuntimeBinding: bind });
  bind();
  installPresentationBinding();
})();
