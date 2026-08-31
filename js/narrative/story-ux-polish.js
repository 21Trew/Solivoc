/* Forest Story UX polish: remove redundant gameplay guide and simplify win copy. */
(() => {
  if (typeof document === "undefined" || globalThis.__solivocStoryUxPolish) return;
  globalThis.__solivocStoryUxPolish = true;

  function gameState() {
    try { return typeof state !== "undefined" ? state : globalThis.state || null; }
    catch { return globalThis.state || null; }
  }

  function installStyles() {
    if (document.getElementById("storyUxPolishStyles")) return;
    const style = document.createElement("style");
    style.id = "storyUxPolishStyles";
    style.textContent = `.story-gameplay-guide{display:none!important}`;
    document.head.appendChild(style);
  }

  function polishWin() {
    const current = gameState();
    if (current?.mode !== "story" || !current.rewarded) return;

    const title = document.getElementById("winTitle");
    const xp = document.getElementById("winXp");
    const level = Math.max(1, Math.trunc(Number(current.level) || 1));

    const nextTitle = `Уровень ${level} пройден`;
    if (title && title.textContent !== nextTitle) title.textContent = nextTitle;

    if (xp) {
      if (xp.childNodes.length) xp.replaceChildren();
      if (!xp.hidden) xp.hidden = true;
    }
  }

  function installWinObserver() {
    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      const modal = document.getElementById("modal");
      if (modal) {
        const observer = new MutationObserver(polishWin);
        observer.observe(modal, {
          subtree: true,
          childList: true,
          characterData: true,
          attributes: true,
          attributeFilter: ["class", "hidden", "aria-hidden"],
        });
        polishWin();
        clearInterval(timer);
      } else if (attempts >= 160) {
        clearInterval(timer);
      }
    }, 100);
  }

  function install() {
    installStyles();
    installWinObserver();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
  else install();
})();
