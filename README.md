# Словасьянс

Чистый HTML/CSS/JavaScript, без React и без сборщика. Скрипты оставлены обычными classic scripts, поэтому проект продолжает запускаться напрямую через `file://`.

## Структура

- `index.html` — разметка и подключения.
- `styles/base.css` — базовый UI, карты и поле.
- `styles/meta.css` — меню, достижения, темы и экран победы.
- `styles/responsive.css` — адаптив.
- `js/config.js` — константы.
- `js/profile.js` — профиль, звёзды, аналитика.
- `js/data.js` — база категорий.
- `js/runtime.js` — DOM и общие утилиты.
- `js/generator.js` — генератор уровней и solver-check.
- `js/animations.js` — анимации раздачи/переворота.
- `js/game/state.js` — состояние, save/load, history.
- `js/game/rules.js` — правила переносов.
- `js/game/drag.js` — drag и double-tap.
- `js/components/cards.js` — карточки и геометрия стопок.
- `js/components/board.js` — рендер поля.
- `js/components/hub.js` — большое меню.
- `js/progression.js` — победа, достижения, tutorial.
- `js/app.js` — события и запуск.

## Высота каскада

Одна переменная в `styles/base.css`:

```css
:root {
  --stack-step: 24px;
}
```
