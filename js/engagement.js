/* Product polish layer: onboarding, encyclopedia discovery, duel history,
   weekly recap, adaptive difficulty, quality diagnostics and privacy-light analytics. */
const REMOTE_ANALYTICS_QUEUE_KEY = "worditaire-analytics-queue-v1";
let remoteAnalyticsTimer = null, remoteAnalyticsBusy = false;
let qualityAuditReport = { ok: true, checks: [], warnings: [] };

function safeAnalyticsName(value) {
  return String(value || "event").replace(/[^a-zA-Z0-9_.:-]/g, "_").slice(0, 64) || "event";
}
function queueRemoteAnalytics(name) {
  if (!/^https?:$/.test(location.protocol)) return;
  try {
    const queue = JSON.parse(localStorage.getItem(REMOTE_ANALYTICS_QUEUE_KEY)) || [];
    queue.push({ name: safeAnalyticsName(name), t: Date.now() });
    localStorage.setItem(REMOTE_ANALYTICS_QUEUE_KEY, JSON.stringify(queue.slice(-80)));
    clearTimeout(remoteAnalyticsTimer);
    remoteAnalyticsTimer = setTimeout(flushRemoteAnalytics, queue.length >= 12 ? 100 : 4500);
  } catch {}
}
async function flushRemoteAnalytics() {
  if (!/^https?:$/.test(location.protocol) || navigator.onLine === false || document.visibilityState === "hidden" || remoteAnalyticsBusy) return false;
  if (typeof activelyPlayingRound === "function" && activelyPlayingRound()) return false;
  let queue = [];
  try { queue = JSON.parse(localStorage.getItem(REMOTE_ANALYTICS_QUEUE_KEY)) || []; } catch {}
  if (!queue.length) return false;
  const batch = queue.slice(0, 30), controller = new AbortController(), timer = setTimeout(()=>controller.abort(), 4500);
  remoteAnalyticsBusy = true;
  try {
    const response = await apiFetch("/api/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: profile.analyticsClientId, events: batch }),
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) return false;
    const rest = queue.slice(batch.length);
    localStorage.setItem(REMOTE_ANALYTICS_QUEUE_KEY, JSON.stringify(rest));
    if (rest.length) remoteAnalyticsTimer = setTimeout(flushRemoteAnalytics, 1400);
    return true;
  } catch { return false; }
  finally { clearTimeout(timer); remoteAnalyticsBusy = false; }
}

function retentionMetricsSnapshot() {
  return {
    games: +(profile.stats.gamesPlayed || 0),
    levels: +(profile.stats.levelsCompleted || 0),
    categories: discoveredCategoryCount(profile) + visualDiscoveredCategoryCount(profile),
    achievements: (profile.achievements || []).length,
    xp: +(profile.xp || 0),
    challenges: +(profile.stats.challengesCompleted || 0),
    seriesWins: +(profile.stats.seriesWins || 0),
    daily: +(profile.stats.dailyCompleted || 0),
    combo: +(profile.stats.maxDragCombo || 0),
  };
}
function metricDelta(now, before, key) { return Math.max(0, +(now?.[key] || 0) - +(before?.[key] || 0)); }
function prepareWeeklyDigest() {
  profile.weeklyDigest ||= { key: "", baseline: null, pending: null, seenKey: "" };
  const key = weekKey(todayKey()), now = retentionMetricsSnapshot();
  if (!profile.weeklyDigest.key) {
    profile.weeklyDigest.key = key;
    profile.weeklyDigest.baseline = now;
    saveProfile();
    return null;
  }
  if (profile.weeklyDigest.key === key) return profile.weeklyDigest.pending;
  const before = profile.weeklyDigest.baseline || {};
  profile.weeklyDigest.pending = {
    key: profile.weeklyDigest.key,
    games: metricDelta(now,before,"games"),
    levels: metricDelta(now,before,"levels"),
    categories: metricDelta(now,before,"categories"),
    achievements: metricDelta(now,before,"achievements"),
    xp: metricDelta(now,before,"xp"),
    challenges: metricDelta(now,before,"challenges"),
    seriesWins: metricDelta(now,before,"seriesWins"),
    daily: metricDelta(now,before,"daily"),
    bestCombo: +(profile.stats.maxDragCombo || 0),
  };
  profile.weeklyDigest.key = key;
  profile.weeklyDigest.baseline = now;
  saveProfile();
  return profile.weeklyDigest.pending;
}
function showPendingWeeklyDigest() {
  const data = profile.weeklyDigest?.pending, modal = $("#weeklyDigestModal");
  if (!data || !modal || profile.weeklyDigest.seenKey === data.key) return false;
  const grid = $("#weeklyDigestGrid");
  if (grid) grid.innerHTML = [
    ["🎮", data.games, ruPlural(data.games, "партия", "партии", "партий")],
    ["★", data.levels, ruPlural(data.levels, "уровень", "уровня", "уровней")],
    ["▦", data.categories, `${ruPlural(data.categories, "новая", "новые", "новых")} ${ruPlural(data.categories, "категория", "категории", "категорий")}`],
    ["🏆", data.achievements, ruPlural(data.achievements, "достижение", "достижения", "достижений")],
    ["⚔", data.seriesWins, ruPlural(data.seriesWins, "серия выиграна", "серии выиграны", "серий выиграно")],
    ["☀", data.daily, `${ruPlural(data.daily, "ежедневный", "ежедневных", "ежедневных")} ${ruPlural(data.daily, "расклад", "расклада", "раскладов")}`],
  ].map(([i,v,l])=>`<div><i>${i}</i><b>${v}</b><span>${l}</span></div>`).join("");
  $("#weeklyDigestXp").textContent = `+${data.xp} XP за неделю`;
  modal.classList.add("show");
  modal.setAttribute("aria-hidden","false");
  track("weekly_digest_shown", { games:data.games, categories:data.categories });
  return true;
}
function closeWeeklyDigest() {
  const modal = $("#weeklyDigestModal");
  if (!modal) return;
  if (profile.weeklyDigest?.pending) profile.weeklyDigest.seenKey = profile.weeklyDigest.pending.key;
  profile.weeklyDigest.pending = null;
  saveProfile();
  modal.classList.remove("show");
  modal.setAttribute("aria-hidden","true");
}

function adaptiveDifficultyBias() { return Math.max(-2, Math.min(2, +(profile.adaptive?.bias || 0))); }
function updateAdaptiveDifficulty(s = state, stars = 1) {
  if (!s || s.mode !== "regular" || s.special?.boss) return adaptiveDifficultyBias();
  profile.adaptive ||= { bias:0, history:[], restartsSinceWin:0 };
  const restarts = +(profile.adaptive.restartsSinceWin || 0), errors = +(s.run?.errors || 0), hints = +(s.run?.hints || 0), undos = +(s.run?.undos || 0);
  let score = 0;
  if (stars === 3 && !errors && !hints && !undos && !restarts) score = 2;
  else if (stars === 3 && errors <= 1 && hints <= 1 && undos <= 1) score = 1;
  else if (restarts >= 2 || errors >= 4 || hints >= 3 || undos >= 3) score = -2;
  else if (restarts || errors >= 2 || hints >= 2 || undos >= 2) score = -1;
  profile.adaptive.history = [...(profile.adaptive.history || []), score].slice(-8);
  const avg = profile.adaptive.history.reduce((a,b)=>a+b,0) / Math.max(1, profile.adaptive.history.length);
  profile.adaptive.bias = avg >= .8 ? 2 : avg >= .25 ? 1 : avg <= -.8 ? -2 : avg <= -.25 ? -1 : 0;
  profile.adaptive.restartsSinceWin = 0;
  track("adaptive_difficulty", { bias: profile.adaptive.bias, score });
  saveProfile();
  return profile.adaptive.bias;
}
function noteAdaptiveRestart() {
  if (state?.mode !== "regular") return;
  profile.adaptive ||= { bias:0, history:[], restartsSinceWin:0 };
  profile.adaptive.restartsSinceWin = Math.min(9, +(profile.adaptive.restartsSinceWin || 0) + 1);
  saveProfile();
}
function applyAdaptiveConfig(cfg, special = null) {
  const bias = adaptiveDifficultyBias();
  if (!cfg || special?.boss || !bias) return cfg;
  const out = { ...cfg, words:[...cfg.words] };
  if (bias < 0) {
    out.difficulty = Math.max(1, out.difficulty - 1);
    out.cats = Math.max(out.cols, out.cats - (bias <= -2 ? 1 : 0));
    if (bias <= -2 && out.cols > 3 && out.cats <= 6) out.cols--;
    out.words = [Math.max(3,out.words[0]-1), Math.max(4,out.words[1]-1)];
  } else {
    out.difficulty = Math.min(5, out.difficulty + 1);
    out.cats = Math.min(10, out.cats + (bias >= 2 ? 1 : 0));
    out.words = [Math.min(8,out.words[0] + (bias >= 2 ? 1 : 0)), Math.min(9,out.words[1] + 1)];
  }
  return out;
}

function categoryDisplayName(id) {
  if (!id) return "";
  const word = BANK.find((c)=>c.id===id); if (word) return word.title;
  const visual = visualCategoryById(id); return visual?.category?.title || "";
}
function categoryDisplayIcon(id) {
  const visual=visualCategoryById(id); if (visual) return visual.category.cards?.[0]?.[0] || visual.collection.icon;
  const word=BANK.find((c)=>c.id===id); return word ? word.title.slice(0,1) : "✦";
}
function discoveredAllCategoryIds() {
  return [...new Set([...(profile.discovered || []), ...visualDiscoveredIds(profile)])];
}
function registerVisibleCategoryDiscovery(id, ref = "") {
  if (!id) return false;
  const isVisual=String(id).startsWith("visual:"), list=isVisual ? (profile.visualDiscovered ||= []) : (profile.discovered ||= []);
  if (list.includes(id)) return false;
  list.push(id);
  const stat=categoryStat(id); stat.discoveredAt ||= Date.now(); if(!stat.firstLevel) stat.firstLevel=ref || levelRefLabel(state);
  awardXp?.(20, `Новая категория: ${categoryDisplayName(id)}`, {notifyRank:false});
  track("category_discovered", { type:isVisual?"picture":"word" });
  queueAchievementNotifications?.([{icon:categoryDisplayIcon(id),title:`Новая категория: ${categoryDisplayName(id)}`,desc:"Добавлена в энциклопедию · +20 XP"}]);
  saveProfile();
  return true;
}

function checkVisualCategoryMastery(id, { notify = true } = {}) {
  const info=visualCategoryById(id),stat=categoryStat(id);
  if(!info||stat.masteredAt)return false;
  const total=info.category.cards.length,known=new Set(stat.words||[]).size;
  if(known<total)return false;
  stat.masteredAt=Date.now();
  profile.stats.masteredPictureCategories=(profile.stats.masteredPictureCategories||0)+1;
  awardXp?.(80,`Картинки «${info.category.title}»`,{notifyRank:false});
  track("picture_category_mastered");
  if(notify)queueAchievementNotifications?.([{icon:info.collection.icon,title:`Освоено: ${info.category.title}`,desc:`Открыто: ${ruCount(total, "картинка", "картинки", "картинок")} · +80 XP`}]);
  saveProfile();
  return true;
}

function profileFavoriteLabel() { return categoryDisplayName(profile.favoriteCategory) || "Не выбрана"; }
function profileShowcaseMarkup() {
  const featured=(profile.featuredAchievements||[]).map((id)=>ACHIEVEMENTS.find((a)=>a.id===id)).filter(Boolean).slice(0,3),
    rank=playerRank(profile), duels=duelHistorySummary();
  return `<section class="profile-showcase hub-section"><div class="hub-section-head"><h3>Визитка игрока</h3><small>${escapeHtml(rank.name)}</small></div>
    <div class="profile-showcase-grid"><div><span>Любимая категория</span><b>${profile.favoriteCategory?`${categoryDisplayIcon(profile.favoriteCategory)} ${escapeHtml(profileFavoriteLabel())}`:"—"}</b></div><div><span>Ежедневная серия</span><b>🔥 ${profile.daily.currentStreak||0}</b></div><div><span>Дуэли</span><b>${duels.wins}:${duels.losses}</b></div><div><span>Звёзды уровней</span><b>★ ${profile.totalStars||0}</b></div></div>
    <div class="featured-achievements">${featured.length?featured.map((a)=>`<span title="${escapeHtml(a.title)}"><i>${a.icon}</i><b>${escapeHtml(a.title)}</b></span>`).join(""):`<small>Выбери до 3 достижений в редакторе профиля</small>`}</div>
  </section>`;
}


const LEADERBOARD_DEFS = Object.freeze([
  {id:"stars",label:"Звёзды",icon:"★"},{id:"levels",label:"Уровни",icon:"▦"},{id:"daily",label:"Ежедневные",icon:"☀"},
  {id:"marathon",label:"Марафон",icon:"∞"},{id:"combo",label:"Комбо",icon:"×"},{id:"duel",label:"Дуэли",icon:"⚔"},
  {id:"time",label:"На время",icon:"⏱"},{id:"moves",label:"На ходы",icon:"↯"},{id:"onePass",label:"Один проход",icon:"↻"},
]);
function leaderboardValues() {
  const modes=profile.modeStats||{}, stats=profile.stats||{}, challenge=profile.challengeMetrics||{};
  return {
    stars:Math.min(profile.totalStars||0,(stats.levelsCompleted||0)*3), levels:stats.levelsCompleted||0, daily:stats.dailyCompleted||0, marathon:stats.bestMarathon||0,
    combo:Math.max(stats.maxCombo||0,stats.maxDragCombo||0,...Object.values(modes).map((x)=>+x?.bestCombo||0)), duel:stats.duelRating||0,
    time:modes.time?.bestTimeMs||0, moves:modes.moves?.bestMoves||0, onePass:modes.onePass?.completed||0,
  };
}
function leaderboardPayload(){const d=syncDuelStats?.()||{};return{playerId:profile.playerId||"",name:profile.playerName||"Игрок",avatar:profile.avatarEmoji||"🙂",values:leaderboardValues(),duelStats:{matches:d.total||profile.stats.duelMatches||0,wins:d.wins||profile.stats.duelWins||0,losses:d.losses||profile.stats.duelLosses||0,draws:d.draws||profile.stats.duelDraws||0,gold:d.gold||profile.stats.duelGold||0,silver:d.silver||profile.stats.duelSilver||0,bronze:d.bronze||profile.stats.duelBronze||0,xp:d.duelXp||profile.stats.duelXp||0,rating:d.duelRating||profile.stats.duelRating||0}};}
let leaderboardSyncAt=0;
const LEADERBOARD_CACHE_TTL=120000;
let leaderboardCache={at:0,boards:{},promise:null};
async function syncLeaderboardNonBlocking(force=false){
  if(!/^https?:$/.test(location.protocol)||navigator.onLine===false||!profile.playerId||!(typeof accountSignedIn==="function"&&accountSignedIn()))return false;
  if(!force&&Date.now()-leaderboardSyncAt<30000)return false;leaderboardSyncAt=Date.now();
  try{const c=new AbortController(),t=setTimeout(()=>c.abort(),1800);const r=await apiFetch("/api/leaderboard",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(leaderboardPayload()),signal:c.signal,cache:"no-store"});clearTimeout(t);return r.ok;}catch{return false;}
}
function leaderboardValueLabel(board,value){
  if(board==="time")return `${Math.floor(value/60000)}:${String(Math.floor(value/1000)%60).padStart(2,"0")}`;
  if(board==="moves")return ruCount(value, "ход", "хода", "ходов");
  if(board==="duel")return ruCount(value, "очко", "очка", "очков");
  if(board==="stars")return `${value} ★`;
  if(board==="combo")return `×${value}`;
  return String(value);
}
function dedupeOwnLeaderboardRows(entries=[]){
  const list=Array.isArray(entries)?entries:[], meId=String(profile.playerId||""), meName=String(profile.playerName||"Игрок").trim().toLowerCase(), meAvatar=String(profile.avatarEmoji||"🙂");
  const hasCurrent=!!meId&&list.some((x)=>String(x.playerId||"")===meId);
  return list.filter((x)=>{
    const isCurrent=String(x.playerId||"")===meId;
    if(isCurrent||!hasCurrent)return true;
    const looksLikeLegacy=String(x.name||"").trim().toLowerCase()===meName&&String(x.avatar||"")===meAvatar;
    return !looksLikeLegacy;
  }).map((x,index)=>({...x,rank:index+1}));
}
function renderLeaderboardEntries(board,entries){
  const list=$("#leaderboardList");if(!list)return;
  const clean=dedupeOwnLeaderboardRows(entries);
  list.innerHTML=clean.length?clean.map((x)=>`<div class="leaderboard-row ${x.playerId===profile.playerId?"me":""}"><b>${x.rank}</b><span>${escapeHtml(x.avatar||"🙂")}</span><div><strong>${escapeHtml(x.name||"Игрок")}</strong>${x.playerId===profile.playerId?"<small>Это ты</small>":""}</div><em>${escapeHtml(leaderboardValueLabel(board,x.value))}</em></div>`).join(""):`<div class="empty-state">Здесь пока нет результатов. Сыграй первым!</div>`;
}
async function fetchLeaderboardSnapshot(force=false){
  if(!force&&leaderboardCache.at&&Date.now()-leaderboardCache.at<LEADERBOARD_CACHE_TTL)return leaderboardCache.boards;
  if(leaderboardCache.promise)return leaderboardCache.promise;
  leaderboardCache.promise=(async()=>{
    const c=new AbortController(),t=setTimeout(()=>c.abort(),3200);
    try{
      const r=await apiFetch("/api/leaderboard?board=all",{cache:"no-store",signal:c.signal});
      if(!r.ok)throw new Error("leaderboard unavailable");
      const data=await r.json(),boards=data?.boards&&typeof data.boards==="object"?data.boards:{};
      if(data?.me?.duelStats){
        const d=data.me.duelStats,stats=profile.stats||{};
        stats.duelMatches=Math.max(+stats.duelMatches||0,+d.matches||0);stats.duelWins=Math.max(+stats.duelWins||0,+d.wins||0);stats.duelLosses=Math.max(+stats.duelLosses||0,+d.losses||0);stats.duelDraws=Math.max(+stats.duelDraws||0,+d.draws||0);stats.duelGold=Math.max(+stats.duelGold||0,+d.gold||0);stats.duelSilver=Math.max(+stats.duelSilver||0,+d.silver||0);stats.duelBronze=Math.max(+stats.duelBronze||0,+d.bronze||0);stats.duelXp=Math.max(+stats.duelXp||0,+d.xp||0);stats.duelRating=Math.max(+stats.duelRating||0,+d.rating||0,+data.me.values?.duel||0);profile.stats=stats;saveProfile?.();
      }
      leaderboardCache={at:Date.now(),boards,promise:null};
      return boards;
    } finally {clearTimeout(t);if(leaderboardCache.promise)leaderboardCache.promise=null;}
  })();
  return leaderboardCache.promise;
}
async function loadLeaderboardBoard(board){
  const list=$("#leaderboardList");if(!list)return;
  if(navigator.onLine===false||!/^https?:$/.test(location.protocol)){list.innerHTML=`<div class="empty-state">Лидеры доступны при подключении к интернету. Сама игра продолжает работать офлайн.</div>`;return;}
  if(Array.isArray(leaderboardCache.boards?.[board]))renderLeaderboardEntries(board,leaderboardCache.boards[board]);
  else list.innerHTML=`<div class="empty-state">Загружаю лидеров…</div>`;
  try{const boards=await fetchLeaderboardSnapshot(false);renderLeaderboardEntries(board,boards?.[board]||[]);}catch{if(!Array.isArray(leaderboardCache.boards?.[board]))list.innerHTML=`<div class="empty-state">Не удалось загрузить лидеров. Игра офлайн остаётся доступна.</div>`;}
}
function closeLeaderboardModal(){const m=$("#leaderboardModal");if(!m)return;m.classList.remove("show");m.setAttribute("aria-hidden","true");}
function openLeaderboardModal(board="stars"){
  const modal=$("#leaderboardModal"),tabs=$("#leaderboardTabs");if(!modal||!tabs)return false;
  let activeBoard=LEADERBOARD_DEFS.some((x)=>x.id===board)?board:"stars";
  const select=(id)=>{activeBoard=LEADERBOARD_DEFS.some((x)=>x.id===id)?id:"stars";tabs.querySelectorAll("[data-leaderboard]").forEach((b)=>b.classList.toggle("active",b.dataset.leaderboard===activeBoard));loadLeaderboardBoard(activeBoard);};
  tabs.innerHTML=LEADERBOARD_DEFS.map((x)=>`<button type="button" data-leaderboard="${x.id}">${x.icon} ${x.label}</button>`).join("");
  tabs.querySelectorAll("[data-leaderboard]").forEach((btn)=>btn.onclick=()=>select(btn.dataset.leaderboard));
  $("#leaderboardClose").onclick=closeLeaderboardModal;modal.onclick=(e)=>{if(e.target===modal)closeLeaderboardModal();};
  modal.classList.add("show");modal.setAttribute("aria-hidden","false");select(activeBoard);
  // Sync once per opening cycle. Tabs only read the single cached snapshot.
  syncLeaderboardNonBlocking(false).then((changed)=>{if(!changed)return;leaderboardCache.at=0;fetchLeaderboardSnapshot(true).then((boards)=>{if(modal.classList.contains("show"))renderLeaderboardEntries(activeBoard,boards?.[activeBoard]||[]);}).catch(()=>{});});
  return true;
}

let deletedDuelOpponentIds=new Set(),duelOpponentStatusAt=0,duelOpponentStatusPromise=null;
function completedDuelEntries() {
  const out=[], seen=new Set(), hidden=new Set();
  const records=profile.duelHistoryRecords&&typeof profile.duelHistoryRecords==="object"&&!Array.isArray(profile.duelHistoryRecords)?profile.duelHistoryRecords:{};
  for(const [rawCode,entry] of Object.entries(records)){
    const code=String(entry?.code||rawCode||"").trim().toUpperCase();if(!code)continue;
    if(entry?.hidden){hidden.add(code);seen.add(code);continue;}
    if(!entry?.creatorResult||!entry?.guestResult||seen.has(code))continue;
    seen.add(code);const perspective=entry.perspective==="guest"?"guest":"creator",fr=perspective==="guest"?entry.creatorResult:entry.guestResult;
    const opponentId=entry.opponentId||fr?.playerId||"",deleted=!!opponentId&&deletedDuelOpponentIds.has(opponentId);
    out.push({entry,perspective,opponent:deleted?"Аккаунт удалён":(entry.opponentName||fr?.playerName||"Друг"),opponentAvatar:deleted?"◌":(entry.opponentAvatar||fr?.avatarEmoji||"🙂"),opponentId,opponentDeleted:deleted,completedAt:+entry.completedAt||+fr?.completedAt||0});
  }
  for (const entry of profile.sentChallenges || []) {const code=String(entry?.code||"").trim().toUpperCase();if(!code||hidden.has(code)||seen.has(code)||!entry.creatorResult||!entry.guestResult)continue;seen.add(code);const opponentId=entry.guestResult.playerId||"",deleted=!!opponentId&&deletedDuelOpponentIds.has(opponentId);out.push({entry,perspective:"creator",opponent:deleted?"Аккаунт удалён":(entry.guestResult.playerName||"Друг"),opponentAvatar:deleted?"◌":(entry.guestResult.avatarEmoji||"🙂"),opponentId,opponentDeleted:deleted,completedAt:+entry.completedAt||+entry.guestResult.completedAt||0});}
  for (const entry of profile.receivedChallenges || []) {const code=String(entry?.code||"").trim().toUpperCase();if(!code||hidden.has(code)||seen.has(code)||!entry.creatorResult||!entry.guestResult)continue;seen.add(code);const opponentId=entry.creatorPlayerId||entry.creatorResult.playerId||"",deleted=!!opponentId&&deletedDuelOpponentIds.has(opponentId);out.push({entry,perspective:"guest",opponent:deleted?"Аккаунт удалён":(entry.creatorName||entry.creatorResult.playerName||"Друг"),opponentAvatar:deleted?"◌":(entry.creatorAvatar||entry.creatorResult.avatarEmoji||"🙂"),opponentId,opponentDeleted:deleted,completedAt:+entry.completedAt||+entry.creatorResult.completedAt||0});}
  return out.sort((a,b)=>b.completedAt-a.completedAt);
}
async function refreshDeletedDuelOpponents(force=false){
  if(!(typeof accountSignedIn==="function"&&accountSignedIn())||navigator.onLine===false||!/^https?:$/.test(location.protocol))return false;
  if(!force&&duelOpponentStatusAt&&Date.now()-duelOpponentStatusAt<5*60*1000)return false;
  if(duelOpponentStatusPromise)return duelOpponentStatusPromise;
  const ids=[...new Set(completedDuelEntries().map(x=>String(x.opponentId||"")).filter(id=>/^u_[a-zA-Z0-9_-]{8,62}$/.test(id)))];
  if(!ids.length){duelOpponentStatusAt=Date.now();return false;}
  duelOpponentStatusPromise=(async()=>{
    const next=new Set();
    for(let i=0;i<ids.length;i+=60){
      const chunk=ids.slice(i,i+60),c=new AbortController(),t=setTimeout(()=>c.abort(),3500);
      try{const r=await apiFetch(`/api/account?players=${encodeURIComponent(chunk.join(","))}`,{cache:"no-store",signal:c.signal});if(!r.ok)continue;const data=await r.json().catch(()=>({}));for(const id of chunk)if(data?.players?.[id]?.deleted)next.add(id);}catch{}finally{clearTimeout(t);}
    }
    const before=[...deletedDuelOpponentIds].sort().join("|"),after=[...next].sort().join("|");
    deletedDuelOpponentIds=next;duelOpponentStatusAt=Date.now();return before!==after;
  })();
  try{return await duelOpponentStatusPromise;}finally{duelOpponentStatusPromise=null;}
}
function duelHistorySummary() {
  let wins=0,losses=0,draws=0;
  for(const x of completedDuelEntries()){
    const me=x.perspective==="guest"?x.entry.guestResult:x.entry.creatorResult, fr=x.perspective==="guest"?x.entry.creatorResult:x.entry.guestResult, r=challengeOutcome(me,fr);
    if(r>0)wins++; else if(r<0)losses++; else draws++;
  }
  return {wins,losses,draws,total:wins+losses+draws};
}
function syncDuelStats() {
  const summary=duelHistorySummary(),stats=profile.stats||(profile.stats={});
  const wins=Math.max(+stats.duelWins||0,summary.wins),losses=Math.max(+stats.duelLosses||0,summary.losses),draws=Math.max(+stats.duelDraws||0,summary.draws),total=Math.max(+stats.duelMatches||0,wins+losses+draws,summary.total);
  const gold=Math.max(+stats.duelGold||0,wins),silver=Math.max(+stats.duelSilver||0,draws),bronze=Math.max(+stats.duelBronze||0,losses),duelXp=Math.max(+stats.duelXp||0,gold*4+silver*3+bronze*2),duelRating=Math.max(+stats.duelRating||0,gold*3+silver*2+bronze);
  const changed=stats.duelMatches!==total||stats.duelWins!==wins||stats.duelLosses!==losses||stats.duelDraws!==draws||stats.duelGold!==gold||stats.duelSilver!==silver||stats.duelBronze!==bronze||stats.duelXp!==duelXp||stats.duelRating!==duelRating;
  Object.assign(stats,{duelMatches:total,duelWins:wins,duelLosses:losses,duelDraws:draws,duelGold:gold,duelSilver:silver,duelBronze:bronze,duelXp,duelRating});
  if(changed)saveProfile?.(); return {wins,losses,draws,total,gold,silver,bronze,duelXp,duelRating};
}
function duelOpponentKey(x) {
  if (x?.opponentId) return `id:${x.opponentId}`;
  return `legacy:${String(x?.opponent || "Друг").trim().toLowerCase()}|${x?.opponentAvatar || "🙂"}`;
}
function duelHistoryGroups() {
  const groups=new Map();
  for(const x of completedDuelEntries()){
    const key=duelOpponentKey(x);
    if(!groups.has(key)) groups.set(key,{key,name:x.opponent,avatar:x.opponentAvatar,playerId:x.opponentId||"",matches:0,wins:0,losses:0,draws:0,moves:0,errors:0,last:x,entries:[]});
    const g=groups.get(key), me=x.perspective==="guest"?x.entry.guestResult:x.entry.creatorResult, fr=x.perspective==="guest"?x.entry.creatorResult:x.entry.guestResult, r=challengeOutcome(me,fr);
    g.matches++;g.moves+=me.moves||0;g.errors+=me.errors||0;g.entries.push(x);if(r>0)g.wins++;else if(r<0)g.losses++;else g.draws++; if(x.completedAt>(g.last?.completedAt||0))g.last=x;
  }
  return [...groups.values()].sort((a,b)=>(b.last?.completedAt||0)-(a.last?.completedAt||0));
}
function duelHistoryGroupByKey(key) { return duelHistoryGroups().find((g)=>g.key===key) || null; }
function activeDuelEntries() {
  const out=[];
  for(const entry of profile.sentChallenges || []) {
    if(!entry?.code || !entry?.seed || entry.status === "expired" || (entry.creatorResult && entry.guestResult)) continue;
    out.push({entry,perspective:"creator",at:+entry.createdAt||+entry.completedAt||0});
  }
  for(const entry of profile.receivedChallenges || []) {
    if(!entry?.code || !entry?.seed || (entry.creatorResult && entry.guestResult)) continue;
    out.push({entry,perspective:"guest",at:+entry.completedAt||+entry.startedAt||0});
  }
  return out.sort((a,b)=>b.at-a.at);
}
function duelHistoryContentMarkup() {
  const groups=duelHistoryGroups();
  return groups.length
    ? `<div class="duel-history-list">${groups.map(g=>{const avgMoves=Math.round(g.moves/Math.max(1,g.matches)),avgErrors=(g.errors/Math.max(1,g.matches)).toLocaleString("ru-RU",{minimumFractionDigits:1,maximumFractionDigits:1});return `<button class="duel-profile-row" data-duel-profile="${escapeHtml(g.key)}"><span class="duel-history-avatar">${escapeHtml(g.avatar || "🙂")}</span><span class="duel-profile-copy"><b>${escapeHtml(g.name)}</b><small>${ruCount(g.matches,"матч","матча","матчей")} · ${g.wins}:${g.losses}${g.draws?` · ${ruCount(g.draws,"ничья","ничьи","ничьих")}`:""}</small><em>В среднем ${ruCount(avgMoves,"ход","хода","ходов")} · ${avgErrors} ошибки</em></span><i>›</i></button>`;}).join("")}</div>`
    : `<div class="empty-state">Полностью завершённые матчи появятся здесь</div>`;
}
function closeDuelProfileHistory() {
  const modal = $("#duelHistoryModal"); if (!modal) return; modal.classList.remove("show"); modal.setAttribute("aria-hidden","true");
}
function showDuelProfileHistory(key) {
  const group=duelHistoryGroupByKey(key), modal=$("#duelHistoryModal"); if(!group||!modal)return false;
  $("#duelHistoryAvatar").textContent=group.avatar||"🙂";
  $("#duelHistoryName").textContent=group.name||"Друг";
  $("#duelHistorySummary").textContent=`${ruCount(group.matches,"матч","матча","матчей")} · ${ruCount(group.wins,"победа","победы","побед")} · ${ruCount(group.losses,"поражение","поражения","поражений")}${group.draws?` · ${ruCount(group.draws,"ничья","ничьи","ничьих")}`:""}`;
  $("#duelHistoryMatches").innerHTML=group.entries.sort((a,b)=>b.completedAt-a.completedAt).map((x)=>{const me=x.perspective==="guest"?x.entry.guestResult:x.entry.creatorResult,fr=x.perspective==="guest"?x.entry.creatorResult:x.entry.guestResult,r=challengeOutcome(me,fr),label=r>0?"Победа":r<0?"Поражение":"Ничья",score=challengePerformanceScore(me),friendScore=challengePerformanceScore(fr),date=x.completedAt?new Date(x.completedAt).toLocaleDateString("ru-RU",{day:"2-digit",month:"short"}):"—";return `<article class="duel-history-match ${r>0?"win":r<0?"lose":"draw"}"><div><b>${label}</b><span>${date} · ${x.entry.code}</span></div><small>Ты: ${ruCount(me.moves||0,"ход","хода","ходов")} · ${ruCount(me.errors||0,"ошибка","ошибки","ошибок")} · ${ruCount(score,"очко","очка","очков")}<br>${escapeHtml(group.name)}: ${ruCount(fr.moves||0,"ход","хода","ходов")} · ${ruCount(fr.errors||0,"ошибка","ошибки","ошибок")} · ${ruCount(friendScore,"очко","очка","очков")}</small></article>`;}).join("");
  const rematch=$("#duelHistoryRematch"); rematch.onclick=()=>{closeDuelProfileHistory();createChallengeRematch?.(group.last.entry,group.last.perspective);};
  $("#duelHistoryClose").onclick=closeDuelProfileHistory; modal.onclick=(e)=>{if(e.target===modal)closeDuelProfileHistory();};
  modal.classList.add("show");modal.setAttribute("aria-hidden","false");return true;
}
function duelsHubMarkup(view="active") {
  const active=activeDuelEntries(), completed=completedDuelEntries(), profiles=duelHistoryGroups(), current=view==="history"?"history":"active";
  if(current==="history"&&typeof refreshDeletedDuelOpponents==="function")refreshDeletedDuelOpponents().then((changed)=>{if(changed&&hub?.classList.contains("show")&&typeof hubDuelTab!=="undefined"&&hubDuelTab==="history")renderHub?.();}).catch(()=>{});
  const activeMarkup=active.length
    ? `<div class="owned-challenge-list duel-active-list">${active.map(x=>x.perspective==="guest"?receivedChallengeCardMarkup(x.entry,{compact:true}):ownedChallengeCardMarkup(x.entry,{compact:true})).join("")}</div>`
    : `<div class="empty-state">Активных дуэлей сейчас нет</div>`;
  const medals=syncDuelStats();
  return `<section class="hub-section duels-hub">
    <div class="hub-section-head"><h3>Дуэли</h3><small>${ruCount(active.length,"активная дуэль","активные дуэли","активных дуэлей")} · ${ruCount(profiles.length,"соперник","соперника","соперников")} · ${ruCount(completed.length,"матч","матча","матчей")}</small></div>
    <div class="duel-medal-bar"><span>🥇 <b>${medals.gold}</b></span><span>🥈 <b>${medals.silver}</b></span><span>🥉 <b>${medals.bronze}</b></span><span>XP <b>${medals.duelXp}</b></span><span title="Очки дуэльного рейтинга, не место в таблице">Очки рейтинга <b>${medals.duelRating}</b></span></div>
    <small class="duel-rating-note">Очки рейтинга — твои баллы за медали, а не место среди игроков. Место смотри в «Лидерах».</small>
    <div class="duel-tabs">
      <button class="${current==="active"?"active":""}" data-duel-tab="active">Активные <span>${active.length}</span></button>
      <button class="${current==="history"?"active":""}" data-duel-tab="history">История <span>${profiles.length}</span></button>
    </div>
    <div class="duel-tab-content">${current==="active"?activeMarkup:duelHistoryContentMarkup()}</div>
  </section>`;
}
function findDuelHistoryEntry(code) {
  const normalized=normalizeChallengeCode(code); return completedDuelEntries().find((x)=>x.entry.code===normalized)||null;
}

function categoryFilterState(id, type="words") {
  const stat=categoryStat(id), seen=type==="pictures"?visualDiscoveredIds(profile).has(id):(profile.discovered||[]).includes(id),
    mastered=type==="pictures" ? (seen && (stat.words||[]).length >= (visualCategoryById(id)?.category?.cards?.length||6)) : (seen && !!categoryMasteryData?.(id)?.mastered),
    recent=!!stat.discoveredAt && Date.now()-stat.discoveredAt < 7*86400000;
  return {seen,mastered,recent,unfinished:seen&&!mastered};
}
function runQualityAudit() {
  const warnings=[],checks=[];
  const add=(name,ok,detail="")=>{checks.push({name,ok,detail});if(!ok)warnings.push(`${name}${detail?`: ${detail}`:""}`);};
  add("Словесная база загружена",BANK.length>=100,ruCount(BANK.length,"категория","категории","категорий"));
  add("Картинки расширены",totalVisualCategoryCount()>=150,ruCount(totalVisualCategoryCount(),"категория","категории","категорий"));
  const ids=allAssociationCategories().map((x)=>x.id), unique=new Set(ids); add("ID картинок уникальны",unique.size===ids.length,ruCount(ids.length-unique.size,"дубль","дубля","дублей"));
  const broken=[]; for(const c of ASSOCIATION_COLLECTION_DEFS) for(const cat of c.categories) if(!Array.isArray(cat.cards)||cat.cards.length<5||cat.cards.some((x)=>!x?.[0])) broken.push(`${c.id}/${cat.id}`);
  add("Категории картинок валидны",broken.length===0,broken.slice(0,3).join(", "));
  const domIds=["tableau","slotsAnchor","stock","waste","hub","hubContent","hubNav","modal","profileEditorModal","onboardingModal","weeklyDigestModal"]; const missing=domIds.filter((id)=>!document.getElementById(id)); add("Ключевой UI найден",missing.length===0,missing.join(", "));
  add("Профиль читается",!!profile && !!profile.settings,"profile/settings");
  const allDomIds=[...document.querySelectorAll("[id]")].map((el)=>el.id), duplicates=[...new Set(allDomIds.filter((id,index)=>allDomIds.indexOf(id)!==index))];
  add("ID интерфейса уникальны",duplicates.length===0,duplicates.slice(0,5).join(", "));
  let contiguous=0; while(Number(profile.starsByLevel?.[contiguous+1])>0)contiguous++;
  add("Прогресс кампании согласован",(+profile.currentLevel||1)===contiguous+1 && (+profile.stats?.levelsCompleted||0)===contiguous && (+profile.stats?.chapterFinalsCompleted||0)===Math.floor(contiguous/CHAPTER_SIZE),`текущий уровень: ${profile.currentLevel} · уровней пройдено: ${profile.stats?.levelsCompleted||0} · глав пройдено: ${profile.stats?.chapterFinalsCompleted||0}`);
  const pending=profile.pendingRankUp, pendingValid=!pending || ((+pending.level||0)>(+pending.fromLevel||0) && (+pending.level||0)===(typeof playerXpLevel==="function"?playerXpLevel(profile):(+pending.level||0)));
  add("Ожидающее повышение ранга валидно",pendingValid,pending?`из ${pending.fromLevel} в ${pending.level}`:"");
  add("Генератор доступен",typeof buildGeneratedLevel==="function");
  qualityAuditReport={ok:warnings.length===0,checks,warnings,at:Date.now()};
  window.worditaireQa=qualityAuditReport;
  return qualityAuditReport;
}
function qualityAuditMarkup() {
  const r=qualityAuditReport?.checks?.length?qualityAuditReport:runQualityAudit();
  return `<div class="qa-summary ${r.ok?"ok":"warn"}"><b>${r.ok?"✓ Проверка пройдена":`⚠ ${ruCount(r.warnings.length,"предупреждение","предупреждения","предупреждений")}`}</b><span>Успешно: ${r.checks.filter(x=>x.ok).length}/${r.checks.length}</span></div><div class="qa-checks">${r.checks.map(x=>`<span class="${x.ok?"ok":"warn"}"><i>${x.ok?"✓":"!"}</i>${escapeHtml(x.name)}${x.detail?`<small>${escapeHtml(x.detail)}</small>`:""}</span>`).join("")}</div>`;
}

function onboardingAvatarButtons(selected) {
  const perPage = 8;
  const pages = [];
  for (let i = 0; i < AVATAR_EMOJIS.length; i += perPage) {
    const items = AVATAR_EMOJIS.slice(i, i + perPage)
      .map((emoji)=>`<button type="button" class="onboarding-avatar ${selected===emoji?"selected":""}" data-onboarding-avatar="${emoji}" aria-label="Выбрать аватар ${emoji}">${emoji}</button>`)
      .join("");
    pages.push(`<div class="onboarding-avatar-page" data-avatar-page="${pages.length}">${items}</div>`);
  }
  return pages.join("");
}
function onboardingAvatarPageCount() {
  return Math.max(1, Math.ceil(AVATAR_EMOJIS.length / 8));
}
let onboardingAvatarResizeObserver = null;
function bindOnboardingAvatarScroller(root) {
  onboardingAvatarResizeObserver?.disconnect?.();
  onboardingAvatarResizeObserver = null;
  const rail = root?.querySelector?.(".onboarding-avatar-grid"),
    prev = root?.querySelector?.("[data-avatar-scroll=prev]"),
    next = root?.querySelector?.("[data-avatar-scroll=next]"),
    dots = root?.querySelector?.("[data-avatar-dots]");
  if (!rail) return;

  const count = onboardingAvatarPageCount();
  const selectedButton = rail.querySelector(".onboarding-avatar.selected");
  const selectedIndex = selectedButton ? AVATAR_EMOJIS.indexOf(selectedButton.dataset.onboardingAvatar) : 0;
  let page = Math.max(0, Math.min(count - 1, Math.floor(Math.max(0, selectedIndex) / 8)));
  let wheelLock = false;
  let dragStartX = 0, dragStartLeft = 0, dragging = false, pointerPressed = false, pointerId = null, suppressClick = false;

  const pageWidth = () => Math.max(1, rail.clientWidth);
  const renderDots = () => {
    if (!dots) return;
    dots.innerHTML = Array.from({length:count}, (_,i)=>`<i class="${i===page?"active":""}" data-avatar-dot="${i}"></i>`).join("");
    dots.querySelectorAll("[data-avatar-dot]").forEach((dot)=>{
      dot.onclick=()=>setPage(+dot.dataset.avatarDot, true);
    });
  };
  const updateControls = () => {
    if (prev) prev.disabled = page <= 0;
    if (next) next.disabled = page >= count - 1;
    if (dots) dots.querySelectorAll("[data-avatar-dot]").forEach((dot,i)=>dot.classList.toggle("active", i===page));
  };
  const setPage = (index, smooth=true) => {
    page = Math.max(0, Math.min(count - 1, index));
    rail.scrollTo({ left: page * pageWidth(), behavior: smooth ? "smooth" : "auto" });
    updateControls();
  };

  if (prev) prev.onclick = () => setPage(page - 1, true);
  if (next) next.onclick = () => setPage(page + 1, true);

  // Desktop wheel/trackpad: one gesture advances one page instead of
  // moving the rail pixel-by-pixel, which removes the jerky feeling.
  rail.addEventListener("wheel", (event) => {
    if (count <= 1) return;
    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    if (Math.abs(delta) < 3) return;
    event.preventDefault();
    if (wheelLock) return;
    const direction = delta > 0 ? 1 : -1;
    if ((direction < 0 && page === 0) || (direction > 0 && page === count - 1)) return;
    wheelLock = true;
    setPage(page + direction, true);
    window.setTimeout(()=>{ wheelLock = false; }, 320);
  }, { passive:false });

  // Mouse click and drag are deliberately separated. Pointer capture is only
  // enabled after a real horizontal movement, so a normal click still reaches
  // the emoji button and selects the avatar.
  rail.addEventListener("pointerdown", (event) => {
    if (event.pointerType !== "mouse" || event.button !== 0) return;
    pointerPressed = true;
    dragging = false;
    pointerId = event.pointerId;
    dragStartX = event.clientX;
    dragStartLeft = rail.scrollLeft;
  });
  rail.addEventListener("pointermove", (event) => {
    if (!pointerPressed || event.pointerId !== pointerId) return;
    const dx = event.clientX - dragStartX;
    if (!dragging && Math.abs(dx) >= 7) {
      dragging = true;
      rail.classList.add("mouse-dragging");
      rail.setPointerCapture?.(event.pointerId);
    }
    if (!dragging) return;
    rail.scrollLeft = dragStartLeft - dx;
    event.preventDefault();
  });
  const finishDrag = (event) => {
    if (!pointerPressed || (event && event.pointerId !== pointerId)) return;
    const wasDragging = dragging;
    pointerPressed = false;
    dragging = false;
    rail.classList.remove("mouse-dragging");
    try { rail.releasePointerCapture?.(pointerId); } catch {}
    pointerId = null;
    if (!wasDragging) return;
    suppressClick = true;
    const nearest = Math.round(rail.scrollLeft / pageWidth());
    setPage(nearest, true);
    window.setTimeout(()=>{ suppressClick = false; }, 120);
  };
  rail.addEventListener("pointerup", finishDrag);
  rail.addEventListener("pointercancel", finishDrag);
  rail.addEventListener("click", (event) => {
    if (!suppressClick) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    suppressClick = false;
  }, true);

  // Native touch/trackpad scrolling updates the active dot continuously.
  let raf = 0;
  rail.addEventListener("scroll", () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      const nextPage = Math.max(0, Math.min(count - 1, Math.round(rail.scrollLeft / pageWidth())));
      if (nextPage !== page) {
        page = nextPage;
        updateControls();
      }
    });
  }, { passive:true });

  renderDots();
  requestAnimationFrame(()=>setPage(page, false));
  if (window.ResizeObserver) {
    onboardingAvatarResizeObserver = new ResizeObserver(()=>setPage(page, false));
    onboardingAvatarResizeObserver.observe(rail);
  }
}
function runFirstRunOnboarding() {
  if (profile.onboardingComplete) return Promise.resolve(false);
  const modal=$("#onboardingModal"), content=$("#onboardingContent"); if(!modal||!content)return Promise.resolve(false);
  return new Promise((resolve)=>{
    let step=0, avatar=profile.avatarEmoji||"🙂", name=profile.playerName==="Игрок"?"":profile.playerName;
    const pages=[
      ()=>`<div class="onboarding-step"><small>ДОБРО ПОЖАЛОВАТЬ</small><h2>Давай знакомиться!</h2><p>Имя и аватар будут видны друзьям в дуэлях.</p><label><span>Твоё имя</span><input id="onboardingName" maxlength="20" value="${escapeHtml(name)}" placeholder="Например, Альберт Эйнштейн" autocomplete="off"></label><div class="onboarding-avatar-picker"><button type="button" class="onboarding-avatar-scroll prev" data-avatar-scroll="prev" aria-label="Предыдущие аватары">‹</button><div class="onboarding-avatar-grid">${onboardingAvatarButtons(avatar)}</div><button type="button" class="onboarding-avatar-scroll next" data-avatar-scroll="next" aria-label="Следующие аватары">›</button></div><div class="onboarding-dots avatar-page-dots" data-avatar-dots></div></div>`,
      ()=>`<div class="onboarding-step"><small>КАК ИГРАТЬ · 1/3</small><h2>Ищи смысловые связи</h2><p>Карты одной ассоциации складываются вместе. Ручные точные переносы растят комбо.</p><div class="onboarding-demo"><span>ФРУКТЫ</span><b>ЯБЛОКО</b><b>ГРУША</b><b>СЛИВА</b></div></div>`,
      ()=>`<div class="onboarding-step"><small>КАК ИГРАТЬ · 2/3</small><h2>Используй быстрые ходы</h2><p>Двойной тап отправляет карту в открытую категорию или на подходящую карту ассоциации. Категории закрепляются в слотах сверху.</p><div class="onboarding-demo picture"><span>КИНО</span><b>🎬</b><b>🍿</b><b>🎟️</b><b>📽️</b></div></div>`,
      ()=>`<div class="onboarding-step"><small>КАК ИГРАТЬ · 3/3</small><h2>Колода, отмена и подсказка</h2><p>Колода открывает новые карты. «Отмена» возвращает ход, а маскот через «Подсказку» покажет, куда смотреть. В обучении подсказки бесплатны.</p><div class="onboarding-ready"><i>↻</i><span>Колода</span><i>↶</i><span>Отмена</span><i>✦</i><span>Подсказка</span></div></div>`,
      ()=>`<div class="onboarding-step"><small>ГОТОВО</small><h2>Теперь — 4 интерактивных шага</h2><p>Обучение будет следить за твоими действиями и менять подсказки по мере того, как ты пробуешь перенос, двойной тап, колоду, отмену и подсказку.</p><div class="onboarding-ready"><i>✦</i><span>Слова</span><i>🖼️</i><span>Картинки</span><i>⚔</i><span>Дуэли</span></div></div>`,
    ];
    const render=()=>{
      content.innerHTML=`${pages[step]()}${step===0?"":`<div class="onboarding-dots onboarding-step-dots">${pages.map((_,i)=>`<i class="${i===step?"active":""}"></i>`).join("")}</div>`}<div class="onboarding-actions">${step?`<button class="secondary" id="onboardingBack">Назад</button>`:""}<button class="primary" id="onboardingNext">${step===pages.length-1?"Начать обучение →":"Дальше →"}</button></div>`;
      const input=$("#onboardingName"); if(input) input.oninput=()=>{name=input.value;};
      content.querySelectorAll("[data-onboarding-avatar]").forEach((btn)=>btn.onclick=()=>{avatar=btn.dataset.onboardingAvatar;content.querySelectorAll("[data-onboarding-avatar]").forEach((x)=>x.classList.toggle("selected",x===btn));});
      bindOnboardingAvatarScroller(content);
      const back=$("#onboardingBack"); if(back)back.onclick=()=>{step=Math.max(0,step-1);render();};
      $("#onboardingNext").onclick=()=>{
        if(step===0){name=(input?.value||name||"").trim().replace(/\s+/g," ");if(!name){input?.focus();input?.classList.add("error");return;}profile.playerName=name.slice(0,20);profile.avatarEmoji=avatar;saveProfile();}
        if(step<pages.length-1){step++;render();return;}
        profile.onboardingComplete=true;profile.onboardingVersion=1;saveProfile();track("onboarding_complete");modal.classList.remove("show");modal.setAttribute("aria-hidden","true");resolve(true);
      };
      setTimeout(()=>$("#onboardingName")?.focus(),80);
    };
    modal.classList.add("show");modal.setAttribute("aria-hidden","false");track("onboarding_started");render();
  });
}

function bindEngagementUi() {
  const close=$("#weeklyDigestClose"), next=$("#weeklyDigestNext"); if(close)close.onclick=closeWeeklyDigest;if(next)next.onclick=closeWeeklyDigest;
  document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")setTimeout(()=>flushRemoteAnalytics(),1400);});
  window.addEventListener("online",()=>setTimeout(()=>flushRemoteAnalytics(),900));
}
