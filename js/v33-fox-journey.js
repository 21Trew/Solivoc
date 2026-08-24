/* Словасьянс v33: first complete mascot journey — Fox only. */
(() => {
  if (window.__solivocFoxJourneyInstalled) return;
  window.__solivocFoxJourneyInstalled = true;

  function installFoxStyles() {
    if (document.querySelector('link[data-fox-journey-styles]')) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "./styles/mascot-fox.css";
    link.dataset.foxJourneyStyles = "1";
    document.head?.appendChild(link);
  }
  installFoxStyles();

  const FOX_ID = "fox";
  const JOURNEY_VERSION = 2;
  // Affinity is intentionally long-term. Each level has an XP phase first;
  // only after the gauge is full do that level's personal quests begin.
  const LEVEL_THRESHOLDS = Object.freeze([0, 300, 900, 1800, 3000]);
  const LEVEL_NAMES = Object.freeze(["", "Недоверие", "Напарник", "Друг", "Близкий друг", "Верный спутник"]);
  const CORE_TRAITS = Object.freeze(["хитрый", "быстрый", "ехидный"]);
  const ABILITIES = Object.freeze({
    fox_sense: {
      id: "fox_sense", kind: "passive", name: "Лисье чутьё", icon: "◉", unlockLevel: 2,
      desc: "Первая обычная подсказка в раскладе не расходует подсказку и не влияет на звёзды.",
    },
    fox_detour: {
      id: "fox_detour", kind: "active", name: "Обходной путь", icon: "↶", unlockLevel: 2,
      desc: "Один раз за расклад бесплатно откатывает последний ход. Обычная отмена не расходуется.",
    },
    fox_secret_path: {
      id: "fox_secret_path", kind: "active", name: "Тайная тропа", icon: "✦", unlockLevel: 4,
      desc: "Один раз за расклад Лис сам выполняет найденный безопасный ход. Подсказка не расходуется.",
    },
  });
  const QUESTS = Object.freeze([
    { id: "fox-trust", level: 1, title: "Проверка на доверие", desc: "После заполнения шкалы пройди 5 уровней без подсказок и без отмен.", target: 5, training: 1 },
    { id: "fox-no-trace", level: 2, title: "Не оставляя следов", desc: "После заполнения шкалы выиграй 8 раскладов без обычной отмены.", target: 8 },
    { id: "fox-combo", level: 2, title: "По горячему следу", desc: "Заверши 5 раскладов с ручным комбо ×6 или выше.", target: 5 },
    { id: "fox-daily", level: 3, title: "Ежедневная разведка", desc: "Пройди ежедневный расклад вместе с Лисом в 3 разных дня.", target: 3 },
    { id: "fox-detour", level: 3, title: "Обходной манёвр", desc: "Используй «Обходной путь» и доведи до победы 5 раскладов.", target: 5, training: 2 },
    { id: "fox-sparring", level: 4, title: "Спарринг", desc: "Трижды получи ★★★, использовав в одном раскладе обе активные способности Лиса.", target: 3, training: 3 },
  ]);
  const TRAINING = Object.freeze([
    { level: 1, title: "Испытание", quest: "fox-trust", desc: "Лис наблюдает и решает, достоин ли ты его доверия." },
    { level: 2, title: "Обучение", quest: "fox-detour", desc: "Вы учитесь пользоваться его хитростью как одной командой." },
    { level: 3, title: "Спарринг", quest: "fox-sparring", desc: "Финальная проверка: обе активные способности в идеальной партии." },
  ]);
  const DIALOGUE = Object.freeze({
    1: {
      start: ["Я пока просто смотрю. Не воображай лишнего.", "Покажи, что та победа была не случайностью.", "Не жди помощи. Сначала докажи, что умеешь думать."],
      win: ["Неплохо. Но одного удачного хода мало.", "Ладно. Это было умнее, чем я ожидал.", "Запомнил. Посмотрим, повторишь ли."],
      error: ["Вот поэтому я и не спешу доверять.", "Слишком очевидная ловушка.", "Хм. Теперь хотя бы знаешь, куда не идти."],
      combo: ["Быстро. Но не теряй голову.", "Такой след уже интереснее.", "Продолжай. Я наблюдаю."],
      hint: ["Я бы заметил это раньше. Но смотри сюда.", "Есть одна зацепка. Не говори, что я помогал.", "Только потому, что мне интересно, догадаешься ли ты дальше."],
    },
    2: {
      start: ["Ладно, сегодня идём вместе.", "Я покажу тропу. Решение всё равно за тобой.", "Напарники так напарники. Только не тормози."],
      win: ["Вот это уже похоже на совместный план.", "Хитро. Мне нравится.", "Хорошо сработано, напарник."],
      error: ["Обойдём. Прямые дороги скучны.", "Не страшно. У любой ловушки есть край.", "Теперь знаем, где лежит капкан."],
      combo: ["Вот так. Один след цепляется за другой.", "Темп хороший. Не расплескай его.", "Красиво петляем."],
      hint: ["Вижу короткую тропу.", "Посмотри сюда — дальше сам.", "Есть обход. Начни с этой карты."],
    },
    3: {
      start: ["Ну что, друг, проверим расклад на прочность?", "Я уже нашёл пару подозрительно удобных мест.", "Сегодня попробуем сделать красиво."],
      win: ["Вот за такие партии я тебя и уважаю.", "Ха. Мы снова всех перехитрили.", "Неплохая команда из нас получилась."],
      error: ["Бывает. Я тоже иногда выбираю слишком хитрый путь.", "Запомним и пойдём иначе.", "Ничего, друг. Ловушка уже раскрыта."],
      combo: ["Вот теперь начинается настоящее веселье.", "Один ловкий ход за другим.", "Мне нравится, куда это идёт."],
      hint: ["Другу можно подсказать. Смотри.", "Здесь есть хорошая лазейка.", "Я бы начал отсюда."],
    },
    4: {
      start: ["Я прикрою хитрые места. Ты веди.", "Знаешь, я уже привык играть рядом с тобой.", "Пойдём нашей дорогой — она обычно короче."],
      win: ["Именно поэтому я выбираю идти с тобой.", "Чисто, умно и без лишнего шума.", "С тобой даже очевидная победа выглядит хитрой."],
      error: ["Я рядом. Выберемся.", "Не зацикливайся — у нас ещё есть тропы.", "Один промах нашей охоте не помешает."],
      combo: ["Не сбавляй. Я успеваю за тобой.", "Вот наша скорость.", "Связи уже сами выходят на след."],
      hint: ["Доверься мне: начни здесь.", "Я вижу путь. Вот первая точка.", "Есть тропа, которую легко пропустить."],
    },
    5: {
      start: ["Куда бы ни вёл расклад, я с тобой.", "Мы уже знаем друг друга слишком хорошо. Начинаем.", "Ну что, старый друг? Покажем класс."],
      win: ["Вот почему я никуда от тебя не уйду.", "Идеальный план? Нет. Просто мы отлично понимаем друг друга.", "Снова красиво. Снова вместе."],
      error: ["Ничего. Я знаю, как ты выбираешься из таких мест.", "Ошибся — значит, сейчас найдём путь лучше.", "Я рядом. Этого достаточно."],
      combo: ["Вот она — наша фирменная тропа.", "Даже объяснять друг другу ничего не нужно.", "Красота. Продолжай."],
      hint: ["Я знаю, куда ты сейчас посмотришь. Вот сюда.", "Есть путь. Ты мне доверяешь.", "Смотри — это наш ход."],
    },
  });

  const esc = (value) => typeof escapeHtml === "function"
    ? escapeHtml(value)
    : String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" })[ch]);
  const now = () => Date.now();
  const foxDef = () => typeof entityDef === "function" ? entityDef(FOX_ID) : null;
  const statusRank = (status) => typeof entityStatusRank === "function"
    ? entityStatusRank(status)
    : ({ locked:0, encountered:1, captured:2, companion:3, mastered:4 }[String(status)] || 0);
  const profileReady = () => typeof profile !== "undefined" && profile && typeof profile === "object";
  const foxRawProgress = () => profileReady() ? profile.mascotProgress?.[FOX_ID] : null;
  const foxCaptured = () => statusRank(foxRawProgress()?.status) >= statusRank("captured")
    || (profileReady() && Array.isArray(profile.companionsUnlocked) && profile.companionsUnlocked.includes(FOX_ID));
  const foxCompanion = () => statusRank(foxRawProgress()?.status) >= statusRank("companion");
  const currentLevel = () => Math.max(1, Math.min(5, Math.trunc(Number(foxRawProgress()?.level) || 1)));
  const levelName = (level = currentLevel()) => LEVEL_NAMES[Math.max(1, Math.min(5, level))] || LEVEL_NAMES[1];
  const completedSet = () => new Set(Array.isArray(foxRawProgress()?.completedQuests) ? foxRawProgress().completedQuests : []);

  function ensureJourney() {
    if (!profileReady()) return null;
    const raw = profile.foxJourney && typeof profile.foxJourney === "object" && !Array.isArray(profile.foxJourney) ? profile.foxJourney : {};
    const runs = Array.isArray(raw.runs)
      ? raw.runs.filter((run) => run && typeof run === "object" && run.id)
        .sort((a, b) => (parseInt(String(a.id).split(":")[0], 36) || 0) - (parseInt(String(b.id).split(":")[0], 36) || 0))
        .slice(-240)
      : [];
    const questGates = raw.questGates && typeof raw.questGates === "object" && !Array.isArray(raw.questGates)
      ? Object.fromEntries(Object.entries(raw.questGates).map(([level, at]) => [String(level), Math.max(0, Number(at) || 0)]))
      : {};
    profile.foxJourney = { version: JOURNEY_VERSION, runs, questGates };
    return profile.foxJourney;
  }

  function runAbilityState(s = typeof state !== "undefined" ? state : null) {
    if (!s?.run) return null;
    const key = `${String(s.mode || "")}:${String(s.seed || "")}:${Number(s.level) || 0}`;
    const previous = s.foxAbilityState && typeof s.foxAbilityState === "object" ? s.foxAbilityState : {};
    if (previous.key !== key) {
      s.foxAbilityState = { key, freeHintUsed: false, detourUsed: false, secretPathUsed: false };
    } else {
      s.foxAbilityState = {
        key,
        freeHintUsed: !!previous.freeHintUsed,
        detourUsed: !!previous.detourUsed,
        secretPathUsed: !!previous.secretPathUsed,
      };
    }
    return s.foxAbilityState;
  }

  function abilityRoundAllowed() {
    if (typeof state === "undefined" || !state || state.rewarded || state.failed || state.mode === "tutorial") return false;
    return ["regular", "calm", "collection"].includes(state.mode);
  }
  function foxSelected() {
    return profileReady() && profile.settings?.companion === FOX_ID && foxCompanion();
  }
  function abilityUnlocked(id) {
    const def = ABILITIES[id];
    return !!def && foxSelected() && currentLevel() >= def.unlockLevel && abilityRoundAllowed();
  }

  function runTimestamp(run) {
    const explicit = Math.max(0, Number(run?.at) || 0);
    if (explicit) return explicit;
    const prefix = String(run?.id || "").split(":")[0];
    const parsed = parseInt(prefix, 36);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }
  function questGateAt(level) {
    return Math.max(0, Number(ensureJourney()?.questGates?.[String(level)] || 0));
  }
  function questRuns(quest, runs = ensureJourney()?.runs || []) {
    const gateAt = questGateAt(quest.level);
    if (!gateAt) return [];
    return runs.filter((run) => runTimestamp(run) > gateAt);
  }
  function questMeasure(id, runs = ensureJourney()?.runs || []) {
    const quest = QUESTS.find((item) => item.id === id);
    if (!quest) return 0;
    const scoped = questRuns(quest, runs);
    switch (id) {
      case "fox-trust": return scoped.filter((r) => r.mode === "regular" && r.hints === 0 && r.undos === 0).length;
      case "fox-no-trace": return scoped.filter((r) => r.undos === 0).length;
      case "fox-combo": return scoped.filter((r) => r.combo >= 6).length;
      case "fox-daily": return new Set(scoped.filter((r) => r.mode === "daily").map((r) => r.date || String(r.id).slice(0, 8))).size;
      case "fox-detour": return scoped.filter((r) => r.detour).length;
      case "fox-sparring": return scoped.filter((r) => r.stars === 3 && r.detour && r.secretPath).length;
      default: return 0;
    }
  }
  function questState(quest, runs = ensureJourney()?.runs || []) {
    const done = completedSet().has(quest.id);
    const gateAt = questGateAt(quest.level);
    const active = done || (quest.level === currentLevel() && gateAt > 0);
    const value = done ? quest.target : active ? Math.min(quest.target, questMeasure(quest.id, runs)) : 0;
    return { ...quest, value, done, active, gateAt };
  }
  function runXp(run) {
    let value = 20;
    if (run.stars === 3) value += 6;
    if (run.hints === 0) value += 5;
    if (run.undos === 0) value += 5;
    if (run.combo >= 6) value += 6;
    if (run.mode === "daily") value += 10;
    if (run.detour) value += 8;
    if (run.secretPath) value += 8;
    return Math.max(10, value);
  }
  function affinityTarget(level = currentLevel()) {
    const safe = Math.max(1, Math.min(5, Math.trunc(Number(level) || 1)));
    return LEVEL_THRESHOLDS[Math.min(4, safe)] || LEVEL_THRESHOLDS[4];
  }
  function addFoxAffinityXp(amount, { notify = false } = {}) {
    if (!profileReady() || !foxCaptured()) return { applied: 0, remaining: Math.max(0, Number(amount) || 0), full: false };
    const def = foxDef();
    if (!def || typeof normalizeMascotProgressEntry !== "function") return { applied: 0, remaining: Math.max(0, Number(amount) || 0), full: false };
    profile.mascotProgress ||= {};
    const progress = normalizeMascotProgressEntry(def, foxRawProgress());
    const level = Math.max(1, Math.min(5, Number(progress.level) || 1));
    if (level >= 5) return { applied: 0, remaining: Math.max(0, Number(amount) || 0), full: true };
    const journey = ensureJourney();
    const target = affinityTarget(level);
    const before = Math.max(LEVEL_THRESHOLDS[level - 1] || 0, Number(progress.progressXp) || 0);
    if (questGateAt(level)) return { applied: 0, remaining: Math.max(0, Number(amount) || 0), full: true };
    const requested = Math.max(0, Math.trunc(Number(amount) || 0));
    const next = Math.min(target, before + requested);
    const applied = Math.max(0, next - before);
    progress.progressXp = next;
    if (next >= target && !journey.questGates[String(level)]) {
      journey.questGates[String(level)] = now();
      if (notify) notifyFox("◆", "Шкала привязанности заполнена", `Лис готов дать задания для перехода на уровень ${level + 1}.`);
    }
    if (applied > 0) progress.updatedAt = now();
    profile.mascotProgress[FOX_ID] = progress;
    return { applied, remaining: Math.max(0, requested - applied), full: next >= target };
  }

  function chooseDevelopedTrait(slot, runs) {
    const precision = runs.filter((r) => r.hints === 0 && r.undos === 0).length;
    const combos = runs.filter((r) => r.combo >= 5).length;
    const abilityRuns = runs.filter((r) => r.detour || r.secretPath || r.freeHint).length;
    const perfect = runs.filter((r) => r.stars === 3).length;
    if (slot === 0) return precision >= combos ? "терпеливый" : "азартный";
    if (abilityRuns >= 3) return "заботливый";
    if (perfect >= 5) return "надёжный";
    return "игривый";
  }

  function notifyFox(icon, title, desc) {
    if (typeof queueAchievementNotifications === "function") queueAchievementNotifications([{ icon, title, desc }]);
  }

  function syncFoxProgress({ notify = false } = {}) {
    if (!profileReady() || !foxCaptured()) return null;
    const def = foxDef();
    if (!def || typeof normalizeMascotProgressEntry !== "function") return foxRawProgress();
    const journey = ensureJourney();
    const runs = journey?.runs || [];
    const before = normalizeMascotProgressEntry(def, foxRawProgress());
    const progress = normalizeMascotProgressEntry(def, foxRawProgress());
    const completed = new Set(progress.completedQuests || []);
    let level = Math.max(1, progress.level || 1);

    // Never reduce already released progress, but for every new level enforce:
    // fill XP first -> unlock that level's quests -> complete them -> level up.
    const floor = LEVEL_THRESHOLDS[Math.max(0, Math.min(4, level - 1))] || 0;
    progress.progressXp = Math.max(floor, Number(progress.progressXp) || 0);
    const target = affinityTarget(level);
    if (level < 5 && progress.progressXp >= target && !journey.questGates[String(level)]) {
      journey.questGates[String(level)] = now();
      if (notify) notifyFox("◆", "Шкала привязанности заполнена", `Теперь выполни задания Лиса для перехода на уровень ${level + 1}.`);
    }

    for (const quest of QUESTS) {
      if (completed.has(quest.id)) continue;
      if (quest.level !== level || !questGateAt(level)) continue;
      if (questMeasure(quest.id, runs) >= quest.target) completed.add(quest.id);
    }
    progress.completedQuests = [...completed];

    const required = QUESTS.filter((quest) => quest.level === level).map((quest) => quest.id);
    const xpReady = level >= 5 || progress.progressXp >= target;
    const questsReady = required.length === 0 || required.every((id) => completed.has(id));
    if (level < 5 && xpReady && questsReady) {
      level += 1;
      progress.level = level;
      progress.progressXp = Math.max(progress.progressXp, LEVEL_THRESHOLDS[level - 1] || 0);
    } else {
      progress.level = level;
    }

    const trainingLevel = completed.has("fox-sparring") ? 3 : completed.has("fox-detour") ? 2 : completed.has("fox-trust") ? 1 : 0;
    progress.trainingLevel = Math.max(progress.trainingLevel || 0, trainingLevel);

    if (level >= 2) {
      progress.status = level >= 5 ? "mastered" : "companion";
      profile.companionsUnlocked ||= [];
      if (!profile.companionsUnlocked.includes(FOX_ID)) profile.companionsUnlocked.push(FOX_ID);
      progress.abilities.fox_sense = Math.max(1, progress.abilities.fox_sense || 0);
      progress.abilities.fox_detour = Math.max(1, progress.abilities.fox_detour || 0);
      progress.equippedAbilities.passive = "fox_sense";
      if (!progress.equippedAbilities.active.includes("fox_detour")) progress.equippedAbilities.active.unshift("fox_detour");
    }
    if (level >= 4) {
      progress.abilities.fox_secret_path = Math.max(1, progress.abilities.fox_secret_path || 0);
      if (!progress.equippedAbilities.active.includes("fox_secret_path")) progress.equippedAbilities.active.push("fox_secret_path");
    }
    progress.equippedAbilities.active = [...new Set(progress.equippedAbilities.active)].filter((id) => ["fox_detour", "fox_secret_path"].includes(id)).slice(0, 2);
    const nextLoadout = JSON.stringify({ active: progress.equippedAbilities.active, passive: progress.equippedAbilities.passive });
    if (nextLoadout !== JSON.stringify({ active: before.equippedAbilities?.active || [], passive: before.equippedAbilities?.passive || "" })) {
      progress.equippedAbilities.updatedAt = now();
    } else {
      progress.equippedAbilities.updatedAt = before.equippedAbilities?.updatedAt || progress.equippedAbilities.updatedAt || 0;
    }

    const desiredEvolution = level >= 5 ? 3 : level >= 4 ? 2 : level >= 2 ? 1 : 0;
    if (desiredEvolution > (progress.evolutionStage || 0)) {
      progress.evolutionStage = desiredEvolution;
      progress.evolutionUpdatedAt = now();
    }

    const traits = Array.isArray(progress.developedTraits) ? [...progress.developedTraits] : [];
    if (level >= 3 && traits.length < 1) traits.push(chooseDevelopedTrait(0, runs));
    if (level >= 5 && traits.length < 2) {
      const trait = chooseDevelopedTrait(1, runs);
      traits.push(traits.includes(trait) ? "игривый" : trait);
    }
    progress.developedTraits = [...new Set(traits)].slice(0, 2);
    if (progress.developedTraits.join("|") !== (before.developedTraits || []).join("|")) progress.traitsUpdatedAt = now();

    const changed = JSON.stringify({
      status: before.status, level: before.level, xp: before.progressXp, evolution: before.evolutionStage,
      training: before.trainingLevel, quests: before.completedQuests, traits: before.developedTraits, abilities: before.abilities,
    }) !== JSON.stringify({
      status: progress.status, level: progress.level, xp: progress.progressXp, evolution: progress.evolutionStage,
      training: progress.trainingLevel, quests: progress.completedQuests, traits: progress.developedTraits, abilities: progress.abilities,
    });
    if (changed) progress.updatedAt = now();
    profile.mascotProgress[FOX_ID] = progress;

    if (notify) {
      if (before.level < 2 && progress.level >= 2) notifyFox("🦊", "Лис стал напарником", "Недоверие позади. Теперь его способности доступны в совместных раскладах.");
      else if (progress.level > before.level) notifyFox("♥", `Дружба с Лисом · уровень ${progress.level}`, `${levelName(progress.level)}. Открыт новый этап отношений.`);
      if (progress.evolutionStage > before.evolutionStage) notifyFox("✦", "Эволюция Лиса", `Открыта форма ${progress.evolutionStage + 1}. Загляни в историю Лиса.`);
      if (progress.developedTraits.length > before.developedTraits.length) notifyFox("◇", "Лис изменился", `Новая черта: ${progress.developedTraits.at(-1)}.`);
    }
    return progress;
  }

  function captureFox({ notify = true } = {}) {
    if (!profileReady()) return foxDef();
    const def = foxDef();
    if (!def || typeof normalizeMascotProgressEntry !== "function") return def;
    profile.mascotProgress ||= {};
    const progress = normalizeMascotProgressEntry(def, profile.mascotProgress[FOX_ID]);
    const legacyUnlocked = Array.isArray(profile.companionsUnlocked) && profile.companionsUnlocked.includes(FOX_ID);
    if (legacyUnlocked || statusRank(progress.status) >= statusRank("companion")) return null;
    const firstCapture = statusRank(progress.status) < statusRank("captured");
    progress.status = "captured";
    progress.level = Math.max(1, progress.level || 0);
    progress.capturedAt ||= now();
    progress.updatedAt = firstCapture ? now() : progress.updatedAt;
    profile.mascotProgress[FOX_ID] = progress;
    ensureJourney();
    if (firstCapture && notify) notifyFox("🦊", "Хитрый лис побеждён", "Ты захватил Лиса, но он пока тебе не доверяет. Его история открыта в разделе маскотов.");
    return def;
  }

  // New players capture Fox instead of receiving an instant companion. Existing
  // owners are grandfathered so no released reward is ever taken away.
  if (typeof unlockCompanion === "function") {
    const baseUnlockCompanion = unlockCompanion;
    unlockCompanion = function foxAwareUnlockCompanion(id, options = {}) {
      if (String(id) !== FOX_ID) return baseUnlockCompanion(id, options);
      const progress = foxRawProgress();
      const legacyUnlocked = profileReady() && Array.isArray(profile.companionsUnlocked) && profile.companionsUnlocked.includes(FOX_ID);
      if (legacyUnlocked || statusRank(progress?.status) >= statusRank("companion")) return baseUnlockCompanion(id, options);
      return captureFox({ notify: options?.notify !== false });
    };
  }

  if (typeof syncBossCompanionsFromProgress === "function") {
    const baseSyncBossCompanions = syncBossCompanionsFromProgress;
    syncBossCompanionsFromProgress = function foxAwareBossSync(options = {}) {
      const result = baseSyncBossCompanions(options);
      grandfatherFoxOwner();
      syncFoxProgress({ notify: false });
      return result;
    };
  }

  // Existing owners start at least at the companion tier. This does not grant
  // additional levels; it only aligns old saves with the new Fox rules.
  function grandfatherFoxOwner() {
    if (!profileReady()) return;
    const legacyUnlocked = Array.isArray(profile.companionsUnlocked) && profile.companionsUnlocked.includes(FOX_ID);
    const def = foxDef();
    if (!legacyUnlocked || !def || typeof normalizeMascotProgressEntry !== "function") return;
    profile.mascotProgress ||= {};
    const progress = normalizeMascotProgressEntry(def, profile.mascotProgress[FOX_ID]);
    progress.status = statusRank(progress.status) >= statusRank("companion") ? progress.status : "companion";
    progress.level = Math.max(2, progress.level || 0);
    progress.progressXp = Math.max(LEVEL_THRESHOLDS[1], progress.progressXp || 0);
    progress.evolutionStage = Math.max(1, progress.evolutionStage || 0);
    progress.abilities.fox_sense = Math.max(1, progress.abilities.fox_sense || 0);
    progress.abilities.fox_detour = Math.max(1, progress.abilities.fox_detour || 0);
    if (!progress.completedQuests.includes("fox-trust")) progress.completedQuests.push("fox-trust");
    progress.trainingLevel = Math.max(1, progress.trainingLevel || 0);
    progress.equippedAbilities.passive = "fox_sense";
    if (!progress.equippedAbilities.active.includes("fox_detour")) progress.equippedAbilities.active.unshift("fox_detour");
    profile.mascotProgress[FOX_ID] = progress;
    ensureJourney();
    syncFoxProgress({ notify: false });
  }
  grandfatherFoxOwner();

  // Fox has three post-capture evolutions. Art #5 remains the intimidating boss
  // form and is shown only while the unbeaten chapter boss is on screen.
  if (typeof mascotVisualFormIndex === "function") {
    const baseMascotVisualFormIndex = mascotVisualFormIndex;
    mascotVisualFormIndex = function foxVisualFormIndex(def, p = typeof profile !== "undefined" ? profile : null) {
      if (def?.id !== FOX_ID) return baseMascotVisualFormIndex(def, p);
      const forms = typeof mascotFormAssets === "function" ? mascotFormAssets(def) : null;
      if (!forms?.length) return 0;
      const bossActive = typeof state !== "undefined" && state?.special?.boss && state.special.bossCompanionId === FOX_ID && !state.rewarded;
      if (bossActive) return Math.min(forms.length - 1, 4);
      const stage = Math.max(0, Math.min(3, Math.trunc(Number(p?.mascotProgress?.[FOX_ID]?.evolutionStage) || 0)));
      return Math.min(forms.length - 1, stage);
    };
  }

  if (typeof companionPhrase === "function") {
    const baseCompanionPhrase = companionPhrase;
    companionPhrase = function foxRelationshipPhrase(id = profileReady() ? profile.settings?.companion : "", situation = "start") {
      if (String(id) !== FOX_ID || !foxCaptured()) return baseCompanionPhrase(id, situation);
      const tier = DIALOGUE[currentLevel()] || DIALOGUE[1];
      const pool = tier[situation] || tier.start;
      if (!pool?.length) return baseCompanionPhrase(id, situation);
      const index = Math.floor(Math.random() * pool.length);
      const name = typeof companionPlayerName === "function" ? companionPlayerName() : "";
      return name && index === 0 && currentLevel() >= 3 ? `${name}, ${pool[index].charAt(0).toLowerCase()}${pool[index].slice(1)}` : pool[index];
    };
  }

  // Ability charges are attempt-scoped and must survive ordinary Undo. Otherwise
  // the player could rewind and use an active ability infinitely.
  if (typeof restoreHistorySnapshot === "function") {
    const baseRestoreHistorySnapshot = restoreHistorySnapshot;
    restoreHistorySnapshot = function foxAwareRestoreHistorySnapshot(snapshot) {
      const usage = typeof state !== "undefined" ? runAbilityState(state) : null;
      const restored = baseRestoreHistorySnapshot(snapshot);
      if (restored?.run && usage) {
        const restoredUsage = runAbilityState(restored);
        if (restoredUsage?.key === usage.key) {
          restored.foxAbilityState = {
            key: usage.key,
            freeHintUsed: !!usage.freeHintUsed || !!restoredUsage.freeHintUsed,
            detourUsed: !!usage.detourUsed || !!restoredUsage.detourUsed,
            secretPathUsed: !!usage.secretPathUsed || !!restoredUsage.secretPathUsed,
          };
        }
      }
      return restored;
    };
  }

  function recordFoxRun(s) {
    if (!profileReady() || !foxCaptured() || !s?.run || s.failed) return null;
    const levelAtStart = currentLevel();
    if (levelAtStart <= 1 && s.mode !== "regular") return null;
    if (levelAtStart >= 2 && profile.settings?.companion !== FOX_ID) return null;
    if (["tutorial", "challenge", "marathon"].includes(s.mode)) return null;
    const journey = ensureJourney();
    if (!journey) return null;
    const usage = runAbilityState(s) || {};
    const at = now();
    const id = `${at.toString(36)}:${String(s.mode || "")}:${String(s.seed || "")}:${Number(s.level) || 0}:${Number(s.run.moves) || 0}:${Number(s.lastStars) || 0}`.slice(0, 180);
    if (journey.runs.some((run) => run.id === id)) return null;
    const run = {
      id,
      at,
      date: typeof todayKey === "function" ? todayKey() : new Date(at).toISOString().slice(0, 10),
      mode: String(s.mode || "").slice(0, 16),
      level: Math.max(0, Math.trunc(Number(s.level) || 0)),
      stars: Math.max(0, Math.min(3, Math.trunc(Number(s.lastStars) || 0))),
      hints: Math.max(0, Math.trunc(Number(s.run.hints) || 0)),
      undos: Math.max(0, Math.trunc(Number(s.run.undos) || 0)),
      combo: Math.max(0, Math.trunc(Number(s.run.maxCombo) || 0)),
      detour: !!usage.detourUsed,
      secretPath: !!usage.secretPathUsed,
      freeHint: !!usage.freeHintUsed,
    };
    run.bondXp = runXp(run);
    journey.runs.push(run);
    journey.runs = journey.runs.slice(-360);
    return run;
  }

  if (typeof finishLevel === "function") {
    const baseFinishLevel = finishLevel;
    finishLevel = function foxAwareFinishLevel(...args) {
      const eligibleBefore = foxCaptured();
      const alreadyRewarded = !!(typeof state !== "undefined" && state?.rewarded);
      const result = baseFinishLevel.apply(this, args);
      const foxRun = !alreadyRewarded && eligibleBefore && typeof state !== "undefined" && state?.rewarded && !state.failed ? recordFoxRun(state) : null;
      if (foxRun) {
        addFoxAffinityXp(foxRun.bondXp, { notify: true });
        syncFoxProgress({ notify: true });
        if (typeof saveProfile === "function") saveProfile();
        if (typeof save === "function") save({ immediate: true });
        if (typeof scheduleAccountSync === "function") scheduleAccountSync(1200);
      }
      return result;
    };
  }

  function useDetour() {
    if (!abilityUnlocked("fox_detour")) return false;
    const usage = runAbilityState();
    if (!usage || usage.detourUsed) return false;
    if (typeof autoMoveBusy !== "undefined" && autoMoveBusy) return false;
    if (typeof categoryAnimating !== "undefined" && categoryAnimating) return false;
    if (!Array.isArray(history) || !history.length || typeof restoreHistorySnapshot !== "function") {
      if (typeof showToast === "function") showToast("Сейчас обходить нечего");
      return false;
    }
    const previous = history.pop();
    state = restoreHistorySnapshot(previous);
    if (!state) return false;
    const restoredUsage = runAbilityState(state);
    restoredUsage.detourUsed = true;
    if (typeof resetCombo === "function") resetCombo();
    if (typeof playSfx === "function") playSfx("drop", .7);
    if (typeof haptic === "function") haptic([7, 16, 7]);
    if (typeof render === "function") render();
    if (typeof markStateChanged === "function") markStateChanged();
    if (typeof save === "function") save({ immediate: true });
    if (typeof showCompanionBubble === "function") showCompanionBubble("Обошли. Обычную отмену даже не тронули.", 2600);
    if (typeof showToast === "function") showToast("Лис: «Обходной путь» использован");
    syncFoxAbilityDock();
    return true;
  }

  function useSecretPath() {
    if (!abilityUnlocked("fox_secret_path")) return false;
    const usage = runAbilityState();
    if (!usage || usage.secretPathUsed) return false;
    if (typeof findHintMove !== "function" || typeof performDrop !== "function") return false;
    const hint = findHintMove();
    if (!hint?.payload) {
      if (typeof showCompanionBubble === "function") showCompanionBubble("Тропа есть только там, где уже открыт безопасный ход.", 2800);
      if (typeof showToast === "function") showToast("Лис пока не видит готового хода");
      return false;
    }
    const target = document.querySelector(`[data-zone="${hint.zone}"][data-index="${hint.index}"]`);
    if (!target || (typeof canDropTo === "function" && !canDropTo(hint.payload, hint.zone, hint.index))) {
      if (typeof showToast === "function") showToast("Тропа изменилась — попробуй ещё раз");
      return false;
    }
    // Mark the charge before the move: performDrop can synchronously finish the
    // level when this is the final card, and the run recorder must see the use.
    usage.secretPathUsed = true;
    const moved = performDrop(hint.payload, target, { comboEligible: false, comboSource: "fox" });
    if (!moved) { usage.secretPathUsed = false; return false; }
    const after = runAbilityState();
    if (after) after.secretPathUsed = true;
    if (typeof playSfx === "function") playSfx("combo", .72);
    if (typeof haptic === "function") haptic([8, 16, 10]);
    if (typeof showCompanionBubble === "function") showCompanionBubble("Тихо. Я знаю короткую тропу.", 2600);
    if (typeof showToast === "function") showToast("Лис выполнил безопасный ход");
    if (typeof save === "function") save({ immediate: true });
    syncFoxAbilityDock();
    return true;
  }

  // Capture the first standard Hint click. The core handler still performs the
  // validated hint; after it succeeds we refund its counters exactly once.
  document.addEventListener("click", (event) => {
    const button = event.target?.closest?.("#hint");
    if (!button || !abilityUnlocked("fox_sense")) return;
    const usage = runAbilityState();
    if (!usage || usage.freeHintUsed) return;
    const beforeRun = Math.max(0, Number(state?.run?.hints) || 0);
    const beforeProfile = Math.max(0, Number(profile?.stats?.hints) || 0);
    setTimeout(() => {
      if (!profileReady() || typeof state === "undefined" || !state?.run) return;
      const currentUsage = runAbilityState();
      if (!currentUsage || currentUsage.key !== usage.key || currentUsage.freeHintUsed) return;
      if ((Number(state.run.hints) || 0) <= beforeRun) return; // Core rejected the hint.
      state.run.hints = beforeRun;
      if (profile.stats) profile.stats.hints = beforeProfile;
      currentUsage.freeHintUsed = true;
      if (typeof save === "function") save({ immediate: true });
      if (typeof showCompanionBubble === "function") showCompanionBubble("Первую зацепку сегодня считай подарком.", 2600);
      if (typeof showToast === "function") showToast("Лисье чутьё: подсказка не потрачена");
      syncFoxAbilityDock();
    }, 0);
  }, true);

  function ensureFoxAbilityDock() {
    let dock = document.querySelector("#foxAbilityDock");
    if (dock) return dock;
    dock = document.createElement("div");
    dock.id = "foxAbilityDock";
    dock.className = "fox-ability-dock";
    dock.hidden = true;
    dock.innerHTML = `
      <span class="fox-passive" data-fox-passive title="Лисье чутьё"><i>◉</i><b>Чутьё</b></span>
      <button type="button" data-fox-ability="fox_detour"><i>↶</i><span>Обход</span></button>
      <button type="button" data-fox-ability="fox_secret_path"><i>✦</i><span>Тропа</span></button>`;
    document.body.appendChild(dock);
    dock.querySelector('[data-fox-ability="fox_detour"]')?.addEventListener("click", useDetour);
    dock.querySelector('[data-fox-ability="fox_secret_path"]')?.addEventListener("click", useSecretPath);
    return dock;
  }

  function syncFoxAbilityDock() {
    const dock = ensureFoxAbilityDock();
    const visible = foxSelected() && abilityRoundAllowed();
    dock.hidden = !visible;
    if (!visible) return;
    const usage = runAbilityState() || {};
    const passive = dock.querySelector("[data-fox-passive]");
    if (passive) {
      const unlocked = currentLevel() >= ABILITIES.fox_sense.unlockLevel;
      passive.hidden = !unlocked;
      passive.classList.toggle("spent", !!usage.freeHintUsed);
      passive.title = usage.freeHintUsed ? "Лисье чутьё уже сработало в этом раскладе" : ABILITIES.fox_sense.desc;
    }
    for (const id of ["fox_detour", "fox_secret_path"]) {
      const button = dock.querySelector(`[data-fox-ability="${id}"]`);
      if (!button) continue;
      const unlocked = currentLevel() >= ABILITIES[id].unlockLevel;
      const spent = id === "fox_detour" ? !!usage.detourUsed : !!usage.secretPathUsed;
      button.hidden = !unlocked;
      button.disabled = !unlocked || spent;
      button.classList.toggle("spent", spent);
      button.title = spent ? `${ABILITIES[id].name} уже использован в этом раскладе` : ABILITIES[id].desc;
    }
  }

  if (typeof render === "function") {
    const baseRender = render;
    render = function foxAwareRender(...args) {
      const result = baseRender.apply(this, args);
      syncFoxAbilityDock();
      return result;
    };
  }

  function foxLevelProgress() {
    const progress = syncFoxProgress({ notify: false }) || foxRawProgress() || {};
    const level = Math.max(1, Math.min(5, Number(progress.level) || 1));
    if (level >= 5) return { level, value: LEVEL_THRESHOLDS[4], from: LEVEL_THRESHOLDS[4], to: LEVEL_THRESHOLDS[4], ratio: 1, xpReady: true, questPhase: false };
    const from = LEVEL_THRESHOLDS[level - 1] || 0;
    const to = LEVEL_THRESHOLDS[level] || from + 1;
    const value = Math.max(from, Math.min(to, Number(progress.progressXp) || 0));
    const xpReady = value >= to;
    return { level, value, from, to, ratio: Math.max(0, Math.min(1, (value - from) / Math.max(1, to - from))), xpReady, questPhase: xpReady && !!questGateAt(level) };
  }

  function nextLevelRequirements(level, quests) {
    if (level >= 5) return "Максимальный уровень привязанности достигнут.";
    const lp = foxLevelProgress();
    if (!lp.xpReady) return `Сначала полностью заполни шкалу привязанности: ${Math.round(lp.value)}/${lp.to} XP. После этого откроются задания Лиса.`;
    const currentQuests = quests.filter((quest) => quest.level === level);
    const missing = currentQuests.filter((quest) => !quest.done);
    if (missing.length) return `Шкала заполнена. Теперь выполни: ${missing.map((quest) => `«${quest.title}»`).join(" и ")}.`;
    return "Все условия выполнены — уровень привязанности повышается.";
  }

  function foxJourneyCardMarkup() {
    if (!foxCaptured()) return "";
    const progress = syncFoxProgress({ notify: false }) || foxRawProgress() || {};
    const lp = foxLevelProgress();
    const forms = typeof mascotFormAssets === "function" ? mascotFormAssets(FOX_ID) : null;
    const image = typeof companionAsset === "function" ? companionAsset(foxDef()) : "./icons/mascot-fox.svg";
    const completed = completedSet().size;
    return `<section class="hub-section fox-journey-shelf">
      <button class="fox-journey-card" type="button" data-fox-journey-open>
        <span class="fox-journey-image"><img src="${esc(image)}" alt="Хитрый лис"></span>
        <span class="fox-journey-copy"><small>ИСТОРИЯ МАСКОТА</small><b>Хитрый лис</b><em>Уровень ${progress.level || 1}/5 · ${esc(levelName(progress.level || 1))}</em><span class="fox-mini-progress"><i style="width:${lp.ratio * 100}%"></i></span><span>${completed}/${QUESTS.length} заданий · ${Math.min(3, progress.evolutionStage || 0)}/3 эволюции</span></span>
        <i class="fox-journey-arrow">›</i>
      </button>
      ${forms?.length ? `<small class="fox-shelf-note">Форма меняется через личные события, а не автоматически после каждого уровня.</small>` : ""}
    </section>`;
  }

  function foxPageMarkup() {
    const progress = syncFoxProgress({ notify: false }) || foxRawProgress() || {};
    const journey = ensureJourney();
    const runs = journey?.runs || [];
    const quests = QUESTS.map((q) => questState(q, runs));
    const lp = foxLevelProgress();
    const image = typeof companionAsset === "function" ? companionAsset(foxDef()) : "./icons/mascot-fox.svg";
    const developed = Array.isArray(progress.developedTraits) ? progress.developedTraits : [];
    const abilities = Object.values(ABILITIES);
    const quotePool = DIALOGUE[progress.level || 1]?.start || DIALOGUE[1].start;
    const quote = quotePool[(runs.length + progress.level) % quotePool.length];
    const forms = typeof mascotFormAssets === "function" ? mascotFormAssets(FOX_ID) : null;

    const levelDots = Array.from({ length: 5 }, (_, index) => {
      const level = index + 1, active = level <= (progress.level || 1);
      return `<span class="${active ? "active" : ""}" title="${esc(LEVEL_NAMES[level])}"><i>♥</i><small>${level}</small></span>`;
    }).join("");
    const abilityMarkup = abilities.map((ability) => {
      const unlocked = (progress.level || 1) >= ability.unlockLevel;
      return `<article class="fox-ability-card ${unlocked ? "unlocked" : "locked"}"><i>${ability.icon}</i><div><b>${esc(ability.name)}</b><small>${ability.kind === "passive" ? "Пассивная" : "Активная"} · ${unlocked ? "открыта" : `уровень ${ability.unlockLevel}`}</small><p>${esc(ability.desc)}</p></div></article>`;
    }).join("");
    const questMarkup = quests.map((quest) => `<article class="fox-quest ${quest.done ? "done" : quest.active ? "active" : "locked"}"><span>${quest.done ? "✓" : quest.active ? (quest.training ? `T${quest.training}` : "◆") : "🔒"}</span><div><b>${esc(quest.title)}</b><p>${esc(quest.desc)}</p><small>${quest.done ? "Выполнено" : quest.active ? `${quest.value}/${quest.target}` : quest.level < (progress.level || 1) ? "Будет доступно позже" : `Откроется после заполнения шкалы уровня ${quest.level}`}</small></div></article>`).join("");
    const trainingMarkup = TRAINING.map((item) => {
      const done = (progress.trainingLevel || 0) >= item.level;
      return `<article class="fox-training-step ${done ? "done" : ""}"><i>${done ? "✓" : item.level}</i><div><b>${esc(item.title)}</b><p>${esc(item.desc)}</p></div></article>`;
    }).join("");
    const evolutionMarkup = Array.from({ length: 4 }, (_, stage) => {
      const reached = (progress.evolutionStage || 0) >= stage;
      const src = forms?.[stage] || image;
      const label = stage === 0 ? "Начальная форма" : `Эволюция ${["I", "II", "III"][stage - 1]}`;
      return `<span class="fox-evolution-form ${reached ? "reached" : ""}"><img src="${esc(src)}" alt=""><b>${label}</b><small>${reached ? "Открыта" : "Впереди"}</small></span>`;
    }).join("");

    return `<div class="fox-page">
      <div class="fox-page-hero"><img src="${esc(image)}" alt="Хитрый лис"><div><small>МАСКОТ · ЛОВКИЙ СТРАТЕГ</small><h2>Хитрый лис</h2><p>Уровень ${progress.level || 1}/5 · <b>${esc(levelName(progress.level || 1))}</b></p><blockquote>«${esc(quote)}»</blockquote></div></div>
      <div class="fox-friendship-levels">${levelDots}</div>
      <div class="fox-friendship-progress"><div><span>Привязанность</span><b>${Math.round(Math.min(lp.value, lp.to))}/${lp.to} XP</b></div><i><em style="width:${lp.ratio * 100}%"></em></i><small>${esc(nextLevelRequirements(progress.level || 1, quests))}</small></div>

      <section class="fox-page-section"><div class="fox-page-title"><h3>Характер</h3><small>ядро не меняется · до 2 приобретённых черт</small></div><div class="fox-traits"><div><b>Ядро</b>${CORE_TRAITS.map((trait) => `<span>${esc(trait)}</span>`).join("")}</div><div><b>Стал рядом с тобой</b>${developed.length ? developed.map((trait) => `<span class="developed">${esc(trait)}</span>`).join("") : `<small>Первая новая черта появится на 3-м уровне дружбы.</small>`}</div></div></section>
      <section class="fox-page-section"><div class="fox-page-title"><h3>Способности</h3><small>2 активные + 1 пассивная</small></div><div class="fox-abilities">${abilityMarkup}</div><p class="fox-balance-note">Способности Лиса сейчас работают в кампании, дзене и раскладах по картинкам. В ежедневных, дуэлях, марафоне и специальных соревновательных режимах они отключены.</p></section>
      <section class="fox-page-section"><div class="fox-page-title"><h3>Личные задания</h3><small>открываются только после полной шкалы XP</small></div><div class="fox-quests">${questMarkup}</div></section>
      <section class="fox-page-section"><div class="fox-page-title"><h3>Тренировка</h3><small>${Math.min(3, progress.trainingLevel || 0)}/3</small></div><div class="fox-training">${trainingMarkup}</div></section>
      <section class="fox-page-section"><div class="fox-page-title"><h3>Эволюции</h3><small>${Math.min(3, progress.evolutionStage || 0)}/3</small></div><div class="fox-evolution-line">${evolutionMarkup}</div><p class="fox-boss-form-note">Пятая иллюстрация Лиса остаётся его грозной босс-формой из финала главы. Линия дружбы проходит три отдельные эволюции после захвата.</p></section>
    </div>`;
  }

  if (typeof closeCompanionInfoModal === "function") {
    const baseCloseCompanionInfoModal = closeCompanionInfoModal;
    closeCompanionInfoModal = function foxAwareCloseCompanionInfoModal(...args) {
      document.querySelector("#companionInfoModal")?.classList.remove("fox-detail-open");
      return baseCloseCompanionInfoModal.apply(this, args);
    };
  }

  // Keep the generic modal for all mascots; Fox gets the full journey page.
  if (typeof openCompanionInfoModal === "function") {
    const baseOpenCompanionInfoModal = openCompanionInfoModal;
    openCompanionInfoModal = function foxAwareCompanionInfoModal(id) {
      if (String(id) !== FOX_ID || !foxCaptured()) return baseOpenCompanionInfoModal(id);
      const modal = document.querySelector("#companionInfoModal");
      const body = document.querySelector("#companionInfoBody");
      const choose = document.querySelector("#companionInfoChoose");
      if (!modal || !body || !choose) return;
      syncFoxProgress({ notify: false });
      body.innerHTML = foxPageMarkup();
      const selected = profile.settings?.companion === FOX_ID && foxCompanion();
      if (!foxCompanion()) {
        choose.textContent = "Заслужи доверие Лиса";
        choose.disabled = true;
      } else {
        choose.textContent = selected ? "Это твой напарник" : "Выбрать напарником";
        choose.disabled = selected;
        choose.onclick = () => {
          profile.settings ||= {};
          profile.settings.companion = FOX_ID;
          if (typeof saveProfile === "function") saveProfile();
          if (typeof syncGameCompanion === "function") syncGameCompanion();
          syncFoxAbilityDock();
          if (typeof showToast === "function") showToast("Хитрый лис теперь твой напарник");
          if (typeof closeCompanionInfoModal === "function") closeCompanionInfoModal();
          if (typeof renderHub === "function") renderHub();
        };
      }
      modal.classList.add("show", "fox-detail-open");
      modal.setAttribute("aria-hidden", "false");
      modal.onclick = (event) => { if (event.target === modal && typeof closeCompanionInfoModal === "function") closeCompanionInfoModal(); };
      const close = document.querySelector("#companionInfoClose");
      if (close) close.onclick = () => typeof closeCompanionInfoModal === "function" && closeCompanionInfoModal();
    };
  }

  // Add a visible story card even while Fox is only captured and therefore is
  // intentionally absent from the normal selectable-companion carousel.
  if (typeof appearanceTabMarkup === "function") {
    const baseAppearanceTabMarkup = appearanceTabMarkup;
    appearanceTabMarkup = function foxAwareAppearanceTabMarkup(...args) {
      const markup = baseAppearanceTabMarkup.apply(this, args);
      return foxCaptured() ? `${foxJourneyCardMarkup()}${markup}` : markup;
    };
  }

  if (typeof bindHubHandlers === "function") {
    const baseBindHubHandlers = bindHubHandlers;
    bindHubHandlers = function foxAwareBindHubHandlers(...args) {
      const result = baseBindHubHandlers.apply(this, args);
      document.querySelectorAll("[data-fox-journey-open]").forEach((button) => {
        button.onclick = () => openCompanionInfoModal(FOX_ID);
      });
      return result;
    };
  }

  // The home mascot shortcut still leads to Appearance. Once Fox is captured,
  // focus his story card first instead of scrolling past it to the old carousel.
  if (typeof openMascotShelf === "function") {
    openMascotShelf = function foxAwareMascotShelf() {
      if (typeof hubTab !== "undefined") hubTab = "appearance";
      if (typeof renderHub === "function") renderHub();
      requestAnimationFrame(() => setTimeout(() => {
        const target = foxCaptured() ? document.querySelector(".fox-journey-shelf") : document.querySelector(".companion-section");
        target?.scrollIntoView?.({ behavior: "smooth", block: "start" });
      }, 40));
    };
  }

  window.__solivocFoxJourney = Object.freeze({
    sync: (notify = false) => syncFoxProgress({ notify: !!notify }),
    progress: () => foxRawProgress(),
    quests: () => QUESTS.map((quest) => questState(quest)),
    addAffinityXp: (amount, notify = false) => addFoxAffinityXp(amount, { notify: !!notify }),
    affinityTarget: (level) => affinityTarget(level),
    thresholds: LEVEL_THRESHOLDS,
    useDetour,
    useSecretPath,
  });

  queueMicrotask(() => {
    grandfatherFoxOwner();
    syncFoxProgress({ notify: false });
    syncFoxAbilityDock();
  });
})();
