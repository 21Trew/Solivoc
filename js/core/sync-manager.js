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

  const legacyCloudRefresh = typeof root.refreshAccountFromCloud === "function" ? root.refreshAccountFromCloud : null;

  let inFlight = null;
  let activeController = null;
  let epoch = 0;
  let sessionOwner = String(root.accountState?.userId || "");
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

  function resetSession(reason = "session_changed", nextOwner = ownerId()) {
    epoch += 1;
    sessionOwner = String(nextOwner || "");
    failureCount = 0;
    queuedRefresh = false;
    lastReason = reason;
    scheduler.cancel(TIMER_KEY);
    try { activeController?.abort?.(); } catch {}
    activeController = null;
    return epoch;
  }

  function ensureSession() {
    const current = ownerId();
    if (current !== sessionOwner) resetSession("owner_changed", current);
    return current;
  }

  function schedule(delay = 0, reason = "scheduled", { refresh = false } = {}) {
    ensureSession();
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

  async function syncProfile(owner, token, { keepalive = false } = {}) {
    if (typeof root.accountRequest !== "function" || typeof root.accountProfileSnapshot !== "function") return true;
    const bodyText = JSON.stringify({ profile: root.accountProfileSnapshot(), version: root.accountState?.version || 0 });
    const canKeepalive = keepalive && bodyText.length < 60000;
    const controller = new AbortController();
    activeController = controller;
    const timer = setTimeout(() => controller.abort(), canKeepalive ? 4500 : 8000);
    try {
      const data = await root.accountRequest("/api/account", {
        method: "POST",
        body: bodyText,
        keepalive: canKeepalive,
        signal: controller.signal,
      });
      if (token !== epoch || owner !== ownerId()) return false;
      if (root.accountState) {
        root.accountState.version = Math.max(Number(root.accountState.version) || 0, Number(data?.version) || 0);
        root.accountState.lastSyncAt = Number(data?.syncedAt) || Date.now();
        root.persistAccountState?.();
      }
      if (data?.profile) root.applyAccountCloudProfile?.(data.profile, { version: data.version });
      root.updateAccountModalIfOpen?.();
      return true;
    } catch (error) {
      if (controller.signal.aborted || token !== epoch || owner !== ownerId()) return false;
      if (error?.status === 401 && root.accountState) {
        root.accountState.status = "signed_out";
        root.persistAccountState?.();
        root.updateAccountModalIfOpen?.();
      }
      throw error;
    } finally {
      clearTimeout(timer);
      if (activeController === controller) activeController = null;
    }
  }

  async function performCycle({ reason = "manual", forceRefresh = false } = {}) {
    const owner = ensureSession();
    if (!signedIn() || !online() || !owner) return false;
    if (!visible() && reason !== "suspend" && reason !== "terminate") return false;
    if (playing() && !["after_round", "manual", "suspend", "terminate"].includes(reason)) {
      schedule(12000, "active_round_defer", { refresh: queuedRefresh || forceRefresh });
      return false;
    }

    const token = epoch;
    if (!(await drainPending(owner, token))) throw new Error("pending_event_sync_failed");
    if (token !== epoch || owner !== ownerId()) return false;

    const synced = await syncProfile(owner, token, { keepalive: reason === "suspend" || reason === "terminate" });
    if (!synced) return false;
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
    ensureSession();
    if (inFlight) return inFlight;
    inFlight = performCycle(options)
      .catch((error) => {
        if (error?.name === "AbortError") return false;
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

  function localCheckpoint() {
    try { root.flushProfileSave?.({ skipCloud: false }); }
    catch { try { root.saveProfile?.(); } catch {} }
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

  lifecycle.off("suspend", "durability.profile");
  lifecycle.off("terminate", "durability.profile");
  lifecycle.off("resume", "durability.profile-resume");
  lifecycle.off("online", "durability.profile-online");

  lifecycle.on("online", "sync.manager", () => schedule(120, "online", { refresh: true }));
  lifecycle.on("resume", "sync.manager", () => schedule(250, "resume", { refresh: true }));
  lifecycle.on("offline", "sync.manager", () => scheduler.cancel(TIMER_KEY));
  lifecycle.on("suspend", "sync.manager", () => { localCheckpoint(); return flush({ reason: "suspend" }); });
  lifecycle.on("terminate", "sync.manager", () => { localCheckpoint(); return flush({ reason: "terminate" }); });

  root.addEventListener?.("solivoc:account-session-changed", () => resetSession("account_session_changed"));

  root.SolivocSyncManager = Object.freeze({
    schedule,
    flush,
    resetSession,
    status,
  });
})();
