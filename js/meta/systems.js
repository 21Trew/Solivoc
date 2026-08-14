/* Meta systems: encyclopedia, weekly challenge, records, share challenges and save transfer. */
function categoryStat(id) {
  profile.categoryStats ||= {};
  return (profile.categoryStats[id] ||= { encounters: 0, completions: 0, firstLevel: null, words: [] });
}
function levelRefLabel(s = state) {
  if (!s) return null;
  if (s.mode === "regular") return `Ур. ${s.level}`;
  if (s.mode === "daily") return `Daily ${todayKey()}`;
  if (s.mode === "challenge") return "Испытание";
  if (s.mode === "marathon") return `Марафон ${s.marathonRound || 1}`;
  if (s.mode === "calm") return "Спокойный режим";
  return null;
}
function recordLevelKnowledge(s = state) {
  if (!s || s.mode === "tutorial") return;
  const ref = levelRefLabel(s);
  for (const id of new Set(s.categoryIds || [])) {
    const stat = categoryStat(id);
    stat.encounters = (stat.encounters || 0) + 1;
    if (!stat.firstLevel) stat.firstLevel = ref;
  }
}
function recordVisibleKnowledge(s = state) {
  if (!s || s.mode === "tutorial") return;
  const visible = [];
  s.columns?.forEach((col) => col.forEach((g) => { if (g.faceUp) visible.push(...g.cards); }));
  s.slots?.forEach((g) => { if (g) visible.push(...g.cards); });
  visible.push(...(s.waste || []).slice(-3));
  const changed = new Set();
  for (const card of visible) {
    if (!card?.cat) continue;
    const stat = categoryStat(card.cat);
    if (!stat.firstLevel) stat.firstLevel = levelRefLabel(s);
    if (card.type === "word" && !stat.words.includes(card.label)) {
      stat.words.push(card.label);
      changed.add(card.cat);
    }
  }
  if (changed.size) saveProfile();
}
function recordCategoryCompletion(catId) {
  if (!catId) return;
  const stat = categoryStat(catId);
  stat.completions = (stat.completions || 0) + 1;
}

function metricValue(metric, p = profile) {
  if (metric === "stars") return p.totalStars || 0;
  return +(p.stats?.[metric] || 0);
}
function ensureWeeklyChallenge() {
  const key = weekKey(todayKey());
  profile.weekly ||= { key: null, id: null, baseline: {}, completed: false, completedCount: 0 };
  if (profile.weekly.key === key && profile.weekly.id) return profile.weekly;
  const def = WEEKLY_DEFS[hashSeed(`weekly:${key}`) % WEEKLY_DEFS.length];
  profile.weekly = {
    key,
    id: def.id,
    baseline: { [def.metric]: metricValue(def.metric) },
    completed: false,
    completedCount: profile.weekly.completedCount || profile.stats.weeklyCompleted || 0,
  };
  saveProfile();
  return profile.weekly;
}
function weeklyDefinition() {
  const w = ensureWeeklyChallenge();
  return WEEKLY_DEFS.find((x) => x.id === w.id) || WEEKLY_DEFS[0];
}
function weeklyProgress() {
  const w = ensureWeeklyChallenge(), def = weeklyDefinition();
  const value = Math.max(0, metricValue(def.metric) - +(w.baseline?.[def.metric] || 0));
  return { value: Math.min(def.goal, value), goal: def.goal, ratio: Math.min(1, value / def.goal), def, completed: !!w.completed };
}
function updateWeeklyChallenge() {
  const progress = weeklyProgress();
  if (progress.completed || progress.value < progress.goal) return false;
  profile.weekly.completed = true;
  profile.weekly.completedCount = (profile.weekly.completedCount || 0) + 1;
  profile.stats.weeklyCompleted = Math.max(profile.stats.weeklyCompleted || 0, profile.weekly.completedCount);
  saveProfile();
  if (typeof queueAchievementNotifications === "function") {
    queueAchievementNotifications([{ icon: "W", title: "Недельное испытание выполнено", desc: progress.def.title }]);
  }
  return true;
}

function recordKeyForState(s = state) {
  if (!s) return null;
  if (s.mode === "regular") return { bucket: "levelRecords", key: String(s.level) };
  if (s.mode === "daily") return { bucket: "dailyRecords", key: todayKey() };
  if (s.mode === "challenge") return { bucket: "challengeRecords", key: s.challengeCode || s.seed };
  return null;
}
function bestMovesForState(s = state) {
  const ref = recordKeyForState(s);
  return ref ? +(profile[ref.bucket]?.[ref.key]?.moves || 0) : 0;
}
function updatePersonalRecord(stars, s = state) {
  const ref = recordKeyForState(s);
  if (!ref) return { best: 0, isNew: false, previous: 0 };
  profile[ref.bucket] ||= {};
  const previous = +(profile[ref.bucket][ref.key]?.moves || 0), moves = +(s.run?.moves || 0);
  const bestStars = Math.max(+(profile[ref.bucket][ref.key]?.stars || 0), stars || 0);
  const isNew = moves > 0 && (!previous || moves < previous);
  if (isNew) profile.stats.personalRecords = (profile.stats.personalRecords || 0) + 1;
  profile[ref.bucket][ref.key] = { moves: isNew ? moves : previous || moves, stars: bestStars, at: Date.now() };
  return { best: profile[ref.bucket][ref.key].moves, isNew, previous };
}

function base64UrlEncode(text) {
  return btoa(unescape(encodeURIComponent(text))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function base64UrlDecode(text) {
  const padded = text.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((text.length + 3) % 4);
  return decodeURIComponent(escape(atob(padded)));
}
function createChallengeCode() {
  const payload = {
    v: 1,
    seed: `friend:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`,
    level: Math.max(12, profile.currentLevel || 1),
  };
  return base64UrlEncode(JSON.stringify(payload));
}
function decodeChallengeCode(code) {
  try {
    let raw = String(code || "").trim();
    if (/challenge=/i.test(raw)) {
      try { raw = new URL(raw, location.href).searchParams.get("challenge") || raw; } catch {}
    }
    const p = JSON.parse(base64UrlDecode(raw));
    if (p?.v !== 1 || !p.seed) return null;
    return { seed: String(p.seed), level: Math.max(1, Math.min(999, +p.level || 25)) };
  } catch {
    return null;
  }
}
function startChallengeCode(code) {
  const decoded = decodeChallengeCode(code);
  if (!decoded) {
    showToast("Код испытания не распознан");
    return false;
  }
  closeHub?.();
  makeLevel(decoded.level, { mode: "challenge", seed: decoded.seed, challengeCode: code });
  return true;
}
async function shareNewChallenge() {
  const code = createChallengeCode(), base = location.href.split(/[?#]/)[0], url = `${base}?challenge=${encodeURIComponent(code)}`;
  const text = `Словасьянс — попробуй мой расклад\n${url}\nКод: ${code}`;
  try {
    if (navigator.share && /^https?:$/.test(location.protocol)) await navigator.share({ title: "Словасьянс — вызов", text, url });
    else if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
    else throw new Error("clipboard unavailable");
    showToast("Вызов готов — ссылка скопирована");
  } catch {
    window.prompt("Скопируй код испытания", code);
  }
  return code;
}
function challengeCodeFromUrl() {
  return new URLSearchParams(location.search).get("challenge") || "";
}


async function shareCurrentResult() {
  if (!state || state.mode === "tutorial") return;
  const stars = Math.max(1, Math.min(3, +(state.lastStars || calculateStars?.() || 1))),
    starText = `${"★".repeat(stars)}${"☆".repeat(3 - stars)}`,
    moves = state.run?.moves || 0,
    hints = state.run?.hints || 0,
    undos = state.run?.undos || 0;
  let title = `Словасьянс · Уровень ${state.level}`,
    extra = "";
  if (state.mode === "daily") title = `Словасьянс · Daily ${todayKey()}`;
  if (state.mode === "challenge") {
    title = "Словасьянс · Вызов";
    const code = state.challengeCode || "";
    if (code) {
      const base = location.href.split(/[?#]/)[0];
      extra = `\n${base}?challenge=${encodeURIComponent(code)}`;
    }
  }
  const text = `${title}\n${starText} · ${moves} ходов · ${hints} подсказок · ${undos} отмен${extra}`;
  try {
    if (navigator.share && /^https?:$/.test(location.protocol)) await navigator.share({ title, text });
    else if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
    else throw new Error("share unavailable");
    showToast("Результат готов к отправке");
  } catch {
    window.prompt("Скопируй результат", text);
  }
}

function effectPreviewMarkup(def) {
  return `<span class="effect-preview effect-${def.id}"><i></i><i></i><i></i></span>`;
}

function exportProgress() {
  const payload = {
    app: "worditaire",
    version: 2,
    exportedAt: new Date().toISOString(),
    profile,
    state,
    analytics: (() => { try { return JSON.parse(localStorage.getItem(ANALYTICS_KEY)); } catch { return null; } })(),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `slovasyans-save-${todayKey()}.json`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  track("progress_exported");
}
function importProgress() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/json,.json";
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (data?.app !== "worditaire" || !data.profile) throw new Error("wrong file");
      localStorage.setItem(PROFILE_KEY, JSON.stringify(data.profile));
      if (data.state?.columns) localStorage.setItem(SAVE_KEY, JSON.stringify(data.state));
      if (data.analytics) localStorage.setItem(ANALYTICS_KEY, JSON.stringify(data.analytics));
      showToast("Прогресс импортирован. Перезапускаю…");
      setTimeout(() => location.reload(), 550);
    } catch {
      showToast("Не удалось импортировать сохранение");
    }
  };
  input.click();
}
