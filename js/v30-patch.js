/* Словасьянс v30: UX/gameplay patch loaded after the core scripts. */
(() => {
  if (window.__solivocV30Installed) return;
  window.__solivocV30Installed = true;

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
  const WORLD_CHAPTER_NAMES = [
    "Порог", "Первые тропы", "Перекрёсток", "Скрытый слой", "Проверка памяти",
    "Тонкие связи", "Ложные следы", "Глубина", "Последний рубеж", "Сердце мира",
  ];
  const LEADERBOARD_V30 = [
    {id:"stars",label:"Кампания",icon:"★"}, {id:"levels",label:"Уровни",icon:"▦"},
    {id:"daily",label:"Ежедневный",icon:"☀"}, {id:"marathon",label:"Марафон",icon:"∞"},
    {id:"zen",label:"Дзен",icon:"◌"}, {id:"duel",label:"Дуэль",icon:"⚔"},
    {id:"pictures",label:"Картинки",icon:"▧"}, {id:"time",label:"На время",icon:"⏱"},
    {id:"moves",label:"На ходы",icon:"↯"}, {id:"combo",label:"На комбо",icon:"×"},
    {id:"noMistakes",label:"Без ошибок",icon:"◇"}, {id:"onePass",label:"Один проход",icon:"↻"},
    {id:"hardcore",label:"Хардкор",icon:"☠"},
  ];

  function installStyles() {
    if (document.querySelector("#v30Styles")) return;
    const style = document.createElement("style");
    style.id = "v30Styles";
    style.textContent = `
      .companion-slider{scrollbar-width:none;-ms-overflow-style:none}.companion-slider::-webkit-scrollbar{display:none;width:0;height:0}
      .v30-three-star-reminder{display:flex;gap:12px;align-items:center;justify-content:space-between;padding:14px 16px;border:1px solid color-mix(in srgb,currentColor 18%,transparent);border-radius:20px;margin:12px 0;background:color-mix(in srgb,var(--panel,#fff) 86%,transparent)}
      .v30-three-star-reminder b{display:block}.v30-three-star-reminder small{opacity:.72}.v30-three-star-reminder button,.v30-progress-switch button{border:0;border-radius:14px;padding:10px 13px;font:inherit;font-weight:800}
      .v30-progress-switch{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px}.v30-progress-switch button.active{background:var(--accent,#715cff);color:#fff}
      .v30-unfinished-panel{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}.v30-unfinished-level{border:1px solid color-mix(in srgb,currentColor 15%,transparent);border-radius:16px;padding:12px 8px;background:color-mix(in srgb,var(--panel,#fff) 90%,transparent);font:inherit}.v30-unfinished-level b,.v30-unfinished-level span{display:block}.v30-unfinished-level span{font-size:12px;opacity:.74;margin-top:4px}
      body[data-v30-progress-view="unfinished"] .chapter-section{display:none}
      body:not([data-v30-progress-view="unfinished"]) .v30-unfinished-panel{display:none}
      .v30-world-banner{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 14px;margin-bottom:10px;border-radius:16px;background:color-mix(in srgb,var(--accent,#715cff) 11%,transparent)}.v30-world-banner small{display:block;opacity:.7}.v30-world-banner b{display:block}
      .v30-reward-label{display:inline-flex;margin-top:7px;padding:5px 9px;border-radius:999px;font-size:12px;font-weight:900;background:color-mix(in srgb,#ffd45d 26%,transparent)}
      .v30-card-rarity{position:absolute;right:7px;top:7px;z-index:3;padding:3px 7px;border-radius:999px;background:rgba(20,20,38,.76);color:white;font-size:9px;line-height:1.2;font-weight:900;letter-spacing:.05em;text-transform:uppercase;pointer-events:none}.cardback-tile,.card-back-tile,[data-card-back-id]{position:relative}
      .v30-tutorial-target{position:relative;z-index:9;outline:4px solid rgba(255,213,91,.95)!important;outline-offset:4px;animation:v30TargetPulse 1.05s ease-in-out infinite}.v30-tutorial-destination{outline:3px solid rgba(108,210,255,.9)!important;outline-offset:4px}.v30-tutorial-target::after{content:"НАЖМИ СЮДА";position:absolute;z-index:20;left:50%;bottom:calc(100% + 10px);transform:translateX(-50%);white-space:nowrap;border-radius:999px;background:#17152d;color:#fff6b0;font-size:10px;font-weight:900;padding:5px 8px;pointer-events:none}@keyframes v30TargetPulse{50%{outline-offset:8px}}
      .v30-tutorial-skip{margin-top:7px;border:0;background:transparent;text-decoration:underline;font:inherit;font-size:12px;opacity:.7;padding:4px 8px}
      .v30-social-auth{margin-top:14px;display:grid;gap:9px}.v30-social-divider{display:flex;align-items:center;gap:10px;font-size:12px;opacity:.62}.v30-social-divider::before,.v30-social-divider::after{content:"";height:1px;flex:1;background:currentColor;opacity:.3}.v30-yandex-auth{border:0;border-radius:16px;padding:13px 16px;background:#fc3f1d;color:white;font:inherit;font-weight:900}
      .v30-capture-modal{position:fixed;inset:0;z-index:10050;display:grid;place-items:center;padding:24px;background:rgba(13,11,34,.68);backdrop-filter:blur(12px)}.v30-capture-modal[hidden]{display:none}.v30-capture-card{width:min(420px,100%);border-radius:28px;background:var(--panel,#fff);color:var(--text,#24213c);padding:24px;text-align:center;box-shadow:0 24px 80px rgba(0,0,0,.35)}.v30-capture-card img{width:112px;height:112px;object-fit:contain}.v30-capture-card small{display:block;font-weight:900;letter-spacing:.16em;opacity:.65}.v30-capture-card h2{margin:8px 0}.v30-capture-card p{opacity:.76}.v30-capture-card button{width:100%;border:0;border-radius:17px;padding:14px;background:linear-gradient(120deg,#735bff,#30afe3);color:white;font:inherit;font-weight:900}
      .v30-profile-duels{margin-top:14px;border-top:1px solid color-mix(in srgb,currentColor 12%,transparent);padding-top:12px}.v30-profile-duels summary{font-weight:900;cursor:pointer}.v30-profile-duels .duel-history-list{margin-top:10px;max-height:270px;overflow:auto}
      .hub-scroll.v30-swipe-active{overflow-x:hidden;touch-action:none}.v30-swipe-stage{position:relative;width:100%;min-height:100%;overflow:hidden}.v30-swipe-pane{position:absolute;left:0;top:0;width:100%;min-height:100%;will-change:transform}.v30-swipe-pane.next{pointer-events:none}
      @media (max-width:460px){.v30-unfinished-panel{grid-template-columns:repeat(2,minmax(0,1fr))}}
    `;
    document.head.appendChild(style);
  }

  function worldInfoForChapter(chapterNumber) {
    const number = Math.max(1, Number(chapterNumber) || 1);
    const worldNumber = Math.floor((number - 1) / 10) + 1;
    const chapterInWorld = ((number - 1) % 10) + 1;
    return {
      number: worldNumber,
      chapter: chapterInWorld,
      name: WORLD_NAMES[worldNumber - 1] || `Неизведанный мир ${worldNumber}`,
      chapterName: WORLD_CHAPTER_NAMES[chapterInWorld - 1],
    };
  }

  function installWorlds() {
    if (typeof chapterInfo !== "function" || chapterInfo.__v30) return;
    const baseChapterInfo = chapterInfo;
    chapterInfo = function v30ChapterInfo(level) {
      const base = baseChapterInfo(level), world = worldInfoForChapter(base.number);
      return { ...base, worldNumber:world.number, chapterInWorld:world.chapter, worldName:world.name, title:`${world.name} · ${world.chapterName}` };
    };
    chapterInfo.__v30 = true;
    if (typeof chapterMarkup === "function") {
      const baseChapterMarkup = chapterMarkup;
      chapterMarkup = function v30ChapterMarkup(number) {
        const world = worldInfoForChapter(number);
        let html = baseChapterMarkup(number);
        html = html.replace(`Глава ${number} ·`, `Мир ${world.number} · Глава ${world.chapter} ·`);
        return `<div class="v30-world-banner"><div><small>МИР ${world.number}</small><b>${escapeHtml(world.name)}</b></div><span>Глава ${world.chapter}/10</span></div>${html}`;
      };
    }
  }

  function installBossDifficulty() {
    if (typeof regularConfig === "function" && !regularConfig.__v30) {
      const base = regularConfig;
      regularConfig = function v30RegularConfig(level, rng, special) {
        const cfg = base(level, rng, special);
        if (!special?.boss) return cfg;
        return {
          ...cfg,
          cols: Math.max(4, Number(cfg.cols) || 4),
          cats: Math.max(6, Number(cfg.cats) || 6),
          difficulty: Math.min(5, Math.max(3, (Number(cfg.difficulty) || 2) + 1)),
          words: [Math.max(4, Number(cfg.words?.[0]) || 4), Math.max(6, Number(cfg.words?.[1]) || 6)],
          boss: true,
        };
      };
      regularConfig.__v30 = true;
    }
    if (typeof imperfectDealChance === "function" && !imperfectDealChance.__v30) {
      const base = imperfectDealChance;
      imperfectDealChance = function v30ImperfectDealChance(cfg = {}, mode = "regular") {
        const normal = base(cfg, mode);
        if (mode === "regular" && cfg?.boss) return Math.max(normal, Math.min(.30, .18 + Math.max(0, (Number(cfg.difficulty)||3)-3) * .04));
        return normal;
      };
      imperfectDealChance.__v30 = true;
    }
  }

  function clearMascotSpeech() {
    try { clearTimeout(showCompanionBubble?.timer); } catch {}
    document.querySelectorAll(".companion-bubble-floating,.mascot-hint-line,.mascot-hint-route").forEach((el) => el.remove());
    try { clearMascotHintLine?.(); } catch {}
  }
  function installHubSpeechCleanup() {
    if (typeof openHub !== "function" || openHub.__v30) return;
    const baseOpenHub = openHub;
    openHub = function v30OpenHub(...args) { clearMascotSpeech(); return baseOpenHub(...args); };
    openHub.__v30 = true;
  }

  function installPerfectChapterCaptureSync() {
    if (typeof closeWinModal !== "function" || closeWinModal.__v30CaptureSync) return;
    const base = closeWinModal;
    closeWinModal = function v30CloseWinModal(...args) {
      const wasRegular = state?.mode === "regular";
      const result = base(...args);
      if (wasRegular) setTimeout(() => syncBossCompanionsFromProgress?.({ notify:true }), 40);
      return result;
    };
    closeWinModal.__v30CaptureSync = true;
  }

  function unfinishedThreeStarLevels() {
    const max = Math.max(1, Number(profile?.currentLevel) || 1), out = [];
    for (let level = 1; level < max; level++) {
      const stars = Number(profile?.starsByLevel?.[level]) || 0;
      if (stars > 0 && stars < 3) out.push({ level, stars });
    }
    return out;
  }
  function unfinishedMarkup() {
    const items = unfinishedThreeStarLevels();
    return items.length
      ? `<div class="v30-unfinished-panel">${items.map(({level,stars})=>`<button class="v30-unfinished-level" data-v30-retry-level="${level}"><b>Уровень ${level}</b><span>${"★".repeat(stars)}${"☆".repeat(3-stars)}</span></button>`).join("")}</div>`
      : `<div class="v30-unfinished-panel"><div class="empty-state">Все пройденные уровни уже закрыты на ★★★</div></div>`;
  }
  function bindThreeStarUi() {
    document.querySelectorAll("[data-v30-progress-view]").forEach((button) => button.onclick = () => {
      const next = button.dataset.v30ProgressView === "unfinished" ? "unfinished" : "chapter";
      document.body.dataset.v30ProgressView = next;
      document.querySelectorAll("[data-v30-progress-view]").forEach((x)=>x.classList.toggle("active",x.dataset.v30ProgressView===next));
    });
    document.querySelectorAll("[data-v30-retry-level]").forEach((button) => button.onclick = () => {
      const level = Number(button.dataset.v30RetryLevel) || 1;
      closeHub?.(); makeLevel?.(level,{mode:"regular"});
    });
    document.querySelectorAll("[data-v30-open-unfinished]").forEach((button) => button.onclick = () => {
      document.body.dataset.v30ProgressView = "unfinished";
      hubTab = "progress"; renderHub?.();
    });
  }
  function installThreeStarUi() {
    if (typeof progressTabMarkup === "function" && !progressTabMarkup.__v30) {
      const base = progressTabMarkup;
      progressTabMarkup = function v30ProgressTabMarkup() {
        const active = document.body.dataset.v30ProgressView === "unfinished" ? "unfinished" : "chapter";
        return `<section class="hub-section"><div class="v30-progress-switch"><button class="${active==="chapter"?"active":""}" data-v30-progress-view="chapter">Текущая глава</button><button class="${active==="unfinished"?"active":""}" data-v30-progress-view="unfinished">До ★★★ (${unfinishedThreeStarLevels().length})</button></div>${unfinishedMarkup()}</section>${base()}`;
      };
      progressTabMarkup.__v30 = true;
    }
    if (typeof homeTabMarkup === "function" && !homeTabMarkup.__v30) {
      const base = homeTabMarkup;
      homeTabMarkup = function v30HomeTabMarkup() {
        const items = unfinishedThreeStarLevels();
        const reminder = items.length ? `<section class="v30-three-star-reminder"><div><b>Есть уровни без ★★★</b><small>${ruCount(items.length,"уровень можно улучшить","уровня можно улучшить","уровней можно улучшить")}</small></div><button data-v30-open-unfinished>Показать</button></section>` : "";
        return reminder + base();
      };
      homeTabMarkup.__v30 = true;
    }
    const today = typeof todayKey === "function" ? todayKey() : new Date().toISOString().slice(0,10);
    const reminderKey = `solivoc-v30-three-star-reminder:${today}`;
    if (unfinishedThreeStarLevels().length && !localStorage.getItem(reminderKey)) {
      localStorage.setItem(reminderKey,"1");
      setTimeout(()=>showToast?.(`${unfinishedThreeStarLevels().length} уровней ещё можно улучшить до ★★★`),1800);
    }
  }

  function installRewardVisibility() {
    if (typeof weeklyMarkup === "function" && !weeklyMarkup.__v30) {
      const base = weeklyMarkup;
      weeklyMarkup = function v30WeeklyMarkup() {
        const w = weeklyProgress?.(), reward = Number(w?.def?.rewardXp) || 0;
        return base().replace(/<\/section>\s*$/, `<span class="v30-reward-label">Награда: +${reward} XP</span></section>`);
      };
      weeklyMarkup.__v30 = true;
    }
    if (typeof monthlyMarkup === "function" && !monthlyMarkup.__v30) {
      const base = monthlyMarkup;
      monthlyMarkup = function v30MonthlyMarkup() {
        const m = monthlyProgress?.(), reward = Number(m?.def?.rewardXp) || 0;
        return base().replace(/<\/section>\s*$/, `<span class="v30-reward-label">Награда: +${reward} XP</span></section>`);
      };
      monthlyMarkup.__v30 = true;
    }
    if (typeof dailyModeQuestsMarkup === "function" && !dailyModeQuestsMarkup.__v30) {
      const base = dailyModeQuestsMarkup;
      dailyModeQuestsMarkup = function v30DailyModeQuestsMarkup() {
        const today = typeof todayKey === "function" ? todayKey() : "";
        const done = !!today && (profile?.daily?.completedDates || []).includes(today);
        const reward = done ? "Повтор: 25 XP + 10 XP за каждую ★" : "Награда: 70 XP + 10 XP за каждую ★";
        return base().replace(/<small>(Сегодня уже пройден — можно улучшить результат|Один общий расклад на сегодня)<\/small>/, `<small>$1 · ${reward}</small>`);
      };
      dailyModeQuestsMarkup.__v30 = true;
    }
    if (typeof dailyCalendarMarkup === "function" && !dailyCalendarMarkup.__v30) {
      const base = dailyCalendarMarkup;
      dailyCalendarMarkup = function v30DailyCalendarMarkup() {
        const week = currentDailyWeek?.() || {count:0};
        return base()
          .replace(/<b>3\/7<\/b>/, `<b>${Math.min(week.count,3)}/3</b>`)
          .replace(/<b>5\/7<\/b>/, `<b>${Math.min(week.count,5)}/5</b>`)
          .replace(/<b>7\/7<\/b>/, `<b>${Math.min(week.count,7)}/7</b>`);
      };
      dailyCalendarMarkup.__v30 = true;
    }
  }

  function cardBackRarity(def) {
    if (!def || def.id === "classic") return ["Обычная","common"];
    if (def.legendary || def.allAchievements || /legend|obsidian|grand|atlas/i.test(def.id)) return ["Легендарная","legendary"];
    if (def.rare || def.achievementId || Number(def.minAchievements)>=20 || Number(def.stars)>=400) return ["Эпическая","epic"];
    if (Number(def.minAchievements)>=10 || Number(def.stars)>=160 || Number(def.chapter)>=8) return ["Редкая","rare"];
    if (Number(def.minAchievements)>=3 || Number(def.stars)>=40 || Number(def.chapter)>=3) return ["Необычная","uncommon"];
    return ["Обычная","common"];
  }
  function enhanceCardBackRarities(root = document) {
    root.querySelectorAll("[data-card-back-id]").forEach((button) => {
      if (button.querySelector(".v30-card-rarity")) return;
      const def = CARD_BACK_DEFS?.find?.((x)=>x.id===button.dataset.cardBackId);
      const [label,id] = cardBackRarity(def);
      button.dataset.rarity = id;
      const badge = document.createElement("span"); badge.className="v30-card-rarity"; badge.textContent=label; button.appendChild(badge);
    });
  }

  function installCardBackRarities() {
    if (typeof cardBackMarkup !== "function" || cardBackMarkup.__v30) return;
    const rank = { common:0, uncommon:1, rare:2, epic:3, legendary:4 };
    cardBackMarkup = function v30CardBackMarkup() {
      return [...CARD_BACK_DEFS].sort((a,b)=>rank[cardBackRarity(a)[1]]-rank[cardBackRarity(b)[1]]).map((back) => {
        const unlocked=cardBackUnlocked(back), selected=profile.cardBack===back.id, [rarityLabel,rarityId]=cardBackRarity(back);
        return `<button class="cardback-tile ${unlocked?"":"locked"} ${selected?"selected":""} ${back.rare?"rare":""}" data-card-back-id="${back.id}" data-rarity="${rarityId}"><span class="v30-card-rarity">${rarityLabel}</span><span class="cardback-preview back-${back.id}"><i>${back.rare?"✦":""}</i></span><b>${back.name}</b><span>${unlocked?(selected?"Выбрано":"Открыто"):cardBackUnlockLabel(back)}</span></button>`;
      }).join("");
    };
    cardBackMarkup.__v30 = true;
  }

  function installLeaderboard() {
    if (typeof leaderboardValues === "function" && !leaderboardValues.__v30) {
      const base = leaderboardValues;
      leaderboardValues = function v30LeaderboardValues() {
        const old = base(), modes = profile.modeStats || {}, stats = profile.stats || {};
        return {
          ...old,
          zen: Math.max(Number(stats.calmCompleted)||0, Number(modes.zen?.completed)||0),
          pictures: Math.max(Number(stats.collectionGamesCompleted)||0, Number(modes.pictures?.completed)||0),
          noMistakes: Number(modes.noMistakes?.completed)||0,
          hardcore: Math.max(Number(stats.bestHardcore)||0, Number(modes.hardcore?.completed)||0),
        };
      };
      leaderboardValues.__v30 = true;
    }
    if (typeof openLeaderboardModal === "function" && !openLeaderboardModal.__v30) {
      openLeaderboardModal = function v30OpenLeaderboardModal(board="stars") {
        const modal=$("#leaderboardModal"),tabs=$("#leaderboardTabs"); if(!modal||!tabs)return false;
        let activeBoard=LEADERBOARD_V30.some((x)=>x.id===board)?board:"stars";
        const select=(id)=>{activeBoard=LEADERBOARD_V30.some((x)=>x.id===id)?id:"stars";tabs.querySelectorAll("[data-leaderboard]").forEach((b)=>b.classList.toggle("active",b.dataset.leaderboard===activeBoard));loadLeaderboardBoard(activeBoard);};
        tabs.innerHTML=LEADERBOARD_V30.map((x)=>`<button type="button" data-leaderboard="${x.id}">${x.icon} ${x.label}</button>`).join("");
        tabs.querySelectorAll("[data-leaderboard]").forEach((btn)=>btn.onclick=()=>select(btn.dataset.leaderboard));
        $("#leaderboardClose").onclick=closeLeaderboardModal;modal.onclick=(e)=>{if(e.target===modal)closeLeaderboardModal();};
        modal.classList.add("show");modal.setAttribute("aria-hidden","false");select(activeBoard);
        syncLeaderboardNonBlocking?.(false).then((changed)=>{if(!changed)return;leaderboardCache.at=0;fetchLeaderboardSnapshot(true).then((boards)=>{if(modal.classList.contains("show"))renderLeaderboardEntries(activeBoard,boards?.[activeBoard]||[]);}).catch(()=>{});});
        return true;
      };
      openLeaderboardModal.__v30 = true;
    }
  }

  async function refreshDuelHistory() {
    if (navigator.onLine === false) return false;
    await Promise.allSettled([
      Promise.resolve(refreshOwnedChallenges?.({notify:false})),
      Promise.resolve(refreshReceivedChallenges?.()),
      Promise.resolve(refreshDeletedDuelOpponents?.(true)),
    ]);
    syncDuelStats?.(); saveProfile?.();
    return true;
  }
  function enhanceProfileDuelHistory() {
    const card = document.querySelector("#profileEditorContent .profile-card-view");
    if (!card || card.querySelector(".v30-profile-duels")) return;
    const details = document.createElement("details");
    details.className="v30-profile-duels";
    details.innerHTML=`<summary>История дуэлей</summary>${typeof duelHistoryContentMarkup==="function"?duelHistoryContentMarkup():""}`;
    card.insertBefore(details, card.querySelector(".profile-card-actions"));
    details.querySelectorAll("[data-duel-profile]").forEach((button)=>button.onclick=()=>showDuelProfileHistory?.(button.dataset.duelProfile));
  }
  function installDuelRefresh() {
    if (typeof openProfileEditorModal === "function" && !openProfileEditorModal.__v30) {
      const base = openProfileEditorModal;
      let refreshToken = 0;
      openProfileEditorModal = function v30OpenProfileEditorModal(edit=false) {
        const result = base(edit); if(edit)return result;
        enhanceProfileDuelHistory();
        const token=++refreshToken;
        refreshDuelHistory().then(()=>{
          if(token!==refreshToken||!document.querySelector("#profileEditorModal.show"))return;
          base(false); enhanceProfileDuelHistory();
        }).catch(()=>{});
        return result;
      };
      openProfileEditorModal.__v30 = true;
    }
  }

  function installXpTotalFix() {
    if (typeof showWin !== "function" || showWin.__v30) return;
    const base = showWin;
    showWin = function v30ShowWin(...args) {
      const result = base(...args);
      const total = Math.max(0, Number(state?.run?.xpEarned)||0);
      const baseXp = Math.max(0, Math.min(total, Number(state?.run?.xpBaseEarned)||total));
      const seq = $("#winXpSeq"), counter = $("[data-win-xp-counter]");
      if (seq && counter && total > 0) {
        const syncFinal = () => {
          if (!document.querySelector("#winModal.show") && !modal?.classList?.contains("show")) return;
          const text=seq.textContent||"";
          if (/Всего бонусом/i.test(text)) {
            counter.textContent=`+${total} XP`;
            const bonus=Math.max(0,total-baseXp);
            seq.textContent=bonus?`Всего бонусом: +${bonus} XP · итого +${total} XP`:`Итого +${total} XP`;
            observer.disconnect();
          }
        };
        const observer = new MutationObserver(syncFinal); observer.observe(seq,{childList:true,subtree:true,characterData:true});
        setTimeout(()=>{counter.textContent=`+${total} XP`;const bonus=Math.max(0,total-baseXp);if(bonus)seq.textContent=`Всего бонусом: +${bonus} XP · итого +${total} XP`;observer.disconnect();},4200);
      }
      return result;
    };
    showWin.__v30=true;
  }

  function installTutorial() {
    let engine=null;
    import("./tutorial-engine.mjs").then((module)=>{engine=module; enhanceTutorial();}).catch(()=>{});
    function clearTargets(){document.querySelectorAll(".v30-tutorial-target,.v30-tutorial-destination").forEach((el)=>el.classList.remove("v30-tutorial-target","v30-tutorial-destination"));}
    function payloadElement(p) {
      if (!p) return null;
      if (p.source === "column") return document.querySelector(`.card[data-source="column"][data-col="${p.ci}"][data-group-index="${p.start}"]`) || document.querySelector(`.card[data-source="column"][data-col="${p.ci}"]`);
      if (p.source === "waste") return document.querySelector(".waste .card.movable:last-of-type") || document.querySelector(".waste .card.movable");
      return null;
    }
    function usefulMoveTarget() {
      const move = findUsefulBoardMove?.();
      if(!move?.payload)return null;
      return {source:payloadElement(move.payload),target:document.querySelector(`[data-zone="${move.zone}"][data-index="${move.index}"]`)};
    }
    function categoryTarget() {
      for (const card of document.querySelectorAll(".card.movable")) {
        const p=getDragPayload?.(card); if(!p)continue;
        if(categoryCard?.(payloadGroup?.(p))) {
          const index=state.slots?.findIndex((g)=>!g);
          return {source:card,target:index>=0?document.querySelector(`[data-zone="slot"][data-index="${index}"]`):null};
        }
      }
      return usefulMoveTarget();
    }
    function matchingWordForOpenSlot() {
      const slotIndex=state.slots?.findIndex((g)=>g&&categoryCard?.(g));
      if(slotIndex<0)return usefulMoveTarget();
      for(const card of document.querySelectorAll(".card.movable")){
        const p=getDragPayload?.(card); if(p&&canDropTo?.(p,"slot",slotIndex))return{source:card,target:document.querySelector(`[data-zone="slot"][data-index="${slotIndex}"]`)};
      }
      return usefulMoveTarget();
    }
    function enhanceTutorial() {
      clearTargets();
      if (state?.mode!=="tutorial") return;
      const coachEl=document.querySelector("#coach"); if(!coachEl)return;
      let skip=coachEl.querySelector(".v30-tutorial-skip");
      if(!skip){skip=document.createElement("button");skip.type="button";skip.className="v30-tutorial-skip";skip.textContent="Пропустить обучение";coachEl.appendChild(skip);skip.onclick=()=>{profile.tutorialComplete=true;profile.onboardingComplete=true;saveProfile?.();try{localStorage.removeItem(SAVE_KEY)}catch{};try{localStorage.removeItem(SAVE_BACKUP_KEY)}catch{};makeLevel?.(profile.currentLevel||1,{mode:"regular"});showToast?.("Обучение пропущено");};}
      const descriptor=engine?.tutorialDescriptor?.(state.tutorialStep,state.tutorialActions||{});
      if(descriptor && $("#coachText")) $("#coachText").textContent=descriptor.prompt;
      const phase=descriptor?.phase || (state.tutorialStep===1?(state.tutorialActions?.category?"collect":"category"):state.tutorialStep===2?"manual":state.tutorialStep===3?"auto":!state.tutorialActions?.stock?"stock":!state.tutorialActions?.undo?"undo":!state.tutorialActions?.hint?"hint":"finish");
      let pair=null;
      if(phase==="category")pair=categoryTarget();
      else if(phase==="collect")pair=matchingWordForOpenSlot();
      else if(phase==="stock")pair={source:$("#stock")};
      else if(phase==="undo")pair={source:$("#undo")};
      else if(phase==="hint")pair={source:$("#hint")};
      else pair=usefulMoveTarget();
      if(pair?.source){pair.source.classList.add("v30-tutorial-target");pair.source.scrollIntoView?.({block:"center",behavior:"smooth"});}
      if(pair?.target)pair.target.classList.add("v30-tutorial-destination");
    }
    if (typeof updateCoach === "function" && !updateCoach.__v30) {
      const base=updateCoach; updateCoach=function v30UpdateCoach(...args){const result=base(...args);queueMicrotask(enhanceTutorial);return result;};updateCoach.__v30=true;
    }
    if (typeof noteTutorialAction === "function" && !noteTutorialAction.__v30) {
      const base=noteTutorialAction; noteTutorialAction=function v30NoteTutorialAction(...args){const result=base(...args);setTimeout(enhanceTutorial,0);return result;};noteTutorialAction.__v30=true;
    }
    enhanceTutorial();
  }

  function installSocialAuth() {
    if (typeof renderAccountModal !== "function" || renderAccountModal.__v30) return;
    const base=renderAccountModal;
    renderAccountModal=function v30RenderAccountModal(...args){
      const result=base(...args);const modal=document.querySelector("#accountModal"),mode=modal?.dataset.mode||"";
      if(!accountSignedIn?.() && ["register","login"].includes(mode)){
        const form=document.querySelector("#accountForm");
        if(form&&!document.querySelector("#v30YandexAuth")){
          const box=document.createElement("div");box.className="v30-social-auth";box.innerHTML=`<div class="v30-social-divider">или</div><button type="button" class="v30-yandex-auth" id="v30YandexAuth">Продолжить через Яндекс</button>`;form.after(box);
          box.querySelector("button").onclick=()=>{
            const returnTo=`${location.origin}${location.pathname}${location.search}`;
            location.href=apiUrl(`/api/oauth-yandex?action=start&returnTo=${encodeURIComponent(returnTo)}`);
          };
        }
      }
      return result;
    };
    renderAccountModal.__v30=true;
    try {
      const url=new URL(location.href), provider=url.searchParams.get("oauth"), result=url.searchParams.get("oauth_result");
      if(provider==="yandex"&&result){
        setTimeout(()=>showToast?.(result==="ok"?"Яндекс подключён — прогресс синхронизируется":"Не удалось войти через Яндекс"),900);
        url.searchParams.delete("oauth");url.searchParams.delete("oauth_result");url.searchParams.delete("oauth_error");
        history.replaceState(history.state,"",url.pathname+(url.search?url.search:"")+url.hash);
      }
    } catch {}
  }

  function captureModal() {
    let modal=document.querySelector("#v30CaptureModal");
    if(modal)return modal;
    modal=document.createElement("div");modal.id="v30CaptureModal";modal.className="v30-capture-modal";modal.hidden=true;
    modal.innerHTML=`<div class="v30-capture-card" role="dialog" aria-modal="true"><img alt=""><small>НОВЫЙ МАСКОТ</small><h2></h2><p></p><button type="button">Познакомиться</button></div>`;
    document.body.appendChild(modal);return modal;
  }
  function showCaptureModal(id) {
    const def=companionDef?.(id);if(!def)return;
    const modal=captureModal(),img=modal.querySelector("img"),title=modal.querySelector("h2"),text=modal.querySelector("p"),button=modal.querySelector("button");
    img.src=companionAsset?.(def)||"";img.alt=def.name||"Маскот";title.textContent=`${def.name} присоединяется к тебе`;
    text.textContent=`Глава пройдена на ★★★ целиком, включая бой с боссом. ${def.rewardText||def.personality||"Маскот теперь доступен как напарник."}`;
    modal.hidden=false;button.onclick=()=>{modal.hidden=true;openCompanionInfoModal?.(def.id);};modal.onclick=(e)=>{if(e.target===modal)modal.hidden=true;};
  }
  function installCaptureModal() {
    window.addEventListener("solivoc:mascot-captured",(e)=>showCaptureModal(e.detail?.id));
    const queued=[...(window.__v30CapturedMascots||[])];window.__v30CapturedMascots=[];queued.forEach((id,i)=>setTimeout(()=>showCaptureModal(id),500+i*450));
  }

  function hubMarkupForTab(tab) {
    const map={home:homeTabMarkup,progress:progressTabMarkup,collection:collectionTabMarkup,modes:modesTabMarkup,appearance:appearanceTabMarkup};
    try{return typeof map[tab]==="function"?map[tab]():"";}catch{return"";}
  }
  function installHubSwipe() {
    const host=document.querySelector("#hubContent");if(!host||host.dataset.v30SwipeBound)return;host.dataset.v30SwipeBound="1";
    const order=["home","progress","collection","modes","appearance"];
    let gesture=null;
    const ignore=(target)=>!!target.closest("button,input,select,textarea,a,.companion-slider,.chapter-path,.cardback-grid,.theme-grid,.app-icon-grid,[contenteditable='true']");
    host.addEventListener("pointerdown",(e)=>{
      if(e.pointerType==="mouse"||ignore(e.target)||!document.querySelector("#hub.show"))return;
      const index=order.indexOf(hubTab);if(index<0)return;gesture={id:e.pointerId,startX:e.clientX,startY:e.clientY,dx:0,index,active:false,dir:0,stage:null,current:null,next:null,width:host.clientWidth,scrollTop:host.scrollTop};
    });
    host.addEventListener("pointermove",(e)=>{
      const g=gesture;if(!g||g.id!==e.pointerId)return;const dx=e.clientX-g.startX,dy=e.clientY-g.startY;g.dx=dx;
      if(!g.active){if(Math.abs(dx)<14||Math.abs(dx)<Math.abs(dy)*1.2)return;const dir=dx<0?1:-1,nextIndex=g.index+dir;if(nextIndex<0||nextIndex>=order.length){gesture=null;return;}g.active=true;g.dir=dir;e.preventDefault();
        const stage=document.createElement("div"),current=document.createElement("div"),next=document.createElement("div");stage.className="v30-swipe-stage";current.className="v30-swipe-pane current";next.className="v30-swipe-pane next";while(host.firstChild)current.appendChild(host.firstChild);next.innerHTML=hubMarkupForTab(order[nextIndex]);stage.append(current,next);host.append(stage);stage.style.height=`${Math.max(current.scrollHeight,host.clientHeight)}px`;next.style.transform=`translateX(${dir*100}%)`;host.classList.add("v30-swipe-active");host.scrollTop=g.scrollTop;Object.assign(g,{stage,current,next,nextIndex});
      }
      if(!g.active)return;e.preventDefault();const width=Math.max(1,g.width),clamped=Math.max(-width,Math.min(width,dx));g.current.style.transform=`translateX(${clamped}px)`;g.next.style.transform=`translateX(${g.dir*width+clamped}px)`;
    },{passive:false});
    const finish=(commit)=>{const g=gesture;gesture=null;if(!g?.active)return;const width=Math.max(1,g.width),target=commit?-g.dir*width:0,nextTarget=commit?0:g.dir*width;g.current.style.transition=g.next.style.transition="transform .22s cubic-bezier(.2,.8,.2,1)";requestAnimationFrame(()=>{g.current.style.transform=`translateX(${target}px)`;g.next.style.transform=`translateX(${nextTarget}px)`;});setTimeout(()=>{host.classList.remove("v30-swipe-active");if(commit){hubTab=order[g.nextIndex];renderHub?.();}else{host.replaceChildren(...g.current.childNodes);host.scrollTop=g.scrollTop;enhanceHub();}},230);};
    host.addEventListener("pointerup",(e)=>{const g=gesture;if(!g||g.id!==e.pointerId)return;finish(g.active&&Math.abs(g.dx)>Math.max(64,g.width*.18));});host.addEventListener("pointercancel",()=>finish(false));
  }

  function enhanceHub() {
    bindThreeStarUi(); enhanceCardBackRarities(document.querySelector("#hubContent")||document); installHubSwipe();
  }
  function installRenderEnhancer() {
    if(typeof renderHub!=="function"||renderHub.__v30)return;const base=renderHub;
    renderHub=function v30RenderHub(...args){const result=base(...args);enhanceHub();if(hubTab==="modes"&&hubDuelTab==="history")refreshDuelHistory().then(()=>{}).catch(()=>{});return result;};renderHub.__v30=true;
  }

  installStyles();
  installWorlds();
  installBossDifficulty();
  installHubSpeechCleanup();
  installPerfectChapterCaptureSync();
  installThreeStarUi();
  installRewardVisibility();
  installCardBackRarities();
  installLeaderboard();
  installDuelRefresh();
  installXpTotalFix();
  installTutorial();
  installSocialAuth();
  installCaptureModal();
  installRenderEnhancer();
  enhanceHub();
  if(document.querySelector("#hub.show")) renderHub?.();
})();
