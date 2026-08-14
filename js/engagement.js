/* Product polish layer: onboarding, encyclopedia discovery, duel history,
   weekly recap, adaptive difficulty, quality diagnostics and privacy-light analytics. */
const REMOTE_ANALYTICS_QUEUE_KEY = "worditaire-analytics-queue-v1";
let remoteAnalyticsTimer = null;
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
  if (!/^https?:$/.test(location.protocol)) return false;
  let queue = [];
  try { queue = JSON.parse(localStorage.getItem(REMOTE_ANALYTICS_QUEUE_KEY)) || []; } catch {}
  if (!queue.length) return false;
  const batch = queue.slice(0, 30);
  try {
    const response = await fetch("/api/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: profile.analyticsClientId, events: batch }),
      cache: "no-store",
      keepalive: true,
    });
    if (!response.ok) return false;
    const rest = queue.slice(batch.length);
    localStorage.setItem(REMOTE_ANALYTICS_QUEUE_KEY, JSON.stringify(rest));
    if (rest.length) remoteAnalyticsTimer = setTimeout(flushRemoteAnalytics, 900);
    return true;
  } catch { return false; }
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
    ["🎮", data.games, "партий"], ["★", data.levels, "уровней"], ["▦", data.categories, "новых категорий"],
    ["🏆", data.achievements, "достижений"], ["⚔", data.seriesWins, "серий выиграно"], ["☀", data.daily, "Daily"],
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
  if(notify)queueAchievementNotifications?.([{icon:info.collection.icon,title:`Освоено: ${info.category.title}`,desc:`Все ${total} картинок открыты · +80 XP`}]);
  saveProfile();
  return true;
}

function profileFavoriteLabel() { return categoryDisplayName(profile.favoriteCategory) || "Не выбрана"; }
function profileShowcaseMarkup() {
  const featured=(profile.featuredAchievements||[]).map((id)=>ACHIEVEMENTS.find((a)=>a.id===id)).filter(Boolean).slice(0,3),
    rank=playerRank(profile), duels=duelHistorySummary();
  return `<section class="profile-showcase hub-section"><div class="hub-section-head"><h3>Визитка игрока</h3><small>${escapeHtml(rank.name)}</small></div>
    <div class="profile-showcase-grid"><div><span>Любимая категория</span><b>${profile.favoriteCategory?`${categoryDisplayIcon(profile.favoriteCategory)} ${escapeHtml(profileFavoriteLabel())}`:"—"}</b></div><div><span>Daily-серия</span><b>🔥 ${profile.daily.currentStreak||0}</b></div><div><span>Дуэли</span><b>${duels.wins}:${duels.losses}</b></div></div>
    <div class="featured-achievements">${featured.length?featured.map((a)=>`<span title="${escapeHtml(a.title)}"><i>${a.icon}</i><b>${escapeHtml(a.title)}</b></span>`).join(""):`<small>Выбери до 3 достижений в редакторе профиля</small>`}</div>
  </section>`;
}

function completedDuelEntries() {
  const out=[], seen=new Set();
  for (const entry of profile.sentChallenges || []) if(entry?.code && entry.creatorResult && entry.guestResult && !seen.has(entry.code)){seen.add(entry.code);out.push({entry,perspective:"creator",opponent:entry.guestResult.playerName||"Друг",opponentAvatar:entry.guestResult.avatarEmoji||"🙂",completedAt:+entry.completedAt||+entry.guestResult.completedAt||0});}
  for (const entry of profile.receivedChallenges || []) if(entry?.code && entry.creatorResult && entry.guestResult && !seen.has(entry.code)){seen.add(entry.code);out.push({entry,perspective:"guest",opponent:entry.creatorName||entry.creatorResult.playerName||"Друг",opponentAvatar:entry.creatorAvatar||entry.creatorResult.avatarEmoji||"🙂",completedAt:+entry.completedAt||+entry.creatorResult.completedAt||0});}
  return out.sort((a,b)=>b.completedAt-a.completedAt);
}
function duelHistorySummary() {
  let wins=0,losses=0,draws=0;
  for(const x of completedDuelEntries()){
    const me=x.perspective==="guest"?x.entry.guestResult:x.entry.creatorResult, fr=x.perspective==="guest"?x.entry.creatorResult:x.entry.guestResult, r=challengeOutcome(me,fr);
    if(r>0)wins++; else if(r<0)losses++; else draws++;
  }
  return {wins,losses,draws,total:wins+losses+draws};
}
function duelHistoryGroups() {
  const groups=new Map();
  for(const x of completedDuelEntries()){
    const key=String(x.opponent||"Друг").trim().toLowerCase();
    if(!groups.has(key)) groups.set(key,{name:x.opponent,avatar:x.opponentAvatar,matches:0,wins:0,losses:0,draws:0,moves:0,errors:0,last:x});
    const g=groups.get(key), me=x.perspective==="guest"?x.entry.guestResult:x.entry.creatorResult, fr=x.perspective==="guest"?x.entry.creatorResult:x.entry.guestResult, r=challengeOutcome(me,fr);
    g.matches++;g.moves+=me.moves||0;g.errors+=me.errors||0;if(r>0)g.wins++;else if(r<0)g.losses++;else g.draws++; if(x.completedAt>(g.last?.completedAt||0))g.last=x;
  }
  return [...groups.values()].sort((a,b)=>(b.last?.completedAt||0)-(a.last?.completedAt||0));
}
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
    ? `<div class="duel-history-list">${groups.map(g=>`<article><span class="duel-history-avatar">${g.avatar}</span><div><b>${escapeHtml(g.name)}</b><small>${g.matches} игр · ${g.wins}:${g.losses}${g.draws?` · ничьи ${g.draws}`:""}</small><em>Ø ${Math.round(g.moves/Math.max(1,g.matches))} ход. · Ø ${(g.errors/Math.max(1,g.matches)).toFixed(1)} ошибок</em></div><button data-duel-history-rematch="${g.last.entry.code}" data-duel-perspective="${g.last.perspective}">Вызов</button></article>`).join("")}</div>`
    : `<div class="empty-state">Полностью завершённые матчи появятся здесь</div>`;
}
function duelsHubMarkup(view="active") {
  const active=activeDuelEntries(), completed=completedDuelEntries(), current=view==="history"?"history":"active";
  const activeMarkup=active.length
    ? `<div class="owned-challenge-list duel-active-list">${active.map(x=>x.perspective==="guest"?receivedChallengeCardMarkup(x.entry,{compact:true}):ownedChallengeCardMarkup(x.entry,{compact:true})).join("")}</div>`
    : `<div class="empty-state">Активных вызовов сейчас нет</div>`;
  return `<section class="hub-section duels-hub">
    <div class="hub-section-head"><h3>Дуэли</h3><small>${active.length} активных · ${completed.length} матчей</small></div>
    <div class="duel-tabs">
      <button class="${current==="active"?"active":""}" data-duel-tab="active">Активные <span>${active.length}</span></button>
      <button class="${current==="history"?"active":""}" data-duel-tab="history">История <span>${completed.length}</span></button>
    </div>
    <div class="duel-tab-content">${current==="active"?activeMarkup:duelHistoryContentMarkup()}</div>
  </section>`;
}
function duelHistoryMarkup() {
  return `<section class="hub-section duel-history"><div class="hub-section-head"><h3>История дуэлей</h3><small>${completedDuelEntries().length} матчей</small></div>${duelHistoryContentMarkup()}</section>`;
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
  add("Словесная база загружена",BANK.length>=100,`${BANK.length} категорий`);
  add("Картинки расширены",totalVisualCategoryCount()>=150,`${totalVisualCategoryCount()} категорий`);
  const ids=allAssociationCategories().map((x)=>x.id), unique=new Set(ids); add("ID картинок уникальны",unique.size===ids.length,`${ids.length-unique.size} дублей`);
  const broken=[]; for(const c of ASSOCIATION_COLLECTION_DEFS) for(const cat of c.categories) if(!Array.isArray(cat.cards)||cat.cards.length<5||cat.cards.some((x)=>!x?.[0])) broken.push(`${c.id}/${cat.id}`);
  add("Категории картинок валидны",broken.length===0,broken.slice(0,3).join(", "));
  const domIds=["tableau","slotsAnchor","stock","waste","hub","hubContent","hubNav","modal","profileEditorModal","onboardingModal","weeklyDigestModal"]; const missing=domIds.filter((id)=>!document.getElementById(id)); add("Ключевой UI найден",missing.length===0,missing.join(", "));
  add("Профиль читается",!!profile && !!profile.settings,"profile/settings");
  add("Генератор доступен",typeof buildGeneratedLevel==="function");
  qualityAuditReport={ok:warnings.length===0,checks,warnings,at:Date.now()};
  window.worditaireQa=qualityAuditReport;
  return qualityAuditReport;
}
function qualityAuditMarkup() {
  const r=qualityAuditReport?.checks?.length?qualityAuditReport:runQualityAudit();
  return `<div class="qa-summary ${r.ok?"ok":"warn"}"><b>${r.ok?"✓ Проверка пройдена":`⚠ ${r.warnings.length} предупреждений`}</b><span>${r.checks.filter(x=>x.ok).length}/${r.checks.length} проверок</span></div><div class="qa-checks">${r.checks.map(x=>`<span class="${x.ok?"ok":"warn"}"><i>${x.ok?"✓":"!"}</i>${escapeHtml(x.name)}${x.detail?`<small>${escapeHtml(x.detail)}</small>`:""}</span>`).join("")}</div>`;
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
function bindOnboardingAvatarScroller(root) {
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
    const ro = new ResizeObserver(()=>setPage(page, false));
    ro.observe(rail);
  }
}
function runFirstRunOnboarding() {
  if (profile.onboardingComplete) return Promise.resolve(false);
  const modal=$("#onboardingModal"), content=$("#onboardingContent"); if(!modal||!content)return Promise.resolve(false);
  return new Promise((resolve)=>{
    let step=0, avatar=profile.avatarEmoji||"🙂", name=profile.playerName==="Игрок"?"":profile.playerName;
    const pages=[
      ()=>`<div class="onboarding-step"><small>ДОБРО ПОЖАЛОВАТЬ</small><h2>Давай знакомиться!</h2><p>Имя и аватар будут видны друзьям в вызовах.</p><label><span>Твоё имя</span><input id="onboardingName" maxlength="20" value="${escapeHtml(name)}" placeholder="Например, Альберт Эйнштейн" autocomplete="off"></label><div class="onboarding-avatar-picker"><button type="button" class="onboarding-avatar-scroll prev" data-avatar-scroll="prev" aria-label="Предыдущие аватары">‹</button><div class="onboarding-avatar-grid">${onboardingAvatarButtons(avatar)}</div><button type="button" class="onboarding-avatar-scroll next" data-avatar-scroll="next" aria-label="Следующие аватары">›</button></div><div class="onboarding-dots avatar-page-dots" data-avatar-dots></div></div>`,
      ()=>`<div class="onboarding-step"><small>КАК ИГРАТЬ · 1/2</small><h2>Ищи смысловые связи</h2><p>Открытые карты одной категории складываются вместе. Можно тащить всю открытую стопку.</p><div class="onboarding-demo"><span>МОРЕ</span><b>ВОЛНА</b><b>ПРИБОЙ</b><b>ОКЕАН</b></div></div>`,
      ()=>`<div class="onboarding-step"><small>КАК ИГРАТЬ · 2/2</small><h2>Собирай категории сверху</h2><p>Карточку категории отправь в свободный слот, затем собирай туда все связанные слова или картинки.</p><div class="onboarding-demo picture"><span>КИНО</span><b>🎬</b><b>🍿</b><b>🎟️</b><b>📽️</b></div></div>`,
      ()=>`<div class="onboarding-step"><small>ГОТОВО</small><h2>Начнём с короткого обучения</h2><p>Три простых расклада покажут перенос категории, сбор стопок и работу колоды. Потом откроется весь Словасьянс.</p><div class="onboarding-ready"><i>✦</i><span>Слова</span><i>🖼️</i><span>Картинки</span><i>⚔</i><span>Вызовы</span></div></div>`,
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
  document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="hidden")flushRemoteAnalytics();});
  window.addEventListener("pagehide",()=>flushRemoteAnalytics());
}
