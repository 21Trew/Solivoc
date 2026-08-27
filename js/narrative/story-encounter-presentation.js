/* Generic player-facing presentation for routed Forest encounters. Uses authored kernels, not final dialogue. */
(() => {
  if (globalThis.SolivocStoryEncounterPresentation) return;

  const WORLD_ID = "forest";
  const PACKAGE_VERSION = "0.03";
  const FILE = "data/encounter-presentation.json";
  const RUNTIME_MARK = "__solivocEncounterPresentationIntegrated";
  const RENDER_MARK = "__solivocEncounterPresentationRender";
  const NAMES = Object.freeze({ cat: "Кот", owl: "Сова", fox: "Лис", forest_elemental: "Лес" });
  const OUTCOME_LABELS = Object.freeze({
    UNDERSTANDING_EARNED: "Способ стал понятнее",
    RELATIONSHIP_HISTORY_EARNED: "Общая история продолжилась",
    RECIPROCITY_EARNED: "Вы повлияли друг на друга",
    TEMPORARY_ALLIANCE_COMPLETED: "Совместная задача завершена",
    COOPERATION_TRANSFER_EARNED: "Совместный способ сработал в новом контексте",
  });

  let contractPromise = null;
  let contractValue = null;
  let packageData = null;
  let runtimeValue = globalThis.SolivocForestStory;
  let renderInstalled = false;

  const array = (value) => Array.isArray(value) ? value : [];
  const object = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const text = (value) => String(value ?? "").trim();

  function charName(id) { return NAMES[id] || text(id) || "Персонаж"; }
  function castLabel(ids = []) { return array(ids).map(charName).join(" + "); }
  function mascot(id) {
    const value = text(id);
    if (!["cat", "owl", "fox"].includes(value)) return null;
    return `./icons/mascot-${value}.svg`;
  }

  function validateContract(value) {
    const errors = [];
    if (!value || typeof value !== "object" || Array.isArray(value)) errors.push("presentation_not_object");
    if (value?.schemaVersion !== 1) errors.push("unsupported_presentation_schema");
    if (value?.worldId !== WORLD_ID) errors.push("invalid_presentation_world");
    if (value?.packageVersion !== PACKAGE_VERSION) errors.push("invalid_presentation_package");
    if (!text(value?.presentationContractVersion)) errors.push("missing_presentation_contract_version");
    if (!value?.variants || typeof value.variants !== "object" || Array.isArray(value.variants)) errors.push("missing_presentation_variants");
    return { ok: errors.length === 0, errors };
  }

  async function loadContract() {
    if (contractValue) return contractValue;
    if (!contractPromise) contractPromise = (async () => {
      const content = globalThis.SolivocWorldContent;
      if (!content?.loadManifest || !content?.loadRuntimeFile) throw new Error("world_content_loader_unavailable");
      const manifest = await content.loadManifest(WORLD_ID, PACKAGE_VERSION);
      if (!array(manifest?.runtimeFiles).includes(FILE)) throw new Error("encounter_presentation_not_in_manifest");
      const value = await content.loadRuntimeFile(manifest, FILE);
      const validation = validateContract(value);
      if (!validation.ok) throw Object.assign(new Error("invalid_encounter_presentation"), { validation });
      contractValue = Object.freeze(value);
      return contractValue;
    })().catch((error) => { contractPromise = null; throw error; });
    return contractPromise;
  }

  function definitionFor(lifecycle, snapshot = packageData) {
    return array(snapshot?.encounters?.encounters).find((item) => item?.id === lifecycle?.encounterId) || null;
  }

  function modelFor(lifecycle, contract = contractValue, snapshot = packageData) {
    if (!lifecycle || !contract) return null;
    const authored = contract?.variants?.[lifecycle.variantId] || contract?.fixedEncounters?.[lifecycle.variantId] || null;
    if (!authored) return null;
    const definition = definitionFor(lifecycle, snapshot);
    const variant = array(definition?.variants).find((item) => item?.id === lifecycle.variantId) || null;
    return Object.freeze({
      encounterId: lifecycle.encounterId,
      variantId: lifecycle.variantId,
      participants: Object.freeze([...array(lifecycle.participants)]),
      window: Object.freeze([...array(lifecycle.window)]),
      function: text(definition?.function),
      relationshipTarget: text(variant?.relationshipTarget),
      coreContradiction: text(authored.coreContradiction),
      copyStatus: text(contract.copyStatus),
      outcome: Object.freeze({ ...object(authored.outcome) }),
    });
  }

  function requiredStartPolicy(level, contract = contractValue) {
    const current = Number(level);
    for (const [encounterId, policy] of Object.entries(object(contract?.encounterPolicies))) {
      if (Number(policy?.requiredStartLevel) === current) return Object.freeze({ encounterId, ...policy });
    }
    return null;
  }

  async function ensureRequiredStartResolved(state) {
    const policy = requiredStartPolicy(state?.levelId);
    if (!policy) return null;
    const runtime = globalThis.SolivocForestStory;
    const lifecycle = runtime?.encounterLifecycle?.() || globalThis.SolivocStoryEncounterLifecycle?.current?.();
    if (lifecycle?.status === "active" && lifecycle.encounterId === policy.encounterId) return lifecycle;
    const decision = await runtime?.routeEncounterForLevel?.(Number(state.levelId));
    if (decision?.status === "selected") {
      const started = await runtime.beginRoutedEncounter?.(state.sceneId, decision);
      const active = started?.encounterLifecycle || runtime.encounterLifecycle?.() || globalThis.SolivocStoryEncounterLifecycle?.current?.();
      if (active?.status === "active" && active.encounterId === policy.encounterId) {
        await maybePresentStart(state);
        return active;
      }
    }
    const error = new Error(`story_encounter_required_start_unresolved:${policy.encounterId}`);
    error.code = "story_encounter_required_start_unresolved";
    error.encounterId = policy.encounterId;
    error.routingDecision = decision || null;
    throw error;
  }

  function relationshipMilestone(snapshot, characterId, milestone) {
    const rel = snapshot?.relationships?.[characterId] || {};
    return rel?.milestones?.[milestone] === true || rel?.[milestone] === true;
  }

  function outcomePlan(lifecycle, model, routingProjection) {
    if (!lifecycle || lifecycle.status !== "active" || !model) return Object.freeze({ status: "not-active" });
    const outcome = object(model.outcome);
    if (outcome.requiredPrimitive) return Object.freeze({ status: "primitive-required", requiredPrimitive: text(outcome.requiredPrimitive) });

    const gameplayBeatIds = array(lifecycle.beatOrder).filter((id) => text(id).startsWith("gameplay:"));
    const minimum = Math.max(0, Number(outcome.minGameplayBeats) || 0);
    if (gameplayBeatIds.length < minimum) return Object.freeze({ status: "evidence-incomplete", required: minimum, actual: gameplayBeatIds.length, gameplayBeatIds: Object.freeze([...gameplayBeatIds]) });

    const snapshot = object(routingProjection?.snapshot || routingProjection?.routing_snapshot || routingProjection);
    const milestoneRows = {};
    const missingPrerequisites = [];
    for (const characterId of array(lifecycle.participants).filter((id) => ["cat", "owl", "fox"].includes(id))) {
      for (const milestone of array(outcome.requiredMilestones)) {
        if (!relationshipMilestone(snapshot, characterId, milestone)) missingPrerequisites.push(Object.freeze({ characterId, milestone }));
      }
      for (const milestone of array(outcome.ensureMilestones)) {
        if (!relationshipMilestone(snapshot, characterId, milestone)) (milestoneRows[characterId] ||= []).push(milestone);
      }
    }
    if (missingPrerequisites.length) return Object.freeze({ status: "prerequisite-missing", missing: Object.freeze(missingPrerequisites), gameplayBeatIds: Object.freeze([...gameplayBeatIds]) });

    return Object.freeze({
      status: "ready",
      outcomeKey: text(outcome.key) || "authored-outcome",
      milestones: Object.freeze(Object.fromEntries(Object.entries(milestoneRows).map(([id, values]) => [id, Object.freeze([...values])]))),
      temporaryAlliance: outcome.temporaryAlliance === true,
      evidencePolicy: text(outcome.evidencePolicy) || "encounter_gameplay_completed",
      gameplayBeatIds: Object.freeze([...gameplayBeatIds]),
    });
  }

  function installStyles() {
    if (typeof document === "undefined" || document.getElementById("storyEncounterPresentationStyles")) return;
    const style = document.createElement("style");
    style.id = "storyEncounterPresentationStyles";
    style.textContent = `.story-encounter-modal{position:fixed;inset:0;z-index:14120;display:grid;place-items:center;padding:16px;background:#080b18df;backdrop-filter:blur(14px)}.story-encounter-modal[hidden]{display:none}.story-encounter-card{width:min(460px,100%);max-height:min(720px,calc(100vh - 32px));overflow:auto;border:1px solid #ffffff1c;border-radius:26px;background:#172a2b;color:#fff}.story-encounter-visual{min-height:180px;display:grid;place-items:end center;padding-top:18px;background:linear-gradient(180deg,#385d55,#1a302c)}.story-encounter-cast{display:flex;align-items:end}.story-encounter-cast img{width:116px;height:116px}.story-encounter-cast img+img{margin-left:-34px}.story-encounter-copy{padding:20px}.story-encounter-copy small{color:#aee4bd;font-size:9px;font-weight:950;letter-spacing:.14em}.story-encounter-copy h2{margin:7px 0 4px;font-size:25px}.story-encounter-meta{font-size:10px;color:#bfcfcb}.story-encounter-question{margin:16px 0;padding:13px 14px;border:1px solid #ffffff15;border-radius:15px;background:#ffffff08;font-size:13px;line-height:1.45}.story-encounter-note{font-size:10px;line-height:1.5;color:#c8d4d1}.story-encounter-action{width:100%;min-height:44px;margin-top:16px;border:0;border-radius:14px;background:#eef3dc;color:#23352e;font-weight:950}.story-encounter-banner{display:grid;grid-template-columns:auto 1fr;gap:10px;align-items:center;margin:0 0 10px;padding:9px 11px;border:1px solid #ffffff16;border-radius:16px;background:#17332ecc}.story-encounter-banner[hidden]{display:none}.story-encounter-banner-cast{display:flex}.story-encounter-banner-cast img{width:36px;height:36px}.story-encounter-banner-cast img+img{margin-left:-12px}.story-encounter-banner-copy small{display:block;color:#9edab0;font-size:7px}.story-encounter-banner-copy b{display:block;font-size:10px}.story-encounter-banner-copy span{display:block;color:#c4cfcc;font-size:8px;line-height:1.35}`;
    document.head.appendChild(style);
  }

  function ensureModal() {
    installStyles();
    let modal = document.getElementById("storyEncounterModal");
    if (modal) return modal;
    modal = document.createElement("div");
    modal.id = "storyEncounterModal";
    modal.className = "story-encounter-modal";
    modal.hidden = true;
    modal.innerHTML = `<div class="story-encounter-card" role="dialog" aria-modal="true" aria-labelledby="storyEncounterTitle"><div class="story-encounter-visual"><div class="story-encounter-cast"></div></div><div class="story-encounter-copy"><small></small><h2 id="storyEncounterTitle"></h2><div class="story-encounter-meta"></div><div class="story-encounter-question"></div><div class="story-encounter-note"></div><button class="story-encounter-action" type="button"></button></div></div>`;
    document.body.appendChild(modal);
    return modal;
  }

  function castMarkup(ids) {
    return array(ids).map((id) => {
      const src = mascot(id);
      return src ? `<img src="${src}" alt="${charName(id)}">` : `<span aria-label="${charName(id)}"></span>`;
    }).join("");
  }

  async function showCard(model, lifecycle, phase) {
    if (typeof document === "undefined") return true;
    const modal = ensureModal();
    const [start, end] = array(lifecycle.window);
    modal.querySelector(".story-encounter-cast").innerHTML = castMarkup(lifecycle.participants);
    modal.querySelector("small").textContent = phase === "outcome" ? "ИСТОРИЯ · ИТОГ ВСТРЕЧИ" : "ИСТОРИЯ · ВСТРЕЧА";
    modal.querySelector("h2").textContent = castLabel(lifecycle.participants) || "Встреча";
    modal.querySelector(".story-encounter-meta").textContent = `${model.function || "Сюжетная встреча"} · уровни ${start}–${end}`;
    modal.querySelector(".story-encounter-question").textContent = model.coreContradiction || "Эта встреча меняет общий контекст.";
    modal.querySelector(".story-encounter-note").textContent = phase === "outcome"
      ? (OUTCOME_LABELS[model.outcome?.key] || "Встреча оставила новое состояние общей истории.")
      : "Это не выбор «любимого» персонажа: встреча продолжает уже прожитую историю.";
    const button = modal.querySelector(".story-encounter-action");
    button.textContent = phase === "outcome" ? "Продолжить историю →" : "Продолжить вместе →";
    modal.hidden = false;
    return new Promise((resolve) => {
      button.onclick = () => { modal.hidden = true; resolve(true); };
      button.focus?.();
    });
  }

  async function maybePresentStart(state) {
    const runtime = globalThis.SolivocForestStory;
    const lifecycle = runtime?.encounterLifecycle?.() || globalThis.SolivocStoryEncounterLifecycle?.current?.();
    if (!state || !lifecycle || lifecycle.status !== "active") return null;
    const contract = await loadContract();
    const model = modelFor(lifecycle, contract, packageData);
    if (!model) throw new Error(`encounter_presentation_missing:${lifecycle.variantId}`);
    const beatId = `intro:${lifecycle.variantId}`;
    if (lifecycle.beats?.[beatId]) return model;

    await showCard(model, lifecycle, "intro");
    if (model.outcome?.temporaryAlliance === true) await runtime.startTemporaryAlliance?.();
    await runtime.recordEncounterBeat?.(beatId, { kind: "encounter-intro", evidenceStatus: "ACKNOWLEDGED" });
    syncBanner(state);
    return model;
  }

  async function resolveOutcome(state) {
    const runtime = globalThis.SolivocForestStory;
    let lifecycle = runtime?.encounterLifecycle?.() || globalThis.SolivocStoryEncounterLifecycle?.current?.();
    if (!state || !lifecycle || lifecycle.status !== "active") return null;
    const end = Number(lifecycle.window?.[1]);
    if (Number(state.levelId) < end) return null;

    const contract = await loadContract();
    const model = modelFor(lifecycle, contract, packageData);
    if (!model) throw new Error(`encounter_presentation_missing:${lifecycle.variantId}`);
    if (model.outcome?.requiredPrimitive) throw new Error(`story_scene_primitive_unavailable:${model.outcome.requiredPrimitive}`);

    const gameplayBeatId = `gameplay:${state.sceneId}`;
    if (!lifecycle.beats?.[gameplayBeatId]) {
      await runtime.recordEncounterBeat?.(gameplayBeatId, { kind: "core-gameplay", evidenceStatus: "COMPLETED" });
      lifecycle = runtime.encounterLifecycle?.() || globalThis.SolivocStoryEncounterLifecycle?.current?.();
    }

    const projection = await globalThis.SolivocStoryProjectionRouting?.routingProjection?.();
    if (projection?.status !== "ready") {
      const error = new Error(`story_encounter_outcome_projection_unavailable:${projection?.reason || "unknown"}`);
      error.code = "story_encounter_outcome_projection_unavailable";
      throw error;
    }

    const plan = outcomePlan(lifecycle, model, projection);
    if (plan.status === "primitive-required") throw new Error(`story_scene_primitive_unavailable:${plan.requiredPrimitive}`);
    if (plan.status === "evidence-incomplete") {
      const error = new Error("story_encounter_outcome_evidence_incomplete");
      error.code = "story_encounter_outcome_evidence_incomplete";
      error.outcomePlan = plan;
      throw error;
    }
    if (plan.status === "prerequisite-missing") {
      const error = new Error("story_encounter_outcome_prerequisite_missing");
      error.code = "story_encounter_outcome_prerequisite_missing";
      error.outcomePlan = plan;
      throw error;
    }
    if (plan.status !== "ready") return null;

    await showCard(model, lifecycle, "outcome");
    await runtime.completeRoutedEncounter?.({
      outcomeKey: plan.outcomeKey,
      milestones: plan.milestones,
      temporaryAllianceCompleted: plan.temporaryAlliance,
      evidenceBeatIds: plan.gameplayBeatIds,
    });
    syncBanner(state);
    return plan;
  }

  function syncBanner(state = null) {
    if (typeof document === "undefined") return;
    const game = document.querySelector(".game");
    if (!game) return;
    let banner = document.getElementById("storyEncounterBanner");
    if (!banner) {
      banner = document.createElement("section");
      banner.id = "storyEncounterBanner";
      banner.className = "story-encounter-banner";
      banner.innerHTML = `<div class="story-encounter-banner-cast"></div><div class="story-encounter-banner-copy"><small></small><b></b><span></span></div>`;
      game.insertBefore(banner, game.querySelector(".draw-row") || game.firstChild);
    }
    const runtime = globalThis.SolivocForestStory;
    const lifecycle = runtime?.encounterLifecycle?.() || globalThis.SolivocStoryEncounterLifecycle?.current?.();
    const current = state || (() => { try { return globalThis.state || null; } catch { return null; } })();
    if (!lifecycle || lifecycle.status !== "active" || current?.mode !== "story") { banner.hidden = true; return; }
    const model = modelFor(lifecycle, contractValue, packageData);
    if (!model) { banner.hidden = true; return; }
    const gameplayCount = array(lifecycle.beatOrder).filter((id) => text(id).startsWith("gameplay:")).length;
    const [start, end] = array(lifecycle.window);
    banner.querySelector(".story-encounter-banner-cast").innerHTML = castMarkup(lifecycle.participants);
    banner.querySelector("small").textContent = `ВСТРЕЧА · ${castLabel(lifecycle.participants).toUpperCase()} · ${start}–${end}`;
    banner.querySelector("b").textContent = model.coreContradiction;
    banner.querySelector("span").textContent = `Пройдено этапов встречи: ${gameplayCount}`;
    banner.hidden = false;
  }

  function installRenderHook() {
    if (typeof document === "undefined" || renderInstalled) return false;
    const current = globalThis.render;
    if (typeof current !== "function" || current[RENDER_MARK] === true) return false;
    const wrapped = function encounterPresentationRender(...args) {
      const result = current(...args);
      try { syncBanner(); } catch {}
      return result;
    };
    try { Object.defineProperty(wrapped, RENDER_MARK, { value: true }); } catch {}
    globalThis.render = wrapped;
    renderInstalled = true;
    return true;
  }

  function gameState() {
    try { return globalThis.state || null; } catch { return null; }
  }

  function wrapRuntime(runtime) {
    if (!runtime?.bootstrap || runtime[RUNTIME_MARK] === true) return runtime;
    const originalBootstrap = runtime.bootstrap.bind(runtime);
    const originalBeginScene = runtime.beginScene?.bind(runtime);
    const originalCompleteScene = runtime.completeScene?.bind(runtime);

    async function bootstrap(...args) {
      const snapshot = await originalBootstrap(...args);
      packageData = snapshot;
      await loadContract();
      const current = gameState();
      if (current?.mode === "story" && snapshot?.active?.status === "active" && current.sceneId === snapshot.active.sceneId) {
        await maybePresentStart(snapshot.active);
      }
      return Object.freeze({ ...snapshot, encounterPresentation: contractValue });
    }

    async function beginScene(...args) {
      if (!originalBeginScene) throw new Error("story_begin_scene_unavailable");
      const result = await originalBeginScene(...args);
      if (!packageData) packageData = await originalBootstrap();
      await loadContract();
      await maybePresentStart(result?.state);
      return Object.freeze({ ...result, encounterPresentation: contractValue });
    }

    async function completeScene(...args) {
      if (!originalCompleteScene) throw new Error("story_complete_scene_unavailable");
      await loadContract();
      const state = await runtime.restore?.();
      if (state?.status === "active") {
        await ensureRequiredStartResolved(state);
        await resolveOutcome(state);
      }
      return originalCompleteScene(...args);
    }

    return Object.freeze({
      ...runtime,
      bootstrap,
      beginScene,
      completeScene,
      encounterPresentationModel() {
        const lifecycle = runtime.encounterLifecycle?.() || globalThis.SolivocStoryEncounterLifecycle?.current?.();
        return modelFor(lifecycle, contractValue, packageData);
      },
      [RUNTIME_MARK]: true,
    });
  }

  function installRuntimeBinding() {
    if (typeof document === "undefined") return false;
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

  globalThis.SolivocStoryEncounterPresentation = Object.freeze({
    file: FILE,
    validateContract,
    loadContract,
    modelFor,
    outcomePlan,
    requiredStartPolicy,
    ensureRequiredStartResolved,
    maybePresentStart,
    resolveOutcome,
    syncBanner,
    installRuntimeBinding,
    installRenderHook,
  });

  if (typeof document !== "undefined") {
    installRuntimeBinding();
    installStyles();
    installRenderHook();
    let attempts = 0;
    const timer = globalThis.setInterval?.(() => {
      attempts++;
      installRenderHook();
      if (renderInstalled || attempts > 200) globalThis.clearInterval?.(timer);
    }, 50);
  }
})();