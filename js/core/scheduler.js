/* Central runtime scheduler for replaceable background timers. */
(() => {
  if (typeof window === "undefined" || window.SolivocScheduler) return;

  const tasks = new Map();

  function normalizeKey(key) {
    const value = String(key || "").trim();
    if (!value) throw new Error("scheduler_key_required");
    return value;
  }

  function reportError(key, error) {
    try { console.error(`Scheduler task failed: ${key}`, error); } catch {}
    try {
      window.dispatchEvent(new CustomEvent("solivoc:scheduler-error", {
        detail: { key, message: String(error?.message || error || "unknown").slice(0, 160) },
      }));
    } catch {}
  }

  function invoke(key, fn) {
    try {
      const result = fn();
      if (result && typeof result.catch === "function") result.catch((error) => reportError(key, error));
      return result;
    } catch (error) {
      reportError(key, error);
      return undefined;
    }
  }

  function cancel(key) {
    const normalized = String(key || "").trim();
    const task = tasks.get(normalized);
    if (!task) return false;
    if (task.kind === "interval") clearInterval(task.id);
    else clearTimeout(task.id);
    tasks.delete(normalized);
    return true;
  }

  function timeout(key, fn, delay = 0, { replace = true } = {}) {
    const normalized = normalizeKey(key);
    if (typeof fn !== "function") throw new TypeError("scheduler_callback_required");
    if (tasks.has(normalized)) {
      if (!replace) return normalized;
      cancel(normalized);
    }
    const wait = Math.max(0, Number(delay) || 0);
    const id = setTimeout(() => {
      tasks.delete(normalized);
      invoke(normalized, fn);
    }, wait);
    tasks.set(normalized, { kind: "timeout", id, delay: wait, createdAt: Date.now() });
    return normalized;
  }

  function interval(key, fn, delay, { replace = true, immediate = false, visibleOnly = false } = {}) {
    const normalized = normalizeKey(key);
    if (typeof fn !== "function") throw new TypeError("scheduler_callback_required");
    if (tasks.has(normalized)) {
      if (!replace) return normalized;
      cancel(normalized);
    }
    const wait = Math.max(50, Number(delay) || 0);
    const runner = () => {
      if (visibleOnly && typeof document !== "undefined" && document.visibilityState !== "visible") return;
      invoke(normalized, fn);
    };
    const id = setInterval(runner, wait);
    tasks.set(normalized, { kind: "interval", id, delay: wait, createdAt: Date.now(), visibleOnly: !!visibleOnly });
    if (immediate) queueMicrotask(runner);
    return normalized;
  }

  function cancelPrefix(prefix) {
    const value = String(prefix || "");
    let count = 0;
    for (const key of [...tasks.keys()]) {
      if (!key.startsWith(value)) continue;
      if (cancel(key)) count++;
    }
    return count;
  }

  function has(key) { return tasks.has(String(key || "").trim()); }
  function activeCount() { return tasks.size; }
  function snapshot() {
    return [...tasks.entries()].map(([key, task]) => ({
      key,
      kind: task.kind,
      delay: task.delay,
      createdAt: task.createdAt,
      visibleOnly: !!task.visibleOnly,
    }));
  }

  window.SolivocScheduler = Object.freeze({
    timeout,
    interval,
    cancel,
    cancelPrefix,
    has,
    activeCount,
    snapshot,
  });
})();
