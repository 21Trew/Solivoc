/* Словасьянс v34: mascot rules, challenge rotation, stability and navigation fixes. */
(() => {
  const root = typeof window !== "undefined" ? window : globalThis;
  if (root.__solivocV34Installed) return;
  root.__solivocV34Installed = true;

  const WORLD_NAMES = Object.freeze([
    "Архипелаг первых связей", "Сад смыслов", "Город созвучий", "Архив ассоциаций", "Океан понятий",
    "Лабиринт эрудиции", "Обсерватория идей", "Мастерская контекстов", "Хроники языка", "За гранью очевидного",
  ]);
  const WORLD_CHAPTER_NAMES = Object.freeze([
    "Порог", "Первые тропы", "Перекрёсток", "Скрытый слой", "Проверка памяти",
    "Тонкие связи", "Ложные следы", "Глубина", "Последний рубеж", "Сердце мира",
  ]);
  const WEEKLY_EXTRA = Object.freeze([
    { id:"levels-focus", icon:"▶", title:"Пятьдесят шагов", desc:"Пройти 50 любых уровней", metric:"levels", goal:50, rewardXp:1100 },
    { id:"stars-focus", icon:"★", title:"Созвездие недели", desc:"Заработать 140 звёзд в любых режимах", metric:"stars", goal:140, rewardXp:1150 },
    { id:"noHints-focus", icon:"?", title:"Неделя наблюдателя", desc:"Пройти 40 любых уровней без подсказок", metric:"noHints", goal:40, rewardXp:1200 },
    { id:"perfect-focus", icon:"★★★", title:"Точная неделя", desc:"Закрыть 28 любых уровней на 3 звезды", metric:"perfect", goal:28, rewardXp:1250 },
    { id:"categories-focus", icon:"▦", title:"Неделя связей", desc:"Собрать 240 категорий в любых режимах", metric:"categories", goal:240, rewardXp:1150 },
  ]);
  const MONTHLY_EXTRA = Object.freeze([
    { id:"levels-focus", icon:"▶", title:"Длинный маршрут", desc:"Пройти 185 любых уровней", metric:"levels", goal:185, rewardXp:3900 },
    { id:"stars-focus", icon:"★", title:"Звёздный маршрут", desc:"Заработать 480 звёзд в любых режимах", metric:"stars", goal:480, rewardXp:4050 },
    { id:"noHints-focus", icon:"?", title:"Месяц наблюдателя", desc:"Пройти 145 любых уровней без подсказок", metric:"noHints", goal:145, rewardXp:4200 },
    { id:"perfect-focus", icon:"★★★", title:"Месяц точности", desc:"Закрыть 105 любых уровней на 3 звезды", metric:"perfect", goal:105, rewardXp:4350 },
    { id:"categories-focus", icon:"▦", title:"Большой атлас", desc:"Собрать 850 категорий в любых режимах", metric:"categories", goal:850, rewardXp:4050 },
  ]);

  function localHashSeed(value) {
    let h = 2166136261;
    for (const ch of String(value || "")) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function chooseRotatingDefinition(defs, recentIds, seed) {
    const list = Array.isArray(defs) ? defs.filter((x) => x?.id) : [];
    if (!list.length) return null;
    const blocked = new Set((Array.isArray(recentIds) ? recentIds : []).slice(-5).map(String));
    let eligible = list.filter((def) => !blocked.has(String(def.id)));
    if (!eligible.length) {
      const last = String((Array.isArray(recentIds) ? recentIds.at(-1) : "") || "");
      eligible = list.filter((def) => String(def.id) !== last);
    }
    if (!eligible.length) eligible = list;
    const hash = typeof hashSeed === "function" ? hashSeed(seed) : localHashSeed(seed);
    return eligible[hash % eligible.length];
  }
  function isActiveRoundSnapshot(s) {
    return !!(s?.run && !s.rewarded && !s.failed && Number(s.totalCategories) > 0);
  }
  function worldForChapter(chapter) { return Math.floor((Math.max(1, Number(chapter) || 1) - 1) / 10) + 1; }
  function chapterInWorld(chapter) { return ((Math.max(1, Number(chapter) || 1) - 1) % 10) + 1; }
  function worldName(world) { return WORLD_NAMES[world - 1] || `Мир ${world}`; }
  function localChapterName(chapter) { return WORLD_CHAPTER_NAMES[chapterInWorld(chapter) - 1] || `Глава ${chapterInWorld(chapter)}`; }

  root.__solivocV34Test = Object.freeze({
    chooseRotatingDefinition, isActiveRoundSnapshot, worldForChapter, chapterInWorld,
    weeklyExtra: WEEKLY_EXTRA, monthlyExtra: MONTHLY_EXTRA,
  });
  if (typeof document === "undefined") return;

  function installStyles() {
    if (document.querySelector('link[data-v34-styles]')) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "./styles/v34-product.css";
    link.dataset.v34Styles = "1";
    document.head?.appendChild(link);
  }
  installStyles();

  const esc = (value) => typeof escapeHtml === "function" ? escapeHtml(value) : String(value ?? "").replace(/[&<>"']/g, (ch) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
  const profileReady = () => typeof profile !== "undefined" && profile && typeof profile === "object";
  const activeRound = () => typeof state !== "undefined" && isActiveRoundSnapshot(state);

  function mergeMascotDailySnapshots(localValue, cloudValue) {
    const obj = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {};
    const local = obj(localValue), cloud = obj(cloudValue);
    const ld = String(local.date || ""), cd = String(cloud.date || "");
    if (ld && cd && ld !== cd) return JSON.parse(JSON.stringify(ld > cd ? local : cloud));
    if (!ld) return JSON.parse(JSON.stringify(cloud));
    if (!cd) return JSON.parse(JSON.stringify(local));
    const quests = {};
    for (const id of new Set([...Object.keys(obj(local.quests)), ...Object.keys(obj(cloud.quests))])) {
      const a = obj(local.quests?.[id]), b = obj(cloud.quests?.[id]);
      quests[id] = { ...a, ...b, progress:Math.max(0,Number(a.progress)||0,Number(b.progress)||0), completed:!!a.completed||!!b.completed, rewarded:!!a.rewarded||!!b.rewarded };
    }
    const affinityBank = {};
    for (const id of new Set([...Object.keys(obj(local.affinityBank)), ...Object.keys(obj(cloud.affinityBank))])) affinityBank[id] = Math.max(0,Number(local.affinityBank?.[id])||0,Number(cloud.affinityBank?.[id])||0);
    return { date:ld || cd, quests, affinityBank };
  }
  if (typeof mergeAccountProfiles === "function") {
    const baseMergeAccountProfiles = mergeAccountProfiles;
    mergeAccountProfiles = function v34MergeAccountProfiles(localProfile, cloudProfile) {
      const merged = baseMergeAccountProfiles(localProfile, cloudProfile);
      merged.mascotDaily = mergeMascotDailySnapshots(localProfile?.mascotDaily, cloudProfile?.mascotDaily);
      return merged;
    };
  }

  function selectedTamedMascot() {
    if (!profileReady()) return null;
    const id = String(profile.settings?.companion || "");
    if (!id || typeof entityDef !== "function") return null;
    const def = entityDef(id);
    if (!def || def.type === "god" || def.companion === false) return null;
    if (typeof companionUnlocked === "function" && !companionUnlocked(def, profile)) return null;
    return def;
  }
  function roundMascotId() {
    if (!activeRound()) return String(profileReady() ? profile.settings?.companion || "" : "");
    if (!Object.prototype.hasOwnProperty.call(state, "mascotLockId")) state.mascotLockId = String(profile.settings?.companion || "");
    return String(state.mascotLockId || "");
  }
  function roundHasTamedMascot() {
    const id = roundMascotId();
    if (!id || typeof entityDef !== "function") return false;
    const def = entityDef(id);
    return !!def && typeof companionUnlocked === "function" && companionUnlocked(def, profile);
  }

  /* Keep the chosen companion fixed from the first board render until the round ends. */
  function syncMascotSwitchLock() {
    const choose = document.querySelector("#companionInfoChoose");
    if (!choose || !activeRound()) return;
    choose.disabled = true;
    choose.textContent = "Сменить после расклада";
    choose.title = "Во время активного расклада напарника менять нельзя";
  }
  if (typeof openCompanionInfoModal === "function") {
    const baseOpenCompanionInfoModal = openCompanionInfoModal;
    openCompanionInfoModal = function v34CompanionInfoModal(id, ...rest) {
      const modal = document.querySelector("#companionInfoModal");
      if (modal) modal.dataset.companionId = String(id || "");
      const result = baseOpenCompanionInfoModal(id, ...rest);
      syncMascotSwitchLock();
      return result;
    };
  }
  document.addEventListener("click", (event) => {
    if (!event.target?.closest?.("#companionInfoChoose") || !activeRound()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (typeof showToast === "function") showToast("Напарника можно сменить после расклада");
  }, true);

  /* Undo and Hint are companion-provided actions. Without a tamed companion only Menu/Restart remain. */
  function syncCompanionActionControls() {
    const allowed = roundHasTamedMascot();
    const controls = document.querySelector(".controls");
    controls?.classList.toggle("mascot-actions-locked", !allowed);
    for (const selector of ["#undo", "#hint"]) {
      const button = document.querySelector(selector);
      if (!button) continue;
      button.hidden = !allowed;
      button.setAttribute("aria-hidden", String(!allowed));
      if (!allowed) button.setAttribute("tabindex", "-1"); else button.removeAttribute("tabindex");
    }
    if (!allowed && typeof state !== "undefined" && state?.mode === "tutorial" && state.tutorialStep === 4) {
      const text = document.querySelector("#coachText");
      if (text) {
        const usedStock = !!state.tutorialActions?.stock;
        text.textContent = usedStock
          ? "Без приручённого маскота сейчас доступны только основные действия. Собери категорию — после появления напарника он откроет «Отмену» и «Подсказку»."
          : "Нажми на колоду. «Отмена» и «Подсказка» появятся позже — их даёт приручённый маскот-напарник.";
      }
    }
  }

  if (typeof render === "function") {
    const baseRender = render;
    render = function v34SafeRender(...args) {
      roundMascotId();
      const result = baseRender.apply(this, args);
      syncCompanionActionControls();
      syncMascotSwitchLock();
      if (typeof stabilityConstrainedMode === "function" && stabilityConstrainedMode()) {
        const celebrationNode = document.querySelector("#celebration");
        if (celebrationNode?.children?.length > 80) celebrationNode.replaceChildren();
      }
      return result;
    };
  }

  /* Full mascot portrait on the world where the character was captured. */
  function mascotWorldInfo(def) {
    if (!def) return { world:0, name:"Дом маскотов", note:"" };
    if (def.unlockChapter) {
      const world = worldForChapter(def.unlockChapter);
      return { world, name:worldName(world), note:`Захвачен в финале главы ${def.unlockChapter}` };
    }
    if (def.milestoneLevel) {
      const chapter = Math.max(1, Math.ceil(Number(def.milestoneLevel) / 10));
      const world = worldForChapter(chapter);
      return { world, name:worldName(world), note:`Встречен на уровне ${def.milestoneLevel}` };
    }
    if (def.starter) return { world:1, name:worldName(1), note:"Первый напарник Словасьянса" };
    if (def.id === "birthday") return { world:0, name:"Праздничный мир", note:"Особый маскот дня рождения" };
    return { world:0, name:"Дом маскотов", note:def.rewardText || "" };
  }
  function ensureMascotPortraitModal() {
    let modal = document.querySelector("#v34MascotPortrait");
    if (modal) return modal;
    modal = document.createElement("div");
    modal.id = "v34MascotPortrait";
    modal.className = "v34-mascot-portrait";
    modal.hidden = true;
    modal.innerHTML = `<div class="v34-mascot-scene" role="dialog" aria-modal="true" aria-label="Полный образ маскота"><button type="button" class="v34-mascot-close" aria-label="Закрыть">×</button><div class="v34-world-caption"><small></small><b></b><span></span></div><img alt=""></div>`;
    document.body.appendChild(modal);
    const close = () => { modal.hidden = true; };
    modal.querySelector(".v34-mascot-close").onclick = close;
    modal.onclick = (event) => { if (event.target === modal) close(); };
    return modal;
  }
  function openMascotPortrait(id, srcOverride = "") {
    const def = typeof entityDef === "function" ? entityDef(id) : null;
    if (!def) return false;
    const modal = ensureMascotPortraitModal(), scene = modal.querySelector(".v34-mascot-scene"), image = modal.querySelector("img");
    const info = mascotWorldInfo(def);
    scene.className = `v34-mascot-scene v34-world-${Math.max(0, info.world)}`;
    image.src = srcOverride || (typeof companionAsset === "function" ? companionAsset(def) : def.image || "");
    image.alt = def.name || "Маскот";
    modal.querySelector(".v34-world-caption small").textContent = info.world ? `МИР ${info.world}` : "ОСОБОЕ МЕСТО";
    modal.querySelector(".v34-world-caption b").textContent = info.name;
    modal.querySelector(".v34-world-caption span").textContent = `${def.name}${info.note ? ` · ${info.note}` : ""}`;
    modal.hidden = false;
    return true;
  }
  document.addEventListener("click", (event) => {
    const image = event.target?.closest?.(".companion-info-hero img,.fox-page-hero>img");
    if (!image) return;
    const tile = image.closest("[data-companion-open]");
    const modal = image.closest("#companionInfoModal");
    const id = tile?.dataset?.companionOpen || modal?.dataset?.companionId || (image.closest(".fox-page,.fox-journey-shelf,.fox-evolution-form") ? "fox" : "");
    if (!id) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openMascotPortrait(id, image.getAttribute("src") || image.src || "");
  }, true);

  /* Daily assignment from the currently selected mascot. Reward is affinity only. */
  const MASCOT_DAILY_DEFS = Object.freeze({
    owl:{ title:"Наблюдение без подсказок", desc:"Получи ★★★ без подсказок", target:1, reward:100, metric:"perfectNoHint" },
    cat:{ title:"Кошачья серия", desc:"Заверши 2 расклада с ручным комбо ×4+", target:2, reward:100, metric:"combo4" },
    fox:{ title:"Чистый след", desc:"Получи ★★★ без подсказок и отмен в 2 раскладах", target:2, reward:140, metric:"foxClean" },
    bear:{ title:"Крепкая поступь", desc:"Выиграй 3 расклада без обычной отмены", target:3, reward:110, metric:"noUndo" },
    raven:{ title:"Всё заметить", desc:"Выиграй 3 расклада без подсказок", target:3, reward:110, metric:"noHint" },
    wolf:{ title:"По следу кампании", desc:"Пройди 3 уровня кампании", target:3, reward:110, metric:"campaign" },
    tiger:{ title:"Тигриная точность", desc:"Получи ★★★ в 2 раскладах", target:2, reward:115, metric:"perfect" },
    panda:{ title:"Без суеты", desc:"Выиграй 2 расклада без подсказок и отмен", target:2, reward:110, metric:"clean" },
    frog:{ title:"Прыжковая серия", desc:"Заверши 3 расклада с комбо ×5+", target:3, reward:110, metric:"combo5" },
    octopus:{ title:"Восемь дел сразу", desc:"Собери 18 категорий", target:18, reward:120, metric:"categories" },
    birthday:{ title:"Праздничный расклад", desc:"Выиграй один расклад вместе", target:1, reward:100, metric:"win" },
  });
  function mascotDailyDef(id) { return MASCOT_DAILY_DEFS[id] || { title:"День вместе", desc:"Выиграй 2 расклада вместе", target:2, reward:100, metric:"win" }; }
  function ensureMascotDaily() {
    if (!profileReady()) return null;
    const date = typeof todayKey === "function" ? todayKey() : new Date().toISOString().slice(0,10);
    const raw = profile.mascotDaily && typeof profile.mascotDaily === "object" && !Array.isArray(profile.mascotDaily) ? profile.mascotDaily : {};
    if (raw.date !== date) profile.mascotDaily = { date, quests:{}, affinityBank: raw.affinityBank && typeof raw.affinityBank === "object" ? raw.affinityBank : {} };
    profile.mascotDaily.quests ||= {};
    profile.mascotDaily.affinityBank ||= {};
    return profile.mascotDaily;
  }
  function dailyQuestState(id) {
    const store = ensureMascotDaily(); if (!store) return null;
    const def = mascotDailyDef(id), raw = store.quests[id] || {};
    return (store.quests[id] = { progress:Math.max(0, Number(raw.progress)||0), completed:!!raw.completed, rewarded:!!raw.rewarded, ...def });
  }
  function dailyIncrement(def, s) {
    const stars = Math.max(0, Number(s?.lastStars)||0), hints = Math.max(0, Number(s?.run?.hints)||0), undos = Math.max(0, Number(s?.run?.undos)||0), combo = Math.max(0, Number(s?.run?.maxCombo)||0);
    switch (def.metric) {
      case "perfectNoHint": return stars === 3 && hints === 0 ? 1 : 0;
      case "combo4": return combo >= 4 ? 1 : 0;
      case "foxClean": return stars === 3 && hints === 0 && undos === 0 ? 1 : 0;
      case "noUndo": return undos === 0 ? 1 : 0;
      case "noHint": return hints === 0 ? 1 : 0;
      case "campaign": return s?.mode === "regular" ? 1 : 0;
      case "perfect": return stars === 3 ? 1 : 0;
      case "clean": return hints === 0 && undos === 0 ? 1 : 0;
      case "combo5": return combo >= 5 ? 1 : 0;
      case "categories": return Math.max(0, Number(s?.totalCategories)||0);
      default: return 1;
    }
  }
  function addGenericAffinity(id, amount) {
    const store = ensureMascotDaily();
    let remaining = Math.max(0, Math.trunc(Number(amount)||0));
    const banked = Math.max(0, Math.trunc(Number(store?.affinityBank?.[id])||0));
    remaining += banked;
    if (store?.affinityBank) store.affinityBank[id] = 0;
    if (id === "fox" && root.__solivocFoxJourney?.addAffinityXp) {
      const result = root.__solivocFoxJourney.addAffinityXp(remaining, { notify:true }) || {};
      if (store?.affinityBank) store.affinityBank[id] = Math.max(0, Math.trunc(Number(result.remaining)||0));
      root.__solivocFoxJourney.sync?.(true);
      return Math.max(0, Math.trunc(Number(result.applied)||0));
    }
    const def = typeof entityDef === "function" ? entityDef(id) : null;
    if (!def || typeof normalizeMascotProgressEntry !== "function") return 0;
    profile.mascotProgress ||= {};
    const progress = normalizeMascotProgressEntry(def, profile.mascotProgress[id]);
    progress.progressXp = Math.max(0, Number(progress.progressXp)||0) + remaining;
    progress.updatedAt = Date.now();
    profile.mascotProgress[id] = progress;
    return remaining;
  }
  function progressMascotDaily(s, id) {
    if (!id || !s?.run || s.failed || s.mode === "tutorial" || s.mode === "challenge" || s.mode === "marathon") return false;
    const quest = dailyQuestState(id); if (!quest || quest.completed) return false;
    const inc = dailyIncrement(quest, s); if (!inc) return false;
    quest.progress = Math.min(quest.target, quest.progress + inc);
    if (quest.progress >= quest.target) {
      quest.completed = true;
      if (!quest.rewarded) {
        quest.rewarded = true;
        const applied = addGenericAffinity(id, quest.reward);
        const def = typeof entityDef === "function" ? entityDef(id) : null;
        if (typeof queueAchievementNotifications === "function") queueAchievementNotifications([{ icon:def?.emoji || "♥", title:`Ежедневка ${def?.name || "маскота"} выполнена`, desc:`+${quest.reward} опыта привязанности${applied < quest.reward ? " · остаток сохранён" : ""}` }]);
      }
    }
    if (typeof saveProfile === "function") saveProfile();
    if (typeof scheduleAccountSync === "function") scheduleAccountSync(1200);
    return true;
  }
  function mascotDailyMarkup() {
    const def = selectedTamedMascot();
    if (!def) return "";
    if (def.id === "fox") addGenericAffinity("fox", 0);
    const quest = dailyQuestState(def.id); if (!quest) return "";
    const ratio = Math.min(1, quest.progress / Math.max(1, quest.target));
    const image = typeof companionAsset === "function" ? companionAsset(def) : def.image || "";
    return `<section class="hub-section v34-mascot-daily ${quest.completed ? "done" : ""}"><img src="${esc(image)}" alt=""><div><small>ЕЖЕДНЕВКА ОТ МАСКОТА</small><b>${esc(quest.title)}</b><span>${esc(quest.desc)}</span><div class="v34-mascot-daily-progress"><i style="width:${ratio*100}%"></i></div><em>${Math.min(quest.target,quest.progress)}/${quest.target}${quest.completed ? " ✓" : ""} · +${quest.reward} привязанности</em></div></section>`;
  }
  if (typeof finishLevel === "function") {
    const baseFinishLevel = finishLevel;
    finishLevel = function v34MascotDailyFinish(...args) {
      const wasRewarded = !!state?.rewarded;
      const companionId = selectedTamedMascot()?.id || "";
      const result = baseFinishLevel.apply(this, args);
      if (!wasRewarded && state?.rewarded && !state.failed && companionId) progressMascotDaily(state, companionId);
      return result;
    };
  }
  if (typeof homeTabMarkup === "function") {
    const baseHomeTabMarkup = homeTabMarkup;
    homeTabMarkup = function v34HomeTabMarkup(...args) {
      const markup = baseHomeTabMarkup.apply(this, args), daily = mascotDailyMarkup();
      return daily ? markup.replace("</section>", `</section>${daily}`) : markup;
    };
  }

  /* Weekly/monthly definitions remember history and exclude the five previous exact challenges. */
  function rotationBucket(kind) {
    profile.challengeRotation ||= {};
    const current = profile.challengeRotation[kind];
    if (!current || typeof current !== "object" || Array.isArray(current)) profile.challengeRotation[kind] = {};
    return profile.challengeRotation[kind];
  }
  function rememberRotation(kind, key, id) {
    if (!key || !id) return;
    const bucket = rotationBucket(kind); bucket[String(key)] = String(id);
    const keys = Object.keys(bucket).sort();
    for (const oldKey of keys.slice(0, Math.max(0, keys.length - 24))) delete bucket[oldKey];
  }
  function recentRotationIds(kind, key) {
    const bucket = rotationBucket(kind);
    return Object.keys(bucket).filter((x) => x < String(key)).sort().slice(-5).map((x) => bucket[x]).filter(Boolean);
  }
  function weeklyDefs() { return [...(typeof WEEKLY_DEFS !== "undefined" ? WEEKLY_DEFS : []), ...WEEKLY_EXTRA]; }
  function monthlyDefs() { return [...(typeof MONTHLY_DEFS !== "undefined" ? MONTHLY_DEFS : []), ...MONTHLY_EXTRA]; }
  if (typeof ensureWeeklyChallenge === "function" && typeof weekKey === "function") {
    ensureWeeklyChallenge = function v34EnsureWeeklyChallenge() {
      const key = weekKey(typeof todayKey === "function" ? todayKey() : new Date().toISOString().slice(0,10));
      profile.weekly ||= { key:null,id:null,baseline:{},completed:false,completedCount:0 };
      if (profile.weekly.key === key && profile.weekly.id) { rememberRotation("weekly", key, profile.weekly.id); return profile.weekly; }
      if (profile.weekly.key && profile.weekly.id) rememberRotation("weekly", profile.weekly.key, profile.weekly.id);
      const def = chooseRotatingDefinition(weeklyDefs(), recentRotationIds("weekly", key), `weekly-v34:${key}`) || weeklyDefs()[0];
      profile.weekly = { key, id:def.id, baseline:{ [def.metric]: typeof metricValue === "function" ? metricValue(def.metric) : 0 }, completed:false, rewarded:false, completedCount:profile.weekly.completedCount || profile.stats?.weeklyCompleted || 0 };
      rememberRotation("weekly", key, def.id);
      saveProfile?.();
      return profile.weekly;
    };
    weeklyDefinition = function v34WeeklyDefinition() { const w=ensureWeeklyChallenge(); return weeklyDefs().find((x)=>x.id===w.id) || weeklyDefs()[0]; };
  }
  if (typeof ensureMonthlyChallenge === "function" && typeof monthKey === "function") {
    ensureMonthlyChallenge = function v34EnsureMonthlyChallenge() {
      const key = monthKey(typeof todayKey === "function" ? todayKey() : new Date().toISOString().slice(0,10));
      profile.monthly ||= { key:null,id:null,baseline:{},completed:false,rewarded:false,completedCount:0 };
      if (profile.monthly.key === key && profile.monthly.id) { rememberRotation("monthly", key, profile.monthly.id); return profile.monthly; }
      if (profile.monthly.key && profile.monthly.id) rememberRotation("monthly", profile.monthly.key, profile.monthly.id);
      const def = chooseRotatingDefinition(monthlyDefs(), recentRotationIds("monthly", key), `monthly-v34:${key}`) || monthlyDefs()[0];
      profile.monthly = { key, id:def.id, baseline:{ [def.metric]: typeof metricValue === "function" ? metricValue(def.metric) : 0 }, completed:false, rewarded:false, completedCount:profile.monthly.completedCount || profile.stats?.monthlyCompleted || 0 };
      rememberRotation("monthly", key, def.id);
      saveProfile?.();
      return profile.monthly;
    };
    monthlyDefinition = function v34MonthlyDefinition() { const m=ensureMonthlyChallenge(); return monthlyDefs().find((x)=>x.id===m.id) || monthlyDefs()[0]; };
  }

  /* v34 owns campaign-picker taps in capture phase, so an older handler/layer cannot swallow the first tap. */
  let pickerState = { world:1, chapter:1 };
  function campaignChapterSize() { return Math.max(1, Number(typeof CHAPTER_SIZE !== "undefined" ? CHAPTER_SIZE : 10) || 10); }
  function chapterFirstLevel(chapter) { return (Math.max(1, chapter)-1)*campaignChapterSize()+1; }
  function chapterEarnedStars(chapter) { try { return chapterStarsForProfile(profile,chapter).reduce((a,b)=>a+(+b||0),0); } catch { return 0; } }
  function ensureCampaignPicker() {
    let modal = document.querySelector("#v34CampaignPicker");
    if (modal) return modal;
    modal = document.createElement("div"); modal.id="v34CampaignPicker"; modal.className="v32-campaign-picker v34-campaign-picker"; modal.hidden=true;
    modal.innerHTML=`<div class="v32-campaign-picker-card" role="dialog" aria-modal="true" aria-label="Быстрый выбор мира, главы и уровня"><div class="v32-picker-head"><div><small>КАМПАНИЯ</small><h2>Быстрый переход</h2></div><button type="button" class="v32-picker-close" aria-label="Закрыть">×</button></div><div class="v32-world-strip"></div><div class="v32-picker-body"><div class="v32-picker-section-title v32-picker-chapter-title"></div><div class="v32-chapter-strip"></div><div class="v32-picker-section-title v32-picker-level-title"></div><div class="v32-level-grid"></div></div></div>`;
    document.body.appendChild(modal); const close=()=>{modal.hidden=true;}; modal.querySelector(".v32-picker-close").onclick=close; modal.onclick=(e)=>{if(e.target===modal)close();};
    return modal;
  }
  function renderCampaignPicker() {
    const modal=ensureCampaignPicker(), maxLevel=Math.max(1,Number(profile.currentLevel)||1), maxChapter=Math.max(1,Number(chapterInfo?.(maxLevel)?.number)||1), maxWorld=Math.max(WORLD_NAMES.length,worldForChapter(maxChapter));
    pickerState.world=Math.max(1,Math.min(maxWorld,pickerState.world||1));
    const firstChapter=(pickerState.world-1)*10+1,lastChapter=firstChapter+9;
    if(pickerState.chapter<firstChapter||pickerState.chapter>lastChapter)pickerState.chapter=Math.min(lastChapter,Math.max(firstChapter,maxChapter>=firstChapter?Math.min(maxChapter,lastChapter):firstChapter));
    const worlds=modal.querySelector(".v32-world-strip");
    worlds.innerHTML=Array.from({length:maxWorld},(_,i)=>{const world=i+1,unlocked=(world-1)*10+1<=maxChapter;return `<button type="button" class="v32-world-button ${world===pickerState.world?"active":""} ${unlocked?"":"locked"}" data-v34-world="${world}" ${unlocked?"":"disabled"}><b>Мир ${world}</b><span>${esc(worldName(world))}</span></button>`;}).join("");
    worlds.querySelectorAll("[data-v34-world]:not(:disabled)").forEach((b)=>b.onclick=()=>{pickerState.world=+b.dataset.v34World||1;const first=(pickerState.world-1)*10+1;pickerState.chapter=Math.min(first+9,Math.max(first,maxChapter>=first?Math.min(maxChapter,first+9):first));renderCampaignPicker();});
    modal.querySelector(".v32-picker-chapter-title").innerHTML=`<b>Мир ${pickerState.world} · ${esc(worldName(pickerState.world))}</b><small>выбери главу</small>`;
    const chapters=modal.querySelector(".v32-chapter-strip");
    chapters.innerHTML=Array.from({length:10},(_,i)=>{const chapter=firstChapter+i,unlocked=chapter<=maxChapter;return `<button type="button" class="v32-chapter-button ${chapter===pickerState.chapter?"active":""}" data-v34-chapter="${chapter}" ${unlocked?"":"disabled"}>${i+1}</button>`;}).join("");
    chapters.querySelectorAll("[data-v34-chapter]:not(:disabled)").forEach((b)=>b.onclick=()=>{pickerState.chapter=+b.dataset.v34Chapter||firstChapter;renderCampaignPicker();});
    const selected=pickerState.chapter,start=chapterFirstLevel(selected),earned=chapterEarnedStars(selected);
    modal.querySelector(".v32-picker-level-title").innerHTML=`<b>Глава ${chapterInWorld(selected)} · ${esc(localChapterName(selected))}</b><small>${earned}/30 ★ · выбери уровень</small>`;
    const levels=modal.querySelector(".v32-level-grid");
    levels.innerHTML=Array.from({length:campaignChapterSize()},(_,i)=>{const level=start+i,unlocked=level<=maxLevel,stars=Math.max(0,Math.min(3,Number(profile.starsByLevel?.[level])||0)),special=typeof specialForLevel==="function"?specialForLevel(level):null,current=state?.mode==="regular"&&+state.level===level;return `<button type="button" class="v32-level-button ${current?"current":""}" data-v34-level="${level}" ${unlocked?"":"disabled"}><b>${special?.icon||""}${level}</b><span>${unlocked?(stars?`${"★".repeat(stars)}${"☆".repeat(3-stars)}`:"···"):"🔒"}</span></button>`;}).join("");
    levels.querySelectorAll("[data-v34-level]:not(:disabled)").forEach((b)=>b.onclick=()=>{const level=+b.dataset.v34Level||maxLevel;modal.hidden=true;try{closeHub?.();}catch{}makeLevel?.(level,{mode:"regular"});});
    worlds.querySelector(".v32-world-button.active")?.scrollIntoView?.({inline:"center",block:"nearest"});
  }
  function openCampaignPicker() {
    const currentChapter=Math.max(1,Number(typeof hubChapterNumber!=="undefined"?hubChapterNumber:0)||Number(chapterInfo?.(profile.currentLevel||1)?.number)||1);
    pickerState.chapter=currentChapter;pickerState.world=worldForChapter(currentChapter);renderCampaignPicker();ensureCampaignPicker().hidden=false;
  }
  document.addEventListener("click",(event)=>{
    const trigger=event.target?.closest?.(".v32-chapter-trigger,.chapter-section .chapter-head>div,.v31-chapter-picker-hit");
    if(!trigger||!document.querySelector("#hub")?.classList.contains("show"))return;
    event.preventDefault();event.stopImmediatePropagation();openCampaignPicker();
  },true);

  /* Load admin-authored in-game letters without making boot depend on the network. */
  let developerMailBusy=false, developerMailAt=0;
  async function fetchDeveloperMail({ force=false }={}) {
    if(developerMailBusy || !profileReady() || typeof accountSignedIn!=="function" || !accountSignedIn() || navigator.onLine===false) return false;
    if(!force && Date.now()-developerMailAt<60000)return false;
    developerMailBusy=true;developerMailAt=Date.now();
    try{
      const response=await apiFetch("/api/developer-mail",{cache:"no-store"});if(!response.ok)return false;
      const data=await response.json().catch(()=>({})),incoming=Array.isArray(data.messages)?data.messages:[];
      root.SERVER_BOOTSTRAP ||= {}; const existing=Array.isArray(root.SERVER_BOOTSTRAP.developerMessages)?root.SERVER_BOOTSTRAP.developerMessages:[];
      const byId=new Map();[...incoming,...existing].forEach((m)=>{if(m?.id&&!byId.has(String(m.id)))byId.set(String(m.id),m);});
      root.SERVER_BOOTSTRAP.developerMessages=[...byId.values()];updateProfileMailBadge?.();return incoming.length>0;
    }catch{return false;}finally{developerMailBusy=false;}
  }
  setTimeout(()=>fetchDeveloperMail({force:true}),1400);
  window.addEventListener("online",()=>fetchDeveloperMail({force:true}),{passive:true});
  document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")fetchDeveloperMail();},{passive:true});
  setInterval(()=>{if(document.visibilityState==="visible")fetchDeveloperMail();},90000);
  if(typeof openDeveloperMailModal==="function"){
    const baseOpenDeveloperMailModal=openDeveloperMailModal;
    openDeveloperMailModal=function v34DeveloperMailModal(...args){const result=baseOpenDeveloperMailModal.apply(this,args);fetchDeveloperMail({force:true}).then((changed)=>{if(changed&&document.querySelector("#developerMailModal")?.classList.contains("show"))baseOpenDeveloperMailModal({markRead:false});});return result;};
  }


  /* v35: card backs use visual rarity instead of noisy labels, with an explicit filter. */
  const CARD_BACK_RARITY_META = Object.freeze({
    // Technical IDs stay stable for saves; players see the folklore vocabulary.
    common: { label:"Простые", singular:"Простая", color:"#a9b0bb" },
    uncommon: { label:"Дивные", singular:"Дивная", color:"#6fbd91" },
    rare: { label:"Вещие", singular:"Вещая", color:"#6f9fc5" },
    epic: { label:"Заповедные", singular:"Заповедная", color:"#9476bd" },
    legendary: { label:"Сокровенные", singular:"Сокровенная", color:"#c9aa62" },
  });
  const CARD_BACK_RARITY_BY_ID = Object.freeze({
    classic:"common", "midnight-grid":"common",
    prism:"uncommon", sunrise:"uncommon", constellation:"uncommon",
    trophy:"rare", mosaic:"rare", duelist:"rare", crown:"rare", ember:"rare", master:"rare",
    velvet:"epic", glacier:"epic", lotus:"epic", chronicle:"epic", phoenix:"epic", lion:"epic", parrot:"epic",
    anniversary:"legendary", atlas:"legendary", legend:"legendary", obsidian:"legendary", "grand-trophy":"legendary",
  });
  let cardBackRarityFilter = "all";
  function cardBackRarity(back) {
    if (!back) return "common";
    const explicit = CARD_BACK_RARITY_BY_ID[String(back.id || "")];
    if (explicit) return explicit;
    const achievements = Math.max(0, Number(back.minAchievements) || 0);
    if (achievements >= 20) return "epic";
    if (achievements >= 12) return "rare";
    if (achievements >= 4) return "uncommon";
    return back.rare ? "rare" : "common";
  }
  function cardBackRarityCounts() {
    const counts = { common:0, uncommon:0, rare:0, epic:0, legendary:0 };
    for (const back of (typeof CARD_BACK_DEFS !== "undefined" ? CARD_BACK_DEFS : [])) {
      const rarity = cardBackRarity(back);
      if (Object.prototype.hasOwnProperty.call(counts, rarity)) counts[rarity]++;
    }
    return counts;
  }
  function decorateCardBackRarity() {
    const section = document.querySelector('[data-cosmetic-section="backs"]');
    if (!section || typeof CARD_BACK_DEFS === "undefined") return false;
    const clip = section.querySelector(".cosmetic-clip");
    const grid = section.querySelector(".cardback-grid");
    if (!clip || !grid) return false;

    let filters = section.querySelector(".v35-cardback-filters");
    if (!filters) {
      filters = document.createElement("div");
      filters.className = "v35-cardback-filters";
      clip.before(filters);
    }
    const counts = cardBackRarityCounts();
    filters.innerHTML = [
      ["all", "Все", CARD_BACK_DEFS.length],
      ...Object.entries(CARD_BACK_RARITY_META).map(([id, meta]) => [id, meta.label, counts[id] || 0]),
    ].map(([id, label, count]) => `<button type="button" class="${cardBackRarityFilter === id ? "active" : ""}" data-v35-cardback-filter="${id}"${id !== "all" ? ` style="--rarity:${CARD_BACK_RARITY_META[id].color}"` : ""}><span>${label}</span><small>${count}</small></button>`).join("");
    filters.querySelectorAll("[data-v35-cardback-filter]").forEach((button) => {
      button.onclick = () => {
        cardBackRarityFilter = String(button.dataset.v35CardbackFilter || "all");
        decorateCardBackRarity();
      };
    });

    const defs = new Map(CARD_BACK_DEFS.map((back) => [String(back.id), back]));
    grid.querySelectorAll(".cardback-tile[data-card-back-id]").forEach((tile) => {
      const back = defs.get(String(tile.dataset.cardBackId || ""));
      const rarity = cardBackRarity(back);
      const rarityNames = new Set([
        "ОБЫЧНАЯ", "НЕОБЫЧНАЯ", "РЕДКАЯ", "ЭПИЧЕСКАЯ", "ЛЕГЕНДАРНАЯ",
        "ПРОСТАЯ", "ДИВНАЯ", "ВЕЩАЯ", "ЗАПОВЕДНАЯ", "СОКРОВЕННАЯ",
      ]);
      tile.querySelectorAll("[data-cardback-rarity-label],.cardback-rarity-label,.rarity-label").forEach((node) => node.remove());
      [...tile.children].forEach((node) => {
        if (node.matches?.(".cardback-preview,b")) return;
        if (rarityNames.has(String(node.textContent || "").trim().toUpperCase())) node.remove();
      });
      tile.dataset.cardBackRarity = rarity;
      tile.style.setProperty("--cardback-rarity", CARD_BACK_RARITY_META[rarity]?.color || CARD_BACK_RARITY_META.common.color);
      tile.classList.toggle("v35-rarity-hidden", cardBackRarityFilter !== "all" && cardBackRarityFilter !== rarity);
      tile.setAttribute("aria-label", `${back?.name || "Рубашка"}. Степень: ${CARD_BACK_RARITY_META[rarity]?.singular || "Простая"}`);
    });
    section.classList.toggle("v35-rarity-filter-active", cardBackRarityFilter !== "all");
    return true;
  }
  if (typeof renderHub === "function" && !renderHub.__v35CardBackRarity) {
    const baseRenderHub = renderHub;
    renderHub = function v35CardBackRarityRender(...args) {
      const result = baseRenderHub.apply(this, args);
      queueMicrotask(decorateCardBackRarity);
      return result;
    };
    renderHub.__v35CardBackRarity = true;
  }

  root.__solivocV34 = Object.freeze({ openCampaignPicker, openMascotPortrait, fetchDeveloperMail, mascotDailyMarkup, syncCompanionActionControls, decorateCardBackRarity, cardBackRarity });
  queueMicrotask(()=>{ syncCompanionActionControls(); ensureMascotDaily(); decorateCardBackRarity(); fetchDeveloperMail(); });
})();
