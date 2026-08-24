/* Game constants and progression definitions. */
let BANK = [];
const SAVE_KEY = "worditaire-state-v10";
const SAVE_BACKUP_KEY = "worditaire-state-v10-backup";
const OLD_SAVE_KEY = "assoc-klondike-v7";
const PROFILE_KEY = "worditaire-profile-v7";
const PREV_PROFILE_KEY = "worditaire-profile-v6";
const LEGACY_PROFILE_KEYS = ["worditaire-profile-v5", "worditaire-profile-v4", "worditaire-profile-v3", "worditaire-profile-v2"];
const ANALYTICS_KEY = "worditaire-analytics-v1";
const RECENT_KEY = "assoc-recent-categories-v2";
const MAX_CARD_WORD_LEN = 12,
  MAX_CARD_TITLE_LEN = 24;

function ruPlural(value, one, few, many = few) {
  const n = Math.abs(Math.trunc(Number(value) || 0)), mod100 = n % 100, mod10 = n % 10;
  if (mod100 >= 11 && mod100 <= 14) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}
function ruCount(value, one, few, many = few) {
  const n = Math.max(0, Math.trunc(Number(value) || 0));
  return `${n} ${ruPlural(n, one, few, many)}`;
}

// Unified folklore rarity language. Technical IDs stay stable for saves/API compatibility.
const RARITY_DEFS = Object.freeze({
  common: Object.freeze({ id: "common", weight: 1, color: "#a9b0bb", labels: Object.freeze({ m:"Простой", f:"Простая", n:"Простое", plural:"Простые" }) }),
  uncommon: Object.freeze({ id: "uncommon", weight: 7, color: "#6fbd91", labels: Object.freeze({ m:"Дивный", f:"Дивная", n:"Дивное", plural:"Дивные" }) }),
  rare: Object.freeze({ id: "rare", weight: 49, color: "#6f9fc5", labels: Object.freeze({ m:"Вещий", f:"Вещая", n:"Вещее", plural:"Вещие" }) }),
  epic: Object.freeze({ id: "epic", weight: 343, color: "#9476bd", labels: Object.freeze({ m:"Заповедный", f:"Заповедная", n:"Заповедное", plural:"Заповедные" }) }),
  legendary: Object.freeze({ id: "legendary", weight: 2401, color: "#c9aa62", labels: Object.freeze({ m:"Сокровенный", f:"Сокровенная", n:"Сокровенное", plural:"Сокровенные" }) }),
});
const RARITY_IDS = Object.freeze(Object.keys(RARITY_DEFS));
function rarityDef(id) { return RARITY_DEFS[String(id || "common")] || RARITY_DEFS.common; }
function rarityWeight(id) { return rarityDef(id).weight; }
function rarityLabel(id, gender = "n") { const labels = rarityDef(id).labels; return labels[gender] || labels.n; }
function collectibleSource(type, label, extra = {}) { return Object.freeze({ type:String(type || "progression"), label:String(label || "Прогресс"), ...extra }); }

const APP_ICON_DEFS = Object.freeze([
  { id: "classic", name: "Классическая", preview: "✦", manifest: "./manifest.webmanifest", apple: "./icons/icon-192.png", favicon: "./icons/icon.svg" },
  { id: "owl", name: "Мудрая сова", preview: "🦉", manifest: "./manifest-owl.webmanifest", apple: "./icons/icon-owl-192.png", favicon: "./icons/icon-owl.svg" },
  { id: "cat", name: "Кот-учёный", preview: "🐱", manifest: "./manifest-cat.webmanifest", apple: "./icons/icon-cat-192.png", favicon: "./icons/icon-cat.svg" },
]);
function appIconDef(id) { return APP_ICON_DEFS.find((x) => x.id === id) || APP_ICON_DEFS[0]; }

const ENTITY_TYPES = Object.freeze(["mascot", "elemental", "god", "special"]);
const MASCOT_PROGRESS_VERSION = 1;
const ENTITY_STATUS_ORDER = Object.freeze({ locked: 0, encountered: 1, captured: 2, companion: 3, mastered: 4 });
const GOD_STATUS_ORDER = Object.freeze({ locked: 0, encountered: 1, recognized: 2, worshipped: 3, exalted: 4 });
const MILESTONE_STATUS_ORDER = Object.freeze({ locked: 0, available: 1, completed: 2 });
const RETIRED_COMPANION_IDS = Object.freeze(["gandalf", "clip"]);

const ENTITY_DEFS = Object.freeze([
  { id: "owl", type: "mascot", name: "Мудрая сова", image: "./icons/mascot-owl.svg", role: "Научный наставник", unlockLabel: "За регистрацию аккаунта", starter: true, maxLevel: 5, maxEvolutionStage: 3, coreTraits: ["мудрая", "спокойная", "любознательная"], personality: "спокойная, любознательная и немного профессорская", lore: "Мудрая сова любит объяснять сложное простыми словами. Она подмечает закономерности, делится научными фактами и всегда подталкивает к вдумчивой победе." },
  { id: "cat", type: "mascot", name: "Кот-учёный", image: "./icons/mascot-cat.svg", role: "Весёлый напарник", unlockLabel: "За регистрацию аккаунта", starter: true, maxLevel: 5, maxEvolutionStage: 3, coreTraits: ["мудрый", "ироничный", "тёплый"], personality: "ироничный, тёплый и очень харизматичный", lore: "Кот-учёный обожает похвалу, каламбуры и красивые победы. Он встречает успех мягкой самоиронией и превращает каждый уровень в маленькое приключение." },
  { id: "fox", type: "mascot", name: "Хитрый лис", image: "./icons/mascot-fox.svg", emoji: "🦊", role: "Ловкий стратег", unlockChapter: 3, bossReward: true, maxLevel: 5, maxEvolutionStage: 3, coreTraits: ["хитрый", "быстрый", "ехидный"], rewardText: "Приручён после финала главы 3", personality: "быстрый, остроумный и чуть ехидный", lore: "Хитрый лис любит запутывать соперника и проверять, умеешь ли ты замечать тонкие связи. После победы он признаёт умного игрока своим." },
  { id: "bear", type: "mascot", name: "Сильный медведь", image: "./icons/mascot-bear.svg", emoji: "🐻", role: "Надёжный защитник", unlockChapter: 6, bossReward: true, maxLevel: 5, maxEvolutionStage: 3, coreTraits: ["спокойный", "сильный", "надёжный"], rewardText: "Приручён после финала главы 6", personality: "спокойный, основательный и уверенный", lore: "Сильный медведь не любит суету. Он уважает выдержку, точность и победы, которые добыты без паники." },
  { id: "raven", type: "mascot", name: "Умный ворон", image: "./icons/mascot-raven.svg", emoji: "🐦‍⬛", role: "Колкий умник", unlockChapter: 9, bossReward: true, maxLevel: 5, maxEvolutionStage: 3, coreTraits: ["хитрый", "гордый", "язвительный"], rewardText: "Приручён после финала главы 9", personality: "язвительный, наблюдательный и очень сообразительный", lore: "Умный ворон замечает ошибки раньше всех и обожает острые фразы. Но ещё больше он уважает игрока, который умеет удивлять." },
  { id: "wolf", type: "mascot", name: "Серый волк", image: "./icons/mascot-wolf.svg", emoji: "🐺", role: "Упрямый следопыт", unlockChapter: 12, bossReward: true, maxLevel: 5, maxEvolutionStage: 3, coreTraits: ["собранный", "упрямый", "прямой"], rewardText: "Приручён после финала главы 12", personality: "собранный, настойчивый и прямой", lore: "Серый волк идёт по следу до конца. Он любит тех, кто не сдаётся после первой же сложной комбинации." },
  { id: "tiger", type: "mascot", name: "Грозный тигр", image: "./icons/mascot-tiger.svg", emoji: "🐯", role: "Гордый соперник", unlockChapter: 15, bossReward: true, maxLevel: 5, maxEvolutionStage: 3, coreTraits: ["гордый", "смелый", "соревновательный"], rewardText: "Приручён после финала главы 15", personality: "эффектный, громкий и соревновательный", lore: "Грозный тигр появляется там, где нужен вызов посерьёзнее. Он уважает только тех, кто не пугается давления." },
  { id: "panda", type: "mascot", name: "Спокойная панда", image: "./icons/mascot-panda.svg", emoji: "🐼", role: "Невозмутимый тактик", unlockChapter: 18, bossReward: true, maxLevel: 5, maxEvolutionStage: 3, coreTraits: ["спокойная", "мягкая", "сосредоточенная"], rewardText: "Приручена после финала главы 18", personality: "неторопливая, мягкая и сосредоточенная", lore: "Спокойная панда напоминает: не каждая победа должна быть шумной. Иногда лучший ход — самый тихий и точный." },
  { id: "frog", type: "mascot", name: "Ловкая лягушка", image: "./icons/mascot-frog.svg", emoji: "🐸", role: "Зелёная выдумщица", unlockChapter: 21, bossReward: true, maxLevel: 5, maxEvolutionStage: 3, coreTraits: ["весёлая", "ловкая", "непредсказуемая"], rewardText: "Приручена после финала главы 21", personality: "смешливая, резкая и непредсказуемая", lore: "Ловкая лягушка любит неожиданные решения и нестандартные ассоциации. С ней игра всегда становится чуть веселее." },
  { id: "octopus", type: "mascot", name: "Умный осьминог", image: "./icons/mascot-octopus.svg", emoji: "🐙", role: "Мастер сложных ходов", unlockChapter: 24, bossReward: true, maxLevel: 5, maxEvolutionStage: 3, coreTraits: ["умный", "спокойный", "системный"], rewardText: "Приручён после финала главы 24", personality: "спокойный, системный и многозадачный", lore: "Умный осьминог умеет держать в голове сразу несколько вариантов. Он ценит порядок мысли и длинные цепочки верных решений." },
  {
    id: "stone-elemental", type: "elemental", name: "Каменный элементаль", emoji: "🪨", role: "Древняя стихия", companion: true, selectable: false,
    milestoneLevel: 100, milestoneActive: true, maxLevel: 7, maxEvolutionStage: 4, coreTraits: ["невозмутимый", "упрямый", "надёжный"],
    rewardText: "Побеждён на уровне 100", personality: "невозмутимый, упрямый и надёжный",
    lore: "В абсолютной форме Каменный элементаль похож на ожившую гору. После поражения его сила схлопывается до маленького камня, которому ещё предстоит заново пройти путь к абсолютной форме.",
    bossTaunts: ["Гора не спешит. И всё равно переживает путника.", "Попробуй сдвинуть то, что стояло здесь задолго до тебя.", "Камень помнит каждый удар. А ты помнишь каждый ход?"],
  },
  {
    id: "god-1000", type: "god", name: "Неизвестный бог", emoji: "✦", role: "Порог Пантеона", companion: false,
    milestoneLevel: 1000, milestoneActive: false, maxLevel: 10, placeholder: true,
    lore: "Место первого божественного испытания зарезервировано на тысячном уровне. Сам бог будет раскрыт отдельным обновлением.",
  },
  { id: "birthday", type: "special", name: "Праздничная капибара", image: "./icons/mascot-birthday.svg", role: "Именинный маскот", unlockLabel: "Открывается в день рождения", maxLevel: 5, maxEvolutionStage: 0, coreTraits: ["добрая", "уютная", "праздничная"], rewardText: "Открыта в день рождения", personality: "очень доброжелательная, уютная и праздничная", lore: "Праздничная капибара приходит только на день рождения игрока. Она приносит поздравления, неделю бонусов и напоминает, что повод порадовать себя тоже важен." },
]);

const COMPANION_DEFS = Object.freeze(ENTITY_DEFS.filter((x) => x.companion !== false && x.selectable !== false));
function entityDef(id) { return ENTITY_DEFS.find((x) => x.id === id) || null; }
function companionDef(id) { return entityDef(id) || ENTITY_DEFS[0]; }
function entityStatusRank(status) { return ENTITY_STATUS_ORDER[String(status || "locked")] ?? 0; }
function godStatusRank(status) { return GOD_STATUS_ORDER[String(status || "locked")] ?? 0; }
function milestoneStatusRank(status) { return MILESTONE_STATUS_ORDER[String(status || "locked")] ?? 0; }
function higherStatus(a, b, rankFn = entityStatusRank) { return rankFn(a) >= rankFn(b) ? a : b; }
function entityCanBeSelected(def) { return !!def && def.companion !== false && def.selectable !== false && def.type !== "god"; }
function cleanProgressId(value) { return String(value || "").trim().replace(/[^a-zA-Z0-9:_-]/g, "").slice(0, 64); }
function cleanProgressIdArray(value, limit = 100) {
  const out = [];
  for (const raw of Array.isArray(value) ? value : []) {
    const id = cleanProgressId(raw);
    if (id && !out.includes(id)) out.push(id);
    if (out.length >= limit) break;
  }
  return out;
}
function cleanTraits(value) {
  const out = [];
  for (const raw of Array.isArray(value) ? value : []) {
    const trait = String(raw || "").trim().slice(0, 32);
    if (trait && !out.includes(trait)) out.push(trait);
    if (out.length >= 2) break;
  }
  return out;
}
function cleanAbilityLevels(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out = {};
  for (const [rawId, rawLevel] of Object.entries(value)) {
    const id = cleanProgressId(rawId);
    if (!id) continue;
    out[id] = Math.max(0, Math.min(10, Math.trunc(Number(rawLevel) || 0)));
  }
  return out;
}
function cleanAbilityLoadout(value) {
  const raw = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    active: cleanProgressIdArray(raw.active, 2),
    passive: cleanProgressId(raw.passive),
    updatedAt: Math.max(0, Number(raw.updatedAt) || 0),
  };
}
function defaultMascotProgress(defOrId) {
  const def = typeof defOrId === "string" ? entityDef(defOrId) : defOrId;
  return {
    version: MASCOT_PROGRESS_VERSION,
    type: def?.type || "mascot",
    status: "locked",
    level: 0,
    progressXp: 0,
    evolutionStage: 0,
    evolutionBranch: "",
    evolutionUpdatedAt: 0,
    developedTraits: [],
    traitsUpdatedAt: 0,
    abilities: {},
    equippedAbilities: { active: [], passive: "", updatedAt: 0 },
    trainingLevel: 0,
    completedQuests: [],
    cosmeticsUnlocked: [],
    capturedAt: 0,
    updatedAt: 0,
  };
}
function normalizeMascotProgressEntry(def, value = {}) {
  const raw = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const base = defaultMascotProgress(def);
  const maxLevel = Math.max(1, Number(def?.maxLevel) || (def?.type === "elemental" ? 7 : 5));
  const maxEvolution = Math.max(0, Number(def?.maxEvolutionStage) || 0);
  const status = Object.prototype.hasOwnProperty.call(ENTITY_STATUS_ORDER, raw.status) ? raw.status : "locked";
  return {
    ...base,
    version: MASCOT_PROGRESS_VERSION,
    type: def?.type || base.type,
    status,
    level: Math.max(0, Math.min(maxLevel, Math.trunc(Number(raw.level) || 0))),
    progressXp: Math.max(0, Math.trunc(Number(raw.progressXp) || 0)),
    evolutionStage: Math.max(0, Math.min(maxEvolution, Math.trunc(Number(raw.evolutionStage) || 0))),
    evolutionBranch: cleanProgressId(raw.evolutionBranch),
    evolutionUpdatedAt: Math.max(0, Number(raw.evolutionUpdatedAt) || 0),
    developedTraits: cleanTraits(raw.developedTraits),
    traitsUpdatedAt: Math.max(0, Number(raw.traitsUpdatedAt) || 0),
    abilities: cleanAbilityLevels(raw.abilities),
    equippedAbilities: cleanAbilityLoadout(raw.equippedAbilities),
    trainingLevel: Math.max(0, Math.min(3, Math.trunc(Number(raw.trainingLevel) || 0))),
    completedQuests: cleanProgressIdArray(raw.completedQuests, 200),
    cosmeticsUnlocked: cleanProgressIdArray(raw.cosmeticsUnlocked, 100),
    capturedAt: Math.max(0, Number(raw.capturedAt) || 0),
    updatedAt: Math.max(0, Number(raw.updatedAt) || 0),
  };
}
function defaultGodProgress(defOrId) {
  const def = typeof defOrId === "string" ? entityDef(defOrId) : defOrId;
  return {
    version: 1,
    type: "god",
    status: "locked",
    favorLevel: 0,
    favorXp: 0,
    gracesUnlocked: [],
    activeGraceIds: [],
    loadoutUpdatedAt: 0,
    attention: 0,
    attentionUpdatedAt: 0,
    offerings: {},
    updatedAt: 0,
    entityId: def?.id || "",
  };
}
function normalizeGodProgressEntry(def, value = {}) {
  const raw = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const status = Object.prototype.hasOwnProperty.call(GOD_STATUS_ORDER, raw.status) ? raw.status : "locked";
  const offerings = {};
  if (raw.offerings && typeof raw.offerings === "object" && !Array.isArray(raw.offerings)) {
    for (const [key, count] of Object.entries(raw.offerings)) {
      const id = cleanProgressId(key);
      if (id) offerings[id] = Math.max(0, Math.trunc(Number(count) || 0));
    }
  }
  return {
    ...defaultGodProgress(def),
    status,
    favorLevel: Math.max(0, Math.min(10, Math.trunc(Number(raw.favorLevel) || 0))),
    favorXp: Math.max(0, Math.trunc(Number(raw.favorXp) || 0)),
    gracesUnlocked: cleanProgressIdArray(raw.gracesUnlocked, 30),
    activeGraceIds: cleanProgressIdArray(raw.activeGraceIds, 3),
    loadoutUpdatedAt: Math.max(0, Number(raw.loadoutUpdatedAt) || 0),
    attention: Math.max(0, Number(raw.attention) || 0),
    attentionUpdatedAt: Math.max(0, Number(raw.attentionUpdatedAt) || 0),
    offerings,
    updatedAt: Math.max(0, Number(raw.updatedAt) || 0),
  };
}
function preserveUnknownProgress(localValue, cloudValue) {
  const local = localValue && typeof localValue === "object" && !Array.isArray(localValue) ? localValue : null;
  const cloud = cloudValue && typeof cloudValue === "object" && !Array.isArray(cloudValue) ? cloudValue : null;
  if (!local) return cloud ? { ...cloud } : null;
  if (!cloud) return { ...local };
  const localUpdated = Math.max(0, Number(local.updatedAt) || 0);
  const cloudUpdated = Math.max(0, Number(cloud.updatedAt) || 0);
  return { ...(cloudUpdated >= localUpdated ? local : cloud), ...(cloudUpdated >= localUpdated ? cloud : local) };
}
function newerSnapshot(local, cloud, timestampKey) {
  const lt = Math.max(0, Number(local?.[timestampKey]) || 0), ct = Math.max(0, Number(cloud?.[timestampKey]) || 0);
  if (lt > ct) return local;
  return cloud || local || {};
}
function unionProgressIds(a, b, limit) { return cleanProgressIdArray([...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])], limit); }
function mergeMascotProgressEntry(def, localValue, cloudValue) {
  const local = normalizeMascotProgressEntry(def, localValue), cloud = normalizeMascotProgressEntry(def, cloudValue);
  const traitSource = newerSnapshot(local, cloud, "traitsUpdatedAt");
  const loadoutSource = newerSnapshot(local.equippedAbilities, cloud.equippedAbilities, "updatedAt");
  const evolutionSource = newerSnapshot(local, cloud, "evolutionUpdatedAt");
  const abilities = { ...local.abilities };
  for (const [id, level] of Object.entries(cloud.abilities)) abilities[id] = Math.max(abilities[id] || 0, level || 0);
  const captured = [local.capturedAt, cloud.capturedAt].filter((x) => x > 0);
  return normalizeMascotProgressEntry(def, {
    ...local,
    ...cloud,
    status: higherStatus(local.status, cloud.status),
    level: Math.max(local.level, cloud.level),
    progressXp: Math.max(local.progressXp, cloud.progressXp),
    evolutionStage: Math.max(local.evolutionStage, cloud.evolutionStage),
    evolutionBranch: evolutionSource?.evolutionBranch || "",
    evolutionUpdatedAt: Math.max(local.evolutionUpdatedAt, cloud.evolutionUpdatedAt),
    developedTraits: cleanTraits(traitSource?.developedTraits),
    traitsUpdatedAt: Math.max(local.traitsUpdatedAt, cloud.traitsUpdatedAt),
    abilities,
    equippedAbilities: cleanAbilityLoadout(loadoutSource),
    trainingLevel: Math.max(local.trainingLevel, cloud.trainingLevel),
    completedQuests: unionProgressIds(local.completedQuests, cloud.completedQuests, 200),
    cosmeticsUnlocked: unionProgressIds(local.cosmeticsUnlocked, cloud.cosmeticsUnlocked, 100),
    capturedAt: captured.length ? Math.min(...captured) : 0,
    updatedAt: Math.max(local.updatedAt, cloud.updatedAt),
  });
}
function mergeMascotProgressSnapshots(localValue, cloudValue) {
  const local = localValue && typeof localValue === "object" && !Array.isArray(localValue) ? localValue : {};
  const cloud = cloudValue && typeof cloudValue === "object" && !Array.isArray(cloudValue) ? cloudValue : {};
  const out = {};
  for (const id of new Set([...Object.keys(local), ...Object.keys(cloud)])) {
    const def = entityDef(id);
    if (!def) {
      const preserved = preserveUnknownProgress(local[id], cloud[id]);
      if (preserved) out[id] = preserved;
      continue;
    }
    if (def.type === "god") continue;
    out[id] = mergeMascotProgressEntry(def, local[id], cloud[id]);
  }
  return out;
}
function mergeGodProgressSnapshots(localValue, cloudValue) {
  const local = localValue && typeof localValue === "object" && !Array.isArray(localValue) ? localValue : {};
  const cloud = cloudValue && typeof cloudValue === "object" && !Array.isArray(cloudValue) ? cloudValue : {};
  const out = {};
  for (const id of new Set([...Object.keys(local), ...Object.keys(cloud)])) {
    const def = entityDef(id);
    if (!def) {
      const preserved = preserveUnknownProgress(local[id], cloud[id]);
      if (preserved) out[id] = preserved;
      continue;
    }
    if (def.type !== "god") continue;
    const a = normalizeGodProgressEntry(def, local[id]), b = normalizeGodProgressEntry(def, cloud[id]);
    const loadoutSource = newerSnapshot(a, b, "loadoutUpdatedAt");
    const attentionSource = newerSnapshot(a, b, "attentionUpdatedAt");
    const offerings = { ...a.offerings };
    for (const [key, count] of Object.entries(b.offerings)) offerings[key] = Math.max(offerings[key] || 0, count || 0);
    out[id] = normalizeGodProgressEntry(def, {
      ...a, ...b,
      status: higherStatus(a.status, b.status, godStatusRank),
      favorLevel: Math.max(a.favorLevel, b.favorLevel),
      favorXp: Math.max(a.favorXp, b.favorXp),
      gracesUnlocked: unionProgressIds(a.gracesUnlocked, b.gracesUnlocked, 30),
      activeGraceIds: cleanProgressIdArray(loadoutSource?.activeGraceIds, 3),
      loadoutUpdatedAt: Math.max(a.loadoutUpdatedAt, b.loadoutUpdatedAt),
      attention: Math.max(0, Number(attentionSource?.attention) || 0),
      attentionUpdatedAt: Math.max(a.attentionUpdatedAt, b.attentionUpdatedAt),
      offerings,
      updatedAt: Math.max(a.updatedAt, b.updatedAt),
    });
  }
  return out;
}
function normalizeMilestoneEntry(level, value = {}) {
  const raw = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const type = ["elemental", "god"].includes(raw.type) ? raw.type : progressionMilestoneType(level);
  const status = Object.prototype.hasOwnProperty.call(MILESTONE_STATUS_ORDER, raw.status) ? raw.status : "locked";
  return { type, entityId: cleanProgressId(raw.entityId), status, updatedAt: Math.max(0, Number(raw.updatedAt) || 0) };
}
function mergeProgressionMilestonesSnapshots(localValue, cloudValue) {
  const local = localValue && typeof localValue === "object" && !Array.isArray(localValue) ? localValue : {};
  const cloud = cloudValue && typeof cloudValue === "object" && !Array.isArray(cloudValue) ? cloudValue : {};
  const out = {};
  for (const key of new Set([...Object.keys(local), ...Object.keys(cloud)])) {
    const level = Math.max(0, Math.trunc(Number(key) || 0));
    if (!level) continue;
    const a = normalizeMilestoneEntry(level, local[key]), b = normalizeMilestoneEntry(level, cloud[key]);
    out[level] = {
      type: b.type || a.type || progressionMilestoneType(level),
      entityId: b.entityId || a.entityId || milestoneEntityDefinition(level)?.id || "",
      status: higherStatus(a.status, b.status, milestoneStatusRank),
      updatedAt: Math.max(a.updatedAt, b.updatedAt),
    };
  }
  return out;
}
function progressionMilestoneType(level) {
  const n = Math.max(0, Math.trunc(Number(level) || 0));
  if (n > 0 && n % 1000 === 0) return "god";
  if (n > 0 && n % 100 === 0) return "elemental";
  return "";
}
function milestoneEntityDefinition(level) { return ENTITY_DEFS.find((x) => x.milestoneLevel === Number(level)) || null; }
function progressionMilestoneForLevel(level) {
  const type = progressionMilestoneType(level);
  if (!type) return null;
  const definition = milestoneEntityDefinition(level);
  const entity = definition && definition.milestoneActive !== false ? definition : null;
  return { level: Number(level), type, entity, reserved: !entity };
}
function markMilestone(p, level, status, entityId = "") {
  if (!p || !level) return null;
  p.progressionMilestones ||= {};
  const current = normalizeMilestoneEntry(level, p.progressionMilestones[level]);
  const nextStatus = higherStatus(current.status, status, milestoneStatusRank);
  p.progressionMilestones[level] = {
    type: current.type || progressionMilestoneType(level),
    entityId: cleanProgressId(entityId) || current.entityId || milestoneEntityDefinition(level)?.id || "",
    status: nextStatus,
    updatedAt: nextStatus !== current.status ? Date.now() : current.updatedAt,
  };
  return p.progressionMilestones[level];
}
function migrateMascotProgress(p = profile) {
  if (!p || typeof p !== "object") return p;
  p.mascotProgress = p.mascotProgress && typeof p.mascotProgress === "object" && !Array.isArray(p.mascotProgress) ? p.mascotProgress : {};
  p.godProgress = p.godProgress && typeof p.godProgress === "object" && !Array.isArray(p.godProgress) ? p.godProgress : {};
  p.progressionMilestones = p.progressionMilestones && typeof p.progressionMilestones === "object" && !Array.isArray(p.progressionMilestones) ? p.progressionMilestones : {};
  p.retiredCompanionRewards = p.retiredCompanionRewards && typeof p.retiredCompanionRewards === "object" && !Array.isArray(p.retiredCompanionRewards) ? p.retiredCompanionRewards : {};

  const legacyUnlocked = Array.isArray(p.companionsUnlocked) ? [...new Set(p.companionsUnlocked.map(String))] : [];
  for (const retiredId of RETIRED_COMPANION_IDS) if (legacyUnlocked.includes(retiredId)) p.retiredCompanionRewards[retiredId] = true;

  const normalized = {};
  for (const [id, value] of Object.entries(p.mascotProgress)) {
    if (!entityDef(id) && value && typeof value === "object" && !Array.isArray(value)) normalized[id] = { ...value };
  }
  for (const def of ENTITY_DEFS.filter((x) => x.type !== "god")) {
    let progress = normalizeMascotProgressEntry(def, p.mascotProgress[def.id]);
    if (legacyUnlocked.includes(def.id) && entityCanBeSelected(def)) {
      progress.status = higherStatus(progress.status, "companion");
      progress.level = Math.max(progress.level, def.type === "mascot" ? 2 : 1);
    }
    if (entityStatusRank(progress.status) > 0 || legacyUnlocked.includes(def.id)) normalized[def.id] = progress;
  }
  p.mascotProgress = normalized;

  const gods = {};
  for (const [id, value] of Object.entries(p.godProgress)) {
    if (!entityDef(id) && value && typeof value === "object" && !Array.isArray(value)) gods[id] = { ...value };
  }
  for (const def of ENTITY_DEFS.filter((x) => x.type === "god")) {
    const progress = normalizeGodProgressEntry(def, p.godProgress[def.id]);
    if (godStatusRank(progress.status) > 0 || progress.favorLevel > 0 || progress.favorXp > 0) gods[def.id] = progress;
  }
  p.godProgress = gods;

  p.companionsUnlocked = legacyUnlocked.filter((id) => {
    const def = entityDef(id);
    return entityCanBeSelected(def) && !RETIRED_COMPANION_IDS.includes(id);
  });
  for (const [id, progress] of Object.entries(p.mascotProgress)) {
    const def = entityDef(id);
    if (entityCanBeSelected(def) && entityStatusRank(progress.status) >= entityStatusRank("companion") && !p.companionsUnlocked.includes(id)) p.companionsUnlocked.push(id);
  }

  const completedThrough = Math.max(0, Math.trunc(Number(p.currentLevel || 1) - 1), Math.trunc(Number(p.stats?.levelsCompleted) || 0));
  for (let level = 100; level <= completedThrough; level += 100) {
    const type = progressionMilestoneType(level);
    if (type) markMilestone(p, level, "available", milestoneEntityDefinition(level)?.id || "");
  }
  for (const def of ENTITY_DEFS.filter((x) => x.milestoneLevel)) {
    if (def.type === "god") {
      const gp = p.godProgress[def.id];
      if (gp && godStatusRank(gp.status) >= godStatusRank("recognized")) markMilestone(p, def.milestoneLevel, "completed", def.id);
    } else {
      const mp = p.mascotProgress[def.id];
      if (mp && entityStatusRank(mp.status) >= entityStatusRank("captured")) markMilestone(p, def.milestoneLevel, "completed", def.id);
    }
  }
  p.mascotProgressVersion = MASCOT_PROGRESS_VERSION;
  if (RETIRED_COMPANION_IDS.includes(p.settings?.companion) || !entityCanBeSelected(entityDef(p.settings?.companion))) {
    p.settings ||= {};
    p.settings.companion = "";
  }
  return p;
}
function companionUnlocked(def, p = profile) {
  const entity = typeof def === "string" ? entityDef(def) : def;
  if (!entityCanBeSelected(entity)) return false;
  const unlocked = new Set(Array.isArray(p?.companionsUnlocked) ? p.companionsUnlocked : []);
  if (unlocked.has(entity.id)) return true;
  return entityStatusRank(p?.mascotProgress?.[entity.id]?.status) >= entityStatusRank("companion");
}
function availableCompanions(p = profile) { return COMPANION_DEFS.filter((x) => entityCanBeSelected(x) && companionUnlocked(x, p)); }
function companionUnlockLabel(def) {
  if (def?.unlockLabel) return def.unlockLabel;
  if (def?.milestoneLevel) return `После испытания на уровне ${def.milestoneLevel}`;
  if (def?.unlockChapter) return `После финала главы ${def.unlockChapter}`;
  return "Открывается позже";
}
function companionChapterProgress(p = profile) {
  const recorded = Math.max(0, Math.trunc(Number(p?.stats?.chapterFinalsCompleted) || 0));
  const through = Math.max(0, Math.trunc(Number(p?.currentLevel || 1) - 1));
  const byLevel = typeof CHAPTER_SIZE !== "undefined" && CHAPTER_SIZE > 0 ? Math.floor(through / CHAPTER_SIZE) : 0;
  return Math.max(recorded, byLevel);
}
function syncBossCompanionsFromProgress({ notify = false } = {}) {
  const chapters = companionChapterProgress(profile);
  let fresh = 0;
  for (const def of COMPANION_DEFS.filter((x) => x.type === "mascot" && x.bossReward && x.unlockChapter && chapters >= x.unlockChapter)) {
    const before = companionUnlocked(def, profile);
    unlockCompanion(def.id, { notify: !before && notify, select: false });
    if (!before) fresh++;
  }
  ensureCompanionSelection(profile);
  return fresh;
}
function syncAchievementCompanions({ notify = false } = {}) {
  let fresh = 0;
  for (const def of COMPANION_DEFS.filter((x) => x.achievementId && profile?.achievements?.includes(x.achievementId))) {
    const before = companionUnlocked(def, profile);
    unlockCompanion(def.id, { notify: !before && notify, select: false });
    if (!before) fresh++;
  }
  ensureCompanionSelection(profile);
  return fresh;
}
function ensureCompanionSelection(p = profile) {
  if (!p?.settings) return null;
  const current = entityDef(p.settings.companion);
  if (current && companionUnlocked(current, p)) return current;
  const fallback = availableCompanions(p)[0] || null;
  p.settings.companion = fallback?.id || "";
  return fallback;
}
function emojiSvgDataUri(emoji = "✨") {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="128" height="128" rx="28" fill="none"/><text x="50%" y="56%" text-anchor="middle" dominant-baseline="middle" font-size="84">${emoji}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
function companionAsset(def) { return def?.image || emojiSvgDataUri(def?.emoji || "✨"); }
function unlockCompanion(id, { notify = true, select = false } = {}) {
  const def = entityDef(id);
  if (!def) return null;
  profile.mascotProgress ||= {};
  profile.godProgress ||= {};
  profile.companionsUnlocked ||= [];
  const now = Date.now();

  if (def.type === "god") {
    const progress = normalizeGodProgressEntry(def, profile.godProgress[def.id]);
    progress.status = higherStatus(progress.status, "recognized", godStatusRank);
    progress.favorLevel = Math.max(progress.favorLevel, 1);
    progress.updatedAt = now;
    profile.godProgress[def.id] = progress;
    if (def.milestoneLevel) markMilestone(profile, def.milestoneLevel, "completed", def.id);
    return def;
  }

  const progress = normalizeMascotProgressEntry(def, profile.mascotProgress[def.id]);
  const selectable = entityCanBeSelected(def);
  const targetStatus = selectable ? "companion" : "captured";
  const wasStatus = progress.status;
  progress.status = higherStatus(progress.status, targetStatus);
  progress.level = Math.max(progress.level, 1);
  progress.capturedAt ||= now;
  progress.updatedAt = now;
  profile.mascotProgress[def.id] = progress;
  if (def.milestoneLevel) markMilestone(profile, def.milestoneLevel, "completed", def.id);

  if (selectable && !profile.companionsUnlocked.includes(def.id)) {
    profile.companionsUnlocked.push(def.id);
    if (notify && typeof queueAchievementNotifications === "function") queueAchievementNotifications([{ icon: def.emoji || "🦉", title: `Новый маскот: ${def.name}`, desc: def.rewardText || "Напарник уже доступен в разделе «Стиль»" }]);
  } else if (!selectable && wasStatus !== progress.status && notify && typeof queueAchievementNotifications === "function") {
    queueAchievementNotifications([{ icon: def.emoji || "◆", title: `${def.name} повержен`, desc: def.rewardText || "Рубеж пройден" }]);
  }
  if (selectable && (select || !companionUnlocked(entityDef(profile.settings?.companion), profile))) {
    profile.settings ||= {};
    profile.settings.companion = def.id;
  }
  return def;
}
function grantStarterCompanions({ notify = true } = {}) {
  let fresh = false;
  for (const def of COMPANION_DEFS.filter((x) => x.starter)) {
    const before = companionUnlocked(def);
    unlockCompanion(def.id, { notify: before ? false : notify, select: !before && !profile.settings?.companion });
    if (!before) fresh = true;
  }
  ensureCompanionSelection(profile);
  return fresh;
}
const COMPANION_FACTS = Object.freeze({
  owl: [
    "У сов глаза почти не двигаются в глазницах — поэтому они поворачивают голову, чтобы менять направление взгляда.",
    "У осьминога три сердца, а его кровь содержит медь и выглядит голубоватой.",
    "Свет от Солнца добирается до Земли примерно за 8 минут 20 секунд.",
    "Банан с точки зрения ботаники — ягода, а клубника — нет.",
    "Самая крупная часть мозга человека — большие полушария; они отвечают в том числе за речь, память и мышление.",
    "Вода расширяется при замерзании, поэтому лёд менее плотный и плавает на поверхности.",
    "У жирафа и человека одинаковое число шейных позвонков — семь.",
    "Молния может нагревать воздух вокруг канала разряда примерно до 30 000 °C."
  ],
  cat: [
    "Кошки используют усы как чувствительные датчики пространства и движения воздуха.",
    "Домашние кошки могут издавать десятки разных звуков, а мяуканье особенно активно используют в общении с людьми.",
    "Отпечаток носа у каждой кошки имеет уникальный рисунок — почти как отпечаток пальца.",
    "Слова легче запоминать, когда связываешь их не по одному признаку, а сразу по нескольким ассоциациям.",
    "Короткие игровые сессии с повторением обычно полезнее для памяти, чем одна очень длинная.",
    "Во сне мозг продолжает сортировать и закреплять часть того, что ты узнал за день."
  ],
  fox: [
    "Лисы отлично запоминают маршруты и быстро адаптируются к новым условиям — почти как игрок после нескольких удачных попыток.",
    "Короткая пауза между партиями помогает мозгу лучше закреплять новые связи и шаблоны.",
    "Если разбить задачу на небольшие шаги, мозг справляется с ней заметно спокойнее и быстрее."
  ],
  bear: [
    "Медведи хорошо ориентируются на местности и могут помнить важные места очень долго.",
    "Повторение с интервалами работает для памяти лучше, чем зубрёжка за один подход.",
    "Когда ты решаешь задачу без спешки, мозг чаще находит более устойчивое решение."
  ],
  raven: [
    "Вороны умеют решать многошаговые задачи и запоминают лица людей — у них впечатляюще гибкое мышление.",
    "Мозгу легче удерживать в фокусе небольшое число целей — поэтому компактные подсказки работают лучше длинных инструкций.",
    "Даже одна короткая тренировка каждый день обычно полезнее редких длинных марафонов."
  ],
  wolf: [
    "Волки координируют действия внутри стаи с помощью поз, звуков и запахов — сложная задача требует хорошей коммуникации.",
    "Поиск знакомого шаблона часто ускоряет решение новой задачи: мозг постоянно сравнивает новое с уже известным.",
    "Чем лучше ты различаешь похожие варианты, тем быстрее становится выбор правильной ассоциации."
  ],
  tiger: [
    "Полосы тигра уникальны у каждой особи — рисунок отличается примерно так же, как отпечатки пальцев у людей.",
    "Короткие паузы между сложными задачами помогают восстановить внимание.",
    "Уверенный ответ обычно появляется быстрее, когда ты сначала исключаешь явно неподходящие варианты."
  ],
  panda: [
    "Большие панды проводят значительную часть дня за едой: бамбук даёт мало энергии, поэтому приходится экономить силы.",
    "Спокойный темп часто повышает точность там, где поспешность провоцирует случайные ошибки.",
    "Повторение через разные интервалы помогает воспоминанию стать устойчивее."
  ],
  frog: [
    "Некоторые лягушки способны менять оттенок кожи в зависимости от условий среды и состояния организма.",
    "Новая ассоциация запоминается лучше, если связать её с ярким образом или необычной деталью.",
    "Ошибочный вариант тоже полезен: мозг уточняет границы между похожими категориями."
  ],
  octopus: [
    "У осьминога большая часть нейронов находится не в мозге, а в щупальцах, которые умеют обрабатывать часть информации самостоятельно.",
    "Многозадачность обычно снижает качество внимания — последовательное решение задач надёжнее.",
    "Сложная задача становится проще, если удерживать в голове только ближайший следующий шаг."
  ],
});
function companionFact(id = profile?.settings?.companion) {
  const list = COMPANION_FACTS[companionDef(id).id] || COMPANION_FACTS.owl;
  const last = Number(profile?.settings?.companionFactIndex || -1);
  const next = list.length > 1 ? (last + 1 + Math.floor(Math.random() * (list.length - 1))) % list.length : 0;
  if (profile?.settings) profile.settings.companionFactIndex = next;
  return list[next];
}
const COMPANION_VOICES = Object.freeze({
  owl:{ start:["Наблюдаем внимательно","Начнём спокойно","Сначала ищем закономерность","Любопытный расклад","Сегодня работаем как исследователи"], win:["Отличная работа","Очень точное решение","Хорошее наблюдение","Прекрасно разобрано","Сильная логика"], error:["Любопытная ошибка","Ничего страшного","Проверим гипотезу ещё раз","Каждая ошибка даёт данные","Здесь связь оказалась другой"], combo:["Вот закономерность","Связи складываются","Отличная серия","Мозг поймал ритм","Очень чистая цепочка"] },
  cat:{ start:["Мр-р, начинаем","Кот-учёный на месте","Проверим коготки ума","Усы настроены","Мяу, расклад интересный"], win:["Ты пррросто прррелесть!","Замурчательно получилось","Мяу, вот это партия","Кот-учёный гордится тобой","Так и хочется мурлыкать"], error:["Мяу, не туда","Коготок соскользнул","Ничего, поправим лапкой","Усы говорят: попробуй иначе","Эта карта решила покапризничать"], combo:["Мур-комбо","Вот это лапки","Усы ловят серию","Мяу, пошла жара","Коготки работают точно"] },
  fox:{ start:["Хитрый лис уже всё осмотрел","Поищем короткую дорожку","Есть тут пара хитрых мест","Пойдём умнее, не быстрее","Я рядом — обманем сложность вместе"], win:["Вот это мы провернули","Красиво обошли все ловушки","Хитро и чисто получилось","План сработал как надо","Ловкая победа, напарник"], error:["Эта ловушка была заметнее, чем казалось","Ничего, теперь мы знаем её место","Чуть перехитрили сами себя","Пойдём другим ходом","Лиса так просто не провести — пробуем ещё"] , combo:["Вот это хитрая серия","Один ловкий ход за другим","План начинает сиять","Так и надо — без лишнего шума","Красиво связываем карты"] },
  bear:{ start:["Без спешки — справимся","Сильный медведь рядом","Держим темп ровно","Сначала опора, потом ход","Спокойствие тоже сила"], win:["Крепкая победа","Вот это выдержка","Сделано надёжно","Очень уверенная партия","Медведь доволен результатом"], error:["Не страшно, выдержим","Один неверный шаг ничего не решает","Соберёмся и продолжим","Сила в том, чтобы не суетиться","Попробуем ещё раз спокойно"], combo:["Крепкая серия","Ходы идут как по следу","Вот это надёжность","Держим ритм","Серия становится мощной"] },
  raven:{ start:["Ворон уже заметил пару деталей","Посмотрим, кто здесь внимательнее","Не пропусти мелочи","Я буду следить за раскладом","Хороший день для умных ходов"], win:["Неплохо. Даже очень","Вот это уже уровень","Ворон одобряет, хоть и не признается","Точно, чисто, без лишнего","Умная партия получилась"], error:["Я это видел. Почти","Деталь ускользнула","Хм. Пересмотрим вариант","Не торопись — здесь есть подвох","Запомним и больше не повторим"], combo:["Вот это умная цепочка","Наконец-то красота","Связи идут одна за другой","Я начинаю впечатляться","Серия достойна внимания"] },
  wolf:{ start:["Берём след","Идём до конца","Серый волк рядом","Путь есть — найдём","Не теряем след расклада"], win:["След привёл к победе","Прошли уверенно","Стая была бы довольна","Хорошая охота за связями","Сильная партия"], error:["След сбился, но не потерян","Возвращаемся на верную тропу","Ничего, учуяли ошибку","Следующий ход будет точнее","Не бросаем путь из-за одного шага"], combo:["След идёт ровно","Серия набирает ход","Один точный шаг за другим","Вот это темп","Не отпускаем цепочку"] },
  tiger:{ start:["Пора играть ярко","Тигр готов к сильной партии","Покажи характер","Расклад хочет смелых решений","Начинаем по-крупному"], win:["Вот это сила","Эффектная победа","Так играет чемпион","Тигр одобрительно рычит","Мощно закрыли уровень"], error:["Рано расслабились","Ничего, соберёмся","Сила без точности не работает","Следующий ход — увереннее","Ошибка принята, продолжаем"] , combo:["Вот это серия","Тигриный темп","Комбо набирает мощь","Продолжай давить точно","Серия выглядит грозно"] },
  panda:{ start:["Спокойно начинаем","Без суеты","Панда уже устроилась поудобнее","Точный ход любит тишину","Дышим ровно и смотрим на связи"], win:["Идеально спокойно","Очень чистая победа","Без суеты и красиво","Панда довольно улыбается","Такой темп мне нравится"], error:["Спешка нам ни к чему","Ничего, просто посмотрим ещё раз","Мягко возвращаемся к задаче","Один промах не портит партию","Попробуем спокойнее"] , combo:["Тихая, но мощная серия","Вот это плавность","Связи идут сами","Очень ровное комбо","Спокойный ритм работает"] },
  frog:{ start:["Прыг-скок, начинаем","Сейчас будет весело","Лягушка уже готова к эксперименту","Посмотрим, куда прыгнет мысль","Расклад пахнет приключением"], win:["Ква-сота","Вот это прыжок к победе","Весело и точно","Лягушка в восторге","Получилось ярко"], error:["Ой, не на ту кочку","Прыгнули чуть мимо","Ничего, следующая кочка наша","Эксперимент дал результат","Попробуем другой прыжок"] , combo:["Прыг-прыг-комбо","Серия скачет отлично","Вот это цепочка","Не останавливайся","Ловкие ходы пошли"] },
  octopus:{ start:["Разложим всё по щупальцам","Планов много — выберем лучший","Смотрим на несколько ходов вперёд","Осьминог уже строит схему","Начинаем системно"], win:["Всё разложено идеально","Система сработала","Очень умная партия","Осьминог доволен схемой","План выполнен точно"], error:["Один из планов не сработал","Пересчитаем варианты","Ничего, осталось ещё семь идей","Схему можно улучшить","Этот путь вычёркиваем"] , combo:["Система набирает скорость","Щупальца считают комбо","Отличная последовательность","План складывается","Связи идут по схеме"] },
  birthday:{ start:["Праздник продолжается","Капибара принесла хорошее настроение","Сегодня играем с бонусом к улыбке","Пусть расклад будет подарком","Начинаем празднично"], win:["Вот это подарок","Праздничная победа","Капибара хлопает лапками","Красиво отпраздновали уровень","Ещё один повод улыбнуться"], error:["На празднике всё можно поправить","Ничего, торт от этого не исчезнет","Улыбнулись и пробуем снова","Один промах празднику не помеха","Следующий ход будет подарком"] , combo:["Праздничное комбо","Свечи зажигаются одна за другой","Вот это фейерверк ходов","Серия как подарок","Продолжаем праздник"] }
});
const COMPANION_CONTEXT_ENDINGS = Object.freeze({
  start:["Посмотрим, что здесь спрятано.","Я рядом — разберёмся.","Начнём с самого понятного хода.","Главное — не спешить с первой догадкой.","У тебя всё получится.","Погнали искать связи."],
  win:["Очень хорошая работа.","Так держать.","Мне нравится этот результат.","Можно гордиться этой партией.","Ещё один уровень красиво закрыт.","Продолжаем в том же духе."],
  error:["Попробуй посмотреть на соседние карты.","Ничего критичного — продолжаем.","Теперь этот вариант можно исключить.","Следующий ход будет точнее.","Не спеши, связь найдётся.","Я рядом — разберём ошибку."],
  combo:["Не сбивай ритм.","Продолжай только ручными ходами.","Серия выглядит отлично.","Ещё немного — и будет жарко.","Хороший темп.","Вот теперь расклад зазвучал."],
  hint:["Присмотрись к этой карте.","Здесь есть полезная зацепка.","Я бы начал отсюда.","Эта карта сейчас выглядит перспективнее остальных.","Попробуй развить связь отсюда.","Вот куда я бы посмотрел в первую очередь."]
});
function companionPlayerName() {
  const name = String(profile?.playerName || "").trim();
  return name && name !== "Игрок" ? name : "";
}
function companionPhrasePool(id = profile?.settings?.companion, situation = "start") {
  const def = companionDef(id), voice = COMPANION_VOICES[def.id] || COMPANION_VOICES.owl;
  const starts = Array.isArray(voice[situation]) ? voice[situation] : voice.start;
  const endings = COMPANION_CONTEXT_ENDINGS[situation] || COMPANION_CONTEXT_ENDINGS.start;
  const name = companionPlayerName();
  const pool = [];
  for (let i = 0; i < starts.length; i++) for (let j = 0; j < endings.length; j++) {
    const address = name && (i + j) % 5 === 0 ? `${name}, ` : "";
    pool.push(`${address}${starts[i]}. ${endings[j]}`);
  }
  return pool.slice(0, 30);
}
function companionPhrase(id = profile?.settings?.companion, situation = "start") {
  const pool = companionPhrasePool(id, situation);
  return pool[Math.floor(Math.random() * Math.max(1, pool.length))] || "Поехали!";
}
function companionWinLine(id = profile?.settings?.companion, perfect = false) {
  const def = companionDef(id);
  if (def.id === "owl" && Math.random() < 0.34) return `Факт от совы: ${companionFact("owl")}`;
  let line = companionPhrase(def.id, "win");
  if (perfect && def.id === "cat" && Math.random() < 0.32) line = `${companionPlayerName() ? companionPlayerName() + ", " : ""}ты пррросто прррелесть! Идеальная партия.`;
  return line;
}
function companionErrorLine(id = profile?.settings?.companion) { return companionPhrase(id, "error"); }
function companionComboLine(id = profile?.settings?.companion) { return companionPhrase(id, "combo"); }
function companionStartLine(id = profile?.settings?.companion) { return companionPhrase(id, "start"); }
function companionHintLine(id = profile?.settings?.companion) { return companionPhrase(id, "hint"); }

function birthDateDisplay(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return "";
  const [year, month, day] = String(value).split("-");
  return `${day}.${month}.${year}`;
}
function isBirthdayDate(birthDate, date = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(birthDate || ""))) return false;
  const [, month, day] = String(birthDate).split("-").map(Number);
  return month === date.getMonth() + 1 && day === date.getDate();
}
function localDateFromKey(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
}
function birthdayWeekInfo(p = profile, date = new Date()) {
  const birthDate = p?.birthDate;
  if (!isBirthdayDate(birthDate, date) && !p?.birthdayWeek?.start) return { active: false, daysLeft: 0 };
  const start = localDateFromKey(p?.birthdayWeek?.start), end = localDateFromKey(p?.birthdayWeek?.end);
  if (!start || !end) return { active: false, daysLeft: 0 };
  const today = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const finish = end.getTime();
  if (today < start.getTime() || today > finish) return { active: false, daysLeft: 0 };
  return { active: true, daysLeft: Math.max(0, Math.round((finish - today) / 86400000)), start, end };
}
function startBirthdayWeek(date = new Date()) {
  if (!profile?.birthDate) return false;
  const year = date.getFullYear();
  profile.birthdayWeek ||= { lastCelebratedYear: 0, start: "", end: "" };
  if (profile.birthdayWeek.lastCelebratedYear === year) return false;
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
  profile.birthdayWeek.start = localDateKey(start);
  profile.birthdayWeek.end = localDateKey(end);
  profile.birthdayWeek.lastCelebratedYear = year;
  unlockCompanion("birthday", { notify: true, select: false });
  profile.notifications ||= [];
  if (typeof DEVELOPER_MESSAGES !== "undefined" && Array.isArray(profile.developerMailSeen)) {
    const msgId = `birthday-${year}`;
    profile.developerMailDeleted = (profile.developerMailDeleted || []).filter((id) => String(id) !== msgId);
  }
  saveProfile?.();
  return true;
}
function syncBirthdayRewards(date = new Date()) {
  if (!profile?.birthDate) return false;
  if (isBirthdayDate(profile.birthDate, date)) return startBirthdayWeek(date);
  return false;
}

const APP_ICON_FRAME_DEFS = Object.freeze([
  { id: "none", name: "Без рамки", desc: "Базовый вид", unlock: () => true },
  { id: "bronze", name: "Исследователь", desc: "За 10 пройденных уровней", unlock: (p) => (p.stats?.levelsCompleted || 0) >= 10 },
  { id: "gold", name: "Мастер", desc: "За 50 пройденных уровней", unlock: (p) => (p.stats?.levelsCompleted || 0) >= 50 },
  { id: "prism", name: "Комбо", desc: "За достижение комбо ×10", unlock: (p) => (p.achievements || []).includes("combo10") },
]);
function appIconFrameDef(id) { return APP_ICON_FRAME_DEFS.find((x) => x.id === id) || APP_ICON_FRAME_DEFS[0]; }
function appIconFrameUnlocked(def, p = profile) { return !!def?.unlock?.(p); }
function appIconAsset(iconId, frameId, size = 192) {
  const icon = appIconDef(iconId), frame = appIconFrameDef(frameId);
  if (frame.id === "none") return size === 512 ? icon.apple.replace("192", "512") : icon.apple;
  return `./icons/icon-${icon.id}-${frame.id}-${size}.png`;
}
function appIconManifest(iconId, frameId) {
  const icon = appIconDef(iconId), frame = appIconFrameDef(frameId);
  if (frame.id === "none") return icon.manifest;
  return `./manifest-${icon.id}-${frame.id}.webmanifest`;
}

const AVATAR_EMOJIS = [
  "🙂", "😎", "🤩", "🥳", "🤓", "🤠", "🫠", "😈",
  "🦊", "🐼", "🐸", "🦉", "🐱", "🐙", "🦄", "🐯", "🐧",
  "🌙", "⭐", "🔥", "❄️", "🌸", "🍀", "⚡", "🌈",
  "🎯", "🎮", "🧩", "🏆", "🚀", "💎", "🎧", "🍕"
];

const RANK_XP_BASE = 100;
const RANK_XP_GROWTH = 1.1;
// Exact economy: rank 1→2 costs 100 XP, every next promotion costs
// 10% more than the PREVIOUS rounded promotion cost.
const RANK_XP_COSTS = [RANK_XP_BASE];
const RANK_XP_THRESHOLDS = [0];
function xpNeededForRankUp(rank) {
  rank = Math.max(1, Math.floor(+rank || 1));
  while (RANK_XP_COSTS.length < rank) {
    RANK_XP_COSTS.push(Math.max(RANK_XP_BASE, Math.round(RANK_XP_COSTS.at(-1) * RANK_XP_GROWTH)));
  }
  return RANK_XP_COSTS[rank - 1];
}
function xpThresholdForRank(rank) {
  rank = Math.max(1, Math.floor(+rank || 1));
  while (RANK_XP_THRESHOLDS.length < rank) {
    const currentRank = RANK_XP_THRESHOLDS.length;
    RANK_XP_THRESHOLDS.push(RANK_XP_THRESHOLDS.at(-1) + xpNeededForRankUp(currentRank));
  }
  return RANK_XP_THRESHOLDS[rank - 1];
}
function rankLevelFromXp(value) {
  const xp = Math.max(0, +value || 0);
  let rank = 1;
  while (xp >= xpThresholdForRank(rank + 1) && rank < 500) rank++;
  return rank;
}

const RANK_AVATAR_REWARDS = [
  "🧠","🕵️","🧙","🧑‍🚀","🤖","👑","🦁","🐲","🦅","🦋","🌋","🌌","🪐","🧿","🎭","🗿","🦖","🐉","🛸","⚜️",
  "🐺","🦝","🦥","🦦","🦚","🦜","🦩","🐬","🦈","🐋","🐘","🦒","🦏","🐆","🐻‍❄️","🦬","🦌","🐏","🦘","🦡",
  "🪄","🔮","🧪","⚗️","🧬","🛰️","🔭","🧭","🗺️","🏛️","🏰","🗼","🌉","⛩️","🎡","🎢","🎪","🎨","🎬","🎻",
  "🎷","🥁","🎸","🎹","🪕","🏹","🤺","🏄","🧗","🚴","⛷️","🏂","🏎️","⛵","🚁","🚂","🚜","🛶","🏕️","🌠",
  "☄️","🌊","🏔️","🌲","🌵","🪴","🍄","🪸","🦪","🐚","🪶","🪬","🧶","🪡","🧵","🧱","🪵","⚙️","🧲","💡"
];
function rankRewardAvatar(level) {
  return level >= 2 ? (RANK_AVATAR_REWARDS[level - 2] || null) : null;
}
const LOGIN_REWARD_DEFS = [
  { days: 30, id: "visits30", emoji: "📅", title: "30 дней" },
  { days: 50, id: "visits50", emoji: "🧭", title: "50 дней" },
  { days: 100, id: "visits100", emoji: "🏛️", title: "100 дней" },
  { days: 180, id: "visits180", emoji: "🌳", title: "Полгода" },
  { days: 365, id: "visits365", emoji: "🏅", title: "Год вместе" },
];
function avatarRankRarity(rank) { return rank <= 10 ? "common" : rank <= 30 ? "uncommon" : rank <= 70 ? "rare" : "epic"; }
function avatarLoginRarity(days) { return days < 100 ? "uncommon" : days < 365 ? "rare" : "epic"; }
const AVATAR_DEFS = Object.freeze((() => {
  const byEmoji = new Map();
  AVATAR_EMOJIS.forEach((emoji, index) => byEmoji.set(emoji, Object.freeze({ id:`base-${index+1}`, emoji, rarity:"common", source:collectibleSource("starter", "Изначально"), unlock:{ type:"starter" } })));
  RANK_AVATAR_REWARDS.forEach((emoji, index) => {
    if (byEmoji.has(emoji)) return;
    const rank = index + 2;
    byEmoji.set(emoji, Object.freeze({ id:`rank-${rank}`, emoji, rarity:avatarRankRarity(rank), source:collectibleSource("rank", "Ранг", { rank }), unlock:{ type:"rank", rank } }));
  });
  LOGIN_REWARD_DEFS.forEach((reward) => {
    if (byEmoji.has(reward.emoji)) return;
    byEmoji.set(reward.emoji, Object.freeze({ id:`login-${reward.days}`, emoji:reward.emoji, rarity:avatarLoginRarity(reward.days), source:collectibleSource("retention", "Дни вместе", { days:reward.days }), unlock:{ type:"days", days:reward.days } }));
  });
  return [...byEmoji.values()];
})());
function avatarDefByEmoji(emoji) { return AVATAR_DEFS.find((x) => x.emoji === emoji) || AVATAR_DEFS[0]; }
function avatarUnlocked(def, p = typeof profile !== "undefined" ? profile : null) {
  if (!def) return false;
  if (def.unlock?.type === "starter") return true;
  if (def.unlock?.type === "rank") return rankLevelFromXp(+p?.xp || 0) >= def.unlock.rank;
  if (def.unlock?.type === "days") return (+p?.retention?.totalOpenDays || 0) >= def.unlock.days;
  return false;
}
function availableAvatarEmojis(p = typeof profile !== "undefined" ? profile : null) { return AVATAR_DEFS.filter((def) => avatarUnlocked(def, p)).map((def) => def.emoji); }

const ASSOCIATION_COLLECTION_DEFS = [
  {
    id: "animals", name: "Животные", icon: "🦊", desc: "Собирай животных по среде и типу",
    categories: [
      { id: "farm", title: "Ферма", cards: [["🐄","Корова"],["🐖","Свинья"],["🐔","Курица"],["🐑","Овца"],["🐐","Коза"],["🐎","Лошадь"]] },
      { id: "africa", title: "Африка", cards: [["🦁","Лев"],["🐘","Слон"],["🦒","Жираф"],["🦓","Зебра"],["🦏","Носорог"],["🐆","Леопард"]] },
      { id: "forest", title: "Лес", cards: [["🦊","Лиса"],["🐻","Медведь"],["🐺","Волк"],["🦌","Олень"],["🐿️","Белка"],["🦉","Сова"],["🐇","Заяц"]] },
      { id: "ocean", title: "Океан", cards: [["🐬","Дельфин"],["🐳","Кит"],["🦈","Акула"],["🐙","Осьминог"],["🦀","Краб"],["🐠","Рыба"]] },
      { id: "birds", title: "Птицы", cards: [["🦅","Орёл"],["🦆","Утка"],["🦜","Попугай"],["🦢","Лебедь"],["🦩","Фламинго"],["🐧","Пингвин"]] },
      { id: "insects", title: "Насекомые", cards: [["🐝","Пчела"],["🦋","Бабочка"],["🐞","Божья коровка"],["🦗","Кузнечик"],["🪲","Жук"],["🐜","Муравей"]] },
    ],
  },
  {
    id: "nature", name: "Природа", icon: "🌿", desc: "Погода, растения и природные явления",
    categories: [
      { id: "weather", title: "Погода", cards: [["☀️","Солнце"],["🌧️","Дождь"],["⛈️","Гроза"],["🌨️","Снег"],["🌪️","Торнадо"],["🌈","Радуга"]] },
      { id: "flowers", title: "Цветы", cards: [["🌹","Роза"],["🌷","Тюльпан"],["🌻","Подсолнух"],["🌸","Сакура"],["🪻","Гиацинт"],["🌺","Гибискус"]] },
      { id: "plants", title: "Растения", cards: [["🌵","Кактус"],["🌴","Пальма"],["🌲","Ель"],["🌳","Дерево"],["🎋","Бамбук"],["🍀","Клевер"]] },
      { id: "mountains", title: "Горы", cards: [["⛰️","Гора"],["🏔️","Снежная вершина"],["🌋","Вулкан"],["🪨","Скала"],["🧗","Скалолаз"],["🏞️","Нацпарк"]] },
      { id: "water", title: "Вода", cards: [["🌊","Волна"],["💧","Капля"],["🧊","Лёд"],["🏝️","Остров"],["⛲","Фонтан"],["🚣","Лодка"]] },
      { id: "night", title: "Ночь", cards: [["🌙","Луна"],["⭐","Звезда"],["🌌","Млечный путь"],["☄️","Комета"],["🌠","Падающая звезда"],["🌑","Новолуние"]] },
    ],
  },
  {
    id: "food", name: "Еда", icon: "🍕", desc: "Продукты и блюда по понятным ассоциациям",
    categories: [
      { id: "breakfast", title: "Завтрак", cards: [["🍳","Яичница"],["🥞","Блины"],["🥐","Круассан"],["☕","Кофе"],["🥣","Каша"],["🍞","Хлеб"]] },
      { id: "fruit", title: "Фрукты", cards: [["🍎","Яблоко"],["🍌","Банан"],["🍊","Апельсин"],["🍇","Виноград"],["🍉","Арбуз"],["🍍","Ананас"]] },
      { id: "berries", title: "Ягоды", cards: [["🍓","Клубника"],["🫐","Черника"],["🍒","Вишня"],["🍇","Виноград"]] },
      { id: "vegetables", title: "Овощи", cards: [["🥕","Морковь"],["🥦","Брокколи"],["🌽","Кукуруза"],["🍅","Помидор"],["🥒","Огурец"],["🫑","Перец"]] },
      { id: "fastfood", title: "Фастфуд", cards: [["🍔","Бургер"],["🍟","Картофель фри"],["🍕","Пицца"],["🌭","Хот-дог"],["🌮","Тако"],["🥤","Газировка"]] },
      { id: "sweets", title: "Сладкое", cards: [["🍰","Торт"],["🧁","Кекс"],["🍩","Пончик"],["🍪","Печенье"],["🍫","Шоколад"],["🍬","Конфета"]] },
      { id: "asia", title: "Азиатская кухня", cards: [["🍣","Суши"],["🍜","Лапша"],["🍚","Рис"],["🥟","Пельмени"],["🍱","Бенто"],["🥢","Палочки"]] },
    ],
  },
  {
    id: "space", name: "Космос", icon: "🚀", desc: "Объекты, техника и явления космоса",
    categories: [
      { id: "flight", title: "Полёт", cards: [["🚀","Ракета"],["🛰️","Спутник"],["🛸","НЛО"],["👨‍🚀","Астронавт"],["🌌","Космос"],["🔭","Телескоп"]] },
      { id: "earth", title: "Земля", cards: [["🌍","Планета"],["🗺️","Карта мира"],["🧭","Компас"],["🌊","Океан"],["☁️","Атмосфера"],["🛰️","Орбита"]] },
      { id: "moon", title: "Луна", cards: [["🌕","Полнолуние"],["🌙","Серп"],["👨‍🚀","Астронавт"],["🚀","Полёт"],["🔭","Наблюдение"],["🛰️","Спутник"]] },
      { id: "stars", title: "Звёзды", cards: [["⭐","Звезда"],["🌟","Яркая звезда"],["✨","Сияние"],["🌠","Падающая звезда"],["☄️","Комета"],["💫","Орбита"]] },
      { id: "science", title: "Наука", cards: [["🧪","Пробирка"],["🔬","Микроскоп"],["🧬","ДНК"],["⚛️","Атом"],["📡","Антенна"],["🖥️","Компьютер"]] },
      { id: "future", title: "Будущее", cards: [["🤖","Робот"],["👽","Инопланетянин"],["🦾","Протез"],["🔋","Батарея"],["💡","Идея"],["🕶️","Технологии"]] },
    ],
  },
  {
    id: "emotions", name: "Эмоции", icon: "😎", desc: "Определи эмоцию по выражению лица",
    categories: [
      { id: "joy", title: "Радость", cards: [["😀","Улыбка"],["😂","Смех"],["🎉","Праздник"],["🥳","Веселье"],["🏆","Победа"],["☀️","Хороший день"]] },
      { id: "sad", title: "Грусть", cards: [["😢","Слеза"],["🌧️","Дождь"],["💔","Разбитое сердце"],["🥀","Увядший цветок"],["☔","Пасмурно"],["😞","Печаль"]] },
      { id: "anger", title: "Злость", cards: [["😠","Сердитость"],["💢","Гнев"],["🔥","Вспышка"],["👿","Злой"],["👊","Удар"],["🌋","Вулкан"]] },
      { id: "fear", title: "Страх", cards: [["😱","Ужас"],["👻","Призрак"],["🌑","Темнота"],["🕷️","Паук"],["⚡","Внезапность"],["🫣","Прячется"]] },
      { id: "love", title: "Любовь", cards: [["❤️","Сердце"],["💐","Цветы"],["💍","Кольцо"],["😘","Поцелуй"],["💌","Письмо"],["🥰","Нежность"]] },
      { id: "tired", title: "Усталость", cards: [["😴","Сон"],["🥱","Зевок"],["💤","Дремота"],["🛏️","Кровать"],["☕","Нужен кофе"],["🔋","Мало энергии"]] },
    ],
  },
  {
    id: "transport", name: "Транспорт", icon: "🚗", desc: "Транспорт по назначению, среде и типу",
    categories: [
      { id: "city", title: "Город", cards: [["🚕","Такси"],["🚌","Автобус"],["🚎","Троллейбус"],["🚋","Трамвай"],["🚇","Метро"],["🚲","Велосипед"]] },
      { id: "road", title: "Дорога", cards: [["🚗","Автомобиль"],["🛣️","Шоссе"],["🚦","Светофор"],["⛽","Заправка"],["🅿️","Парковка"],["🚧","Ремонт"]] },
      { id: "air", title: "Воздух", cards: [["✈️","Самолёт"],["🛩️","Лёгкий самолёт"],["🚁","Вертолёт"],["🛫","Взлёт"],["🪂","Парашют"],["🎈","Воздушный шар"]] },
      { id: "sea", title: "Море", cards: [["🚢","Корабль"],["⛴️","Паром"],["🛳️","Лайнер"],["⛵","Яхта"],["🚤","Катер"],["🛶","Каноэ"]] },
      { id: "rail", title: "Рельсы", cards: [["🚂","Паровоз"],["🚉","Станция"],["🛤️","Путь"],["🚏","Платформа"],["🚦","Сигнал"],["🧳","Багаж"]] },
      { id: "service", title: "Службы", cards: [["🚑","Скорая"],["🚒","Пожарная"],["🚓","Полиция"],["🚔","Патруль"],["🚐","Фургон"],["🚜","Трактор"]] },
    ],
  },
  {
    id: "home", name: "Дом", icon: "🏠", desc: "Комнаты, вещи и домашние занятия",
    categories: [
      { id: "kitchen", title: "Кухня", cards: [["🍳","Сковорода"],["🥣","Миска"],["🔪","Нож"],["🥄","Ложка"],["🫖","Чайник"],["🧂","Соль"]] },
      { id: "bedroom", title: "Спальня", cards: [["🛏️","Кровать"],["🛌","Сон"],["⏰","Будильник"],["🪞","Зеркало"],["👕","Одежда"],["💡","Лампа"]] },
      { id: "bathroom", title: "Ванная", cards: [["🛁","Ванна"],["🚿","Душ"],["🧼","Мыло"],["🪥","Щётка"],["🧴","Шампунь"],["🧻","Бумага"]] },
      { id: "cleaning", title: "Уборка", cards: [["🧹","Веник"],["🧽","Губка"],["🪣","Ведро"],["🧺","Корзина"],["🧤","Перчатки"],["🫧","Пена"]] },
      { id: "office", title: "Работа", cards: [["💻","Ноутбук"],["🖥️","Монитор"],["⌨️","Клавиатура"],["🖱️","Мышь"],["📝","Запись"],["📎","Скрепка"]] },
      { id: "repair", title: "Ремонт", cards: [["🔨","Молоток"],["🪛","Отвёртка"],["🔧","Ключ"],["🪚","Пила"],["🧰","Инструменты"],["🪜","Лестница"]] },
    ],
  },
  {
    id: "sports", name: "Спорт", icon: "⚽", desc: "Виды спорта, инвентарь и соревнования",
    categories: [
      { id: "ball", title: "Мяч", cards: [["⚽","Футбол"],["🏀","Баскетбол"],["🏐","Волейбол"],["🏈","Регби"],["⚾","Бейсбол"],["🎾","Теннис"]] },
      { id: "winter", title: "Зима", cards: [["⛷️","Лыжи"],["🏂","Сноуборд"],["⛸️","Коньки"],["🥌","Кёрлинг"],["🏒","Хоккей"],["🛷","Сани"]] },
      { id: "water", title: "Водный", cards: [["🏊","Плавание"],["🏄","Сёрфинг"],["🚣","Гребля"],["🤽","Водное поло"],["🛶","Каяк"],["⛵","Парус"]] },
      { id: "fight", title: "Борьба", cards: [["🥊","Бокс"],["🥋","Кимоно"],["🤼","Борьба"],["🤺","Фехтование"],["🏋️","Штанга"],["💪","Сила"]] },
      { id: "track", title: "Стадион", cards: [["🏃","Бег"],["🏃‍♀️","Забег"],["🥇","Медаль"],["🏟️","Стадион"],["⏱️","Секундомер"],["🏆","Кубок"]] },
      { id: "target", title: "Меткость", cards: [["🏹","Стрельба из лука"],["🎯","Дартс"],["🎳","Боулинг"],["⛳","Гольф"],["🎱","Бильярд"],["🥏","Фрисби"]] },
    ],
  },
  {
    id: "travel", name: "Путешествия", icon: "🧳", desc: "Отпуск, дорога и места вокруг света",
    categories: [
      { id: "beach", title: "Пляж", cards: [["🏖️","Пляж"],["🏝️","Остров"],["🌴","Пальма"],["👙","Купальник"],["🩴","Шлёпанцы"],["⛱️","Зонт"]] },
      { id: "camping", title: "Поход", cards: [["⛺","Палатка"],["🥾","Ботинок"],["🎒","Рюкзак"],["🔥","Костёр"],["🧭","Компас"],["🏕️","Кемпинг"]] },
      { id: "hotel", title: "Отель", cards: [["🏨","Отель"],["🛎️","Звонок"],["🧳","Чемодан"],["🛏️","Номер"],["🔑","Ключ"],["🧾","Счёт"]] },
      { id: "airport", title: "Аэропорт", cards: [["🛫","Вылет"],["🛬","Посадка"],["🛤️","Платформа"],["🛂","Паспортный контроль"],["🧳","Багаж"],["🛃","Таможня"]] },
      { id: "city", title: "Туризм", cards: [["🗺️","Карта"],["📸","Фото"],["🏛️","Музей"],["🗽","Достопримечательность"],["🚶","Прогулка"],["🧭","Навигация"]] },
      { id: "mountain", title: "Высота", cards: [["🏔️","Горы"],["🚡","Канатка"],["🧗","Скалолаз"],["🥾","Треккинг"],["🌲","Лес"],["🏞️","Парк"]] },
    ],
  },
  {
    id: "celebration", name: "Праздники", icon: "🎉", desc: "Праздники, подарки и яркие события",
    categories: [
      { id: "birthday", title: "День рождения", cards: [["🎂","Торт"],["🎁","Подарок"],["🎈","Шар"],["🥳","Праздник"],["🕯️","Свеча"],["🎉","Конфетти"]] },
      { id: "newyear", title: "Новый год", cards: [["🎄","Ёлка"],["🎅","Санта"],["❄️","Снег"],["🎁","Подарок"],["🥂","Бокалы"],["✨","Огни"]] },
      { id: "halloween", title: "Хэллоуин", cards: [["🎃","Тыква"],["👻","Призрак"],["🧙","Ведьма"],["🦇","Летучая мышь"],["🍬","Сладости"],["🕸️","Паутина"]] },
      { id: "wedding", title: "Свадьба", cards: [["💍","Кольцо"],["💐","Букет"],["👰","Невеста"],["🤵","Жених"],["🥂","Тост"],["❤️","Любовь"]] },
      { id: "party", title: "Вечеринка", cards: [["🎶","Музыка"],["💃","Танец"],["🪩","Диско"],["🥳","Веселье"],["🍹","Коктейль"],["🎊","Конфетти"]] },
      { id: "victory", title: "Победа", cards: [["🏆","Кубок"],["🥇","Золото"],["🎖️","Награда"],["👏","Аплодисменты"],["🎉","Праздник"],["🔥","Триумф"]] },
    ],
  },
];


ASSOCIATION_COLLECTION_DEFS.push(
  {
    id: "music", name: "Музыка", icon: "🎵", desc: "Инструменты, жанры и всё вокруг музыки",
    categories: [
      { id: "strings", title: "Струны", cards: [["🎸","Гитара"],["🎻","Скрипка"],["🪕","Банджо"],["🎼","Ноты"],["🎵","Мелодия"],["🎶","Музыка"]] },
      { id: "rhythm", title: "Ритм", cards: [["🥁","Барабан"],["🪘","Тамтам"],["👏","Хлопок"],["💃","Танец"],["🕺","Танцор"],["🎶","Ритм"]] },
      { id: "concert", title: "Концерт", cards: [["🎤","Микрофон"],["🎟️","Вход"],["🎫","Пропуск"],["🤘","Рок"],["🪩","Сцена"],["👏","Аплодисменты"]] },
      { id: "studio", title: "Студия", cards: [["🎙️","Запись"],["🎚️","Микшер"],["🎛️","Пульт"],["🎧","Наушники"],["💻","Компьютер"],["🔊","Монитор"]] },
      { id: "orchestra", title: "Оркестр", cards: [["🎻","Скрипка"],["🎺","Труба"],["🎷","Саксофон"],["🥁","Ударные"],["🪈","Флейта"],["👨‍🎼","Дирижёр"]] },
    ],
  },
  {
    id: "cinema", name: "Кино", icon: "🎬", desc: "Жанры, съёмки и атмосфера кино",
    categories: [
      { id: "screen", title: "Кинотеатр", cards: [["🎬","Кино"],["🍿","Попкорн"],["🎟️","Вход"],["📽️","Проектор"],["🎞️","Плёнка"],["🪑","Кресло"]] },
      { id: "horror", title: "Ужасы", cards: [["👻","Призрак"],["🧟","Зомби"],["🧛","Вампир"],["🔪","Нож"],["🌑","Темнота"],["😱","Крик"]] },
      { id: "comedy", title: "Комедия", cards: [["😂","Смех"],["🤣","Хохот"],["🤡","Клоун"],["🎭","Театр"],["🍌","Гэг"],["😜","Шутка"]] },
      { id: "romance", title: "Романтика", cards: [["❤️","Любовь"],["💐","Букет"],["💋","Поцелуй"],["🌹","Роза"],["💌","Письмо"],["🥂","Свидание"]] },
      { id: "action", title: "Боевик", cards: [["💥","Взрыв"],["🚁","Погоня"],["🏎️","Скорость"],["🕶️","Герой"],["🔥","Огонь"],["🎯","Цель"]] },
      { id: "cartoon", title: "Мультфильм", cards: [["🖍️","Рисунок"],["🎨","Краски"],["🎬","Кадр"],["📺","Экран"],["💬","Реплика"],["🧑‍🎨","Аниматор"]] },
    ],
  },
  {
    id: "school", name: "Школа", icon: "🎓", desc: "Учёба, предметы и школьная жизнь",
    categories: [
      { id: "class", title: "Урок", cards: [["🏫","Школа"],["🧑‍🏫","Учитель"],["🪑","Парта"],["📚","Учебники"],["✏️","Карандаш"],["📝","Тетрадь"]] },
      { id: "math", title: "Математика", cards: [["➕","Сложение"],["➖","Вычитание"],["✖️","Умножение"],["➗","Деление"],["📐","Угольник"],["🧮","Счёты"]] },
      { id: "science2", title: "Физика", cards: [["⚛️","Атом"],["🧲","Магнит"],["💡","Свет"],["🔋","Энергия"],["📏","Измерение"],["🧪","Опыт"]] },
      { id: "writing", title: "Письмо", cards: [["✍️","Писать"],["🖊️","Ручка"],["✏️","Карандаш"],["📓","Тетрадь"],["🔤","Буквы"],["📖","Текст"]] },
      { id: "geo", title: "География", cards: [["🌍","Земля"],["🗺️","Карта"],["🧭","Компас"],["🏔️","Горы"],["🌊","Океан"],["🏳️","Страны"]] },
      { id: "graduation", title: "Выпуск", cards: [["🎓","Диплом"],["📜","Грамота"],["🎉","Праздник"],["🏫","Школа"],["📸","Фото"],["🥳","Выпускной"]] },
    ],
  },
  {
    id: "tech", name: "Техника", icon: "💻", desc: "Гаджеты, интернет и цифровая жизнь",
    categories: [
      { id: "phone", title: "Смартфон", cards: [["📱","Телефон"],["🔋","Батарея"],["📶","Сеть"],["📸","Камера"],["💬","Чат"],["🔔","Уведомление"]] },
      { id: "computer", title: "Компьютер", cards: [["🖥️","Монитор"],["⌨️","Клавиатура"],["🖱️","Мышь"],["💾","Диск"],["🧠","Процессор"],["🔌","Питание"]] },
      { id: "internet", title: "Интернет", cards: [["🌐","Сеть"],["📡","Антенна"],["📶","Wi-Fi"],["🔗","Ссылка"],["☁️","Облако"],["🔒","Безопасность"]] },
      { id: "gaming", title: "Гейминг", cards: [["🎮","Геймпад"],["🕹️","Джойстик"],["🎧","Гарнитура"],["🏆","Победа"],["👾","Аркада"],["🖥️","Экран"]] },
      { id: "charge", title: "Зарядка", cards: [["🔋","Батарея"],["⚡","Энергия"],["🔌","Розетка"],["🪫","Разряд"],["📱","Телефон"],["💡","Питание"]] },
      { id: "smarthome", title: "Умный дом", cards: [["🏠","Дом"],["💡","Умная лампа"],["🔊","Умная колонка"],["🌡️","Термостат"],["📷","Камера"],["🔐","Умный замок"]] },
    ],
  },
  {
    id: "health", name: "Здоровье", icon: "🩺", desc: "Медицина, забота о себе и самочувствие",
    categories: [
      { id: "doctor", title: "Врач", cards: [["🧑‍⚕️","Доктор"],["🩺","Стетоскоп"],["🏥","Больница"],["💉","Укол"],["🩹","Пластырь"],["📋","Карта"]] },
      { id: "teeth", title: "Зубы", cards: [["🦷","Зуб"],["🪥","Щётка"],["🧴","Паста"],["😁","Улыбка"],["🧑‍⚕️","Стоматолог"],["💧","Полоскание"]] },
      { id: "medicine", title: "Лекарства", cards: [["💊","Таблетка"],["🧴","Сироп"],["💉","Инъекция"],["🩹","Пластырь"],["🌡️","Температура"],["📄","Рецепт"]] },
      { id: "fitness", title: "Фитнес", cards: [["🏋️","Тренировка"],["💪","Сила"],["🏃","Бег"],["🧘","Йога"],["🥤","Вода"],["⌚","Пульс"]] },
      { id: "sleep", title: "Сон", cards: [["😴","Спать"],["🛏️","Кровать"],["🌙","Ночь"],["💤","Сон"],["⏰","Будильник"],["🛌","Отдых"]] },
      { id: "firstaid", title: "Первая помощь", cards: [["🩹","Пластырь"],["🩺","Помощь"],["🚑","Скорая"],["🧊","Холод"],["🧤","Перчатки"],["📞","Вызов"]] },
    ],
  },
  {
    id: "citylife", name: "Город", icon: "🏙️", desc: "Места, службы и повседневная городская жизнь",
    categories: [
      { id: "street", title: "Улица", cards: [["🚦","Светофор"],["🚶","Пешеход"],["🚗","Машина"],["🛣️","Дорога"],["🏢","Дом"],["🚏","Остановка"]] },
      { id: "park", title: "Парк", cards: [["🌳","Дерево"],["🌿","Зелень"],["🛝","Горка"],["🚲","Велосипед"],["🐕","Собака"],["⛲","Фонтан"]] },
      { id: "cafe", title: "Кафе", cards: [["☕","Кофе"],["🥐","Круассан"],["🍰","Десерт"],["🧾","Счёт"],["🪑","Столик"],["🥄","Ложка"]] },
      { id: "mall", title: "Магазины", cards: [["🛍️","Покупки"],["👕","Одежда"],["👟","Обувь"],["💳","Оплата"],["🛒","Тележка"],["🏬","Магазин"]] },
      { id: "station", title: "Вокзал", cards: [["🚉","Станция"],["🚆","Поезд"],["🛤️","Платформа"],["🧳","Багаж"],["🕐","Время"],["📢","Объявление"]] },
      { id: "build", title: "Стройка", cards: [["🏗️","Кран"],["👷","Рабочий"],["🧱","Кирпич"],["🔨","Молоток"],["🚧","Ограждение"],["🏢","Здание"]] },
    ],
  },
  {
    id: "fantasy", name: "Фэнтези", icon: "🧙", desc: "Магия, герои и сказочные приключения",
    categories: [
      { id: "magic", title: "Магия", cards: [["🪄","Палочка"],["✨","Заклинание"],["🧙","Маг"],["📜","Свиток"],["🔮","Шар"],["🧪","Зелье"]] },
      { id: "dragon", title: "Дракон", cards: [["🐉","Дракон"],["🔥","Огонь"],["🏰","Замок"],["🗡️","Меч"],["🛡️","Щит"],["💎","Сокровище"]] },
      { id: "knight", title: "Рыцарь", cards: [["🛡️","Щит"],["⚔️","Мечи"],["🏰","Замок"],["🐎","Конь"],["👑","Король"],["🏆","Турнир"]] },
      { id: "fairy", title: "Фея", cards: [["🧚","Фея"],["✨","Пыльца"],["🌸","Цветы"],["🪄","Волшебство"],["🦋","Бабочка"],["🌈","Радуга"]] },
      { id: "pirate", title: "Пират", cards: [["🏴‍☠️","Флаг"],["⚓","Якорь"],["🦜","Попугай"],["🗺️","Карта"],["💰","Золото"],["⛵","Корабль"]] },
      { id: "treasure", title: "Клад", cards: [["💎","Алмаз"],["🪙","Монета"],["🗝️","Ключ"],["📦","Сундук"],["🗺️","Карта"],["🏝️","Остров"]] },
    ],
  },
  {
    id: "jobs", name: "Профессии", icon: "🧑‍💼", desc: "Кто чем занимается и что использует в работе",
    categories: [
      { id: "medic", title: "Медик", cards: [["🧑‍⚕️","Врач"],["🩺","Стетоскоп"],["💉","Укол"],["🏥","Больница"],["💊","Лекарство"],["🚑","Скорая"]] },
      { id: "builder", title: "Строитель", cards: [["👷","Каска"],["🔨","Молоток"],["🧱","Кирпич"],["🏗️","Кран"],["📐","Чертёж"],["🪜","Лестница"]] },
      { id: "cook", title: "Повар", cards: [["👨‍🍳","Повар"],["🔪","Нож"],["🍳","Сковорода"],["🥘","Блюдо"],["🧂","Специи"],["🔥","Плита"]] },
      { id: "police", title: "Полиция", cards: [["👮","Офицер"],["🚓","Машина"],["🚨","Сирена"],["📻","Рация"],["🛡️","Защита"],["🚔","Патруль"]] },
      { id: "artist", title: "Художник", cards: [["🎨","Палитра"],["🖌️","Кисть"],["🖼️","Картина"],["✏️","Эскиз"],["🌈","Цвет"],["👨‍🎨","Мастер"]] },
      { id: "astronaut", title: "Космонавт", cards: [["👨‍🚀","Скафандр"],["🚀","Ракета"],["🌍","Земля"],["🌌","Космос"],["🛰️","Спутник"],["⭐","Звезда"]] },
    ],
  },
  {
    id: "times", name: "Времена", icon: "🍂", desc: "Сезоны, время суток и характерные признаки",
    categories: [
      { id: "spring", title: "Весна", cards: [["🌷","Тюльпан"],["🌱","Росток"],["🌦️","Дождь"],["🐦","Птицы"],["🌸","Цветение"],["☀️","Тепло"]] },
      { id: "summer", title: "Лето", cards: [["☀️","Солнце"],["🏖️","Пляж"],["🍉","Арбуз"],["🕶️","Очки"],["🌴","Пальма"],["🩴","Шлёпанцы"]] },
      { id: "autumn", title: "Осень", cards: [["🍂","Листья"],["🌧️","Дождь"],["☂️","Зонт"],["🎃","Тыква"],["🌰","Каштан"],["🧥","Куртка"]] },
      { id: "winter2", title: "Зима", cards: [["❄️","Снег"],["⛄","Снеговик"],["🧣","Шарф"],["🧤","Перчатки"],["🛷","Сани"],["☕","Горячее"]] },
      { id: "morning", title: "Утро", cards: [["🌅","Рассвет"],["☕","Кофе"],["⏰","Будильник"],["🪥","Щётка"],["🥣","Завтрак"],["📰","Новости"]] },
      { id: "evening", title: "Вечер", cards: [["🌇","Закат"],["🛋️","Диван"],["📺","Телевизор"],["🍵","Чай"],["🌙","Луна"],["💡","Лампа"]] },
    ],
  },
  {
    id: "shopping", name: "Покупки", icon: "🛍️", desc: "Магазины, товары и способы оплаты",
    categories: [
      { id: "clothes", title: "Одежда", cards: [["👕","Футболка"],["👖","Джинсы"],["🧥","Куртка"],["👗","Платье"],["🧢","Кепка"],["🧦","Носки"]] },
      { id: "shoes", title: "Обувь", cards: [["👟","Кроссовки"],["👞","Туфли"],["🥾","Ботинки"],["👢","Сапоги"],["🩴","Шлёпанцы"],["👠","Каблук"]] },
      { id: "beauty", title: "Красота", cards: [["💄","Помада"],["💅","Маникюр"],["🧴","Крем"],["🪞","Зеркало"],["🧼","Уход"],["🪮","Расчёска"]] },
      { id: "gadgets", title: "Гаджеты", cards: [["📱","Телефон"],["⌚","Часы"],["🎧","Наушники"],["💻","Ноутбук"],["📷","Камера"],["🔋","Пауэрбанк"]] },
      { id: "grocery", title: "Продукты", cards: [["🥛","Молоко"],["🍞","Хлеб"],["🥚","Яйца"],["🍎","Фрукты"],["🥕","Овощи"],["🧀","Сыр"]] },
      { id: "payment", title: "Оплата", cards: [["💳","Карта"],["💵","Наличные"],["🧾","Чек"],["📱","Телефон"],["🏧","Банкомат"],["🛒","Корзина"]] },
    ],
  },
  {
    id: "hobbies", name: "Хобби", icon: "🎨", desc: "Чем приятно заниматься в свободное время",
    categories: [
      { id: "photo", title: "Фото", cards: [["📷","Камера"],["📸","Снимок"],["🌄","Пейзаж"],["🤳","Селфи"],["🖼️","Галерея"],["💡","Свет"]] },
      { id: "garden", title: "Сад", cards: [["🌱","Росток"],["🌷","Цветок"],["🪴","Горшок"],["💧","Полив"],["🧤","Перчатки"],["🌿","Зелень"]] },
      { id: "fishing", title: "Рыбалка", cards: [["🎣","Удочка"],["🐟","Рыба"],["🪱","Наживка"],["🛶","Лодка"],["🌊","Вода"],["🧺","Улов"]] },
      { id: "craft", title: "Рукоделие", cards: [["🧶","Пряжа"],["🪡","Игла"],["✂️","Ножницы"],["🧵","Нить"],["🧷","Булавка"],["🎀","Декор"]] },
      { id: "reading", title: "Чтение", cards: [["📚","Книги"],["📖","Читать"],["🔖","Закладка"],["☕","Чай"],["🛋️","Кресло"],["💡","Лампа"]] },
      { id: "baking", title: "Выпечка", cards: [["🧁","Кекс"],["🍪","Печенье"],["🥧","Пирог"],["🧈","Масло"],["🥚","Яйцо"],["🔥","Духовка"]] },
    ],
  },
  {
    id: "games", name: "Игры", icon: "🎮", desc: "Настольные, цифровые и логические игры",
    categories: [
      { id: "chess", title: "Шахматы", cards: [["♟️","Пешка"],["♞","Конь"],["♜","Ладья"],["♛","Ферзь"],["♚","Король"],["🏁","Партия"]] },
      { id: "cards", title: "Карты", cards: [["♠️","Пики"],["♥️","Червы"],["♦️","Бубны"],["♣️","Трефы"],["🃏","Джокер"],["🎴","Колода"]] },
      { id: "arcade", title: "Аркада", cards: [["👾","Монстр"],["🕹️","Автомат"],["🎯","Очки"],["💥","Эффект"],["⭐","Бонус"],["🏆","Рекорд"]] },
      { id: "board", title: "Настолки", cards: [["🎲","Кубик"],["🧩","Фишки"],["🗺️","Поле"],["🏠","Клетка"],["👥","Игроки"],["🏆","Победа"]] },
      { id: "console", title: "Консоль", cards: [["🎮","Геймпад"],["📺","Экран"],["🎧","Гарнитура"],["💾","Сохранение"],["🏆","Ачивка"],["🕹️","Игра"]] },
      { id: "puzzle", title: "Головоломка", cards: [["🧩","Пазл"],["💡","Идея"],["🔐","Замок"],["🔢","Числа"],["🧠","Логика"],["❓","Задача"]] },
    ],
  },
  {
    id: "world", name: "Мир", icon: "🌍", desc: "Регионы, символы и известные места мира",
    categories: [
      { id: "europe", title: "Европа", cards: [["🇫🇷","Франция"],["🇮🇹","Италия"],["🇩🇪","Германия"],["🇪🇸","Испания"],["🏰","Замки"],["🚆","Поезда"]] },
      { id: "asia2", title: "Азия", cards: [["🇯🇵","Япония"],["🇨🇳","Китай"],["🇰🇷","Корея"],["🍜","Лапша"],["🏯","Храм"],["🌸","Сакура"]] },
      { id: "america", title: "Америка", cards: [["🇺🇸","США"],["🗽","Статуя"],["🏙️","Город"],["🌵","Пустыня"],["🏈","Футбол"],["🍔","Бургер"]] },
      { id: "africa2", title: "Африка", cards: [["🌍","Материк"],["🦁","Лев"],["🐘","Слон"],["🌴","Пальма"],["☀️","Жара"],["🏜️","Пустыня"]] },
      { id: "islands", title: "Острова", cards: [["🏝️","Остров"],["🌴","Пальма"],["🌊","Океан"],["🐚","Ракушка"],["⛵","Лодка"],["☀️","Солнце"]] },
      { id: "monuments", title: "Памятники", cards: [["🗼","Башня"],["🗽","Статуя"],["🏛️","Храм"],["🏰","Замок"],["🕌","Мечеть"],["⛩️","Ворота"]] },
    ],
  },
  {
    id: "safety", name: "Безопасность", icon: "🛡️", desc: "Сигналы, помощь и правила безопасности",
    categories: [
      { id: "fire", title: "Пожар", cards: [["🔥","Огонь"],["🧯","Огнетушитель"],["🚒","Пожарные"],["🚨","Тревога"],["💨","Дым"],["🚪","Выход"]] },
      { id: "rescue", title: "Спасение", cards: [["🛟","Круг"],["🚑","Скорая"],["🆘","SOS"],["📞","Звонок"],["🧑‍🚒","Спасатель"],["⛑️","Шлем"]] },
      { id: "warning", title: "Опасность", cards: [["⚠️","Внимание"],["🚫","Запрет"],["☢️","Радиация"],["☣️","Биориск"],["❗","Важно"],["🔺","Сигнал"]] },
      { id: "traffic", title: "ПДД", cards: [["🚦","Светофор"],["🛑","Стоп"],["🚸","Переход"],["🚧","Ремонт"],["⚠️","Знак"],["🚗","Авто"]] },
      { id: "cyber", title: "Киберзащита", cards: [["🔒","Пароль"],["🛡️","Защита"],["🔑","Ключ"],["💻","Компьютер"],["📧","Почта"],["⚠️","Фишинг"]] },
      { id: "home-safe", title: "Охрана дома", cards: [["🔐","Замок"],["🚪","Дверь"],["🔔","Сигнализация"],["📷","Камера"],["🛡️","Охрана"],["🚨","Тревога"]] },
    ],
  },
  {
    id: "events", name: "События", icon: "🎪", desc: "Яркие события, встречи и большие впечатления",
    categories: [
      { id: "wedding2", title: "Свадьба", cards: [["💍","Кольцо"],["👰","Невеста"],["🤵","Жених"],["💐","Букет"],["🥂","Тост"],["🎂","Торт"]] },
      { id: "festival", title: "Фестиваль", cards: [["🎪","Фестиваль"],["🎶","Музыка"],["🎟️","Вход"],["🎨","Искусство"],["🌈","Краски"],["🎉","Праздник"]] },
      { id: "circus", title: "Цирк", cards: [["🎪","Шатёр"],["🤡","Клоун"],["🎠","Карусель"],["🎈","Шары"],["🪄","Фокус"],["👏","Аплодисменты"]] },
      { id: "concert2", title: "Шоу", cards: [["🎤","Певец"],["🎸","Гитара"],["🎧","Звук"],["💡","Свет"],["🎟️","Вход"],["👏","Зрители"]] },
      { id: "vacation", title: "Отпуск", cards: [["🏖️","Пляж"],["🧳","Чемодан"],["✈️","Самолёт"],["📸","Фото"],["🕶️","Очки"],["🍹","Коктейль"]] },
      { id: "meetup", title: "Встреча", cards: [["👥","Друзья"],["☕","Кофе"],["💬","Разговор"],["📍","Место"],["📅","Дата"],["😊","Радость"]] },
    ],
  }
);

function associationCollectionById(id) {
  return ASSOCIATION_COLLECTION_DEFS.find((x) => x.id === id) || ASSOCIATION_COLLECTION_DEFS[0];
}
const VISUAL_WORD_CONFLICT_GROUPS = Object.freeze({
  animals: ["animals_mammal", "animals_birds", "animals_small", "animals_water", "prehistoric"],
  nature: ["astronomy", "weather", "seasons", "wild_nature", "geology", "water_nature", "coast"],
  food: ["fruit_family", "vegetables", "seasoning", "bakery", "dessert", "beverages", "kitchenware"],
  space: ["astronomy", "school_science", "consumer_tech"],
  transport: ["urban", "transport_road", "transport_rail", "transport_air", "transport_water", "tourism"],
  home: ["kitchenware", "home_interior", "home_rooms", "home_chores", "garden", "workplace"],
  sports: ["ball_sports", "racket_sports", "winter_sports", "fitness", "water_sports", "combat_sports"],
  travel: ["tourism", "outdoor_trip", "transport_air", "transport_rail"],
  celebration: ["celebrations", "ceremonies"],
  music: ["music", "music_genres", "stage_media"],
  cinema: ["screen_media", "stage_media"],
  school: ["education", "school_science"],
  tech: ["consumer_tech", "digital", "tech_work"],
  health: ["human_body", "fitness", "daily_routine"],
  citylife: ["urban", "hospitality", "retail", "transport_rail"],
  jobs: ["professions", "workplace", "creative_work", "tech_work"],
  times: ["seasons", "daily_routine", "timekeeping", "weather"],
  shopping: ["retail", "clothing", "fashion_accessories", "beauty", "consumer_tech"],
  hobbies: ["creative_work", "garden", "water_activity", "literature", "bakery"],
  games: ["games_table", "digital_entertainment"],
  world: ["tourism", "urban"],
  safety: ["workshop", "digital", "urban"],
  events: ["celebrations", "ceremonies", "stage_media", "hospitality"],
});
function associationCollectionCategories(id) {
  const collection = associationCollectionById(id);
  return collection.categories.map((cat) => ({
    id: `visual:${collection.id}:${cat.id}`,
    title: cat.title,
    visual: true,
    visualCollection: collection.id,
    visualCollectionName: collection.name,
    difficulty: 2,
    semanticGroup: collection.id === "space" ? "astronomy"
      : collection.id === "food" && cat.id === "fruit" ? "fruit_family"
      : collection.id === "food" ? "food"
      : collection.id === "transport" ? "transport"
      : collection.id === "safety" ? "safety"
      : collection.id,
    conflictGroups: [
      ...(VISUAL_WORD_CONFLICT_GROUPS[collection.id] || []),
      ...(collection.id === "safety" && cat.id === "cyber" ? ["tech_work"] : []),
      ...(collection.id === "animals" && cat.id === "ocean" ? ["coast_water"] : []),
    ],
    words: cat.cards.map(([emoji]) => emoji),
    visualLabels: Object.fromEntries(cat.cards),
  }));
}
function allAssociationCategories() {
  return ASSOCIATION_COLLECTION_DEFS.flatMap((collection) => associationCollectionCategories(collection.id));
}
function visualCategoryById(id) {
  if (!String(id || "").startsWith("visual:")) return null;
  const [, collectionId, categoryId] = String(id).split(":");
  const collection = ASSOCIATION_COLLECTION_DEFS.find((x) => x.id === collectionId);
  const category = collection?.categories.find((x) => x.id === categoryId);
  return collection && category ? { collection, category, id: `visual:${collection.id}:${category.id}` } : null;
}
function normalizeCardSourceMode(value) {
  return ["words", "pictures", "all"].includes(value) ? value : "all";
}
function visualDiscoveredIds(p = typeof profile !== "undefined" ? profile : null) {
  const ids = new Set(Array.isArray(p?.visualDiscovered) ? p.visualDiscovered : []);
  for (const collection of ASSOCIATION_COLLECTION_DEFS) {
    const completed = p?.associationCollections?.[collection.id]?.completedCategories || [];
    completed.forEach((id) => ids.add(id));
  }
  return ids;
}
function visualDiscoveredCategoryCount(p = typeof profile !== "undefined" ? profile : null) {
  return visualDiscoveredIds(p).size;
}
function totalVisualCategoryCount() {
  return ASSOCIATION_COLLECTION_DEFS.reduce((n, collection) => n + collection.categories.length, 0);
}
function associationCollectionProgress(id, p = typeof profile !== "undefined" ? profile : null) {
  const collection = associationCollectionById(id), raw = p?.associationCollections?.[collection.id] || {};
  const completed = Array.isArray(raw.completedCategories) ? raw.completedCategories : [];
  return {
    plays: +raw.plays || 0,
    wins: +raw.wins || 0,
    completedCategories: completed,
    completed: completed.filter((catId) => collection.categories.some((c) => `visual:${collection.id}:${c.id}` === catId)).length,
    total: collection.categories.length,
  };
}

const CHAPTER_SIZE = 10;
const CHAPTER_NAMES = [
  "Первые связи",
  "Знакомые миры",
  "Переплетения",
  "Тонкие намёки",
  "Большой словарь",
  "Мастер ассоциаций",
  "Скрытые смыслы",
  "Словесный лабиринт",
  "Точные связи",
  "Эрудит",
  "Большая энциклопедия",
  "За гранью очевидного",
];

function chapterStarsForProfile(p, number) {
  const start = (number - 1) * CHAPTER_SIZE + 1;
  return Array.from({ length: CHAPTER_SIZE }, (_, i) => +(p.starsByLevel?.[start + i] || 0));
}
function completedChapterCount(p) {
  const maxChapter = Math.max(1, Math.ceil(Math.max(1, +(p.currentLevel || 1) - 1) / CHAPTER_SIZE));
  let count = 0;
  for (let n = 1; n <= maxChapter; n++) if (chapterStarsForProfile(p, n).every((x) => x > 0)) count++;
  return count;
}
function perfectChapterCount(p) {
  const maxChapter = Math.max(1, Math.ceil(Math.max(1, +(p.currentLevel || 1) - 1) / CHAPTER_SIZE));
  let count = 0;
  for (let n = 1; n <= maxChapter; n++) if (chapterStarsForProfile(p, n).every((x) => x === 3)) count++;
  return count;
}
function discoveredCategoryCount(p) {
  if (!BANK.length) return new Set(p.discovered || []).size;
  const available = new Set(BANK.map((c) => c.id));
  return new Set((p.discovered || []).filter((id) => available.has(id))).size;
}
function hasDiscoveredAllCategories(p) {
  if (!BANK.length) return false;
  const discovered = new Set(p.discovered || []);
  return BANK.every((c) => discovered.has(c.id));
}

const SPECIAL_LEVELS = [
  { id: "no-hints", icon: "◈", title: "Без подсказок", desc: "Подсказки отключены", offset: 5, noHints: true },
  { id: "precise", icon: "◇", title: "Точный расклад", desc: "Доступна только одна отмена", offset: 10, maxUndos: 1 },
  { id: "one-recycle", icon: "↻", title: "Одна прокрутка", desc: "Колоду можно вернуть только один раз", offset: 15, maxRecycles: 1 },
  { id: "big-mix", icon: "✦", title: "Большой набор", desc: "Больше категорий и слов", offset: 20, bigMix: true },
];

const THEME_DEFS = [
  { id: "violet", name: "Фиолетовая", stars: 0, rarity: "common", source: collectibleSource("starter", "Изначально") },
  { id: "ocean", name: "Океан", stars: 30, rarity: "common", source: collectibleSource("campaign_stars", "Звёзды кампании", { stars:30 }) },
  { id: "sunset", name: "Закат", stars: 75, rarity: "common", source: collectibleSource("campaign_stars", "Звёзды кампании", { stars:75 }) },
  { id: "paper", name: "Бумага", stars: 100, rarity: "common", source: collectibleSource("campaign_stars", "Звёзды кампании", { stars:100 }) },
  { id: "aurora", name: "Сияние", stars: 150, rarity: "uncommon", source: collectibleSource("campaign_stars", "Звёзды кампании", { stars:150 }) },
  { id: "neon", name: "Неон", stars: 225, rarity: "uncommon", source: collectibleSource("campaign_stars", "Звёзды кампании", { stars:225 }) },
  { id: "forest", name: "Лес", stars: 300, rarity: "uncommon", source: collectibleSource("campaign_stars", "Звёзды кампании", { stars:300 }) },
  { id: "frost", name: "Иней", stars: 375, rarity: "rare", source: collectibleSource("campaign_stars", "Звёзды кампании", { stars:375 }) },
  { id: "candy", name: "Конфетная", stars: 450, rarity: "rare", source: collectibleSource("campaign_stars", "Звёзды кампании", { stars:450 }) },
  { id: "midnight", name: "Полночь", stars: 550, rarity: "rare", source: collectibleSource("campaign_stars", "Звёзды кампании", { stars:550 }) },
  { id: "gold", name: "Золото", stars: 700, rarity: "rare", source: collectibleSource("campaign_stars", "Звёзды кампании", { stars:700 }) },
  { id: "galaxy", name: "Галактика", stars: 1000, rarity: "epic", source: collectibleSource("campaign_stars", "Звёзды кампании", { stars:1000 }) },
];
const CARD_BACK_DEFS = [
  { id: "classic", name: "Классика", desc: "Базовая рубашка", minAchievements: 0 , rarity: "common", source: collectibleSource("starter", "Изначально") },
  { id: "prism", name: "Призма", desc: "За 4 достижения", minAchievements: 4 , rarity: "uncommon", source: collectibleSource("achievements", "Достижения", { count:4 }) },
  { id: "constellation", name: "Созвездия", desc: "За 8 достижений", minAchievements: 8 , rarity: "uncommon", source: collectibleSource("achievements", "Достижения", { count:8 }) },
  { id: "trophy", name: "Трофей", desc: "За 12 достижений", minAchievements: 12 , rarity: "rare", source: collectibleSource("achievements", "Достижения", { count:12 }) },
  { id: "mosaic", name: "Мозаика", desc: "За 16 достижений", minAchievements: 16 , rarity: "rare", source: collectibleSource("achievements", "Достижения", { count:16 }) },
  { id: "velvet", name: "Бархат", desc: "За 20 достижений", minAchievements: 20 , rarity: "epic", source: collectibleSource("achievements", "Достижения", { count:20 }) },
  { id: "glacier", name: "Ледник", desc: "За 24 достижения", minAchievements: 24 , rarity: "epic", source: collectibleSource("achievements", "Достижения", { count:24 }) },
  { id: "lotus", name: "Бамбук", desc: "За 28 достижений", minAchievements: 28 , rarity: "epic", source: collectibleSource("achievements", "Достижения", { count:28 }) },
  { id: "duelist", name: "Дуэлянт", desc: "За 10 побед в дуэлях", achievement: "duelWins10", rare: true , rarity: "rare", source: collectibleSource("achievement", "Достижение", { id:"duelWins10" }) },
  { id: "anniversary", name: "Годовщина", desc: "За 365 дней в игре", achievement: "visits365", rare: true , rarity: "epic", source: collectibleSource("achievement", "Достижение", { id:"visits365" }) },
  { id: "crown", name: "Корона", desc: "За идеальную главу", achievement: "chapterPerfect1", rare: true , rarity: "rare", source: collectibleSource("achievement", "Достижение", { id:"chapterPerfect1" }) },
  { id: "ember", name: "Пламя", desc: "За серию 30 дней", achievement: "streak30", rare: true , rarity: "rare", source: collectibleSource("achievement", "Достижение", { id:"streak30" }) },
  { id: "master", name: "Мастер", desc: "За комбо ×10", achievement: "combo10", rare: true , rarity: "rare", source: collectibleSource("achievement", "Достижение", { id:"combo10" }) },
  { id: "atlas", name: "Атлас", desc: "За всю коллекцию категорий", achievement: "collectorAll", rare: true , rarity: "epic", source: collectibleSource("achievement", "Достижение", { id:"collectorAll" }) },
  { id: "chronicle", name: "Хроника", desc: "За 100 ежедневных раскладов", achievement: "daily100", rare: true , rarity: "epic", source: collectibleSource("achievement", "Достижение", { id:"daily100" }) },
  { id: "phoenix", name: "Феникс", desc: "За 25 особых уровней", achievement: "special25", rare: true , rarity: "epic", source: collectibleSource("achievement", "Достижение", { id:"special25" }) },
  { id: "legend", name: "Легенда", desc: "За 3 идеальные главы", achievement: "chapterPerfect3", rare: true , rarity: "epic", source: collectibleSource("achievement", "Достижение", { id:"chapterPerfect3" }) },
  { id: "obsidian", name: "Обсидиан", desc: "За 5 идеальных глав", achievement: "chapterPerfect5", rare: true , rarity: "epic", source: collectibleSource("achievement", "Достижение", { id:"chapterPerfect5" }) },
  { id: "midnight-grid", name: "Ночная сетка", desc: "За 2 достижения", minAchievements: 2 , rarity: "common", source: collectibleSource("achievements", "Достижения", { count:2 }) },
  { id: "sunrise", name: "Рассвет", desc: "За 6 достижений", minAchievements: 6 , rarity: "uncommon", source: collectibleSource("achievements", "Достижения", { count:6 }) },
  { id: "lion", name: "Лев", desc: "За открытие всех карточек с рисунками", achievement: "allPictures", rare: true , rarity: "epic", source: collectibleSource("achievement", "Достижение", { id:"allPictures" }) },
  { id: "parrot", name: "Птица-говорун", desc: "За открытие всех карточек со словами", achievement: "allWords", rare: true , rarity: "epic", source: collectibleSource("achievement", "Достижение", { id:"allWords" }) },
  { id: "grand-trophy", name: "Кубок", desc: "За все достижения", achievement: "allAchievements", rare: true , rarity: "epic", source: collectibleSource("achievement", "Достижение", { id:"allAchievements" }) },
];

function achievementMode90Counts(p = profile) {
  const modeStats = p?.modeStats || {};
  return {
    classic: +(p?.stats?.levelsCompleted || 0),
    daily: +(p?.stats?.dailyCompleted || 0),
    zen: +(p?.stats?.calmCompleted || 0),
    pictures: +(p?.stats?.collectionGamesCompleted || 0),
    duel: +(p?.stats?.challengesCompleted || 0),
    time: +(modeStats.time?.completed || 0),
    moves: +(modeStats.moves?.completed || 0),
    combo: +(modeStats.combo?.completed || 0),
    noMistakes: +(modeStats.noMistakes?.completed || 0),
    onePass: +(modeStats.onePass?.completed || 0),
    hardcore: +(modeStats.hardcore?.completed || 0),
  };
}
function retro90AchievementReady(p = profile) {
  return Object.values(achievementMode90Counts(p)).every((value) => value >= 90);
}
function retro90AchievementProgress(p = profile) {
  const counts = achievementMode90Counts(p);
  return Math.min(...Object.values(counts).map((value) => Math.max(0, +value || 0)));
}

const ACHIEVEMENTS = [
  {
    id: "first",
    icon: "✦",
    title: "Первый расклад",
    desc: "Пройти один уровень",
    test: (p) => p.stats.levelsCompleted >= 1,
  },
  {
    id: "ten",
    icon: "10",
    title: "Вошёл во вкус",
    desc: "Пройти 10 уровней",
    test: (p) => p.stats.levelsCompleted >= 10,
  },
  {
    id: "fifty",
    icon: "50",
    title: "Словасьянсер",
    desc: "Пройти 50 уровней",
    test: (p) => p.stats.levelsCompleted >= 50,
  },
  {
    id: "hundred",
    icon: "★",
    title: "Мастер ассоциаций",
    desc: "Пройти 100 уровней",
    test: (p) => p.stats.levelsCompleted >= 100,
  },
  {
    id: "clean",
    icon: "★★★",
    title: "Чистая работа",
    desc: "Получить 3 звезды",
    test: (p) => p.stats.tripleStarWins >= 1,
  },
  {
    id: "perfect10",
    icon: "♛",
    title: "Перфекционист",
    desc: "10 уровней на 3 звезды",
    test: (p) => p.stats.tripleStarWins >= 10,
  },
  {
    id: "nohint",
    icon: "?",
    title: "Самостоятельный",
    desc: "20 побед без подсказок",
    test: (p) => p.stats.noHintWins >= 20,
  },
  {
    id: "noundo",
    icon: "↶",
    title: "Без возврата",
    desc: "20 побед без отмен",
    test: (p) => p.stats.noUndoWins >= 20,
  },
  { id: "discover25", icon: "▦25", title: "Первые открытия", desc: "Открыть 25 разных категорий", test: (p) => discoveredCategoryCount(p) >= 25 },
  { id: "discover50", icon: "▦50", title: "Исследователь", desc: "Открыть 50 разных категорий", test: (p) => discoveredCategoryCount(p) >= 50 },
  { id: "discover75", icon: "▦75", title: "Знаток ассоциаций", desc: "Открыть 75 разных категорий", test: (p) => discoveredCategoryCount(p) >= 75 },
  {
    id: "collector",
    icon: "▦100",
    title: "Коллекционер",
    desc: "Открыть 100 разных категорий",
    test: (p) => discoveredCategoryCount(p) >= 100,
  },
  {
    id: "encyclopedia",
    icon: "▦125",
    title: "Энциклопедия",
    desc: "Открыть 125 разных категорий",
    test: (p) => discoveredCategoryCount(p) >= 125,
  },
  {
    id: "daily",
    icon: "☀",
    title: "Доброе утро",
    desc: "Пройти ежедневный расклад",
    test: (p) => p.stats.dailyCompleted >= 1,
  },
  { id: "combo5", icon: "×5", title: "На волне", desc: "Сделать комбо ×5", test: (p) => (p.stats.maxDragCombo || 0) >= 5 },
  { id: "special5", icon: "◆", title: "Особый случай", desc: "Пройти 5 особых уровней", test: (p) => (p.stats.specialCompleted || 0) >= 5 },
  { id: "chapter1", icon: "Ⅰ", title: "Первая глава", desc: "Полностью пройти одну главу", test: (p) => completedChapterCount(p) >= 1 },
  { id: "chapter3", icon: "Ⅲ", title: "Книжный червь", desc: "Полностью пройти 3 главы", test: (p) => completedChapterCount(p) >= 3 },
  { id: "chapter5", icon: "Ⅴ", title: "Большая история", desc: "Полностью пройти 5 глав", test: (p) => completedChapterCount(p) >= 5 },
  { id: "chapterPerfect1", icon: "♛", title: "Идеальная глава", desc: "Получить 30/30 ★ в одной главе", rare: true, test: (p) => perfectChapterCount(p) >= 1 },
  { id: "chapterPerfect3", icon: "♛", title: "Безупречный путь", desc: "Получить 30/30 ★ в трёх главах", rare: true, test: (p) => perfectChapterCount(p) >= 3 },
  { id: "chapterPerfect5", icon: "✦", title: "Легенда Словасьянса", desc: "Получить 30/30 ★ в пяти главах", rare: true, test: (p) => perfectChapterCount(p) >= 5 },
  { id: "streak7", icon: "🔥", title: "Привычка", desc: "Серия 7 дней", test: (p) => p.daily.bestStreak >= 7 },
  {
    id: "streak30",
    icon: "🔥",
    title: "Постоянство",
    desc: "Серия 30 дней",
    test: (p) => p.daily.bestStreak >= 30,
  },
  { id: "twentyfive", icon: "25", title: "Уверенный старт", desc: "Пройти 25 уровней", test: (p) => p.stats.levelsCompleted >= 25 },
  { id: "twofifty", icon: "250", title: "Длинная дистанция", desc: "Пройти 250 уровней", test: (p) => p.stats.levelsCompleted >= 250 },
  { id: "fivehundred", icon: "500", title: "Неостановимый", desc: "Пройти 500 уровней", rare: true, test: (p) => p.stats.levelsCompleted >= 500 },
  { id: "perfect25", icon: "★25", title: "Четверть сотни", desc: "25 уровней на 3 звезды", test: (p) => p.stats.tripleStarWins >= 25 },
  { id: "perfect50", icon: "★50", title: "Безупречная форма", desc: "50 уровней на 3 звезды", test: (p) => p.stats.tripleStarWins >= 50 },
  { id: "perfect100", icon: "★100", title: "Золотой стандарт", desc: "100 уровней на 3 звезды", rare: true, test: (p) => p.stats.tripleStarWins >= 100 },
  { id: "nohint50", icon: "?50", title: "Своя голова", desc: "50 побед без подсказок", test: (p) => p.stats.noHintWins >= 50 },
  { id: "nohint100", icon: "?100", title: "Без подсказок", desc: "100 побед без подсказок", rare: true, test: (p) => p.stats.noHintWins >= 100 },
  { id: "noundo50", icon: "↶50", title: "Без оглядки", desc: "50 побед без отмен", test: (p) => p.stats.noUndoWins >= 50 },
  { id: "noundo100", icon: "↶100", title: "Только вперёд", desc: "100 побед без отмен", rare: true, test: (p) => p.stats.noUndoWins >= 100 },
  { id: "collectorAll", icon: "▦✓", title: "Полная коллекция", desc: "Открыть все категории", rare: true, test: (p) => hasDiscoveredAllCategories(p) },
  { id: "games100", icon: "100", title: "Сотня партий", desc: "Сыграть 100 партий", test: (p) => (p.stats.gamesPlayed || 0) >= 100 },
  { id: "daily7", icon: "☀7", title: "Ежедневная неделя", desc: "Пройти 7 ежедневных раскладов", test: (p) => p.stats.dailyCompleted >= 7 },
  { id: "daily30", icon: "☀30", title: "Ежедневный месяц", desc: "Пройти 30 ежедневных раскладов", test: (p) => p.stats.dailyCompleted >= 30 },
  { id: "daily100", icon: "☀100", title: "Ритуал", desc: "Пройти 100 ежедневных раскладов", rare: true, test: (p) => p.stats.dailyCompleted >= 100 },
  { id: "combo3", icon: "×3", title: "Точная рука", desc: "Сделать ручное комбо ×3", test: (p) => (p.stats.maxDragCombo || 0) >= 3 },
  { id: "combo10", icon: "×10", title: "Мастер движений", desc: "Сделать ручное комбо ×10", rare: true, test: (p) => (p.stats.maxDragCombo || 0) >= 10 },
  { id: "special10", icon: "◆10", title: "Любитель испытаний", desc: "Пройти 10 особых уровней", test: (p) => (p.stats.specialCompleted || 0) >= 10 },
  { id: "special25", icon: "◆25", title: "Испытатель", desc: "Пройти 25 особых уровней", rare: true, test: (p) => (p.stats.specialCompleted || 0) >= 25 },
  { id: "duelGold10", icon: "🥇10", title: "Золотой дуэлянт", desc: "Получить 10 золотых медалей в дуэлях", test: (p) => (p.stats.duelGold || 0) >= 10 },
  { id: "allPictures", icon: "🦁", title: "Галерея собрана", desc: "Открыть все карточки с рисунками", rare: true, legendary: true, test: (p) => typeof hasDiscoveredAllVisualCards === "function" && hasDiscoveredAllVisualCards(p) },
  { id: "allWords", icon: "🦜", title: "Птица-говорун", desc: "Открыть все карточки со словами", rare: true, legendary: true, test: (p) => typeof hasDiscoveredAllWordCards === "function" && hasDiscoveredAllWordCards(p) },
  { id: "retro90", icon: "📼", title: "Я из 90-х", desc: "Пройти все режимы по 90 раз. Награда: уникальный титул «Я из 90-х»", rare: true, legendary: true, test: (p) => retro90AchievementReady(p) },
  { id: "allAchievements", icon: "🏆", title: "Абсолютный коллекционер", desc: "Открыть все остальные достижения", rare: true, legendary: true, test: (p) => ACHIEVEMENTS.filter((a) => a.id !== "allAchievements").every((a) => p.achievements.includes(a.id)) },
];
const DEFAULT_STATS = {
  levelsCompleted: 0,
  gamesPlayed: 0,
  categoriesCompleted: 0,
  tripleStarWins: 0,
  noHintWins: 0,
  noUndoWins: 0,
  hints: 0,
  undos: 0,
  autoMoves: 0,
  stockDraws: 0,
  restarts: 0,
  dailyCompleted: 0,
  maxCombo: 0,
  maxDragCombo: 0,
  deadlocks: 0,
  specialCompleted: 0,
  weeklyCompleted: 0,
  monthlyCompleted: 0,
  challengesCompleted: 0,
  calmCompleted: 0,
  collectionGamesCompleted: 0,
  bestMarathon: 0,
  bestHardcore: 0,
  totalMoves: 0,
  personalRecords: 0,
  masteredCategories: 0,
  masteredPictureCategories: 0,
  chapterFinalsCompleted: 0,
  bonusObjectivesCompleted: 0,
  seriesWins: 0,
  duelMatches: 0,
  duelWins: 0,
  duelLosses: 0,
  duelDraws: 0,
  duelGold: 0,
  duelSilver: 0,
  duelBronze: 0,
  duelXp: 0,
  duelRating: 0,
};

const WEEKLY_DEFS = [
  { id: "levels", icon: "▶", title: "Большая неделя", desc: "Пройти 70 любых уровней", metric: "levels", goal: 70, rewardXp: 1400 },
  { id: "stars", icon: "★", title: "Звёздный марафон", desc: "Заработать 180 звёзд в любых режимах", metric: "stars", goal: 180, rewardXp: 1450 },
  { id: "noHints", icon: "?", title: "Своя голова", desc: "Пройти 55 любых уровней без подсказок", metric: "noHints", goal: 55, rewardXp: 1500 },
  { id: "perfect", icon: "★★★", title: "Идеальная неделя", desc: "Закрыть 40 любых уровней на 3 звезды", metric: "perfect", goal: 40, rewardXp: 1550 },
  { id: "categories", icon: "▦", title: "Большой собиратель", desc: "Собрать 320 категорий в любых режимах", metric: "categories", goal: 320, rewardXp: 1450 },
];

const MONTHLY_DEFS = [
  { id: "levels", icon: "▶", title: "Большой месяц", desc: "Пройти 225 любых уровней", metric: "levels", goal: 225, rewardXp: 4500 },
  { id: "stars", icon: "★", title: "Созвездие месяца", desc: "Заработать 575 звёзд в любых режимах", metric: "stars", goal: 575, rewardXp: 4650 },
  { id: "noHints", icon: "?", title: "Месяц без подсказок", desc: "Пройти 175 любых уровней без подсказок", metric: "noHints", goal: 175, rewardXp: 4800 },
  { id: "perfect", icon: "★★★", title: "Идеальный месяц", desc: "Закрыть 130 любых уровней на 3 звезды", metric: "perfect", goal: 130, rewardXp: 5000 },
  { id: "categories", icon: "▦", title: "Архив месяца", desc: "Собрать 1025 категорий в любых режимах", metric: "categories", goal: 1025, rewardXp: 4650 },
];

const EFFECT_DEFS = [
  { id: "spark", name: "Искры", desc: "Базовый эффект", minAchievements: 0 },
  { id: "confetti", name: "Конфетти", desc: "За 8 достижений", minAchievements: 8 },
  { id: "petals", name: "Лепестки", desc: "За идеальную главу", achievement: "chapterPerfect1" },
  { id: "comet", name: "Кометы", desc: "За ручное комбо ×10", achievement: "combo10", rare: true },
  { id: "aurora", name: "Сияние", desc: "За 3 недельных испытания", minWeekly: 3, rare: true },
  { id: "legend", name: "Легенда", desc: "За 5 идеальных глав", achievement: "chapterPerfect5", rare: true },
  { id: "duel", name: "Искры дуэли", desc: "За 25 побед в дуэлях", achievement: "duelWins25", rare: true },
  { id: "moon", name: "Лунное сияние", desc: "За первое месячное испытание", minMonthly: 1, rare: true },
  { id: "fireworks", name: "Фейерверк", desc: "За 6 достижений", minAchievements: 6 },
  { id: "ribbons", name: "Ленты", desc: "За 12 достижений", minAchievements: 12 },
  { id: "stars", name: "Звёздный дождь", desc: "За 18 достижений", minAchievements: 18 },
  { id: "crown-rain", name: "Дождь корон", desc: "За 10 золотых медалей", achievement: "duelGold10", rare: true },
];

const FRAME_DEFS = [
  { id: "none", name: "Без рамки", chapter: 0, hue: 250 , rarity: "common", source: collectibleSource("starter", "Изначально") },
  { id: "chapter1", name: "Первые связи", chapter: 1, hue: 258 , rarity: "common", source: collectibleSource("campaign", "Кампания", { chapter:1 }) },
  { id: "chapter2", name: "Знакомые миры", chapter: 2, hue: 195 , rarity: "common", source: collectibleSource("campaign", "Кампания", { chapter:2 }) },
  { id: "chapter3", name: "Переплетения", chapter: 3, hue: 335 , rarity: "uncommon", source: collectibleSource("campaign", "Кампания", { chapter:3 }) },
  { id: "chapter4", name: "Тонкие намёки", chapter: 4, hue: 145 , rarity: "uncommon", source: collectibleSource("campaign", "Кампания", { chapter:4 }) },
  { id: "chapter5", name: "Большой словарь", chapter: 5, hue: 42 , rarity: "uncommon", source: collectibleSource("campaign", "Кампания", { chapter:5 }) },
  { id: "chapter6", name: "Мастер ассоциаций", chapter: 6, hue: 285 , rarity: "rare", source: collectibleSource("campaign", "Кампания", { chapter:6 }) },
  { id: "chapter7", name: "Скрытые смыслы", chapter: 7, hue: 12 , rarity: "rare", source: collectibleSource("campaign", "Кампания", { chapter:7 }) },
  { id: "chapter8", name: "Словесный лабиринт", chapter: 8, hue: 174 , rarity: "rare", source: collectibleSource("campaign", "Кампания", { chapter:8 }) },
  { id: "chapter9", name: "Точные связи", chapter: 9, hue: 220 , rarity: "rare", source: collectibleSource("campaign", "Кампания", { chapter:9 }) },
  { id: "chapter10", name: "Эрудит", chapter: 10, hue: 55 , rarity: "rare", source: collectibleSource("campaign", "Кампания", { chapter:10 }) },
  { id: "chapter11", name: "Большая энциклопедия", chapter: 11, hue: 316 , rarity: "epic", source: collectibleSource("campaign", "Кампания", { chapter:11 }) },
  { id: "chapter12", name: "За гранью очевидного", chapter: 12, hue: 105 , rarity: "epic", source: collectibleSource("campaign", "Кампания", { chapter:12 }) },
  { id: "duel-silver", name: "Серебряный дуэлянт", minDuelXp: 30, hue: 210 , rarity: "uncommon", source: collectibleSource("duel", "Дуэли", { xp:30 }) },
  { id: "duel-gold", name: "Золотой дуэлянт", minDuelXp: 75, hue: 45 , rarity: "rare", source: collectibleSource("duel", "Дуэли", { xp:75 }) },
];

const SOUND_PACK_DEFS = [
  { id: "classic", name: "Классика", minDuelXp: 0 },
  { id: "crystal", name: "Кристалл", minDuelXp: 20 },
  { id: "arcade", name: "Аркада", minDuelXp: 50 },
  { id: "royal", name: "Королевский", minDuelXp: 100 },
];

const TITLE_DEFS = [
  { id: "player", name: "Игрок", icon: "◇" , rarity: "common", source: collectibleSource("starter", "Изначально") },
  { id: "rank-linker", name: "Связист", icon: "⌁", minXp: xpThresholdForRank(5) , rarity: "common", source: collectibleSource("rank", "Ранг", { rank:5 }) },
  { id: "rank-associator", name: "Ассоциатор", icon: "✦", minXp: xpThresholdForRank(10) , rarity: "uncommon", source: collectibleSource("rank", "Ранг", { rank:10 }) },
  { id: "rank-researcher", name: "Исследователь", icon: "◎", minXp: xpThresholdForRank(20) , rarity: "uncommon", source: collectibleSource("rank", "Ранг", { rank:20 }) },
  { id: "rank-erudite", name: "Эрудит", icon: "▦", minXp: xpThresholdForRank(30) , rarity: "rare", source: collectibleSource("rank", "Ранг", { rank:30 }) },
  { id: "rank-master", name: "Мастер", icon: "★", minXp: xpThresholdForRank(40) , rarity: "rare", source: collectibleSource("rank", "Ранг", { rank:40 }) },
  { id: "rank-archivist", name: "Архивариус", icon: "♜", minXp: xpThresholdForRank(50) , rarity: "rare", source: collectibleSource("rank", "Ранг", { rank:50 }) },
  { id: "rank-legend", name: "Легенда", icon: "♛", minXp: xpThresholdForRank(75) , rarity: "epic", source: collectibleSource("rank", "Ранг", { rank:75 }) },
  { id: "collector", name: "Коллекционер", icon: "▦", achievement: "collector" , rarity: "rare", source: collectibleSource("achievement", "Достижение", { id:"collector" }) },
  { id: "perfectionist", name: "Перфекционист", icon: "★", achievement: "perfect10" , rarity: "rare", source: collectibleSource("achievement", "Достижение", { id:"perfect10" }) },
  { id: "hand", name: "Мастер движений", icon: "×", achievement: "combo10" , rarity: "rare", source: collectibleSource("achievement", "Достижение", { id:"combo10" }) },
  { id: "explorer", name: "Исследователь", icon: "◎", achievement: "discover75" , rarity: "rare", source: collectibleSource("achievement", "Достижение", { id:"discover75" }) },
  { id: "legend", name: "Легенда", icon: "✦", achievement: "chapterPerfect5" , rarity: "rare", source: collectibleSource("achievement", "Достижение", { id:"chapterPerfect5" }) },
];

function achievementRarity(a) { return a?.legendary ? "epic" : a?.rare ? "rare" : "uncommon"; }
function achievementTitleDef(a) {
  return a ? { id: `achievement:${a.id}`, name: a.title, icon: a.icon || "★", achievement: a.id, rarity:achievementRarity(a), source:collectibleSource("achievement", "Достижение", { id:a.id }) } : null;
}
function titleDefById(id) {
  const fixed = TITLE_DEFS.find((x) => x.id === id);
  if (fixed) return fixed;
  if (String(id || "").startsWith("achievement:")) {
    const achievement = ACHIEVEMENTS.find((a) => a.id === String(id).slice(12));
    return achievementTitleDef(achievement);
  }
  return null;
}
function availableTitleDefs(p) {
  const result = [], seen = new Set();
  const add = (def) => { if (def && !seen.has(def.name)) { seen.add(def.name); result.push(def); } };
  add(TITLE_DEFS[0]);
  TITLE_DEFS.slice(1).forEach((def) => { if ((!def.achievement || p?.achievements?.includes(def.achievement)) && (!def.minXp || (+p?.xp || 0) >= def.minXp)) add(def); });
  (p?.achievements || []).forEach((id) => add(achievementTitleDef(ACHIEVEMENTS.find((a) => a.id === id))));
  return result;
}

// Shared collection foundation for future Mascot Home objects and relics.
const MASCOT_HOME_ITEM_DEFS = Object.freeze([]);
const RELIC_DEFS = Object.freeze([
  Object.freeze({ id:"first-world-seal", name:"Печать первого мира", icon:"◈", rarity:"rare", source:collectibleSource("campaign", "Кампания", { world:1 }), unlockText:"Пройди первые 100 уровней кампании.", lore:"Знак того, что первая большая дорога Словасьянса пройдена от начала до конца.", unlocked:(p)=>+(p?.stats?.levelsCompleted||0)>=100 }),
  Object.freeze({ id:"fox-trust-mark", name:"Знак лисьего доверия", icon:"⌁", rarity:"rare", source:collectibleSource("mascot", "Личная история Лиса", { id:"fox" }), unlockText:"Доведи Лиса до 5-го уровня и заверши все его личные задания.", lore:"Лис оставляет этот знак только тому, кого перестал считать случайным попутчиком.", unlocked:(p)=>+(p?.mascotProgress?.fox?.level||0)>=5 && (p?.mascotProgress?.fox?.completedQuests||[]).length>=6 }),
  Object.freeze({ id:"duelist-crown", name:"Знак десяти корон", icon:"♜", rarity:"rare", source:collectibleSource("achievement", "Достижение", { id:"duelGold10" }), unlockText:"Получи достижение за 10 золотых медалей в дуэлях.", lore:"Небольшой знак побед, которые пришлось доказать другому игроку, а не только самому себе.", unlocked:(p)=>(p?.achievements||[]).includes("duelGold10") }),
  Object.freeze({ id:"perfect-first-world", name:"Печать безупречного пути", icon:"✦", rarity:"epic", source:collectibleSource("campaign", "Кампания", { world:1 }), unlockText:"Закрой первые 100 уровней кампании на три звезды.", lore:"Заповедная печать пути, на котором не осталось ни одной незавершённой нити.", unlocked:(p)=>Array.from({length:100},(_,i)=>+(p?.starsByLevel?.[i+1]||0)).every((stars)=>stars===3) }),
  Object.freeze({ id:"year-amulet", name:"Оберег долгой дороги", icon:"◌", rarity:"epic", source:collectibleSource("retention", "Дни вместе", { days:365 }), unlockText:"Открой Словасьянс в 365 разных дней.", lore:"Его получают не за один сложный ход, а за дорогу, к которой возвращались снова и снова.", unlocked:(p)=>+(p?.retention?.totalOpenDays||0)>=365 }),
  Object.freeze({ id:"stone-heart", name:"Осколок Сердца горы", icon:"◆", rarity:"epic", source:collectibleSource("elemental", "Каменный элементаль", { id:"stone-elemental" }), unlockText:"Верни Каменному элементалю абсолютную форму.", lore:"Камень, сохранивший память о форме, в которой стихия снова стала целой.", hiddenUntilHint:true, unlocked:(p)=>+(p?.mascotProgress?.["stone-elemental"]?.level||0)>=7 && +(p?.mascotProgress?.["stone-elemental"]?.evolutionStage||0)>=4 }),
]);

ACHIEVEMENTS.push(
  { id: "weekly1", icon: "W1", title: "Новая традиция", desc: "Выполнить недельное испытание", test: (p) => (p.stats.weeklyCompleted || 0) >= 1 },
  { id: "weekly10", icon: "W10", title: "Десять недель", desc: "Выполнить 10 недельных испытаний", rare: true, test: (p) => (p.stats.weeklyCompleted || 0) >= 10 },
  { id: "moves1000", icon: "↯", title: "Тысяча ходов", desc: "Сделать 1000 ходов", test: (p) => (p.stats.totalMoves || 0) >= 1000 },
  { id: "records10", icon: "↯10", title: "Лучше себя", desc: "Установить 10 личных рекордов", test: (p) => (p.stats.personalRecords || 0) >= 10 },
  { id: "challenge1", icon: "⚔", title: "Дуэль принята", desc: "Завершить дуэль по коду", test: (p) => (p.stats.challengesCompleted || 0) >= 1 },
  { id: "challenge25", icon: "⚔25", title: "Опытный соперник", desc: "Завершить 25 дуэлей по коду", rare: true, test: (p) => (p.stats.challengesCompleted || 0) >= 25 },
  { id: "calm10", icon: "☁", title: "Внутренний дзен", desc: "Пройти 10 раскладов в режиме «Дзен»", test: (p) => (p.stats.calmCompleted || 0) >= 10 },
  { id: "marathon5", icon: "∞5", title: "На дистанции", desc: "Пройти 5 идеальных раскладов подряд в марафоне", test: (p) => (p.stats.bestMarathon || 0) >= 5 },
  { id: "marathon15", icon: "∞15", title: "Марафонец", desc: "Пройти 15 идеальных раскладов подряд", rare: true, test: (p) => (p.stats.bestMarathon || 0) >= 15 },
);

ACHIEVEMENTS.push(
  { id: "mastery10", icon: "✦10", title: "Знаток категорий", desc: "Полностью изучить 10 категорий", test: (p) => (p.stats.masteredCategories || 0) >= 10 },
  { id: "mastery50", icon: "✦50", title: "Словарь в голове", desc: "Полностью изучить 50 категорий", rare: true, test: (p) => (p.stats.masteredCategories || 0) >= 50 },
  { id: "final1", icon: "◆Ⅰ", title: "Финалист", desc: "Пройти финал главы", test: (p) => (p.stats.chapterFinalsCompleted || 0) >= 1 },
  { id: "final6", icon: "◆Ⅵ", title: "Покоритель глав", desc: "Пройти 6 финалов глав", rare: true, test: (p) => (p.stats.chapterFinalsCompleted || 0) >= 6 },
  { id: "bonus10", icon: "+10", title: "Сверх плана", desc: "Выполнить 10 бонусных целей", test: (p) => (p.stats.bonusObjectivesCompleted || 0) >= 10 },
  { id: "series3", icon: "⚔3", title: "Серийный победитель", desc: "Выиграть 3 серии дуэлей", rare: true, test: (p) => (p.stats.seriesWins || 0) >= 3 },
);

ACHIEVEMENTS.push(
  { id: "visits30", icon: "📅", title: "Месяц вместе", desc: "Заходить в игру в 30 разных дней", test: (p) => (p.retention?.totalOpenDays || 0) >= 30 },
  { id: "visits50", icon: "🧭", title: "Частый гость", desc: "Заходить в игру в 50 разных дней", test: (p) => (p.retention?.totalOpenDays || 0) >= 50 },
  { id: "visits100", icon: "💯", title: "Сто дней", desc: "Заходить в игру в 100 разных дней", rare: true, test: (p) => (p.retention?.totalOpenDays || 0) >= 100 },
  { id: "visits180", icon: "🌳", title: "Полгода вместе", desc: "Заходить в игру в 180 разных дней", rare: true, test: (p) => (p.retention?.totalOpenDays || 0) >= 180 },
  { id: "visits365", icon: "🏅", title: "Год Словасьянса", desc: "Заходить в игру в 365 разных дней", rare: true, test: (p) => (p.retention?.totalOpenDays || 0) >= 365 },
  { id: "duel1", icon: "⚔", title: "Первая дуэль", desc: "Завершить первую дуэль", test: (p) => (p.stats.duelMatches || 0) >= 1 },
  { id: "duelWin1", icon: "🥇", title: "Первая победа", desc: "Победить в дуэли", test: (p) => (p.stats.duelWins || 0) >= 1 },
  { id: "duelWins5", icon: "⚔5", title: "На хорошем счету", desc: "Победить в 5 дуэлях", test: (p) => (p.stats.duelWins || 0) >= 5 },
  { id: "duelWins10", icon: "⚔10", title: "Дуэлянт", desc: "Победить в 10 дуэлях", rare: true, test: (p) => (p.stats.duelWins || 0) >= 10 },
  { id: "duelWins25", icon: "👑", title: "Чемпион дуэлей", desc: "Победить в 25 дуэлях", rare: true, test: (p) => (p.stats.duelWins || 0) >= 25 },
);

function achievementProgressData(a, p = profile) {
  const map = {
    first:[p.stats.levelsCompleted,1], ten:[p.stats.levelsCompleted,10], twentyfive:[p.stats.levelsCompleted,25], fifty:[p.stats.levelsCompleted,50], hundred:[p.stats.levelsCompleted,100], twofifty:[p.stats.levelsCompleted,250], fivehundred:[p.stats.levelsCompleted,500],
    clean:[p.stats.tripleStarWins,1], perfect10:[p.stats.tripleStarWins,10], perfect25:[p.stats.tripleStarWins,25], perfect50:[p.stats.tripleStarWins,50], perfect100:[p.stats.tripleStarWins,100],
    nohint:[p.stats.noHintWins,20], nohint50:[p.stats.noHintWins,50], nohint100:[p.stats.noHintWins,100],
    noundo:[p.stats.noUndoWins,20], noundo50:[p.stats.noUndoWins,50], noundo100:[p.stats.noUndoWins,100],
    discover25:[discoveredCategoryCount(p),25], discover50:[discoveredCategoryCount(p),50], discover75:[discoveredCategoryCount(p),75], collector:[discoveredCategoryCount(p),100], encyclopedia:[discoveredCategoryCount(p),125], collectorAll:[discoveredCategoryCount(p), Math.max(1, BANK.length)],
    daily:[p.stats.dailyCompleted,1], daily7:[p.stats.dailyCompleted,7], daily30:[p.stats.dailyCompleted,30], daily100:[p.stats.dailyCompleted,100],
    combo3:[p.stats.maxDragCombo||0,3], combo5:[p.stats.maxDragCombo||0,5], combo10:[p.stats.maxDragCombo||0,10],
    special5:[p.stats.specialCompleted||0,5], special10:[p.stats.specialCompleted||0,10], special25:[p.stats.specialCompleted||0,25],
    chapter1:[completedChapterCount(p),1], chapter3:[completedChapterCount(p),3], chapter5:[completedChapterCount(p),5],
    chapterPerfect1:[perfectChapterCount(p),1], chapterPerfect3:[perfectChapterCount(p),3], chapterPerfect5:[perfectChapterCount(p),5],
    streak7:[p.daily.bestStreak||0,7], streak30:[p.daily.bestStreak||0,30], games100:[p.stats.gamesPlayed||0,100],
    weekly1:[p.stats.weeklyCompleted||0,1], weekly10:[p.stats.weeklyCompleted||0,10], moves1000:[p.stats.totalMoves||0,1000], records10:[p.stats.personalRecords||0,10],
    challenge1:[p.stats.challengesCompleted||0,1], challenge25:[p.stats.challengesCompleted||0,25], calm10:[p.stats.calmCompleted||0,10], marathon5:[p.stats.bestMarathon||0,5], marathon15:[p.stats.bestMarathon||0,15],
    mastery10:[p.stats.masteredCategories||0,10], mastery50:[p.stats.masteredCategories||0,50], final1:[p.stats.chapterFinalsCompleted||0,1], final6:[p.stats.chapterFinalsCompleted||0,6], bonus10:[p.stats.bonusObjectivesCompleted||0,10], series3:[p.stats.seriesWins||0,3],
    visits30:[p.retention?.totalOpenDays||0,30], visits50:[p.retention?.totalOpenDays||0,50], visits100:[p.retention?.totalOpenDays||0,100], visits180:[p.retention?.totalOpenDays||0,180], visits365:[p.retention?.totalOpenDays||0,365],
    duel1:[p.stats.duelMatches||0,1], duelWin1:[p.stats.duelWins||0,1], duelWins5:[p.stats.duelWins||0,5], duelWins10:[p.stats.duelWins||0,10], duelWins25:[p.stats.duelWins||0,25], duelGold10:[p.stats.duelGold||0,10],
    retro90:[retro90AchievementProgress(p),90],
  };
  const pair = map[a.id];
  if (!pair) return null;
  return { value: Math.min(pair[1], Math.max(0, +pair[0] || 0)), goal: pair[1] };
}

