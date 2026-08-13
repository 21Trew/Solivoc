/* Main menu / progression hub component. */
function renderHub() {
  recomputeStars();
  const nt = nextTheme(),
    dailyDone = profile.daily.completedDates.includes(todayKey()),
    discovered = new Set(profile.discovered),
    unlockedThemes = THEME_DEFS.filter((t) => profile.totalStars >= t.stars);
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
  const nextLevel = profile.currentLevel || 1;
  const levelStars = profile.starsByLevel[nextLevel] || 0;
  hubContent.innerHTML = `<section class="hub-hero"><div class="hub-hero-top"><div><div class="hub-level">Следующий уровень: ${nextLevel}</div><div class="hub-stars">★ ${profile.totalStars}</div></div><span class="daily-badge">🔥 ${profile.daily.currentStreak} дн.</span></div><div class="hub-progress"><i style="width:${nt ? Math.min(100, (profile.totalStars / nt.stars) * 100) : 100}%"></i></div><div class="hub-level" style="margin-top:6px">${nt ? `Следующая тема ${nt.name} — ещё ${nt.stars - profile.totalStars} ★` : "Все темы открыты"}</div></section><div class="hub-actions"><button class="hub-action primary" id="hubContinue"><strong>▶ Продолжить</strong><span>Уровень ${state?.mode === "regular" ? state.level : nextLevel}</span></button><button class="hub-action daily" id="hubDaily"><strong>☀ Daily</strong><span>${dailyDone ? "Сегодня пройдено ✓" : "Один расклад для всех"}</span></button><button class="hub-action" id="hubTutorial"><strong>◇ Обучение</strong><span>3 коротких шага</span></button><button class="hub-action" id="hubNew"><strong>↻ Текущий уровень</strong><span>${levelStars ? "Лучший результат: " + levelStars + " ★" : "Ещё не пройден"}</span></button></div><section class="hub-section"><div class="hub-section-head"><h3>Темы</h3><small>${unlockedThemes.length}/${THEME_DEFS.length}</small></div><div class="theme-grid">${themes}</div></section><section class="hub-section"><div class="hub-section-head"><h3>Коллекция категорий</h3><small>${discovered.size}/${BANK.length}</small></div><div class="collection-grid">${collection}</div></section><section class="hub-section"><div class="hub-section-head"><h3>Достижения</h3><small>${profile.achievements.length}/${ACHIEVEMENTS.length}</small></div><div class="achievement-list">${ach}</div></section><section class="hub-section"><div class="hub-section-head"><h3>Статистика</h3><small>локально на устройстве</small></div><div class="stats-grid"><div class="stat-box"><b>${profile.stats.levelsCompleted}</b><span>уровней</span></div><div class="stat-box"><b>${profile.stats.categoriesCompleted}</b><span>категорий</span></div><div class="stat-box"><b>${profile.stats.tripleStarWins}</b><span>★★★ уровней</span></div><div class="stat-box"><b>${profile.daily.bestStreak}</b><span>рекорд серии</span></div><div class="stat-box"><b>${profile.stats.hints}</b><span>подсказок</span></div><div class="stat-box"><b>${profile.stats.undos}</b><span>отмен</span></div></div></section>`;
  $("#hubContinue").onclick = () => closeHub();
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
  renderHub();
  hub.classList.add("show");
  track("hub_opened");
}
function closeHub() {
  hub.classList.remove("show");
}
