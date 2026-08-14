/* Game hub: play, progression, encyclopedia, appearance and settings. */
let hubChapterNumber = null,
  hubTab = "play",
  hubCategoryId = null,
  hubVisualCategoryId = null,
  hubEncyclopediaType = "words",
  achievementFilter = "all",
  hubExpandedSections = new Set();

function isStandalonePwa() {
  return window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;
}
function levelStarsMarkup(stars) {
  return stars ? `${"★".repeat(stars)}${"☆".repeat(3 - stars)}` : "···";
}
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
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
  const tabs = [
    ["settings", "⚙", "Ещё"],
    ["progress", "★", "Прогресс"],
    ["collection", "▦", "Энциклопедия"],
    ["appearance", "✦", "Стиль"],
    ["play", "▶", "Играть"],
  ];
  return `<nav class="hub-tabs">${tabs
    .map(([id, icon, label]) => `<button class="${hubTab === id ? "active" : ""}" data-hub-tab="${id}"><i>${icon}</i><span>${label}</span></button>`)
    .join("")}</nav>`;
}
function profileHeroMarkup() {
  const title = titleCurrent(),
    rank = typeof playerRank === "function" ? playerRank(profile) : { name: "Игрок", icon: title.icon },
    xp = typeof xpLevelProgress === "function" ? xpLevelProgress(profile) : { level: 1, ratio: 0, value: 0, goal: 250 },
    frame = FRAME_DEFS.find((f) => f.id === profile.frame) || FRAME_DEFS[0];
  return `<section class="profile-hero" data-frame="${frame.id}" style="--frame-h:${frame.hue}">
    <button type="button" class="profile-avatar profile-edit-trigger" data-open-profile-editor aria-label="Редактировать профиль">${escapeHtml(profile.avatarEmoji || "🙂")}</button>
    <button type="button" class="profile-copy profile-edit-trigger" data-open-profile-editor aria-label="Редактировать профиль">
      <b>${escapeHtml(profile.playerName || "Игрок")}</b>
      <span>${escapeHtml(title.name)}</span>
      <span class="profile-xp"><i style="width:${xp.ratio * 100}%"></i></span>
    </button>
    <div class="profile-meta"><b>Ранг ${xp.level}</b><strong>${escapeHtml(rank.name)}</strong><span>${xp.value}/${xp.goal} XP · ★ ${profile.totalStars}</span></div>
  </section>`;
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
  const w = weeklyProgress();
  return `<section class="weekly-card ${w.completed ? "done" : ""}">
    <div class="weekly-icon">${w.def.icon}</div>
    <div class="weekly-copy"><small>НЕДЕЛЬНОЕ ИСПЫТАНИЕ</small><b>${w.def.title}</b><span>${w.def.desc}</span><div class="weekly-progress"><i style="width:${w.ratio * 100}%"></i></div><em>${w.value}/${w.goal}${w.completed ? " · выполнено ✓" : ""}</em></div>
  </section>`;
}
function playTabMarkup() {
  const dailyDone = profile.daily.completedDates.includes(todayKey()), currentChapter = chapterInfo(profile.currentLevel || 1);
  if (!hubChapterNumber) hubChapterNumber = currentChapter.number;
  hubChapterNumber = Math.max(1, Math.min(hubChapterNumber, currentChapter.number));
  return `${profileHeroMarkup()}
    ${typeof smartHomeMarkup === "function" ? smartHomeMarkup() : ""}
    ${typeof dailyCalendarMarkup === "function" ? dailyCalendarMarkup() : ""}
    <div class="mode-grid">
      <button class="mode-card daily" id="hubDaily"><i>☀</i><b>Daily</b><span>${dailyDone ? "Сегодня пройдено ✓" : "Один расклад для всех"}</span></button>
      <button class="mode-card marathon" id="hubMarathon"><i>∞</i><b>Марафон</b><span>Рекорд: ${profile.stats.bestMarathon || 0}</span></button>
      <button class="mode-card calm" id="hubCalm"><i>☁</i><b>Спокойно</b><span>Лёгкие бесконечные расклады</span></button>
      <button class="mode-card challenge" id="hubShareChallenge"><i>⇄</i><b>Вызов другу</b><span>Матч + серия до 2 побед</span></button>
    </div>
    ${ownedChallengesMarkup()}
    ${receivedChallengesMarkup()}
    ${weeklyMarkup()}
    ${typeof nearGoalsMarkup === "function" ? nearGoalsMarkup(2) : ""}
    <section class="hub-section challenge-enter"><div class="hub-section-head"><h3>Код испытания</h3><small>6 символов</small></div><div class="challenge-input-row"><input id="challengeInput" inputmode="text" autocomplete="off" autocapitalize="characters" maxlength="6" placeholder="ABC123"><button id="challengeStart">Играть</button></div></section>
    ${chapterMarkup(hubChapterNumber)}`;
}
function achievementCardMarkup(a) {
  const done = profile.achievements.includes(a.id), progress = achievementProgressData(a, profile), ratio = progress ? progress.value / progress.goal : done ? 1 : 0;
  return `<div class="achievement ${done ? "done-achievement" : "locked"} ${a.rare ? "rare" : ""}"><div class="ico">${a.icon}</div><div class="achievement-copy"><b>${a.title}</b><p>${a.desc}${a.rare ? " · редкое" : ""}</p>${progress ? `<div class="achievement-progress"><i style="width:${Math.min(1, ratio) * 100}%"></i></div><small>${progress.value}/${progress.goal}</small>` : ""}</div><span class="done">${done ? "✓" : ""}</span></div>`;
}
function progressTabMarkup() {
  const chaptersDone = completedChapterCount(profile), perfectChapters = perfectChapterCount(profile), discoveredCount = discoveredCategoryCount(profile);
  const filtered = ACHIEVEMENTS.filter((a) => {
    const done = profile.achievements.includes(a.id), p = achievementProgressData(a, profile), ratio = p ? p.value / p.goal : 0;
    if (achievementFilter === "done") return done;
    if (achievementFilter === "near") return !done && ratio >= 0.5;
    if (achievementFilter === "rare") return !!a.rare;
    return true;
  });
  const statsContent = `<div class="stats-grid expanded">
      <div class="stat-box"><b>${profile.stats.levelsCompleted}</b><span>уровней</span></div><div class="stat-box"><b>${profile.stats.gamesPlayed || 0}</b><span>партий</span></div>
      <div class="stat-box"><b>${discoveredCount}</b><span>категорий</span></div><div class="stat-box"><b>${profile.stats.tripleStarWins}</b><span>★★★</span></div>
      <div class="stat-box"><b>${profile.stats.totalMoves || 0}</b><span>ходов</span></div><div class="stat-box"><b>${profile.stats.personalRecords || 0}</b><span>рекордов</span></div>
      <div class="stat-box"><b>×${profile.stats.maxDragCombo || 0}</b><span>комбо</span></div><div class="stat-box"><b>${profile.stats.bestMarathon || 0}</b><span>марафон</span></div>
      <div class="stat-box"><b>${chaptersDone}</b><span>глав</span></div><div class="stat-box"><b>${perfectChapters}</b><span>идеальных глав</span></div>
      <div class="stat-box"><b>${typeof playerXpLevel === "function" ? playerXpLevel(profile) : 1}</b><span>ранг</span></div><div class="stat-box"><b>${profile.xp || 0}</b><span>XP</span></div>
      <div class="stat-box"><b>${profile.stats.masteredCategories || 0}</b><span>освоено</span></div><div class="stat-box"><b>${profile.stats.bonusObjectivesCompleted || 0}</b><span>бонусов</span></div>
    </div>`;
  return `${profileHeroMarkup()}
    ${collapsibleSectionMarkup("statistics", "Статистика", "твоя история", statsContent)}
    <section class="hub-section"><div class="hub-section-head"><h3>Достижения</h3><small>${profile.achievements.length}/${ACHIEVEMENTS.length}</small></div>
      <div class="achievement-filters">${[["all","Все"],["near","Почти"],["done","Получены"],["rare","Редкие"]].map(([id,label])=>`<button class="${achievementFilter===id?"active":""}" data-ach-filter="${id}">${label}</button>`).join("")}</div>
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
function associationCollectionsMarkup() {
  return `<div class="association-collections-block">
    <div class="hub-subhead"><h4>Картинки</h4><small>выбери набор для отдельного расклада</small></div>
    <div class="association-collection-grid">${ASSOCIATION_COLLECTION_DEFS.map((collection) => {
      const progress = associationCollectionProgress(collection.id), samples = collection.categories.slice(0, 3);
      return `<button class="association-collection-card" data-association-collection="${collection.id}">
        <span class="association-collection-preview">${samples.map((cat) => `<i title="${escapeHtml(cat.title)}">${cat.cards[0][0]}</i>`).join("")}</span>
        <span class="association-collection-copy"><b>${collection.icon} ${collection.name}</b><small>${escapeHtml(collection.desc)}</small></span>
        <span class="association-collection-progress"><i style="width:${progress.total ? (progress.completed / progress.total) * 100 : 0}%"></i></span>
        <span class="association-collection-meta">${progress.completed}/${progress.total} категорий${progress.completed === progress.total ? " · освоено ✓" : " · играть →"}</span>
      </button>`;
    }).join("")}</div>
  </div>`;
}
function pictureEncyclopediaGridMarkup() {
  const discovered = visualDiscoveredIds(profile);
  return `<div class="visual-category-groups">${ASSOCIATION_COLLECTION_DEFS.map((collection)=>{
    const categories = associationCollectionCategories(collection.id);
    return `<section class="visual-category-group"><div class="visual-category-group-head"><b>${collection.icon} ${escapeHtml(collection.name)}</b><span>${categories.filter((c)=>discovered.has(c.id)).length}/${categories.length}</span></div><div class="collection-grid encyclopedia-grid visual-grid">${categories.map((cat)=>{
      const seen=discovered.has(cat.id), stat=categoryStat(cat.id), info=visualCategoryById(cat.id), sample=info?.category?.cards?.[0]?.[0] || collection.icon;
      return `<button class="collection-item visual-item ${seen?"seen":"locked"} ${hubVisualCategoryId===cat.id?"selected":""}" data-visual-category-id="${cat.id}" ${seen?"":"disabled"}><i>${seen?sample:"?"}</i><span>${seen?escapeHtml(cat.title):"???"}</span>${seen&&stat.completions?`<em>${stat.completions}×</em>`:""}</button>`;
    }).join("")}</div></section>`;
  }).join("")}</div>`;
}
function collectionTabMarkup() {
  const wordDiscovered = new Set(profile.discovered),
    wordCount = discoveredCategoryCount(profile),
    pictureDiscovered = visualDiscoveredIds(profile),
    pictureCount = pictureDiscovered.size,
    pictureTotal = totalVisualCategoryCount(),
    totalCount = wordCount + pictureCount,
    totalCategories = BANK.length + pictureTotal;
  if (!hubCategoryId || !wordDiscovered.has(hubCategoryId)) hubCategoryId = BANK.find((c)=>wordDiscovered.has(c.id))?.id || null;
  if (!hubVisualCategoryId || !pictureDiscovered.has(hubVisualCategoryId)) hubVisualCategoryId = allAssociationCategories().find((c)=>pictureDiscovered.has(c.id))?.id || null;
  const cat = BANK.find((c)=>c.id===hubCategoryId);
  const tabs = `<div class="encyclopedia-type-tabs"><button class="${hubEncyclopediaType==="words"?"active":""}" data-encyclopedia-tab="words"><b>Слова</b><span>${wordCount}/${BANK.length}</span></button><button class="${hubEncyclopediaType==="pictures"?"active":""}" data-encyclopedia-tab="pictures"><b>Картинки</b><span>${pictureCount}/${pictureTotal}</span></button></div>`;
  const words = `<div class="encyclopedia-pane">${categoryDetailMarkup(cat)}<div class="collection-grid encyclopedia-grid">${BANK.map((c)=>{const m=wordDiscovered.has(c.id)&&typeof categoryMasteryData==="function"&&categoryMasteryData(c.id).mastered;return `<button class="collection-item ${wordDiscovered.has(c.id)?"seen":"locked"} ${m?"mastered":""} ${hubCategoryId===c.id?"selected":""}" data-category-id="${c.id}" ${wordDiscovered.has(c.id)?"":"disabled"}>${wordDiscovered.has(c.id)?`${m?"★ ":""}${c.title}`:"???"}</button>`;}).join("")}</div></div>`;
  const pictures = `<div class="encyclopedia-pane">${associationCollectionsMarkup()}<div class="hub-subhead picture-categories-head"><h4>Категории картинок</h4><small>${pictureCount}/${pictureTotal} открыто</small></div>${visualCategoryDetailMarkup(hubVisualCategoryId)}${pictureEncyclopediaGridMarkup()}</div>`;
  return `${profileHeroMarkup()}
    <section class="hub-section encyclopedia-shell"><div class="hub-section-head encyclopedia-main-head"><div><h3>Энциклопедия</h3><small>слова и картинки в одной коллекции</small></div><strong>${totalCount}/${totalCategories}</strong></div>${tabs}${hubEncyclopediaType==="pictures"?pictures:words}</section>`;
}
function cardBackMarkup() {
  return CARD_BACK_DEFS.map((back) => {
    const unlocked = cardBackUnlocked(back), selected = profile.cardBack === back.id;
    return `<button class="cardback-tile ${unlocked ? "" : "locked"} ${selected ? "selected" : ""} ${back.rare ? "rare" : ""}" data-card-back-id="${back.id}"><span class="cardback-preview back-${back.id}"><i>${back.rare ? "✦" : ""}</i></span><b>${back.name}</b><span>${unlocked ? (selected ? "Выбрано" : "Открыто") : cardBackUnlockLabel(back)}</span></button>`;
  }).join("");
}
function avatarEmojiMarkup(selectedEmoji = profile.avatarEmoji) {
  return `<div class="avatar-emoji-grid">${AVATAR_EMOJIS.map((emoji)=>`<button type="button" class="avatar-emoji ${selectedEmoji===emoji?"selected":""}" data-profile-avatar="${emoji}" aria-label="Аватар ${emoji}">${emoji}</button>`).join("")}</div>`;
}
function titlePillsMarkup(selectedTitle = profile.titleId) {
  return `<div class="title-pill-grid">${availableTitleDefs(profile).map((t)=>`<button type="button" class="title-pill ${selectedTitle===t.id?"selected":""}" data-profile-title="${t.id}"><i>${escapeHtml(t.icon)}</i><span>${escapeHtml(t.name)}</span></button>`).join("")}</div>`;
}
function closeProfileEditorModal() {
  const modal = $("#profileEditorModal");
  if (!modal) return;
  modal.classList.remove("show");
  modal.setAttribute("aria-hidden", "true");
}
function openProfileEditorModal() {
  const modal = $("#profileEditorModal"), content = $("#profileEditorContent");
  if (!modal || !content) return;
  modal.dataset.avatar = profile.avatarEmoji || "🙂";
  modal.dataset.title = profile.titleId || "player";
  content.innerHTML = `<div class="profile-editor-head"><div class="profile-editor-avatar-preview">${escapeHtml(profile.avatarEmoji || "🙂")}</div><div><small>ПРОФИЛЬ ИГРОКА</small><h2>Редактирование</h2></div></div>
    <label class="profile-field"><span>Имя игрока</span><input id="profileEditorName" maxlength="20" value="${escapeHtml(profile.playerName || "Игрок")}" autocomplete="off" spellcheck="false"></label>
    <div class="profile-field"><span>Аватар</span>${avatarEmojiMarkup(profile.avatarEmoji)}</div>
    <div class="profile-field"><span>Титул</span>${titlePillsMarkup(profile.titleId)}</div>
    <div class="profile-editor-actions"><button type="button" class="secondary" id="profileEditorCancel">Отмена</button><button type="button" class="primary" id="profileEditorSave">Сохранить</button></div>`;
  modal.classList.add("show");
  modal.setAttribute("aria-hidden", "false");
  modal.onclick = (event) => { if (event.target === modal) closeProfileEditorModal(); };
  if (!openProfileEditorModal.escapeBound) {
    document.addEventListener("keydown", (event) => { if (event.key === "Escape" && $("#profileEditorModal")?.classList.contains("show")) closeProfileEditorModal(); });
    openProfileEditorModal.escapeBound = true;
  }
  const nameInput = $("#profileEditorName");
  setTimeout(() => nameInput?.focus(), 60);
  content.querySelectorAll("[data-profile-avatar]").forEach((btn)=>btn.onclick=()=>{
    modal.dataset.avatar = btn.dataset.profileAvatar;
    content.querySelectorAll("[data-profile-avatar]").forEach((x)=>x.classList.toggle("selected", x===btn));
    const preview=content.querySelector(".profile-editor-avatar-preview"); if(preview) preview.textContent=btn.dataset.profileAvatar;
  });
  content.querySelectorAll("[data-profile-title]").forEach((btn)=>btn.onclick=()=>{
    modal.dataset.title = btn.dataset.profileTitle;
    content.querySelectorAll("[data-profile-title]").forEach((x)=>x.classList.toggle("selected", x===btn));
  });
  const close = $("#profileEditorClose"), cancel = $("#profileEditorCancel"), save = $("#profileEditorSave");
  if (close) close.onclick = closeProfileEditorModal;
  if (cancel) cancel.onclick = closeProfileEditorModal;
  if (save) save.onclick = ()=>{
    const name=(nameInput?.value||"").trim().replace(/\s+/g," "), avatar=modal.dataset.avatar, title=titleDefById(modal.dataset.title);
    profile.playerName=(name||"Игрок").slice(0,20);
    if(AVATAR_EMOJIS.includes(avatar)) profile.avatarEmoji=avatar;
    if(title&&titleUnlocked(title)) profile.titleId=title.id;
    saveProfile();
    closeProfileEditorModal();
    showToast("Профиль сохранён");
    renderHub();
  };
}
function notificationPermissionLabel() {
  if (!("Notification" in window)) return { cls:"blocked", text:"Не поддерживаются браузером" };
  if (Notification.permission === "granted") return { cls:"ok", text:"Разрешение браузера получено" };
  if (Notification.permission === "denied") return { cls:"blocked", text:"Заблокированы в настройках браузера" };
  return { cls:"idle", text:"Браузер ещё не спрашивал разрешение" };
}
function appearanceTabMarkup() {
  const themes = THEME_DEFS.map((t)=>{ const unlocked=themeUnlocked(t); return `<button class="theme-tile theme-${t.id} ${unlocked?"":"locked"} ${profile.theme===t.id?"selected":""}" data-theme-id="${t.id}"><b>${t.name}</b><span>${unlocked?"Открыто":themeUnlockLabel(t)}</span></button>`; }).join("");
  const effects = EFFECT_DEFS.map((e)=>{ const unlocked=effectUnlocked(e); return `<button class="effect-tile ${unlocked?"":"locked"} ${profile.effect===e.id?"selected":""}" data-effect-id="${e.id}">${effectPreviewMarkup(e)}<b>${e.name}</b><span>${unlocked?"Открыто":effectUnlockLabel(e)}</span></button>`; }).join("");
  return `${profileHeroMarkup()}
    <section class="hub-section"><div class="hub-section-head"><h3>Темы</h3><small>выбери оформление</small></div><div class="theme-grid">${themes}</div></section>
    <section class="hub-section"><div class="hub-section-head"><h3>Рубашки</h3><small>${CARD_BACK_DEFS.filter((b) => cardBackUnlocked(b)).length}/${CARD_BACK_DEFS.length}</small></div><div class="cardback-grid">${cardBackMarkup()}</div></section>
    <section class="hub-section"><div class="hub-section-head"><h3>Рамки профиля</h3><small>за финалы глав</small></div><div class="frame-grid">${typeof frameTilesMarkup === "function" ? frameTilesMarkup() : ""}</div></section>
    <section class="hub-section"><div class="hub-section-head"><h3>Эффекты победы</h3><small>косметические награды</small></div><div class="effect-grid">${effects}</div></section>`;
}
function settingsTabMarkup() {
  const standalone=isStandalonePwa(),
    installLabel=standalone?"✓ Игра установлена":deferredInstallPrompt?"＋ Установить игру":"＋ На главный экран",
    report=CATEGORY_BANK_REPORT || {},
    notificationStatus=notificationPermissionLabel();
  const sourceMode = normalizeCardSourceMode(profile.settings.cardSourceMode);
  const settingsContent = `<div class="card-source-setting"><div class="hub-subhead"><h4>Карты в раскладах</h4><small>какие ассоциации использовать во всех режимах</small></div><div class="card-source-options">${[["words","Только слова","Аа"],["pictures","Только картинки","🖼️"],["all","Все колоды","▦"]].map(([id,label,icon])=>`<button class="${sourceMode===id?"active":""}" data-card-source-mode="${id}"><i>${icon}</i><span>${label}</span></button>`).join("")}</div></div><div class="settings-grid">
      <button class="setting-toggle ${profile.settings.sound?"on":""}" id="soundToggle"><b>♪ Эффекты</b><span>${profile.settings.sound?"Включены":"Выключены"}</span></button>
      <button class="setting-toggle ${profile.settings.music?"on":""}" id="musicToggle"><b>♫ Музыка</b><span>${profile.settings.music?"Включена":"Выключена"}</span></button>
      <button class="setting-toggle ${profile.settings.haptics?"on":""}" id="hapticsToggle"><b>⌁ Вибрация</b><span>${profile.settings.haptics?"Включена":"Выключена"}</span></button>
      <button class="setting-toggle install" id="installPwa" ${standalone?"disabled":""}><b>${installLabel}</b><span>${standalone?"Standalone-режим":"Работает офлайн после установки"}</span></button>
    </div>`;
  const notificationsContent = `<div class="notification-state ${notificationStatus.cls}"><i></i><span>${notificationStatus.text}</span></div>
      <div class="settings-grid notification-grid">
        <button class="setting-toggle ${profile.settings.notifications?"on":""}" id="notificationToggle"><b>🔔 Все Push</b><span>${profile.settings.notifications?"Включены":"Выключены"}</span></button>
        <button class="setting-toggle ${profile.settings.challengeReminders!==false?"on":""}" id="challengeReminderToggle"><b>⚔ Вызовы</b><span>${profile.settings.challengeReminders!==false?"Ответы друзей":"Не уведомлять"}</span></button>
        <button class="setting-toggle ${profile.settings.dailyReminders!==false?"on":""}" id="dailyReminderToggle"><b>☀ Daily</b><span>${profile.settings.dailyReminders!==false?"Напоминать":"Не напоминать"}</span></button>
        <button class="setting-toggle ${profile.settings.weeklyReminders!==false?"on":""}" id="weeklyReminderToggle"><b>W Неделя</b><span>${profile.settings.weeklyReminders!==false?"Напоминать":"Не напоминать"}</span></button>
      </div>
      <button class="notification-test" id="notificationTest" ${profile.settings.notifications && typeof Notification!=="undefined" && Notification.permission==="granted"?"":"disabled"}>Проверить уведомление</button>
      <p class="settings-note">Главный переключатель отключает все системные Push. Остальные настройки позволяют отдельно выбрать ответы на вызовы, Daily и финал недели.</p>`;
  const saveContent = `<div class="save-tools"><button id="exportSave">⇩ Экспорт прогресса</button><button id="importSave">⇧ Импорт прогресса</button></div>`;
  const bankContent = `<div class="bank-health-grid"><span><b>${report.categories||BANK.length}</b> категорий</span><span><b>${report.words||0}</b> слов</span><span><b>${report.ambiguousWords?.length||0}</b> пересечений</span><span><b>${report.warnings?.length||0}</b> предупреждений</span></div><p>Пересечения автоматически не попадают в один расклад; генератор также проверяет проходимость seed.</p>`;
  const tutorialContent = `<button class="wide-secondary" id="hubTutorial">◇ Запустить обучение заново</button>`;
  return `${profileHeroMarkup()}
    ${collapsibleSectionMarkup("settings-main", "Настройки", "звук и ощущения", settingsContent)}
    ${collapsibleSectionMarkup("notifications", "Уведомления", "управление по типам", notificationsContent, "notification-settings")}
    ${collapsibleSectionMarkup("save", "Сохранение", "не потеряй прогресс", saveContent)}
    ${collapsibleSectionMarkup("bank", "База слов", "внутренняя проверка", bankContent, "bank-health")}
    ${collapsibleSectionMarkup("tutorial", "Обучение", "повторить механику", tutorialContent)}`;
}
function renderHub() {
  recomputeStars();
  ensureWeeklyChallenge();
  const views = { play: playTabMarkup, progress: progressTabMarkup, collection: collectionTabMarkup, appearance: appearanceTabMarkup, settings: settingsTabMarkup };
  hubContent.innerHTML = (views[hubTab] || playTabMarkup)();
  hubNav.innerHTML = hubTabsMarkup();
  bindHubHandlers();
}
function bindHubHandlers() {
  hubNav.querySelectorAll("[data-hub-tab]").forEach((btn)=>btn.onclick=()=>{hubTab=btn.dataset.hubTab; renderHub();});
  const on=(id,fn)=>{const el=$(id); if(el) el.onclick=fn;};
  on("#smartAction",()=>runSmartHomeAction?.());
  on("#hubContinue",()=>{const next=profile.currentLevel||1; closeHub(); if(!state||state.rewarded||state.mode!=="regular") makeLevel(next,{mode:"regular"});});
  on("#hubDaily",()=>{closeHub(); makeLevel(0,{mode:"daily",seed:`daily:${todayKey()}`});});
  on("#hubMarathon",()=>{closeHub(); const runId=`marathon:${Date.now().toString(36)}`; makeLevel(1,{mode:"marathon",seed:`${runId}:1`,marathonRound:1,marathonId:runId});});
  on("#hubCalm",()=>{closeHub(); makeLevel(1,{mode:"calm",seed:`calm:${Date.now()}:${Math.random()}`});});
  on("#hubShareChallenge",()=>shareNewChallenge());
  on("#challengeStart",()=>startChallengeCode($("#challengeInput")?.value));
  const challengeInput=$("#challengeInput"); if(challengeInput) challengeInput.oninput=()=>{challengeInput.value=normalizeChallengeCode(challengeInput.value);};
  hubContent.querySelectorAll("[data-owned-challenge-play]").forEach((btn)=>btn.onclick=()=>playOwnedChallenge(btn.dataset.ownedChallengePlay));
  hubContent.querySelectorAll("[data-owned-challenge-share]").forEach((btn)=>btn.onclick=()=>shareChallengeEntry(ownedChallengeByCode(btn.dataset.ownedChallengeShare)));
  hubContent.querySelectorAll("[data-owned-challenge-rematch]").forEach((btn)=>btn.onclick=()=>createChallengeRematch?.(ownedChallengeByCode(btn.dataset.ownedChallengeRematch),"creator"));
  hubContent.querySelectorAll("[data-received-challenge-rematch]").forEach((btn)=>btn.onclick=()=>createChallengeRematch?.(receivedChallengeByCode(btn.dataset.receivedChallengeRematch),"guest"));
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
  hubContent.querySelectorAll("[data-card-source-mode]").forEach((btn)=>btn.onclick=()=>{profile.settings.cardSourceMode=normalizeCardSourceMode(btn.dataset.cardSourceMode);saveProfile();showToast(`Расклады: ${btn.textContent.trim()}`);renderHub();});
  hubContent.querySelectorAll("[data-association-collection]").forEach((btn)=>btn.onclick=()=>{const id=btn.dataset.associationCollection;closeHub();makeLevel(1,{mode:"collection",collectionId:id,seed:`collection:${id}:${Date.now()}`});});
  hubContent.querySelectorAll("[data-theme-id]").forEach((btn)=>btn.onclick=()=>{const def=THEME_DEFS.find((x)=>x.id===btn.dataset.themeId);if(themeUnlocked(def)){profile.theme=def.id;saveProfile();}renderHub();if(!themeUnlocked(def))showToast(`Откроется за ${themeUnlockLabel(def)}`);});
  hubContent.querySelectorAll("[data-card-back-id]").forEach((btn)=>btn.onclick=()=>{const def=CARD_BACK_DEFS.find((x)=>x.id===btn.dataset.cardBackId);if(cardBackUnlocked(def)){profile.cardBack=def.id;saveProfile();}renderHub();if(!cardBackUnlocked(def))showToast(cardBackUnlockLabel(def));});
  hubContent.querySelectorAll("[data-frame-id]").forEach((btn)=>btn.onclick=()=>{const def=FRAME_DEFS.find((x)=>x.id===btn.dataset.frameId);if(frameUnlocked(def)){profile.frame=def.id;saveProfile();}renderHub();if(!frameUnlocked(def))showToast(`Откроется после главы ${def.chapter}`);});
  hubContent.querySelectorAll("[data-effect-id]").forEach((btn)=>btn.onclick=()=>{const def=EFFECT_DEFS.find((x)=>x.id===btn.dataset.effectId);if(effectUnlocked(def)){profile.effect=def.id;saveProfile();burst(false);}renderHub();if(!effectUnlocked(def))showToast(effectUnlockLabel(def));});
  on("#soundToggle",()=>{profile.settings.sound=!profile.settings.sound;saveProfile();if(profile.settings.sound)playSfx("combo",.65);renderHub();});
  on("#musicToggle",()=>{profile.settings.music=!profile.settings.music;saveProfile();if(profile.settings.music)setBackgroundMusic("menu");else stopBackgroundMusic();renderHub();});
  on("#hapticsToggle",()=>{profile.settings.haptics=!profile.settings.haptics;saveProfile();if(profile.settings.haptics)haptic([8,20,8]);renderHub();});
  on("#notificationToggle",async()=>{if(profile.settings.notifications){await disablePushNotifications?.();renderHub();}else{try{await registerPushNotifications?.();}catch(err){console.error(err);showToast("Push пока не настроен на сервере");}renderHub();}});
  on("#challengeReminderToggle",async()=>{profile.settings.challengeReminders=profile.settings.challengeReminders===false;saveProfile();await syncChallengePushPreference?.();syncPushState?.();renderHub();});
  on("#dailyReminderToggle",()=>{profile.settings.dailyReminders=profile.settings.dailyReminders===false;saveProfile();syncPushState?.();renderHub();});
  on("#weeklyReminderToggle",()=>{profile.settings.weeklyReminders=profile.settings.weeklyReminders===false;saveProfile();syncPushState?.();renderHub();});
  on("#notificationTest",async()=>{const ok=await showSystemNotification?.("Словасьянс", "Тестовое уведомление работает ✓", {tag:"worditaire-test"}); if(!ok) showToast("Не удалось показать уведомление");});
  on("#exportSave",exportProgress); on("#importSave",importProgress);
  on("#installPwa",async()=>{if(isStandalonePwa())return;if(deferredInstallPrompt){const prompt=deferredInstallPrompt;deferredInstallPrompt=null;await prompt.prompt();const result=await prompt.userChoice.catch(()=>null);track("pwa_prompt",{outcome:result?.outcome||"unknown"});renderHub();}else{const ios=/iphone|ipad|ipod/i.test(navigator.userAgent);showToast(ios?'iPhone: Поделиться → На экран «Домой»':'Открой меню браузера → Установить приложение');}});
}
function openHub(tab = null) {
  if (tab) hubTab = tab;
  hubChapterNumber = chapterInfo(profile.currentLevel || 1).number;
  renderHub();
  hub.classList.add("show");
  setBackgroundMusic("menu");
  track("hub_opened", { tab: hubTab });
  if (hubTab === "play") { refreshOwnedChallenges({ notify: true }); refreshReceivedChallenges?.(); }
}
function closeHub() {
  hub.classList.remove("show");
  setBackgroundMusic("game");
}
