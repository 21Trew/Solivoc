(() => {
  "use strict";

  const projectedAt = new Map();
  const inFlight = new Set();

  function currentUserId() {
    const raw = document.querySelector(".player-title small")?.textContent?.trim() || "";
    return /^u_[a-zA-Z0-9_-]{8,62}$/.test(raw) ? raw : "";
  }

  function legacyMismatchPanel() {
    return [...document.querySelectorAll(".danger-zone")].find((panel) =>
      /Облачный профиль отстаёт от серверного лидерборда|Проекция лидерборда устарела/i.test(panel.textContent || "")
    ) || null;
  }

  function rewriteLegacyMismatchPanel() {
    const panel = legacyMismatchPanel();
    if (!panel) return;
    const title = panel.querySelector("h4");
    const text = panel.querySelector("p");
    const button = panel.querySelector('[data-player-command="repair_player"], [data-canonical-projection-refresh]');
    if (title) title.textContent = "Проекция лидерборда устарела";
    if (text) text.textContent = "Канонический профиль игрока имеет приоритет. Лидерборд пересобирается только из профиля; сам профиль при этой операции не изменяется по данным рейтинга.";
    if (button) {
      button.dataset.canonicalProjectionRefresh = "1";
      delete button.dataset.playerCommand;
      button.textContent = "Пересобрать лидерборд";
      button.classList.remove("warning-button");
      button.classList.add("secondary-button");
    }
  }

  async function canonicalRequest(payload) {
    const response = await apiFetch("/api/admin?canonical=1", {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || data.error || `HTTP ${response.status}`);
    return data;
  }

  async function rebuildPlayerProjection(userId, { quiet = false } = {}) {
    if (!userId || inFlight.has(userId)) return false;
    if (Date.now() - (projectedAt.get(userId) || 0) < 15000) return false;
    inFlight.add(userId);
    const status = document.getElementById("adminStatus");
    try {
      if (!quiet && status) status.textContent = "Пересобираю лидерборд из канонического профиля…";
      await canonicalRequest({ scope: "player", userId });
      projectedAt.set(userId, Date.now());
      if (status) status.textContent = "Проекция лидерборда пересобрана из канонического профиля.";
      setTimeout(() => document.getElementById("globalRefresh")?.click(), 0);
      return true;
    } catch (error) {
      if (status) {
        status.textContent = `Не удалось пересобрать проекцию: ${error?.message || error}`;
        status.classList.add("danger");
      }
      return false;
    } finally {
      inFlight.delete(userId);
    }
  }

  async function rebuildAllProjections() {
    if (inFlight.has("all")) return;
    const status = document.getElementById("adminStatus");
    inFlight.add("all");
    try {
      if (status) status.textContent = "Проверяю канонические профили и пересобираю лидерборды…";
      const data = await canonicalRequest({ scope: "all" });
      if (status) status.textContent = `Готово: профилей ${data.profiles || 0}, проекций ${data.projected || 0}, нормализовано ${data.normalized || 0}, ошибок ${data.failed || 0}.`;
      setTimeout(() => document.getElementById("globalRefresh")?.click(), 0);
    } catch (error) {
      if (status) {
        status.textContent = `Не удалось выполнить проверку: ${error?.message || error}`;
        status.classList.add("danger");
      }
    } finally { inFlight.delete("all"); }
  }

  function autoRebuildMismatch() {
    const panel = legacyMismatchPanel();
    const userId = currentUserId();
    if (!panel || !userId) return;
    rewriteLegacyMismatchPanel();
    rebuildPlayerProjection(userId, { quiet: true });
  }

  function interceptLegacyActions(event) {
    const playerRepair = event.target.closest?.('[data-player-command="repair_player"], [data-canonical-projection-refresh]');
    if (playerRepair) {
      const userId = currentUserId();
      if (!userId) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      rebuildPlayerProjection(userId);
      return;
    }
    const repairAll = event.target.closest?.('[data-system-action="repair-all"]');
    if (!repairAll) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    rebuildAllProjections();
  }

  document.addEventListener("click", interceptLegacyActions, true);
  const observer = new MutationObserver(autoRebuildMismatch);
  const start = () => {
    observer.observe(document.body, { childList: true, subtree: true });
    autoRebuildMismatch();
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
