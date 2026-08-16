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

const GAME_MODE_DEFS = Object.freeze([
  { id: "daily", icon: "☀", label: UI_TEXT.daily, className: "daily", music: "daily" },
  { id: "marathon", icon: "∞", label: UI_TEXT.marathon, className: "marathon", music: "marathon" },
  { id: "zen", icon: "☁", label: UI_TEXT.zen, className: "zen", music: "zen" },
  { id: "duel", icon: "⚔", label: UI_TEXT.duel, className: "duel", music: "duel" },
  { id: "pictures", icon: "▧", label: "Картинки", className: "pictures", music: "collection" },
]);


const DEVELOPER_MESSAGES = Object.freeze([
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
