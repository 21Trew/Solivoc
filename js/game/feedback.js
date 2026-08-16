/* Game feel: procedural sound, combo, wrong-move feedback, category finish and deadlock UI. */
let audioCtx = null,
  musicMode = "game",
  musicTimer = null,
  musicStep = 0,
  musicGeneration = 0,
  comboCount = 0,
  comboTimer = null,
  comboLastAt = 0,
  categoryAnimating = false,
  deadlockTimer = null,
  lastDeadlockSignature = "",
  deferredInstallPrompt = null;

function soundEnabled() {
  return profile?.settings?.sound !== false;
}
function musicEnabled() {
  return profile?.settings?.music !== false;
}
function ensureAudioContext() {
  const AudioCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtor) return null;
  if (!audioCtx) audioCtx = new AudioCtor();
  if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
  return audioCtx;
}
function getAudioContext() {
  return soundEnabled() ? ensureAudioContext() : null;
}
function tone(freq, duration = 0.08, opts = {}) {
  const ctx = getAudioContext();
  if (!ctx) return;
  const start = ctx.currentTime + (opts.delay || 0),
    osc = ctx.createOscillator(),
    gain = ctx.createGain();
  osc.type = opts.type || "sine";
  osc.frequency.setValueAtTime(freq, start);
  if (opts.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.to), start + duration);
  const volume = opts.volume ?? 0.045;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + Math.min(0.012, duration * 0.25));
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(start);
  osc.stop(start + duration + 0.025);
}
function playSfx(name, strength = 1, delay = 0) {
  if (!soundEnabled()) return;
  const v = Math.min(1.2, Math.max(0.5, strength));
  switch (name) {
    case "pickup":
      tone(255, 0.055, { delay, to: 320, volume: 0.025 * v, type: "triangle" });
      break;
    case "drop":
      tone(390, 0.065, { delay, to: 330, volume: 0.033 * v, type: "triangle" });
      break;
    case "deal":
      tone(920, 0.026, { delay, to: 610, volume: 0.012 * v, type: "triangle" });
      tone(205, 0.032, { delay: delay + 0.006, to: 155, volume: 0.018 * v, type: "sine" });
      break;
    case "flip":
      tone(310, 0.055, { delay, to: 520, volume: 0.025 * v, type: "sine" });
      break;
    case "error":
      tone(155, 0.09, { delay, to: 105, volume: 0.04 * v, type: "square" });
      break;
    case "star":
      tone(610, 0.09, { delay, to: 820, volume: 0.032 * v, type: "triangle" });
      tone(980, 0.11, { delay: delay + 0.045, to: 1180, volume: 0.018 * v, type: "sine" });
      break;
    case "combo":
      tone(520, 0.075, { delay, to: 660, volume: 0.03 * v, type: "triangle" });
      tone(780, 0.08, { delay: delay + 0.055, to: 880, volume: 0.024 * v, type: "sine" });
      break;
    case "category":
      tone(440, 0.1, { delay, to: 610, volume: 0.034 * v, type: "triangle" });
      tone(660, 0.12, { delay: delay + 0.065, to: 840, volume: 0.03 * v, type: "triangle" });
      break;
    case "win":
      [523, 659, 784].forEach((f, i) =>
        tone(f, 0.14, { delay: delay + i * 0.075, volume: 0.03 * v, type: "triangle" }),
      );
      break;
  }
}

const MUSIC_PATTERNS = {
  game: {
    notes: [261.63, 329.63, 392, 329.63, 293.66, 369.99, 440, 369.99],
    interval: 620,
    duration: 0.56,
    volume: 0.0065,
    type: "triangle",
  },
  menu: {
    notes: [196, 246.94, 293.66, 369.99, 293.66, 246.94, 220, 277.18],
    interval: 820,
    duration: 0.92,
    volume: 0.0078,
    type: "sine",
  },
  daily: {
    notes: [329.63, 392, 493.88, 440, 392, 523.25, 493.88, 392],
    interval: 560,
    duration: 0.5,
    volume: 0.0068,
    type: "sine",
  },
  marathon: {
    notes: [164.81, 196, 220, 246.94, 220, 261.63, 293.66, 246.94],
    interval: 430,
    duration: 0.4,
    volume: 0.0074,
    type: "triangle",
  },
  zen: {
    notes: [174.61, 220, 261.63, 220, 196, 246.94, 293.66, 246.94],
    interval: 980,
    duration: 1.12,
    volume: 0.0058,
    type: "sine",
  },
  duel: {
    notes: [220, 277.18, 329.63, 246.94, 293.66, 369.99, 311.13, 415.3],
    interval: 455,
    duration: 0.4,
    volume: 0.0076,
    type: "triangle",
  },
  collection: {
    notes: [293.66, 349.23, 440, 392, 349.23, 466.16, 523.25, 440],
    interval: 650,
    duration: 0.62,
    volume: 0.0064,
    type: "sine",
  },
};
function musicTone(freq, duration, volume, type = "sine", delay = 0) {
  const ctx = ensureAudioContext();
  if (!ctx || ctx.state !== "running") return;
  const start = ctx.currentTime + Math.max(0, delay),
    osc = ctx.createOscillator(),
    gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.08);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume * 0.55), start + duration * 0.68);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(start);
  osc.stop(start + duration + 0.03);
}

function playVictoryJingle(perfect = false) {
  stopBackgroundMusic();
  if (!musicEnabled()) return;
  const notes = perfect ? [523.25, 659.25, 783.99, 1046.5, 1318.5] : [523.25, 659.25, 783.99, 987.77];
  notes.forEach((note, i) => musicTone(note, i === notes.length - 1 ? 0.42 : 0.24, 0.0105, i % 2 ? "sine" : "triangle", i * 0.22));
}
function stopBackgroundMusic() {
  musicGeneration++;
  clearTimeout(musicTimer);
  musicTimer = null;
}
function scheduleMusicStep(generation) {
  if (generation !== musicGeneration || !musicEnabled() || document.hidden) return;
  const pattern = MUSIC_PATTERNS[musicMode] || MUSIC_PATTERNS.game,
    baseNote = pattern.notes[musicStep % pattern.notes.length],
    chapterTone = state?.mode === "regular" ? ((chapterInfo(state.level).number - 1) % 4) : 0,
    shifts = [1, 1.05946, 0.94387, 1.12246],
    note = musicMode === "game" ? baseNote * shifts[chapterTone] : baseNote;
  musicStep++;
  musicTone(note, pattern.duration, pattern.volume, pattern.type);
  // Very light upper note once per phrase gives the menu/game loops distinct character.
  if (musicStep % 4 === 0) musicTone(note * (musicMode === "menu" ? 2 : 1.5), pattern.duration * 0.72, pattern.volume * 0.38, "sine");
  musicTimer = setTimeout(() => scheduleMusicStep(generation), pattern.interval);
}
function musicModeForState(s = state) {
  if (!s) return "game";
  if (s.mode === "daily") return "daily";
  if (s.mode === "marathon") return "marathon";
  if (s.mode === "calm") return "zen";
  if (s.mode === "challenge") return "duel";
  if (s.mode === "collection") return "collection";
  return "game";
}
function setBackgroundMusic(mode = "game") {
  musicMode = ["menu", "game", "daily", "marathon", "zen", "duel", "collection"].includes(mode) ? mode : "game";
  stopBackgroundMusic();
  musicStep = 0;
  if (!musicEnabled() || document.hidden) return;
  const ctx = ensureAudioContext();
  if (!ctx || ctx.state !== "running") return;
  const generation = musicGeneration;
  musicTimer = setTimeout(() => scheduleMusicStep(generation), 90);
}
function syncBackgroundMusic() {
  if (!musicEnabled()) {
    stopBackgroundMusic();
    return;
  }
  setBackgroundMusic(hub?.classList.contains("show") ? "menu" : musicModeForState());
}

function resetCombo() {
  comboCount = 0;
  comboLastAt = 0;
  clearTimeout(comboTimer);
  comboTimer = null;
  const el = $("#comboPop");
  el?.classList.remove("show");
}
function registerCombo(productive = true) {
  if (!productive || state?.mode === "tutorial" || state?.mode === "calm") return;
  const now = performance.now();
  if (comboLastAt && now - comboLastAt > 8500) comboCount = 0;
  comboLastAt = now;
  comboCount++;
  profile.stats.maxDragCombo = Math.max(profile.stats.maxDragCombo || 0, comboCount);
  // maxCombo is kept only for backward-compatible analytics; UI/achievements use manual drag combo.
  profile.stats.maxCombo = Math.max(profile.stats.maxCombo || 0, comboCount);
  if (comboCount >= 3 && typeof checkAchievements === "function") checkAchievements();
  clearTimeout(comboTimer);
  comboTimer = setTimeout(resetCombo, 8500);
  if (comboCount < 2) return;
  const el = $("#comboPop");
  if (!el) return;
  el.innerHTML = `<strong>КОМБО ×${comboCount}</strong><span>${comboCount >= 5 ? "Идеальная серия!" : "Точные ходы подряд"}</span>`;
  el.classList.remove("show", "pop");
  void el.offsetWidth;
  el.classList.add("show", "pop");
  playSfx("combo", 0.75 + Math.min(comboCount, 6) * 0.05);
  if (comboCount >= 3) haptic([7, 18, 9]);
  setTimeout(() => el.classList.remove("pop"), 420);
}

function feedbackWrongMove(nodes = [], target = null, message = "Сюда положить нельзя") {
  resetCombo();
  if (state?.run) {
    state.run.errors = (state.run.errors || 0) + 1;
    try { save(); } catch {}
  }
  playSfx("error");
  haptic([18, 28, 16]);
  nodes.filter(Boolean).forEach((node) => {
    node.animate(
      [
        { transform: "translateX(0)" },
        { transform: "translateX(-5px) rotate(-1.5deg)" },
        { transform: "translateX(5px) rotate(1.5deg)" },
        { transform: "translateX(-3px)" },
        { transform: "translateX(0)" },
      ],
      { duration: 230, easing: "ease-out" },
    ).finished.catch(() => {});
  });
  if (target) {
    target.classList.remove("bad-target");
    void target.offsetWidth;
    target.classList.add("bad-target");
    setTimeout(() => target.classList.remove("bad-target"), 330);
  }
  showToast(message);
}

async function animateCategoryCompletion(slotIndex, label) {
  if (motionReduced()) {
    playSfx("category");
    return;
  }
  await nextPaint();
  const slot = document.querySelector(`.slot[data-index="${slotIndex}"]`),
    card = slot?.querySelector(".card");
  if (!slot || !card) return;
  slot.classList.add("category-completing");
  const badge = document.createElement("div");
  badge.className = "category-complete-label";
  badge.textContent = `✓ ${label}`;
  const r = slot.getBoundingClientRect();
  badge.style.left = r.left + r.width / 2 + "px";
  badge.style.top = r.top + r.height * 0.42 + "px";
  document.body.appendChild(badge);
  playSfx("category");
  haptic([12, 20, 24]);
  burst(false);
  const anim = card.animate(
    [
      { transform: "translateY(0) scale(1)", filter: "brightness(1)", opacity: 1 },
      { transform: "translateY(-7px) scale(1.075)", filter: "brightness(1.2)", opacity: 1, offset: 0.38 },
      { transform: "translateY(-11px) scale(.9)", filter: "brightness(1.35)", opacity: 0.9, offset: 0.7 },
      { transform: "translateY(-20px) scale(.72)", filter: "brightness(1.2)", opacity: 0 },
    ],
    { duration: 430, easing: "cubic-bezier(.2,.82,.2,1)", fill: "forwards" },
  );
  badge.animate(
    [
      { transform: "translate(-50%, 8px) scale(.9)", opacity: 0 },
      { transform: "translate(-50%, -8px) scale(1)", opacity: 1, offset: 0.35 },
      { transform: "translate(-50%, -28px) scale(.96)", opacity: 0 },
    ],
    { duration: 650, easing: "cubic-bezier(.2,.8,.2,1)", fill: "forwards" },
  ).finished.catch(() => {}).finally(() => badge.remove());
  await anim.finished.catch(() => {});
  slot.classList.remove("category-completing");
}

function stateSignature() {
  if (!state) return "";
  return [
    state.stock.length,
    state.waste.length,
    state.completed,
    state.run?.recycles || 0,
    ...state.columns.map((c) => c.map((g) => `${g.faceUp ? 1 : 0}:${g.cards.map((x) => x.uid).join(".")}`).join("|")),
    ...state.slots.map((g) => (g ? g.cards.map((x) => x.uid).join(".") : "-")),
  ].join("/");
}
function hideDeadlock() {
  const el = $("#deadlockModal");
  el?.classList.remove("show");
  el?.setAttribute("aria-hidden", "true");
}
function showDeadlock() {
  const el = $("#deadlockModal");
  if (!el || el.classList.contains("show")) return;
  lastDeadlockSignature = stateSignature();
  profile.stats.deadlocks = (profile.stats.deadlocks || 0) + 1;
  track("deadlock_detected", { level: state.level, mode: state.mode });
  resetCombo();
  playSfx("error", 0.75);
  haptic([18, 35, 18]);
  el.classList.add("show");
  el.setAttribute("aria-hidden", "false");
  const undoLimit = state.special?.maxUndos;
  $("#deadlockUndo").disabled = !history.length || (Number.isFinite(undoLimit) && state.run.undos >= undoLimit);
  saveProfile();
}
function scheduleDeadlockCheck(delay = 520) {
  clearTimeout(deadlockTimer);
  if (!state || state.rewarded || state.mode === "tutorial") return;
  deadlockTimer = setTimeout(() => {
    if (drag || autoMoveBusy || dealAnimating || categoryAnimating || modal.classList.contains("show") || hub.classList.contains("show"))
      return;
    const sig = stateSignature();
    if (sig === lastDeadlockSignature) return;
    if (typeof isDeadlockedState === "function" && isDeadlockedState()) showDeadlock();
  }, delay);
}
function markStateChanged() {
  lastDeadlockSignature = "";
  hideDeadlock();
  scheduleDeadlockCheck();
}

function bindFeedbackEvents() {
  document.addEventListener(
    "pointerdown",
    () => {
      ensureAudioContext();
      if (!musicTimer && musicEnabled()) setTimeout(syncBackgroundMusic, 0);
    },
    { passive: true },
  );
  $("#deadlockClose").onclick = () => {
    lastDeadlockSignature = stateSignature();
    hideDeadlock();
  };
  $("#deadlockUndo").onclick = () => {
    const limit = state.special?.maxUndos;
    if (!history.length || (Number.isFinite(limit) && state.run.undos >= limit)) return;
    hideDeadlock();
    const previous = history.pop(),
      undoCount = (state.run?.undos || 0) + 1;
    state = normalizeState(previous);
    state.run.undos = undoCount;
    profile.stats.undos++;
    resetCombo();
    playSfx("drop", 0.7);
    render();
    markStateChanged();
  };
  $("#deadlockRestart").onclick = () => {
    hideDeadlock();
    resetCombo();
    restartCurrentLevel();
  };
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden) stopBackgroundMusic();
  else if (musicEnabled()) setTimeout(syncBackgroundMusic, 120);
});

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  if (hub?.classList.contains("show")) renderHub();
});
window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  showToast("Словасьянс установлен ✓");
  track("pwa_installed");
});
