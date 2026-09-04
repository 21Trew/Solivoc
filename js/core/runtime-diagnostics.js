/* Dev/test runtime diagnostics for ENGINE_RUNTIME_STABILITY_PLAN Stage 0. */
(() => {
  const root = typeof window !== "undefined" ? window : globalThis;
  if (root.runtimeDiagnostics) return;

  const FLAG_KEY = "solivoc-runtime-diagnostics";
  const enabled = (() => {
    try {
      if (new URLSearchParams(root.location?.search || "").get("runtimeDiagnostics") === "1") return true;
      return root.localStorage?.getItem(FLAG_KEY) === "1";
    } catch { return false; }
  })();

  const counters = Object.create(null);
  const gauges = Object.create(null);
  const timings = Object.create(null);
  const recentLongTasks = [];
  const startedAt = Date.now();
  const wrapped = [];

  function now() { return root.performance?.now?.() ?? Date.now(); }
  function count(name, amount = 1) {
    if (!enabled) return 0;
    counters[name] = (Number(counters[name]) || 0) + (Number(amount) || 0);
    return counters[name];
  }
  function gauge(name, value) {
    if (!enabled) return value;
    gauges[name] = Number.isFinite(Number(value)) ? Number(value) : value;
    return value;
  }
  function begin(name) {
    if (!enabled) return null;
    return { name: String(name), at: now() };
  }
  function end(token) {
    if (!enabled || !token?.name) return 0;
    const duration = Math.max(0, now() - token.at);
    const bucket = timings[token.name] ||= { count: 0, totalMs: 0, maxMs: 0, lastMs: 0 };
    bucket.count += 1;
    bucket.totalMs += duration;
    bucket.maxMs = Math.max(bucket.maxMs, duration);
    bucket.lastMs = duration;
    return duration;
  }
  function byteLength(value) {
    try {
      const json = JSON.stringify(value);
      return typeof TextEncoder === "function" ? new TextEncoder().encode(json).byteLength : json.length;
    } catch { return 0; }
  }
  function sampleKnownTimers() {
    if (!enabled) return 0;
    const slots = [
      () => typeof stateSaveTimer !== "undefined" ? stateSaveTimer : null,
      () => typeof profileSaveTimer !== "undefined" ? profileSaveTimer : null,
      () => typeof deadlockTimer !== "undefined" ? deadlockTimer : null,
      () => typeof comboTimer !== "undefined" ? comboTimer : null,
      () => typeof roundTimer !== "undefined" ? roundTimer : null,
      () => typeof accountSyncTimer !== "undefined" ? accountSyncTimer : null,
      () => typeof challengeSyncTimer !== "undefined" ? challengeSyncTimer : null,
      () => typeof developerMailPollTimer !== "undefined" ? developerMailPollTimer : null,
    ];
    let active = 0;
    for (const read of slots) {
      try { if (read() != null) active++; } catch {}
    }
    gauge("trackedActiveTimers", active);
    gauge("trackedTimerSlots", slots.length);
    return active;
  }
  function sampleRuntime() {
    if (!enabled) return null;
    try { gauge("domNodes", root.document?.getElementsByTagName?.("*")?.length ?? null); } catch {}
    try { gauge("activeAnimations", root.document?.getAnimations?.().length ?? null); } catch {}
    try {
      if (root.performance?.memory) {
        gauge("heapUsedBytes", Number(root.performance.memory.usedJSHeapSize) || 0);
        gauge("heapLimitBytes", Number(root.performance.memory.jsHeapSizeLimit) || 0);
      }
    } catch {}
    sampleKnownTimers();
    return snapshot();
  }
  function snapshot() {
    return {
      enabled,
      startedAt,
      uptimeMs: Date.now() - startedAt,
      counters: { ...counters },
      gauges: { ...gauges },
      timings: Object.fromEntries(Object.entries(timings).map(([key, value]) => [key, {
        ...value,
        avgMs: value.count ? value.totalMs / value.count : 0,
      }])),
      longTasks: recentLongTasks.slice(),
      wrapped: wrapped.slice(),
      coverage: {
        timers: "known-slots",
        listeners: "not-globally-instrumented",
      },
    };
  }
  function reset() {
    for (const key of Object.keys(counters)) delete counters[key];
    for (const key of Object.keys(gauges)) delete gauges[key];
    for (const key of Object.keys(timings)) delete timings[key];
    recentLongTasks.length = 0;
  }
  function wrap(name, factory) {
    if (!enabled || typeof root[name] !== "function") return false;
    const base = root[name];
    if (base.__runtimeDiagnosticsWrapped) return false;
    const next = factory(base);
    Object.defineProperty(next, "__runtimeDiagnosticsWrapped", { value: true });
    root[name] = next;
    wrapped.push(name);
    return true;
  }
  function installInstrumentation() {
    if (!enabled) return false;

    wrap("apiFetch", (base) => function runtimeMeasuredApiFetch(...args) {
      count("networkCalls");
      return base.apply(this, args);
    });

    wrap("persistStateNow", (base) => function runtimeMeasuredRoundPersist(...args) {
      const token = begin("roundPersist");
      let before = "";
      try { before = typeof lastPersistedStateJson !== "undefined" ? lastPersistedStateJson : ""; } catch {}
      try { gauge("stateBytes", byteLength(typeof state !== "undefined" ? state : null)); } catch {}
      try {
        return base.apply(this, args);
      } finally {
        try {
          const after = typeof lastPersistedStateJson !== "undefined" ? lastPersistedStateJson : "";
          if (after && after !== before) count("roundSaves");
        } catch {}
        end(token);
      }
    });

    wrap("saveProfile", (base) => function runtimeMeasuredProfileSave(...args) {
      const token = begin("profileSave");
      try { gauge("profileBytes", byteLength(typeof profile !== "undefined" ? profile : null)); } catch {}
      try {
        const result = base.apply(this, args);
        count("profileSaves");
        return result;
      } finally {
        end(token);
      }
    });

    wrap("render", (base) => function runtimeMeasuredRender(...args) {
      const token = begin("render");
      try { return base.apply(this, args); }
      finally {
        end(token);
        sampleRuntime();
      }
    });

    return true;
  }

  if (enabled && typeof root.PerformanceObserver === "function") {
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          recentLongTasks.push({ at: Math.round(entry.startTime), durationMs: Math.round(entry.duration) });
          if (recentLongTasks.length > 40) recentLongTasks.splice(0, recentLongTasks.length - 40);
          count("longTasks");
        }
      });
      observer.observe({ type: "longtask", buffered: true });
    } catch {}
  }

  root.runtimeDiagnostics = Object.freeze({
    enabled, count, gauge, begin, end, sampleRuntime, snapshot, reset, installInstrumentation,
  });
  installInstrumentation();
})();
