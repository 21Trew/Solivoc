/* Meta systems: encyclopedia, weekly challenge, records, share challenges and save transfer. */
function categoryStat(id) {
  profile.categoryStats ||= {};
  return (profile.categoryStats[id] ||= { encounters: 0, completions: 0, firstLevel: null, words: [], discoveredAt: 0 });
}
function levelRefLabel(s = state) {
  if (!s) return null;
  if (s.mode === "regular") return `Ур. ${s.level}`;
  if (s.mode === "daily") return `Ежедневный ${todayKey()}`;
  if (s.mode === "challenge") return "Дуэль";
  if (s.mode === "marathon") return `Марафон ${s.marathonRound || 1}`;
  if (s.mode === "calm") return "Дзен";
  if (s.mode === "collection") return `Картинки · ${associationCollectionById(s.collectionId).name}`;
  return null;
}
function recordLevelKnowledge(s = state) {
  if (!s || s.mode === "tutorial") return;
  const ref = levelRefLabel(s) || (s.mode === "collection" ? `Картинки · ${associationCollectionById(s.collectionId).name}` : "Расклад");
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
    registerVisibleCategoryDiscovery?.(card.cat, levelRefLabel(s));
    const stat = categoryStat(card.cat);
    if (!stat.firstLevel) stat.firstLevel = levelRefLabel(s);
    if (card.type === "word" && !stat.words.includes(card.label)) {
      stat.words.push(card.label);
      changed.add(card.cat);
    }
  }
  if (changed.size) {
    changed.forEach((id) => String(id).startsWith("visual:") ? checkVisualCategoryMastery?.(id) : checkCategoryMastery?.(id));
    saveProfile();
  }
}
function recordCategoryCompletion(catId) {
  if (!catId) return;
  const stat = categoryStat(catId);
  stat.completions = (stat.completions || 0) + 1;
  if (String(catId).startsWith("visual:")) {
    profile.visualDiscovered ||= [];
    if (!profile.visualDiscovered.includes(catId)) profile.visualDiscovered.push(catId);
    const info = visualCategoryById(catId);
    if (info) {
      profile.associationCollections ||= {};
      const progress = profile.associationCollections[info.collection.id] ||= { plays: 0, wins: 0, completedCategories: [] };
      progress.completedCategories = [...new Set([...(progress.completedCategories || []), catId])];
    }
  }
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
    rewarded: false,
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
  if (!profile.weekly.rewarded && progress.def.rewardXp) {
    profile.weekly.rewarded = true;
    awardXp?.(progress.def.rewardXp, "Недельное испытание", { notifyRank: false });
  }
  saveProfile();
  if (typeof queueAchievementNotifications === "function") {
    queueAchievementNotifications([{ icon: "W", title: "Недельное испытание выполнено", desc: `${progress.def.title} · +${progress.def.rewardXp || 0} XP` }]);
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

function challengeCodeFromValue(value) {
  let raw = String(value || "").trim();
  try {
    const url = new URL(raw, location.href);
    raw = url.searchParams.get("c") || url.searchParams.get("challenge") || raw;
  } catch {}
  return raw;
}
function normalizeChallengeCode(value) {
  return challengeCodeFromValue(value).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
}
function legacyDecodeChallengeCode(code) {
  try {
    const raw = challengeCodeFromValue(code);
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
    errors: Math.max(0, +result.errors || 0),
    undos: Math.max(0, +result.undos || 0),
    playerName: String(result.playerName || "Игрок").trim().slice(0, 20) || "Игрок",
    avatarEmoji: String(result.avatarEmoji || "🙂").slice(0, 8) || "🙂",
    title: String(result.title || "").trim().slice(0, 32),
    rank: String(result.rank || "").trim().slice(0, 32),
    featured: Array.isArray(result.featured) ? result.featured.map((x)=>String(x).slice(0,32)).slice(0,3) : [],
    completedAt: result.completedAt || Date.now(),
  };
}
function resultForCurrentChallenge(s = state, stars = null) {
  return cleanChallengeResult({
    stars: stars ?? s?.lastStars ?? 1,
    moves: s?.run?.moves || 0,
    hints: s?.run?.hints || 0,
    errors: s?.run?.errors || 0,
    undos: s?.run?.undos || 0,
    playerName: profile.playerName || "Игрок",
    avatarEmoji: profile.avatarEmoji || "🙂",
    title: titleDefById(profile.titleId)?.name || "",
    rank: playerRank?.(profile)?.name || "",
    featured: (profile.featuredAchievements || []).slice(0,3),
    completedAt: Date.now(),
  });
}
function challengeStarsText(stars = 0) {
  const n = Math.max(0, Math.min(3, +stars || 0));
  return `${"★".repeat(n)}${"☆".repeat(3 - n)}`;
}
function challengeResultMarkup(label, result) {
  if (!result) return `<div class="challenge-result-row empty"><span class="challenge-avatar">•</span><div><b>${label}</b><span>ещё не сыграно</span></div></div>`;
  return `<div class="challenge-result-row"><span class="challenge-avatar">${result.avatarEmoji || "🙂"}</span><div><div><b>${label}</b><span>${challengeStarsText(result.stars)} · ${result.moves} ход.</span></div><small>${result.title?`${escapeHtml(result.title)}${result.rank?` · ${escapeHtml(result.rank)}`:""}<br>`:""}Подсказки ${result.hints} · Ошибки ${result.errors || 0} · Отмены ${result.undos}</small></div></div>`;
}
function challengeComparison(entry) {
  const me = entry?.creatorResult, friend = entry?.guestResult;
  if (!me || !friend) return "";
  if (me.stars !== friend.stars) return me.stars > friend.stars ? "Ты взял больше звёзд" : "Друг взял больше звёзд";
  if (me.moves !== friend.moves) return me.moves < friend.moves ? `Ты быстрее на ${friend.moves - me.moves} ход.` : `Друг быстрее на ${me.moves - friend.moves} ход.`;
  if ((me.errors || 0) !== (friend.errors || 0)) return (me.errors || 0) < (friend.errors || 0) ? "У тебя меньше ошибок" : "У друга меньше ошибок";
  if (me.hints !== friend.hints) return me.hints < friend.hints ? "Ты использовал меньше подсказок" : "Друг использовал меньше подсказок";
  if (me.undos !== friend.undos) return me.undos < friend.undos ? "Ты использовал меньше отмен" : "Друг использовал меньше отмен";
  return "Результаты равны";
}
function pruneSentChallenges() {
  profile.sentChallenges = (profile.sentChallenges || [])
    .filter((x) => x?.code && x?.seed)
    .sort((a, b) => (+b.createdAt || 0) - (+a.createdAt || 0))
    .slice(0, 60);
}
function pruneReceivedChallenges() {
  profile.receivedChallenges = (profile.receivedChallenges || [])
    .filter((x) => x?.code && x?.seed)
    .sort((a, b) => (+b.completedAt || +b.startedAt || 0) - (+a.completedAt || +a.startedAt || 0))
    .slice(0, 60);
}
function ownedChallengeByCode(code) {
  const normalized = normalizeChallengeCode(code);
  return (profile.sentChallenges || []).find((x) => x.code === normalized) || null;
}
function receivedChallengeByCode(code) {
  const normalized = normalizeChallengeCode(code);
  return (profile.receivedChallenges || []).find((x) => x.code === normalized) || null;
}
function rememberReceivedChallenge(data) {
  if (!data?.code || !data?.seed) return null;
  profile.receivedChallenges ||= [];
  let entry = receivedChallengeByCode(data.code);
  if (!entry) {
    entry = {
      code: normalizeChallengeCode(data.code),
      seed: data.seed,
      level: data.level,
      creatorName: data.creatorName || "Друг",
      creatorAvatar: data.creatorAvatar || "🙂",
      sourceMode: normalizeCardSourceMode(data.sourceMode),
      creatorResult: data.creatorResult ? cleanChallengeResult(data.creatorResult) : null,
      guestToken: data.guestToken || null,
      seriesId: data.seriesId || null,
      seriesRound: data.seriesRound || 1,
      seriesScoreCreator: +data.seriesScoreCreator || 0,
      seriesScoreGuest: +data.seriesScoreGuest || 0,
      startedAt: Date.now(),
      completedAt: null,
      status: "playing",
      guestResult: null,
    };
    profile.receivedChallenges.unshift(entry);
  } else {
    entry.seed = data.seed || entry.seed;
    entry.level = data.level || entry.level;
    entry.creatorName = data.creatorName || entry.creatorName || "Друг";
    entry.creatorAvatar = data.creatorAvatar || entry.creatorAvatar || "🙂";
    entry.sourceMode = normalizeCardSourceMode(data.sourceMode || entry.sourceMode);
    if (data.creatorResult) entry.creatorResult = cleanChallengeResult(data.creatorResult);
    if (data.guestToken) entry.guestToken = data.guestToken;
    entry.seriesId = data.seriesId || entry.seriesId || null;
    entry.seriesRound = data.seriesRound || entry.seriesRound || 1;
    if (data.seriesScoreCreator != null) entry.seriesScoreCreator = +data.seriesScoreCreator || 0;
    if (data.seriesScoreGuest != null) entry.seriesScoreGuest = +data.seriesScoreGuest || 0;
    if (!entry.guestResult) entry.status = "playing";
  }
  pruneReceivedChallenges();
  saveProfile();
  return entry;
}
function ownedChallengeCardMarkup(entry, { compact = false } = {}) {
  if (!entry) return "";
  const friend = entry.guestResult, me = entry.creatorResult,
    status = friend
      ? (me ? `Матч завершён · ${friend.playerName || "Друг"}` : `${friend.playerName || "Друг"} сыграл · твой ход`)
      : entry.status === "expired"
        ? "Код истёк или уже использован"
        : "Ждём, когда друг сыграет",
    compare = challengeComparison(entry),
    series = typeof seriesLabel === "function" ? seriesLabel(entry, "creator") : "";
  return `<article class="owned-challenge ${friend && me ? "completed" : "pending"} ${compact ? "duel-card" : ""}">
    <div class="owned-challenge-code"><b>${entry.code}</b><span>${status}</span></div>
    <div class="duel-direction">Отправлен</div>
    ${series ? `<div class="challenge-series-line">⚔ ${series}</div>` : ""}
    <div class="owned-challenge-results">${challengeResultMarkup("Ты", me)}${challengeResultMarkup(friend?.playerName || "Друг", friend)}${compare && me && friend ? `<strong>${compare}</strong>` : ""}</div>
    <div class="owned-challenge-actions">
      ${!me || !friend ? `<button data-owned-challenge-play="${entry.code}">▶ ${me ? "Переиграть" : "Сыграть"}</button>` : ""}
      ${!friend && entry.status !== "expired" ? `<button data-owned-challenge-share="${entry.code}">⇄ Отправить</button>` : ""}
      ${friend && me ? `<button data-owned-challenge-rematch="${entry.code}">⚔ Реванш</button>` : ""}
      <button class="challenge-delete" data-owned-challenge-delete="${entry.code}" title="Удалить дуэль">✕ Удалить</button>
    </div>
  </article>`;
}
function receivedChallengeCardMarkup(entry, { compact = false } = {}) {
  if (!entry) return "";
  const result = entry.guestResult, creatorResult = entry.creatorResult,
    status = result
      ? (creatorResult ? `Матч завершён · ${entry.creatorName || "Друг"}` : `Ты сыграл · ждём ${entry.creatorName || "друга"}`)
      : `От ${entry.creatorName || "друга"} · твой ход`,
    series = typeof seriesLabel === "function" ? seriesLabel(entry, "guest") : "";
  return `<article class="owned-challenge ${result && creatorResult ? "completed" : "pending"} ${compact ? "duel-card" : ""}">
    <div class="owned-challenge-code"><b>${entry.code}</b><span>${status}</span></div>
    <div class="duel-direction">Получен</div>
    ${series ? `<div class="challenge-series-line">⚔ ${series}</div>` : ""}
    <div class="owned-challenge-results">${challengeResultMarkup("Ты", result)}${challengeResultMarkup(entry.creatorName || "Друг", creatorResult)}</div>
    <div class="owned-challenge-actions">
      ${!result ? `<button data-received-challenge-play="${entry.code}">▶ Сыграть</button>` : ""}
      ${result && creatorResult ? `<button data-received-challenge-rematch="${entry.code}">⚔ Реванш</button>` : ""}
      <button class="challenge-delete" data-received-challenge-delete="${entry.code}" title="Удалить дуэль">✕ Удалить</button>
    </div>
  </article>`;
}
async function deleteOwnedChallenge(code) {
  const entry = ownedChallengeByCode(code);
  if (!entry) return;
  const pending = !(entry.creatorResult && entry.guestResult) && entry.status !== "expired";
  if (!confirm(pending ? "Удалить и отменить эту дуэль? Друг больше не сможет открыть код." : "Удалить эту дуэль из истории?")) return;
  if (pending && entry.ownerToken) {
    try { await challengeApi("POST", "", { action: "cancel", code: entry.code, ownerToken: entry.ownerToken }); }
    catch (error) { if (![404, 410].includes(error?.status)) console.warn("Challenge cancel", error); }
  }
  profile.sentChallenges = (profile.sentChallenges || []).filter((x) => x.code !== entry.code);
  saveProfile();
  showToast(pending ? "Дуэль удалена" : "Матч удалён из истории");
  renderHub?.();
}
function deleteReceivedChallenge(code) {
  const entry = receivedChallengeByCode(code);
  if (!entry) return;
  if (!confirm("Удалить эту дуэль с устройства?")) return;
  profile.receivedChallenges = (profile.receivedChallenges || []).filter((x) => x.code !== entry.code);
  saveProfile();
  showToast("Дуэль удалена");
  renderHub?.();
}
function ownedChallengesMarkup() {
  pruneSentChallenges();
  const items = (profile.sentChallenges || []).slice(0, 6);
  if (!items.length) return "";
  return `<section class="hub-section owned-challenges"><div class="hub-section-head"><h3>Мои дуэли</h3><small>${items.length}</small></div><div class="owned-challenge-list">${items.map((entry)=>ownedChallengeCardMarkup(entry)).join("")}</div></section>`;
}
function receivedChallengesMarkup() {
  pruneReceivedChallenges();
  const items = (profile.receivedChallenges || []).slice(0, 6);
  if (!items.length) return "";
  return `<section class="hub-section owned-challenges received-challenges"><div class="hub-section-head"><h3>Полученные дуэли</h3><small>${items.length}</small></div><div class="owned-challenge-list">${items.map((entry)=>receivedChallengeCardMarkup(entry)).join("")}</div></section>`;
}

async function createRemoteChallenge(meta = {}) {
  const level = Math.max(12, profile.currentLevel || 1),
    sourceMode = normalizeCardSourceMode(profile.settings.cardSourceMode),
    seed = `friend:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`,
    seriesId = meta.seriesId || `series:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 7)}`,
    seriesRound = Math.max(1, +meta.seriesRound || 1),
    seriesScoreCreator = Math.max(0, +meta.seriesScoreCreator || 0),
    seriesScoreGuest = Math.max(0, +meta.seriesScoreGuest || 0);
  const data = await challengeApi("POST", "", { action: "create", seed, level, sourceMode, creatorName: profile.playerName || "Игрок", creatorAvatar: profile.avatarEmoji || "🙂", seriesId, seriesRound, seriesScoreCreator, seriesScoreGuest, pushClientId: profile.settings?.notifications && profile.settings?.challengeReminders !== false ? profile.pushClientId : "" });
  const entry = {
    code: data.code,
    ownerToken: data.ownerToken,
    seed,
    level,
    sourceMode,
    creatorName: profile.playerName || "Игрок",
    creatorAvatar: profile.avatarEmoji || "🙂",
    createdAt: Date.now(),
    expiresAt: data.expiresAt || Date.now() + 7 * 86400000,
    status: "pending",
    creatorResult: null,
    guestResult: null,
    seriesId,
    seriesRound,
    seriesScoreCreator,
    seriesScoreGuest,
    resultSeen: false,
  };
  profile.sentChallenges ||= [];
  profile.sentChallenges.unshift(entry);
  pruneSentChallenges();
  saveProfile();
  track("challenge_created");
  return entry;
}
function challengeShortLink(entryOrCode) {
  const code = normalizeChallengeCode(entryOrCode?.code || entryOrCode);
  const origin = /^https?:$/.test(location.protocol) ? location.origin : "https://solivoc.vercel.app";
  return `${origin.replace(/\/$/, "")}/?c=${code}`;
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
  ctx.font = "900 54px system-ui, sans-serif";
  ctx.fillText(entry.creatorAvatar || profile.avatarEmoji || "🙂", 148, 149);

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#fff";
  ctx.font = "900 54px system-ui, sans-serif";
  ctx.fillText("Словасьянс", 234, 139);
  ctx.fillStyle = "rgba(255,255,255,.72)";
  ctx.font = "700 25px system-ui, sans-serif";
  ctx.fillText(`Дуэль от ${entry.creatorName || "Игрок"}`, 234, 183);

  ctx.fillStyle = "rgba(255,255,255,.72)";
  ctx.font = "800 25px system-ui, sans-serif";
  ctx.fillText("КОД ИСПЫТАНИЯ", 94, 298);
  ctx.fillStyle = "#fff";
  ctx.font = "900 112px ui-monospace, SFMono-Regular, Menlo, monospace";
  ctx.fillText(entry.code, 89, 414);

  ctx.fillStyle = "rgba(255,255,255,.72)";
  ctx.font = "700 25px system-ui, sans-serif";
  ctx.fillText("По коду или по короткой ссылке", 94, 495);
  ctx.font = "800 23px system-ui, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,.58)";
  ctx.fillText(challengeShortLink(entry).replace(/^https?:\/\//, ""), 94, 535);

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
  const link = challengeShortLink(entry),
    text = `Словасьянс — дуэль\nКод: ${entry.code}\n${link}`;
  try {
    const file = await challengeInviteFile(entry);
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      // Do not pass a separate `url`: Telegram and some other apps otherwise
      // create a second message/link preview. The link stays in the image caption.
      await navigator.share({ text, files: [file] });
    } else if (navigator.share && /^https?:$/.test(location.protocol)) {
      await navigator.share({ text });
    } else if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(file);
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1200);
    } else throw new Error("share unavailable");
    showToast(`Дуэль ${entry.code} готова`);
    track("challenge_shared");
    return true;
  } catch (err) {
    if (err?.name === "AbortError") return false;
    window.prompt("Скопируй код и ссылку", text);
    return false;
  }
}
async function shareNewChallenge() {
  try {
    showToast("Создаю дуэль…");
    const entry = await createRemoteChallenge();
    if (hub?.classList.contains("show") && typeof renderHub === "function") renderHub();
    await shareChallengeEntry(entry);
    if (typeof offerNotificationPrompt === "function") offerNotificationPrompt(entry);
    return entry.code;
  } catch (err) {
    console.error("Challenge create:", err);
    showToast(err?.status === 503 ? "Подключи Redis для сетевых дуэлей" : "Не удалось создать дуэль");
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
    seriesId: entry.seriesId, seriesRound: entry.seriesRound, seriesScoreCreator: entry.seriesScoreCreator, seriesScoreGuest: entry.seriesScoreGuest,
    cardSourceMode: normalizeCardSourceMode(entry.sourceMode),
  });
  return true;
}
function playReceivedChallenge(code) {
  const entry = receivedChallengeByCode(code);
  if (!entry || entry.guestResult) return false;
  closeHub?.();
  makeLevel(entry.level, {
    mode: "challenge",
    seed: entry.seed,
    challengeCode: entry.code,
    challengeRole: "guest",
    challengeCreatorName: entry.creatorName || "Друг",
    challengeCreatorAvatar: entry.creatorAvatar || "🙂",
    challengeCreatorResult: entry.creatorResult || null,
    challengeGuestToken: entry.guestToken || null,
    seriesId: entry.seriesId,
    seriesRound: entry.seriesRound,
    seriesScoreCreator: entry.seriesScoreCreator,
    seriesScoreGuest: entry.seriesScoreGuest,
    cardSourceMode: normalizeCardSourceMode(entry.sourceMode),
  });
  return true;
}
async function startChallengeCode(value) {
  const raw = challengeCodeFromValue(value),
    compact = raw.toUpperCase().replace(/[^A-Z0-9]/g, ""),
    shortCode = compact;
  if (compact.length === 6 && SHORT_CHALLENGE_RE.test(shortCode)) {
    try {
      const data = await challengeApi("GET", `?code=${encodeURIComponent(shortCode)}`);
      rememberReceivedChallenge({ code: shortCode, seed: data.seed, level: data.level, sourceMode: data.sourceMode, creatorName: data.creatorName || "Друг", creatorAvatar: data.creatorAvatar || "🙂", seriesId: data.seriesId, seriesRound: data.seriesRound, seriesScoreCreator: data.seriesScoreCreator, seriesScoreGuest: data.seriesScoreGuest, creatorResult: data.creatorResult });
      closeHub?.();
      makeLevel(data.level, {
        mode: "challenge",
        seed: data.seed,
        challengeCode: shortCode,
        challengeRole: "guest",
        challengeCreatorName: data.creatorName || "Друг",
        challengeCreatorAvatar: data.creatorAvatar || "🙂",
        challengeCreatorResult: data.creatorResult || null,
        seriesId: data.seriesId, seriesRound: data.seriesRound, seriesScoreCreator: data.seriesScoreCreator, seriesScoreGuest: data.seriesScoreGuest,
        cardSourceMode: normalizeCardSourceMode(data.sourceMode),
      });
      window.history?.replaceState?.({}, "", location.pathname + location.hash);
      track("challenge_accepted");
      return true;
    } catch (err) {
      console.error("Challenge start:", err);
      showToast(err?.status === 410 || err?.status === 404 ? "Этот код уже сыгран или истёк" : "Не удалось загрузить дуэль");
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
  if (entry.ownerToken) challengeApi("POST", "", { action: "ownerResult", code: entry.code, ownerToken: entry.ownerToken, result: entry.creatorResult }).catch((err)=>console.warn("Owner result sync",err));
}
function recordGuestChallengeLocal(s = state, result = null) {
  if (!s?.challengeCode || s.challengeRole !== "guest") return null;
  const entry = rememberReceivedChallenge({
    code: s.challengeCode,
    seed: s.seed,
    level: s.level,
    sourceMode: s.cardSourceMode,
    creatorName: s.challengeCreatorName || "Друг",
    creatorAvatar: s.challengeCreatorAvatar || "🙂",
    creatorResult: s.challengeCreatorResult || null, guestToken: s.challengeGuestToken || null, seriesId: s.seriesId, seriesRound: s.seriesRound, seriesScoreCreator: s.seriesScoreCreator, seriesScoreGuest: s.seriesScoreGuest,
  });
  if (!entry) return null;
  entry.guestResult = cleanChallengeResult(result || resultForCurrentChallenge(s));
  entry.status = "completed";
  entry.completedAt = entry.guestResult.completedAt || Date.now();
  pruneReceivedChallenges();
  saveProfile();
  return entry;
}
function enqueueGuestChallengeSubmission(s = state, stars = null) {
  if (!s?.challengeCode || s.challengeRole !== "guest") return;
  const submissionId = s.challengeSubmissionId || uid();
  s.challengeSubmissionId = submissionId;
  const result = resultForCurrentChallenge(s, stars),
    item = {
      code: normalizeChallengeCode(s.challengeCode),
      submissionId,
      result,
      pushClientId: profile.settings?.notifications && profile.settings?.challengeReminders !== false ? profile.pushClientId : "",
      createdAt: Date.now(),
    };
  recordGuestChallengeLocal(s, result);
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
      const data = await challengeApi("POST", "", { action: "complete", code: item.code, submissionId: item.submissionId, result: item.result, pushClientId: item.pushClientId || "" }, { keepalive: true });
      profile.pendingChallengeSubmissions = profile.pendingChallengeSubmissions.filter((x) => x.submissionId !== item.submissionId);
      const received = receivedChallengeByCode(item.code);
      if (received) {
        received.synced = true;
        if (data.guestToken) received.guestToken = data.guestToken;
        if (data.creatorResult) received.creatorResult = cleanChallengeResult(data.creatorResult);
        if (data.seriesId) received.seriesId = data.seriesId;
        if (data.seriesRound) received.seriesRound = data.seriesRound;
        if (data.seriesScoreCreator != null) received.seriesScoreCreator = +data.seriesScoreCreator || 0;
        if (data.seriesScoreGuest != null) received.seriesScoreGuest = +data.seriesScoreGuest || 0;
        if (received.guestToken && received.creatorResult) challengeApi("POST","",{action:"ack",code:received.code,guestToken:received.guestToken}).catch(()=>{});
        if (received.creatorResult && typeof finalizeSeriesForEntry === "function") finalizeSeriesForEntry(received,"guest");
        if (received.creatorResult && typeof queueDuelReveal === "function") queueDuelReveal(received,"guest");
      }
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
        const wasNew = !entry.guestResult;
        entry.guestResult = cleanChallengeResult(data.guestResult);
        if (data.creatorResult) entry.creatorResult = cleanChallengeResult(data.creatorResult);
        entry.status = "completed";
        if (wasNew) entry.resultSeen = false;
        changed = true;
        try { await challengeApi("POST", "", { action: "ack", code: entry.code, ownerToken: entry.ownerToken }); } catch {}
        if (typeof finalizeSeriesForEntry === "function") finalizeSeriesForEntry(entry,"creator");
        if (wasNew && typeof queueDuelReveal === "function") queueDuelReveal(entry);
        if (wasNew && notify && typeof queueAchievementNotifications === "function") {
          queueAchievementNotifications([{ icon: "⇄", title: "Друг завершил дуэль", desc: `${entry.code} · ${challengeStarsText(entry.guestResult.stars)} · ${entry.guestResult.moves} ход. · ошибок ${entry.guestResult.errors || 0}` }]);
          if (typeof showSystemNotification === "function") showSystemNotification("Друг завершил дуэль", `${entry.guestResult.playerName || "Друг"}: ${challengeStarsText(entry.guestResult.stars)} · ${entry.guestResult.moves} ходов`, { tag:`challenge-${entry.code}` });
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
    syncDuelStats?.();
    checkAchievements?.();
    saveProfile();
    if (hub?.classList.contains("show") && typeof renderHub === "function" && typeof hubTab !== "undefined" && hubTab === "modes") renderHub();
  }
  return changed;
}
async function refreshReceivedChallenges() {
  const items = (profile.receivedChallenges || []).filter((x)=>x?.guestToken && x?.guestResult && !x.creatorResult).slice(0,12);
  if (!items.length) return false;
  let changed=false;
  for (const entry of items) {
    try {
      const data=await challengeApi("GET",`?code=${encodeURIComponent(entry.code)}&guestToken=${encodeURIComponent(entry.guestToken)}`);
      if (data.creatorResult) {
        entry.creatorResult=cleanChallengeResult(data.creatorResult); changed=true;
        if (typeof finalizeSeriesForEntry === "function") finalizeSeriesForEntry(entry,"guest");
        if (typeof queueDuelReveal === "function") queueDuelReveal(entry,"guest");
        try{await challengeApi("POST","",{action:"ack",code:entry.code,guestToken:entry.guestToken});}catch{}
      }
    } catch(err) { if(err?.status===404||err?.status===410) entry.synced=true; }
  }
  if(changed) {
    syncDuelStats?.();
    checkAchievements?.();
    saveProfile();
    if (hub?.classList.contains("show") && typeof renderHub === "function" && typeof hubTab !== "undefined" && hubTab === "modes") renderHub();
  }
  return changed;
}

function challengeCodeFromUrl() {
  const params = new URLSearchParams(location.search);
  return params.get("c") || params.get("challenge") || "";
}
function migrateLastGuestChallengeHistory() {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (!saved || saved.mode !== "challenge" || saved.challengeRole !== "guest" || !saved.rewarded || !saved.challengeCode || !saved.seed) return;
    const code = normalizeChallengeCode(saved.challengeCode);
    if (!code || receivedChallengeByCode(code)) return;
    const entry = rememberReceivedChallenge({
      code,
      seed: saved.seed,
      level: saved.level,
      sourceMode: saved.cardSourceMode,
      creatorName: saved.challengeCreatorName || "Друг",
      creatorAvatar: saved.challengeCreatorAvatar || "🙂",
    });
    if (!entry) return;
    entry.guestResult = cleanChallengeResult({
      stars: saved.lastStars || 1,
      moves: saved.run?.moves || 0,
      hints: saved.run?.hints || 0,
      errors: saved.run?.errors || 0,
      undos: saved.run?.undos || 0,
      playerName: profile.playerName || "Игрок",
      avatarEmoji: profile.avatarEmoji || "🙂",
      title: titleDefById(profile.titleId)?.name || "",
      rank: playerRank?.(profile)?.name || "",
      featured: (profile.featuredAchievements || []).slice(0,3),
      completedAt: Date.now(),
    });
    entry.status = "completed";
    entry.completedAt = entry.guestResult.completedAt;
    saveProfile();
  } catch {}
}
migrateLastGuestChallengeHistory();


async function shareCurrentResult() {
  if (!state || state.mode === "tutorial") return;
  const stars = Math.max(1, Math.min(3, +(state.lastStars || calculateStars?.() || 1))),
    starText = `${"★".repeat(stars)}${"☆".repeat(3 - stars)}`,
    moves = state.run?.moves || 0,
    hints = state.run?.hints || 0,
    errors = state.run?.errors || 0,
    undos = state.run?.undos || 0;
  let title = `Словасьянс · Уровень ${state.level}`,
    extra = "";
  if (state.mode === "daily") title = `Словасьянс · Ежедневный ${todayKey()}`;
  if (state.mode === "challenge") {
    title = "Словасьянс · Дуэль";
    const code = normalizeChallengeCode(state.challengeCode || "");
    if (code) extra = ` · код ${code}`;
  }
  const text = `${title}\n${starText} · ${moves} ходов · ${hints} подсказок · ${errors} ошибок · ${undos} отмен${extra}`;
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
