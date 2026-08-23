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
  // WebKit can terminate a normal Safari tab for memory pressure too, not only a PWA.
  // Keep the lighter animation/history path on every iPhone/iPad session.
  return isIosLikeDevice() || (memory > 0 && memory <= 4);
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
  if (now - stabilityCheckpointAt < 10000 || document.visibilityState === "hidden") return;
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
  try { document.querySelectorAll(".drag-ghost,.deal-ghost,.auto-move-ghost,.category-fly").forEach((el) => el.remove()); } catch {}
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
    `Текущий сеанс: ${current.stage || "—"} · ${current.mode || "—"} · уровень ${current.level || 0} · ${typeof ruCount === "function" ? ruCount(current.moves || 0, "ход", "хода", "ходов") : `${current.moves || 0} ходов`}`,
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

/* v30: do not hold the splash for optional social/duel bootstrap work on slow mobile networks. */
if (typeof apiFetch === "function" && !window.__solivocFastBootApiInstalled) {
  window.__solivocFastBootApiInstalled = true;
  const baseApiFetch = apiFetch;
  apiFetch = function fastBootApiFetch(path, options = {}) {
    const value = String(path || "");
    const splash = document.querySelector("#splash");
    const bootVisible = !!splash && !splash.hidden && !splash.classList.contains("hidden");
    const optionalBootRead = /\/api\/(bootstrap|challenges|push)(?:\?|$)/.test(value);
    if (!bootVisible || !optionalBootRead || options.method && String(options.method).toUpperCase() !== "GET") {
      return baseApiFetch(path, options);
    }
    const controller = new AbortController();
    const upstream = options.signal;
    if (upstream) {
      if (upstream.aborted) controller.abort();
      else upstream.addEventListener("abort", () => controller.abort(), { once: true });
    }
    const timer = setTimeout(() => controller.abort(), isIosLikeDevice() ? 650 : 900);
    return baseApiFetch(path, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
  };
}

/* v30: boss companions require a perfect chapter. Existing unlocked mascots are grandfathered. */
(function installBossCaptureRule() {
  if (typeof unlockCompanion !== "function" || typeof companionUnlocked !== "function") return;
  const baseUnlockCompanion = unlockCompanion;
  const chapterPerfect = (chapter) => {
    try {
      const stars = chapterStarsForProfile(profile, chapter);
      return Array.isArray(stars) && stars.length === CHAPTER_SIZE && stars.every((value) => Number(value) === 3);
    } catch { return false; }
  };
  unlockCompanion = function v30UnlockCompanion(id, options = {}) {
    const def = typeof entityDef === "function" ? entityDef(id) : null;
    const already = !!(def && companionUnlocked(def, profile));
    if (def?.type === "mascot" && def.bossReward && def.unlockChapter && !already && !chapterPerfect(def.unlockChapter)) return null;
    const unlocked = baseUnlockCompanion(id, options);
    if (unlocked && !already && def?.type === "mascot" && def.bossReward) {
      window.__v30CapturedMascots ||= [];
      if (!window.__v30CapturedMascots.includes(def.id)) window.__v30CapturedMascots.push(def.id);
      try { window.dispatchEvent(new CustomEvent("solivoc:mascot-captured", { detail: { id: def.id } })); } catch {}
    }
    return unlocked;
  };
  syncBossCompanionsFromProgress = function v30SyncBossCompanionsFromProgress({ notify = false } = {}) {
    let fresh = 0;
    for (const def of COMPANION_DEFS.filter((x) => x.type === "mascot" && x.bossReward && x.unlockChapter && chapterPerfect(x.unlockChapter))) {
      const before = companionUnlocked(def, profile);
      unlockCompanion(def.id, { notify: !before && notify, select: false });
      if (!before && companionUnlocked(def, profile)) fresh++;
    }
    ensureCompanionSelection?.(profile);
    return fresh;
  };
  const baseUnlockLabel = typeof companionUnlockLabel === "function" ? companionUnlockLabel : null;
  if (baseUnlockLabel) companionUnlockLabel = function v30CompanionUnlockLabel(def) {
    if (def?.type === "mascot" && def.bossReward && def.unlockChapter) return `★★★ во всех ${CHAPTER_SIZE} уровнях главы ${def.unlockChapter}, включая финал`;
    return baseUnlockLabel(def);
  };
})();

/* v30: keep mascot voice lines character-specific and rotate them before reuse. */
(function installMascotVoiceRotation() {
  if (typeof companionDef !== "function" || typeof COMPANION_VOICES === "undefined") return;
  const recentByKey = new Map();
  const styleEndings = Object.freeze({
    owl: {
      start: ["Сначала наблюдение, затем вывод.", "Проверим закономерность без спешки.", "Начнём с самой надёжной гипотезы.", "Структура расклада обязательно себя выдаст.", "Внимательность здесь важнее скорости."],
      win: ["Вывод подтверждён чисто.", "Именно так выглядит точное решение.", "Хорошая работа: связь найдена без лишнего шума.", "Запомним этот ход как верный образец.", "Наблюдение и логика снова сработали."],
      error: ["Ошибка полезна, если понять её причину.", "Отметим этот вариант и исключим его.", "Ничего страшного: пересоберём гипотезу.", "Вернёмся к фактам на поле.", "Лучше одна проверка сейчас, чем цепочка неверных выводов."],
      combo: ["Последовательность становится всё яснее.", "Хорошая серия: решения подтверждают друг друга.", "Связи выстраиваются в систему.", "Темп высокий, а точность сохраняется.", "Отличная концентрация."],
      hint: ["Посмотри на структуру открытых карт.", "Начни с связи, которую можно доказать сразу.", "Проверь, какая категория уже готова принять карту.", "Ищи ход, после которого откроется новая информация.", "Сравни не слова, а общий признак."],
    },
    bear: {
      start: ["Идём спокойно и надёжно.", "Не спешим — сначала найдём опору.", "Хороший расклад берётся терпением.", "Держим ровный темп и не суетимся.", "Сильный ход начинается с устойчивой позиции."],
      win: ["Надёжно. Именно так и надо.", "Спокойный темп довёл до победы.", "Крепкая партия без лишней суеты.", "Вот это основательный результат.", "Уверенно дожали расклад."],
      error: ["Не давим на расклад — перестроимся.", "Ничего, вернём опору и продолжим.", "Сбавим полшага и проверим позицию.", "Сила здесь в терпении.", "Один неверный ход не ломает хороший план."],
      combo: ["Ритм пойман — держим его.", "Хорошая серия, без рывков.", "Вот теперь ход идёт как надо.", "Уверенно наращиваем темп.", "Крепкая последовательность."],
      hint: ["Выбирай ход, после которого поле станет устойчивее.", "Сначала освободи себе пространство.", "Посмотри, где уже есть надёжная опора для карты.", "Не гонись за эффектным ходом — бери полезный.", "Лучший следующий ход обычно самый спокойный."],
    },
  });
  const basePool = typeof companionPhrasePool === "function" ? companionPhrasePool : null;
  companionPhrasePool = function v30CompanionPhrasePool(id = profile?.settings?.companion, situation = "start") {
    const def = companionDef(id), voice = COMPANION_VOICES[def.id] || COMPANION_VOICES.owl;
    const starts = Array.isArray(voice?.[situation]) && voice[situation].length ? voice[situation] : (voice?.start || []);
    const endings = styleEndings[def.id]?.[situation] || [];
    const name = typeof companionPlayerName === "function" ? companionPlayerName() : "";
    if (endings.length) {
      const out = [];
      for (let i = 0; i < starts.length; i++) for (let j = 0; j < endings.length; j++) {
        const address = name && (i * 3 + j) % 7 === 0 ? `${name}, ` : "";
        out.push(`${address}${starts[i]}. ${endings[j]}`);
      }
      return [...new Set(out)];
    }
    // For the rest of the cast keep only their authored voice lines: no generic
    // suffix shared by every mascot.
    const authored = starts.map((line, index) => `${name && index === 0 ? `${name}, ` : ""}${line}.`);
    return [...new Set(authored.length ? authored : (basePool ? basePool(id, situation).filter((line) => !/Погнали искать связи/i.test(line)) : []))];
  };
  companionPhrase = function v30CompanionPhrase(id = profile?.settings?.companion, situation = "start") {
    const def = companionDef(id), key = `${def.id}:${situation}`, pool = companionPhrasePool(def.id, situation);
    if (!pool.length) return def.id === "owl" ? "Начнём с наблюдения." : "Начинаем.";
    const recent = recentByKey.get(key) || [];
    const available = pool.filter((line) => !recent.includes(line));
    const source = available.length ? available : pool;
    const line = source[Math.floor(Math.random() * source.length)] || source[0];
    recentByKey.set(key, [...recent, line].slice(-Math.min(6, Math.max(1, pool.length - 1))));
    return line;
  };
})();

/* Load the rest of v30 after the parser has registered all game functions. */
function loadV30RuntimePatch() {
  if (window.__solivocV30PatchRequested) return;
  window.__solivocV30PatchRequested = true;
  const script = document.createElement("script");
  script.src = "./js/v30-patch.js?v=30";
  script.async = false;
  script.onerror = () => recordStabilityEvent("v30_patch_load_failed");
  document.head.appendChild(script);
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", loadV30RuntimePatch, { once: true });
else loadV30RuntimePatch();
