/* Retention layer: XP/ranks, daily calendar, category mastery, bonus goals,
   smart home actions, challenge series, result reveal, notifications and splash. */
const RANK_DEFS = [
  { level: 1, name: "Новичок", icon: "◇" },
  { level: 5, name: "Связист", icon: "⌁" },
  { level: 10, name: "Ассоциатор", icon: "✦" },
  { level: 20, name: "Исследователь", icon: "◎" },
  { level: 30, name: "Эрудит", icon: "▦" },
  { level: 40, name: "Мастер", icon: "★" },
  { level: 50, name: "Архивариус", icon: "♜" },
  { level: 75, name: "Легенда", icon: "♛" },
];

function playerXpLevel(p = profile) {
  return rankLevelFromXp(+p.xp || 0);
}
function playerRank(p = profile) {
  const level = playerXpLevel(p);
  return [...RANK_DEFS].reverse().find((r) => level >= r.level) || RANK_DEFS[0];
}
function xpLevelProgress(p = profile) {
  const xp = Math.max(0, +p.xp || 0),
    level = playerXpLevel(p),
    base = xpThresholdForRank(level),
    goal = xpNeededForRankUp(level),
    value = Math.max(0, xp - base);
  return { level, value, goal, ratio: Math.min(1, value / Math.max(1, goal)), totalToNext: Math.max(0, base + goal - xp) };
}
function rankLevelReward(level, p = profile) {
  const avatar = rankRewardAvatar?.(level) || null,
    levelXp = xpThresholdForRank(level),
    prevXp = xpThresholdForRank(Math.max(1, level - 1)),
    title = TITLE_DEFS.find((x) => x.minXp && x.minXp > prevXp && x.minXp <= levelXp) || null;
  return { level, avatar, title };
}
function rankRewardsRoadmapMarkup(limit = 5) {
  const xp = xpLevelProgress(profile), start = xp.level + 1, rows = [];
  for (let level = start; level < start + limit; level++) {
    const reward = rankLevelReward(level), icons = [reward.avatar, reward.title?.icon].filter(Boolean);
    rows.push(`<div class="rank-roadmap-item"><span class="rank-roadmap-level">${level}</span><span class="rank-roadmap-icons">${icons.length ? icons.map((x)=>`<i>${escapeHtml(x)}</i>`).join("") : `<i>✦</i>`}</span><span><b>${reward.title ? `Титул «${escapeHtml(reward.title.name)}»` : reward.avatar ? "Новый аватар" : "Новый ранг"}</b><small>${level === start ? `через ${xp.goal - xp.value} XP` : `${Math.max(0, xpThresholdForRank(level) - (+profile.xp || 0))} XP`}</small></span></div>`);
  }
  return `<section class="hub-section rank-roadmap"><div class="hub-section-head"><div><h3>Награды за ранг</h3><small>что откроется дальше</small></div><strong>Ранг ${xp.level}</strong></div><div class="rank-roadmap-list">${rows.join("")}</div></section>`;
}
function loginRewardDays(p = profile) {
  const retentionDays = Math.max(0, +(p?.retention?.totalOpenDays || 0));
  const openDays = Array.isArray(p?.retention?.openDays) ? p.retention.openDays.length : 0;
  const dailyDays = Array.isArray(p?.daily?.completedDates) ? p.daily.completedDates.length : 0;
  const streak = Math.max(0, +(p?.daily?.bestStreak || 0), +(p?.daily?.currentStreak || 0));
  return Math.max(retentionDays, openDays, dailyDays, streak);
}
function loginRewardsMarkup() {
  const days = loginRewardDays(profile);
  if (profile.retention) profile.retention.totalOpenDays = Math.max(profile.retention.totalOpenDays || 0, days);
  const next = LOGIN_REWARD_DEFS.find((reward) => days < reward.days);
  return `<section class="hub-section login-rewards"><div class="hub-section-head"><div><h3>Награды за входы</h3><small>считаются разные дни, а не серия подряд</small></div><strong>${ruCount(days, "день", "дня", "дней")}</strong></div><div class="login-reward-grid">${LOGIN_REWARD_DEFS.map((reward)=>{const done=days>=reward.days, left=Math.max(0,reward.days-days);return `<div class="login-reward ${done?"done":""}"><i>${reward.emoji}</i><span><b>${reward.title}</b><small>${done?`Аватар ${reward.emoji} получен ✓`:`Аватар ${reward.emoji} · ещё ${ruCount(left, "день", "дня", "дней")}`}</small></span></div>`;}).join("")}</div>${next?`<p class="login-next">Следующая награда через <b>${ruCount(next.days-days, "день", "дня", "дней")}</b></p>`:`<p class="login-next complete">Все награды за входы открыты ✓</p>`}</section>`;
}

function awardXp(amount, reason = "", { notifyRank = true } = {}) {
  amount = Math.max(0, Math.round(+amount || 0));
  const bday = typeof birthdayWeekInfo === "function" ? birthdayWeekInfo(profile) : { active: false };
  if (bday.active) amount += Math.max(1, Math.round(amount * 0.15));
  if (!amount) return 0;
  const beforeLevel = playerXpLevel(profile), beforeRankDef = playerRank(profile), beforeXp = +profile.xp || 0;
  profile.xp = Math.max(0, beforeXp + amount);
  const afterLevel = playerXpLevel(profile), afterRankDef = playerRank(profile);
  if (state?.run) state.run.xpEarned = (state.run.xpEarned || 0) + amount;
  track("xp_awarded", { amount, reason, level: afterLevel });
  if (afterLevel > beforeLevel) {
    const pendingFrom = Math.min(profile.pendingRankUp?.fromLevel || beforeLevel, beforeLevel);
    const avatars = [];
    for (let level = pendingFrom + 1; level <= afterLevel; level++) {
      const reward = rankRewardAvatar?.(level);
      if (reward) avatars.push(reward);
    }
    const rankChanged = afterRankDef.name !== beforeRankDef.name;
    const newlyUnlockedTitle = rankChanged
      ? TITLE_DEFS.find((x) => x.minXp && x.name === afterRankDef.name && profile.xp >= x.minXp)?.id || null
      : null;
    const previousPending = profile.pendingRankUp || {};
    profile.pendingRankUp = {
      fromLevel: pendingFrom,
      level: afterLevel,
      rankName: afterRankDef.name,
      rankIcon: afterRankDef.icon,
      avatars: [...new Set([...(previousPending.avatars || []), ...avatars])],
      titleReward: newlyUnlockedTitle || previousPending.titleReward || null,
      reason,
      createdAt: Date.now(),
    };
    track("rank_up", { from: beforeLevel, to: afterLevel, rank: afterRankDef.name });
  }
  saveProfile();
  renderGlobalProfileHeaders?.();
  return amount;
}

let pendingRankContinuation = null;
function showRankUpThen(action) {
  if (typeof action !== "function") action = () => {};
  if (!profile.pendingRankUp) return action();
  pendingRankContinuation = action;
  // Rank-up is a post-level reward. Give the victory dialog time to leave,
  // so this reward can never visually interrupt the board or the win screen.
  setTimeout(() => {
    if (!pendingRankContinuation) return;
    if (!showPendingRankUp()) {
      const next = pendingRankContinuation;
      pendingRankContinuation = null;
      next?.();
    }
  }, 240);
}
function closeRankUpModal() {
  const modal = $("#rankUpModal");
  if (!modal) return;
  modal.classList.remove("show");
  modal.setAttribute("aria-hidden", "true");
  profile.pendingRankUp = null;
  saveProfile();
  const next = pendingRankContinuation;
  pendingRankContinuation = null;
  if (next) setTimeout(next, 120);
}
function showPendingRankUp() {
  const data = profile.pendingRankUp, modal = $("#rankUpModal");
  if (!data || !modal) return false;
  const currentLevel = playerXpLevel(profile), age = Math.max(0, Date.now() - (+data.createdAt || 0));
  if (!(+data.fromLevel >= 1) || !(+data.level > +data.fromLevel) || +data.level !== currentLevel || age > 12 * 60 * 60 * 1000) {
    profile.pendingRankUp = null;
    saveProfile();
    return false;
  }
  if ($("#modal")?.classList.contains("show") || $("#duelResultModal")?.classList.contains("show") || $("#onboardingModal")?.classList.contains("show")) return false;
  $("#rankUpNumber").textContent = `Ранг ${data.level}`;
  $("#rankUpName").textContent = data.rankName || playerRank(profile).name;
  const rewards = [];
  if (data.avatars?.length) rewards.push(`<div class="rank-reward"><i>${data.avatars.at(-1)}</i><span><b>Новый аватар</b><small>${data.avatars.length > 1 ? `Новых аватаров: ${data.avatars.length}` : "Доступен в профиле"}</small></span></div>`);
  if (data.titleReward) {
    const title = titleDefById(data.titleReward);
    if (title) rewards.push(`<div class="rank-reward"><i>${title.icon}</i><span><b>Новый титул «${escapeHtml(title.name)}»</b><small>Можно выбрать в профиле</small></span></div>`);
  }
  if (!rewards.length) rewards.push(`<div class="rank-reward"><i>${data.rankIcon || "✦"}</i><span><b>Новый уровень профиля</b><small>Продолжай собирать XP до следующей награды</small></span></div>`);
  $("#rankUpRewards").innerHTML = rewards.join("");
  modal.classList.add("show");
  modal.setAttribute("aria-hidden", "false");
  playSfx?.("star", .95);
  confettiRain?.(false);
  haptic?.([12,20,18]);
  $("#rankUpClose").onclick = closeRankUpModal;
  modal.onclick = (e) => { if (e.target === modal) closeRankUpModal(); };
  return true;
}
function retentionSessionStart() {
  profile.retention ||= { lastOpenDate: null, openDays: [], lastSessionAt: 0 };
  const today = todayKey();
  if (!profile.retention.firstOpenAt) { profile.retention.firstOpenAt = Date.now(); track("first_open"); }
  else {
    const first = new Date(profile.retention.firstOpenAt), firstKey = localDateKey(first), age = daysBetween(firstKey, today);
    if (age === 1 && !profile.retention.d1Tracked) { profile.retention.d1Tracked = true; track("retention_d1"); }
    if (age >= 7 && !profile.retention.d7Tracked) { profile.retention.d7Tracked = true; track("retention_d7"); }
  }
  const firstOpenToday = !profile.retention.openDays.includes(today);
  if (firstOpenToday) {
    profile.retention.openDays.push(today);
    profile.retention.totalOpenDays = Math.max(+profile.retention.totalOpenDays || 0, profile.retention.openDays.length - 1) + 1;
  }
  profile.retention.totalOpenDays = Math.max(profile.retention.totalOpenDays || 0, loginRewardDays(profile));
  if (profile.retention.openDays.length > 120) profile.retention.openDays = profile.retention.openDays.slice(-120);
  const returning = !!profile.retention.lastOpenDate && profile.retention.lastOpenDate !== today;
  profile.retention.lastOpenDate = today;
  profile.retention.lastSessionAt = Date.now();
  track("session_started", { returning, openDays: profile.retention.totalOpenDays || profile.retention.openDays.length });
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
  return `<section class="daily-calendar"><div class="daily-calendar-head"><div><small>ЕЖЕДНЕВНАЯ СЕРИЯ</small><b>${week.count}/7 дней</b></div><span>🔥 ${profile.daily.currentStreak || 0}</span></div>
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
      awardXp(xp, `Ежедневный ${goal}/7`, { notifyRank: false });
      fresh.push({ icon: "☀", title: `Ежедневный ${goal}/7`, desc: `Недельная награда: +${xp} XP` });
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
    queueAchievementNotifications([{ icon: "✦", title: `Освоено: ${data.cat.title}`, desc: `Открыто: ${ruCount(data.total, "слово", "слова", "слов")} · +100 XP` }]);
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
    queueAchievementNotifications?.([{ icon:"▦", title:"Мастерство категорий", desc:`Засчитан прежний прогресс: ${ruCount(newlyMastered, "категория", "категории", "категорий")} · +${newlyMastered*100} XP` }]);
  }
  saveProfile();
  return newlyMastered;
}

const DAILY_QUEST_POOL = Object.freeze([
  ["regular","Обычный"], ["marathon","Марафон"], ["zen","Дзен"], ["pictures","Картинки"],
  ["time","На время"], ["moves","На ходы"], ["combo","На комбо"], ["noMistakes","Без ошибок"], ["onePass","Один проход"],
].map(([id,label]) => ({ id, label, target:5, rewardXp:40 })));
function dailyQuestDefinitions(date = todayKey()) {
  const rng = makeRng(`daily-quests:${date}`), pool = shuffle(DAILY_QUEST_POOL, rng);
  return pool.slice(0, 3);
}
function normalizeDailyQuests() {
  const today=todayKey(); profile.dailyQuests ||= {date:"",modes:[],progress:{},rewarded:{}};
  if (profile.dailyQuests.date !== today) {
    profile.dailyQuests={date:today,modes:dailyQuestDefinitions(today).map((x)=>x.id),progress:{},rewarded:{}};
  }
  const allowed=new Set(DAILY_QUEST_POOL.map((x)=>x.id)), modes=Array.isArray(profile.dailyQuests.modes)?profile.dailyQuests.modes:[];
  if (modes.length !== 3 || new Set(modes).size !== 3 || modes.some((id)=>!allowed.has(id))) profile.dailyQuests.modes=dailyQuestDefinitions(today).map((x)=>x.id);
  const selected=new Set(profile.dailyQuests.modes), defs=new Map(DAILY_QUEST_POOL.map((x)=>[x.id,x]));
  profile.dailyQuests.progress=Object.fromEntries([...selected].map((id)=>[id,Math.max(0,Math.min(defs.get(id)?.target||5,+profile.dailyQuests.progress?.[id]||0))]));
  profile.dailyQuests.rewarded=Object.fromEntries([...selected].map((id)=>[id,!!profile.dailyQuests.rewarded?.[id]]));
  return profile.dailyQuests;
}
function activeDailyQuestDefs() {
  const q=normalizeDailyQuests(), map=new Map(DAILY_QUEST_POOL.map((x)=>[x.id,x]));
  return q.modes.map((id)=>map.get(id)).filter(Boolean);
}
function dailyQuestModeForState(s=state) {
  if (!s) return "regular";
  if (s.mode === "collection") return "pictures";
  if (s.mode === "calm") return "zen";
  return s.mode || "regular";
}
function recordDailyModeGame(s=state) {
  if (!s || s.failed || s.mode === "challenge" || s.mode === "tutorial" || s.run?.dailyQuestCounted) return;
  const q=normalizeDailyQuests(), id=dailyQuestModeForState(s), def=activeDailyQuestDefs().find(x=>x.id===id); if(!def) return;
  if (s.run) s.run.dailyQuestCounted = true;
  q.progress[id]=Math.min(def.target,(+q.progress[id]||0)+1);
  if(q.progress[id]>=def.target&&!q.rewarded[id]){q.rewarded[id]=true; awardXp(def.rewardXp,`Ежедневное задание: ${def.label}`,{notifyRank:false}); showToast?.(`✓ ${def.label}: +${def.rewardXp} XP`);}
  saveProfile();
}
function dailyModeQuestsMarkup() {
  const q=normalizeDailyQuests(), defs=activeDailyQuestDefs(), today=todayKey(), doneDaily=(profile.daily?.completedDates||[]).includes(today);
  return `<section class="hub-section daily-quests"><div class="hub-section-head"><div><h3>Ежедневные задания</h3><small>3 режима · по 5 побед</small></div></div><div class="daily-quest-grid">${defs.map(def=>{const v=Math.min(def.target,+q.progress[def.id]||0),done=v>=def.target;return `<button class="daily-quest ${done?"done":""}" data-daily-quest-mode="${def.id}"><b>${def.label}</b><div class="daily-quest-meta"><small>+${def.rewardXp} XP</small><span>${v}/${def.target}${done?" ✓":""}</span></div></button>`;}).join("")}</div><button class="daily-main-quest ${doneDaily?"done":""}" data-game-mode="daily"><span><i>☀</i><b>Ежедневный расклад</b><small>${doneDaily?"Сегодня уже пройден — можно улучшить результат":"Один общий расклад на сегодня"}</small></span><strong>${doneDaily?"✓":"Играть →"}</strong></button></section>`;
}

const PWA_INSTALL_REWARD_XP = 250;
function pwaStandaloneDetected() {
  return !!(window.matchMedia?.("(display-mode: standalone)")?.matches || navigator.standalone === true);
}
function claimPwaInstallReward({ notify = true } = {}) {
  if (!pwaStandaloneDetected() || profile.installRewardClaimed) return false;
  profile.installRewardClaimed = true;
  awardXp(PWA_INSTALL_REWARD_XP, "Установка Словасьянса", { notifyRank: false });
  saveProfile();
  if (notify) queueAchievementNotifications?.([{ icon:"📲", title:"Словасьянс установлен", desc:`Спасибо! Награда за установку: +${PWA_INSTALL_REWARD_XP} XP` }]);
  track?.("pwa_install_reward", { xp:PWA_INSTALL_REWARD_XP });
  return true;
}
function challengeEligibleState(s=state) { return !!s && s.mode !== "challenge" && s.mode !== "tutorial"; }
function recordChallengeEligibleProgress(s=state, stars=0) {
  if (!challengeEligibleState(s) || s.failed) return false;
  const m=profile.challengeMetrics ||= {levels:0,stars:0,noHints:0,perfect:0,categories:0,hints:0,combo:0,moves:0};
  m.levels=(+m.levels||0)+1;
  m.stars=(+m.stars||0)+Math.max(0,+stars||0);
  if ((s.run?.hints||0)===0) m.noHints=(+m.noHints||0)+1;
  if (+stars===3) m.perfect=(+m.perfect||0)+1;
  m.categories=(+m.categories||0)+Math.max(0,+s.totalCategories||0);
  m.hints=(+m.hints||0)+Math.max(0,+s.run?.hints||0);
  m.combo=(+m.combo||0)+Math.max(0,+s.run?.maxCombo||0);
  m.moves=(+m.moves||0)+Math.max(0,+s.run?.moves||0);
  const mode=dailyQuestModeForState(s), stats=profile.modeStats ||= {}, ms=stats[mode] ||= {completed:0,bestCombo:0,bestTimeMs:0,bestMoves:0};
  ms.completed=(+ms.completed||0)+1; ms.bestCombo=Math.max(+ms.bestCombo||0,+s.run?.maxCombo||0);
  const elapsed=typeof activeRunElapsedMs==="function"?activeRunElapsedMs(s):0;
  if(elapsed>0)ms.bestTimeMs=!ms.bestTimeMs?elapsed:Math.min(ms.bestTimeMs,elapsed);
  const moves=+s.run?.moves||0;if(moves>0)ms.bestMoves=!ms.bestMoves?moves:Math.min(ms.bestMoves,moves);
  return true;
}
function activeRuleMode(s=state) { return s?.mode === "challenge" ? normalizeDuelMode(s.duelMode) : (["time","moves","combo","noMistakes","onePass","hardcore","custom"].includes(s?.mode) ? s.mode : "classic"); }
function ruleHasNoMistakes(s=state) { return activeRuleMode(s)==="noMistakes" || !!s?.rules?.noMistakes; }
function activeTimeRemainingMs(s=state) {
  const limit=+s?.rules?.timeLimitMs||0;if(!limit)return 0;
  return Math.max(0,limit-(typeof activeRunElapsedMs==="function"?activeRunElapsedMs(s):0));
}
function ruleMetricText(s=state) {
  const mode=activeRuleMode(s); if(!s?.run||mode==="classic")return "";
  const rules=s.rules||{};
  if(rules.timeLimitMs) return `⏱ ${Math.ceil(activeTimeRemainingMs(s)/1000)} сек.`;
  if(rules.moveLimit) { const n=s.run.moves||0; return `↯ ${n}/${rules.moveLimit} ${ruPlural(n, "ход", "хода", "ходов")}`; }
  if(rules.comboTarget) return `× ${s.run.maxCombo||0}/${rules.comboTarget}`;
  if(rules.maxRecycles===0) return `↻ Один проход · ${s.stock?.length||0}`;
  if(mode==="hardcore") return `☠ Раунд ${Math.max(1,+s.level||1)}`;
  if(ruleHasNoMistakes(s)) return (s.run.errors||0)?"Ошибка — поражение":"◇ Без ошибок";
  if(mode==="time") return `⏱ ${Math.floor((typeof activeRunElapsedMs === "function" ? activeRunElapsedMs(s) : 0)/1000)} сек.`;
  if(mode==="moves") return `↯ ${ruCount(s.run.moves||0, "ход", "хода", "ходов")}`;
  if(mode==="combo") return `× ${s.run.maxCombo||0}`;
  return "";
}
function activeRuleFailureReason(s=state, { completion=false }={}) {
  if(!s?.rules||s.rewarded)return ""; const r=s.rules;
  if(r.timeLimitMs && activeTimeRemainingMs(s)<=0)return "Время вышло";
  if(r.moveLimit && (+s.run?.moves||0)>r.moveLimit)return "Лимит ходов исчерпан";
  if(r.noMistakes && (+s.run?.errors||0)>0)return "Первая ошибка";
  if(completion && r.comboTarget && (+s.run?.maxCombo||0)<r.comboTarget)return `Нужно комбо ×${r.comboTarget}`;
  return "";
}
function checkActiveRuleFailure() {
  const reason=activeRuleFailureReason(state); if(reason&&typeof finishFailedRun==="function"){finishFailedRun(reason);return true;} return false;
}
function comboXpHudText(s=state) {
  const current=Math.max(0,+s?.run?.comboCurrent||0),info=typeof comboXpBonusInfo==="function"?comboXpBonusInfo(s):{percent:0};
  return `Комбо ×${current} · XP +${Math.max(0,+info.percent||0)}%`;
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
      { id: "lowHints", icon: "✦", title: "Минимум подсказок", desc: "Пройди расклад, использовав не больше одной подсказки", target: 1 },
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
  if (b.id === "moves") { const n=s.run?.moves || 0; return `${n}/${b.target} ${ruPlural(n, "ход", "хода", "ходов")}`; }
  if (b.id === "clean") return ruCount(s.run?.errors || 0, "ошибка", "ошибки", "ошибок");
  if (b.id === "recycle") return ruCount(s.run?.recycles || 0, "прокрутка", "прокрутки", "прокруток");
  if (b.id === "lowHints") { const n=s.run?.hints || 0; return `${n}/1 ${ruPlural(n, "подсказка", "подсказки", "подсказок")}`; }
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

function nearestAchievementForMode(mode) {
  const map={regular:["ten","fifty","hundred"],daily:["daily7","daily30","daily100"],marathon:["marathon5","marathon15"],zen:["calm10"],pictures:["allPictures"],duel:["challenge1","challenge25","duelGold10"],time:["special10","special25"],moves:["special10","special25"],combo:["combo3","combo10"],noMistakes:["nohint","nohint50","nohint100"],onePass:["special10","special25"],hardcore:["retro90"],custom:["special10","special25"]};
  const defs=(map[mode]||[]).map(id=>ACHIEVEMENTS.find(a=>a.id===id)).filter(Boolean).filter(a=>!profile.achievements.includes(a.id));
  return defs.map(a=>({a,p:achievementProgressData(a,profile)})).sort((x,y)=>((y.p?.value||0)/(y.p?.goal||1))-((x.p?.value||0)/(x.p?.goal||1)))[0]?.a||defs[0]||null;
}
function modeNearestAchievementMarkup(mode) { const a=nearestAchievementForMode(mode); return a?`<small class="mode-nearest">Ближе всего: ${a.icon} ${escapeHtml(a.title)}</small>`:""; }

function nearGoalCandidates() {
  const progressAchievements = ACHIEVEMENTS.map((a)=>({a,p:achievementProgressData(a,profile)})).filter((x)=>x.p&&!profile.achievements.includes(x.a.id)&&x.p.value>0).map(({a,p})=>({id:`achievement:${a.id}`,icon:a.icon,title:a.title,desc:`${p.value}/${p.goal}`,ratio:p.value/p.goal})).sort((a,b)=>b.ratio-a.ratio);
  const goals = [...progressAchievements], xp = xpLevelProgress(), rank = playerRank();
  goals.push({ id: "xp", icon: rank.icon, title: `Ранг ${xp.level + 1}`, desc: `Ещё ${xp.goal - xp.value} XP`, ratio: xp.ratio });
  const nt = typeof nextTheme === "function" ? nextTheme() : null;
  if (nt) { const starProgress=Math.max(profile.totalStars||0,profile.cosmeticStarsPeak||0); goals.push({ id: "theme", icon: "✦", title: `Тема ${nt.name}`, desc: `Ещё ${Math.max(0, nt.stars-starProgress)} ★`, ratio: Math.min(1, starProgress/nt.stars) }); }
  const chapter = chapterInfo(profile.currentLevel || 1), stars = chapterStarsForProfile(profile, chapter.number).reduce((a,b)=>a+b,0);
  if (stars < 30) goals.push({ id: "chapter", icon: "◆", title: `Глава ${chapter.number}`, desc: `До идеала: ${30-stars} ★`, ratio: stars/30 });
  const mastery = nearestMasteryGoal();
  if (mastery) goals.push({ id:`mastery:${mastery.cat.id}`, icon:"▦", title:`Освоить «${mastery.cat.title}»`, desc:`Осталось ${ruCount(mastery.total-mastery.known, "слово", "слова", "слов")}`, ratio:mastery.ratio });
  return goals.sort((a,b)=>b.ratio-a.ratio);
}
function nearGoalsMarkup(limit = 2) {
  const goals = nearGoalCandidates().slice(0, limit);
  if (!goals.length) return "";
  return `<section class="near-goals"><div class="near-goals-head"><b>Ближайшие награды</b><span>осталось совсем немного</span></div><div class="near-goal-row">${goals.map((g)=>`<div class="near-goal"><i>${g.icon}</i><div><b>${g.title}</b><span>${g.desc}</span><em><u style="width:${Math.round(g.ratio*100)}%"></u></em></div></div>`).join("")}</div></section>`;
}

function unseenDuelEntry() {
  return (profile.sentChallenges || []).find((x)=>x.guestResult && !x.resultSeen) || null;
}
function smartHomeAction() {
  const duel = unseenDuelEntry();
  if (duel) return { kind:"duel", icon:"⚔", eyebrow:"ЕСТЬ ОТВЕТ", title:`Результат от ${duel.guestResult.playerName || "соперника"}`, desc:`${duel.code} · результат дуэли готов`, button:"Посмотреть результат", code:duel.code };
  const dailyDone = profile.daily.completedDates.includes(todayKey());
  if (!dailyDone) return { kind:"daily", icon:"☀", eyebrow:"СЕГОДНЯ", title:"Ежедневный расклад ждёт", desc:"Один расклад для всех игроков · поддержи серию", button:"Играть" };
  const w = weeklyProgress();
  if (!w.completed && w.ratio >= .65) return { kind:"weekly", icon:w.def.icon, eyebrow:"ПОЧТИ ГОТОВО", title:w.def.title, desc:`${w.value}/${w.goal} · осталось ${w.goal-w.value}`, button:"Продолжить" };
  const next = profile.currentLevel || 1, inChapter = ((next-1)%CHAPTER_SIZE)+1;
  if (inChapter >= 9) return { kind:"chapter", icon:"◆", eyebrow:"ФИНАЛ ГЛАВЫ БЛИЗКО", title:`Уровень ${next} · ${chapterInfo(next).title}`, desc:inChapter===10?"Финальный расклад с особым правилом":"До финала остался один уровень", button:inChapter===10?"Начать финал":"Продолжить" };
  return { kind:"continue", icon:"▶", eyebrow:"ПРОДОЛЖИТЬ", title:`Уровень ${next}`, desc:`Глава ${chapterInfo(next).number} · ${chapterInfo(next).title}`, button:"Играть" };
}
function smartHomeMarkup() {
  const a = smartHomeAction();
  return `<section class="smart-action smart-${escapeHtml(a.kind)}" data-smart-kind="${escapeHtml(a.kind)}" ${a.code?`data-smart-code="${escapeHtml(a.code)}"`:""}><div class="smart-icon">${escapeHtml(a.icon)}</div><div class="smart-copy"><small>${escapeHtml(a.eyebrow)}</small><b>${escapeHtml(a.title)}</b><span>${escapeHtml(a.desc)}</span></div><button id="smartAction">${escapeHtml(a.button)}</button></section>`;
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

function challengePerformanceScore(result) {
  if (!result) return Number.POSITIVE_INFINITY;
  const mode=normalizeDuelMode(result.duelMode);
  if(mode==="time") return +result.durationMs||Number.POSITIVE_INFINITY;
  if(mode==="combo") return -(+result.maxCombo||0);
  if(mode==="moves") return +result.moves||0;
  if(mode==="noMistakes") return result.failed?Number.POSITIVE_INFINITY:(+result.moves||0)+((+result.durationMs||0)/1e9);
  return (+result.moves||0)+(+result.errors||0)*2+(+result.hints||0)*5+(+result.undos||0)*3;
}
function challengeOutcome(me, friend) {
  if (!me || !friend) return 0;
  const mine=challengePerformanceScore(me),theirs=challengePerformanceScore(friend);
  if(mine!==theirs)return mine<theirs?1:-1;
  const mode=normalizeDuelMode(me.duelMode||friend.duelMode);
  const tieBreakers=mode==="combo"?[[+me.moves||0,+friend.moves||0,false],[+me.durationMs||0,+friend.durationMs||0,false]]:[[+me.errors||0,+friend.errors||0,false],[+me.hints||0,+friend.hints||0,false],[+me.undos||0,+friend.undos||0,false],[+me.stars||0,+friend.stars||0,true],[+me.moves||0,+friend.moves||0,false]];
  for(const [a,b,higherWins] of tieBreakers){if(a===b)continue;return higherWins?(a>b?1:-1):(a<b?1:-1)} return 0;
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
    awardXp(120,"Победа в серии дуэлей",{notifyRank:false});
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
  const controller = new AbortController(), timer = setTimeout(()=>controller.abort(), 5500);
  try {
    const res = await apiFetch("/api/push",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body),cache:"no-store",signal:controller.signal});
    const data = await res.json().catch(()=>({}));
    if (!res.ok) { const err=new Error(data.message||data.error||`Push ${res.status}`); err.status=res.status; throw err; }
    return data;
  } finally { clearTimeout(timer); }
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
    preferences:{challenge:profile.settings.challengeReminders!==false,daily:profile.settings.dailyReminders!==false,weekly:profile.settings.weeklyReminders!==false},
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
    const keyRes = await apiFetch("/api/push?action=key",{cache:"no-store"}), keyData = await keyRes.json();
    if (!keyRes.ok || !keyData.publicKey) throw new Error("VAPID key is not configured");
    sub = await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:base64UrlToUint8Array(keyData.publicKey)});
  }
  profile.settings.notifications = true;
  saveProfile();
  await pushApi({action:"register",...pushStatePayload(),subscription:sub.toJSON()});
  if (challengeEntry?.code && challengeEntry.ownerToken && profile.settings.challengeReminders !== false) {
    await challengeApi("POST","",{action:"attachPush",code:challengeEntry.code,ownerToken:challengeEntry.ownerToken,pushClientId:profile.pushClientId});
  }
  await syncChallengePushPreference();
  showToast("Уведомления включены");
  return true;
}
async function syncPushState() {
  if (!("Notification" in window) || !profile.settings.notifications || Notification.permission !== "granted") return false;
  try { await pushApi({action:"sync",...pushStatePayload()}); return true; } catch { return false; }
}
async function disablePushNotifications() {
  profile.settings.notifications = false;
  saveProfile();
  await syncChallengePushPreference();
  try {
    const reg = await navigator.serviceWorker.ready, sub = await reg.pushManager.getSubscription();
    await sub?.unsubscribe();
    if (profile.pushClientId) await pushApi({action:"unregister",clientId:profile.pushClientId});
  } catch {}
}
async function syncChallengePushPreference() {
  const enabled = !!profile.settings.notifications && profile.settings.challengeReminders !== false && typeof Notification !== "undefined" && Notification.permission === "granted";
  const pushClientId = enabled ? ensurePushClientId() : "";
  const jobs = [];
  for (const entry of (profile.sentChallenges || []).filter((x)=>x?.code && x?.ownerToken && !x?.guestResult && x.status !== "expired")) {
    jobs.push(challengeApi("POST","",{action:"attachPush",code:entry.code,ownerToken:entry.ownerToken,pushClientId}).catch(()=>null));
  }
  for (const entry of (profile.receivedChallenges || []).filter((x)=>x?.code && x?.guestToken && x?.guestResult && !x?.creatorResult)) {
    jobs.push(challengeApi("POST","",{action:"guestPush",code:entry.code,guestToken:entry.guestToken,pushClientId}).catch(()=>null));
  }
  if (jobs.length) await Promise.all(jobs);
  return enabled;
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
  if (profile.settings.challengeReminders === false) return;
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
  // Unlocking a frame must never silently replace the player's chosen frame.
  if (typeof queueAchievementNotifications === "function") queueAchievementNotifications([{icon:"◆",title:`Глава ${chapter} завершена`,desc:`Открыта рамка «${frame?.name || chapterInfo(s.level).title}» · +120 XP`}]);
  return true;
}

function frameTilesMarkup() {
  return FRAME_DEFS.map((f)=>{const unlocked=frameUnlocked(f), selected=profile.frame===f.id,locked=f.minDuelXp?`${f.minDuelXp} дуэльного XP`:`Глава ${f.chapter}`;return `<button class="frame-tile ${unlocked?"":"locked"} ${selected?"selected":""}" data-frame-id="${f.id}" style="--frame-h:${f.hue}"><i>◇</i><b>${f.name}</b><span>${unlocked?(selected?"Выбрано":"Открыто"):locked}</span></button>`;}).join("");
}

function bindRetentionUi() {
  const closeDuel=$("#duelClose"); if(closeDuel) closeDuel.onclick=()=>{$("#duelResultModal")?.classList.remove("show"); $("#duelResultModal")?.setAttribute("aria-hidden","true"); setTimeout(()=>showPendingWeeklyDigest?.(),250);};
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
  const splash=$("#splash");
  if(!splash) return Promise.resolve();
  setSplashProgress(100,"Готово");
  const delay=Math.max(0,650-(performance.now()-SPLASH_STARTED_AT));
  return new Promise((resolve)=>{
    setTimeout(()=>{
      splash.classList.add("hide");
      splash.style.pointerEvents="none";
      setTimeout(()=>{splash.remove();resolve();},520);
    },delay);
  });
}
function showSplashError(message="Не удалось загрузить игру") {
  const splash=$("#splash"); if(!splash) return;
  splash.classList.add("error");
  $("#splashStatus").textContent=message;
  $("#splashRetry").hidden=false;
}
