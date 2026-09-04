/* Single owner for scheduled account sync, pending events and cloud refresh. */
(() => {
  "use strict";

  const root = typeof window !== "undefined" ? window : globalThis;
  if (root.SolivocSyncManager) return;

  const scheduler = root.SolivocScheduler;
  const lifecycle = root.SolivocLifecycle;
  if (!scheduler || !lifecycle) return;

  const TIMER_KEY = "sync.manager";
  const LEGACY_KEYS = [
    "sync.account",
    "sync.pending-account",
    "sync.pending-events",
    "sync.cloud-refresh",
    "sync.retry-after-401",
    "sync.cloud-restore-retry",
  ];
  const BASE_BACKOFF_MS = 1200;
  const MAX_BACKOFF_MS = 60000;

  const legacyProfileFlush = typeof root.flushAccountSync === "function" ? root.flushAccountSync : null;
  const legacyCloudRefresh = typeof root.refreshAccountFromCloud === "function" ? root.refreshAccountFromCloud : null;

  let inFlight = null;
  let epoch = 0;
  let failureCount = 0;
  let lastSuccessAt = 0;
  let lastFailureAt = 0;
  let lastReason = "boot";
  let queuedRefresh = false;

  const ownerId = () => String(root.accountState?.userId || "");
  const signedIn = () => typeof root.accountSignedIn === "function" && root.accountSignedIn();
  const online = () => typeof root.accountCanUseServer !== "function" || root.accountCanUseServer();
  const visible = () => typeof document === "undefined" || document.visibilityState !== "hidden";
  const playing = () => typeof root.activelyPlayingRound === "function" && root.activelyPlayingRound();

  function backoffDelay() {
    return Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** Math.max(0, failureCount - 1));
  }

  function resetSession(reason = "session_changed") {
    epoch += 1;
    failureCount = 0;
    queuedRefresh = false;
    lastReason = reason;
    scheduler.cancel(TIMER_KEY);
    return epoch;
  }

  function schedule(delay = 0, reason = "scheduled", { refresh = false } = {}) {
    lastReason = String(reason || "scheduled");
    if (refresh) queuedRefresh = true;
    if (!signedIn() || !online()) return false;
    const wait = Math.max(0, Number(delay) || 0, failureCount ? backoffDelay() : 0);
    scheduler.timeout(TIMER_KEY, () => flush({ reason: lastReason }), wait);
    return true;
  }

  async function drainPending(owner, token) {
    const delivery = root.SolivocPendingEventSync;
    if (!delivery?.hasPendingForAccount?.()) return true;
    let rounds = 0;
    while (delivery.hasPendingForAccount() && rounds < 8) {
      if (token !== epoch || owner !== ownerId()) return false;
      const ok = await delivery.flush({ limit: 100 });
      if (!ok) return false;
      rounds += 1;
    }
    return !delivery.hasPendingForAccount();
  }

  async function performCycle({ reason = "manual", forceRefresh = false } = {}) {
    if (!signedIn() || !online()) return false;
    if (!visible() && reason !== "suspend" && reason !== "terminate") return false;
    if (playing() && !["after_round", "manual", "suspend", "terminate"].includes(reason)) {
      schedule(12000, "active_round_defer", { refresh: queuedRefresh || forceRefresh });
      return false;
    }

    const token = epoch;
    const owner = ownerId();
    if (!owner) return false;

    if (!(await drainPending(owner, token))) throw new Error("pending_event_sync_failed");
    if (token !== epoch || owner !== ownerId()) return false;

    if (legacyProfileFlush) {
      const ok = await legacyProfileFlush({ keepalive: reason === "suspend" || reason === "terminate" });
      if (!ok && signedIn()) throw new Error("profile_sync_failed");
    }
    if (token !== epoch || owner !== ownerId()) return false;

    const shouldRefresh = forceRefresh || queuedRefresh;
    queuedRefresh = false;
    if (shouldRefresh && legacyCloudRefresh && !playing() && visible()) {
      await legacyCloudRefresh({ force: true });
      if (token !== epoch || owner !== ownerId()) return false;
    }

    failureCount = 0;
    lastSuccessAt = Date.now();
    return true;
  }

  function flush(options = {}) {
    if (inFlight) return inFlight;
    inFlight = performCycle(options)
      .catch((error) => {
        failureCount = Math.min(8, failureCount + 1);
        lastFailureAt = Date.now();
        try {
          root.recordStabilityEvent?.("sync_manager_failed", {
            reason: String(options?.reason || lastReason || "unknown").slice(0, 60),
            error: String(error?.message || error || "sync_failed").slice(0, 120),
            backoffMs: backoffDelay(),
          });
        } catch {}
        if (signedIn() && online()) schedule(backoffDelay(), "retry_backoff", { refresh: queuedRefresh });
        return false;
      })
      .finally(() => { inFlight = null; });
    return inFlight;
  }

  function status() {
    return {
      busy: !!inFlight,
      epoch,
      owner: ownerId(),
      failureCount,
      backoffMs: failureCount ? backoffDelay() : 0,
      lastSuccessAt,
      lastFailureAt,
      lastReason,
      queuedRefresh,
      timerScheduled: scheduler.has(TIMER_KEY),
    };
  }

  LEGACY_KEYS.forEach((key) => scheduler.alias(key, TIMER_KEY));
  scheduler.claim(TIMER_KEY, () => flush({ reason: lastReason }));

  lifecycle.on("online", "sync.manager", () => schedule(120, "online", { refresh: true }));
  lifecycle.on("resume", "sync.manager", () => schedule(250, "resume", { refresh: true }));
  lifecycle.on("offline", "sync.manager", () => scheduler.cancel(TIMER_KEY));
  lifecycle.on("suspend", "sync.manager", () => flush({ reason: "suspend" }));
  lifecycle.on("terminate", "sync.manager", () => flush({ reason: "terminate" }));

  root.addEventListener?.("solivoc:account-session-changed", () => resetSession("account_session_changed"));

  root.SolivocSyncManager = Object.freeze({
    schedule,
    flush,
    resetSession,
    status,
  });
})();
