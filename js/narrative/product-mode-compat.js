/* Product compatibility bridge: Story and Modes coexist without moving Classic progress. */
(() => {
  const CLASSIC_MODE = "regular";
  let installed = false, normalizedStoryShell = false;

  function playerProfile() { try { return typeof profile !== "undefined" ? profile : globalThis.profile || {}; } catch { return globalThis.profile || {}; } }
  function gameState() { try { return typeof state !== "undefined" ? state : globalThis.state || null; } catch { return globalThis.state || null; } }

  function classicProgressModel(value = playerProfile(), current = gameState()) {
    const p = value && typeof value === "object" ? value : {};
    const stars = p.starsByLevel && typeof p.starsByLevel === "object" ? p.starsByLevel : {};
    const nextLevel = Math.max(1, Math.trunc(Number(p.currentLevel) || 1));
    const completed = Math.max(0, nextLevel - 1);
    const totalStars = Object.values(stars).reduce((sum, raw) => sum + Math.max(0, Math.min(3, Math.trunc(Number(raw) || 0))), 0);
    const active = !!(current && current.mode === CLASSIC_MODE && current.rewarded !== true && current.failed !== true);
    return Object.freeze({ mode: CLASSIC_MODE, nextLevel, completed, totalStars, active });
  }

  function classicCardMarkup() {
    const model = classicProgressModel();
    const title = model.active ? `Продолжить уровень ${Math.max(1, Math.trunc(Number(gameState()?.level) || model.nextLevel))}` : `Уровень ${model.nextLevel}`;
    const meta = model.completed ? `${model.completed} пройдено · ${model.totalStars} ★` : "Начать классическое прохождение";
    return `<section class="hub-section classic-mode-section"><button type="button" class="classic-mode-card" data-classic-mode><span class="classic-mode-icon">♣</span><span class="classic-mode-copy"><small>КЛАССИКА</small><b>${title}</b><em>${meta}</em></span><span class="classic-mode-arrow">→</span></button></section>`;
  }

  function normalizeProductMarkup(markup) {
    return String(markup || "")
      .replaceAll("История и Расклады", "История и Режимы")
      .replaceAll("<b>Расклады</b><small>Свободная игра и режимы</small>", "<b>Режимы</b><small>Классика и другие режимы</small>")
      .replaceAll("<h3>Расклады</h3>", "<h3>Режимы игры</h3>")
      .replaceAll("<span>Расклады</span>", "<span>Режимы</span>");
  }

  function launchClassic() {
    const model = classicProgressModel(), current = gameState();
    try { closeHub?.(); } catch {}
    if (model.active && current) {
      try { render?.(); updateCoach?.(); setBackgroundMusic?.(musicModeForState?.(current) || "game"); } catch {}
      return Object.freeze({ resumed: true, level: Math.max(1, Math.trunc(Number(current.level) || model.nextLevel)), mode: CLASSIC_MODE });
    }
    const result = typeof makeLevel === "function" ? makeLevel(model.nextLevel, { mode: CLASSIC_MODE }) : false;
    return Object.freeze({ resumed: false, level: model.nextLevel, mode: CLASSIC_MODE, result });
  }

  globalThis.SolivocProductModes = Object.freeze({ classicProgressModel, normalizeProductMarkup, launchClassic });
  if (typeof document === "undefined") return;

  function installStyles() {
    if (document.getElementById("productModeCompatStyles")) return;
    const style = document.createElement("style");
    style.id = "productModeCompatStyles";
    style.textContent = `.classic-mode-section{padding:0!important;background:transparent!important;border:0!important}.classic-mode-card{width:100%;min-height:104px;display:grid;grid-template-columns:auto 1fr auto;gap:13px;align-items:center;padding:16px;border:1px solid #ffffff18;border-radius:22px;background:linear-gradient(145deg,#2b2746,#1f3751);color:#fff;text-align:left}.classic-mode-icon{width:48px;height:48px;display:grid;place-items:center;border-radius:15px;background:#ffffff12;font-size:25px}.classic-mode-copy{display:grid;gap:3px}.classic-mode-copy small{font-size:8px;font-weight:950;letter-spacing:.15em;color:#cfc4ff}.classic-mode-copy b{font-size:17px}.classic-mode-copy em{font-size:9px;font-style:normal;color:#b9bfd0}.classic-mode-arrow{font-size:22px;color:#e9e4ff}`;
    document.head.appendChild(style);
  }

  function installClassicEntry() {
    if (installed || typeof modesTabMarkup !== "function" || typeof bindHubHandlers !== "function") return false;
    installed = true;
    installStyles();
    const modes = modesTabMarkup;
    modesTabMarkup = function() { return `${classicCardMarkup()}${modes()}`; };
    const bind = bindHubHandlers;
    bindHubHandlers = function() {
      bind();
      const button = document.querySelector("[data-classic-mode]");
      if (button) button.onclick = launchClassic;
    };
    return true;
  }

  function normalizeStoryShell() {
    if (normalizedStoryShell || typeof homeTabMarkup !== "function") return false;
    let sample = "";
    try { sample = homeTabMarkup(); } catch { return false; }
    if (!sample.includes("story-gateway")) return false;
    normalizedStoryShell = true;
    const home = homeTabMarkup;
    homeTabMarkup = () => normalizeProductMarkup(home());
    if (typeof modesTabMarkup === "function") { const modes = modesTabMarkup; modesTabMarkup = () => normalizeProductMarkup(modes()); }
    if (typeof hubTabsMarkup === "function") { const tabs = hubTabsMarkup; hubTabsMarkup = () => normalizeProductMarkup(tabs()); }
    return true;
  }

  function normalizeLiveStoryCopy() {
    const modalButton = document.querySelector("#storySceneModal .story-scene-start");
    if (modalButton?.textContent === "К Раскладам →") modalButton.textContent = "К Режимам →";
  }

  let attempts = 0;
  const timer = setInterval(() => {
    attempts++;
    installClassicEntry();
    normalizeStoryShell();
    normalizeLiveStoryCopy();
    if ((installed && normalizedStoryShell) || attempts > 240) clearInterval(timer);
  }, 50);
  if (document.readyState === "complete") { installClassicEntry(); normalizeStoryShell(); }
})();
