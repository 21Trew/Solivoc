/* Delivery owner for durable pending player events. */
(() => {
  const root = typeof window !== "undefined" ? window : globalThis;
  if (root.SolivocPendingEventSync) return;
  let busy = false;
  let lastError = "";
  let lastAckAt = 0;

  const currentOwner = () => String(root.accountState?.userId || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
  const canSync = () => !!(
    root.SolivocPendingEvents
    && typeof root.accountSignedIn === "function"
    && root.accountSignedIn()
    && typeof root.accountCanUseServer === "function"
    && root.accountCanUseServer()
  );

  async function flush({ limit = 100 } = {}) {
    if (busy || !canSync()) return false;
    const owner = currentOwner();
    if (!owner) return false;
    const queue = root.SolivocPendingEvents;
    const events = queue.pending({ owner, limit });
    if (!events.length) return true;
    busy = true;
    try {
      const data = await root.accountRequest("/api/events", {
        method: "POST",
        body: JSON.stringify({ events }),
        timeout: 9000,
      });
      const acked = Array.isArray(data?.ackedEventIds) ? data.ackedEventIds : [];
      if (acked.length) {
        queue.ack(acked);
        lastAckAt = Date.now();
      }
      if (data?.profile && typeof root.applyAccountCloudProfile === "function") {
        root.applyAccountCloudProfile(data.profile, { version: data.version });
      } else if (root.accountState && Number(data?.version) > 0) {
        root.accountState.version = Math.max(Number(root.accountState.version) || 0, Number(data.version) || 0);
        root.accountState.lastSyncAt = Number(data.syncedAt) || Date.now();
        root.persistAccountState?.();
      }
      lastError = "";
      const remaining = queue.count(owner);
      if (remaining > 0 && root.SolivocScheduler) {
        root.SolivocScheduler.timeout("sync.pending-events", () => flush(), 180);
      }
      return !data?.blocked?.length;
    } catch (error) {
      lastError = String(error?.code || error?.message || error || "pending_event_sync_failed").slice(0, 120);
      try { root.recordStabilityEvent?.("pending_event_sync_failed", { error: lastError, pending: queue.count(owner) }); } catch {}
      return false;
    } finally {
      busy = false;
    }
  }

  function hasPendingForAccount() {
    const owner = currentOwner();
    return !!owner && (root.SolivocPendingEvents?.count?.(owner) || 0) > 0;
  }

  function schedule(delay = 0) {
    if (!hasPendingForAccount() || !root.SolivocScheduler) return false;
    root.SolivocScheduler.timeout("sync.pending-events", () => flush(), Math.max(0, Number(delay) || 0));
    return true;
  }

  function status() {
    return { busy, pending: currentOwner() ? root.SolivocPendingEvents?.count?.(currentOwner()) || 0 : 0, lastAckAt, lastError };
  }

  root.SolivocPendingEventSync = Object.freeze({ flush, schedule, hasPendingForAccount, status });
  root.flushPendingEvents = flush;

  root.SolivocLifecycle?.on?.("online", "sync.pending-events", () => schedule(0));
  root.SolivocLifecycle?.on?.("resume", "sync.pending-events", () => schedule(120));
})();
