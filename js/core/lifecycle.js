/* Single owner for browser lifecycle and runtime fault events. */
(() => {
  if (typeof window === "undefined" || window.SolivocLifecycle) return;

  const handlers = new Map();
  const PHASE_DEDUPE_MS = 250;
  let lastSuspendAt = 0;
  let lastResumeAt = 0;
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
    const eventType = String(type || "");
    state.lastEvent = eventType;
    state.lastEventAt = Date.now();
    const group = handlers.get(eventType);
    if (!group?.size) return 0;
    let count = 0;
    for (const [key, callback] of [...group.entries()]) {
      try {
        const result = callback(detail);
        if (result && typeof result.catch === "function") {
          result.catch((error) => console.error(`Lifecycle handler failed: ${eventType}/${key}`, error));
        }
        count++;
      } catch (error) {
        console.error(`Lifecycle handler failed: ${eventType}/${key}`, error);
      }
    }
    return count;
  }

  function emitSuspend(reason, detail = {}) {
    const now = Date.now();
    if (now - lastSuspendAt < PHASE_DEDUPE_MS) return 0;
    lastSuspendAt = now;
    return emit("suspend", { ...detail, reason });
  }

  function emitResume(reason, detail = {}) {
    const now = Date.now();
    if (now - lastResumeAt < PHASE_DEDUPE_MS) return 0;
    lastResumeAt = now;
    return emit("resume", { ...detail, reason });
  }

  function snapshot() {
    return {
      ...state,
      handlers: Object.fromEntries([...handlers.entries()].map(([type, group]) => [type, group.size])),
    };
  }

  function handleVisibility(event) {
    state.visibility = document.visibilityState;
    const detail = { event, visibility: state.visibility };
    emit("visibilitychange", detail);
    if (state.visibility === "hidden") {
      emit("hidden", detail);
      emitSuspend("hidden", detail);
    } else {
      emit("visible", detail);
      emitResume("visible", detail);
    }
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
  window.addEventListener("pagehide", (event) => {
    const detail = { event, persisted: !!event.persisted };
    emit("pagehide", detail);
    emitSuspend("pagehide", detail);
  }, { capture: true });
  window.addEventListener("pageshow", (event) => {
    const detail = { event, persisted: !!event.persisted };
    emit("pageshow", detail);
    emitResume("pageshow", detail);
  }, { passive: true });
  window.addEventListener("focus", (event) => {
    emit("focus", { event });
    emitResume("focus", { event });
  }, { passive: true });
  window.addEventListener("blur", (event) => emit("blur", { event }), { passive: true });
  window.addEventListener("freeze", (event) => {
    emit("freeze", { event });
    emitSuspend("freeze", { event });
  }, { capture: true });
  window.addEventListener("beforeunload", (event) => {
    emit("beforeunload", { event });
    emit("terminate", { event, reason: "beforeunload" });
  }, { capture: true });
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
