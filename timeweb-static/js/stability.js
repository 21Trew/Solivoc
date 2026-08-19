/* Runtime stability guardrails and on-device diagnostics for mobile/PWA sessions. */
const STABILITY_STATE_KEY = "solivoc-stability-v2";
const STABILITY_EVENT_LIMIT = 12;
let stabilitySessionId = `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
let stabilityCheckpointAt = 0;

function isIosLikeDevice() {
  const ua = navigator.userAgent || "";
  return /iPad|iPhone|iPod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}
function isStandaloneGame() {
  return !!(window.matchMedia?.("(display-mode: standalone)")?.matches || navigator.standalone === true);
}
function stabilityConstrainedMode() {
  const memory = Number(navigator.deviceMemory || 0);
  return (isIosLikeDevice() && isStandaloneGame()) || (memory > 0 && memory <= 4);
}
function readStabilityState() {
  try {
    const value = JSON.parse(localStorage.getItem(STABILITY_STATE_KEY) || "null");
    return value && typeof value === "object" ? value : { current: null, events: [] };
  } catch {
    return { current: null, events: [] };
  }
}
function writeStabilityState(value) {
  try { localStorage.setItem(STABILITY_STATE_KEY, JSON.stringify(value)); } catch {}
}
function stabilitySnapshot(extra = {}) {
  let memory = null;
  try {
    if (performance?.memory) memory = {
      used: Math.round(performance.memory.usedJSHeapSize / 1048576),
      limit: Math.round(performance.memory.jsHeapSizeLimit / 1048576),
    };
  } catch {}
  return {
    sessionId: stabilitySessionId,
    at: Date.now(),
    mode: typeof state !== "undefined" ? state?.mode || "" : "",
    level: typeof state !== "undefined" ? +state?.level || 0 : 0,
    moves: typeof state !== "undefined" ? +state?.run?.moves || 0 : 0,
    hidden: document.visibilityState === "hidden",
    online: navigator.onLine !== false,
    ios: isIosLikeDevice(),
    standalone: isStandaloneGame(),
    memory,
    ...extra,
  };
}
function recordStabilityEvent(kind, detail = {}) {
  const store = readStabilityState();
  const event = stabilitySnapshot({ kind, ...(typeof detail === "object" && detail ? detail : { detail: String(detail || "") }) });
  store.events = [...(Array.isArray(store.events) ? store.events : []), event].slice(-STABILITY_EVENT_LIMIT);
  writeStabilityState(store);
  return event;
}
function markStabilityStage(stage, detail = {}) {
  const store = readStabilityState();
  store.current = stabilitySnapshot({ stage, ...(typeof detail === "object" && detail ? detail : {}) });
  writeStabilityState(store);
}
function checkpointStabilityRuntime() {
  const now = Date.now();
  if (now - stabilityCheckpointAt < 15000 || document.visibilityState === "hidden") return;
  stabilityCheckpointAt = now;
  markStabilityStage("active", { checkpoint: true });
}
function initStabilityRuntime() {
  const store = readStabilityState(), previous = store.current;
  if (previous?.sessionId && previous.sessionId !== stabilitySessionId) {
    const expected = ["updating", "importing", "closed"].includes(previous.stage);
    if (!expected) {
      const kind = previous.stage === "hidden" ? "restart_after_background" : "unexpected_restart";
      store.events = [...(Array.isArray(store.events) ? store.events : []), { ...previous, kind, detectedAt: Date.now() }].slice(-STABILITY_EVENT_LIMIT);
    }
  }
  store.current = stabilitySnapshot({ stage: "booting" });
  writeStabilityState(store);
  document.body.dataset.resourceMode = stabilityConstrainedMode() ? "constrained" : "normal";
  document.body.dataset.platform = isIosLikeDevice() ? "ios" : "other";
}
function markStabilityFault(kind, detail = "") {
  recordStabilityEvent(kind, { detail: String(detail || "").slice(0, 320) });
  markStabilityStage("fault", { faultKind: kind });
}
function compactTransientRuntimeForBackground() {
  try { if (typeof history !== "undefined") history.length = 0; } catch {}
  try { if (typeof deadlockTimer !== "undefined") { clearTimeout(deadlockTimer); deadlockTimer = null; } } catch {}
  try { if (typeof comboTimer !== "undefined") { clearTimeout(comboTimer); comboTimer = null; } } catch {}
  try { if (typeof winRevealTimers !== "undefined" && typeof clearWinRevealTimers === "function") clearWinRevealTimers(); } catch {}
  try { document.getAnimations?.().forEach((animation) => animation.cancel()); } catch {}
  try { celebration?.replaceChildren(); } catch {}
  try { stopBackgroundMusic?.(); } catch {}
  try { suspendAudioForLifecycle?.(); } catch {}
}
function stabilityDiagnosticsText() {
  const store = readStabilityState();
  const current = store.current || {};
  const events = (store.events || []).slice(-8);
  const nav = performance.getEntriesByType?.("navigation")?.[0];
  const lines = [
    `Словасьянс · диагностика стабильности`,
    `Время: ${new Date().toISOString()}`,
    `Платформа: ${navigator.userAgent}`,
    `PWA: ${isStandaloneGame() ? "да" : "нет"} · iOS: ${isIosLikeDevice() ? "да" : "нет"} · режим ресурсов: ${stabilityConstrainedMode() ? "экономный" : "обычный"}`,
    `Навигация: ${nav?.type || "unknown"} · discarded: ${document.wasDiscarded === true ? "да" : "нет"}`,
    `Текущий сеанс: ${current.stage || "—"} · ${current.mode || "—"} · уровень ${current.level || 0} · ${ruCount(current.moves || 0, "ход", "хода", "ходов")}`,
    `События:`,
    ...events.map((event) => `${new Date(event.detectedAt || event.at || 0).toISOString()} · ${event.kind || event.stage || "event"} · ${event.mode || "—"} L${event.level || 0} M${event.moves || 0}${event.detail ? ` · ${event.detail}` : ""}`),
  ];
  return lines.join("\n");
}
async function copyStabilityDiagnostics() {
  const text = stabilityDiagnosticsText();
  try {
    await navigator.clipboard.writeText(text);
    showToast?.("Диагностика скопирована");
    return true;
  } catch {
    try {
      const area = document.createElement("textarea");
      area.value = text; area.style.position = "fixed"; area.style.opacity = "0";
      document.body.appendChild(area); area.select(); document.execCommand("copy"); area.remove();
      showToast?.("Диагностика скопирована");
      return true;
    } catch {
      showToast?.("Не удалось скопировать диагностику");
      return false;
    }
  }
}
