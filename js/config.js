/* Game constants and progression definitions. */
let BANK = [];
const SAVE_KEY = "worditaire-state-v10";
const OLD_SAVE_KEY = "assoc-klondike-v7";
const PROFILE_KEY = "worditaire-profile-v3";
const PREV_PROFILE_KEY = "worditaire-profile-v2";
const ANALYTICS_KEY = "worditaire-analytics-v1";
const RECENT_KEY = "assoc-recent-categories-v2";
const MAX_CARD_WORD_LEN = 10,
  MAX_CARD_TITLE_LEN = 10;

const CHAPTER_SIZE = 10;
const CHAPTER_NAMES = [
  "Первые связи",
  "Знакомые миры",
  "Переплетения",
  "Тонкие намёки",
  "Большой словарь",
  "Мастер ассоциаций",
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
];
const CARD_BACK_DEFS = [
  { id: "classic", name: "Классика", desc: "Базовая рубашка", minAchievements: 0 },
  { id: "prism", name: "Призма", desc: "За 4 достижения", minAchievements: 4 },
  { id: "constellation", name: "Созвездия", desc: "За 8 достижений", minAchievements: 8 },
  { id: "trophy", name: "Трофей", desc: "За 12 достижений", minAchievements: 12 },
  { id: "crown", name: "Корона", desc: "За идеальную главу", achievement: "chapterPerfect1", rare: true },
  { id: "ember", name: "Пламя", desc: "За серию 30 дней", achievement: "streak30", rare: true },
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
  { id: "combo5", icon: "×5", title: "На волне", desc: "Сделать комбо ×5", test: (p) => (p.stats.maxCombo || 0) >= 5 },
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
  maxCombo: 0,
  deadlocks: 0,
  specialCompleted: 0,
};
