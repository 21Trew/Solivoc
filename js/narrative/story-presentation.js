/* Forest Story product entry and presentation bridge. */
(() => {
  if (typeof document === "undefined" || globalThis.__solivocForestStoryPresentation) return;
  globalThis.__solivocForestStoryPresentation = true;

  const WORLD_ID = "forest";
  const PACKAGE_VERSION = "0.03";
  const SCENE_ID = "SCN_FOREST_L001_CORE";
  const STORY_SEED = `story:${WORLD_ID}:${SCENE_ID}:v${PACKAGE_VERSION}`;
  const DEPENDENCIES = [
    ["SolivocWorldContent", "./js/narrative/content-loader.js"],
    ["SolivocNarrativeStore", "./js/narrative/event-store.js"],
    ["SolivocForestStory", "./js/narrative/story-runtime.js"],
  ];
  let storySnapshot = null;
  let runtimePromise = null;
  let hooksInstalled = false;
  let storyCompletionPromise = null;

  function loadScript(globalName, src) {
    if (globalThis[globalName]) return Promise.resolve(globalThis[globalName]);
    const existing = document.querySelector(`script[data-story-dependency="${globalName}"]`);
    if (existing?.dataset.loaded === "1") return Promise.resolve(globalThis[globalName]);
    return new Promise((resolve, reject) => {
      const script = existing || document.createElement("script");
      if (!existing) {
        script.src = src;
        script.async = false;
        script.dataset.storyDependency = globalName;
        document.head.appendChild(script);
      }
      const done = () => {
        script.dataset.loaded = "1";
        globalThis[globalName] ? resolve(globalThis[globalName]) : reject(new Error(`story_dependency_missing:${globalName}`));
      };
      if (globalThis[globalName]) return done();
      script.addEventListener("load", done, { once: true });
      script.addEventListener("error", () => reject(new Error(`story_dependency_failed:${globalName}`)), { once: true });
    });
  }

  async function ensureRuntime({ refresh = false } = {}) {
    if (!runtimePromise || refresh) {
      runtimePromise = (async () => {
        for (const [globalName, src] of DEPENDENCIES) await loadScript(globalName, src);
        const snapshot = await globalThis.SolivocForestStory.bootstrap();
        storySnapshot = snapshot;
        return snapshot;
      })().catch((error) => {
        runtimePromise = null;
        throw error;
      });
    }
    return runtimePromise;
  }

  function currentStoryState() {
    try {
      if (typeof state !== "undefined" && state?.mode === "story" && state?.sceneId === SCENE_ID) return state.rewarded ? "completed" : "active";
    } catch {}
    return storySnapshot?.active?.status || "not_started";
  }

  function currentScene() {
    const scenes = storySnapshot?.document?.scenes;
    return Array.isArray(scenes) ? scenes.find((scene) => scene.id === SCENE_ID) || null : null;
  }

  function storyGatewayMarkup() {
    const status = currentStoryState(), completed = status === "completed", active = status === "active";
    const statusText = completed ? "1/100 · первый уровень пройден" : active ? "Уровень 1 · продолжить" : "Новый мир · 0/100";
    const action = completed ? "Открыть Историю" : active ? "Продолжить" : "Начать мир";
    return `<section class="story-gateway" aria-label="История и Расклады">
      <div class="story-gateway-world">
        <div class="story-gateway-copy"><small>ИСТОРИЯ</small><h2>Мир Леса</h2><p>${statusText}</p></div>
        <div class="story-gateway-characters" aria-hidden="true"><img src="./icons/mascot-cat.svg" alt=""><img src="./icons/mascot-owl.svg" alt=""></div>
        <button type="button" class="story-primary" data-story-entry>${action} →</button>
      </div>
      <button type="button" class="story-layouts-entry" data-story-layouts><span>◈</span><b>Расклады</b><small>Свободная игра и режимы</small></button>
    </section>`;
  }

  function installStyles() {
    if (document.getElementById("forestStoryPresentationStyles")) return;
    const style = document.createElement("style");
    style.id = "forestStoryPresentationStyles";
    style.textContent = `
      .story-gateway{display:grid;grid-template-columns:minmax(0,1.8fr) minmax(118px,.8fr);gap:10px;margin-bottom:1px}
      .story-gateway-world,.story-layouts-entry{border:1px solid #ffffff18;border-radius:22px;color:#fff;box-shadow:inset 0 1px #ffffff12,0 12px 28px #0002}
      .story-gateway-world{position:relative;min-height:184px;overflow:hidden;padding:17px;background:radial-gradient(circle at 84% 20%,#9bdc9b32,transparent 30%),linear-gradient(145deg,#193b35,#1f2853 62%,#302253)}
      .story-gateway-world::before{content:"";position:absolute;inset:auto -40px -70px 28%;height:150px;border-radius:50%;background:radial-gradient(ellipse,#83c78c2b,transparent 70%);transform:rotate(-8deg)}
      .story-gateway-copy{position:relative;z-index:2;max-width:62%}.story-gateway-copy small,.story-scene-copy small{display:block;color:#aee4bd;font-size:9px;font-weight:950;letter-spacing:.16em}
      .story-gateway-copy h2{margin:7px 0 5px;font-size:24px}.story-gateway-copy p{margin:0;color:#d2d9e8;font-size:10px;font-weight:750;line-height:1.35}
      .story-gateway-characters{position:absolute;right:-2px;bottom:38px;display:flex;align-items:end;z-index:1}.story-gateway-characters img{width:73px;height:73px;object-fit:contain;filter:drop-shadow(0 10px 16px #0007)}.story-gateway-characters img+img{width:67px;height:67px;margin-left:-27px;transform:translateY(5px)}
      .story-primary{position:absolute;z-index:3;left:17px;bottom:16px;min-height:39px;padding:0 14px;border:0;border-radius:13px;background:#f1f4df;color:#23352e;font:inherit;font-size:10px;font-weight:950;box-shadow:0 8px 20px #0004}
      .story-layouts-entry{min-height:184px;padding:15px 12px;background:linear-gradient(155deg,#ffffff0e,#ffffff06);text-align:left;display:grid;align-content:end;gap:3px}.story-layouts-entry>span{font-size:25px;margin-bottom:auto;color:#aeb9ff}.story-layouts-entry b{font-size:13px}.story-layouts-entry small{color:#aaaed0;font-size:8px;line-height:1.25}
      .story-scene-modal{position:fixed;inset:0;z-index:14050;display:grid;place-items:center;padding:16px;background:#080b18cc;backdrop-filter:blur(14px)}.story-scene-modal[hidden]{display:none}
      .story-scene-card{width:min(430px,100%);max-height:min(88vh,720px);overflow:auto;border:1px solid #ffffff1b;border-radius:29px;background:linear-gradient(165deg,#183a34,#171d42 68%,#20183e);color:#fff;box-shadow:0 30px 90px #000b}
      .story-scene-visual{position:relative;min-height:245px;overflow:hidden;background:radial-gradient(circle at 50% 75%,#a8d88a2e,transparent 37%),linear-gradient(180deg,#3d6a62 0,#274c49 46%,#18332d 100%)}
      .story-scene-visual::before,.story-scene-visual::after{content:"";position:absolute;bottom:-70px;width:250px;height:190px;border-radius:50%;background:#102d27}.story-scene-visual::before{left:-70px;transform:rotate(14deg)}.story-scene-visual::after{right:-85px;transform:rotate(-12deg)}
      .story-scene-cast{position:absolute;inset:auto 0 0;display:flex;justify-content:center;align-items:end;z-index:2}.story-scene-cast img{width:145px;height:145px;object-fit:contain;filter:drop-shadow(0 18px 20px #0008)}.story-scene-cast img+img{width:132px;height:132px;margin-left:-45px;transform:translateY(7px)}
      .story-scene-copy{padding:20px}.story-scene-copy h2{margin:7px 0 5px;font-size:29px;line-height:1}.story-scene-meta{color:#cdd8d5;font-size:10px;font-weight:800}.story-scene-summary{margin:13px 0 0;color:#e0e5e8;font-size:12px;line-height:1.5}
      .story-scene-facts{display:flex;flex-wrap:wrap;gap:6px;margin-top:14px}.story-scene-facts span{padding:6px 8px;border-radius:99px;background:#ffffff0d;border:1px solid #ffffff12;color:#ced9d6;font-size:8px;font-weight:850}
      .story-scene-actions{display:grid;grid-template-columns:auto 1fr;gap:8px;margin-top:19px}.story-scene-actions button{min-height:44px;border:0;border-radius:14px;font:inherit;font-size:10px;font-weight:950}.story-scene-back{padding:0 14px;background:#ffffff0d;color:#d8d8e6}.story-scene-start{background:#eef3dc;color:#23352e}
      .story-scene-status{margin-top:13px;padding:10px 11px;border-radius:14px;background:#ffffff08;color:#cad4d2;font-size:9px;line-height:1.4}
      @media(max-width:390px){.story-gateway{grid-template-columns:1fr}.story-layouts-entry{min-height:76px;grid-template-columns:auto 1fr;align-items:center;align-content:center}.story-layouts-entry>span{margin:0 8px 0 0;grid-row:1/3}.story-gateway-copy{max-width:58%}.story-scene-card{border-radius:24px}.story-scene-visual{min-height:220px}}
      @media(prefers-reduced-motion:reduce){.story-gateway *,.story-scene-modal *{animation:none!important;transition:none!important}}
    `;
    document.head.appendChild(style);
  }

  function ensureSceneModal() {
    let modal = document.getElementById("storySceneModal");
    if (modal) return modal;
    modal = document.createElement("div");
    modal.id = "storySceneModal";
    modal.className = "story-scene-modal";
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
    modal.innerHTML = `<div class="story-scene-card" role="dialog" aria-modal="true" aria-labelledby="storySceneTitle"><div class="story-scene-visual"><div class="story-scene-cast"><img src="./icons/mascot-cat.svg" alt="Кот"><img src="./icons/mascot-owl.svg" alt="Сова"></div></div><div class="story-scene-copy"><small>ИСТОРИЯ · МИР ЛЕСА</small><h2 id="storySceneTitle">Появление</h2><div class="story-scene-meta" id="storySceneMeta">Поляна · Уровень 1</div><p class="story-scene-summary" id="storySceneSummary"></p><div class="story-scene-facts"><span>Кот</span><span>Сова</span></div><div class="story-scene-status" id="storySceneStatus"></div><div class="story-scene-actions"><button class="story-scene-back" id="storySceneBack" type="button">Назад</button><button class="story-scene-start" id="storySceneStart" type="button">Начать первый расклад →</button></div></div></div>`;
    document.body.appendChild(modal);
    modal.addEventListener("click", (event) => { if (event.target === modal) closeSceneModal(); });
    document.getElementById("storySceneBack").onclick = closeSceneModal;
    return modal;
  }

  function closeSceneModal() {
    const modal = document.getElementById("storySceneModal");
    if (!modal) return;
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
  }

  function showSceneModal(snapshot) {
    storySnapshot = snapshot || storySnapshot;
    const scene = currentScene() || { id: SCENE_ID, level: 1, areaId: "AREA_FOREST_CLEARING", meaning: "Появление" };
    const status = currentStoryState();
    const modal = ensureSceneModal();
    document.getElementById("storySceneTitle").textContent = scene.meaning || "Появление";
    document.getElementById("storySceneMeta").textContent = `${scene.presentation?.areaLabel || "Поляна"} · Уровень ${scene.level}`;
    document.getElementById("storySceneSummary").textContent = scene.presentation?.gameplaySummary || "Самое базовое различение и очевидная связь.";
    const statusEl = document.getElementById("storySceneStatus"), start = document.getElementById("storySceneStart");
    if (status === "completed") {
      statusEl.textContent = "Первый уровень завершён · прогресс Мира Леса 1/100";
      start.textContent = "К Раскладам →";
      start.onclick = () => { closeSceneModal(); if (typeof hubTab !== "undefined") hubTab = "modes"; if (typeof renderHub === "function") renderHub(); };
    } else {
      statusEl.textContent = status === "active" ? "Расклад уже начат — продолжим с сохранённого состояния." : "Первый уровень не влияет на старый прогресс Классики.";
      start.textContent = status === "active" ? "Продолжить →" : "Начать первый расклад →";
      start.onclick = () => launchStoryScene(scene).catch(handleStoryError);
    }
    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
  }

  function attachStoryContext(scene) {
    if (typeof state === "undefined" || !state) return;
    state.worldId = WORLD_ID;
    state.sceneId = scene.id;
    state.areaId = scene.areaId;
    state.storyPackageVersion = PACKAGE_VERSION;
    state.storyMeaning = scene.meaning || "";
    state.bonusObjective = null;
    try { save?.({ immediate: true }); } catch {}
    try { syncGameCompanion?.(); } catch {}
  }

  function storyGameIsResumable() {
    try { return !!(state?.mode === "story" && state.sceneId === SCENE_ID && !state.rewarded && !state.failed); }
    catch { return false; }
  }

  async function launchStoryScene(scene) {
    if (storyGameIsResumable()) {
      closeSceneModal(); closeHub?.(); render?.(); updateCoach?.(); syncGameCompanion?.(); setBackgroundMusic?.(musicModeForState?.(state) || "game");
      return;
    }
    const runtime = globalThis.SolivocForestStory;
    if (!runtime) throw new Error("story_runtime_unavailable");
    try { buildGeneratedLevel?.(scene.level, { mode: "story", seed: STORY_SEED, cardSourceMode: "words", forceSolvable: true }); }
    catch (error) { throw Object.assign(new Error("story_level_generation_failed"), { cause: error }); }
    await runtime.beginScene(scene.id);
    closeSceneModal(); closeHub?.();
    const result = makeLevel?.(scene.level, { mode: "story", seed: STORY_SEED, cardSourceMode: "words", forceSolvable: true });
    if (result === false) throw new Error("story_level_launch_failed");
    attachStoryContext(scene);
    track?.("story_level_started", { world: WORLD_ID, scene: scene.id, level: scene.level });
  }

  function handleStoryError(error) {
    console.error("forest story presentation", error);
    showToast?.("Мир Леса пока не удалось открыть");
  }

  async function openStoryEntry() {
    if (storyGameIsResumable()) {
      closeHub?.(); render?.(); updateCoach?.(); syncGameCompanion?.();
      return;
    }
    try { showSceneModal(await ensureRuntime({ refresh: true })); }
    catch (error) { handleStoryError(error); }
  }

  function decorateStoryWin() {
    if (typeof state === "undefined" || state?.mode !== "story") return;
    const title = document.getElementById("winTitle"), text = document.getElementById("winText"), xp = document.getElementById("winXp"), goals = document.getElementById("winGoals"), next = document.getElementById("next"), share = document.getElementById("winShare"), companion = document.getElementById("winCompanion"), icon = document.querySelector("#modal .win-icon");
    if (title) title.textContent = "Появление · завершено";
    if (text) { text.textContent = "Мир Леса · 1/100"; text.hidden = false; }
    if (xp) xp.innerHTML = "<b>История сохраняется отдельно от Классики</b>";
    if (goals) goals.innerHTML = "";
    if (next) next.textContent = "Вернуться в Историю →";
    if (share) share.hidden = true;
    if (companion) companion.hidden = true;
    if (icon) icon.textContent = "🌿";
  }

  function finishStoryLevel() {
    if (!state || state.rewarded) return false;
    const rewardable = state.totalCategories > 0 && state.completed === state.totalCategories && (state.run?.moves || 0) > 0 && isPlayableGeneratedState?.(state);
    if (!rewardable) {
      console.error("invalid story completion blocked", { sceneId: state.sceneId, completed: state.completed, totalCategories: state.totalCategories });
      return false;
    }
    state.rewarded = true;
    const stars = calculateStars?.() || 1;
    state.lastStars = stars;
    state.run.xpEarned = 0;
    state.run.xpBaseEarned = 0;
    profile.stats.gamesPlayed = (profile.stats.gamesPlayed || 0) + 1;
    profile.stats.totalMoves = (profile.stats.totalMoves || 0) + (state.run.moves || 0);
    track?.("story_level_completed", { world: WORLD_ID, scene: state.sceneId || SCENE_ID, level: state.level, stars, moves: state.run.moves || 0 });
    try { flushProfileSave?.({ skipCloud: true }); } catch {}
    try { save?.({ immediate: true }); } catch {}
    storyCompletionPromise = ensureRuntime()
      .then(() => globalThis.SolivocForestStory.completeScene(state.sceneId || SCENE_ID))
      .then(() => ensureRuntime({ refresh: true }))
      .catch((error) => { handleStoryError(error); return null; });
    showWin?.(stars, [], null, false);
    resetCombo?.();
    return true;
  }

  function installHooks() {
    if (hooksInstalled) return true;
    if (
      typeof homeTabMarkup !== "function" || typeof modesTabMarkup !== "function" || typeof hubTabsMarkup !== "function" ||
      typeof bindHubHandlers !== "function" || typeof finishLevel !== "function" || typeof showWin !== "function" ||
      typeof configForMode !== "function" || typeof restartCurrentLevel !== "function" || typeof syncGameCompanion !== "function"
    ) return false;
    hooksInstalled = true;
    installStyles();

    const originalHomeTabMarkup = homeTabMarkup;
    homeTabMarkup = function storyHomeTabMarkup() { return `${storyGatewayMarkup()}${originalHomeTabMarkup()}`; };

    const originalModesTabMarkup = modesTabMarkup;
    modesTabMarkup = function storyModesTabMarkup() { return originalModesTabMarkup().replace("<h3>Режимы игры</h3>", "<h3>Расклады</h3>"); };

    const originalHubTabsMarkup = hubTabsMarkup;
    hubTabsMarkup = function storyHubTabsMarkup() { return originalHubTabsMarkup().replace("<span>Режимы</span>", "<span>Расклады</span>"); };

    const originalBindHubHandlers = bindHubHandlers;
    bindHubHandlers = function storyBindHubHandlers() {
      originalBindHubHandlers();
      const entry = document.querySelector("[data-story-entry]"), layouts = document.querySelector("[data-story-layouts]");
      if (entry) entry.onclick = openStoryEntry;
      if (layouts) layouts.onclick = () => { hubTab = "modes"; renderHub(); };
      if (!storySnapshot && !runtimePromise) ensureRuntime().then(() => {
        if (typeof hubTab !== "undefined" && hubTab === "home" && document.getElementById("hub")?.classList.contains("show")) renderHub();
      }).catch(() => {});
    };

    const originalConfigForMode = configForMode;
    configForMode = function storyConfigForMode(level, mode, rng, special = null, opts = {}) {
      if (mode === "story") return regularConfig(Math.max(1, level || 1), rng, null);
      return originalConfigForMode(level, mode, rng, special, opts);
    };

    const originalFinishLevel = finishLevel;
    finishLevel = function storyFinishLevel() { if (state?.mode === "story") return finishStoryLevel(); return originalFinishLevel(); };

    const originalShowWin = showWin;
    showWin = function storyShowWin(...args) { const result = originalShowWin(...args); decorateStoryWin(); return result; };

    const originalRestartCurrentLevel = restartCurrentLevel;
    restartCurrentLevel = function storyRestartCurrentLevel() {
      if (state?.mode !== "story") return originalRestartCurrentLevel();
      const scene = currentScene() || { id: SCENE_ID, level: 1, areaId: "AREA_FOREST_CLEARING", meaning: "Появление" };
      const result = makeLevel(scene.level, { mode: "story", seed: STORY_SEED, cardSourceMode: "words", forceSolvable: true });
      if (result !== false) attachStoryContext(scene);
      return result;
    };

    const originalSyncGameCompanion = syncGameCompanion;
    syncGameCompanion = function storySyncGameCompanion() {
      if (state?.mode === "story") {
        const button = document.getElementById("gameCompanion");
        if (button) button.hidden = true;
        return;
      }
      return originalSyncGameCompanion();
    };

    if (typeof savedRoundAlreadyCompleted === "function") {
      const originalSavedRoundAlreadyCompleted = savedRoundAlreadyCompleted;
      savedRoundAlreadyCompleted = function storySavedRoundAlreadyCompleted(value) {
        return !!(value?.mode === "story" && value?.rewarded === true) || originalSavedRoundAlreadyCompleted(value);
      };
    }

    document.addEventListener("click", (event) => {
      const next = event.target?.closest?.("#next");
      if (!next || state?.mode !== "story") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      closeWinModal?.();
      Promise.resolve(storyCompletionPromise).finally(async () => {
        try { await ensureRuntime({ refresh: true }); } catch {}
        openHub?.("home");
      });
    }, true);

    if (document.getElementById("hub")?.classList.contains("show")) renderHub();
    return true;
  }

  let attempts = 0;
  const timer = setInterval(() => {
    attempts++;
    if (installHooks() || attempts > 120) clearInterval(timer);
  }, 50);
  if (document.readyState === "complete") installHooks();
  else window.addEventListener("load", installHooks, { once: true });
})();
