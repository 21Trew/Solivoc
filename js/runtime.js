/* Shared DOM references, runtime state and generic utilities. */
const $ = (s) => document.querySelector(s),
  tableau = $("#tableau"),
  slotsAnchor = $("#slotsAnchor"),
  stockEl = $("#stock"),
  wasteEl = $("#waste"),
  toast = $("#toast"),
  modal = $("#modal"),
  celebration = $("#celebration"),
  coach = $("#coach"),
  hub = $("#hub"),
  hubContent = $("#hubContent"),
  hubNav = $("#hubNav"),
  achievementNotice = $("#achievementNotice");
let state,
  history = [],
  drag = null,
  autoMoveBusy = false,
  lastTap = { key: null, time: 0 };
const uid = () => crypto.randomUUID?.() || Math.random().toString(36).slice(2) + Date.now();
function hashSeed(str) {
  let h = 2166136261;
  for (const ch of String(str)) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function makeRng(seed) {
  let a = hashSeed(seed) || 1;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = (a, b, rng = Math.random) => Math.floor(rng() * (b - a + 1)) + a;
const shuffle = (arr, rng = Math.random) => {
  arr = [...arr];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};
function catHue(id) {
  let h = 0;
  for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return 205 + (h % 135);
}
function haptic(pattern = 10) {
  if (profile?.settings?.haptics === false) return;
  try {
    navigator.vibrate?.(pattern);
  } catch {}
}
function burst(strong = false) {
  if (!celebration) return;
  const constrained = typeof stabilityConstrainedMode === "function" && stabilityConstrainedMode();
  const n = constrained ? (strong ? 18 : 8) : (strong ? 42 : 16);
  for (let i = 0; i < n; i++) {
    const el = document.createElement("i");
    const effect = profile?.effect || "spark";
    el.className = `spark spark-${effect}`;
    const a = (Math.PI * 2 * i) / n + (Math.random() - 0.5) * 0.35,
      d = strong ? rnd(100, 245) : rnd(55, 125);
    el.style.setProperty("--x", Math.cos(a) * d + "px");
    el.style.setProperty("--y", Math.sin(a) * d + "px");
    el.style.setProperty("--r", rnd(-80, 80) + "deg");
    el.style.setProperty("--spark-h", rnd(25, 330));
    celebration.appendChild(el);
    setTimeout(() => el.remove(), 1100);
  }
}

function showVictoryCosmeticEffect() {
  if (!celebration || !state || state.failed || state.mode === "tutorial") return;
  const effect = profile?.effect || "spark", icons = {spark:"✦",confetti:"🎉",petals:"🌸",comet:"☄",aurora:"◈",legend:"◆",duel:"⚔",moon:"☾",fireworks:"🎆",ribbons:"🎀",stars:"★","crown-rain":"♛"};
  const wrap=document.createElement("div");wrap.className=`victory-cosmetic effect-${effect}`;wrap.innerHTML=`<b>${icons[effect]||"✦"}</b>`;
  const rayCount = typeof stabilityConstrainedMode === "function" && stabilityConstrainedMode() ? 8 : 18;
  for(let i=0;i<rayCount;i++){const ray=document.createElement("i");ray.style.setProperty("--vr",`${i*(360/rayCount)}deg`);ray.style.setProperty("--vh",String((i*41+35)%360));ray.style.setProperty("--vd",`${(i%6)*.045}s`);wrap.appendChild(ray);}
  celebration.appendChild(wrap);setTimeout(()=>wrap.remove(),2500);
}

function confettiRain(strong = false) {
  if (!celebration || motionReduced?.()) return;
  const constrained = typeof stabilityConstrainedMode === "function" && stabilityConstrainedMode();
  const n = constrained ? (strong ? 20 : 12) : (strong ? 58 : 34);
  for (let i = 0; i < n; i++) {
    const el = document.createElement("i");
    el.className = "confetti-piece";
    el.style.setProperty("--confetti-x", `${rnd(2, 98)}vw`);
    el.style.setProperty("--confetti-drift", `${rnd(-65, 65)}px`);
    el.style.setProperty("--confetti-rot", `${rnd(180, 900)}deg`);
    el.style.setProperty("--confetti-h", rnd(0, 360));
    el.style.setProperty("--confetti-delay", `${(Math.random() * (strong ? .7 : .45)).toFixed(2)}s`);
    el.style.setProperty("--confetti-time", `${(1.15 + Math.random() * .75).toFixed(2)}s`);
    celebration.appendChild(el);
    setTimeout(() => el.remove(), 2700);
  }
}
function showToast(text) {
  toast.textContent = text;
  toast.classList.add("show");
  clearTimeout(showToast.t);
  showToast.t = setTimeout(() => toast.classList.remove("show"), 1400);
}
function todayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function daysBetween(a, b) {
  const x = new Date(a + "T12:00:00"),
    y = new Date(b + "T12:00:00");
  return Math.round((y - x) / 86400000);
}
function weekKey(dateStr) {
  const d = new Date(dateStr + "T12:00:00");
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const offset = (monday.getDay() + 6) % 7;
  monday.setDate(monday.getDate() - offset);
  return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;
}
function daysUntilWeekEnd(date = new Date()) {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return Math.max(0, Math.ceil((sunday - new Date(date.getFullYear(), date.getMonth(), date.getDate())) / 86400000));
}
function monthKey(dateStr = todayKey()) {
  const d = new Date(dateStr + "T12:00:00");
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function daysUntilMonthEnd(date = new Date()) {
  const today = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const last = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return Math.max(0, Math.ceil((last - today) / 86400000));
}
