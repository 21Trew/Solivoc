/* Delivery operation for durable pending player events. Scheduling belongs to SyncManager. */
(() => {
  const root = typeof window !== "undefined" ? window : globalThis;
  if (root.SolivocPendingEventSync) return;
  let busy = false;
  let lastError = "";
  let lastAckAt = 0;

  const account = () => root.SolivocAccountSyncBridge;
  const currentOwner = () => account()?.owner?.() || "";
  const canSync = () => !!(
    root.SolivocPendingEvents
    && account()?.signedIn?.()
    && account()?.canUseServer?.()
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
      const data = await account().request("/api/events", {
        method: "POST",
        body: JSON.stringify({ events }),
        timeout: 9000,
      });
      const acked = Array.isArray(data?.ackedEventIds) ? data.ackedEventIds : [];
      if (acked.length) {
        queue.ack(acked);
        lastAckAt = Date.now();
      }
      if (data?.profile) account().applyProfile(data.profile, { version: data.version });
      else if (Number(data?.version) > 0) account().updateMeta(data);
      lastError = "";
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
    if (!hasPendingForAccount()) return false;
    if (root.SolivocSyncManager?.schedule) return root.SolivocSyncManager.schedule(delay, "pending_events");
    if (!root.SolivocScheduler) return false;
    root.SolivocScheduler.timeout("sync.pending-events", () => flush(), Math.max(0, Number(delay) || 0));
    return true;
  }

  function status() {
    return { busy, pending: currentOwner() ? root.SolivocPendingEvents?.count?.(currentOwner()) || 0 : 0, lastAckAt, lastError };
  }

  root.SolivocPendingEventSync = Object.freeze({ flush, schedule, hasPendingForAccount, status });
  root.flushPendingEvents = flush;
})();
