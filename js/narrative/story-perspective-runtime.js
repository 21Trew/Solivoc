/* Generic Story perspective step presentation and commit flow. */
(() => {
  const STEP_TYPE = "forced-perspective";
  let pendingPromise = null;
  let pendingResolve = null;
  const CHARACTER_LABELS = Object.freeze({ cat: "Кот", owl: "Сова", fox: "Лис" });

  function phaseSteps(scene, phase = "beforeGameplay") {
    return Array.isArray(scene?.flow?.[phase]) ? scene.flow[phase] : [];
  }
  function perspectiveSteps(scene, phase = "beforeGameplay") {
    return phaseSteps(scene, phase).filter((step) => step?.type === STEP_TYPE && step?.forced === true);
  }
  function stepCompleted(step, runtimeState) {
    return runtimeState?.forcedTutorials?.[step?.perspectiveId]?.used === true;
  }
  function pendingStep(scene, runtimeState, phase = "beforeGameplay") {
    return perspectiveSteps(scene, phase).find((step) => !stepCompleted(step, runtimeState)) || null;
  }
  function characterLabel(characterId) { return CHARACTER_LABELS[characterId] || "Персонаж"; }
  function mascotSrc(characterId) {
    const safe = /^[a-z0-9-]+$/.test(String(characterId || "")) ? String(characterId) : "cat";
    return `./icons/mascot-${safe}.svg`;
  }

  function installStyles() {
    if (typeof document === "undefined" || document.getElementById("storyPerspectiveStyles")) return;
    const style = document.createElement("style");
    style.id = "storyPerspectiveStyles";
    style.textContent = `.story-perspective-modal{position:fixed;inset:0;z-index:17090;display:grid;place-items:center;padding:16px;background:#080b18da;backdrop-filter:blur(14px);pointer-events:auto}.story-perspective-modal[hidden]{display:none}.story-perspective-card{position:relative;z-index:1;width:min(430px,100%);overflow:hidden;border:1px solid #ffffff1b;border-radius:28px;background:linear-gradient(165deg,#233c32,#171d42 72%);color:#fff;box-shadow:0 30px 90px #000b;pointer-events:auto}.story-perspective-visual{min-height:205px;display:grid;place-items:end center;background:linear-gradient(180deg,#49644f,#294239 55%,#182d28)}.story-perspective-visual img{width:145px;height:145px;object-fit:contain}.story-perspective-copy{padding:20px}.story-perspective-copy small{display:block;color:#b9ddae;font-size:9px;font-weight:950;letter-spacing:.14em}.story-perspective-copy h2{margin:7px 0 4px;font-size:28px}.story-perspective-copy p{margin:13px 0 0;color:#e1e7e4;font-size:12px;line-height:1.5}.story-perspective-copy em{display:block;margin-top:10px;color:#aebbb5;font-size:9px;line-height:1.4;font-style:normal}.story-perspective-actions{display:grid;grid-template-columns:auto 1fr;gap:8px;margin-top:18px}.story-perspective-actions button{min-height:44px;border:0;border-radius:14px;font:inherit;font-size:10px;font-weight:950;pointer-events:auto;cursor:pointer}.story-perspective-actions button:disabled{opacity:.55;cursor:wait}.story-perspective-back{padding:0 14px;background:#ffffff0d;color:#ddd}.story-perspective-use{background:#eef3dc;color:#23352e}`;
    document.head.appendChild(style);
  }

  function ensureModal() {
    if (typeof document === "undefined") return null;
    let modal = document.getElementById("storyPerspectiveModal");
    if (modal) return modal;
    installStyles();
    modal = document.createElement("div"); modal.id = "storyPerspectiveModal"; modal.className = "story-perspective-modal"; modal.hidden = true; modal.setAttribute("aria-hidden", "true");
    modal.innerHTML = `<div class="story-perspective-card" role="dialog" aria-modal="true"><div class="story-perspective-visual"><img id="storyPerspectiveMascot" src="" alt=""></div><div class="story-perspective-copy"><small>ПЕРСПЕКТИВА</small><h2 id="storyPerspectiveTitle"></h2><p id="storyPerspectiveSummary"></p><em id="storyPerspectiveNote"></em><div class="story-perspective-actions"><button class="story-perspective-back" type="button">Назад</button><button class="story-perspective-use" type="button"></button></div></div></div>`;
    document.body.appendChild(modal);
    return modal;
  }

  function resetButtons(modal) {
    if (!modal) return;
    const back = modal.querySelector(".story-perspective-back");
    const action = modal.querySelector(".story-perspective-use");
    if (back) back.disabled = false;
    if (action) action.disabled = false;
  }

  function closeModal(value) {
    const modal = typeof document !== "undefined" ? document.getElementById("storyPerspectiveModal") : null;
    if (modal) {
      resetButtons(modal);
      modal.hidden = true;
      modal.setAttribute("aria-hidden", "true");
    }
    const resolve = pendingResolve; pendingResolve = null; pendingPromise = null; resolve?.(value);
  }

  async function commitStep(scene, step) {
    const runtime = globalThis.SolivocForestStory;
    if (!runtime?.useForcedPerspective) throw new Error("story_runtime_unavailable");
    return (await runtime.useForcedPerspective(scene.id, step.perspectiveId)).state;
  }

  function runStep(scene, step, runtimeState = null, { allowCancel = true } = {}) {
    if (stepCompleted(step, runtimeState)) return Promise.resolve({ state: runtimeState, cancelled: false, replayed: true });
    const modal = ensureModal();
    if (!modal) return Promise.reject(new Error("story_perspective_ui_unavailable"));

    // Perspective is the active interaction layer. A stale presentation overlay
    // must never sit above it and swallow pointer events.
    const dialogue = document.getElementById("storyDialogueLayer");
    if (dialogue && !dialogue.hidden) {
      dialogue.hidden = true;
      dialogue.setAttribute("aria-hidden", "true");
    }

    const label = String(step.label || "Перспектива"), character = characterLabel(step.characterId), mascot = modal.querySelector("#storyPerspectiveMascot");
    mascot.src = mascotSrc(step.characterId); mascot.alt = character;
    modal.querySelector("#storyPerspectiveTitle").textContent = label;
    modal.querySelector("#storyPerspectiveSummary").textContent = `${character} показывает другой способ смотреть на расклад.`;
    modal.querySelector("#storyPerspectiveNote").textContent = "Обязательное знакомство сохраняет опыт, но не считается выбором предпочтительной перспективы.";
    const back = modal.querySelector(".story-perspective-back"), action = modal.querySelector(".story-perspective-use");

    // The modal node is reused between tutorial steps. Always clear transient
    // disabled state left by the previous successful commit.
    resetButtons(modal);
    back.hidden = !allowCancel;
    action.textContent = `Попробовать «${label}» →`;
    back.onclick = allowCancel ? () => closeModal({ state: runtimeState, cancelled: true }) : null;
    action.onclick = async () => {
      if (action.disabled) return;
      action.disabled = true;
      try { closeModal({ state: await commitStep(scene, step), cancelled: false }); }
      catch (error) { action.disabled = false; console.error("story perspective", error); }
    };
    modal.hidden = false; modal.setAttribute("aria-hidden", "false");
    if (!pendingPromise) pendingPromise = new Promise((resolve) => { pendingResolve = resolve; });
    return pendingPromise;
  }

  async function runPending(scene, runtimeState = null, phase = "beforeGameplay", options = {}) {
    let current = runtimeState || await globalThis.SolivocForestStory?.restore?.();
    for (;;) {
      const step = pendingStep(scene, current, phase);
      if (!step) return { state: current, cancelled: false };
      const result = await runStep(scene, step, current, options);
      if (result.cancelled) return result;
      current = result.state;
    }
  }

  globalThis.SolivocStoryPerspective = Object.freeze({ stepType: STEP_TYPE, perspectiveSteps, stepCompleted, pendingStep, runStep, runPending });
})();
