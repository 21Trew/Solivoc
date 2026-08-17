/* Shared UI copy and navigation constants. Keep user-facing names in one place. */
const UI_TEXT = Object.freeze({
  appName: "Словасьянс",
  daily: "Ежедневный",
  marathon: "Марафон",
  zen: "Дзен",
  duel: "Дуэль",
  modes: "Режимы",
  progress: "Прогресс",
  encyclopedia: "Энциклопедия",
  appearance: "Стиль",
  settings: "Ещё",
});

const HUB_TAB_DEFS = Object.freeze([
  { id: "home", icon: "⌂", label: "Главная" },
  { id: "progress", icon: "★", label: UI_TEXT.progress },
  { id: "collection", icon: "▦", label: UI_TEXT.encyclopedia },
  { id: "modes", icon: "◈", label: UI_TEXT.modes },
  { id: "appearance", icon: "✦", label: UI_TEXT.appearance },
]);


const DUEL_MODE_DEFS = Object.freeze([
  { id: "classic", icon: "⚔", label: "Классика", description: "Лучший общий результат" },
  { id: "time", icon: "⏱", label: "На время", description: "Побеждает тот, кто закончит быстрее" },
  { id: "combo", icon: "×", label: "На комбо", description: "Побеждает самое большое комбо" },
  { id: "moves", icon: "↯", label: "На ходы", description: "Побеждает меньшее количество ходов" },
  { id: "noMistakes", icon: "◇", label: "До ошибки", description: "Первая ошибка означает поражение" },
]);
function normalizeDuelMode(value) { return DUEL_MODE_DEFS.some((x) => x.id === value) ? value : "classic"; }
function duelModeDef(value) { return DUEL_MODE_DEFS.find((x) => x.id === normalizeDuelMode(value)) || DUEL_MODE_DEFS[0]; }

const GAME_MODE_DEFS = Object.freeze([
  { id: "daily", icon: "☀", label: UI_TEXT.daily, className: "daily", music: "daily" },
  { id: "marathon", icon: "∞", label: UI_TEXT.marathon, className: "marathon", music: "marathon" },
  { id: "zen", icon: "☁", label: UI_TEXT.zen, className: "zen", music: "zen" },
  { id: "duel", icon: "⚔", label: UI_TEXT.duel, className: "duel", music: "duel" },
  { id: "pictures", icon: "▧", label: "Картинки", className: "pictures", music: "collection" },
  { id: "time", icon: "⏱", label: "На время", className: "time", music: "game" },
  { id: "moves", icon: "↯", label: "На ходы", className: "moves", music: "game" },
  { id: "combo", icon: "×", label: "Макс. комбо", className: "combo", music: "game" },
  { id: "noMistakes", icon: "◇", label: "До ошибки", className: "no-mistakes", music: "game" },
  { id: "onePass", icon: "↻", label: "1 проход", className: "one-pass", music: "game" },
  { id: "custom", icon: "⚙", label: "Мои правила", className: "custom", music: "game" },
]);


const DEVELOPER_MESSAGES = Object.freeze([
  {
    id: "update-v20-2026-08-17",
    version: "v20",
    major: true,
    date: "17 августа 2026",
    title: "Новые режимы и удобнее каждый день",
    intro: "В Словасьянсе стало больше способов играть — и заметно удобнее следить за прогрессом.",
    items: [
      "Ежедневно выбираются три разных режима: по 5 прохождений в каждом.",
      "Режимы «На время», «На ходы» и «Комбо» получили реальные цели, появился «1 проход» и конструктор «Мои правила».",
      "Добавлены таблицы лидеров по разным направлениям.",
      "Недельные и месячные испытания теперь учитывают подходящий прогресс из любых режимов, кроме дуэлей.",
      "Обновлены визитка игрока, достижения, эффекты победы и несколько категорий картинок.",
      "Улучшена работа без интернета и сохранение активной партии.",
    ],
  },
  {
    id: "update-v19-2026-08-16",
    date: "16 августа 2026",
    title: "Испытания и синхронизация",
    intro: "Обновили старт приложения и добавили новую долгую цель.",
    items: [
      "При запуске игра автоматически синхронизирует серверные данные и проверяет обновление.",
      "Главное меню больше не показывает игровое поле на долю секунды перед открытием.",
      "Добавлено месячное испытание с крупной XP-наградой.",
      "Обычные расклады теперь иногда могут быть естественно неразрешимыми, как в классическом пасьянсе.",
      "Нижняя навигация растянута равномерно по всей ширине.",
    ],
  },
  {
    id: "update-v18-2026-08-16",
    date: "16 августа 2026",
    title: "Что нового в этом обновлении",
    intro: "Продолжаем доводить Словасьянс до более цельной и стабильной игры.",
    items: [
      "Исправили случайные перезагрузки при обновлении приложения.",
      "Поделиться результатом теперь можно красивой карточкой со ссылкой на игру.",
      "Перед особыми уровнями показывается понятное описание усложнения.",
      "После особого уровня игра отдельно отмечает пройденное испытание.",
      "Настройки перенесены в визитку игрока.",
      "Исправлено открытие режима «Картинки».",
      "Добавлена эта почта разработчика — здесь будут заметки о новых версиях.",
    ],
  },
]);
