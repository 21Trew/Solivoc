/* Game constants and progression definitions. */
let BANK = [];
const SAVE_KEY = "worditaire-state-v10";
const OLD_SAVE_KEY = "assoc-klondike-v7";
const PROFILE_KEY = "worditaire-profile-v6";
const PREV_PROFILE_KEY = "worditaire-profile-v5";
const LEGACY_PROFILE_KEYS = ["worditaire-profile-v4", "worditaire-profile-v3", "worditaire-profile-v2"];
const ANALYTICS_KEY = "worditaire-analytics-v1";
const RECENT_KEY = "assoc-recent-categories-v2";
const MAX_CARD_WORD_LEN = 10,
  MAX_CARD_TITLE_LEN = 10;

const AVATAR_EMOJIS = [
  "🙂", "😎", "🤩", "🥳", "🤓", "🤠", "🫠", "😈",
  "🦊", "🐼", "🐸", "🦉", "🐙", "🦄", "🐯", "🐧",
  "🌙", "⭐", "🔥", "❄️", "🌸", "🍀", "⚡", "🌈",
  "🎯", "🎮", "🧩", "🏆", "🚀", "💎", "🎧", "🍕"
];

const ASSOCIATION_COLLECTION_DEFS = [
  {
    id: "animals", name: "Животные", icon: "🦊", desc: "Собирай животных по среде и типу",
    categories: [
      { id: "farm", title: "Ферма", cards: [["🐄","Корова"],["🐖","Свинья"],["🐔","Курица"],["🐑","Овца"],["🐐","Коза"],["🐎","Лошадь"]] },
      { id: "africa", title: "Африка", cards: [["🦁","Лев"],["🐘","Слон"],["🦒","Жираф"],["🦓","Зебра"],["🦏","Носорог"],["🐆","Леопард"]] },
      { id: "forest", title: "Лес", cards: [["🦊","Лиса"],["🐻","Медведь"],["🐺","Волк"],["🦌","Олень"],["🐿️","Белка"],["🦉","Сова"]] },
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
      { id: "fruit", title: "Фрукты", cards: [["🍎","Яблоко"],["🍌","Банан"],["🍓","Клубника"],["🍇","Виноград"],["🍉","Арбуз"],["🍍","Ананас"]] },
      { id: "vegetables", title: "Овощи", cards: [["🥕","Морковь"],["🥦","Брокколи"],["🌽","Кукуруза"],["🍅","Помидор"],["🥒","Огурец"],["🫑","Перец"]] },
      { id: "fastfood", title: "Фастфуд", cards: [["🍔","Бургер"],["🍟","Картофель фри"],["🍕","Пицца"],["🌭","Хот-дог"],["🌮","Тако"],["🥤","Газировка"]] },
      { id: "sweets", title: "Сладкое", cards: [["🍰","Торт"],["🧁","Кекс"],["🍩","Пончик"],["🍪","Печенье"],["🍫","Шоколад"],["🍬","Конфета"]] },
      { id: "asia", title: "Азия", cards: [["🍣","Суши"],["🍜","Лапша"],["🍚","Рис"],["🥟","Пельмени"],["🍱","Бенто"],["🥢","Палочки"]] },
    ],
  },
  {
    id: "space", name: "Космос", icon: "🚀", desc: "Объекты, техника и явления космоса",
    categories: [
      { id: "flight", title: "Полёт", cards: [["🚀","Ракета"],["🛰️","Спутник"],["🛸","НЛО"],["👨‍🚀","Астронавт"],["🌌","Космос"],["🔭","Телескоп"]] },
      { id: "earth", title: "Земля", cards: [["🌍","Планета"],["🌎","Америка"],["🌏","Азия"],["🌊","Океан"],["☁️","Облака"],["🌐","Глобус"]] },
      { id: "moon", title: "Луна", cards: [["🌕","Полнолуние"],["🌖","Убывающая"],["🌗","Половина"],["🌘","Серп"],["🌑","Новолуние"],["🌒","Растущая"]] },
      { id: "stars", title: "Звёзды", cards: [["⭐","Звезда"],["🌟","Яркая звезда"],["✨","Сияние"],["🌠","Падающая звезда"],["☄️","Комета"],["💫","Орбита"]] },
      { id: "science", title: "Наука", cards: [["🧪","Пробирка"],["🔬","Микроскоп"],["🧬","ДНК"],["⚛️","Атом"],["📡","Антенна"],["🖥️","Компьютер"]] },
      { id: "future", title: "Будущее", cards: [["🤖","Робот"],["👽","Инопланетянин"],["🦾","Протез"],["🔋","Батарея"],["💡","Идея"],["🕶️","Технологии"]] },
    ],
  },
  {
    id: "emotions", name: "Эмоции", icon: "😎", desc: "Определи эмоцию по выражению лица",
    categories: [
      { id: "joy", title: "Радость", cards: [["😀","Улыбка"],["😄","Смех"],["😁","Радость"],["🤩","Восторг"],["🥳","Праздник"],["😂","Хохот"]] },
      { id: "sad", title: "Грусть", cards: [["😢","Слеза"],["😭","Плач"],["😞","Печаль"],["😔","Грусть"],["🥺","Просьба"],["😿","Грустный кот"]] },
      { id: "anger", title: "Злость", cards: [["😠","Сердитость"],["😡","Ярость"],["🤬","Ругательство"],["👿","Злой"],["😤","Фырканье"],["💢","Гнев"]] },
      { id: "fear", title: "Страх", cards: [["😨","Испуг"],["😱","Ужас"],["😰","Тревога"],["😳","Шок"],["🫣","Прячется"],["👻","Призрак"]] },
      { id: "love", title: "Любовь", cards: [["😍","Влюблённость"],["🥰","Нежность"],["😘","Поцелуй"],["💘","Стрела любви"],["💖","Сердце"],["❤️","Любовь"]] },
      { id: "tired", title: "Усталость", cards: [["😴","Сон"],["🥱","Зевок"],["😪","Дремота"],["🫠","Растаял"],["😵‍💫","Головокружение"],["💤","Спит"]] },
    ],
  },
];

function associationCollectionById(id) {
  return ASSOCIATION_COLLECTION_DEFS.find((x) => x.id === id) || ASSOCIATION_COLLECTION_DEFS[0];
}
function associationCollectionCategories(id) {
  const collection = associationCollectionById(id);
  return collection.categories.map((cat) => ({
    id: `visual:${collection.id}:${cat.id}`,
    title: cat.title,
    visual: true,
    words: cat.cards.map(([emoji]) => emoji),
    visualLabels: Object.fromEntries(cat.cards),
  }));
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
  { id: "precise", icon: "◇", title: "Точный расклад", desc: "Доступна только 1 отмена", offset: 10, maxUndos: 1 },
  { id: "one-recycle", icon: "↻", title: "Одна прокрутка", desc: "Колоду можно вернуть только один раз", offset: 15, maxRecycles: 1 },
  { id: "big-mix", icon: "✦", title: "Большая коллекция", desc: "Больше категорий и слов", offset: 20, bigMix: true },
];

const THEME_DEFS = [
  { id: "violet", name: "Violet", stars: 0 },
  { id: "ocean", name: "Ocean", stars: 30 },
  { id: "sunset", name: "Sunset", stars: 75 },
  { id: "paper", name: "Paper", stars: 100 },
  { id: "aurora", name: "Aurora", stars: 150 },
  { id: "neon", name: "Neon", stars: 225 },
  { id: "forest", name: "Forest", stars: 300 },
  { id: "frost", name: "Frost", stars: 375 },
  { id: "candy", name: "Candy", stars: 450 },
  { id: "midnight", name: "Midnight", stars: 550 },
  { id: "gold", name: "Gold", stars: 700 },
];
const CARD_BACK_DEFS = [
  { id: "classic", name: "Классика", desc: "Базовая рубашка", minAchievements: 0 },
  { id: "prism", name: "Призма", desc: "За 4 достижения", minAchievements: 4 },
  { id: "constellation", name: "Созвездия", desc: "За 8 достижений", minAchievements: 8 },
  { id: "trophy", name: "Трофей", desc: "За 12 достижений", minAchievements: 12 },
  { id: "mosaic", name: "Мозаика", desc: "За 16 достижений", minAchievements: 16 },
  { id: "velvet", name: "Бархат", desc: "За 20 достижений", minAchievements: 20 },
  { id: "glacier", name: "Ледник", desc: "За 24 достижения", minAchievements: 24 },
  { id: "lotus", name: "Лотос", desc: "За 28 достижений", minAchievements: 28 },
  { id: "crown", name: "Корона", desc: "За идеальную главу", achievement: "chapterPerfect1", rare: true },
  { id: "ember", name: "Пламя", desc: "За серию 30 дней", achievement: "streak30", rare: true },
  { id: "master", name: "Мастер", desc: "За комбо ×10", achievement: "combo10", rare: true },
  { id: "atlas", name: "Атлас", desc: "За всю коллекцию категорий", achievement: "collectorAll", rare: true },
  { id: "chronicle", name: "Хроника", desc: "За 100 Daily", achievement: "daily100", rare: true },
  { id: "phoenix", name: "Феникс", desc: "За 25 особых уровней", achievement: "special25", rare: true },
  { id: "legend", name: "Легенда", desc: "За 3 идеальные главы", achievement: "chapterPerfect3", rare: true },
  { id: "obsidian", name: "Обсидиан", desc: "За 5 идеальных глав", achievement: "chapterPerfect5", rare: true },
];
const ACHIEVEMENTS = [
  {
    id: "first",
    icon: "✦",
    title: "Первый расклад",
    desc: "Пройти 1 уровень",
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
    desc: "Пройти Daily",
    test: (p) => p.stats.dailyCompleted >= 1,
  },
  { id: "combo5", icon: "×5", title: "На волне", desc: "Сделать комбо ×5", test: (p) => (p.stats.maxDragCombo || 0) >= 5 },
  { id: "special5", icon: "◆", title: "Особый случай", desc: "Пройти 5 особых уровней", test: (p) => (p.stats.specialCompleted || 0) >= 5 },
  { id: "chapter1", icon: "Ⅰ", title: "Первая глава", desc: "Полностью пройти 1 главу", test: (p) => completedChapterCount(p) >= 1 },
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
  { id: "daily7", icon: "☀7", title: "Неделя Daily", desc: "Пройти 7 Daily", test: (p) => p.stats.dailyCompleted >= 7 },
  { id: "daily30", icon: "☀30", title: "Месяц Daily", desc: "Пройти 30 Daily", test: (p) => p.stats.dailyCompleted >= 30 },
  { id: "daily100", icon: "☀100", title: "Ритуал", desc: "Пройти 100 Daily", rare: true, test: (p) => p.stats.dailyCompleted >= 100 },
  { id: "combo3", icon: "×3", title: "Точная рука", desc: "Сделать ручное комбо ×3", test: (p) => (p.stats.maxDragCombo || 0) >= 3 },
  { id: "combo10", icon: "×10", title: "Мастер движений", desc: "Сделать ручное комбо ×10", rare: true, test: (p) => (p.stats.maxDragCombo || 0) >= 10 },
  { id: "special10", icon: "◆10", title: "Любитель испытаний", desc: "Пройти 10 особых уровней", test: (p) => (p.stats.specialCompleted || 0) >= 10 },
  { id: "special25", icon: "◆25", title: "Испытатель", desc: "Пройти 25 особых уровней", rare: true, test: (p) => (p.stats.specialCompleted || 0) >= 25 },
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
  challengesCompleted: 0,
  calmCompleted: 0,
  collectionGamesCompleted: 0,
  bestMarathon: 0,
  totalMoves: 0,
  personalRecords: 0,
  masteredCategories: 0,
  chapterFinalsCompleted: 0,
  bonusObjectivesCompleted: 0,
  seriesWins: 0,
};

const WEEKLY_DEFS = [
  { id: "stars", icon: "★", title: "Звёздная неделя", desc: "Заработать 12 звёзд за неделю", metric: "stars", goal: 12 },
  { id: "noHints", icon: "?", title: "Своя голова", desc: "Пройти 5 партий без подсказок", metric: "noHintWins", goal: 5 },
  { id: "perfect", icon: "★★★", title: "Идеальная неделя", desc: "Закрыть 4 расклада на 3 звезды", metric: "tripleStarWins", goal: 4 },
  { id: "categories", icon: "▦", title: "Собиратель", desc: "Собрать 30 категорий за неделю", metric: "categoriesCompleted", goal: 30 },
];

const EFFECT_DEFS = [
  { id: "spark", name: "Искры", desc: "Базовый эффект", minAchievements: 0 },
  { id: "confetti", name: "Конфетти", desc: "За 8 достижений", minAchievements: 8 },
  { id: "petals", name: "Лепестки", desc: "За идеальную главу", achievement: "chapterPerfect1" },
  { id: "comet", name: "Кометы", desc: "За ручное комбо ×10", achievement: "combo10", rare: true },
  { id: "aurora", name: "Сияние", desc: "За 3 недельных испытания", minWeekly: 3, rare: true },
  { id: "legend", name: "Легенда", desc: "За 5 идеальных глав", achievement: "chapterPerfect5", rare: true },
];

const FRAME_DEFS = [
  { id: "none", name: "Без рамки", chapter: 0, hue: 250 },
  { id: "chapter1", name: "Первые связи", chapter: 1, hue: 258 },
  { id: "chapter2", name: "Знакомые миры", chapter: 2, hue: 195 },
  { id: "chapter3", name: "Переплетения", chapter: 3, hue: 335 },
  { id: "chapter4", name: "Тонкие намёки", chapter: 4, hue: 145 },
  { id: "chapter5", name: "Большой словарь", chapter: 5, hue: 42 },
  { id: "chapter6", name: "Мастер ассоциаций", chapter: 6, hue: 285 },
  { id: "chapter7", name: "Скрытые смыслы", chapter: 7, hue: 12 },
  { id: "chapter8", name: "Словесный лабиринт", chapter: 8, hue: 174 },
  { id: "chapter9", name: "Точные связи", chapter: 9, hue: 220 },
  { id: "chapter10", name: "Эрудит", chapter: 10, hue: 55 },
  { id: "chapter11", name: "Большая энциклопедия", chapter: 11, hue: 316 },
  { id: "chapter12", name: "За гранью очевидного", chapter: 12, hue: 105 },
];

const TITLE_DEFS = [
  { id: "player", name: "Игрок", icon: "◇" },
  { id: "collector", name: "Коллекционер", icon: "▦", achievement: "collector" },
  { id: "perfectionist", name: "Перфекционист", icon: "★", achievement: "perfect10" },
  { id: "hand", name: "Мастер движений", icon: "×", achievement: "combo10" },
  { id: "explorer", name: "Исследователь", icon: "◎", achievement: "discover75" },
  { id: "legend", name: "Легенда", icon: "✦", achievement: "chapterPerfect5" },
];

function achievementTitleDef(a) {
  return a ? { id: `achievement:${a.id}`, name: a.title, icon: a.icon || "★", achievement: a.id } : null;
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
  TITLE_DEFS.slice(1).forEach((def) => { if (!def.achievement || p?.achievements?.includes(def.achievement)) add(def); });
  (p?.achievements || []).forEach((id) => add(achievementTitleDef(ACHIEVEMENTS.find((a) => a.id === id))));
  return result;
}

ACHIEVEMENTS.push(
  { id: "weekly1", icon: "W1", title: "Новая традиция", desc: "Выполнить недельное испытание", test: (p) => (p.stats.weeklyCompleted || 0) >= 1 },
  { id: "weekly10", icon: "W10", title: "Десять недель", desc: "Выполнить 10 недельных испытаний", rare: true, test: (p) => (p.stats.weeklyCompleted || 0) >= 10 },
  { id: "moves1000", icon: "↯", title: "Тысяча ходов", desc: "Сделать 1000 ходов", test: (p) => (p.stats.totalMoves || 0) >= 1000 },
  { id: "records10", icon: "↯10", title: "Лучше себя", desc: "Установить 10 личных рекордов", test: (p) => (p.stats.personalRecords || 0) >= 10 },
  { id: "challenge1", icon: "⇄", title: "Вызов принят", desc: "Пройти испытание по коду", test: (p) => (p.stats.challengesCompleted || 0) >= 1 },
  { id: "challenge25", icon: "⇄25", title: "Дуэлянт", desc: "Пройти 25 испытаний по коду", rare: true, test: (p) => (p.stats.challengesCompleted || 0) >= 25 },
  { id: "calm10", icon: "☁", title: "Спокойствие", desc: "Пройти 10 спокойных раскладов", test: (p) => (p.stats.calmCompleted || 0) >= 10 },
  { id: "marathon5", icon: "∞5", title: "На дистанции", desc: "Пройти 5 идеальных раскладов подряд в марафоне", test: (p) => (p.stats.bestMarathon || 0) >= 5 },
  { id: "marathon15", icon: "∞15", title: "Марафонец", desc: "Пройти 15 идеальных раскладов подряд", rare: true, test: (p) => (p.stats.bestMarathon || 0) >= 15 },
);

ACHIEVEMENTS.push(
  { id: "mastery10", icon: "✦10", title: "Знаток категорий", desc: "Полностью изучить 10 категорий", test: (p) => (p.stats.masteredCategories || 0) >= 10 },
  { id: "mastery50", icon: "✦50", title: "Словарь в голове", desc: "Полностью изучить 50 категорий", rare: true, test: (p) => (p.stats.masteredCategories || 0) >= 50 },
  { id: "final1", icon: "◆Ⅰ", title: "Финалист", desc: "Пройти финал главы", test: (p) => (p.stats.chapterFinalsCompleted || 0) >= 1 },
  { id: "final6", icon: "◆Ⅵ", title: "Покоритель глав", desc: "Пройти 6 финалов глав", rare: true, test: (p) => (p.stats.chapterFinalsCompleted || 0) >= 6 },
  { id: "bonus10", icon: "+10", title: "Сверх плана", desc: "Выполнить 10 бонусных целей", test: (p) => (p.stats.bonusObjectivesCompleted || 0) >= 10 },
  { id: "series3", icon: "⚔3", title: "Серийный победитель", desc: "Выиграть 3 серии вызовов", rare: true, test: (p) => (p.stats.seriesWins || 0) >= 3 },
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
  };
  const pair = map[a.id];
  if (!pair) return null;
  return { value: Math.min(pair[1], Math.max(0, +pair[0] || 0)), goal: pair[1] };
}

