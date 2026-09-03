(() => {
  "use strict";

  const AUTO_REASON = "Автоматическая синхронизация профиля с серверным лидербордом";
  const repairedAt = new Map();
  const inFlight = new Set();

  const commandId = () => globalThis.crypto?.randomUUID?.() || `admin-auto-sync-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  function currentUserId() {
    const raw = document.querySelector(".player-title small")?.textContent?.trim() || "";
    return /^u_[a-zA-Z0-9_-]{8,62}$/.test(raw) ? raw : "";
  }

  function mismatchPanel() {
    return [...document.querySelectorAll(".danger-zone")].find((panel) =>
      /Облачный профиль отстаёт от серверного лидерборда/i.test(panel.textContent || "")
    ) || null;
  }

  async function runAutomaticRepair(userId, { quiet = false } = {}) {
    if (!userId || inFlight.has(userId)) return false;
    const last = repairedAt.get(userId) || 0;
    if (Date.now() - last < 15000) return false;
    inFlight.add(userId);
    const status = document.getElementById("adminStatus");
    try {
      if (!quiet && status) status.textContent = "Синхронизирую прогресс с сервером…";
      const response = await apiFetch("/api/admin", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "command",
          command: "repair_player",
          commandId: commandId(),
          userId,
          reason: AUTO_REASON,
          ticket: "",
          args: {},
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || data.error || `HTTP ${response.status}`);
      repairedAt.set(userId, Date.now());
      if (status) status.textContent = "Прогресс синхронизирован автоматически.";
      setTimeout(() => document.getElementById("globalRefresh")?.click(), 0);
      return true;
    } catch (error) {
      if (status) {
        status.textContent = `Не удалось синхронизировать автоматически: ${error?.message || error}`;
        status.classList.add("danger");
      }
      return false;
    } finally {
      inFlight.delete(userId);
    }
  }

  function autoRepairMismatch() {
    const panel = mismatchPanel();
    const userId = currentUserId();
    if (!panel || !userId) return;
    runAutomaticRepair(userId, { quiet: true });
  }

  function handleRepairClick(event) {
    const button = event.target.closest?.('[data-player-command="repair_player"]');
    if (!button) return;
    const userId = currentUserId();
    if (!userId) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    runAutomaticRepair(userId);
  }

  document.addEventListener("click", handleRepairClick, true);

  const observer = new MutationObserver(() => autoRepairMismatch());
  const start = () => {
    observer.observe(document.body, { childList: true, subtree: true });
    autoRepairMismatch();
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
