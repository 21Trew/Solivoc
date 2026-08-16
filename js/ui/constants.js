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
  { id: "settings", icon: "⚙", label: UI_TEXT.settings },
  { id: "progress", icon: "★", label: UI_TEXT.progress },
  { id: "collection", icon: "▦", label: UI_TEXT.encyclopedia },
  { id: "appearance", icon: "✦", label: UI_TEXT.appearance },
  { id: "modes", icon: "◈", label: UI_TEXT.modes },
]);

const GAME_MODE_DEFS = Object.freeze([
  { id: "daily", icon: "☀", label: UI_TEXT.daily, className: "daily", music: "daily" },
  { id: "marathon", icon: "∞", label: UI_TEXT.marathon, className: "marathon", music: "marathon" },
  { id: "zen", icon: "☁", label: UI_TEXT.zen, className: "zen", music: "zen" },
  { id: "duel", icon: "⚔", label: UI_TEXT.duel, className: "duel", music: "duel" },
]);
