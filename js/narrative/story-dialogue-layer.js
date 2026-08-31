/* Balanced Story dialogue layer for authored Forest beats. Presentation only. */
(() => {
  if (typeof document === "undefined" || globalThis.__solivocStoryDialogueLayer) return;
  globalThis.__solivocStoryDialogueLayer = true;

  const CHARACTERS = Object.freeze({
    cat: { name: "Кот", art: "./icons/mascots/cat/cat-1.webp" },
    owl: { name: "Сова", art: "./icons/mascots/owl/owl-1.webp" },
  });

  const DIALOGUES = Object.freeze({
    "1:before": [
      { speaker: "cat", text: "Хм. Поляна помнит многое, но тебя я здесь прежде не встречал." },
      { speaker: "owl", text: "И это всё, что мы пока вправе сказать. Ты здесь. Перед тобой связи. Начнём с наблюдения." },
      { speaker: "cat", text: "Я — Кот. Мне проще понимать новое, когда я слышу в нём отголосок уже случившегося." },
      { speaker: "owl", text: "Сова. Я предпочитаю сначала проверить то, что действительно видно сейчас." },
      { speaker: "cat", text: "Два взгляда на один Лес." },
      { speaker: "owl", text: "И ни один не освобождает от необходимости думать. Покажи, как ты видишь первую связь." },
    ],
    "2:before": [
      { speaker: "cat", text: "Эту связь ты уже видел. Не буквально — но рисунок знаком." },
      { speaker: "cat", text: "Память не даёт готовый ответ. Она напоминает, на что уже стоит обратить внимание." },
      { speaker: "cat", text: "Попробуй услышать знакомое в новом. Это и есть начало Эха памяти." },
    ],
    "3:before": [
      { speaker: "owl", text: "Похожее удобно замечать. Опасно — принимать за одинаковое." },
      { speaker: "owl", text: "Посмотри точнее: какой признак связывает эти вещи, а какой только кажется важным?" },
      { speaker: "owl", text: "Пристальный взгляд не торопит ответ. Он отсекает лишнее." },
    ],
    "4:before": [
      { speaker: "cat", text: "Теперь попробуй без подсказки." },
      { speaker: "owl", text: "Сначала реши сам. Мы посмотрим, что именно ты замечаешь." },
      { speaker: "cat", text: "Мы останемся рядом, но вмешаемся только если история действительно потребует." },
    ],
    "5:after": [
      { speaker: "cat", text: "Поляна уже не кажется пустой, правда? Здесь есть вещи, у которых были истории до твоего появления." },
      { speaker: "owl", text: "Но история — не догадка. Выбери один след и посмотри, что он действительно позволяет узнать." },
    ],
    "8:before": [
      { speaker: "cat", text: "Я бы начал с того, что уже видел. Иногда прошлое подсказывает форму вопроса." },
      { speaker: "owl", text: "А я — с признака, который можно проверить сейчас." },
      { speaker: "cat", text: "Выбери наш взгляд, если он нужен." },
      { speaker: "owl", text: "Или реши без него. Это тоже допустимо." },
    ],
    "10:after": [
      { speaker: "cat", text: "Когда ты появился, Поляна была просто местом. Теперь в ней уже есть знакомые связи и незаконченные истории." },
      { speaker: "owl", text: "Потому что ты начал различать: что видел, что понял и что только предполагаешь." },
      { speaker: "cat", text: "Лес дальше станет сложнее." },
      { speaker: "owl", text: "Хорошо. Значит, придётся смотреть внимательнее." },
    ],
  });

  let bypassNextStoryAction = false;
  let activeSession = null;

  function gameState() {
    try { return typeof state !== "undefined" ? state : globalThis.state || null; }
    catch { return globalThis.state || null; }
  }

  function storyApi() { return globalThis.SolivocStoryPresentation || null; }

  function dialogueKey(scene, phase) {
    const level = Math.max(0, Math.trunc(Number(scene?.level) || 0));
    return `${level}:${phase}`;
  }

  function shownKey(scene, phase) {
    return `solivoc.story.dialogue.forest.${dialogueKey(scene, phase)}`;
  }

  function wasShown(scene, phase) {
    try { return sessionStorage.getItem(shownKey(scene, phase)) === "1"; }
    catch { return false; }
  }

  function markShown(scene, phase) {
    try { sessionStorage.setItem(shownKey(scene, phase), "1"); } catch {}
  }

  function phaseFor(scene) {
    const game = gameState();
    return game?.mode === "story" && game.sceneId === scene?.id && game.rewarded ? "after" : "before";
  }

  function installStyles() {
    if (document.getElementById("storyDialogueLayerStyles")) return;
    const style = document.createElement("style");
    style.id = "storyDialogueLayerStyles";
    style.textContent = `
      .story-dialogue-layer{position:fixed;inset:0;z-index:16050;display:grid;place-items:center;padding:16px;background:rgba(5,8,18,.84);backdrop-filter:blur(16px)}
      .story-dialogue-layer[hidden]{display:none}
      .story-dialogue-card{width:min(440px,100%);overflow:hidden;border:1px solid #ffffff20;border-radius:28px;background:linear-gradient(165deg,#173c35,#171c42 72%);box-shadow:0 24px 80px #0008;color:#fff}
      .story-dialogue-stage{min-height:240px;position:relative;display:flex;align-items:flex-end;justify-content:center;padding:20px 24px 0;background:radial-gradient(circle at 50% 22%,#65887855,transparent 46%),linear-gradient(180deg,#315d52,#18342e)}
      .story-dialogue-stage img{width:min(210px,54vw);height:min(210px,54vw);object-fit:contain;filter:drop-shadow(0 14px 15px #06181388)}
      .story-dialogue-body{padding:19px 20px 20px}
      .story-dialogue-eyebrow{display:flex;align-items:center;justify-content:space-between;gap:12px;color:#aee4bd;font-size:9px;font-weight:950;letter-spacing:.14em}
      .story-dialogue-counter{color:#98a5bc;letter-spacing:0;font-weight:800}
      .story-dialogue-speaker{margin:8px 0 7px;font-size:21px;line-height:1.1}
      .story-dialogue-text{min-height:66px;margin:0;color:#eef4f0;font-size:14px;line-height:1.55}
      .story-dialogue-actions{display:grid;grid-template-columns:auto 1fr;gap:8px;margin-top:17px}
      .story-dialogue-actions button{min-height:44px;border:0;border-radius:14px;font-weight:950;cursor:pointer}
      .story-dialogue-brief{padding:0 13px;background:#ffffff0d;color:#d5d9e3}
      .story-dialogue-next{background:#eef3dc;color:#23352e}
      .story-gameplay-guide.story-guide-neutral .story-guide-cast{display:none}
      .story-gameplay-guide.story-guide-neutral{grid-template-columns:1fr}
      .story-gameplay-guide.story-guide-neutral .story-guide-copy small{color:#9edab0}
    `;
    document.head.appendChild(style);
  }

  function ensureLayer() {
    let layer = document.getElementById("storyDialogueLayer");
    if (layer) return layer;
    layer = document.createElement("div");
    layer.id = "storyDialogueLayer";
    layer.className = "story-dialogue-layer";
    layer.hidden = true;
    layer.innerHTML = `
      <div class="story-dialogue-card" role="dialog" aria-modal="true" aria-label="Сюжетная сцена">
        <div class="story-dialogue-stage"><img alt=""></div>
        <div class="story-dialogue-body">
          <div class="story-dialogue-eyebrow"><span>ИСТОРИЯ · МИР ЛЕСА</span><span class="story-dialogue-counter"></span></div>
          <h2 class="story-dialogue-speaker"></h2>
          <p class="story-dialogue-text"></p>
          <div class="story-dialogue-actions">
            <button type="button" class="story-dialogue-brief">К раскладу</button>
            <button type="button" class="story-dialogue-next">Продолжить →</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(layer);
    layer.querySelector(".story-dialogue-next").addEventListener("click", () => advanceDialogue(false));
    layer.querySelector(".story-dialogue-brief").addEventListener("click", () => advanceDialogue(true));
    return layer;
  }

  function setText(node, value) {
    if (node && node.textContent !== value) node.textContent = value;
  }

  function renderDialogue() {
    if (!activeSession) return;
    const layer = ensureLayer();
    const beat = activeSession.beats[activeSession.index];
    const character = CHARACTERS[beat?.speaker] || CHARACTERS.cat;
    const image = layer.querySelector(".story-dialogue-stage img");
    if (image.src !== new URL(character.art, document.baseURI).href) image.src = character.art;
    if (image.alt !== character.name) image.alt = character.name;
    setText(layer.querySelector(".story-dialogue-speaker"), character.name);
    setText(layer.querySelector(".story-dialogue-text"), beat?.text || "");
    setText(layer.querySelector(".story-dialogue-counter"), `${activeSession.index + 1}/${activeSession.beats.length}`);
    const last = activeSession.index >= activeSession.beats.length - 1;
    setText(layer.querySelector(".story-dialogue-next"), last ? (activeSession.phase === "after" ? "Продолжить историю →" : "К раскладу →") : "Продолжить →");
    layer.querySelector(".story-dialogue-brief").hidden = activeSession.beats.length <= 1 || last;
    layer.hidden = false;
  }

  function finishDialogue() {
    const session = activeSession;
    activeSession = null;
    const layer = ensureLayer();
    layer.hidden = true;
    layer.setAttribute("aria-hidden", "true");
    if (!session) return;
    markShown(session.scene, session.phase);
    bypassNextStoryAction = true;
    session.actionButton.click();
  }

  function advanceDialogue(skip) {
    if (!activeSession) return;
    if (skip || activeSession.index >= activeSession.beats.length - 1) return finishDialogue();
    activeSession.index += 1;
    renderDialogue();
  }

  function startDialogue(scene, phase, actionButton) {
    const beats = DIALOGUES[dialogueKey(scene, phase)];
    if (!Array.isArray(beats) || !beats.length) return false;
    activeSession = { scene, phase, actionButton, beats, index: 0 };
    const layer = ensureLayer();
    layer.setAttribute("aria-hidden", "false");
    renderDialogue();
    return true;
  }

  function interceptStoryAction(event) {
    const button = event.target?.closest?.("#storySceneModal .story-scene-start");
    if (!button) return;
    if (bypassNextStoryAction) { bypassNextStoryAction = false; return; }
    const api = storyApi();
    const scene = api?.targetScene?.();
    if (!scene) return;
    const phase = phaseFor(scene);
    if (!DIALOGUES[dialogueKey(scene, phase)] || wasShown(scene, phase)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    startDialogue(scene, phase, button);
  }

  function neutralizeGameplayGuide() {
    const strip = document.getElementById("storyGameplayGuide");
    if (!strip) return;
    const game = gameState();
    if (game?.mode !== "story") return;
    if (!strip.classList.contains("story-guide-neutral")) strip.classList.add("story-guide-neutral");
    setText(strip.querySelector(".story-guide-copy small"), "ПОДСКАЗКА");
    const moved = Math.max(0, Math.trunc(Number(game?.run?.moves) || 0));
    const completed = Math.max(0, Math.trunc(Number(game?.completed) || 0));
    if (moved > 0 || completed > 0) {
      if (!strip.hidden) strip.hidden = true;
      return;
    }
    setText(strip.querySelector(".story-guide-copy b"), "Первая связь");
    setText(strip.querySelector(".story-guide-copy span"), "Перенеси одно связанное слово на другое. Дальше попробуй читать поле самостоятельно.");
  }

  function install() {
    installStyles();
    ensureLayer();
    document.addEventListener("click", interceptStoryAction, true);

    // Do not observe and rewrite the same gameplay DOM. That creates a feedback
    // loop under frequent board renders and can lock the main thread. A small,
    // idempotent timer is sufficient for this presentation-only decoration.
    setInterval(neutralizeGameplayGuide, 500);
    neutralizeGameplayGuide();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
  else install();
})();
