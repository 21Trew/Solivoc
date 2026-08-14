/* Main menu / progression hub component: chapters, themes, collection, settings and PWA install. */
let hubChapterNumber = null;
function isStandalonePwa() {
  return window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;
}
function levelStarsMarkup(stars) {
  return stars ? `${"★".repeat(stars)}${"☆".repeat(3 - stars)}` : "···";
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
  const earned = Array.from({ length: CHAPTER_SIZE }, (_, i) => profile.starsByLevel[info.start + i] || 0).reduce(
    (a, b) => a + b,
    0,
  );
  return `<section class="hub-section chapter-section"><div class="hub-section-head chapter-head"><button class="chapter-nav" id="chapterPrev" ${number <= 1 ? "disabled" : ""}>‹</button><div><h3>Глава ${number} · ${info.title}</h3><small>${earned}/30 ★</small></div><button class="chapter-nav" id="chapterNext" ${info.end >= (profile.currentLevel || 1) ? "disabled" : ""}>›</button></div><div class="chapter-grid">${levels.join("")}</div></section>`;
}
function renderHub() {
  recomputeStars();
  const nt = nextTheme(),
    dailyDone = profile.daily.completedDates.includes(todayKey()),
    discovered = new Set(profile.discovered),
    unlockedThemes = THEME_DEFS.filter((t) => profile.totalStars >= t.stars),
    currentChapter = chapterInfo(profile.currentLevel || 1);
  if (!hubChapterNumber) hubChapterNumber = currentChapter.number;
  hubChapterNumber = Math.max(1, Math.min(hubChapterNumber, currentChapter.number));

  const collection = BANK.map(
    (c) =>
      `<div class="collection-item ${discovered.has(c.id) ? "seen" : "locked"}">${discovered.has(c.id) ? c.title : "???"}</div>`,
  ).join("");
  const ach = ACHIEVEMENTS.map((a) => {
    const done = profile.achievements.includes(a.id);
    return `<div class="achievement ${done ? "" : "locked"}"><div class="ico">${a.icon}</div><div><b>${a.title}</b><p>${a.desc}</p></div><span class="done">${done ? "✓" : ""}</span></div>`;
  }).join("");
  const themes = THEME_DEFS.map((t) => {
    const unlocked = profile.totalStars >= t.stars;
    return `<button class="theme-tile theme-${t.id} ${unlocked ? "" : "locked"} ${profile.theme === t.id ? "selected" : ""}" data-theme-id="${t.id}" ${unlocked ? "" : "disabled"}><b>${t.name}</b><span>${unlocked ? "Открыто" : t.stars + " ★"}</span></button>`;
  }).join("");
  const nextLevel = profile.currentLevel || 1,
    continueLevel = state?.mode === "regular" && !state.rewarded ? state.level : nextLevel,
    levelStars = profile.starsByLevel[nextLevel] || 0,
    standalone = isStandalonePwa(),
    installLabel = standalone ? "✓ Игра установлена" : deferredInstallPrompt ? "＋ Установить игру" : "＋ На главный экран";

  hubContent.innerHTML = `<section class="hub-hero"><div class="hub-hero-top"><div><div class="hub-level">Глава ${currentChapter.number} · ${currentChapter.title}</div><div class="hub-stars">★ ${profile.totalStars}</div></div><span class="daily-badge">🔥 ${profile.daily.currentStreak} дн.</span></div><div class="hub-progress"><i style="width:${nt ? Math.min(100, (profile.totalStars / nt.stars) * 100) : 100}%"></i></div><div class="hub-level" style="margin-top:6px">${nt ? `Следующая тема ${nt.name} — ещё ${nt.stars - profile.totalStars} ★` : "Все темы открыты"}</div></section><div class="hub-actions"><button class="hub-action primary" id="hubContinue"><strong>▶ Продолжить</strong><span>Уровень ${continueLevel}</span></button><button class="hub-action daily" id="hubDaily"><strong>☀ Daily</strong><span>${dailyDone ? "Сегодня пройдено ✓" : "Один расклад для всех"}</span></button><button class="hub-action" id="hubTutorial"><strong>◇ Обучение</strong><span>3 коротких шага</span></button><button class="hub-action" id="hubNew"><strong>↻ Текущий уровень</strong><span>${levelStars ? "Лучший результат: " + levelStars + " ★" : "Ещё не пройден"}</span></button></div>${chapterMarkup(hubChapterNumber)}<section class="hub-section"><div class="hub-section-head"><h3>Настройки</h3><small>game feel</small></div><div class="settings-grid"><button class="setting-toggle ${profile.settings.sound ? "on" : ""}" id="soundToggle"><b>♪ Звук</b><span>${profile.settings.sound ? "Включён" : "Выключен"}</span></button><button class="setting-toggle ${profile.settings.haptics ? "on" : ""}" id="hapticsToggle"><b>⌁ Вибрация</b><span>${profile.settings.haptics ? "Включена" : "Выключена"}</span></button><button class="setting-toggle install" id="installPwa" ${standalone ? "disabled" : ""}><b>${installLabel}</b><span>${standalone ? "Standalone-режим" : deferredInstallPrompt ? "Работает офлайн" : "Через меню браузера"}</span></button></div></section><section class="hub-section"><div class="hub-section-head"><h3>Темы</h3><small>${unlockedThemes.length}/${THEME_DEFS.length}</small></div><div class="theme-grid">${themes}</div></section><section class="hub-section"><div class="hub-section-head"><h3>Коллекция категорий</h3><small>${discovered.size}/${BANK.length}</small></div><div class="collection-grid">${collection}</div></section><section class="hub-section"><div class="hub-section-head"><h3>Достижения</h3><small>${profile.achievements.length}/${ACHIEVEMENTS.length}</small></div><div class="achievement-list">${ach}</div></section><section class="hub-section"><div class="hub-section-head"><h3>Статистика</h3><small>локально на устройстве</small></div><div class="stats-grid"><div class="stat-box"><b>${profile.stats.levelsCompleted}</b><span>уровней</span></div><div class="stat-box"><b>${profile.stats.categoriesCompleted}</b><span>категорий</span></div><div class="stat-box"><b>${profile.stats.tripleStarWins}</b><span>★★★ уровней</span></div><div class="stat-box"><b>×${profile.stats.maxCombo || 0}</b><span>лучшее комбо</span></div><div class="stat-box"><b>${profile.stats.specialCompleted || 0}</b><span>особых уровней</span></div><div class="stat-box"><b>${profile.daily.bestStreak}</b><span>рекорд серии</span></div></div></section>`;

  $("#hubContinue").onclick = () => {
    closeHub();
    if (!state || state.rewarded || state.mode !== "regular") makeLevel(nextLevel, { mode: "regular" });
  };
  $("#hubDaily").onclick = () => {
    closeHub();
    makeLevel(0, { mode: "daily", seed: `daily:${todayKey()}` });
  };
  $("#hubTutorial").onclick = () => {
    closeHub();
    makeLevel(1, { mode: "tutorial", step: 1 });
  };
  $("#hubNew").onclick = () => {
    closeHub();
    makeLevel(profile.currentLevel || 1);
  };
  $("#chapterPrev").onclick = () => {
    hubChapterNumber = Math.max(1, hubChapterNumber - 1);
    renderHub();
  };
  $("#chapterNext").onclick = () => {
    hubChapterNumber = Math.min(currentChapter.number, hubChapterNumber + 1);
    renderHub();
  };
  hubContent.querySelectorAll("[data-chapter-level]").forEach((btn) => {
    btn.onclick = () => {
      const level = +btn.dataset.chapterLevel;
      closeHub();
      makeLevel(level, { mode: "regular" });
    };
  });
  $("#soundToggle").onclick = () => {
    profile.settings.sound = !profile.settings.sound;
    saveProfile();
    if (profile.settings.sound) playSfx("combo", 0.65);
    renderHub();
  };
  $("#hapticsToggle").onclick = () => {
    profile.settings.haptics = !profile.settings.haptics;
    saveProfile();
    if (profile.settings.haptics) haptic([8, 20, 8]);
    renderHub();
  };
  $("#installPwa").onclick = async () => {
    if (isStandalonePwa()) return;
    if (deferredInstallPrompt) {
      const prompt = deferredInstallPrompt;
      deferredInstallPrompt = null;
      await prompt.prompt();
      const result = await prompt.userChoice.catch(() => null);
      track("pwa_prompt", { outcome: result?.outcome || "unknown" });
      renderHub();
    } else {
      const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
      showToast(ios ? "iPhone: Поделиться → На экран «Домой»" : "Открой меню браузера → Установить приложение");
    }
  };
  hubContent.querySelectorAll("[data-theme-id]").forEach(
    (btn) =>
      (btn.onclick = () => {
        profile.theme = btn.dataset.themeId;
        saveProfile();
        renderHub();
        showToast(`Тема: ${THEME_DEFS.find((t) => t.id === profile.theme).name}`);
      }),
  );
}
function openHub() {
  hubChapterNumber = chapterInfo(profile.currentLevel || 1).number;
  renderHub();
  hub.classList.add("show");
  track("hub_opened");
}
function closeHub() {
  hub.classList.remove("show");
}
