/* Single owner for browser lifecycle and runtime fault events. */
(() => {
  if (typeof window === "undefined" || window.SolivocLifecycle) return;

  const handlers = new Map();
  const state = {
    visibility: typeof document !== "undefined" ? document.visibilityState : "visible",
    online: typeof navigator !== "undefined" ? navigator.onLine !== false : true,
    lastEvent: "boot",
    lastEventAt: Date.now(),
  };

  function bucket(type) {
    const key = String(type || "").trim();
    if (!key) throw new Error("lifecycle_event_required");
    if (!handlers.has(key)) handlers.set(key, new Map());
    return handlers.get(key);
  }

  function on(type, key, callback) {
    const id = String(key || "").trim();
    if (!id) throw new Error("lifecycle_handler_key_required");
    if (typeof callback !== "function") throw new TypeError("lifecycle_callback_required");
    bucket(type).set(id, callback);
    return () => off(type, id);
  }

  function off(type, key) {
    const group = handlers.get(String(type || "").trim());
    if (!group) return false;
    return group.delete(String(key || "").trim());
  }

  function emit(type, detail = {}) {
    state.lastEvent = String(type || "");
    state.lastEventAt = Date.now();
    const group = handlers.get(state.lastEvent);
    if (!group?.size) return 0;
    let count = 0;
    for (const [key, callback] of [...group.entries()]) {
      try {
        const result = callback(detail);
        if (result && typeof result.catch === "function") {
          result.catch((error) => console.error(`Lifecycle handler failed: ${state.lastEvent}/${key}`, error));
        }
        count++;
      } catch (error) {
        console.error(`Lifecycle handler failed: ${state.lastEvent}/${key}`, error);
      }
    }
    return count;
  }

  function snapshot() {
    return {
      ...state,
      handlers: Object.fromEntries([...handlers.entries()].map(([type, group]) => [type, group.size])),
    };
  }

  function handleVisibility(event) {
    state.visibility = document.visibilityState;
    emit("visibilitychange", { event, visibility: state.visibility });
    emit(state.visibility === "hidden" ? "hidden" : "visible", { event, visibility: state.visibility });
  }

  function handleOnline(event) {
    state.online = true;
    emit("online", { event });
  }

  function handleOffline(event) {
    state.online = false;
    emit("offline", { event });
  }

  document.addEventListener("visibilitychange", handleVisibility, { passive: true });
  window.addEventListener("online", handleOnline, { passive: true });
  window.addEventListener("offline", handleOffline, { passive: true });
  window.addEventListener("pagehide", (event) => emit("pagehide", { event, persisted: !!event.persisted }), { capture: true });
  window.addEventListener("pageshow", (event) => emit("pageshow", { event, persisted: !!event.persisted }), { passive: true });
  window.addEventListener("focus", (event) => emit("focus", { event }), { passive: true });
  window.addEventListener("blur", (event) => emit("blur", { event }), { passive: true });
  window.addEventListener("freeze", (event) => emit("freeze", { event }), { capture: true });
  window.addEventListener("beforeunload", (event) => emit("beforeunload", { event }), { capture: true });
  window.addEventListener("error", (event) => emit("error", { event, message: event?.message || event?.error?.message || "" }), { capture: true });
  window.addEventListener("unhandledrejection", (event) => emit("unhandledrejection", { event, reason: event?.reason }), { capture: true });

  window.SolivocLifecycle = Object.freeze({
    on,
    off,
    emit,
    snapshot,
    isVisible: () => state.visibility !== "hidden",
    isOnline: () => state.online,
  });
})();
