/* Forest Level 1 gameplay onboarding. Keeps authored encounter presence separate from collection mascots. */
(() => {
  if (typeof document === "undefined" || globalThis.__solivocForestLevel1) return;
  globalThis.__solivocForestLevel1 = true;

  const WORLD_ID = "forest";
  const SCENE_ID = "SCN_FOREST_L001_CORE";
  const NEXT_SCENE_ID = "SCN_FOREST_L002_CORE";
  const ENCOUNTER_ID = "ENC_FOREST_01_CAT_OWL";
  let installed = false;
  let runtimeCompleted = false;
  let completionRefreshPending = false;

  function isLevelOneState(value = globalThis.state) {
    return !!(value?.mode === "story" && value?.worldId === WORLD_ID && value?.sceneId === SCENE_ID && +value?.level === 1);
  }

  function levelOneCompleted() {
    try { return runtimeCompleted || !!(isLevelOneState(globalThis.state) && globalThis.state?.rewarded); }
    catch { return runtimeCompleted; }
  }

  function onboardingCopy(value = globalThis.state) {
    if ((value?.completed || 0) > 0) return "Первая категория собрана. Остальные работают по тому же принципу.";
    if ((value?.run?.moves || 0) > 0) return "Связь найдена. Собирай слова одной темы вместе и закрепляй готовую категорию сверху.";
    return "Начни с самой очевидной связи: перенеси одно связанное слово на другое.";
  }

  function installStyles() {
    if (document.getElementById("forestLevel1Styles")) return;
    const style = document.createElement("style");
    style.id = "forestLevel1Styles";
    style.textContent = `
      .story-level1-presence{display:grid;grid-template-columns:auto 1fr;gap:10px;align-items:center;margin:0 0 10px;padding:9px 11px;border:1px solid #ffffff15;border-radius:16px;background:linear-gradient(135deg,#183a30cc,#1d2748cc);box-shadow:inset 0 1px #ffffff10}
      .story-level1-presence[hidden]{display:none}.story-level1-cast{display:flex;align-items:end;min-width:58px}.story-level1-cast img{width:38px;height:38px;object-fit:contain;filter:drop-shadow(0 6px 8px #0006)}.story-level1-cast img+img{width:35px;height:35px;margin-left:-14px;transform:translateY(2px)}
      .story-level1-copy{min-width:0}.story-level1-copy small{display:block;color:#9edab0;font-size:7px;font-weight:950;letter-spacing:.12em}.story-level1-copy b{display:block;margin-top:2px;color:#eef5ed;font-size:10px}.story-level1-copy span{display:block;margin-top:2px;color:#c6d1d1;font-size:8px;line-height:1.35}
      @media(max-width:390px){.story-level1-presence{margin-bottom:8px;padding:8px 9px}.story-level1-cast{min-width:52px}.story-level1-cast img{width:34px;height:34px}.story-level1-cast img+img{width:31px;height:31px}}
      @media(prefers-reduced-motion:reduce){.story-level1-presence *{animation:none!important;transition:none!important}}
    `;
    document.head.appendChild(style);
  }

  function ensurePresence() {
    const game = document.querySelector(".game");
    if (!game) return null;
    let strip = document.getElementById("storyLevel1Presence");
    if (!strip) {
      strip = document.createElement("section");
      strip.id = "storyLevel1Presence";
      strip.className = "story-level1-presence";
      strip.setAttribute("aria-live", "polite");
      strip.innerHTML = `<div class="story-level1-cast" aria-hidden="true"><img src="./icons/mascot-cat.svg" alt=""><img src="./icons/mascot-owl.svg" alt=""></div><div class="story-level1-copy"><small>ПОЛЯНА · КОТ И СОВА</small><b>Появление</b><span id="storyLevel1Hint"></span></div>`;
      const draw = game.querySelector(".draw-row");
      game.insertBefore(strip, draw || game.firstChild);
    }
    return strip;
  }

  function syncPresence() {
    const strip = ensurePresence();
    if (!strip) return;
    const active = isLevelOneState(globalThis.state) && !globalThis.state?.rewarded;
    strip.hidden = !active;
    if (!active) return;
    globalThis.state.encounterId = ENCOUNTER_ID;
    globalThis.state.nextStorySceneId = NEXT_SCENE_ID;
    const hint = document.getElementById("storyLevel1Hint");
    if (hint) hint.textContent = onboardingCopy(globalThis.state);
  }

  function decorateCompletedNavigation() {
    if (!levelOneCompleted()) return;
    const gateway = document.querySelector(".story-gateway-world");
    if (gateway) {
      const status = gateway.querySelector(".story-gateway-copy p"), action = gateway.querySelector("[data-story-entry]");
      if (status) status.textContent = "1/100 · дальше: «Уже увиденное»";
      if (action) action.textContent = "Продолжить →";
    }
    const modal = document.getElementById("storySceneModal");
    if (modal && !modal.hidden) {
      const status = document.getElementById("storySceneStatus"), start = document.getElementById("storySceneStart");
      if (status?.textContent?.includes("Первый уровень завершён")) {
        status.textContent = "Уровень 1 завершён · дальше: «Уже увиденное»";
        if (start) {
          start.textContent = "Вернуться в Историю →";
          start.onclick = () => {
            modal.hidden = true;
            modal.setAttribute("aria-hidden", "true");
            try { globalThis.openHub?.("home"); } catch {}
          };
        }
      }
    }
    if (isLevelOneState(globalThis.state) && globalThis.state?.rewarded) {
      const text = document.getElementById("winText");
      if (text) { text.textContent = "Мир Леса · 1/100 · дальше: «Уже увиденное»"; text.hidden = false; }
    }
  }

  async function refreshRuntimeCompletion() {
    completionRefreshPending = false;
    try {
      const current = await globalThis.SolivocForestStory?.restore?.();
      runtimeCompleted = !!(current?.sceneId === SCENE_ID && current?.status === "completed");
      decorateCompletedNavigation();
    } catch {}
  }

  function scheduleCompletionRefresh() {
    if (completionRefreshPending || !globalThis.SolivocForestStory?.restore) return;
    completionRefreshPending = true;
    setTimeout(refreshRuntimeCompletion, 0);
  }

  function syncPresentation() {
    syncPresence();
    decorateCompletedNavigation();
    scheduleCompletionRefresh();
  }

  function storyHooksReady() {
    try {
      return typeof globalThis.render === "function" && typeof globalThis.renderHub === "function" &&
        typeof globalThis.showWin === "function" && /storyFinishLevel/.test(String(globalThis.finishLevel));
    } catch { return false; }
  }

  function install() {
    if (installed) return true;
    if (!storyHooksReady()) return false;
    installed = true;
    installStyles();

    const originalRender = globalThis.render;
    globalThis.render = function forestLevelOneRender(...args) {
      const result = originalRender(...args);
      syncPresentation();
      return result;
    };

    const originalRenderHub = globalThis.renderHub;
    globalThis.renderHub = function forestLevelOneRenderHub(...args) {
      const result = originalRenderHub(...args);
      syncPresentation();
      return result;
    };

    const originalShowWin = globalThis.showWin;
    globalThis.showWin = function forestLevelOneShowWin(...args) {
      const result = originalShowWin(...args);
      syncPresentation();
      return result;
    };

    const observer = new MutationObserver(() => decorateCompletedNavigation());
    observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ["hidden", "class"] });
    syncPresentation();
    return true;
  }

  globalThis.SolivocForestLevel1 = Object.freeze({
    encounterId: ENCOUNTER_ID,
    nextSceneId: NEXT_SCENE_ID,
    onboardingCopy,
  });

  let attempts = 0;
  const timer = setInterval(() => {
    attempts++;
    if (install() || attempts > 160) clearInterval(timer);
  }, 50);
  if (document.readyState === "complete") install();
  else globalThis.addEventListener?.("load", install, { once: true });
})();
