/* Retention layer: XP/ranks, daily calendar, category mastery, bonus goals,
   smart home actions, challenge series, result reveal, notifications and splash. */
const XP_PER_LEVEL = 250;
const RANK_DEFS = [
  { xp: 0, name: "Новичок", icon: "◇" },
  { xp: 500, name: "Связист", icon: "⌁" },
  { xp: 1250, name: "Ассоциатор", icon: "✦" },
  { xp: 2500, name: "Исследователь", icon: "◎" },
  { xp: 4500, name: "Эрудит", icon: "▦" },
  { xp: 7500, name: "Мастер", icon: "★" },
  { xp: 11500, name: "Архивариус", icon: "♜" },
  { xp: 17000, name: "Легенда", icon: "♛" },
];

function playerXpLevel(p = profile) {
  return Math.max(1, Math.floor((+p.xp || 0) / XP_PER_LEVEL) + 1);
}
function playerRank(p = profile) {
  const xp = +p.xp || 0;
  return [...RANK_DEFS].reverse().find((r) => xp >= r.xp) || RANK_DEFS[0];
}
function xpLevelProgress(p = profile) {
  const xp = +p.xp || 0,
    level = playerXpLevel(p),
    base = (level - 1) * XP_PER_LEVEL,
    value = xp - base;
  return { level, value, goal: XP_PER_LEVEL, ratio: Math.min(1, value / XP_PER_LEVEL) };
}
function awardXp(amount, reason = "", { notifyRank = true } = {}) {
  amount = Math.max(0, Math.round(+amount || 0));
  if (!amount) return 0;
  const beforeLevel = playerXpLevel(profile), beforeRank = playerRank(profile).name;
  profile.xp = Math.max(0, (+profile.xp || 0) + amount);
  const afterLevel = playerXpLevel(profile), afterRank = playerRank(profile).name;
  if (state?.run) state.run.xpEarned = (state.run.xpEarned || 0) + amount;
  track("xp_awarded", { amount, reason, level: afterLevel });
  saveProfile();
  if (notifyRank && typeof queueAchievementNotifications === "function" && (afterLevel > beforeLevel || afterRank !== beforeRank)) {
    queueAchievementNotifications([{ icon: playerRank(profile).icon, title: `Ранг ${afterLevel} · ${afterRank}`, desc: `+${amount} XP${reason ? ` · ${reason}` : ""}` }]);
  }
  return amount;
}
function retentionSessionStart() {
  profile.retention ||= { lastOpenDate: null, openDays: [], lastSessionAt: 0 };
  const today = todayKey();
  if (!profile.retention.openDays.includes(today)) profile.retention.openDays.push(today);
  if (profile.retention.openDays.length > 90) profile.retention.openDays = profile.retention.openDays.slice(-90);
  const returning = !!profile.retention.lastOpenDate && profile.retention.lastOpenDate !== today;
  profile.retention.lastOpenDate = today;
  profile.retention.lastSessionAt = Date.now();
  track("session_started", { returning, openDays: profile.retention.openDays.length });
  saveProfile();
}

function localDateKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function mondayOfWeek(d = new Date()) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()), day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day);
  return x;
}
function currentDailyWeek() {
  const monday = mondayOfWeek(), days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    days.push(localDateKey(d));
  }
  const completed = new Set(profile.daily?.completedDates || []);
  return { days, count: days.filter((d) => completed.has(d)).length, key: weekKey(todayKey()) };
}
function dailyCalendarMarkup() {
  const labels = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"], today = todayKey(), week = currentDailyWeek(), completed = new Set(profile.daily?.completedDates || []);
  const rewards = profile.daily?.weekRewards?.[week.key] || [];
  return `<section class="daily-calendar"><div class="daily-calendar-head"><div><small>DAILY НЕДЕЛИ</small><b>${week.count}/7 дней</b></div><span>🔥 ${profile.daily.currentStreak || 0}</span></div>
    <div class="daily-days">${week.days.map((key,i)=>`<div class="daily-day ${completed.has(key)?"done":""} ${key===today?"today":""}"><span>${labels[i]}</span><i>${completed.has(key)?"✓":key===today?"•":""}</i></div>`).join("")}</div>
    <div class="daily-milestones">${[[3,50],[5,100],[7,180]].map(([n,xp])=>`<span class="${week.count>=n?"reached":""} ${rewards.includes(n)?"claimed":""}"><b>${n}/7</b><small>+${xp} XP</small></span>`).join("")}</div>
  </section>`;
}
function awardDailyWeekMilestones() {
  const week = currentDailyWeek();
  profile.daily.weekRewards ||= {};
  const claimed = (profile.daily.weekRewards[week.key] ||= []), fresh = [];
  for (const [goal, xp] of [[3,50],[5,100],[7,180]]) {
    if (week.count >= goal && !claimed.includes(goal)) {
      claimed.push(goal);
      awardXp(xp, `Daily ${goal}/7`, { notifyRank: false });
      fresh.push({ icon: "☀", title: `Daily ${goal}/7`, desc: `Недельная награда: +${xp} XP` });
    }
  }
  if (fresh.length && typeof queueAchievementNotifications === "function") queueAchievementNotifications(fresh);
  saveProfile();
  return fresh;
}

function categoryMasteryData(id) {
  const cat = BANK.find((c) => c.id === id), stat = categoryStat(id);
  const known = new Set(stat.words || []), total = cat?.words?.length || 0;
  return { cat, stat, known: known.size, total, ratio: total ? Math.min(1, known.size / total) : 0, mastered: !!stat.masteredAt || (!!total && known.size >= total) };
}
function checkCategoryMastery(id, { notify = true } = {}) {
  const data = categoryMasteryData(id);
  if (!data.cat || !data.total || data.known < data.total || data.stat.masteredAt) return false;
  data.stat.masteredAt = Date.now();
  profile.stats.masteredCategories = (profile.stats.masteredCategories || 0) + 1;
  awardXp(100, `Категория «${data.cat.title}»`, { notifyRank: false });
  track("category_mastered", { category: id });
  saveProfile();
  if (notify && typeof queueAchievementNotifications === "function") {
    queueAchievementNotifications([{ icon: "✦", title: `Освоено: ${data.cat.title}`, desc: `Все ${data.total} слов открыты · +100 XP` }]);
  }
  return true;
}
function nearestMasteryGoal() {
  const discovered = new Set(profile.discovered || []);
  return BANK.map((cat) => categoryMasteryData(cat.id))
    .filter((x) => discovered.has(x.cat.id) && !x.mastered && x.known > 0)
    .sort((a,b)=>b.ratio-a.ratio)[0] || null;
}
function migrateCategoryMasteryProgress() {
  if (profile.masteryMigrated || !BANK.length) return 0;
  let newlyMastered = 0;
  for (const cat of BANK) {
    const stat = categoryStat(cat.id), known = new Set(stat.words || []);
    if (cat.words?.length && cat.words.every((word) => known.has(word)) && !stat.masteredAt) {
      stat.masteredAt = Date.now();
      newlyMastered++;
    }
  }
  profile.stats.masteredCategories = BANK.filter((cat) => !!categoryStat(cat.id).masteredAt).length;
  profile.masteryMigrated = true;
  if (newlyMastered) {
    awardXp(newlyMastered * 100, `Освоено категорий: ${newlyMastered}`, { notifyRank: false });
    queueAchievementNotifications?.([{ icon:"▦", title:"Мастерство категорий", desc:`Засчитан прежний прогресс: ${newlyMastered} освоено · +${newlyMastered*100} XP` }]);
  }
  saveProfile();
  return newlyMastered;
}

function assignBonusObjective(s) {
  if (!s || s.mode === "tutorial" || s.mode === "calm") return null;
  if (s.bonusObjective) return s.bonusObjective;
  const cards = typeof allCards === "function" ? allCards(s).length : (s.totalCategories || 4) * 6,
    choice = hashSeed(`${s.seed}:bonus`) % 4,
    defs = [
      { id: "clean", icon: "◎", title: "Без ошибок", desc: "Заверши расклад без неверных ходов" },
      { id: "recycle", icon: "↻", title: "С первого круга", desc: "Не возвращай сброс обратно в колоду" },
      { id: "moves", icon: "↯", title: "Точный маршрут", desc: "Уложись в лимит ходов", target: Math.max(24, Math.ceil(cards * 2.15)) },
      { id: "lowHints", icon: "✦", title: "Почти самостоятельно", desc: "Используй не больше одной подсказки", target: 1 },
    ];
  s.bonusObjective = { ...defs[choice], awarded: false };
  return s.bonusObjective;
}
function bonusObjectiveAchieved(s = state) {
  const b = s?.bonusObjective;
  if (!b) return false;
  if (b.id === "clean") return (s.run?.errors || 0) === 0;
  if (b.id === "recycle") return (s.run?.recycles || 0) === 0;
  if (b.id === "moves") return (s.run?.moves || 0) <= b.target;
  if (b.id === "lowHints") return (s.run?.hints || 0) <= 1;
  return false;
}
function bonusObjectiveStatus(s = state) {
  const b = s?.bonusObjective;
  if (!b) return "";
  if (b.id === "moves") return `${s.run?.moves || 0}/${b.target} ходов`;
  if (b.id === "clean") return `${s.run?.errors || 0} ошибок`;
  if (b.id === "recycle") return `${s.run?.recycles || 0} прокруток`;
  if (b.id === "lowHints") return `${s.run?.hints || 0}/1 подсказок`;
  return "";
}
function awardBonusObjective(s = state) {
  const b = s?.bonusObjective;
  if (!b || b.awarded || !bonusObjectiveAchieved(s)) return false;
  b.awarded = true;
  profile.stats.bonusObjectivesCompleted = (profile.stats.bonusObjectivesCompleted || 0) + 1;
  awardXp(35, b.title, { notifyRank: false });
  track("bonus_objective_completed", { id: b.id, mode: s.mode });
  return true;
}
function bonusObjectiveMarkup(s = state) {
  const b = s?.bonusObjective;
  if (!b) return "";
  const failed = (b.id === "clean" && (s.run?.errors || 0) > 0) || (b.id === "recycle" && (s.run?.recycles || 0) > 0) || (b.id === "moves" && (s.run?.moves || 0) > b.target) || (b.id === "lowHints" && (s.run?.hints || 0) > 1);
  return `<span class="bonus-objective-chip ${failed?"failed":""}">${b.icon} ${b.title}<small>${bonusObjectiveStatus(s)}</small></span>`;
}

function nearGoalCandidates() {
  const goals = [], xp = xpLevelProgress(), rank = playerRank();
  goals.push({ id: "xp", icon: rank.icon, title: `Ранг ${xp.level + 1}`, desc: `Ещё ${xp.goal - xp.value} XP`, ratio: xp.ratio });
  const nt = typeof nextTheme === "function" ? nextTheme() : null;
  if (nt) goals.push({ id: "theme", icon: "✦", title: `Тема ${nt.name}`, desc: `Ещё ${Math.max(0, nt.stars - profile.totalStars)} ★`, ratio: Math.min(1, profile.totalStars / nt.stars) });
  const chapter = chapterInfo(profile.currentLevel || 1), stars = chapterStarsForProfile(profile, chapter.number).reduce((a,b)=>a+b,0);
  if (stars < 30) goals.push({ id: "chapter", icon: "◆", title: `Глава ${chapter.number}`, desc: `До идеала: ${30-stars} ★`, ratio: stars/30 });
  const nearAchievement = ACHIEVEMENTS.map((a)=>({a,p:achievementProgressData(a,profile)})).filter((x)=>x.p&&!profile.achievements.includes(x.a.id)&&x.p.value>0).sort((a,b)=>(b.p.value/b.p.goal)-(a.p.value/a.p.goal))[0];
  if (nearAchievement) goals.push({ id:`achievement:${nearAchievement.a.id}`, icon:nearAchievement.a.icon, title:nearAchievement.a.title, desc:`${nearAchievement.p.value}/${nearAchievement.p.goal}`, ratio:nearAchievement.p.value/nearAchievement.p.goal });
  const mastery = nearestMasteryGoal();
  if (mastery) goals.push({ id:`mastery:${mastery.cat.id}`, icon:"▦", title:`Освоить «${mastery.cat.title}»`, desc:`Осталось ${mastery.total-mastery.known} слов`, ratio:mastery.ratio });
  return goals.sort((a,b)=>b.ratio-a.ratio);
}
function nearGoalsMarkup(limit = 2) {
  const goals = nearGoalCandidates().slice(0, limit);
  if (!goals.length) return "";
  return `<section class="near-goals"><div class="near-goals-head"><b>Совсем близко</b><span>ещё одна причина сыграть</span></div>${goals.map((g)=>`<div class="near-goal"><i>${g.icon}</i><div><b>${g.title}</b><span>${g.desc}</span><em><u style="width:${Math.round(g.ratio*100)}%"></u></em></div></div>`).join("")}</section>`;
}

function unseenDuelEntry() {
  return (profile.sentChallenges || []).find((x)=>x.guestResult && !x.resultSeen) || null;
}
function smartHomeAction() {
  const duel = unseenDuelEntry();
  if (duel) return { kind:"duel", icon:"⚔", eyebrow:"ДРУГ ОТВЕТИЛ", title:`${duel.guestResult.playerName || "Друг"} сыграл вызов`, desc:`${duel.code} · результат готов к раскрытию`, button:"Посмотреть результат", code:duel.code };
  const dailyDone = profile.daily.completedDates.includes(todayKey());
  if (!dailyDone) return { kind:"daily", icon:"☀", eyebrow:"СЕГОДНЯ", title:"Daily ждёт тебя", desc:"Один расклад для всех игроков · поддержи серию", button:"Играть Daily" };
  const w = weeklyProgress();
  if (!w.completed && w.ratio >= .65) return { kind:"weekly", icon:w.def.icon, eyebrow:"ПОЧТИ ГОТОВО", title:w.def.title, desc:`${w.value}/${w.goal} · осталось ${w.goal-w.value}`, button:"Продолжить" };
  const next = profile.currentLevel || 1, inChapter = ((next-1)%CHAPTER_SIZE)+1;
  if (inChapter >= 9) return { kind:"chapter", icon:"◆", eyebrow:"ФИНАЛ ГЛАВЫ БЛИЗКО", title:`Уровень ${next} · ${chapterInfo(next).title}`, desc:inChapter===10?"Финальный расклад с особым правилом":"До финала остался один уровень", button:inChapter===10?"Начать финал":"Продолжить" };
  return { kind:"continue", icon:"▶", eyebrow:"ПРОДОЛЖИТЬ", title:`Уровень ${next}`, desc:`Глава ${chapterInfo(next).number} · ${chapterInfo(next).title}`, button:"Играть" };
}
function smartHomeMarkup() {
  const a = smartHomeAction();
  return `<section class="smart-action smart-${a.kind}" data-smart-kind="${a.kind}" ${a.code?`data-smart-code="${a.code}"`:""}><div class="smart-icon">${a.icon}</div><div class="smart-copy"><small>${a.eyebrow}</small><b>${a.title}</b><span>${a.desc}</span></div><button id="smartAction">${a.button}</button></section>`;
}
function runSmartHomeAction() {
  const a = smartHomeAction();
  if (a.kind === "duel") {
    const entry = ownedChallengeByCode(a.code);
    if (entry) showDuelReveal(entry, "creator");
    return;
  }
  closeHub?.();
  if (a.kind === "daily") return makeLevel(0,{mode:"daily",seed:`daily:${todayKey()}`});
  return makeLevel(profile.currentLevel||1,{mode:"regular"});
}

function challengeOutcome(me, friend) {
  if (!me || !friend) return 0;
  const pairs = [
    [me.stars, friend.stars, 1],
    [friend.moves, me.moves, 1],
    [friend.errors || 0, me.errors || 0, 1],
    [friend.hints || 0, me.hints || 0, 1],
    [friend.undos || 0, me.undos || 0, 1],
  ];
  for (const [a,b] of pairs) if (a !== b) return a > b ? 1 : -1;
  return 0;
}
function resolvedSeriesScore(entry) {
  let creator = +(entry?.seriesScoreCreator || 0), guest = +(entry?.seriesScoreGuest || 0);
  if (entry?.creatorResult && entry?.guestResult) {
    const outcome = challengeOutcome(entry.creatorResult, entry.guestResult);
    if (outcome > 0) creator++;
    else if (outcome < 0) guest++;
  }
  return { creator, guest };
}
function seriesLabel(entry, perspective = "creator") {
  if (!entry) return "";
  const score = resolvedSeriesScore(entry), me = perspective === "guest" ? score.guest : score.creator, friend = perspective === "guest" ? score.creator : score.guest;
  const round = entry.seriesRound || 1;
  return `Серия до 2 побед · ${me}:${friend} · раунд ${round}`;
}
function finalizeSeriesForEntry(entry, perspective = "creator") {
  if (!entry?.creatorResult || !entry?.guestResult || entry.seriesAwarded) return false;
  const score = resolvedSeriesScore(entry), mine = perspective === "guest" ? score.guest : score.creator;
  if (Math.max(score.creator,score.guest) < 2) return false;
  entry.seriesAwarded = true;
  if (mine >= 2) {
    profile.stats.seriesWins = (profile.stats.seriesWins || 0) + 1;
    awardXp(120,"Победа в серии",{notifyRank:false});
  }
  saveProfile();
  checkAchievements?.();
  return true;
}
function rematchMeta(entry, perspective = "creator") {
  const score = resolvedSeriesScore(entry), finished = Math.max(score.creator,score.guest) >= 2;
  if (finished) return { seriesId:`series:${Date.now().toString(36)}:${Math.random().toString(36).slice(2,6)}`, seriesRound:1, seriesScoreCreator:0, seriesScoreGuest:0 };
  const creator = perspective === "guest" ? score.guest : score.creator, guest = perspective === "guest" ? score.creator : score.guest;
  return { seriesId:entry.seriesId || `series:${Date.now().toString(36)}`, seriesRound:(entry.seriesRound||1)+1, seriesScoreCreator:creator, seriesScoreGuest:guest };
}
async function createChallengeRematch(entry, perspective = "creator") {
  if (!entry) return null;
  try {
    showToast("Создаю реванш…");
    const next = await createRemoteChallenge(rematchMeta(entry,perspective));
    if (hub?.classList.contains("show")) renderHub?.();
    await shareChallengeEntry(next);
    return next;
  } catch (err) {
    console.error("Rematch:",err);
    showToast("Не удалось создать реванш");
    return null;
  }
}

let pendingDuelRevealCode = null, pendingDuelRevealPerspective = "creator";
function duelOutcomeText(entry, perspective = "creator") {
  const me = perspective === "guest" ? entry.guestResult : entry.creatorResult,
    friend = perspective === "guest" ? entry.creatorResult : entry.guestResult,
    result = challengeOutcome(me,friend);
  if (result > 0) return { icon:"🏆", title:"Победа!", cls:"win" };
  if (result < 0) return { icon:"⚔", title:"В этот раз сильнее друг", cls:"lose" };
  return { icon:"＝", title:"Ничья", cls:"draw" };
}
function queueDuelReveal(entry, perspective = "creator") {
  if (!entry?.code || entry.resultSeen) return;
  pendingDuelRevealCode = entry.code;
  pendingDuelRevealPerspective = perspective === "guest" ? "guest" : "creator";
}
function showDuelReveal(entry, perspective = "creator") {
  if (!entry?.creatorResult || !entry?.guestResult) return false;
  const modalEl = $("#duelResultModal"), outcome = duelOutcomeText(entry,perspective),
    me = perspective === "guest" ? entry.guestResult : entry.creatorResult,
    friend = perspective === "guest" ? entry.creatorResult : entry.guestResult,
    friendName = perspective === "guest" ? (entry.creatorName || "Друг") : (entry.guestResult.playerName || "Друг");
  if (!modalEl) return false;
  $("#duelResultIcon").textContent = outcome.icon;
  $("#duelResultTitle").textContent = outcome.title;
  $("#duelResultSeries").textContent = seriesLabel(entry,perspective);
  $("#duelMe").innerHTML = challengeResultMarkup("Ты",me);
  $("#duelFriend").innerHTML = challengeResultMarkup(friendName,friend);
  const score = resolvedSeriesScore(entry), mine = perspective === "guest" ? score.guest : score.creator, theirs = perspective === "guest" ? score.creator : score.guest;
  $("#duelScore").textContent = `${mine} : ${theirs}`;
  const rematch = $("#duelRematch");
  rematch.textContent = Math.max(score.creator,score.guest)>=2 ? "Новая серия ⇄" : "Реванш ⇄";
  rematch.onclick = ()=>{ modalEl.classList.remove("show"); modalEl.setAttribute("aria-hidden","true"); createChallengeRematch(entry,perspective); };
  modalEl.className = `duel-result-modal ${outcome.cls}`;
  modalEl.setAttribute("aria-hidden","false");
  requestAnimationFrame(()=>modalEl.classList.add("show"));
  entry.resultSeen = true;
  pendingDuelRevealCode = null;
  pendingDuelRevealPerspective = "creator";
  finalizeSeriesForEntry(entry,perspective);
  saveProfile();
  playSfx?.("win",.7);
  haptic?.([12,24,16]);
  return true;
}
function showPendingDuelReveal() {
  if (pendingDuelRevealCode) {
    const entry = pendingDuelRevealPerspective === "guest" ? receivedChallengeByCode(pendingDuelRevealCode) : ownedChallengeByCode(pendingDuelRevealCode);
    if (entry) return showDuelReveal(entry, pendingDuelRevealPerspective);
  }
  const entry = unseenDuelEntry();
  if (entry) return showDuelReveal(entry,"creator");
  return false;
}

function ensurePushClientId() {
  if (!profile.pushClientId) profile.pushClientId = `p_${uid().replace(/[^a-zA-Z0-9_-]/g,"").slice(0,36)}`;
  saveProfile();
  return profile.pushClientId;
}
function base64UrlToUint8Array(value) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4), base64 = (value + padding).replace(/-/g,"+").replace(/_/g,"/");
  const raw = atob(base64), out = new Uint8Array(raw.length);
  for (let i=0;i<raw.length;i++) out[i]=raw.charCodeAt(i);
  return out;
}
async function pushApi(body) {
  const res = await fetch("/api/push",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body),cache:"no-store"});
  const data = await res.json().catch(()=>({}));
  if (!res.ok) { const err=new Error(data.message||data.error||`Push ${res.status}`); err.status=res.status; throw err; }
  return data;
}
function pushStatePayload() {
  const w = weeklyProgress();
  return {
    clientId:ensurePushClientId(),
    timezoneOffset:new Date().getTimezoneOffset(),
    playerName:profile.playerName||"Игрок",
    dailyDoneKey:profile.daily.completedDates.includes(todayKey())?todayKey():"",
    weeklyKey:profile.weekly?.key||weekKey(todayKey()),
    weeklyCompleted:!!w.completed,
    preferences:{daily:profile.settings.dailyReminders!==false,weekly:profile.settings.weeklyReminders!==false},
  };
}
async function registerPushNotifications(challengeEntry = null) {
  if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window) || !/^https?:$/.test(location.protocol)) {
    showToast("Push-уведомления недоступны в этом браузере");
    return false;
  }
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    profile.settings.notifications = false;
    saveProfile();
    return false;
  }
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    const keyRes = await fetch("/api/push?action=key",{cache:"no-store"}), keyData = await keyRes.json();
    if (!keyRes.ok || !keyData.publicKey) throw new Error("VAPID key is not configured");
    sub = await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:base64UrlToUint8Array(keyData.publicKey)});
  }
  profile.settings.notifications = true;
  saveProfile();
  await pushApi({action:"register",...pushStatePayload(),subscription:sub.toJSON()});
  if (challengeEntry?.code && challengeEntry.ownerToken) {
    await challengeApi("POST","",{action:"attachPush",code:challengeEntry.code,ownerToken:challengeEntry.ownerToken,pushClientId:profile.pushClientId});
  }
  showToast("Уведомления включены");
  return true;
}
async function syncPushState() {
  if (!("Notification" in window) || !profile.settings.notifications || Notification.permission !== "granted") return false;
  try { await pushApi({action:"sync",...pushStatePayload()}); return true; } catch { return false; }
}
async function disablePushNotifications() {
  try {
    const reg = await navigator.serviceWorker.ready, sub = await reg.pushManager.getSubscription();
    await sub?.unsubscribe();
    if (profile.pushClientId) await pushApi({action:"unregister",clientId:profile.pushClientId});
  } catch {}
  profile.settings.notifications = false;
  saveProfile();
}
async function showSystemNotification(title, body, data = {}) {
  if (!("Notification" in window) || !profile.settings.notifications || Notification.permission !== "granted") return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification(title,{body,icon:"./icons/icon-192.png",badge:"./icons/icon-192.png",tag:data.tag||"worditaire",data:{url:"./",...data}});
    return true;
  } catch { return false; }
}
let notificationChallengeEntry = null;
function offerNotificationPrompt(entry = null) {
  if (!("Notification" in window) || Notification.permission !== "default" || profile.settings.notificationPrompted) return;
  notificationChallengeEntry = entry;
  $("#notificationPrompt")?.classList.add("show");
}

function chapterFrameFor(number) {
  return FRAME_DEFS.find((f)=>f.chapter===number) || FRAME_DEFS[0];
}
function rewardChapterFinal(s, firstClear) {
  if (!firstClear || !s?.special?.boss) return false;
  const chapter = chapterInfo(s.level).number;
  profile.stats.chapterFinalsCompleted = (profile.stats.chapterFinalsCompleted || 0) + 1;
  const frame = chapterFrameFor(chapter);
  awardXp(120,`Финал главы ${chapter}`,{notifyRank:false});
  if (frame?.id && frame.id !== "none") profile.frame = frame.id;
  if (typeof queueAchievementNotifications === "function") queueAchievementNotifications([{icon:"◆",title:`Глава ${chapter} завершена`,desc:`Открыта рамка «${frame?.name || chapterInfo(s.level).title}» · +120 XP`}]);
  return true;
}

function frameTilesMarkup() {
  return FRAME_DEFS.map((f)=>{const unlocked=frameUnlocked(f), selected=profile.frame===f.id;return `<button class="frame-tile ${unlocked?"":"locked"} ${selected?"selected":""}" data-frame-id="${f.id}" style="--frame-h:${f.hue}"><i>◇</i><b>${f.name}</b><span>${unlocked?(selected?"Выбрано":"Открыто"):(`Глава ${f.chapter}`)}</span></button>`;}).join("");
}

function bindRetentionUi() {
  const closeDuel=$("#duelClose"); if(closeDuel) closeDuel.onclick=()=>{$("#duelResultModal")?.classList.remove("show"); $("#duelResultModal")?.setAttribute("aria-hidden","true");};
  const allow=$("#notificationAllow"); if(allow) allow.onclick=async()=>{ $("#notificationPrompt")?.classList.remove("show"); profile.settings.notificationPrompted=true; saveProfile(); try{await registerPushNotifications(notificationChallengeEntry);}catch(err){console.error(err);showToast("Не удалось включить push");} notificationChallengeEntry=null; };
  const later=$("#notificationLater"); if(later) later.onclick=()=>{$("#notificationPrompt")?.classList.remove("show");profile.settings.notificationPrompted=true;saveProfile();notificationChallengeEntry=null;};
  const retry=$("#splashRetry"); if(retry) retry.onclick=()=>location.reload();
}

const SPLASH_STARTED_AT = performance.now();
function setSplashProgress(percent, text = "") {
  const bar=$("#splashBar"), label=$("#splashStatus");
  if(bar) bar.style.width=`${Math.max(4,Math.min(100,percent))}%`;
  if(label&&text) label.textContent=text;
}
function hideSplash() {
  const splash=$("#splash"); if(!splash) return;
  setSplashProgress(100,"Готово");
  const delay=Math.max(0,650-(performance.now()-SPLASH_STARTED_AT));
  setTimeout(()=>{splash.classList.add("hide");setTimeout(()=>splash.remove(),520);},delay);
}
function showSplashError(message="Не удалось загрузить игру") {
  const splash=$("#splash"); if(!splash) return;
  splash.classList.add("error");
  $("#splashStatus").textContent=message;
  $("#splashRetry").hidden=false;
}
