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

const CHALLENGE_API = "/api/challenges";
const SHORT_CHALLENGE_RE = /^[A-HJ-NP-Z2-9]{6}$/;

function normalizeChallengeCode(value) {
  let raw = String(value || "").trim();
  if (/challenge=/i.test(raw)) {
    try { raw = new URL(raw, location.href).searchParams.get("challenge") || raw; } catch {}
  }
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
}
function legacyDecodeChallengeCode(code) {
  try {
    let raw = String(code || "").trim();
    if (/challenge=/i.test(raw)) {
      try { raw = new URL(raw, location.href).searchParams.get("challenge") || raw; } catch {}
    }
    const padded = raw.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((raw.length + 3) % 4);
    const p = JSON.parse(decodeURIComponent(escape(atob(padded))));
    if (p?.v !== 1 || !p.seed) return null;
    return { seed: String(p.seed), level: Math.max(1, Math.min(999, +p.level || 25)), legacy: true };
  } catch {
    return null;
  }
}
async function challengeApi(method, path = "", body = null, { keepalive = false } = {}) {
  const response = await fetch(`${CHALLENGE_API}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
    keepalive,
  });
  let data = null;
  try { data = await response.json(); } catch {}
  if (!response.ok) {
    const error = new Error(data?.message || data?.error || `Challenge API ${response.status}`);
    error.status = response.status;
    error.code = data?.code;
    throw error;
  }
  return data || {};
}
function cleanChallengeResult(result = {}) {
  return {
    stars: Math.max(1, Math.min(3, +result.stars || 1)),
    moves: Math.max(0, +result.moves || 0),
    hints: Math.max(0, +result.hints || 0),
    undos: Math.max(0, +result.undos || 0),
    playerName: String(result.playerName || "Игрок").trim().slice(0, 20) || "Игрок",
    completedAt: result.completedAt || Date.now(),
  };
}
function resultForCurrentChallenge(s = state, stars = null) {
  return cleanChallengeResult({
    stars: stars ?? s?.lastStars ?? 1,
    moves: s?.run?.moves || 0,
    hints: s?.run?.hints || 0,
    undos: s?.run?.undos || 0,
    playerName: profile.playerName || "Игрок",
    completedAt: Date.now(),
  });
}
function challengeStarsText(stars = 0) {
  const n = Math.max(0, Math.min(3, +stars || 0));
  return `${"★".repeat(n)}${"☆".repeat(3 - n)}`;
}
function challengeComparison(entry) {
  const me = entry?.creatorResult, friend = entry?.guestResult;
  if (!me || !friend) return "";
  if (me.stars !== friend.stars) return me.stars > friend.stars ? "Ты взял больше звёзд" : "Друг взял больше звёзд";
  if (me.moves && friend.moves && me.moves !== friend.moves) return me.moves < friend.moves ? `Ты быстрее на ${friend.moves - me.moves} ход.` : `Друг быстрее на ${me.moves - friend.moves} ход.`;
  return "Результаты равны";
}
function pruneSentChallenges() {
  profile.sentChallenges = (profile.sentChallenges || [])
    .filter((x) => x?.code && x?.seed)
    .sort((a, b) => (+b.createdAt || 0) - (+a.createdAt || 0))
    .slice(0, 24);
}
function ownedChallengeByCode(code) {
  const normalized = normalizeChallengeCode(code);
  return (profile.sentChallenges || []).find((x) => x.code === normalized) || null;
}
function ownedChallengesMarkup() {
  pruneSentChallenges();
  const items = (profile.sentChallenges || []).slice(0, 6);
  if (!items.length) return "";
  return `<section class="hub-section owned-challenges"><div class="hub-section-head"><h3>Мои вызовы</h3><small>${items.length}</small></div><div class="owned-challenge-list">${items.map((entry) => {
    const friend = entry.guestResult, me = entry.creatorResult;
    const status = friend ? `${friend.playerName}: ${challengeStarsText(friend.stars)} · ${friend.moves} ход.` : entry.status === "expired" ? "Код истёк или уже использован" : "Ждём, когда друг сыграет";
    const mine = me ? `Ты: ${challengeStarsText(me.stars)} · ${me.moves} ход.` : "Ты ещё не играл этот расклад";
    const compare = challengeComparison(entry);
    return `<article class="owned-challenge ${friend ? "completed" : "pending"}"><div class="owned-challenge-code"><b>${entry.code}</b><span>${status}</span></div><div class="owned-challenge-results"><span>${mine}</span>${compare ? `<strong>${compare}</strong>` : ""}</div><div class="owned-challenge-actions"><button data-owned-challenge-play="${entry.code}">▶ ${me ? "Переиграть" : "Сыграть"}</button>${!friend && entry.status !== "expired" ? `<button data-owned-challenge-share="${entry.code}">⇄ Отправить</button>` : ""}</div></article>`;
  }).join("")}</div></section>`;
}
async function createRemoteChallenge() {
  const level = Math.max(12, profile.currentLevel || 1),
    seed = `friend:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`;
  const data = await challengeApi("POST", "", { action: "create", seed, level, creatorName: profile.playerName || "Игрок" });
  const entry = {
    code: data.code,
    ownerToken: data.ownerToken,
    seed,
    level,
    creatorName: profile.playerName || "Игрок",
    createdAt: Date.now(),
    expiresAt: data.expiresAt || Date.now() + 7 * 86400000,
    status: "pending",
    creatorResult: null,
    guestResult: null,
  };
  profile.sentChallenges ||= [];
  profile.sentChallenges.unshift(entry);
  pruneSentChallenges();
  saveProfile();
  return entry;
}
async function challengeInviteFile(entry) {
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 630;
  const ctx = canvas.getContext("2d");
  const bg = ctx.createLinearGradient(0, 0, 1200, 630);
  bg.addColorStop(0, "#17143d");
  bg.addColorStop(0.55, "#312264");
  bg.addColorStop(1, "#172c5d");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 1200, 630);
  const glow = ctx.createRadialGradient(970, 80, 10, 970, 80, 420);
  glow.addColorStop(0, "rgba(255,102,176,.44)");
  glow.addColorStop(1, "rgba(255,102,176,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 1200, 630);
  const glow2 = ctx.createRadialGradient(120, 560, 10, 120, 560, 360);
  glow2.addColorStop(0, "rgba(78,215,255,.35)");
  glow2.addColorStop(1, "rgba(78,215,255,0)");
  ctx.fillStyle = glow2;
  ctx.fillRect(0, 0, 1200, 630);

  ctx.fillStyle = "rgba(255,255,255,.10)";
  roundRect(ctx, 62, 62, 1076, 506, 44);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,.20)";
  ctx.lineWidth = 2;
  ctx.stroke();

  const mark = ctx.createLinearGradient(92, 92, 198, 198);
  mark.addColorStop(0, "#aa72ff");
  mark.addColorStop(1, "#4b7cff");
  ctx.fillStyle = mark;
  roundRect(ctx, 92, 92, 112, 112, 30);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = "900 52px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("✦", 148, 149);

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#fff";
  ctx.font = "900 54px system-ui, sans-serif";
  ctx.fillText("Словасьянс", 234, 139);
  ctx.fillStyle = "rgba(255,255,255,.72)";
  ctx.font = "700 25px system-ui, sans-serif";
  ctx.fillText(`Вызов от ${entry.creatorName || "Игрок"}`, 234, 183);

  ctx.fillStyle = "rgba(255,255,255,.72)";
  ctx.font = "800 25px system-ui, sans-serif";
  ctx.fillText("КОД ИСПЫТАНИЯ", 94, 298);
  ctx.fillStyle = "#fff";
  ctx.font = "900 112px ui-monospace, SFMono-Regular, Menlo, monospace";
  ctx.fillText(entry.code, 89, 414);

  ctx.fillStyle = "rgba(255,255,255,.72)";
  ctx.font = "700 27px system-ui, sans-serif";
  ctx.fillText("Открой игру → Вызов другу → введи код", 94, 500);
  ctx.textAlign = "right";
  ctx.font = "700 22px system-ui, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,.52)";
  ctx.fillText(location.host || "Словасьянс", 1100, 530);

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png", 0.96));
  return new File([blob], `slovasyans-${entry.code}.png`, { type: "image/png" });
}
function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}
async function shareChallengeEntry(entry) {
  if (!entry) return false;
  const text = `Сыграем в Словасьянс? Код ${entry.code}`;
  try {
    const file = await challengeInviteFile(entry);
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ title: "Словасьянс — вызов", text, files: [file] });
    } else if (navigator.share && /^https?:$/.test(location.protocol)) {
      await navigator.share({ title: "Словасьянс — вызов", text });
    } else if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(file);
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1200);
    } else throw new Error("share unavailable");
    showToast(`Вызов ${entry.code} готов`);
    return true;
  } catch (err) {
    if (err?.name === "AbortError") return false;
    window.prompt("Код испытания", entry.code);
    return false;
  }
}
async function shareNewChallenge() {
  try {
    showToast("Создаю вызов…");
    const entry = await createRemoteChallenge();
    if (hub?.classList.contains("show") && typeof renderHub === "function") renderHub();
    await shareChallengeEntry(entry);
    return entry.code;
  } catch (err) {
    console.error("Challenge create:", err);
    showToast(err?.status === 503 ? "Подключи Redis для сетевых вызовов" : "Не удалось создать вызов");
    return null;
  }
}
function playOwnedChallenge(code) {
  const entry = ownedChallengeByCode(code);
  if (!entry) return false;
  closeHub?.();
  makeLevel(entry.level, {
    mode: "challenge",
    seed: entry.seed,
    challengeCode: entry.code,
    challengeRole: "creator",
    challengeCreatorName: entry.creatorName || profile.playerName || "Игрок",
  });
  return true;
}
async function startChallengeCode(value) {
  let raw = String(value || "").trim();
  if (/challenge=/i.test(raw)) {
    try { raw = new URL(raw, location.href).searchParams.get("challenge") || raw; } catch {}
  }
  const compact = raw.toUpperCase().replace(/[^A-Z0-9]/g, ""),
    shortCode = compact;
  if (compact.length === 6 && SHORT_CHALLENGE_RE.test(shortCode)) {
    try {
      const data = await challengeApi("GET", `?code=${encodeURIComponent(shortCode)}`);
      closeHub?.();
      makeLevel(data.level, {
        mode: "challenge",
        seed: data.seed,
        challengeCode: shortCode,
        challengeRole: "guest",
        challengeCreatorName: data.creatorName || "Друг",
      });
      window.history?.replaceState?.({}, "", location.pathname + location.hash);
      return true;
    } catch (err) {
      console.error("Challenge start:", err);
      showToast(err?.status === 410 || err?.status === 404 ? "Этот код уже сыгран или истёк" : "Не удалось загрузить вызов");
      return false;
    }
  }
  const legacy = legacyDecodeChallengeCode(raw);
  if (legacy) {
    closeHub?.();
    makeLevel(legacy.level, { mode: "challenge", seed: legacy.seed, challengeCode: raw, challengeRole: "legacy" });
    showToast("Старый код: результат не синхронизируется");
    return true;
  }
  showToast("Код испытания не распознан");
  return false;
}
function recordCreatorChallengeResult(s = state, stars = null) {
  if (!s?.challengeCode) return;
  const entry = ownedChallengeByCode(s.challengeCode);
  if (!entry) return;
  entry.creatorResult = resultForCurrentChallenge(s, stars);
  entry.status = entry.guestResult ? "completed" : "pending";
  saveProfile();
}
function enqueueGuestChallengeSubmission(s = state, stars = null) {
  if (!s?.challengeCode || s.challengeRole !== "guest") return;
  const submissionId = s.challengeSubmissionId || uid();
  s.challengeSubmissionId = submissionId;
  const item = {
    code: normalizeChallengeCode(s.challengeCode),
    submissionId,
    result: resultForCurrentChallenge(s, stars),
    createdAt: Date.now(),
  };
  profile.pendingChallengeSubmissions ||= [];
  if (!profile.pendingChallengeSubmissions.some((x) => x.submissionId === submissionId)) profile.pendingChallengeSubmissions.push(item);
  saveProfile();
  flushPendingChallengeSubmissions();
}
async function flushPendingChallengeSubmissions() {
  const queue = [...(profile.pendingChallengeSubmissions || [])];
  if (!queue.length) return false;
  let changed = false;
  for (const item of queue) {
    try {
      await challengeApi("POST", "", { action: "complete", code: item.code, submissionId: item.submissionId, result: item.result }, { keepalive: true });
      profile.pendingChallengeSubmissions = profile.pendingChallengeSubmissions.filter((x) => x.submissionId !== item.submissionId);
      changed = true;
    } catch (err) {
      if (err?.status === 410 || err?.status === 404) {
        profile.pendingChallengeSubmissions = profile.pendingChallengeSubmissions.filter((x) => x.submissionId !== item.submissionId);
        changed = true;
      }
    }
  }
  if (changed) saveProfile();
  return changed;
}
async function refreshOwnedChallenges({ notify = true } = {}) {
  const items = (profile.sentChallenges || []).filter((x) => x?.ownerToken && !x.guestResult && x.status !== "expired").slice(0, 12);
  if (!items.length) return false;
  let changed = false;
  for (const entry of items) {
    try {
      const data = await challengeApi("GET", `?code=${encodeURIComponent(entry.code)}&ownerToken=${encodeURIComponent(entry.ownerToken)}`);
      if (data.status === "completed" && data.guestResult) {
        entry.guestResult = cleanChallengeResult(data.guestResult);
        entry.status = "completed";
        changed = true;
        try { await challengeApi("POST", "", { action: "ack", code: entry.code, ownerToken: entry.ownerToken }); } catch {}
        if (notify && typeof queueAchievementNotifications === "function") {
          queueAchievementNotifications([{ icon: "⇄", title: "Друг завершил вызов", desc: `${entry.code} · ${challengeStarsText(entry.guestResult.stars)} · ${entry.guestResult.moves} ход.` }]);
        }
      } else if (data.status === "pending") entry.status = "pending";
    } catch (err) {
      if (err?.status === 404 || err?.status === 410) {
        entry.status = "expired";
        changed = true;
      }
    }
  }
  if (changed) {
    saveProfile();
    if (hub?.classList.contains("show") && typeof renderHub === "function" && typeof hubTab !== "undefined" && hubTab === "play") renderHub();
  }
  return changed;
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
    const code = normalizeChallengeCode(state.challengeCode || "");
    if (code) extra = ` · код ${code}`;
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
