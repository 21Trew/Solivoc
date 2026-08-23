/* Словасьянс v32: compact challenges and campaign quick picker. */
(() => {
  if (window.__solivocV32UiInstalled) return;
  window.__solivocV32UiInstalled = true;

  const WORLD_NAMES = [
    "Архипелаг первых связей",
    "Сад смыслов",
    "Город созвучий",
    "Архив ассоциаций",
    "Океан понятий",
    "Лабиринт эрудиции",
    "Обсерватория идей",
    "Мастерская контекстов",
    "Хроники языка",
    "За гранью очевидного",
  ];
  const CHAPTER_NAMES = [
    "Порог",
    "Первые тропы",
    "Перекрёсток",
    "Скрытый слой",
    "Проверка памяти",
    "Тонкие связи",
    "Ложные следы",
    "Глубина",
    "Последний рубеж",
    "Сердце мира",
  ];

  function worldForChapter(chapter) {
    return Math.floor((Math.max(1, Number(chapter) || 1) - 1) / 10) + 1;
  }
  function chapterInWorld(chapter) {
    return ((Math.max(1, Number(chapter) || 1) - 1) % 10) + 1;
  }
  function worldName(world) {
    return WORLD_NAMES[world - 1] || `Мир ${world}`;
  }
  function localChapterName(chapter) {
    return CHAPTER_NAMES[chapterInWorld(chapter) - 1] || `Глава ${chapterInWorld(chapter)}`;
  }
  function chapterSize() {
    return Math.max(1, Number(typeof CHAPTER_SIZE !== "undefined" ? CHAPTER_SIZE : 10) || 10);
  }
  function chapterFirstLevel(chapter) {
    return (Math.max(1, chapter) - 1) * chapterSize() + 1;
  }
  function chapterEarnedStars(chapter) {
    try {
      return chapterStarsForProfile(profile, chapter).reduce((sum, value) => sum + (+value || 0), 0);
    } catch {
      return 0;
    }
  }

  function installStyles() {
    if (document.querySelector("#v32UiStyles")) return;
    const style = document.createElement("style");
    style.id = "v32UiStyles";
    style.textContent = `
      .weekly-card.v32-challenge-card{
        position:relative;
      }
      .v32-challenge-top{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:10px;
        min-width:0;
      }
      .weekly-card.v32-challenge-card .v32-challenge-top>small{
        min-width:0;
        margin:0;
      }
      .v32-challenge-reward{
        flex:0 0 auto;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        min-height:30px;
        padding:6px 10px;
        border-radius:999px;
        background:rgba(255,216,106,.16);
        border:1px solid rgba(255,216,106,.30);
        color:#ffe08a;
        font-size:12px;
        font-weight:950;
        line-height:1;
        white-space:nowrap;
      }
      .v32-challenge-progress-row{
        display:grid;
        grid-template-columns:minmax(0,1fr) auto;
        align-items:center;
        gap:12px;
        margin-top:10px;
      }
      .weekly-card.v32-challenge-card .v32-challenge-progress-row .weekly-progress{
        min-width:0;
        margin:0;
      }
      .v32-challenge-progress-meta{
        margin:0!important;
        color:inherit;
        font-style:normal;
        font-size:12px;
        font-weight:900;
        line-height:1.1;
        white-space:nowrap;
        opacity:.88;
      }
      .v32-challenge-progress-meta.done{
        color:#ffe08a;
      }

      .chapter-section>.v30-world-banner{display:none!important}
      .chapter-head .v32-chapter-trigger{
        position:relative;
        min-width:0;
        flex:1;
        padding:4px 28px 4px 8px;
        border-radius:14px;
        cursor:pointer;
        -webkit-tap-highlight-color:transparent;
      }
      .chapter-head .v32-chapter-trigger::after{
        content:"⌄";
        position:absolute;
        right:7px;
        top:50%;
        transform:translateY(-52%);
        color:rgba(255,255,255,.62);
        font-size:18px;
        font-weight:900;
      }
      .chapter-head .v32-chapter-trigger h3{
        margin:0;
        overflow:hidden;
        color:inherit;
        font-size:16px;
        line-height:1.2;
        text-overflow:ellipsis;
        white-space:nowrap;
      }
      .chapter-head .v32-chapter-trigger small{
        display:block;
        margin-top:3px;
        overflow:hidden;
        text-overflow:ellipsis;
        white-space:nowrap;
      }
      .chapter-head .v32-chapter-trigger:focus-visible{
        outline:3px solid rgba(124,110,255,.75);
        outline-offset:2px;
      }

      .v32-campaign-picker{
        position:fixed;
        inset:0;
        z-index:10120;
        display:grid;
        place-items:end center;
        padding:16px;
        background:rgba(10,9,29,.70);
        backdrop-filter:blur(10px);
      }
      .v32-campaign-picker[hidden]{display:none}
      .v32-campaign-picker-card{
        width:min(620px,100%);
        max-height:min(88vh,780px);
        display:flex;
        flex-direction:column;
        overflow:hidden;
        border:1px solid rgba(255,255,255,.14);
        border-radius:26px;
        background:linear-gradient(165deg,#29205d,#171b49);
        color:#fff;
        box-shadow:0 28px 90px rgba(0,0,0,.42);
      }
      .v32-picker-head{
        display:flex;
        align-items:flex-start;
        justify-content:space-between;
        gap:14px;
        padding:18px 18px 12px;
      }
      .v32-picker-head small{
        display:block;
        color:rgba(255,255,255,.58);
        font-size:10px;
        font-weight:900;
        letter-spacing:.13em;
        text-transform:uppercase;
      }
      .v32-picker-head h2{
        margin:4px 0 0;
        font-size:22px;
        line-height:1.15;
      }
      .v32-picker-close{
        width:38px;
        height:38px;
        flex:0 0 38px;
        border:0;
        border-radius:50%;
        background:rgba(255,255,255,.10);
        color:#fff;
        font:inherit;
        font-size:22px;
        cursor:pointer;
      }
      .v32-world-strip{
        display:flex;
        gap:8px;
        overflow:auto;
        padding:0 16px 12px;
        scrollbar-width:none;
      }
      .v32-world-strip::-webkit-scrollbar{display:none}
      .v32-world-button{
        flex:0 0 auto;
        min-width:128px;
        border:1px solid rgba(255,255,255,.13);
        border-radius:15px;
        padding:9px 11px;
        background:rgba(255,255,255,.06);
        color:#fff;
        text-align:left;
        font:inherit;
        cursor:pointer;
      }
      .v32-world-button.active{
        border-color:transparent;
        background:linear-gradient(120deg,#6e5cff,#3b9fdf);
      }
      .v32-world-button.locked{opacity:.45}
      .v32-world-button b,.v32-world-button span{display:block}
      .v32-world-button b{font-size:12px}
      .v32-world-button span{
        max-width:150px;
        margin-top:2px;
        overflow:hidden;
        font-size:9px;
        opacity:.72;
        text-overflow:ellipsis;
        white-space:nowrap;
      }
      .v32-picker-body{
        overflow:auto;
        padding:0 16px calc(18px + env(safe-area-inset-bottom));
      }
      .v32-picker-section-title{
        display:flex;
        align-items:end;
        justify-content:space-between;
        gap:10px;
        margin:5px 0 8px;
      }
      .v32-picker-section-title b{
        font-size:13px;
      }
      .v32-picker-section-title small{
        color:rgba(255,255,255,.58);
        font-size:10px;
      }
      .v32-chapter-strip{
        display:grid;
        grid-template-columns:repeat(5,minmax(0,1fr));
        gap:7px;
        margin-bottom:15px;
      }
      .v32-chapter-button{
        min-height:46px;
        border:1px solid rgba(255,255,255,.12);
        border-radius:13px;
        background:rgba(255,255,255,.055);
        color:#fff;
        font:inherit;
        font-size:12px;
        font-weight:900;
        cursor:pointer;
      }
      .v32-chapter-button.active{
        border-color:#9e91ff;
        background:rgba(126,105,255,.26);
        box-shadow:inset 0 0 0 1px rgba(158,145,255,.34);
      }
      .v32-chapter-button:disabled{opacity:.30;cursor:default}
      .v32-level-grid{
        display:grid;
        grid-template-columns:repeat(5,minmax(0,1fr));
        gap:8px;
      }
      .v32-level-button{
        min-height:60px;
        display:grid;
        align-content:center;
        justify-items:center;
        gap:5px;
        border:1px solid rgba(255,255,255,.13);
        border-radius:15px;
        background:rgba(255,255,255,.07);
        color:#fff;
        font:inherit;
        cursor:pointer;
      }
      .v32-level-button.current{
        border-color:#a89bff;
        box-shadow:inset 0 0 0 2px rgba(168,155,255,.45);
      }
      .v32-level-button:disabled{opacity:.30;cursor:default}
      .v32-level-button b{
        font-size:14px;
        line-height:1;
      }
      .v32-level-button span{
        color:#ffd86a;
        font-size:10px;
        line-height:1;
        letter-spacing:-.03em;
      }

      @media(max-width:520px){
        .v32-challenge-progress-row{gap:9px}
        .v32-challenge-reward{padding:6px 9px;font-size:11px}
        .v32-challenge-progress-meta{font-size:11px}
        .v32-campaign-picker{padding:0;place-items:end stretch}
        .v32-campaign-picker-card{
          width:100%;
          max-height:90vh;
          border-radius:25px 25px 0 0;
        }
        .v32-chapter-strip,.v32-level-grid{grid-template-columns:repeat(5,minmax(0,1fr))}
      }
    `;
    document.head.appendChild(style);
  }

  function installChallengeMarkup() {
    if (typeof weeklyMarkup === "function" && !weeklyMarkup.__v32Compact) {
      weeklyMarkup = function v32WeeklyMarkup() {
        const w = weeklyProgress();
        const daysLeft = typeof daysUntilWeekEnd === "function" ? daysUntilWeekEnd() : 0;
        const reward = Math.max(0, Number(w?.def?.rewardXp) || 0);
        const right = w.completed
          ? `${w.value}/${w.goal} ✓`
          : `${w.value}/${w.goal}${daysLeft ? ` · ${daysLeft} дн.` : ""}`;
        return `<section class="weekly-card v32-challenge-card ${w.completed ? "done" : ""}">
          <div class="weekly-icon">${w.def.icon}</div>
          <div class="weekly-copy">
            <div class="v32-challenge-top"><small>НЕДЕЛЬНОЕ ИСПЫТАНИЕ</small><span class="v32-challenge-reward">+${reward} XP</span></div>
            <b>${w.def.title}</b>
            <span>${w.def.desc}</span>
            <div class="v32-challenge-progress-row">
              <div class="weekly-progress"><i style="width:${w.ratio * 100}%"></i></div>
              <em class="v32-challenge-progress-meta ${w.completed ? "done" : ""}">${right}</em>
            </div>
          </div>
        </section>`;
      };
      weeklyMarkup.__v32Compact = true;
    }

    if (typeof monthlyMarkup === "function" && !monthlyMarkup.__v32Compact) {
      monthlyMarkup = function v32MonthlyMarkup() {
        const m = monthlyProgress();
        const daysLeft = typeof daysUntilMonthEnd === "function" ? daysUntilMonthEnd() : 0;
        const reward = Math.max(0, Number(m?.def?.rewardXp) || 0);
        const right = m.completed
          ? `${m.value}/${m.goal} ✓`
          : `${m.value}/${m.goal}${daysLeft ? ` · ${daysLeft} дн.` : ""}`;
        return `<section class="weekly-card monthly-card v32-challenge-card ${m.completed ? "done" : ""}">
          <div class="weekly-icon monthly-icon">${m.def.icon}</div>
          <div class="weekly-copy">
            <div class="v32-challenge-top"><small>МЕСЯЧНОЕ ИСПЫТАНИЕ</small><span class="v32-challenge-reward">+${reward} XP</span></div>
            <b>${m.def.title}</b>
            <span>${m.def.desc}</span>
            <div class="v32-challenge-progress-row">
              <div class="weekly-progress"><i style="width:${m.ratio * 100}%"></i></div>
              <em class="v32-challenge-progress-meta ${m.completed ? "done" : ""}">${right}</em>
            </div>
          </div>
        </section>`;
      };
      monthlyMarkup.__v32Compact = true;
    }
  }

  function installCompactChapterMarkup() {
    if (typeof chapterMarkup !== "function" || chapterMarkup.__v32Compact) return;
    const base = chapterMarkup;
    chapterMarkup = function v32ChapterMarkup(number) {
      const template = document.createElement("template");
      template.innerHTML = base(number);

      template.content.querySelector(".v30-world-banner")?.remove();

      const chapter = Math.max(1, Number(number) || 1);
      const world = worldForChapter(chapter);
      const local = chapterInWorld(chapter);
      const earned = chapterEarnedStars(chapter);
      const perfect = earned === 30;
      const center = template.content.querySelector(".chapter-head > div");
      if (center) {
        center.className = "v32-chapter-trigger";
        center.innerHTML = `<h3>Мир ${world} · Глава ${local}</h3><small>${localChapterName(chapter)} · ${earned}/30 ★${perfect ? " · идеально" : ""}</small>`;
      }

      return template.innerHTML;
    };
    chapterMarkup.__v32Compact = true;
  }

  let pickerState = { world: 1, chapter: 1 };

  function getPicker() {
    let modal = document.querySelector("#v32CampaignPicker");
    if (modal) return modal;

    modal = document.createElement("div");
    modal.id = "v32CampaignPicker";
    modal.className = "v32-campaign-picker";
    modal.hidden = true;
    modal.innerHTML = `<div class="v32-campaign-picker-card" role="dialog" aria-modal="true" aria-label="Быстрый выбор мира, главы и уровня">
      <div class="v32-picker-head">
        <div><small>КАМПАНИЯ</small><h2>Быстрый переход</h2></div>
        <button type="button" class="v32-picker-close" aria-label="Закрыть">×</button>
      </div>
      <div class="v32-world-strip"></div>
      <div class="v32-picker-body">
        <div class="v32-picker-section-title v32-picker-chapter-title"></div>
        <div class="v32-chapter-strip"></div>
        <div class="v32-picker-section-title v32-picker-level-title"></div>
        <div class="v32-level-grid"></div>
      </div>
    </div>`;
    document.body.appendChild(modal);
    modal.querySelector(".v32-picker-close").onclick = () => { modal.hidden = true; };
    modal.onclick = (event) => { if (event.target === modal) modal.hidden = true; };
    return modal;
  }

  function renderPicker() {
    const modal = getPicker();
    const maxLevel = Math.max(1, Number(profile?.currentLevel) || 1);
    const maxChapter = Math.max(1, Number(chapterInfo?.(maxLevel)?.number) || 1);
    const maxWorld = Math.max(WORLD_NAMES.length, worldForChapter(maxChapter));
    pickerState.world = Math.max(1, Math.min(maxWorld, pickerState.world || 1));

    const firstChapter = (pickerState.world - 1) * 10 + 1;
    const lastChapter = firstChapter + 9;
    if (pickerState.chapter < firstChapter || pickerState.chapter > lastChapter) {
      pickerState.chapter = Math.min(lastChapter, Math.max(firstChapter, maxChapter >= firstChapter ? Math.min(maxChapter, lastChapter) : firstChapter));
    }

    const worldStrip = modal.querySelector(".v32-world-strip");
    worldStrip.innerHTML = Array.from({ length: maxWorld }, (_, index) => {
      const world = index + 1;
      const unlocked = (world - 1) * 10 + 1 <= maxChapter;
      return `<button type="button" class="v32-world-button ${world === pickerState.world ? "active" : ""} ${unlocked ? "" : "locked"}" data-v32-world="${world}">
        <b>Мир ${world}</b><span>${worldName(world)}</span>
      </button>`;
    }).join("");
    worldStrip.querySelectorAll("[data-v32-world]").forEach((button) => {
      button.onclick = () => {
        pickerState.world = Number(button.dataset.v32World) || 1;
        const first = (pickerState.world - 1) * 10 + 1;
        pickerState.chapter = Math.min(first + 9, Math.max(first, maxChapter >= first ? Math.min(maxChapter, first + 9) : first));
        renderPicker();
      };
    });

    const chapterTitle = modal.querySelector(".v32-picker-chapter-title");
    chapterTitle.innerHTML = `<b>Мир ${pickerState.world} · ${worldName(pickerState.world)}</b><small>выбери главу</small>`;

    const chapterStrip = modal.querySelector(".v32-chapter-strip");
    chapterStrip.innerHTML = Array.from({ length: 10 }, (_, index) => {
      const chapter = firstChapter + index;
      const unlocked = chapter <= maxChapter;
      return `<button type="button" class="v32-chapter-button ${chapter === pickerState.chapter ? "active" : ""}" data-v32-chapter="${chapter}" ${unlocked ? "" : "disabled"}>${index + 1}</button>`;
    }).join("");
    chapterStrip.querySelectorAll("[data-v32-chapter]:not(:disabled)").forEach((button) => {
      button.onclick = () => {
        pickerState.chapter = Number(button.dataset.v32Chapter) || firstChapter;
        renderPicker();
      };
    });

    const selectedChapter = pickerState.chapter;
    const selectedLocal = chapterInWorld(selectedChapter);
    const startLevel = chapterFirstLevel(selectedChapter);
    const endLevel = startLevel + chapterSize() - 1;
    const earned = chapterEarnedStars(selectedChapter);
    const levelTitle = modal.querySelector(".v32-picker-level-title");
    levelTitle.innerHTML = `<b>Глава ${selectedLocal} · ${localChapterName(selectedChapter)}</b><small>${earned}/30 ★ · выбери уровень</small>`;

    const levelGrid = modal.querySelector(".v32-level-grid");
    const count = chapterSize();
    levelGrid.innerHTML = Array.from({ length: count }, (_, index) => {
      const level = startLevel + index;
      const unlocked = level <= maxLevel;
      const stars = Math.max(0, Math.min(3, Number(profile?.starsByLevel?.[level]) || 0));
      const special = typeof specialForLevel === "function" ? specialForLevel(level) : null;
      const current = state?.mode === "regular" && Number(state?.level) === level;
      return `<button type="button" class="v32-level-button ${current ? "current" : ""}" data-v32-level="${level}" ${unlocked ? "" : "disabled"}>
        <b>${special?.icon ? `${special.icon}` : ""}${level}</b>
        <span>${unlocked ? (stars ? `${"★".repeat(stars)}${"☆".repeat(3 - stars)}` : "···") : "🔒"}</span>
      </button>`;
    }).join("");
    levelGrid.querySelectorAll("[data-v32-level]:not(:disabled)").forEach((button) => {
      button.onclick = () => {
        const level = Number(button.dataset.v32Level) || maxLevel;
        modal.hidden = true;
        try { closeHub?.(); } catch {}
        makeLevel?.(level, { mode: "regular" });
      };
    });

    worldStrip.querySelector(".v32-world-button.active")?.scrollIntoView?.({ inline: "center", block: "nearest" });
  }

  function openPicker() {
    const currentChapter = Math.max(
      1,
      Number(typeof hubChapterNumber !== "undefined" ? hubChapterNumber : 0)
        || Number(chapterInfo?.(profile?.currentLevel || 1)?.number)
        || 1,
    );
    pickerState.chapter = currentChapter;
    pickerState.world = worldForChapter(currentChapter);
    renderPicker();
    getPicker().hidden = false;
  }

  function bindCompactChapterTrigger() {
    if (typeof hubTab !== "undefined" && hubTab !== "progress") return;
    document.querySelectorAll(".v30-world-banner").forEach((banner) => banner.remove());

    const current = document.querySelector(".chapter-section .chapter-head > div");
    if (!current) return;

    // v31 binds its own world/chapter click handler in a microtask. Replacing
    // the node removes that obsolete listener so one tap always opens v32.
    const fresh = current.cloneNode(true);
    fresh.classList.remove("v31-chapter-picker-hit");
    delete fresh.dataset.v31PickerBound;
    fresh.classList.add("v32-chapter-trigger");
    fresh.setAttribute("role", "button");
    fresh.setAttribute("tabindex", "0");
    fresh.setAttribute("aria-label", "Выбрать мир, главу и уровень");
    fresh.addEventListener("click", openPicker);
    fresh.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openPicker();
      }
    });
    current.replaceWith(fresh);
  }

  function installRenderHook() {
    if (typeof renderHub !== "function" || renderHub.__v32Ui) return;
    const base = renderHub;
    renderHub = function v32RenderHub(...args) {
      const result = base(...args);
      queueMicrotask(bindCompactChapterTrigger);
      return result;
    };
    renderHub.__v32Ui = true;
    queueMicrotask(bindCompactChapterTrigger);
  }

  installStyles();
  installChallengeMarkup();
  installCompactChapterMarkup();
  installRenderHook();
})();
