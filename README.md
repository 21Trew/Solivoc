# Словасьянс

Чистый HTML/CSS/JavaScript, без React и без сборщика. Игра по-прежнему запускается напрямую через `file://`; PWA-режим и service worker включаются автоматически при запуске через HTTP/HTTPS.

## Структура

- `index.html` — разметка и подключения.
- `styles/base.css` — базовый UI, карты и поле.
- `styles/meta.css` — меню, достижения, главы, game feel и экран победы.
- `styles/responsive.css` — адаптив.
- `js/config.js` — константы, главы и особые уровни.
- `js/profile.js` — профиль, звёзды, настройки, аналитика.
- `js/data.js` — база категорий.
- `js/runtime.js` — DOM и общие утилиты.
- `js/generator.js` — генератор уровней, главы, modifiers и solver-check.
- `js/animations.js` — раздача/переворот карт.
- `js/game/feedback.js` — звук, haptic, combo, deadlock и анимация завершения категории.
- `js/game/state.js` — состояние, save/load, history.
- `js/game/rules.js` — правила переносов, поиск полезного хода и deadlock-анализ.
- `js/game/drag.js` — drag, возврат неправильного хода и double-tap.
- `js/components/cards.js` — карточки и геометрия стопок.
- `js/components/board.js` — рендер поля.
- `js/components/hub.js` — меню, карта глав и настройки.
- `js/progression.js` — победа, достижения, tutorial.
- `js/app.js` — события, запуск и регистрация PWA.
- `manifest.webmanifest`, `sw.js`, `icons/icon.svg` — PWA/offline.

## Новые игровые системы

- анимация завершения категории;
- процедурные звуки без внешних аудиофайлов;
- отключаемые звук и вибрация;
- combo за серию полезных ходов;
- shake/возврат карты при неправильном ходе;
- определение тупика с Undo/Restart;
- особые уровни через каждые 5 уровней;
- главы по 10 уровней с картой прогресса;
- установка на главный экран и offline-кэш через PWA.

## Высота каскада

Одна переменная в `styles/base.css`:

```css
:root {
  --stack-step: 24px;
}
```
