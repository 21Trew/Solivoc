/* Forest Level 2: mandatory Cat perspective tutorial with no invented gameplay effect. */
(() => {
  if (typeof document === "undefined" || globalThis.__solivocForestLevel2) return;
  globalThis.__solivocForestLevel2 = true;

  const WORLD_ID = "forest";
  const PREVIOUS_SCENE_ID = "SCN_FOREST_L001_CORE";
  const SCENE_ID = "SCN_FOREST_L002_CORE";
  const TUTORIAL_SCENE_ID = "SCN_FOREST_L002_CAT_PERSPECTIVE_TUTORIAL";
  const PERSPECTIVE_ID = "cat_memory_echo";
  let installed = false;
  let runtimeSnapshot = null;
  let refreshPending = false;

  function gameState() {
    try { return typeof state !== "undefined" ? state : null; } catch { return null; }
  }

  function isLevelTwoGame(value = gameState()) {
    return !!(value?.mode === "story" && value?.worldId === WORLD_ID && value?.sceneId === SCENE_ID && +value?.level === 2);
  }

  function currentScene() {
    const scenes = runtimeSnapshot?.document?.scenes;
    return Array.isArray(scenes) ? scenes.find((scene) => scene.id === SCENE_ID) || null : null;
  }

  function runtimeState() {
    return runtimeSnapshot?.active || null;
  }

  function tutorialUsed(value = runtimeState()) {
    return value?.sceneId === SCENE_ID && value?.forcedTutorials?.[PERSPECTIVE_ID]?.used === true;
  }

  function canEnterLevelTwo(value = runtimeState()) {
    if (value?.sceneId === SCENE_ID) return true;
    return value?.sceneId === PREVIOUS_SCENE_ID && value?.status === "completed";
  }

  function installStyles() {
    if (document.getElementById("forestLevel2Styles")) return;
    const style = document.createElement("style");
    style.id = "forestLevel2Styles";
    style.textContent = `
      .story-level2-modal{position:fixed;inset:0;z-index:14080;display:grid;place-items:center;padding:16px;background:#080b18d8;backdrop-filter:blur(14px)}.story-level2-modal[hidden]{display:none}
      .story-level2-card{width:min(430px,100%);overflow:hidden;border:1px solid #ffffff1b;border-radius:28px;background:linear-gradient(165deg,#233c32,#171d42 72%);color:#fff;box-shadow:0 30px 90px #000b}
      .story-level2-visual{position:relative;min-height:210px;display:grid;place-items:end center;background:radial-gradient(circle at 50% 72%,#d3b77d25,transparent 38%),linear-gradient(180deg,#49644f,#294239 55%,#182d28)}
      .story-level2-visual::after{content:"";position:absolute;inset:auto 10% -72px;height:150px;border-radius:50%;background:#122b24}.story-level2-visual img{position:relative;z-index:2;width:145px;height:145px;object-fit:contain;filter:drop-shadow(0 18px 20px #0008)}
      .story-level2-copy{padding:20px}.story-level2-copy small{display:block;color:#b9ddae;font-size:9px;font-weight:950;letter-spacing:.14em}.story-level2-copy h2{margin:7px 0 4px;font-size:28px}.story-level2-meta{color:#cad6cf;font-size:10px;font-weight:800}.story-level2-summary{margin:13px 0;color:#e1e7e4;font-size:12px;line-height:1.5}
      .story-level2-perspective{margin-top:14px;padding:13px;border:1px solid #ffffff14;border-radius:17px;background:#ffffff09}.story-level2-perspective b{display:block;font-size:12px}.story-level2-perspective p{margin:6px 0 0;color:#d1d9d5;font-size:10px;line-height:1.45}.story-level2-perspective em{display:block;margin-top:8px;color:#aebbb5;font-size:8px;font-style:normal}
      .story-level2-actions{display:grid;grid-template-columns:auto 1fr;gap:8px;margin-top:18px}.story-level2-actions button{min-height:44px;border:0;border-radius:14px;font:inherit;font-size:10px;font-weight:950}.story-level2-back{padding:0 14px;background:#ffffff0d;color:#ddd}.story-level2-use{background:#eef3dc;color:#23352e}
      @media(max-width:390px){.story-level2-card{border-radius:23px}.story-level2-visual{min-height:190px}.story-level2-visual img{width:130px;height:130px}}
      @media(prefers-reduced-motion:reduce){.story-level2-modal *{animation:none!important;transition:none!important}}
    `;
    document.head.appendChild(style);
  }

  function ensureModal() {
    let modal = document.getElementById("storyLevel2Modal");
    if (modal) return modal;
    modal = document.createElement("div");
    modal.id = "storyLevel2Modal";
    modal.className = "story-level2-modal";
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
    modal.innerHTML = `<div class="story-level2-card" role="dialog" aria-modal="true" aria-labelledby="storyLevel2Title">
      <div class="story-level2-visual"><img src="./icons/mascot-cat.svg" alt="Кот"></div>
      <div class="story-level2-copy"><small>ИСТОРИЯ · МИР ЛЕСА</small><h2 id="storyLevel2Title">Уже увиденное</h2><div class="story-level2-meta">Поляна · Уровень 2</div>
      <p class="story-level2-summary" id="storyLevel2Summary"></p>
      <div class="story-level2-perspective"><b>Эхо памяти</b><p>Уже увиденное может изменить понимание того, что перед тобой сейчас.</p><em>Обязательное знакомство с перспективой Кота. Этот шаг не считается выбором предпочтительной перспективы.</em></div>
      <div class="story-level2-actions"><button class="story-level2-back" type="button">Назад</button><button class="story-level2-use" type="button">Попробовать «Эхо памяти» →</button></div></div></div>`;
    document.body.appendChild(modal);
    modal.querySelector(".story-level2-back").onclick = closeModal;
    modal.addEventListener("click", (event) => { if (event.target === modal) closeModal(); });
    return modal;
  }

  function closeModal() {
    const modal = document.getElementById("storyLevel2Modal");
    if (!modal) return;
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
  }

  function attachStoryContext(scene) {
    const current = gameState();
    if (!current) return;
    current.worldId = WORLD_ID;
    current.sceneId = scene.id;
    current.areaId = scene.areaId;
    current.encounterId = scene.presentation?.encounterId || null;
    current.storyPackageVersion = "0.03";
    current.storyMeaning = scene.meaning || "";
    current.storyForcedPerspective = PERSPECTIVE_ID;
    current.bonusObjective = null;
    try { save?.({ immediate: true }); } catch {}
    try { syncGameCompanion?.(); } catch {}
  }

  function resumeGame() {
    closeModal();
    try { closeHub?.(); } catch {}
    try { render?.(); } catch {}
    try { updateCoach?.(); } catch {}
    try { syncGameCompanion?.(); } catch {}
    try { setBackgroundMusic?.(musicModeForState?.(gameState()) || "game"); } catch {}
  }

  function launchGeneratedLevel(scene) {
    const options = { mode: "story", storyWorldId: WORLD_ID, storySceneId: SCENE_ID };
    try { buildGeneratedLevel?.(2, options); }
    catch (error) { throw Object.assign(new Error("story_level2_generation_failed"), { cause: error }); }
    closeModal();
    try { closeHub?.(); } catch {}
    const result = makeLevel?.(2, options);
    if (result === false) throw new Error("story_level2_launch_failed");
    attachStoryContext(scene);
    try { track?.("story_forced_perspective_used", { world: WORLD_ID, scene: SCENE_ID, tutorialScene: TUTORIAL_SCENE_ID, perspective: PERSPECTIVE_ID, profileEligible: false }); } catch {}
  }

  async function usePerspectiveAndLaunch() {
    const runtime = globalThis.SolivocForestStory;
    if (!runtime?.beginScene || !runtime?.useForcedPerspective) throw new Error("story_runtime_unavailable");
    let current = await runtime.restore();
    if (current?.sceneId === PREVIOUS_SCENE_ID && current.status === "completed") {
      await runtime.beginScene(SCENE_ID);
      current = await runtime.restore();
    }
    if (current?.sceneId !== SCENE_ID) throw new Error("story_level2_locked");
    if (!tutorialUsed(current)) await runtime.useForcedPerspective(SCENE_ID, PERSPECTIVE_ID);
    runtimeSnapshot = await runtime.bootstrap();
    const scene = currentScene();
    if (!scene) throw new Error("story_level2_scene_missing");
    globalThis.SolivocStoryGeneration?.prepare?.(scene, WORLD_ID);
    if (isLevelTwoGame() && !gameState()?.rewarded && !gameState()?.failed) return resumeGame();
    launchGeneratedLevel(scene);
  }

  function showModal() {
    const scene = currentScene();
    if (!scene) return;
    const modal = ensureModal();
    const summary = modal.querySelector("#storyLevel2Summary"), action = modal.querySelector(".story-level2-use");
    if (summary) summary.textContent = scene.presentation?.gameplaySummary || "Знакомый мотив появляется в новом контексте.";
    if (tutorialUsed()) action.textContent = isLevelTwoGame() && !gameState()?.rewarded ? "Продолжить расклад →" : "Перейти к раскладу →";
    else action.textContent = "Попробовать «Эхо памяти» →";
    action.onclick = () => usePerspectiveAndLaunch().catch(handleError);
    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
  }

  function decorateGateway() {
    const gateway = document.querySelector(".story-gateway-world");
    if (!gateway) return;
    const current = runtimeState(), status = gateway.querySelector(".story-gateway-copy p"), action = gateway.querySelector("[data-story-entry]");
    if (!status || !action) return;
    if (current?.sceneId === SCENE_ID && current.status === "completed") {
      status.textContent = "2/100 · первые две перспективы ещё не завершены";
      action.textContent = "История →";
      action.dataset.storyNext = "level2-completed";
      return;
    }
    if (current?.sceneId === SCENE_ID && current.status === "active") {
      status.textContent = tutorialUsed(current) ? "Уровень 2 · продолжить" : "Уровень 2 · Эхо памяти";
      action.textContent = "Продолжить →";
      action.dataset.storyNext = "level2";
      return;
    }
    if (current?.sceneId === PREVIOUS_SCENE_ID && current.status === "completed") {
      status.textContent = "1/100 · дальше: «Уже увиденное»";
      action.textContent = "Продолжить →";
      action.dataset.storyNext = "level2";
    }
  }

  async function refreshRuntime() {
    refreshPending = false;
    try {
      runtimeSnapshot = await globalThis.SolivocForestStory?.bootstrap?.();
      globalThis.SolivocStoryGeneration?.registerRuntimeSnapshot?.(runtimeSnapshot);
      decorateGateway();
    } catch {}
  }

  function scheduleRefresh() {
    if (refreshPending || !globalThis.SolivocForestStory?.bootstrap) return;
    refreshPending = true;
    setTimeout(refreshRuntime, 0);
  }

  function decorateWin() {
    if (!isLevelTwoGame()) return;
    const title = document.getElementById("winTitle"), text = document.getElementById("winText"), xp = document.getElementById("winXp"), goals = document.getElementById("winGoals"), next = document.getElementById("next"), share = document.getElementById("winShare"), companion = document.getElementById("winCompanion"), icon = document.querySelector("#modal .win-icon");
    if (title) title.textContent = "Уже увиденное · завершено";
    if (text) { text.textContent = "Мир Леса · 2/100"; text.hidden = false; }
    if (xp) xp.innerHTML = "<b>«Эхо памяти» знакомо · preference не изменён</b>";
    if (goals) goals.innerHTML = "";
    if (next) next.textContent = "Вернуться в Историю →";
    if (share) share.hidden = true;
    if (companion) companion.hidden = true;
    if (icon) icon.textContent = "🌿";
  }

  function handleError(error) {
    console.error("forest level 2", error);
    try { showToast?.("Уровень 2 пока не удалось открыть"); } catch {}
  }

  function hooksReady() {
    try {
      return !!(globalThis.SolivocForestStory && typeof renderHub === "function" && typeof showWin === "function" && typeof restartCurrentLevel === "function");
    } catch { return false; }
  }

  function install() {
    if (installed) return true;
    if (!hooksReady()) return false;
    installed = true;
    installStyles();

    const originalRenderHub = renderHub;
    renderHub = function forestLevelTwoRenderHub(...args) {
      const result = originalRenderHub(...args);
      scheduleRefresh();
      return result;
    };

    const originalShowWin = showWin;
    showWin = function forestLevelTwoShowWin(...args) {
      const result = originalShowWin(...args);
      if (isLevelTwoGame()) setTimeout(decorateWin, 0);
      return result;
    };

    const originalRestartCurrentLevel = restartCurrentLevel;
    restartCurrentLevel = function forestLevelTwoRestart() {
      if (!isLevelTwoGame()) return originalRestartCurrentLevel();
      const scene = currentScene();
      if (!scene) return false;
      globalThis.SolivocStoryGeneration?.prepare?.(scene, WORLD_ID);
      const result = makeLevel?.(2, { mode: "story", storyWorldId: WORLD_ID, storySceneId: SCENE_ID });
      if (result !== false) attachStoryContext(scene);
      return result;
    };

    document.addEventListener("click", (event) => {
      const entry = event.target?.closest?.("[data-story-entry]");
      if (!entry || entry.dataset.storyNext !== "level2") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (isLevelTwoGame() && tutorialUsed() && !gameState()?.rewarded && !gameState()?.failed) return resumeGame();
      showModal();
    }, true);

    scheduleRefresh();
    return true;
  }

  globalThis.SolivocForestLevel2 = Object.freeze({
    sceneId: SCENE_ID,
    tutorialSceneId: TUTORIAL_SCENE_ID,
    perspectiveId: PERSPECTIVE_ID,
    canEnterLevelTwo,
    tutorialUsed,
  });

  let attempts = 0;
  const timer = setInterval(() => {
    attempts++;
    if (install() || attempts > 180) clearInterval(timer);
  }, 50);
  if (document.readyState === "complete") install();
  else globalThis.addEventListener?.("load", install, { once: true });
})();
