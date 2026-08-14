/* Game feel: procedural sound, combo, wrong-move feedback, category finish and deadlock UI. */
let audioCtx = null,
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
function getAudioContext() {
  if (!soundEnabled()) return null;
  const AudioCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtor) return null;
  if (!audioCtx) audioCtx = new AudioCtor();
  if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
  return audioCtx;
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

function resetCombo() {
  comboCount = 0;
  comboLastAt = 0;
  clearTimeout(comboTimer);
  comboTimer = null;
  const el = $("#comboPop");
  el?.classList.remove("show");
}
function registerCombo(productive = true) {
  if (!productive || state?.mode === "tutorial") return;
  const now = performance.now();
  if (comboLastAt && now - comboLastAt > 8500) comboCount = 0;
  comboLastAt = now;
  comboCount++;
  profile.stats.maxCombo = Math.max(profile.stats.maxCombo || 0, comboCount);
  if (comboCount >= 5 && typeof checkAchievements === "function") checkAchievements();
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
  document.addEventListener("pointerdown", () => getAudioContext(), { passive: true });
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
    if (state.mode === "daily") makeLevel(0, { mode: "daily", seed: state.seed });
    else makeLevel(state.level, { mode: state.mode, seed: state.seed });
  };
}

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
