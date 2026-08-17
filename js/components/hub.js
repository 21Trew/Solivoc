/* Game hub: play, progression, encyclopedia, appearance and settings. */
let hubChapterNumber = null,
  hubTab = "home",
  hubCategoryId = null,
  hubVisualCategoryId = null,
  hubEncyclopediaType = "words",
  hubDuelTab = "active",
  encyclopediaFilter = "all",
  encyclopediaQuery = "",
  encyclopediaSort = "progress",
  achievementFilter = "all",
  hubExpandedSections = new Set();

function isStandalonePwa() {
  return window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;
}
function levelStarsMarkup(stars) {
  return stars ? `${"★".repeat(stars)}${"☆".repeat(3 - stars)}` : "···";
}
function titleCurrent() {
  return titleDefById(profile.titleId) || TITLE_DEFS[0];
}
function themeUnlocked(def) {
  return profile.totalStars >= def.stars;
}
function themeUnlockLabel(def) {
  return def.stars ? `${def.stars} ★` : "Базовая";
}
function hubTabsMarkup() {
  const level = profile.currentLevel || 1,
    tabs = HUB_TAB_DEFS.map((item) => `<button class="${hubTab === item.id ? "active" : ""}" data-hub-tab="${item.id}"><i>${item.icon}</i><span>${item.label}</span></button>`).join("");
  return `<nav class="hub-tabs">${tabs}<button class="hub-play" data-hub-resume aria-label="Продолжить уровень ${level}"><i>▶</i><span>Играть</span></button></nav>`;
}
function renderGlobalProfileHeaders() {
  const rank=typeof playerRank==="function"?playerRank(profile):{name:"Новичок"},xp=typeof xpLevelProgress==="function"?xpLevelProgress(profile):{level:1,ratio:0,value:0,goal:100},title=titleCurrent();
  const values=[["#gameProfileAvatar",profile.avatarEmoji||"🙂"],["#gameProfileName",profile.playerName||"Игрок"],["#gameProfileTitle",`${title.icon||"◇"} ${title.name}`],["#gameProfileMeta",`${xp.value}/${xp.goal} XP`],["#hubProfileAvatar",profile.avatarEmoji||"🙂"],["#hubProfileName",profile.playerName||"Игрок"],["#hubProfileTitle",`${title.icon||"◇"} ${title.name}`]];
  for(const [selector,value] of values){const el=$(selector);if(el)el.textContent=value;}
  const gameRank=$("#gameProfileRank");if(gameRank)gameRank.textContent=`Ранг ${xp.level} · ${rank.name}`;
  const hubRank=$("#hubProfileRank");if(hubRank)hubRank.innerHTML=`<b>Ранг ${xp.level}</b><small>${escapeHtml(rank.name)}</small><small>${xp.value}/${xp.goal} XP</small>`;
  const frame=FRAME_DEFS.find(f=>f.id===profile.frame)||FRAME_DEFS[0]; [$("#gameProfileAvatar"),$("#hubProfileAvatar")].filter(Boolean).forEach(avatar=>{avatar.dataset.frame=frame.id;avatar.style.setProperty("--frame-h",frame.hue||250);});
  const bar=$("#hubProfileXpBar");if(bar)bar.style.width=`${Math.max(0,Math.min(1,xp.ratio||0))*100}%`;
}
function collapsibleSectionMarkup(key, title, subtitle, content, extraClass = "") {
  const open = hubExpandedSections.has(key);
  return `<details class="hub-section collapsible-section ${extraClass}" data-collapsible="${key}" ${open ? "open" : ""}>
    <summary class="hub-section-head"><div><h3>${title}</h3><small>${subtitle}</small></div><i class="section-chevron">⌄</i></summary>
    <div class="collapsible-content">${content}</div>
  </details>`;
}
function chapterMarkup(number) {
  const info = chapterInfo((number - 1) * CHAPTER_SIZE + 1),
    levels = [];
  for (let level = info.start; level <= info.end; level++) {
    const unlocked = level <= (profile.currentLevel || 1),
      stars = profile.starsByLevel[level] || 0,
      special = specialForLevel(level),
      current = state?.mode === "regular" && state.level === level;
    levels.push(
      `<button class="chapter-level ${unlocked ? "unlocked" : "locked"} ${current ? "current" : ""}" data-chapter-level="${level}" ${unlocked ? "" : "disabled"}><span class="chapter-level-number">${special ? `<i>${special.icon}</i>` : ""}${level}</span><span class="chapter-level-stars">${unlocked ? levelStarsMarkup(stars) : "🔒"}</span></button>`,
    );
  }
  const earned = chapterStarsForProfile(profile, number).reduce((a, b) => a + b, 0),
    perfect = earned === 30;
  return `<section class="hub-section chapter-section ${perfect ? "perfect" : ""}">
    <div class="hub-section-head chapter-head"><button class="chapter-nav" id="chapterPrev" ${number <= 1 ? "disabled" : ""}>‹</button><div><h3>Глава ${number} · ${info.title}</h3><small>${earned}/30 ★${perfect ? " · идеально" : ""}</small></div><button class="chapter-nav" id="chapterNext" ${info.end >= (profile.currentLevel || 1) ? "disabled" : ""}>›</button></div>
    <div class="chapter-path">${levels.join("")}</div>
  </section>`;
}
function weeklyMarkup() {
  const w = weeklyProgress(), daysLeft = typeof daysUntilWeekEnd === "function" ? daysUntilWeekEnd() : 0;
  return `<section class="weekly-card ${w.completed ? "done" : ""}">
    <div class="weekly-icon">${w.def.icon}</div>
    <div class="weekly-copy"><small>НЕДЕЛЬНОЕ ИСПЫТАНИЕ</small><b>${w.def.title}</b><span>${w.def.desc}</span><div class="weekly-progress"><i style="width:${w.ratio * 100}%"></i></div><em>${w.value}/${w.goal}${w.completed ? ` · выполнено ✓ · +${w.def.rewardXp || 0} XP` : ` · ${daysLeft ? `осталось ${daysLeft} дн.` : "последний день"}`}</em></div>
  </section>`;
}
function monthlyMarkup() {
  const m = monthlyProgress(), daysLeft = typeof daysUntilMonthEnd === "function" ? daysUntilMonthEnd() : 0;
  return `<section class="weekly-card monthly-card ${m.completed ? "done" : ""}">
    <div class="weekly-icon monthly-icon">${m.def.icon}</div>
    <div class="weekly-copy"><small>МЕСЯЧНОЕ ИСПЫТАНИЕ</small><b>${m.def.title}</b><span>${m.def.desc}</span><div class="weekly-progress"><i style="width:${m.ratio * 100}%"></i></div><em>${m.value}/${m.goal}${m.completed ? ` · выполнено ✓ · +${m.def.rewardXp || 0} XP` : ` · осталось ${daysLeft} дн.`}</em></div>
  </section>`;
}
function modesTabMarkup() {
  const dailyDone = profile.daily.completedDates.includes(todayKey());
  const copy = {
    daily: { description: dailyDone ? "Сегодня пройдено ✓" : "Один расклад для всех", meta: "Новый каждый день" },
    marathon: { description: "Только идеальные расклады продолжают серию", meta: `Рекорд: ${profile.stats.bestMarathon || 0}` },
    zen: { description: "Бесконечные расклады без давления", meta: "Для спокойной игры" },
    duel: { description: "Одинаковый расклад для двух игроков", meta: "Серия до 2 побед" },
    pictures: { description: "Тематические расклады только с картинками", meta: `${ASSOCIATION_COLLECTION_DEFS.length} наборов` },
    time: { description: "Успей собрать расклад до конца обратного отсчёта", meta: "Таймер идёт назад" },
    moves: { description: "Собери расклад, не превысив лимит ходов", meta: "Лимит зависит от расклада" },
    combo: { description: "Достигни заданного множителя комбо", meta: "Цель показывается в игре" },
    noMistakes: { description: "Первая ошибка завершает партию", meta: "Один шанс" },
    onePass: { description: "Пройди колоду один раз без возврата сброса", meta: "Без второй прокрутки" },
    custom: { description: "Сам выбери таймер, ходы, комбо и другие ограничения", meta: "Твои ограничения" },
  };
  const cards = GAME_MODE_DEFS.map((def) => modeCardMarkup({ ...def, ...(copy[def.id] || {}) })).join("");
  return `<section class="hub-section modes-intro"><div class="hub-section-head"><div><h3>Режимы игры</h3><small>у каждого режима свой темп и правила</small></div><button class="leaders-open" id="leaderboardOpen">Лидеры</button></div><div class="mode-grid">${cards}</div></section>
    ${typeof duelsHubMarkup === "function" ? duelsHubMarkup(hubDuelTab) : `${ownedChallengesMarkup()}${receivedChallengesMarkup()}`}
    <section class="hub-section duel-create"><div class="hub-section-head"><div><h3>Новая дуэль</h3><small>кто выбирает правило</small></div></div><div class="duel-create-controls"><select id="duelModeChoice"><option value="creator">Я выбираю режим</option><option value="guest">Пусть выберет друг</option><option value="random">Случайный режим</option></select><select id="duelCreateMode">${DUEL_MODE_DEFS.map(x=>`<option value="${x.id}">${x.icon} ${x.label}</option>`).join("")}</select><button id="duelCreate">Создать и отправить</button></div></section>
    <section class="hub-section challenge-enter"><div class="hub-section-head"><h3>Код дуэли</h3><small>6 символов</small></div><div class="challenge-input-row"><input id="challengeInput" inputmode="text" autocomplete="off" autocapitalize="characters" maxlength="6" placeholder="ABC123"><button id="challengeStart">Открыть</button></div></section>`;
}

function homeTabMarkup() {
  return `<section class="home-welcome"><div class="home-welcome-copy"><small>ГЛАВНАЯ</small><h2>Продолжим?</h2><p>Серия, недельная цель и следующий лучший ход — на одном экране.</p></div></section>
    ${typeof smartHomeMarkup === "function" ? smartHomeMarkup() : ""}
    ${typeof dailyCalendarMarkup === "function" ? dailyCalendarMarkup() : ""}
    ${typeof dailyModeQuestsMarkup === "function" ? dailyModeQuestsMarkup() : ""}
    ${weeklyMarkup()}
    ${monthlyMarkup()}`;
}

function achievementCardMarkup(a) {
  const done = profile.achievements.includes(a.id), progress = achievementProgressData(a, profile), ratio = progress ? progress.value / progress.goal : done ? 1 : 0,
    icon = String(a.icon || "🏆"), iconClass = [...icon].length > 3 ? "icon-long" : [...icon].length > 2 ? "icon-medium" : "";
  return `<div class="achievement ${done ? "done-achievement" : "locked"} ${a.rare ? "rare" : ""}"><div class="ico ${iconClass}" title="${escapeHtml(a.title)}">${escapeHtml(icon)}</div><div class="achievement-copy"><b>${escapeHtml(a.title)}</b><p>${escapeHtml(a.desc)}${a.rare ? " · редкое" : ""}</p>${progress ? `<div class="achievement-progress"><i style="width:${Math.min(1, ratio) * 100}%"></i></div><small>${progress.value}/${progress.goal}</small>` : ""}</div><span class="done">${done ? "✓" : ""}</span></div>`;
}
function progressTabMarkup() {
  const chaptersDone = completedChapterCount(profile), perfectChapters = perfectChapterCount(profile), discoveredCount = discoveredCategoryCount(profile);
  let filtered = ACHIEVEMENTS.filter((a) => {
    const done = profile.achievements.includes(a.id), p = achievementProgressData(a, profile);
    if (achievementFilter === "done") return done;
    if (achievementFilter === "near") return !done && !!p;
    if (achievementFilter === "rare") return !!a.rare;
    if (achievementFilter === "legendary") return !!a.legendary;
    return true;
  });
  if (achievementFilter === "near") {
    filtered = filtered.sort((a, b) => {
      const ap = achievementProgressData(a, profile), bp = achievementProgressData(b, profile);
      const ar = ap ? ap.value / Math.max(1, ap.goal) : 0, br = bp ? bp.value / Math.max(1, bp.goal) : 0;
      if (br !== ar) return br - ar;
      const aLeft = ap ? ap.goal - ap.value : Infinity, bLeft = bp ? bp.goal - bp.value : Infinity;
      return aLeft - bLeft;
    });
  }
  const duelStats = typeof syncDuelStats === "function" ? syncDuelStats() : { total: profile.stats.duelMatches || 0, wins: profile.stats.duelWins || 0 };
  const statsItems = [
    [profile.stats.levelsCompleted, "уровней"], [profile.stats.gamesPlayed || 0, "партий"],
    [discoveredCount, "категорий"], [profile.stats.tripleStarWins, "★★★"],
    [profile.stats.totalMoves || 0, "ходов"], [profile.stats.personalRecords || 0, "рекордов"],
    [`×${profile.stats.maxDragCombo || 0}`, "комбо"], [profile.stats.bestMarathon || 0, "марафон"],
    [chaptersDone, "глав"], [perfectChapters, "идеальных глав"],
    [typeof playerXpLevel === "function" ? playerXpLevel(profile) : 1, "ранг"], [profile.xp || 0, "XP"],
    [profile.stats.masteredCategories || 0, "освоено"], [profile.stats.bonusObjectivesCompleted || 0, "бонусов"],
    [duelStats.total || 0, "дуэлей"], [duelStats.wins || 0, "побед в дуэлях"],
  ];
  const statsContent = `<div class="stats-grid expanded">${statsItems.map(([value,label])=>statBoxMarkup(value,label)).join("")}</div>`;
  const currentChapter = chapterInfo(profile.currentLevel || 1);
  if (!hubChapterNumber) hubChapterNumber = currentChapter.number;
  hubChapterNumber = Math.max(1, Math.min(hubChapterNumber, currentChapter.number));
  return `${typeof nearGoalsMarkup === "function" ? nearGoalsMarkup(2) : ""}
    ${typeof rankRewardsRoadmapMarkup === "function" ? rankRewardsRoadmapMarkup(5) : ""}
    ${typeof loginRewardsMarkup === "function" ? loginRewardsMarkup() : ""}
    ${chapterMarkup(hubChapterNumber)}
    ${collapsibleSectionMarkup("statistics", "Статистика", "твоя история", statsContent)}
    <section class="hub-section"><div class="hub-section-head"><h3>Достижения</h3><small>${profile.achievements.length}/${ACHIEVEMENTS.length}</small></div>
      <div class="achievement-filters">${[["all","Все"],["near","Ближайшие"],["rare","Редкие"],["legendary","Легендарные"],["done","Получены"]].map(([id,label])=>`<button class="${achievementFilter===id?"active":""}" data-ach-filter="${id}">${label}</button>`).join("")}</div>
      <div class="achievement-list">${filtered.map(achievementCardMarkup).join("") || `<div class="empty-state">Здесь пока пусто</div>`}</div>
    </section>`;
}
function categoryDetailMarkup(cat) {
  if (!cat) return `<div class="empty-state">Выбери открытую категорию</div>`;
  const stat = categoryStat(cat.id), known = new Set(stat.words || []), completions = stat.completions || 0, mastery = typeof categoryMasteryData === "function" ? categoryMasteryData(cat.id) : {ratio:known.size/cat.words.length,mastered:false};
  return `<article class="encyclopedia-detail ${mastery.mastered?"mastered":""}"><div class="encyclopedia-title"><span style="--cat:${catHue(cat.id)}">${mastery.mastered?"★":cat.title.slice(0,1)}</span><div><b>${cat.title}</b><small>${mastery.mastered?"Категория освоена ★":`${known.size}/${cat.words.length} слов встречено`}</small></div></div>
    <div class="mastery-progress"><i style="width:${mastery.ratio*100}%"></i><span>${known.size}/${cat.words.length}</span></div>
    <div class="encyclopedia-meta"><span>Встречалась <b>${stat.encounters || 0}</b> раз</span><span>Собрана <b>${completions}</b> раз</span><span>Впервые: <b>${stat.firstLevel || "—"}</b></span></div>
    <div class="word-collection">${cat.words.map((w)=>`<span class="${known.has(w)?"known":"unknown"}">${known.has(w)?w:"???"}</span>`).join("")}</div></article>`;
}
function visualCategoryDetailMarkup(id) {
  const info = visualCategoryById(id);
  if (!info) return `<div class="empty-state">Выбери открытую категорию картинок</div>`;
  const visual = associationCollectionCategories(info.collection.id).find((x) => x.id === id),
    stat = categoryStat(id),
    legacyCompleted = associationCollectionProgress(info.collection.id).completedCategories.includes(id),
    known = new Set((stat.words?.length ? stat.words : legacyCompleted ? visual.words : []) || []),
    discovered = visualDiscoveredIds(profile).has(id),
    completions = stat.completions || (legacyCompleted ? 1 : 0);
  if (!discovered) return `<div class="empty-state">Эта категория картинок ещё не встречалась</div>`;
  return `<article class="encyclopedia-detail visual-encyclopedia-detail">
    <div class="encyclopedia-title"><span class="visual-category-icon">${info.collection.icon}</span><div><b>${escapeHtml(info.category.title)}</b><small>${escapeHtml(info.collection.name)} · ${known.size}/${visual.words.length} картинок встречено</small></div></div>
    <div class="mastery-progress"><i style="width:${Math.min(1, known.size / Math.max(1, visual.words.length)) * 100}%"></i><span>${known.size}/${visual.words.length}</span></div>
    <div class="encyclopedia-meta"><span>Встречалась <b>${stat.encounters || 0}</b> раз</span><span>Собрана <b>${stat.completions || 0}</b> раз</span><span>Впервые: <b>${escapeHtml(stat.firstLevel || "—")}</b></span></div>
    <div class="picture-collection">${info.category.cards.map(([emoji,label])=>`<span class="${known.has(emoji)?"known":"unknown"}" title="${known.has(emoji)?escapeHtml(label):"Не открыто"}">${known.has(emoji)?emoji:"❔"}</span>`).join("")}</div>
  </article>`;
}
function associationCollectionCardsMarkup() {
  return ASSOCIATION_COLLECTION_DEFS.map((collection) => {
    const progress = associationCollectionProgress(collection.id), samples = collection.categories.slice(0, 3);
    return `<button class="association-collection-card" data-association-collection="${collection.id}">
      <span class="association-collection-preview">${samples.map((cat) => `<i title="${escapeHtml(cat.title)}">${cat.cards[0][0]}</i>`).join("")}</span>
      <span class="association-collection-copy"><b>${collection.icon} ${collection.name}</b><small>${escapeHtml(collection.desc)}</small></span>
      <span class="association-collection-progress"><i style="width:${progress.total ? (progress.completed / progress.total) * 100 : 0}%"></i></span>
      <span class="association-collection-meta">${progress.completed}/${progress.total} категорий${progress.completed === progress.total ? " · освоено ✓" : " · играть →"}</span>
    </button>`;
  }).join("");
}
function associationCollectionsMarkup() {
  return `<div class="association-collections-block"><div class="hub-subhead"><h4>Расклады по картинкам</h4><small>тематические режимы только с emoji-карточками</small></div><div class="association-collection-grid">${associationCollectionCardsMarkup()}</div></div>`;
}
function closeCustomRulesModal() {
  const modal = $("#customRulesModal");
  if (!modal) return;
  modal.classList.remove("show");
  modal.setAttribute("aria-hidden", "true");
}
function openCustomRulesModal() {
  const modal = $("#customRulesModal");
  if (!modal) return;
  const c = profile.customRules || {};
  const time = $("#customTime"), moves = $("#customMoves"), combo = $("#customCombo"), noMistakes = $("#customNoMistakes"), onePass = $("#customOnePass");
  if (time) time.value = +c.timeLimitSec || 0;
  if (moves) moves.value = +c.moveLimit || 0;
  if (combo) combo.value = +c.comboTarget || 0;
  if (noMistakes) noMistakes.checked = !!c.noMistakes;
  if (onePass) onePass.checked = !!c.onePass;
  modal.classList.add("show");
  modal.setAttribute("aria-hidden", "false");
}

function closePictureModePicker() {
  const modal = $("#pictureModeModal");
  if (!modal) return;
  modal.classList.remove("show");
  modal.setAttribute("aria-hidden", "true");
}
function openPictureModePicker() {
  const modal = $("#pictureModeModal"), content = $("#pictureModeContent");
  if (!modal || !content) return;
  content.innerHTML = `<div class="picture-mode-head"><small>РЕЖИМ КАРТИНКИ</small><h2>Выбери набор</h2><p>В раскладе будут только карточки с изображениями.</p></div><div class="association-collection-grid">${associationCollectionCardsMarkup()}</div>`;
  content.querySelectorAll("[data-association-collection]").forEach((btn) => btn.onclick = () => {
    const id = btn.dataset.associationCollection;
    closePictureModePicker();
    closeHub();
    makeLevel(1, { mode:"collection", collectionId:id, seed:`collection:${id}:${Date.now()}` });
  });
  $("#pictureModeClose").onclick = closePictureModePicker;
  modal.onclick = (e) => { if (e.target === modal) closePictureModePicker(); };
  modal.classList.add("show");
  modal.setAttribute("aria-hidden", "false");
}

function encyclopediaToolbarMarkup() {
  const filters=[["all","Все"],["open","Открытые"],["unfinished","Не завершены"],["mastered","Освоены"],["new","Новые"]];
  return `<div class="encyclopedia-tools"><label class="encyclopedia-search"><i>⌕</i><input id="encyclopediaSearch" value="${escapeHtml(encyclopediaQuery)}" placeholder="Найти категорию"></label><div class="encyclopedia-filters">${filters.map(([id,label])=>`<button class="${encyclopediaFilter===id?"active":""}" data-ency-filter="${id}">${label}</button>`).join("")}</div><div class="encyclopedia-sort"><span>Сортировка</span>${[["progress","Прогресс"],["name","А–Я"],["new","Новые"]].map(([id,label])=>`<button class="${encyclopediaSort===id?"active":""}" data-ency-sort="${id}">${label}</button>`).join("")}</div></div>`;
}
function filteredEncyclopediaItems(type="words") {
  const source=type==="pictures"?allAssociationCategories():BANK, q=encyclopediaQuery.trim().toLocaleLowerCase("ru");
  const list=source.map((cat)=>{
    const state=categoryFilterState?.(cat.id,type)||{seen:false,mastered:false,recent:false,unfinished:false}, stat=categoryStat(cat.id),
      total=type==="pictures"?(visualCategoryById(cat.id)?.category?.cards?.length||cat.words.length):(cat.words?.length||1), known=(stat.words||[]).length,
      ratio=state.mastered?1:Math.min(1,known/Math.max(1,total));
    return {cat,state,stat,ratio};
  }).filter((item)=>{
    if(q && (!item.state.seen || !String(item.cat.title||"").toLocaleLowerCase("ru").includes(q))) return false;
    if(encyclopediaFilter==="open") return item.state.seen;
    if(encyclopediaFilter==="unfinished") return item.state.unfinished;
    if(encyclopediaFilter==="mastered") return item.state.mastered;
    if(encyclopediaFilter==="new") return item.state.recent;
    return true;
  });
  list.sort((a,b)=>{
    if(encyclopediaSort==="name") return String(a.cat.title).localeCompare(String(b.cat.title),"ru");
    if(encyclopediaSort==="new") return +(b.stat.discoveredAt||0)-+(a.stat.discoveredAt||0);
    return (Number(b.state.seen)-Number(a.state.seen)) || (b.ratio-a.ratio) || String(a.cat.title).localeCompare(String(b.cat.title),"ru");
  });
  return list;
}
function wordEncyclopediaGridMarkup() {
  const items=filteredEncyclopediaItems("words");
  return `<div class="collection-grid encyclopedia-grid">${items.map(({cat,state})=>`<button class="collection-item ${state.seen?"seen":"locked"} ${state.mastered?"mastered":""} ${hubCategoryId===cat.id?"selected":""}" data-category-id="${cat.id}" ${state.seen?"":"disabled"}>${state.seen?`${state.mastered?"★ ":""}${escapeHtml(cat.title)}`:"???"}</button>`).join("") || `<div class="empty-state encyclopedia-empty">Ничего не найдено</div>`}</div>`;
}
function pictureEncyclopediaGridMarkup() {
  const allowed=new Map(filteredEncyclopediaItems("pictures").map((x)=>[x.cat.id,x]));
  const groups=ASSOCIATION_COLLECTION_DEFS.map((collection)=>{
    const categories=associationCollectionCategories(collection.id).filter((c)=>allowed.has(c.id));
    if(!categories.length)return "";
    return `<section class="visual-category-group"><div class="visual-category-group-head"><b>${collection.icon} ${escapeHtml(collection.name)}</b><span>${categories.filter((c)=>allowed.get(c.id).state.seen).length}/${categories.length}</span></div><div class="collection-grid encyclopedia-grid visual-grid">${categories.map((cat)=>{const item=allowed.get(cat.id),state=item.state,stat=item.stat,info=visualCategoryById(cat.id),sample=info?.category?.cards?.[0]?.[0]||collection.icon;return `<button class="collection-item visual-item ${state.seen?"seen":"locked"} ${state.mastered?"mastered":""} ${hubVisualCategoryId===cat.id?"selected":""}" data-visual-category-id="${cat.id}" ${state.seen?"":"disabled"}><i>${state.seen?sample:"?"}</i><span>${state.seen?escapeHtml(cat.title):"???"}</span>${state.seen&&stat.completions?`<em>${stat.completions}×</em>`:""}</button>`;}).join("")}</div></section>`;
  }).join("");
  return `<div class="visual-category-groups">${groups||`<div class="empty-state encyclopedia-empty">Ничего не найдено</div>`}</div>`;
}
function collectionTabMarkup() {
  const wordDiscovered=new Set(profile.discovered),wordCount=discoveredCategoryCount(profile),pictureDiscovered=visualDiscoveredIds(profile),pictureCount=pictureDiscovered.size,pictureTotal=totalVisualCategoryCount(),totalCount=wordCount+pictureCount,totalCategories=BANK.length+pictureTotal;
  if(!hubCategoryId||!wordDiscovered.has(hubCategoryId))hubCategoryId=BANK.find((c)=>wordDiscovered.has(c.id))?.id||null;
  if(!hubVisualCategoryId||!pictureDiscovered.has(hubVisualCategoryId))hubVisualCategoryId=allAssociationCategories().find((c)=>pictureDiscovered.has(c.id))?.id||null;
  const cat=BANK.find((c)=>c.id===hubCategoryId),tabs=`<div class="encyclopedia-type-tabs"><button class="${hubEncyclopediaType==="words"?"active":""}" data-encyclopedia-tab="words"><b>Слова</b><span>${wordCount}/${BANK.length}</span></button><button class="${hubEncyclopediaType==="pictures"?"active":""}" data-encyclopedia-tab="pictures"><b>Картинки</b><span>${pictureCount}/${pictureTotal}</span></button></div>`,toolbar=encyclopediaToolbarMarkup();
  const words=`<div class="encyclopedia-pane">${categoryDetailMarkup(cat)}${toolbar}${wordEncyclopediaGridMarkup()}</div>`;
  const pictures=`<div class="encyclopedia-pane"><div class="hub-subhead picture-categories-head"><h4>Категории картинок</h4><small>${pictureCount}/${pictureTotal} открыто</small></div>${visualCategoryDetailMarkup(hubVisualCategoryId)}${toolbar}${pictureEncyclopediaGridMarkup()}</div>`;
  return `<section class="hub-section encyclopedia-shell"><div class="hub-section-head encyclopedia-main-head"><div><h3>Энциклопедия</h3><small>все ассоциации в одном месте</small></div><strong>${totalCount}/${totalCategories}</strong></div>${tabs}${hubEncyclopediaType==="pictures"?pictures:words}</section>`;
}
function cardBackMarkup() {
  return CARD_BACK_DEFS.map((back) => {
    const unlocked = cardBackUnlocked(back), selected = profile.cardBack === back.id;
    return `<button class="cardback-tile ${unlocked ? "" : "locked"} ${selected ? "selected" : ""} ${back.rare ? "rare" : ""}" data-card-back-id="${back.id}"><span class="cardback-preview back-${back.id}"><i>${back.rare ? "✦" : ""}</i></span><b>${back.name}</b><span>${unlocked ? (selected ? "Выбрано" : "Открыто") : cardBackUnlockLabel(back)}</span></button>`;
  }).join("");
}
function avatarEmojiMarkup(selectedEmoji = profile.avatarEmoji) {
  return `<div class="avatar-emoji-grid">${availableAvatarEmojis(profile).map((emoji)=>`<button type="button" class="avatar-emoji ${selectedEmoji===emoji?"selected":""}" data-profile-avatar="${emoji}" aria-label="Аватар ${emoji}">${emoji}</button>`).join("")}</div>`;
}
function titlePillsMarkup(selectedTitle = profile.titleId) {
  return `<div class="title-pill-grid">${availableTitleDefs(profile).map((t)=>`<button type="button" class="title-pill ${selectedTitle===t.id?"selected":""}" data-profile-title="${t.id}"><i>${escapeHtml(t.icon)}</i><span>${escapeHtml(t.name)}</span></button>`).join("")}</div>`;
}
function allDeveloperMessages() {
  const remote = Array.isArray(window.SERVER_BOOTSTRAP?.developerMessages) ? window.SERVER_BOOTSTRAP.developerMessages : [];
  const local = typeof DEVELOPER_MESSAGES !== "undefined" ? DEVELOPER_MESSAGES : [];
  const byId = new Map();
  [...remote, ...local].forEach((message) => { if (message?.id && !byId.has(String(message.id))) byId.set(String(message.id), message); });
  return [...byId.values()];
}
function currentDeveloperMessages() {
  const deleted = new Set((profile.developerMailDeleted || []).map(String));
  return allDeveloperMessages().filter((message) => !deleted.has(String(message.id)));
}
function developerMailUnreadCount() {
  const seen = new Set((profile.developerMailSeen || []).map(String));
  return currentDeveloperMessages().filter((message) => !seen.has(String(message.id))).length;
}
function updateProfileMailBadge() {
  const badge = $("#profileDeveloperMailBadge"), count = developerMailUnreadCount();
  if (!badge) return;
  badge.textContent = count > 9 ? "9+" : count ? String(count) : "";
  badge.hidden = count === 0;
  $("#profileDeveloperMail")?.classList.toggle("has-unread", count > 0);
}
function closeDeveloperMailModal() {
  const modal = $("#developerMailModal");
  if (!modal) return;
  modal.classList.remove("show");
  modal.setAttribute("aria-hidden", "true");
}
function deleteReadDeveloperMail() {
  const seen = new Set((profile.developerMailSeen || []).map(String));
  const deleted = new Set((profile.developerMailDeleted || []).map(String));
  currentDeveloperMessages().forEach((message) => { if (seen.has(String(message.id))) deleted.add(String(message.id)); });
  profile.developerMailDeleted = [...deleted];
  saveProfile();
  updateProfileMailBadge();
  openDeveloperMailModal({ markRead: false });
}
function openDeveloperMailModal({ markRead = true } = {}) {
  const modal = $("#developerMailModal"), list = $("#developerMailList");
  if (!modal || !list) return;
  const messages = currentDeveloperMessages();
  if (markRead) {
    profile.developerMailSeen = [...new Set([...(profile.developerMailSeen || []).map(String), ...messages.map((message) => String(message.id))])];
    saveProfile();
  }
  const seen = new Set((profile.developerMailSeen || []).map(String));
  const hasRead = messages.some((message) => seen.has(String(message.id)));
  list.innerHTML = `<div class="developer-mail-toolbar"><span>${messages.length ? `${messages.length} писем` : "Почта пуста"}</span><button id="developerMailDeleteRead" type="button" ${hasRead ? "" : "disabled"}>Удалить прочитанные</button></div>` + (messages.length ? messages.map((message, index) => `<article class="developer-message ${index === 0 ? "latest" : ""}">
      <div class="developer-message-meta"><span>${escapeHtml(message.date || "")}</span>${!seen.has(String(message.id)) ? "<b>НОВОЕ</b>" : ""}</div>
      <h3>${escapeHtml(message.title || "Обновление")}</h3>
      <p>${escapeHtml(message.intro || "")}</p>
      <ul>${(message.items || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
    </article>`).join("") : `<div class="empty-state">Прочитанные письма можно удалить — новые обновления появятся здесь.</div>`);
  updateProfileMailBadge();
  modal.classList.add("show");
  modal.setAttribute("aria-hidden", "false");
  $("#developerMailClose").onclick = closeDeveloperMailModal;
  $("#developerMailDeleteRead") && ($("#developerMailDeleteRead").onclick = deleteReadDeveloperMail);
  modal.onclick = (event) => { if (event.target === modal) closeDeveloperMailModal(); };
  if (!openDeveloperMailModal.escapeBound) {
    document.addEventListener("keydown", (event) => { if (event.key === "Escape" && $("#developerMailModal")?.classList.contains("show")) closeDeveloperMailModal(); });
    openDeveloperMailModal.escapeBound = true;
  }
}
function latestMajorPatchMessage() {
  return allDeveloperMessages().find((message) => message?.major && message?.version) || null;
}
function closePatchNotesModal(markSeen = true) {
  const modal = $("#patchNotesModal");
  if (!modal) return;
  if (markSeen && modal.dataset.version) {
    profile.patchSeenVersion = modal.dataset.version;
    saveProfile();
  }
  modal.classList.remove("show");
  modal.setAttribute("aria-hidden", "true");
}
function showPatchNotesIfNeeded() {
  const message = latestMajorPatchMessage(), modal = $("#patchNotesModal"), content = $("#patchNotesContent");
  if (!message || !modal || !content || String(profile.patchSeenVersion || "") === String(message.version)) return false;
  modal.dataset.version = String(message.version);
  content.innerHTML = `<small>ЧТО НОВОГО · ${escapeHtml(message.version)}</small><h2>${escapeHtml(message.title || "Обновление Словасьянса")}</h2><p>${escapeHtml(message.intro || "")}</p><ul>${(message.items || []).map((item)=>`<li>${escapeHtml(item)}</li>`).join("")}</ul><button id="patchNotesDone" type="button">Здорово, играем →</button>`;
  modal.classList.add("show");
  modal.setAttribute("aria-hidden", "false");
  $("#patchNotesDone").onclick = () => closePatchNotesModal(true);
  modal.onclick = (event) => { if (event.target === modal) closePatchNotesModal(true); };
  return true;
}

function closeProfileEditorModal() {
  const modal = $("#profileEditorModal");
  if (!modal) return;
  modal.classList.remove("show");
  modal.setAttribute("aria-hidden", "true");
}
function renderProfileEditorForm(modal, content) {
  modal.dataset.avatar = profile.avatarEmoji || "🙂";
  modal.dataset.title = profile.titleId || "player";
  modal.dataset.featured = (profile.featuredAchievements || []).join(",");
  const frame = FRAME_DEFS.find((f) => f.id === profile.frame) || FRAME_DEFS[0];
  content.innerHTML = `<div class="profile-editor-head compact"><div class="profile-editor-avatar-preview" data-frame="${frame.id}" style="--frame-h:${frame.hue || 250}">${escapeHtml(profile.avatarEmoji || "🙂")}</div><div><small>РЕДАКТИРОВАНИЕ</small><h2>${escapeHtml(profile.playerName || "Игрок")}</h2></div></div>
    <div class="profile-editor-identity"><label class="profile-field"><span>Имя</span><input id="profileEditorName" maxlength="20" value="${escapeHtml(profile.playerName || "Игрок")}" autocomplete="off" spellcheck="false"></label><label class="profile-field"><span>Любимая категория</span><select id="profileFavoriteCategory"><option value="">Не выбрана</option>${discoveredAllCategoryIds?.().map((id)=>`<option value="${id}" ${profile.favoriteCategory===id?"selected":""}>${categoryDisplayIcon?.(id)||"✦"} ${escapeHtml(categoryDisplayName?.(id)||id)}</option>`).join("")||""}</select></label></div>
    <details class="profile-compact-section"><summary><span>Аватар</span><small>${escapeHtml(profile.avatarEmoji || "🙂")} · выбрать</small></summary>${avatarEmojiMarkup(profile.avatarEmoji)}</details>
    <details class="profile-compact-section"><summary><span>Титул</span><small>${escapeHtml(titleCurrent().name)}</small></summary>${titlePillsMarkup(profile.titleId)}</details>
    <details class="profile-compact-section"><summary><span>Избранные достижения</span><small>до 3</small></summary><div class="featured-picker">${(profile.achievements||[]).map((id)=>ACHIEVEMENTS.find((a)=>a.id===id)).filter(Boolean).map((a)=>`<button type="button" class="featured-pick ${(profile.featuredAchievements||[]).includes(a.id)?"selected":""}" data-featured-achievement="${a.id}"><i>${escapeHtml(a.icon)}</i><span>${escapeHtml(a.title)}</span></button>`).join("")||`<small>Сначала получи достижение</small>`}</div></details>
    <div class="profile-editor-actions"><button type="button" class="secondary" id="profileEditorCancel">Назад</button><button type="button" class="primary" id="profileEditorSave">Сохранить</button></div>`;
  const nameInput = $("#profileEditorName");
  content.querySelectorAll("[data-profile-avatar]").forEach((btn)=>btn.onclick=()=>{
    modal.dataset.avatar = btn.dataset.profileAvatar;
    content.querySelectorAll("[data-profile-avatar]").forEach((x)=>x.classList.toggle("selected", x===btn));
    const preview=content.querySelector(".profile-editor-avatar-preview"); if(preview) preview.textContent=btn.dataset.profileAvatar;
  });
  content.querySelectorAll("[data-profile-title]").forEach((btn)=>btn.onclick=()=>{
    modal.dataset.title = btn.dataset.profileTitle;
    content.querySelectorAll("[data-profile-title]").forEach((x)=>x.classList.toggle("selected", x===btn));
  });
  content.querySelectorAll("[data-featured-achievement]").forEach((btn)=>btn.onclick=()=>{
    const set=new Set(String(modal.dataset.featured||"").split(",").filter(Boolean)),id=btn.dataset.featuredAchievement;
    if(set.has(id))set.delete(id);else if(set.size<3)set.add(id);else{showToast("Можно выбрать до 3 достижений");return;}
    modal.dataset.featured=[...set].join(",");btn.classList.toggle("selected",set.has(id));
  });
  $("#profileEditorCancel").onclick = () => openProfileEditorModal(false);
  $("#profileEditorSave").onclick = ()=>{
    const name=(nameInput?.value||"").trim().replace(/\s+/g," "), avatar=modal.dataset.avatar, title=titleDefById(modal.dataset.title);
    profile.playerName=(name||"Игрок").slice(0,20);
    if(availableAvatarEmojis(profile).includes(avatar)) profile.avatarEmoji=avatar;
    if(title&&titleUnlocked(title)) profile.titleId=title.id;
    profile.favoriteCategory=$("#profileFavoriteCategory")?.value||"";
    profile.featuredAchievements=String(modal.dataset.featured||"").split(",").filter((id)=>profile.achievements.includes(id)).slice(0,3);
    saveProfile();
    showToast("Профиль сохранён");
    renderGlobalProfileHeaders();
    openProfileEditorModal(false);
    if (hub?.classList.contains("show")) renderHub();
  };
}
function openProfileEditorModal(edit = false) {
  const modal = $("#profileEditorModal"), content = $("#profileEditorContent");
  if (!modal || !content) return;
  const frame = FRAME_DEFS.find((f) => f.id === profile.frame) || FRAME_DEFS[0], xp=xpLevelProgress(profile), rank=playerRank(profile), duels=duelHistorySummary(), featured=(profile.featuredAchievements||[]).map((id)=>ACHIEVEMENTS.find((a)=>a.id===id)).filter(Boolean).slice(0,3);
  if (edit) renderProfileEditorForm(modal, content);
  else content.innerHTML = `<div class="profile-card-view"><div class="profile-card-identity"><span class="profile-card-avatar" data-frame="${frame.id}" style="--frame-h:${frame.hue||250}">${escapeHtml(profile.avatarEmoji||"🙂")}</span><div><small>ВИЗИТКА ИГРОКА</small><h2>${escapeHtml(profile.playerName||"Игрок")}</h2><p>Ранг ${xp.level} · ${escapeHtml(rank.name)} · ещё ${Math.max(0,xp.goal-xp.value)} XP</p></div></div><div class="profile-card-xp"><i style="width:${xp.ratio*100}%"></i></div><div class="profile-showcase-grid"><div><span>Любимая категория</span><b>${profile.favoriteCategory?`${categoryDisplayIcon(profile.favoriteCategory)} ${escapeHtml(profileFavoriteLabel())}`:"—"}</b></div><div><span>Ежедневная серия</span><b>🔥 ${profile.daily.currentStreak||0}</b></div><div><span>Дуэли</span><b>${duels.wins}:${duels.losses}</b></div><div><span>Всего звёзд</span><b>★ ${profile.totalStars||0}</b></div></div><div class="featured-achievements">${featured.length?featured.map((a)=>`<span><i>${escapeHtml(a.icon)}</i><b>${escapeHtml(a.title)}</b></span>`).join(""):`<small>Избранные достижения пока не выбраны</small>`}</div><button type="button" class="profile-account-strip ${typeof accountSignedIn==="function"&&accountSignedIn()?"connected":"guest"}" id="profileAccountButton"><span>${typeof accountSignedIn==="function"&&accountSignedIn()?"☁":"◇"}</span><div><small>АККАУНТ</small><b>${escapeHtml(typeof accountStatusLabel==="function"?accountStatusLabel():"Гостевой профиль")}</b><em>${escapeHtml(typeof accountStatusHint==="function"?accountStatusHint():"Сохрани прогресс в облаке")}</em></div><i>›</i></button><div class="profile-card-actions"><button type="button" class="profile-card-settings" id="profileCardSettings">Настройки</button><button type="button" class="profile-card-edit" id="profileCardEdit">Редактировать профиль</button></div></div>`;
  modal.classList.add("show"); modal.setAttribute("aria-hidden","false");
  modal.onclick=(event)=>{if(event.target===modal)closeProfileEditorModal();};
  $("#profileEditorClose").onclick=closeProfileEditorModal;
  $("#profileDeveloperMail").onclick=openDeveloperMailModal;
  updateProfileMailBadge();
  $("#profileCardSettings")?.addEventListener("click",()=>{ closeProfileEditorModal(); openHub("settings"); });
  $("#profileAccountButton")?.addEventListener("click",()=>{ closeProfileEditorModal(); openAccountModal?.(); });
  $("#profileCardEdit")?.addEventListener("click",()=>openProfileEditorModal(true));
  if (!openProfileEditorModal.escapeBound) { document.addEventListener("keydown",(event)=>{if(event.key==="Escape"&&$("#profileEditorModal")?.classList.contains("show"))closeProfileEditorModal();}); openProfileEditorModal.escapeBound=true; }
}

function notificationPermissionLabel() {
  if (!("Notification" in window)) return { cls:"blocked", text:"Не поддерживаются браузером" };
  if (Notification.permission === "granted") return { cls:"ok", text:"Разрешение браузера получено" };
  if (Notification.permission === "denied") return { cls:"blocked", text:"Заблокированы в настройках браузера" };
  return { cls:"idle", text:"Браузер ещё не спрашивал разрешение" };
}
function appearanceTabMarkup() {
  const themes=THEME_DEFS.map(t=>{const unlocked=themeUnlocked(t);return `<button class="theme-tile theme-${t.id} ${unlocked?"":"locked"} ${profile.theme===t.id?"selected":""}" data-theme-id="${t.id}"><b>${t.name}</b><span>${unlocked?"Открыто":themeUnlockLabel(t)}</span></button>`;}).join("");
  const effects=EFFECT_DEFS.map(e=>{const unlocked=effectUnlocked(e);return `<button class="effect-tile ${unlocked?"":"locked"} ${profile.effect===e.id?"selected":""}" data-effect-id="${e.id}">${effectPreviewMarkup(e)}<b>${e.name}</b><span>${unlocked?"Открыто":effectUnlockLabel(e)}</span></button>`;}).join("");
  const sounds=SOUND_PACK_DEFS.map(x=>{const unlocked=soundPackUnlocked(x);return `<button class="sound-tile ${unlocked?"":"locked"} ${profile.soundPack===x.id?"selected":""}" data-sound-pack="${x.id}"><i>♪</i><b>${x.name}</b><span>${unlocked?"Открыто":`${x.minDuelXp} дуэльного XP`}</span></button>`;}).join("");
  const shelf=(key,title,subtitle,cls,content)=>{const open=hubExpandedSections.has(`cosmetic:${key}`);return `<section class="hub-section cosmetic-section ${open?"expanded":""}" data-cosmetic-section="${key}"><div class="hub-section-head"><h3>${title}</h3><small>${subtitle}</small></div><div class="cosmetic-clip"><div class="${cls}">${content}</div></div><button class="cosmetic-expand" data-cosmetic-expand="${key}">${open?"Свернуть":"Показать все"}</button></section>`};
  return `${shelf("themes","Темы","выбери оформление","theme-grid",themes)}${shelf("backs","Рубашки",`${CARD_BACK_DEFS.filter(b=>cardBackUnlocked(b)).length}/${CARD_BACK_DEFS.length}`,"cardback-grid",cardBackMarkup())}${shelf("frames","Рамки профиля","главы и дуэльный XP","frame-grid",typeof frameTilesMarkup==="function"?frameTilesMarkup():"")}${shelf("effects","Эффекты победы","косметические награды","effect-grid",effects)}${shelf("sounds","Звуки","награды за дуэльный опыт","sound-grid",sounds)}`;
}
function settingsTabMarkup() {
  const standalone=isStandalonePwa(),
    installLabel=standalone?"✓ Игра установлена":deferredInstallPrompt?"＋ Установить игру":"＋ На главный экран",
    report=CATEGORY_BANK_REPORT || {},
    notificationStatus=notificationPermissionLabel();
  const sourceMode = normalizeCardSourceMode(profile.settings.cardSourceMode);
  const startupScreen = profile.settings.startupScreen === "game" ? "game" : "home";
  const settingsContent = `<div class="card-source-setting"><div class="hub-subhead"><h4>Карты в раскладах</h4><small>какие ассоциации использовать во всех режимах</small></div><div class="card-source-options">${[["words","Только слова","Аа"],["pictures","Только картинки","🖼️"],["all","Все колоды","▦"]].map(([id,label,icon])=>`<button class="${sourceMode===id?"active":""}" data-card-source-mode="${id}"><i>${icon}</i><span>${label}</span></button>`).join("")}</div></div>
    <div class="startup-setting"><div class="hub-subhead"><h4>При запуске</h4><small>куда переходить после загрузки приложения</small></div><div class="startup-options">
      <button class="${startupScreen==="home"?"active":""}" data-startup-screen="home"><i>⌂</i><span><b>Стартовая</b><small>Открывать меню игры</small></span></button>
      <button class="${startupScreen==="game"?"active":""}" data-startup-screen="game"><i>▶</i><span><b>Сразу в игру</b><small>Продолжать последний расклад</small></span></button>
    </div></div>
    <div class="settings-subgroup"><div class="hub-subhead"><h4>Звук и отклик</h4><small>аудио и тактильные сигналы игры</small></div><div class="settings-grid compact-settings feedback-settings">
      <button class="setting-toggle ${profile.settings.sound?"on":""}" id="soundToggle"><b>♪ Эффекты</b><span>${profile.settings.sound?"Включены":"Выключены"}</span></button>
      <button class="setting-toggle ${profile.settings.music?"on":""}" id="musicToggle"><b>♫ Музыка</b><span>${profile.settings.music?"Включена":"Выключена"}</span></button>
      <button class="setting-toggle ${profile.settings.haptics?"on":""}" id="hapticsToggle"><b>⌁ Вибрация</b><span>${profile.settings.haptics?"Включена":"Выключена"}</span></button>
    </div></div>
    <div class="settings-subgroup"><div class="hub-subhead"><h4>Приложение</h4><small>установка и офлайн-режим</small></div><button class="setting-toggle install full-setting" id="installPwa" ${standalone?"disabled":""}><b>${installLabel}</b><span>${standalone?"Установлено как приложение":"Работает офлайн после установки"}</span></button></div>`;
  const notificationsContent = `<div class="notification-state ${notificationStatus.cls}"><i></i><span>${notificationStatus.text}</span></div>
      <div class="settings-grid notification-grid">
        <button class="setting-toggle ${profile.settings.notifications?"on":""}" id="notificationToggle"><b>🔔 Все уведомления</b><span>${profile.settings.notifications?"Включены":"Выключены"}</span></button>
        <button class="setting-toggle ${profile.settings.challengeReminders!==false?"on":""}" id="challengeReminderToggle"><b>⚔ Дуэли</b><span>${profile.settings.challengeReminders!==false?"Ответы друзей":"Не уведомлять"}</span></button>
        <button class="setting-toggle ${profile.settings.dailyReminders!==false?"on":""}" id="dailyReminderToggle"><b>☀ Ежедневный</b><span>${profile.settings.dailyReminders!==false?"Напоминать":"Не напоминать"}</span></button>
        <button class="setting-toggle ${profile.settings.weeklyReminders!==false?"on":""}" id="weeklyReminderToggle"><b>📅 Недельное</b><span>${profile.settings.weeklyReminders!==false?"Напоминать":"Не напоминать"}</span></button>
      </div>
      <button class="notification-test" id="notificationTest" ${profile.settings.notifications && typeof Notification!=="undefined" && Notification.permission==="granted"?"":"disabled"}>Проверить уведомление</button>
      <p class="settings-note">Главный переключатель отключает все системные уведомления. Остальные настройки позволяют отдельно выбрать ответы на дуэли, ежедневный режим и финал недели.</p>`;
  const saveContent = `<div class="save-tools"><button id="exportSave">⇩ Экспорт прогресса</button><button id="importSave">⇧ Импорт прогресса</button></div>`;
  const bankContent = `<div class="bank-health-grid"><span><b>${report.categories||BANK.length}</b> категорий</span><span><b>${report.words||0}</b> слов</span><span><b>${report.ambiguousWords?.length||0}</b> пересечений</span><span><b>${report.warnings?.length||0}</b> предупреждений</span></div><p>Пересечения автоматически не попадают в один расклад; генератор также проверяет проходимость seed.</p>`;
  const tutorialContent = `<button class="wide-secondary" id="hubTutorial">◇ Запустить обучение заново</button>`;
  const stabilityStore = typeof readStabilityState === "function" ? readStabilityState() : {events:[]};
  const restartEvents = (stabilityStore.events || []).filter((x)=>["unexpected_restart","restart_after_background","error","promise","boot_error"].includes(x.kind));
  const diagnosticsContent = `${typeof qualityAuditMarkup==="function"?qualityAuditMarkup():""}<div class="analytics-health"><b>Стабильность</b><span>Зафиксировано событий: ${restartEvents.length}</span><small>Если приложение снова перезапустится, диагностика сохранит, произошло ли это в активной игре, после фона или из-за JS-ошибки.</small><button class="wide-secondary" id="copyStabilityDiagnostics" type="button">Скопировать диагностику</button></div><div class="analytics-health"><b>Аналитика</b><span>Локальные события: ${(()=>{try{return JSON.parse(localStorage.getItem(ANALYTICS_KEY))?.events?.length||0}catch{return 0}})()}</span><small>Анонимные агрегаты отправляются в /api/analytics без имён и текста раскладов.</small></div>`;
  return `${collapsibleSectionMarkup("settings-main", "Настройки", "звук, запуск и карты", settingsContent)}
    ${collapsibleSectionMarkup("notifications", "Уведомления", "управление по типам", notificationsContent, "notification-settings")}
    ${collapsibleSectionMarkup("save", "Сохранение", "не потеряй прогресс", saveContent)}
    ${collapsibleSectionMarkup("bank", "База слов", "внутренняя проверка", bankContent, "bank-health")}
    ${collapsibleSectionMarkup("diagnostics", "Диагностика", "проверка и аналитика", diagnosticsContent, "diagnostics-health")}
    ${collapsibleSectionMarkup("tutorial", "Обучение", "повторить механику", tutorialContent)}`;
}
function renderHub() {
  recomputeStars();
  syncDuelStats?.();
  renderGlobalProfileHeaders();
  ensureWeeklyChallenge();
  ensureMonthlyChallenge?.();
  const views = { home: homeTabMarkup, progress: progressTabMarkup, collection: collectionTabMarkup, appearance: appearanceTabMarkup, settings: settingsTabMarkup, modes: modesTabMarkup };
  hubContent.innerHTML = (views[hubTab] || homeTabMarkup)();
  hubNav.innerHTML = hubTabsMarkup();
  bindHubHandlers();
}
function bindHubHandlers() {
  hubNav.querySelectorAll("[data-hub-tab]").forEach((btn)=>btn.onclick=()=>{hubTab=btn.dataset.hubTab; renderHub();});
  const on=(id,fn)=>{const el=$(id); if(el) el.onclick=fn;};
  on("#smartAction",()=>runSmartHomeAction?.());
  on("#hubProfileButton",()=>openProfileEditorModal());
  const resume = hubNav.querySelector("[data-hub-resume]");
  if (resume) resume.onclick = () => {
    const next = profile.currentLevel || 1;
    closeHub();
    if (!state || state.rewarded || state.mode !== "regular") makeLevel(next, { mode:"regular" });
    else { render(); updateCoach(); setBackgroundMusic?.(musicModeForState?.(state) || "game"); }
  };
  const startHubMode=(mode,{quick=false}={})=>{
    if(mode==="daily"){closeHub();makeLevel(0,{mode:"daily",seed:`daily:${todayKey()}`});return;}
    if(mode==="marathon"){closeHub();const runId=`marathon:${Date.now().toString(36)}`;makeLevel(1,{mode:"marathon",seed:`${runId}:1`,marathonRound:1,marathonId:runId});return;}
    if(mode==="zen"){closeHub();makeLevel(1,{mode:"calm",seed:`zen:${Date.now()}:${Math.random()}`});return;}
    if(mode==="pictures"){if(quick){const defs=ASSOCIATION_COLLECTION_DEFS||[],i=defs.length?Math.floor(Math.random()*defs.length):0,id=defs[i]?.id||"animals";closeHub();makeLevel(1,{mode:"collection",collectionId:id,seed:`daily-picture:${todayKey()}:${Date.now()}:${id}`});}else openPictureModePicker();return;}
    if(mode==="duel"){hubContent.querySelector(".duel-create")?.scrollIntoView({behavior:"smooth",block:"center"});return;}
    if(mode==="custom"){openCustomRulesModal();return;}
    if(["regular","time","moves","combo","noMistakes","onePass"].includes(mode)){closeHub();makeLevel(mode==="regular"?(profile.currentLevel||1):25,{mode,seed:`${mode}:${Date.now()}:${Math.random()}`});return;}
  };
  hubContent.querySelectorAll("[data-game-mode]").forEach((btn)=>btn.onclick=()=>startHubMode(btn.dataset.gameMode));
  hubContent.querySelectorAll("[data-daily-quest-mode]").forEach((btn)=>btn.onclick=()=>startHubMode(btn.dataset.dailyQuestMode,{quick:true}));
  on("#customRulesClose",closeCustomRulesModal);
  on("#customRulesCancel",closeCustomRulesModal);
  const customRulesModal = $("#customRulesModal");
  if (customRulesModal) customRulesModal.onclick = (e) => { if (e.target === customRulesModal) closeCustomRulesModal(); };
  on("#customRulesStart",()=>{const rules={timeLimitSec:+$("#customTime")?.value||0,moveLimit:+$("#customMoves")?.value||0,comboTarget:+$("#customCombo")?.value||0,noMistakes:!!$("#customNoMistakes")?.checked,onePass:!!$("#customOnePass")?.checked};profile.customRules=sanitizeCustomRules?.(rules)||rules;saveProfile();closeCustomRulesModal();closeHub();makeLevel(25,{mode:"custom",seed:`custom:${Date.now()}:${Math.random()}`,customRules:profile.customRules});});
  on("#leaderboardOpen",()=>openLeaderboardModal?.());
  on("#duelCreate",()=>shareNewChallenge());
  on("#challengeStart",()=>startChallengeCode($("#challengeInput")?.value));
  const challengeInput=$("#challengeInput"); if(challengeInput) challengeInput.oninput=()=>{challengeInput.value=normalizeChallengeCode(challengeInput.value);};
  hubContent.querySelectorAll("[data-owned-challenge-play]").forEach((btn)=>btn.onclick=()=>playOwnedChallenge(btn.dataset.ownedChallengePlay));
  hubContent.querySelectorAll("[data-owned-challenge-share]").forEach((btn)=>btn.onclick=()=>shareChallengeEntry(ownedChallengeByCode(btn.dataset.ownedChallengeShare)));
  hubContent.querySelectorAll("[data-owned-challenge-rematch]").forEach((btn)=>btn.onclick=()=>createChallengeRematch?.(ownedChallengeByCode(btn.dataset.ownedChallengeRematch),"creator"));
  hubContent.querySelectorAll("[data-received-challenge-play]").forEach((btn)=>btn.onclick=()=>playReceivedChallenge?.(btn.dataset.receivedChallengePlay));
  hubContent.querySelectorAll("[data-received-challenge-rematch]").forEach((btn)=>btn.onclick=()=>createChallengeRematch?.(receivedChallengeByCode(btn.dataset.receivedChallengeRematch),"guest"));
  hubContent.querySelectorAll("[data-owned-challenge-delete]").forEach((btn)=>btn.onclick=()=>deleteOwnedChallenge?.(btn.dataset.ownedChallengeDelete));
  hubContent.querySelectorAll("[data-received-challenge-delete]").forEach((btn)=>btn.onclick=()=>deleteReceivedChallenge?.(btn.dataset.receivedChallengeDelete));
  on("#hubTutorial",()=>{closeHub(); makeLevel(1,{mode:"tutorial",step:1});});
  on("#chapterPrev",()=>{hubChapterNumber=Math.max(1,(hubChapterNumber||1)-1);renderHub();});
  on("#chapterNext",()=>{hubChapterNumber=Math.min(chapterInfo(profile.currentLevel||1).number,(hubChapterNumber||1)+1);renderHub();});
  hubContent.querySelectorAll("[data-chapter-level]").forEach((btn)=>btn.onclick=()=>{closeHub();makeLevel(+btn.dataset.chapterLevel,{mode:"regular"});});
  hubContent.querySelectorAll("[data-open-profile-editor]").forEach((el)=>el.onclick=openProfileEditorModal);
  hubContent.querySelectorAll("details[data-collapsible]").forEach((details)=>details.addEventListener("toggle",()=>{
    const key=details.dataset.collapsible;
    if(details.open) hubExpandedSections.add(key); else hubExpandedSections.delete(key);
  }));
  hubContent.querySelectorAll("[data-ach-filter]").forEach((btn)=>btn.onclick=()=>{achievementFilter=btn.dataset.achFilter;renderHub();});
  hubContent.querySelectorAll("[data-category-id]").forEach((btn)=>btn.onclick=()=>{hubCategoryId=btn.dataset.categoryId;renderHub();});
  hubContent.querySelectorAll("[data-visual-category-id]").forEach((btn)=>btn.onclick=()=>{hubVisualCategoryId=btn.dataset.visualCategoryId;renderHub();});
  hubContent.querySelectorAll("[data-encyclopedia-tab]").forEach((btn)=>btn.onclick=()=>{hubEncyclopediaType=btn.dataset.encyclopediaTab;renderHub();});
  hubContent.querySelectorAll("[data-ency-filter]").forEach((btn)=>btn.onclick=()=>{encyclopediaFilter=btn.dataset.encyFilter;renderHub();});
  hubContent.querySelectorAll("[data-ency-sort]").forEach((btn)=>btn.onclick=()=>{encyclopediaSort=btn.dataset.encySort;renderHub();});
  const encyclopediaSearch=$("#encyclopediaSearch"); if(encyclopediaSearch){let searchTimer;encyclopediaSearch.oninput=()=>{encyclopediaQuery=encyclopediaSearch.value;clearTimeout(searchTimer);searchTimer=setTimeout(()=>{renderHub();const next=$("#encyclopediaSearch");next?.focus();next?.setSelectionRange(next.value.length,next.value.length);},180);};}
  hubContent.querySelectorAll("[data-duel-tab]").forEach((btn)=>btn.onclick=()=>{hubDuelTab=btn.dataset.duelTab==="history"?"history":"active";renderHub();});
  hubContent.querySelectorAll("[data-duel-history-rematch]").forEach((btn)=>btn.onclick=()=>{const found=findDuelHistoryEntry?.(btn.dataset.duelHistoryRematch);if(found)createChallengeRematch?.(found.entry,found.perspective);});
  hubContent.querySelectorAll("[data-duel-profile]").forEach((btn)=>btn.onclick=()=>showDuelProfileHistory?.(btn.dataset.duelProfile));
  hubContent.querySelectorAll("[data-card-source-mode]").forEach((btn)=>btn.onclick=()=>{profile.settings.cardSourceMode=normalizeCardSourceMode(btn.dataset.cardSourceMode);saveProfile();showToast(`Расклады: ${btn.textContent.trim()}`);renderHub();});
  hubContent.querySelectorAll("[data-startup-screen]").forEach((btn)=>btn.onclick=()=>{profile.settings.startupScreen=btn.dataset.startupScreen==="game"?"game":"home";saveProfile();showToast(profile.settings.startupScreen==="game"?"При запуске: сразу в игру":"При запуске: стартовая");renderHub();});
  hubContent.querySelectorAll("[data-association-collection]").forEach((btn)=>btn.onclick=()=>{const id=btn.dataset.associationCollection;closeHub();makeLevel(1,{mode:"collection",collectionId:id,seed:`collection:${id}:${Date.now()}`});});
  hubContent.querySelectorAll("[data-theme-id]").forEach((btn)=>btn.onclick=()=>{const def=THEME_DEFS.find((x)=>x.id===btn.dataset.themeId);if(themeUnlocked(def)){profile.theme=def.id;saveProfile();}renderHub();if(!themeUnlocked(def))showToast(`Откроется за ${themeUnlockLabel(def)}`);});
  hubContent.querySelectorAll("[data-card-back-id]").forEach((btn)=>btn.onclick=()=>{const def=CARD_BACK_DEFS.find((x)=>x.id===btn.dataset.cardBackId);if(cardBackUnlocked(def)){profile.cardBack=def.id;saveProfile();}renderHub();if(!cardBackUnlocked(def))showToast(cardBackUnlockLabel(def));});
  hubContent.querySelectorAll("[data-frame-id]").forEach((btn)=>btn.onclick=()=>{const def=FRAME_DEFS.find((x)=>x.id===btn.dataset.frameId);if(frameUnlocked(def)){profile.frame=def.id;saveProfile();}renderHub();if(!frameUnlocked(def))showToast(def.minDuelXp?`Нужно ${def.minDuelXp} дуэльного XP`:`Откроется после главы ${def.chapter}`);});
  hubContent.querySelectorAll("[data-effect-id]").forEach((btn)=>btn.onclick=()=>{const def=EFFECT_DEFS.find((x)=>x.id===btn.dataset.effectId);if(effectUnlocked(def)){profile.effect=def.id;saveProfile();burst(false);}renderHub();if(!effectUnlocked(def))showToast(effectUnlockLabel(def));});
  hubContent.querySelectorAll("[data-sound-pack]").forEach(btn=>btn.onclick=()=>{const def=SOUND_PACK_DEFS.find(x=>x.id===btn.dataset.soundPack);if(soundPackUnlocked(def)){profile.soundPack=def.id;saveProfile();playSfx("combo",.7);}else showToast(`Нужно ${def.minDuelXp} дуэльного XP`);renderHub();});
  hubContent.querySelectorAll("[data-cosmetic-expand]").forEach(btn=>btn.onclick=()=>{const key=`cosmetic:${btn.dataset.cosmeticExpand}`;if(hubExpandedSections.has(key))hubExpandedSections.delete(key);else hubExpandedSections.add(key);renderHub();});
  on("#soundToggle",()=>{profile.settings.sound=!profile.settings.sound;saveProfile();if(profile.settings.sound)playSfx("combo",.65);renderHub();});
  on("#musicToggle",()=>{profile.settings.music=!profile.settings.music;saveProfile();if(profile.settings.music)setBackgroundMusic("menu");else stopBackgroundMusic();renderHub();});
  on("#hapticsToggle",()=>{profile.settings.haptics=!profile.settings.haptics;saveProfile();if(profile.settings.haptics)haptic([8,20,8]);renderHub();});
  on("#notificationToggle",async()=>{if(profile.settings.notifications){await disablePushNotifications?.();renderHub();}else{try{await registerPushNotifications?.();}catch(err){console.error(err);showToast("Уведомления пока не настроены на сервере");}renderHub();}});
  on("#challengeReminderToggle",async()=>{profile.settings.challengeReminders=profile.settings.challengeReminders===false;saveProfile();await syncChallengePushPreference?.();syncPushState?.();renderHub();});
  on("#dailyReminderToggle",()=>{profile.settings.dailyReminders=profile.settings.dailyReminders===false;saveProfile();syncPushState?.();renderHub();});
  on("#weeklyReminderToggle",()=>{profile.settings.weeklyReminders=profile.settings.weeklyReminders===false;saveProfile();syncPushState?.();renderHub();});
  on("#notificationTest",async()=>{const ok=await showSystemNotification?.("Словасьянс", "Тестовое уведомление работает ✓", {tag:"worditaire-test"}); if(!ok) showToast("Не удалось показать уведомление");});
  on("#exportSave",exportProgress); on("#importSave",importProgress);
  on("#copyStabilityDiagnostics",()=>copyStabilityDiagnostics?.());
  on("#installPwa",async()=>{if(isStandalonePwa())return;if(deferredInstallPrompt){const prompt=deferredInstallPrompt;deferredInstallPrompt=null;await prompt.prompt();const result=await prompt.userChoice.catch(()=>null);track("pwa_prompt",{outcome:result?.outcome||"unknown"});renderHub();}else{const ios=/iphone|ipad|ipod/i.test(navigator.userAgent);showToast(ios?'iPhone: Поделиться → На экран «Домой»':'Открой меню браузера → Установить приложение');}});
}
function openHub(tab = null) {
  if (tab) hubTab = tab;
  hubChapterNumber = chapterInfo(profile.currentLevel || 1).number;
  renderHub();
  hub.classList.add("show");
  setBackgroundMusic("menu");
  track("hub_opened", { tab: hubTab });
  if (hubTab === "modes") syncChallengesNonBlocking?.({ force: true });
}
function closeHub() {
  closeCustomRulesModal?.();
  hub.classList.remove("show");
  setBackgroundMusic(musicModeForState?.() || "game");
}
