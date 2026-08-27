/* Generic authored Story choice presentation and semantic commit flow. */
(() => {
  const STEP_TYPE = "choice";
  const PROMPTS = Object.freeze({
    attention: "Выбери, на что обратить внимание сейчас.",
    perspective: "Как ты хочешь посмотреть на эту задачу сейчас?",
    routing_question: "Выбери, куда направить исследование дальше.",
  });

  function phaseSteps(scene, phase = "beforeGameplay") {
    const list = scene?.flow?.[phase];
    return Array.isArray(list) ? list : [];
  }

  function choiceSteps(scene, phase = "beforeGameplay") {
    return phaseSteps(scene, phase).filter((step) => step?.type === STEP_TYPE && step?.required !== false);
  }

  function stepCompleted(step, runtimeState) {
    return !!runtimeState?.choiceSelections?.[step?.choiceId]?.optionId;
  }

  function pendingStep(scene, runtimeState, phase = "beforeGameplay") {
    return choiceSteps(scene, phase).find((step) => !stepCompleted(step, runtimeState)) || null;
  }

  function installStyles() {
    if (typeof document === "undefined" || document.getElementById("storyChoiceStyles")) return;
    const style = document.createElement("style");
    style.id = "storyChoiceStyles";
    style.textContent = `
      .story-choice-modal{position:fixed;inset:0;z-index:14100;display:grid;place-items:center;padding:16px;background:#080b18de;backdrop-filter:blur(14px)}.story-choice-modal[hidden]{display:none}
      .story-choice-card{width:min(470px,100%);max-height:min(88vh,760px);overflow:auto;border:1px solid #ffffff1b;border-radius:28px;background:linear-gradient(165deg,#203c33,#171d42 72%);color:#fff;box-shadow:0 30px 90px #000b}
      .story-choice-copy{padding:20px}.story-choice-copy small{display:block;color:#b9ddae;font-size:9px;font-weight:950;letter-spacing:.14em}.story-choice-copy h2{margin:7px 0 5px;font-size:25px;line-height:1.15}.story-choice-copy p{margin:0;color:#cbd5d1;font-size:11px;line-height:1.45}
      .story-choice-options{display:grid;gap:8px;margin-top:16px}.story-choice-option{display:grid;gap:3px;width:100%;padding:13px 14px;border:1px solid #ffffff16;border-radius:15px;background:#ffffff08;color:#fff;text-align:left;font:inherit}.story-choice-option:hover{background:#ffffff10}.story-choice-option b{font-size:11px}.story-choice-option span{color:#bfc9c5;font-size:9px}
      .story-choice-back{margin-top:13px;min-height:38px;padding:0 13px;border:0;border-radius:12px;background:#ffffff0d;color:#ddd;font:inherit;font-size:9px;font-weight:900}.story-choice-back[hidden]{display:none}
      @media(max-width:390px){.story-choice-card{border-radius:23px}.story-choice-copy{padding:17px}}
      @media(prefers-reduced-motion:reduce){.story-choice-modal *{animation:none!important;transition:none!important}}
    `;
    document.head.appendChild(style);
  }

  function ensureModal() {
    if (typeof document === "undefined") return null;
    let modal = document.getElementById("storyChoiceModal");
    if (modal) return modal;
    installStyles();
    modal = document.createElement("div");
    modal.id = "storyChoiceModal";
    modal.className = "story-choice-modal";
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
    modal.innerHTML = `<div class="story-choice-card" role="dialog" aria-modal="true" aria-labelledby="storyChoiceTitle"><div class="story-choice-copy"><small>ИСТОРИЯ · ВЫБОР</small><h2 id="storyChoiceTitle"></h2><p id="storyChoicePrompt"></p><div class="story-choice-options"></div><button class="story-choice-back" type="button">Назад</button></div></div>`;
    document.body.appendChild(modal);
    return modal;
  }

  function optionDetail(step, option) {
    if (step.kind === "perspective" && option.id === "no_borrowed_perspective") return "Решить обычным способом";
    if (step.kind === "perspective") return "Использовать знакомую перспективу";
    if (step.kind === "attention") return "Осмотреть этот объект сейчас";
    if (step.kind === "routing_question") return "Продолжить исследование в этом направлении";
    return "Выбрать";
  }

  async function commitStep(scene, step, option) {
    const runtime = globalThis.SolivocForestStory;
    if (!runtime?.selectChoice) throw new Error("story_choice_runtime_unavailable");
    const result = await runtime.selectChoice(scene.id, step.choiceId, option.id);
    try {
      globalThis.track?.("story_choice_selected", {
        world: scene.worldId || "forest",
        scene: scene.id,
        choice: step.choiceId,
        option: option.id,
        kind: step.kind,
      });
    } catch {}
    return result.state;
  }

  function runStep(scene, step, runtimeState = null, { allowCancel = true } = {}) {
    if (stepCompleted(step, runtimeState)) return Promise.resolve({ state: runtimeState, cancelled: false, replayed: true });
    const modal = ensureModal();
    if (!modal) return Promise.reject(new Error("story_choice_ui_unavailable"));
    modal.querySelector("#storyChoiceTitle").textContent = scene.meaning || `Уровень ${scene.level}`;
    modal.querySelector("#storyChoicePrompt").textContent = step.prompt || PROMPTS[step.kind] || "Сделай выбор.";
    const options = modal.querySelector(".story-choice-options");
    options.innerHTML = "";
    const back = modal.querySelector(".story-choice-back");
    back.hidden = !allowCancel;

    return new Promise((resolve, reject) => {
      const close = (value) => {
        modal.hidden = true;
        modal.setAttribute("aria-hidden", "true");
        resolve(value);
      };
      back.onclick = allowCancel ? () => close({ state: runtimeState, cancelled: true }) : null;
      for (const option of Array.isArray(step.options) ? step.options : []) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "story-choice-option";
        button.innerHTML = `<b></b><span></span>`;
        button.querySelector("b").textContent = option.label || option.id;
        button.querySelector("span").textContent = optionDetail(step, option);
        button.onclick = async () => {
          for (const candidate of options.querySelectorAll("button")) candidate.disabled = true;
          try {
            close({ state: await commitStep(scene, step, option), cancelled: false, optionId: option.id });
          } catch (error) {
            for (const candidate of options.querySelectorAll("button")) candidate.disabled = false;
            reject(error);
          }
        };
        options.appendChild(button);
      }
      modal.hidden = false;
      modal.setAttribute("aria-hidden", "false");
    });
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

  globalThis.SolivocStoryChoice = Object.freeze({
    stepType: STEP_TYPE,
    choiceSteps,
    stepCompleted,
    pendingStep,
    runStep,
    runPending,
  });
})();
