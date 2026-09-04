(() => {
  "use strict";

  // Since canonical-progress v1 the cloud profile is the only source of truth.
  // A stale leaderboard projection must never be allowed to mutate the profile.
  function rewriteLegacyMismatchPanel() {
    const panels = [...document.querySelectorAll(".danger-zone")];
    for (const panel of panels) {
      if (!/Облачный профиль отстаёт от серверного лидерборда/i.test(panel.textContent || "")) continue;
      const title = panel.querySelector("h4");
      const text = panel.querySelector("p");
      const button = panel.querySelector('[data-player-command="repair_player"]');
      if (title) title.textContent = "Проекция лидерборда устарела";
      if (text) text.textContent = "Канонический профиль игрока имеет приоритет. Лидерборд будет пересобран из профиля при следующей серверной синхронизации; данные профиля не изменяются.";
      if (button) {
        button.dataset.canonicalProjectionRefresh = "1";
        delete button.dataset.playerCommand;
        button.textContent = "Обновить карточку";
        button.classList.remove("warning-button");
        button.classList.add("secondary-button");
      }
    }
  }

  function blockLegacyRepair(event) {
    const oldRepair = event.target.closest?.('[data-player-command="repair_player"]');
    if (oldRepair) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      const status = document.getElementById("adminStatus");
      if (status) status.textContent = "Лидерборд больше не используется для изменения профиля. Канонический профиль синхронизируется автоматически.";
      return;
    }
    const refresh = event.target.closest?.("[data-canonical-projection-refresh]");
    if (!refresh) return;
    event.preventDefault();
    event.stopPropagation();
    document.getElementById("globalRefresh")?.click();
  }

  document.addEventListener("click", blockLegacyRepair, true);
  const observer = new MutationObserver(rewriteLegacyMismatchPanel);
  const start = () => {
    observer.observe(document.body, { childList: true, subtree: true });
    rewriteLegacyMismatchPanel();
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
