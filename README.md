# Словасьянс

Мобильный пасьянс ассоциаций на чистом HTML/CSS/JavaScript — без React и без сборщика. Игра по-прежнему запускается напрямую через `file://`; PWA, service worker и обновления включаются при запуске через HTTP/HTTPS.

## Структура

- `index.html` — основная разметка.
- `styles/base.css` — игровое поле, карты и базовый UI.
- `styles/meta.css` — hub, прогрессия, коллекции, эффекты и модалки.
- `styles/responsive.css` — мобильный адаптив и геометрия.
- `js/config.js` — главы, достижения, темы, рубашки, недельные задания и награды.
- `js/profile.js` — профиль, миграции и настройки.
- `js/data.js` — загрузка и проверка базы категорий.
- `js/generator.js` — seed-генерация, сложность и solver-check.
- `js/meta/systems.js` — энциклопедия, weekly, рекорды, challenge и export/import.
- `js/game/*` — правила, drag, game feel и состояние.
- `js/components/*` — карты, поле и game hub.
- `manifest.webmanifest`, `sw.js`, `icons/` — PWA/offline/update flow.

## Игровые системы

- обычная кампания с главами по 10 уровней;
- Daily Challenge;
- недельное испытание;
- challenge по seed/ссылке;
- марафон идеальных прохождений;
- спокойный режим;
- особые уровни;
- 3 звезды: за прохождение, без подсказок и без отмен;
- ручное combo только за полезный drag-and-drop;
- счётчик ходов и личные рекорды;
- deadlock-анализ и solver-проверка генерации;
- постепенно растущая сложность ассоциаций.

## Мета-прогрессия

- game hub с вкладками;
- карта глав;
- 52 достижения с прогрессом и фильтрами;
- энциклопедия категорий и встреченных слов;
- 11 тем оформления;
- 16 рубашек карт;
- 6 эффектов победы;
- профиль игрока и открываемые титулы;
- экспорт/импорт прогресса;
- уведомление о новой версии PWA.

## Game feel

- процедурные звуки и отдельная музыка меню/игры;
- haptic;
- раздача, переворот, auto-move и завершение категории;
- физичная точка захвата карты;
- лёгкий tilt/parallax во время drag;
- неправильный ход возвращается назад;
- если карту отпустить обратно на исходное место, это считается отменой жеста: ход и combo не сбрасываются.

## Геометрия стопок

Высота видимой части нижней карты управляется одной CSS-переменной:

```css
:root {
  --stack-step: 24px;
}
```

`fitTableauGeometry()` дополнительно уменьшает карту и/или шаг каскада, если реальная колонка не помещается по высоте. Скролла игрового поля нет.

## UI cleanup
- Removed the redundant appearance preview block above Themes.
- Restored the pre-hub card sizing for 3-column layouts and the previous 46px minimum adaptive card width.
- Replaced purple UI glow shadows with neutral depth shadows.
- Added explicit profile editing in the “Ещё” tab: player name + any title unlocked by earned achievements.
