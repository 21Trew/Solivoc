/* Generic player-facing Story gateway, scene flow and gameplay bridge. */
(() => {
  if (typeof document === "undefined" || globalThis.__solivocStoryPresentation) return;
  globalThis.__solivocStoryPresentation = true;

  const WORLD_ID = "forest", PACKAGE_VERSION = "0.03";
  const DEPS = [
    ["SolivocWorldContent", "./js/narrative/content-loader.js"],
    ["SolivocNarrativeStore", "./js/narrative/event-store.js"],
    ["SolivocForestStory", "./js/narrative/story-runtime.js"],
  ];
  const NAMES = { cat: "Кот", owl: "Сова", fox: "Лис" };
  let snapshot = null, runtimePromise = null, installed = false, completionPromise = null;

  function gameState() { try { return typeof state !== "undefined" ? state : globalThis.state || null; } catch { return globalThis.state || null; } }
  function scenes() { return Array.isArray(snapshot?.document?.scenes) ? snapshot.document.scenes : []; }
  function sceneById(id) { return scenes().find((scene) => scene.id === id) || null; }
  function active() { return snapshot?.active || null; }
  function campaign() { return { worldLabel: snapshot?.document?.campaign?.worldLabel || "Мир Леса", totalLevels: Math.max(1, +snapshot?.document?.campaign?.totalLevels || 100), gatewayCharacters: snapshot?.document?.campaign?.gatewayCharacters || ["cat", "owl"] }; }
  function nextScene(scene) { return scene?.nextSceneId ? sceneById(scene.nextSceneId) : null; }
  function targetScene() { const a = active(); if (!a) return sceneById(globalThis.SolivocForestStory?.defaultSceneId) || scenes()[0] || null; const current = sceneById(a.sceneId); return a.status === "completed" ? (nextScene(current) || current) : current; }
  function charName(id) { return NAMES[id] || String(id || "Персонаж"); }
  function mascot(id) { return `./icons/mascot-${/^[a-z0-9-]+$/.test(String(id || "")) ? id : "cat"}.svg`; }
  function cast(ids = [], decorative = false) { return ids.map((id) => `<img src="${mascot(id)}" alt="${decorative ? "" : charName(id)}">`).join(""); }

  function loadScript(name, src) {
    if (globalThis[name]) return Promise.resolve(globalThis[name]);
    return new Promise((resolve, reject) => {
      let script = document.querySelector(`script[data-story-dependency="${name}"]`);
      if (!script) { script = document.createElement("script"); script.src = src; script.async = false; script.dataset.storyDependency = name; document.head.appendChild(script); }
      const done = () => globalThis[name] ? resolve(globalThis[name]) : reject(new Error(`story_dependency_missing:${name}`));
      script.addEventListener("load", done, { once: true }); script.addEventListener("error", () => reject(new Error(`story_dependency_failed:${name}`)), { once: true });
      if (globalThis[name]) done();
    });
  }

  async function ensureRuntime(refresh = false) {
    if (!runtimePromise || refresh) runtimePromise = (async () => {
      for (const [name, src] of DEPS) await loadScript(name, src);
      snapshot = await globalThis.SolivocForestStory.bootstrap();
      globalThis.SolivocStoryGeneration?.registerRuntimeSnapshot?.(snapshot);
      const current = gameState(), a = snapshot.active;
      if (current && a && current.mode !== "story" && current.worldId === WORLD_ID && current.sceneId === a.sceneId && String(current.seed || "").startsWith("story:") && !current.failed) {
        current.mode = "story"; try { save?.({ immediate: true }); } catch {}
      }
      return snapshot;
    })().catch((error) => { runtimePromise = null; throw error; });
    return runtimePromise;
  }

  function gatewayModel() {
    const c = campaign(), a = active(), current = sceneById(a?.sceneId), next = nextScene(current);
    if (!a) return [`Новый мир · 0/${c.totalLevels}`, "Начать мир"];
    if (a.status === "active") return [`Уровень ${a.levelId} · продолжить`, "Продолжить"];
    if (next) return [`${a.levelId}/${c.totalLevels} · дальше: «${next.meaning}»`, "Продолжить"];
    return [`${a.levelId}/${c.totalLevels} · доступная глава пройдена`, "История"];
  }

  function gatewayMarkup() {
    const c = campaign(), [status, action] = gatewayModel();
    return `<section class="story-gateway" aria-label="История и Расклады"><div class="story-gateway-world"><div class="story-gateway-copy"><small>ИСТОРИЯ</small><h2>${c.worldLabel}</h2><p>${status}</p></div><div class="story-gateway-characters" aria-hidden="true">${cast(c.gatewayCharacters, true)}</div><button type="button" class="story-primary" data-story-entry>${action} →</button></div><button type="button" class="story-layouts-entry" data-story-layouts><span>◈</span><b>Расклады</b><small>Свободная игра и режимы</small></button></section>`;
  }

  function installStyles() {
    if (document.getElementById("storyPresentationStyles")) return;
    const style = document.createElement("style"); style.id = "storyPresentationStyles";
    style.textContent = `.story-gateway{display:grid;grid-template-columns:minmax(0,1.8fr) minmax(118px,.8fr);gap:10px;margin-bottom:1px}.story-gateway-world,.story-layouts-entry{border:1px solid #ffffff18;border-radius:22px;color:#fff}.story-gateway-world{position:relative;min-height:184px;overflow:hidden;padding:17px;background:linear-gradient(145deg,#193b35,#1f2853 62%,#302253)}.story-gateway-copy{max-width:62%;position:relative;z-index:2}.story-gateway-copy small,.story-scene-copy small{color:#aee4bd;font-size:9px;font-weight:950;letter-spacing:.16em}.story-gateway-copy h2{margin:7px 0 5px;font-size:24px}.story-gateway-copy p{margin:0;color:#d2d9e8;font-size:10px}.story-gateway-characters{position:absolute;right:0;bottom:38px;display:flex}.story-gateway-characters img{width:73px;height:73px}.story-gateway-characters img+img{margin-left:-27px}.story-primary{position:absolute;left:17px;bottom:16px;z-index:3;min-height:39px;padding:0 14px;border:0;border-radius:13px;background:#f1f4df;color:#23352e;font-weight:950}.story-primary:disabled{opacity:.65;cursor:wait}.story-layouts-entry{min-height:184px;padding:15px 12px;background:#ffffff08;text-align:left;display:grid;align-content:end;gap:3px}.story-layouts-entry>span{font-size:25px;margin-bottom:auto}.story-layouts-entry small{color:#aaaed0;font-size:8px}.story-scene-modal{position:fixed;inset:0;z-index:14050;display:grid;place-items:center;padding:16px;background:#080b18cc;backdrop-filter:blur(14px)}.story-scene-modal[hidden]{display:none}.story-scene-card{width:min(430px,100%);border:1px solid #ffffff1b;border-radius:28px;background:linear-gradient(165deg,#183a34,#171d42);color:#fff;overflow:hidden}.story-scene-visual{min-height:220px;display:grid;place-items:end center;background:linear-gradient(180deg,#3d6a62,#18332d)}.story-scene-cast{display:flex;align-items:end}.story-scene-cast img{width:135px;height:135px}.story-scene-cast img+img{margin-left:-42px}.story-scene-copy{padding:20px}.story-scene-copy h2{margin:7px 0 5px;font-size:28px}.story-scene-meta,.story-scene-status{color:#cad6d2;font-size:10px}.story-scene-summary{font-size:12px;line-height:1.5}.story-scene-actions{display:grid;grid-template-columns:auto 1fr;gap:8px;margin-top:18px}.story-scene-actions button{min-height:44px;border:0;border-radius:14px;font-weight:950}.story-scene-back{padding:0 14px;background:#ffffff0d;color:#ddd}.story-scene-start{background:#eef3dc;color:#23352e}.story-gameplay-guide{display:grid;grid-template-columns:auto 1fr;gap:10px;align-items:center;margin:0 0 10px;padding:9px 11px;border:1px solid #ffffff15;border-radius:16px;background:#183a30cc}.story-gameplay-guide[hidden]{display:none}.story-guide-cast{display:flex}.story-guide-cast img{width:38px;height:38px}.story-guide-cast img+img{margin-left:-14px}.story-guide-copy small{font-size:7px;color:#9edab0}.story-guide-copy b{display:block;font-size:10px}.story-guide-copy span{font-size:8px;color:#c6d1d1}@media(max-width:390px){.story-gateway{grid-template-columns:1fr}.story-layouts-entry{min-height:76px}}`;
    document.head.appendChild(style);
  }

  function ensureModal() {
    let modal = document.getElementById("storySceneModal"); if (modal) return modal;
    modal = document.createElement("div"); modal.id = "storySceneModal"; modal.className = "story-scene-modal"; modal.hidden = true;
    modal.innerHTML = `<div class="story-scene-card" role="dialog" aria-modal="true"><div class="story-scene-visual"><div class="story-scene-cast"></div></div><div class="story-scene-copy"><small></small><h2></h2><div class="story-scene-meta"></div><p class="story-scene-summary"></p><div class="story-scene-status"></div><div class="story-scene-actions"><button class="story-scene-back" type="button">Назад</button><button class="story-scene-start" type="button"></button></div></div></div>`;
    document.body.appendChild(modal); modal.querySelector(".story-scene-back").onclick = () => { modal.hidden = true; }; return modal;
  }

  function stepDone(step, stateValue) {
    if (step?.type === "forced-perspective") return globalThis.SolivocStoryPerspective?.stepCompleted?.(step, stateValue) === true;
    if (step?.type === "choice") return globalThis.SolivocStoryChoice?.stepCompleted?.(step, stateValue) === true;
    return true;
  }

  function firstPending(scene, stateValue, phase) {
    return (globalThis.SolivocForestStory?.flowSteps?.(scene, phase) || []).find((step) => step.required !== false && !stepDone(step, stateValue)) || null;
  }

  async function runPhase(scene, phase, runtimeState, allowCancel) {
    let current = runtimeState;
    for (const step of globalThis.SolivocForestStory?.flowSteps?.(scene, phase) || []) {
      if (step.required === false || stepDone(step, current)) continue;
      let result;
      if (step.type === "forced-perspective") result = await globalThis.SolivocStoryPerspective.runStep(scene, step, current, { allowCancel });
      else if (step.type === "choice") result = await globalThis.SolivocStoryChoice.runStep(scene, step, current, { allowCancel });
      else continue;
      if (result.cancelled) return result;
      current = result.state;
    }
    return { state: current, cancelled: false };
  }

  function showScene(scene) {
    const modal = ensureModal(), a = active(), same = a?.sceneId === scene.id, exhausted = same && a.status === "completed" && !scene.nextSceneId;
    modal.querySelector(".story-scene-cast").innerHTML = cast(scene.presentation?.characters || []);
    modal.querySelector(".story-scene-copy small").textContent = `ИСТОРИЯ · ${scene.presentation?.worldLabel || campaign().worldLabel}`;
    modal.querySelector("h2").textContent = scene.meaning || `Уровень ${scene.level}`;
    modal.querySelector(".story-scene-meta").textContent = `${scene.presentation?.areaLabel || ""} · Уровень ${scene.level}`;
    modal.querySelector(".story-scene-summary").textContent = scene.presentation?.gameplaySummary || "";
    const game = gameState(), phase = game?.sceneId === scene.id && game.rewarded ? "afterGameplay" : "beforeGameplay";
    const pending = same ? firstPending(scene, a, phase) : firstPending(scene, {}, "beforeGameplay");
    modal.querySelector(".story-scene-status").textContent = exhausted ? "Доступная глава завершена." : pending ? `${pending.label || pending.prompt || "Сюжетный шаг"}` : same && a.status === "active" ? "Сцена уже начата — продолжим." : "Процедурный расклад будет сохранён отдельно от Классики.";
    const start = modal.querySelector(".story-scene-start"); start.textContent = exhausted ? "К Раскладам →" : game?.sceneId === scene.id && game.rewarded ? "Завершить сюжетный шаг →" : same && a.status === "active" ? "Продолжить →" : "Начать расклад →";
    start.onclick = exhausted ? () => { modal.hidden = true; try { hubTab = "modes"; renderHub(); } catch {} } : () => startScene(scene).catch(handleError);
    modal.hidden = false;
  }

  function validPlayableResume(scene) {
    const current = gameState();
    if (!(current?.mode === "story" && current.sceneId === scene?.id && !current.rewarded && !current.failed)) return false;
    if (typeof isPlayableGeneratedState === "function" && !isPlayableGeneratedState(current)) return false;
    return Number(current.totalCategories) > 0 && current.run && Number.isFinite(Number(current.run.moves));
  }
  function resumable(scene) { return validPlayableResume(scene); }
  function resume() { const modal = document.getElementById("storySceneModal"); if (modal) modal.hidden = true; try { closeHub?.(); render?.(); updateCoach?.(); syncGameCompanion?.(); } catch (error) { handleError(error); } }
  function attach(scene) { const current = gameState(); if (!current) return; Object.assign(current, { worldId: WORLD_ID, sceneId: scene.id, areaId: scene.areaId, encounterId: scene.presentation?.encounterId || null, nextStorySceneId: scene.nextSceneId || null, storyPackageVersion: PACKAGE_VERSION, storyMeaning: scene.meaning || "" }); try { save?.({ immediate: true }); syncGameCompanion?.(); } catch {} }

  async function launchGameplay(scene, runtimeState) {
    const before = await runPhase(scene, "beforeGameplay", runtimeState, true);
    if (before.cancelled) return false;
    const modal = document.getElementById("storySceneModal"); if (modal) modal.hidden = true; try { closeHub?.(); } catch {}
    const opts = { mode: "story", storyWorldId: WORLD_ID, storySceneId: scene.id, forceSolvable: true };
    buildGeneratedLevel?.(scene.level, opts); const result = makeLevel?.(scene.level, opts); if (result === false) throw new Error("story_level_launch_failed");
    attach(scene); try { track?.("story_level_started", { world: WORLD_ID, scene: scene.id, level: scene.level }); } catch {}
    return true;
  }

  async function finalizeScene(scene, stars = 1) {
    await ensureRuntime();
    let current = await globalThis.SolivocForestStory.restore();
    if (!current || current.sceneId !== scene.id) throw new Error("story_scene_not_active");
    const after = await runPhase(scene, "afterGameplay", current, false);
    current = after.state;
    await globalThis.SolivocForestStory.completeScene(scene.id);
    await ensureRuntime(true);
    showWin?.(stars, [], null, false);
    resetCombo?.();
    return current;
  }

  async function startScene(scene) {
    const game = gameState();
    if (game?.mode === "story" && game.sceneId === scene.id && game.rewarded) return finalizeScene(scene, game.lastStars || 1);
    if (resumable(scene)) return resume();
    const runtime = globalThis.SolivocForestStory; if (!runtime?.beginScene) throw new Error("story_runtime_unavailable");
    globalThis.SolivocStoryGeneration?.prepare?.(scene, WORLD_ID);
    let current = await runtime.restore();
    if (current?.sceneId !== scene.id || current.status !== "active") current = (await runtime.beginScene(scene.id)).state;
    return launchGameplay(scene, current);
  }

  function guideCopy(type, value) { if (type !== "core-loop-intro") return ""; if ((value?.completed || 0) > 0) return "Первая категория собрана. Остальные работают по тому же принципу."; if ((value?.run?.moves || 0) > 0) return "Связь найдена. Собирай слова одной темы вместе."; return "Начни с самой очевидной связи: перенеси одно связанное слово на другое."; }
  function syncGuide() {
    const game = document.querySelector(".game"); if (!game) return; let strip = document.getElementById("storyGameplayGuide");
    if (!strip) { strip = document.createElement("section"); strip.id = "storyGameplayGuide"; strip.className = "story-gameplay-guide"; strip.innerHTML = `<div class="story-guide-cast"></div><div class="story-guide-copy"><small></small><b></b><span></span></div>`; game.insertBefore(strip, game.querySelector(".draw-row") || game.firstChild); }
    const current = gameState(), scene = current?.mode === "story" ? sceneById(current.sceneId) : null, guide = scene?.presentation?.gameplayGuide; strip.hidden = !(scene && guide && !current.rewarded && !current.failed); if (strip.hidden) return;
    strip.querySelector(".story-guide-cast").innerHTML = cast(scene.presentation?.characters || [], true); strip.querySelector("small").textContent = `${scene.presentation?.areaLabel || campaign().worldLabel} · ${(scene.presentation?.characters || []).map(charName).join(" И ").toUpperCase()}`; strip.querySelector("b").textContent = scene.meaning; strip.querySelector("span").textContent = guideCopy(guide.type, current);
  }

  function decorateWin() {
    const current = gameState(); if (current?.mode !== "story") return;
    const scene = sceneById(current.sceneId), next = nextScene(scene), c = campaign();
    const title = document.getElementById("winTitle"), text = document.getElementById("winText"), xp = document.getElementById("winXp"), goals = document.getElementById("winGoals"), nextBtn = document.getElementById("next"), share = document.getElementById("winShare"), companion = document.getElementById("winCompanion");
    if (title) title.textContent = `${scene?.meaning || `Уровень ${current.level}`} · завершено`;
    if (text) { text.textContent = `${c.worldLabel} · ${current.level}/${c.totalLevels}${next ? ` · дальше: «${next.meaning}»` : ""}`; text.hidden = false; }
    if (xp) xp.innerHTML = "<b>История сохраняется отдельно от Классики</b>";
    if (goals) goals.innerHTML = ""; if (nextBtn) nextBtn.textContent = "Вернуться в Историю →"; if (share) share.hidden = true; if (companion) companion.hidden = true;
  }

  function finishStory() {
    const current = gameState();
    if (!current || current.rewarded) return false;
    if (!(current.totalCategories > 0 && current.completed === current.totalCategories && (current.run?.moves || 0) > 0 && isPlayableGeneratedState?.(current))) return false;
    const scene = sceneById(current.sceneId); if (!scene) return false;
    current.rewarded = true;
    const stars = calculateStars?.() || 1; current.lastStars = stars; current.run.xpEarned = 0; current.run.xpBaseEarned = 0;
    if (profile?.stats) { profile.stats.gamesPlayed = (profile.stats.gamesPlayed || 0) + 1; profile.stats.totalMoves = (profile.stats.totalMoves || 0) + (current.run.moves || 0); }
    try { save?.({ immediate: true }); flushProfileSave?.({ skipCloud: true }); } catch {}
    completionPromise = finalizeScene(scene, stars).catch(handleError);
    return true;
  }

  function handleError(error) { console.error("story presentation", error); try { showToast?.("Историю пока не удалось открыть"); } catch {} }
  async function openStory() {
    const button = document.querySelector("[data-story-entry]");
    if (button?.disabled) return;
    if (button) button.disabled = true;
    try {
      // The hub already renders from a valid snapshot. Do not block entry on a
      // forced bootstrap: stale/slow narrative storage must never freeze UI.
      if (!snapshot) await ensureRuntime(false);
      const scene = targetScene();
      if (!scene) throw new Error("story_scene_missing");
      if (resumable(scene)) return resume();
      showScene(scene);
    } catch (error) {
      handleError(error);
    } finally {
      if (button?.isConnected) button.disabled = false;
    }
  }

  function install() {
    if (installed) return true;
    if (typeof homeTabMarkup !== "function" || typeof bindHubHandlers !== "function" || typeof finishLevel !== "function" || typeof render !== "function" || !globalThis.SolivocStoryPerspective || !globalThis.SolivocStoryChoice) return false;
    installed = true; installStyles();
    const home = homeTabMarkup; homeTabMarkup = () => `${gatewayMarkup()}${home()}`;
    if (typeof modesTabMarkup === "function") { const modes = modesTabMarkup; modesTabMarkup = () => modes().replace("<h3>Режимы игры</h3>", "<h3>Расклады</h3>"); }
    if (typeof hubTabsMarkup === "function") { const tabs = hubTabsMarkup; hubTabsMarkup = () => tabs().replace("<span>Режимы</span>", "<span>Расклады</span>"); }
    const bind = bindHubHandlers; bindHubHandlers = function(){ bind(); document.querySelector("[data-story-entry]")?.addEventListener("click", openStory); const layouts = document.querySelector("[data-story-layouts]"); if (layouts) layouts.onclick = () => { hubTab = "modes"; renderHub(); }; if (!snapshot) ensureRuntime().then(() => { if (hubTab === "home" && document.getElementById("hub")?.classList.contains("show")) renderHub(); }).catch(()=>{}); };
    const finish = finishLevel; finishLevel = function(){ return gameState()?.mode === "story" ? finishStory() : finish(); };
    const win = showWin; showWin = function(...args){ const result = win(...args); decorateWin(); return result; };
    const draw = render; render = function(...args){ const result = draw(...args); syncGuide(); return result; };
    const restart = restartCurrentLevel; restartCurrentLevel = function(){ const current = gameState(); if (current?.mode !== "story") return restart(); const scene = sceneById(current.sceneId); if (!scene) return false; globalThis.SolivocStoryGeneration?.prepare?.(scene, WORLD_ID); const result = makeLevel?.(scene.level, { mode:"story", storyWorldId:WORLD_ID, storySceneId:scene.id, forceSolvable:true }); if (result !== false) attach(scene); return result; };
    const companion = syncGameCompanion; syncGameCompanion = function(){ if (gameState()?.mode === "story") { const button = document.getElementById("gameCompanion"); if (button) button.hidden = true; return; } return companion(); };
    document.addEventListener("click", (event) => { if (!event.target?.closest?.("#next") || gameState()?.mode !== "story") return; event.preventDefault(); event.stopImmediatePropagation(); closeWinModal?.(); Promise.resolve(completionPromise).finally(async () => { try { await ensureRuntime(true); } catch {} openHub?.("home"); }); }, true);
    return true;
  }

  globalThis.SolivocStoryPresentation = Object.freeze({ gatewayModel, targetScene, guideCopy, runPhase, openStoryEntry: openStory, startScene });
  let attempts = 0; const timer = setInterval(() => { attempts++; if (install() || attempts > 180) clearInterval(timer); }, 50); if (document.readyState === "complete") install(); else window.addEventListener("load", install, { once:true });
})();