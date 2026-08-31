/* Forest Story UX polish: compact victory flow and direct story continuation. */
(() => {
  if (typeof document === "undefined" || globalThis.__solivocStoryUxPolish) return;
  globalThis.__solivocStoryUxPolish = true;

  let originalNextHandler = null;

  function gameState() {
    try { return typeof state !== "undefined" ? state : globalThis.state || null; }
    catch { return globalThis.state || null; }
  }

  function installStyles() {
    if (document.getElementById("storyUxPolishStyles")) return;
    const style = document.createElement("style");
    style.id = "storyUxPolishStyles";
    style.textContent = `
      .story-gameplay-guide{display:none!important}
      .win-modal.story-win-polished .win-modal-card{padding-bottom:18px}
      .win-modal.story-win-polished .win-stars{margin-bottom:2px}
      .win-modal.story-win-polished .win-record,
      .win-modal.story-win-polished .win-xp,
      .win-modal.story-win-polished .win-goals,
      .win-modal.story-win-polished .win-next-unlock{display:none!important}
      .win-modal.story-win-polished .modal-actions{width:100%;gap:9px;margin-top:7px}
      .win-modal.story-win-polished .win-next{width:100%;min-height:54px;margin:0}
      .win-modal.story-win-polished .modal-secondary-actions{display:grid;width:100%;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:9px}
      .win-modal.story-win-polished .modal-secondary-actions .secondary{width:100%;min-width:0;margin:0}
    `;
    document.head.appendChild(style);
  }

  function restoreNextButton(button = document.getElementById("storyNext")) {
    if (!button) return;
    button.id = "next";
    if (originalNextHandler) button.onclick = originalNextHandler;
  }

  function openNextStoryStep() {
    const api = globalThis.SolivocStoryPresentation;
    if (api?.openStoryEntry) {
      Promise.resolve(api.openStoryEntry()).catch(() => {
        try { openHub?.("home"); } catch {}
      });
      return;
    }
    try { openHub?.("home"); } catch {}
  }

  function activateStoryNext(button, current) {
    if (!button) return;
    if (button.id === "next") {
      if (!originalNextHandler && typeof button.onclick === "function") originalNextHandler = button.onclick;
      button.id = "storyNext";
    }

    button.textContent = current?.nextStorySceneId ? "Следующий уровень →" : "Вернуться в Историю →";
    button.onclick = () => {
      // Renaming the button prevents the older Story capture handler (#next)
      // from routing the player through the hub. Restore the normal id only
      // after the capture phase has already passed for this click.
      restoreNextButton(button);
      try { closeWinModal?.(); resetCombo?.(); } catch {}
      const action = () => openNextStoryStep();
      if (typeof showRankUpThen === "function") showRankUpThen(action);
      else action();
    };
  }

  function polishWin() {
    const modal = document.getElementById("modal");
    if (!modal) return;

    const current = gameState();
    const storyWin = current?.mode === "story" && current.rewarded;
    if (!storyWin) {
      modal.classList.remove("story-win-polished");
      restoreNextButton();
      return;
    }

    modal.classList.add("story-win-polished");

    const title = document.getElementById("winTitle");
    const xp = document.getElementById("winXp");
    const goals = document.getElementById("winGoals");
    const record = document.getElementById("winRecord");
    const unlock = document.getElementById("winUnlock");
    const next = document.getElementById("next") || document.getElementById("storyNext");
    const level = Math.max(1, Math.trunc(Number(current.level) || 1));

    const nextTitle = `Уровень ${level} пройден`;
    if (title && title.textContent !== nextTitle) title.textContent = nextTitle;

    for (const node of [xp, goals, record, unlock]) {
      if (!node) continue;
      if (node.childNodes.length) node.replaceChildren();
      node.hidden = true;
    }

    activateStoryNext(next, current);
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
