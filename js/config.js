/* Game constants and progression definitions. */
let BANK = [];
const SAVE_KEY = "worditaire-state-v10";
const OLD_SAVE_KEY = "assoc-klondike-v7";
const PROFILE_KEY = "worditaire-profile-v2";
const ANALYTICS_KEY = "worditaire-analytics-v1";
const RECENT_KEY = "assoc-recent-categories-v2";
const MAX_CARD_WORD_LEN = 10,
  MAX_CARD_TITLE_LEN = 10;
const THEME_DEFS = [
  { id: "violet", name: "Violet", stars: 0 },
  { id: "ocean", name: "Ocean", stars: 30 },
  { id: "sunset", name: "Sunset", stars: 75 },
  { id: "paper", name: "Paper", stars: 100 },
  { id: "aurora", name: "Aurora", stars: 150 },
  { id: "neon", name: "Neon", stars: 225 },
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
  {
    id: "collector",
    icon: "▦",
    title: "Коллекционер",
    desc: "Открыть 100 категорий",
    test: (p) => p.discovered.length >= 100,
  },
  {
    id: "encyclopedia",
    icon: "∞",
    title: "Энциклопедия",
    desc: "Собрать 500 категорий",
    test: (p) => p.stats.categoriesCompleted >= 500,
  },
  {
    id: "daily",
    icon: "☀",
    title: "Доброе утро",
    desc: "Пройти Daily",
    test: (p) => p.stats.dailyCompleted >= 1,
  },
  { id: "streak7", icon: "🔥", title: "Привычка", desc: "Серия 7 дней", test: (p) => p.daily.bestStreak >= 7 },
  {
    id: "streak30",
    icon: "🔥",
    title: "Постоянство",
    desc: "Серия 30 дней",
    test: (p) => p.daily.bestStreak >= 30,
  },
];
const DEFAULT_STATS = {
  levelsCompleted: 0,
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
};
