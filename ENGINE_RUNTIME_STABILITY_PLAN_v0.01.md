# ENGINE RUNTIME STABILITY PLAN — Словасьянс

> **Статус:** зафиксированный рабочий план
> **Версия:** 0.01
> **Дата фиксации:** 2026-09-04
> **Базовый production commit:** `204c482b5da305c05adea661a37b35592ecd1d4e`
> **Область:** игровой движок, runtime, persistence, offline-first sync, rendering, lifecycle, PWA/service worker, память, производительность и кроссплатформенная стабильность

---

## 1. Назначение документа

Этот документ фиксирует обязательный план технического рефакторинга Словасьянса.

Цель рефакторинга — привести игровой движок и клиентскую архитектуру к состоянию, при котором игра:

- стабильно работает в браузерах и установленной PWA;
- одинаково надёжна на iOS, iPadOS, Android, macOS, Windows и других поддерживаемых средах;
- не теряет прогресс при закрытии приложения, падении вкладки, выгрузке процесса системой, пропадании сети или сбое хранилища;
- остаётся лёгкой по памяти и CPU даже в долгих сессиях;
- не создаёт регулярных фризов из-за сериализации, DOM-перерисовки, фоновых запросов или анимаций;
- не зависит от цепочки monkey-patch/hardening-слоёв;
- имеет один понятный владелец для каждой критической подсистемы;
- проверяется воспроизводимыми автоматическими и ручными cross-platform тестами.

Документ считается активным до выполнения критериев завершения из раздела 17.

---

## 2. Правило фиксации

До закрытия этого плана действуют следующие правила.

1. Нельзя считать проблему стабильности закрытой только потому, что конкретный crash больше не воспроизводится на одном устройстве.
2. Нельзя добавлять новый production monkey-patch поверх существующего механизма, если тот же дефект можно исправить в владельце подсистемы.
3. Экстренный hotfix допускается только для P0-инцидента, но он должен:
   - быть минимальным;
   - иметь тест;
   - быть учтён в этом плане;
   - не становиться новой постоянной архитектурой.
4. Содержательное изменение этого документа получает следующую версию `v0.02`, `v0.03` и далее. Тихо ослаблять критерии нельзя.
5. Крупные новые игровые системы, затрагивающие движок, persistence, sync, lifecycle или renderer, не добавляются до стабилизации соответствующего слоя.
6. UI/content-функции можно развивать, если они не увеличивают архитектурный долг критического runtime.

---

## 3. Поддерживаемые среды

Словасьянс рассматривается как кроссплатформенная web/PWA-игра.

Обязательная матрица стабильности:

| Платформа | Среда | Статус обязательности |
|---|---|---|
| iPhone | Safari | обязательно |
| iPhone | установленная PWA | обязательно |
| iPad | Safari / PWA | обязательно |
| Android | Chrome | обязательно |
| Android | установленная PWA | обязательно |
| Android | Samsung Internet | обязательно |
| Windows | Chrome | обязательно |
| Windows | Edge | обязательно |
| Windows/macOS/Linux | Firefox | обязательно |
| macOS | Safari | обязательно |
| Desktop | Chromium-family | обязательно |

Отдельно проверяются состояния среды:

- online;
- offline;
- нестабильная сеть;
- переключение Wi-Fi ↔ мобильная сеть;
- потеря сети во время sync;
- background → foreground;
- page hide/show;
- browser tab freeze/discard;
- принудительное закрытие PWA;
- выгрузка web process системой;
- обновление service worker;
- storage write failure;
- повреждённый локальный snapshot.

---

## 4. Базовые архитектурные инварианты

После рефакторинга следующие правила являются обязательными.

### 4.1. Один источник истины прогресса

Канонический серверный профиль — единственный серверный источник истины.

```text
локальный профиль / pending events
            │
            ▼
    канонический серверный профиль
            │
      ┌─────┴──────────┐
      ▼                ▼
 leaderboard       другие проекции
```

Лидерборд не имеет права восстанавливать или повышать профиль.

### 4.2. Offline-first

Игрок должен иметь возможность пройти уровень полностью без сети.

Результат сначала надёжно фиксируется локально, затем синхронизируется при появлении сети.

Неподтверждённые сервером события нельзя терять ради ограничения размера очереди.

### 4.3. Семантическое слияние прогресса

Правило «выше побеждает» применяется только к монотонным значениям.

Примеры:

- звёзды конкретного уровня: максимум фактически полученных `1..3`;
- XP: максимум/событийное начисление согласно канонической модели;
- лучший combo: максимум;
- лучшее время: минимальное положительное;
- лучшие ходы: минимальное положительное;
- достижения/коллекции: union с учётом административных revoke/tombstone;
- настройки: последнее осознанное изменение, а не `max`.

### 4.4. Звёзды не выводятся из числа уровней

Каноническая запись:

```text
starsByLevel[levelId] = 1 | 2 | 3
```

`totalStars` вычисляется только как сумма фактических записей `starsByLevel`.

Запрещено:

```text
levelsCompleted × 3
```

и запрещено автоматически дорисовывать отсутствующие звёзды только потому, что уровень считается пройденным.

### 4.5. Один владелец критической подсистемы

У каждой подсистемы должен быть один runtime-владелец:

- игровой state — `GameEngine`;
- отрисовка — `GameRenderer`;
- сохранение текущего расклада — `RoundPersistence`;
- долгосрочный профиль — `ProfileStore`;
- синхронизация — `SyncManager`;
- lifecycle — `LifecycleManager`;
- обновления приложения — `UpdateManager`;
- аналитика — `AnalyticsQueue`;
- анимации — `AnimationManager`.

### 4.6. Запрет production monkey-patching

В итоговой архитектуре запрещена модель:

```js
const oldRender = render;
render = function (...) { ... };
```

для критических runtime-функций.

Production-модули не должны переопределять функции друг друга после загрузки.

---

## 5. Зафиксированные проблемы текущей архитектуры

Ниже перечислены основные проблемы, выявленные техническим аудитом базового commit.

### P0 / P1 — исправлять в первую очередь

- [ ] Старый `v34` принудительно превращает обычный `save()` активного расклада в `immediate`, обходя более новый debounce/coalescing.
- [ ] `v34` выполняет тяжёлый checkpoint state + profile каждые 8 секунд на constrained/iOS runtime.
- [ ] Несколько слоёв одновременно владеют `save`, `saveProfile`, lifecycle и sync.
- [ ] Полный `saveProfile()` выполняет несколько полных `JSON.stringify/parse` одного большого профиля.
- [ ] `completionTransactions` не является компактной ACK-очередью и потенциально растёт в долгой жизни профиля.
- [ ] Сервер ограничивает входной профиль размером, поэтому долгосрочный рост клиента способен привести к `profile_too_large`.
- [ ] Service worker содержит вручную поддерживаемый `CORE`, который уже не совпадает с фактическим production bundle.
- [ ] Service worker может проверяться/устанавливаться во время активного расклада.
- [ ] `skipWaiting + clients.claim` допускает смену поколения SW при живой старой странице.
- [ ] В профиле есть повторно добавляемые listeners на постоянные DOM-узлы.
- [ ] В `returnDragGhost()` есть ожидание Web Animation без гарантированного timeout/cleanup.

### P1 / P2 — производительность и memory pressure

- [ ] Обычный игровой ход приводит к полной пересборке DOM всего поля.
- [ ] После каждого render выполняется полный проход по видимым картам для энциклопедии/knowledge tracking.
- [ ] Глобальный `MutationObserver` реагирует на массовые DOM-мутации игрового поля.
- [ ] `track()` синхронно читает/парсит/пишет analytics в `localStorage` в горячем игровом пути.
- [ ] Есть дублирующиеся poller'ы developer mail.
- [ ] Несколько lifecycle-событий могут ставить отдельные sync timers.
- [ ] `pointermove` постоянно подключён глобально с `passive:false`.
- [ ] Генератор повторно сортирует большие category pools и рассчитывает difficulty в горячем пути.
- [ ] При загрузке приложения синхронно подключается слишком большая часть функций, которые не нужны для первого кадра игры.
- [ ] Legacy storage keys остаются потенциальным источником quota pressure.

### Архитектурный долг

- [ ] `v30/v31/v32/v33/v34/v39` и hardening-файлы содержат функционал, который должен жить в нормальных модулях.
- [ ] Нет единого performance budget в CI.
- [ ] Нет полноценного browser soak test.
- [ ] Нет автоматической проверки роста DOM/listeners/timers/heap в длинной сессии.

---

## 6. Целевая архитектура

Целевая структура runtime:

```text
js/
  core/
    lifecycle.js
    scheduler.js
    persistence/
      indexed-db.js
      round-store.js
      profile-store.js
      migration.js
    sync/
      sync-manager.js
      pending-events.js
    analytics/
      analytics-queue.js
    updates/
      update-manager.js
    platform/
      capabilities.js

  game/
    engine/
      state.js
      commands.js
      reducer.js
      validation.js
      scoring.js
      generator.js
      undo.js
    renderer/
      board-renderer.js
      hud-renderer.js
      animation-manager.js

  features/
    campaign/
    mascots/
    collectibles/
    challenges/
    profile/
    hub/
```

Фактические имена могут быть уточнены при реализации, но разделение ответственности сохраняется.

### Основной runtime flow

```text
User Input
    │
    ▼
Game Command
    │
    ▼
GameEngine.reduce(state, command)
    │
    ├── newState
    └── effects
           │
     ┌─────┼──────────────┐
     ▼     ▼              ▼
 Renderer Persistence   Audio/etc
```

Engine не должен напрямую:

- писать в DOM;
- обращаться к `localStorage`;
- выполнять fetch;
- управлять service worker;
- создавать browser listeners.

---

## 7. Этап 0 — Baseline и измеряемость

**Цель:** получить воспроизводимую исходную точку до структурных изменений.

### Задачи

- [ ] Зафиксировать benchmark build/commit.
- [ ] Создать диагностический runtime-counter для dev/test режима:
  - число round saves;
  - число profile saves;
  - объём сериализованного state;
  - объём сериализованного profile;
  - число network calls;
  - число active timers;
  - число active animations;
  - число DOM nodes;
  - число зарегистрированных runtime listeners, где технически возможно;
  - длительность render;
  - длительность save/serialization.
- [ ] Добавить измерение long tasks там, где API доступен.
- [ ] Подготовить scripted stress scenarios.
- [ ] Снять baseline минимум на:
  - desktop Chromium;
  - Firefox;
  - Safari macOS;
  - Android Chrome;
  - iPhone Safari/PWA.

### Готовность этапа

Этап закрыт, когда будущие изменения можно сравнивать с числовым baseline, а не только с ощущением «стало быстрее».

---

## 8. Этап 1 — Устранение конфликтующих runtime-костылей

**Цель:** убрать наиболее опасные конфликты без изменения игровой механики.

### Persistence/lifecycle

- [ ] Удалить из `v34` принудительный `save({ immediate:true })` для каждого обычного save.
- [ ] Удалить 8-секундный full checkpoint активного расклада.
- [ ] Гарантировать: одна успешная мутация игрового state → максимум один синхронный round checkpoint.
- [ ] Запретить full profile save только из-за `render()`.
- [ ] Свести `visibilitychange/pagehide/pageshow/focus/online/offline` в один `LifecycleManager`.
- [ ] Coalesce повторные события resume/focus/visibility в одну задачу.

### Listeners/animations

- [ ] Исправить повторное добавление listeners в profile editor.
- [ ] Все постоянные DOM controls должны использовать один bind или делегирование.
- [ ] `returnDragGhost()` должен иметь гарантированный timeout и cleanup.
- [ ] На constrained runtime не использовать WAAPI там, где анимация не является обязательной для механики.
- [ ] Любая animation должна иметь владельца и cleanup path при background/re-render.

### Сеть

- [ ] Не выполнять необязательный polling во время активного расклада.
- [ ] Объединить developer mail polling в один сервис.
- [ ] Не выполнять service worker update check во время активного расклада.

### Готовность этапа

- [ ] Нет периодического full profile save во время бездействия в раскладе.
- [ ] Нет двойного immediate round save на обычный ход.
- [ ] Повторное открытие/закрытие профиля 100 раз не увеличивает число обработчиков действия.
- [ ] Active round не генерирует фоновые mail/challenge/update запросы без явной необходимости.

---

## 9. Этап 2 — Новый persistence и offline event queue

**Цель:** убрать тяжёлый `localStorage` из горячего пути и сделать offline-first хранение структурно надёжным.

### Разделение данных

Создать независимые сущности:

```text
RoundState
PlayerProfile
PendingEvents
LocalSettings
RuntimeDiagnostics
```

### IndexedDB

- [ ] Ввести IndexedDB как основное хранилище больших данных.
- [ ] `localStorage` оставить только для небольших bootstrap/emergency markers.
- [ ] Реализовать schema versioning.
- [ ] Реализовать atomic write для round state.
- [ ] Реализовать два безопасных round snapshot slot либо transaction-backed storage.
- [ ] Реализовать проверку/восстановление после повреждённой записи.

### Profile persistence

- [ ] Полный профиль сериализуется только когда реально изменён долгосрочный профиль.
- [ ] Не делать многократные stringify→parse→stringify одного profile в одном save cycle.
- [ ] Backup profile обновлять по контролируемой стратегии, а не на каждый игровой action.
- [ ] Удалить obsolete legacy profile keys после подтверждённой миграции.
- [ ] Ввести client-side size monitoring профиля.

### Pending events

- [ ] `completionTransactions` перестроить в очередь неподтверждённых событий.
- [ ] Событие содержит уникальный id и точные данные результата.
- [ ] При успешном server ACK событие удаляется из pending queue.
- [ ] Повторная отправка одного idempotency key безопасна.
- [ ] Неподтверждённое событие не удаляется из-за soft-limit очереди.
- [ ] Для очень долгого offline периода использовать IndexedDB и/или безопасную семантическую compaction, не теряющую прогресс.
- [ ] После sync сервер возвращает канонический snapshot/version.

### Звёзды

- [ ] Каждый campaign completion event хранит точный `levelId` и `stars`.
- [ ] Merge звёзд выполняется по конкретному уровню.
- [ ] `totalStars` пересчитывается из `starsByLevel`.
- [ ] Нет формулы `levelsCompleted × stars`.

### Готовность этапа

- [ ] 100 offline завершений переживают force-close приложения и синхронизируются после появления сети.
- [ ] Один и тот же pending event можно отправить много раз без двойного начисления.
- [ ] После ACK локальная очередь реально уменьшается.
- [ ] Размер основного канонического профиля не растёт линейно от каждого сыгранного расклада.
- [ ] Storage quota failure имеет понятный fallback и диагностику.

---

## 10. Этап 3 — Выделение чистого Game Engine

**Цель:** отделить правила игры от UI, persistence и browser runtime.

### Командная модель

Базовые команды:

```text
MOVE_CARD
DRAW_STOCK
RECYCLE_WASTE
UNDO
RESTART
USE_HINT
AUTO_MOVE
START_LEVEL
COMPLETE_CATEGORY
FINISH_LEVEL
```

### Требования

- [ ] State transition для игровых команд должен быть детерминированным.
- [ ] Validation хода не зависит от DOM.
- [ ] Engine возвращает `newState + effects`.
- [ ] Persistence вызывается эффектом/контроллером, а не глубоко внутри игровых правил.
- [ ] Analytics вызывается по event/effect, а не из низкоуровневых функций перемещения.
- [ ] Audio/haptics/animations не входят в engine state transition.
- [ ] Генерация уровня по seed воспроизводима.
- [ ] Для каждого command-path существуют unit tests.

### Undo

- [ ] Перейти от полных JSON snapshot, где возможно, к command inverse / compact patch.
- [ ] Undo history имеет жёсткий memory budget.
- [ ] Undo не может восстановить profile fields из устаревшего snapshot.

### Готовность этапа

- [ ] Core game rules тестируются в Node без DOM/browser.
- [ ] Один и тот же seed + sequence commands даёт одинаковый final state.
- [ ] Browser renderer можно заменить/перезапустить без изменения игровой логики.

---

## 11. Этап 4 — Incremental Renderer

**Цель:** убрать полную пересборку поля на обычный ход.

### Требования

- [ ] Полный `renderBoard()` используется при создании/восстановлении уровня.
- [ ] Обычный move обновляет только изменённые зоны.
- [ ] Отдельные функции:
  - `updateColumn(index)`;
  - `updateSlot(index)`;
  - `updateStock()`;
  - `updateWaste()`;
  - `updateHud()`.
- [ ] Постоянные DOM-узлы переиспользуются.
- [ ] Knowledge tracking работает от событий reveal/draw, а не через полный scan после render.
- [ ] Глобальный MutationObserver для игрового поля убирается или ограничивается узкой областью.
- [ ] `pointermove` подключается только на время активного drag, если это подтверждается тестами как безопасное улучшение.
- [ ] Все transient nodes (`drag ghost`, `auto-fly`, celebration, hint lines) имеют жёсткий cleanup.

### Готовность этапа

- [ ] Нормальный ход не пересоздаёт всё игровое поле.
- [ ] DOM node count после длинной партии не растёт монотонно.
- [ ] После 100 drag/cancel нет detached transient nodes.
- [ ] После 100 открытий/закрытий overlay node count возвращается к baseline с допустимым отклонением.

---

## 12. Этап 5 — Единый SyncManager и фоновые сервисы

**Цель:** убрать конкурирующие network schedulers.

### SyncManager

- [ ] Один owner для account/profile sync.
- [ ] Один replaceable debounce timer.
- [ ] Один in-flight sync на профиль.
- [ ] Idempotent retry.
- [ ] Exponential backoff для повторных ошибок.
- [ ] Abort obsolete requests при смене аккаунта/сессии.
- [ ] Нет cloud refresh из каждого focus/visibility/online handler отдельно.

### Фоновая работа

- [ ] Challenge sync выполняется в hub/resume/after-round, а не в горячем пути игры.
- [ ] Developer mail использует один scheduler.
- [ ] Push-state sync использует общий lifecycle scheduler.
- [ ] Leaderboard projection обновляется сервером из канонического профиля.
- [ ] Никакой network response не может понизить монотонный игровой прогресс.

### Готовность этапа

- [ ] Быстрое `focus → visibility → online` не создаёт три одинаковых запроса.
- [ ] Обычный игровой move делает 0 network calls.
- [ ] Offline/online flapping не создаёт request storm.
- [ ] Смена аккаунта отменяет старые pending sync операции.

---

## 13. Этап 6 — Service Worker и build generation

**Цель:** исключить mixed-version runtime и тяжёлые обновления во время игры.

### Critical app shell

- [ ] Список обязательных файлов генерируется сборщиком из фактического `dist-frontend`.
- [ ] Нет ручного рассинхронизированного списка patch-файлов.
- [ ] Critical cache содержит только файлы, без которых приложение не может безопасно запуститься.
- [ ] Косметика, альтернативные иконки, большие изображения и редкие assets кэшируются лениво.

### Install/update

- [ ] Один необязательный asset не может сорвать установку нового app shell.
- [ ] SW update check не запускается в активном раскладе.
- [ ] Новый worker может скачаться в фоне, но activation происходит только в safe point.
- [ ] Safe point:
  - hub;
  - завершённый уровень;
  - запуск приложения без активного round;
  - явное подтверждение пользователя при необходимости.
- [ ] Не использовать uncontrolled `skipWaiting + clients.claim` посреди живого round.
- [ ] Перед reload активный round гарантированно checkpointed.

### Готовность этапа

- [ ] Обновление приложения посреди партии не меняет поколение runtime до safe point.
- [ ] Первый offline запуск после обновления не зависит от случайно не закэшированных hardening scripts.
- [ ] Удаление одного optional mascot asset не ломает установку critical app shell.

---

## 14. Этап 7 — Удаление patch/hardening-архитектуры

**Цель:** перенести полезный функционал из исторических patch-файлов в нормальные модули и удалить runtime monkey-patching.

### Файлы-кандидаты на разбор

- [ ] `v30-patch.js`
- [ ] `v31-patch.js`
- [ ] `v31-first-run-ui.js`
- [ ] `v32-ui-fixes.js`
- [ ] `v33-fox-journey.js`
- [ ] `v34-product-update.js`
- [ ] `v39-rarity-collectibles.js`
- [ ] `client-stability-hardening.js`
- [ ] `mobile-consistency-hardening.js`
- [ ] `cross-device-sync-hardening.js`
- [ ] `canonical-sync-hardening.js`
- [ ] `ios-round-stability-v2.js`

Каждый файл разбирается по функциональным обязанностям.

Пример:

```text
v33 fox journey
→ features/mascots/fox/*

v39 rarity
→ features/collectibles/rarity/*

v32 campaign picker
→ features/campaign/picker/*

stability patches
→ core/lifecycle + persistence + animation manager
```

### CI architecture guard

- [ ] Добавить проверку, запрещающую переопределение ключевых runtime globals.
- [ ] Запретить новые файлы вида `*-patch.js`, `*-hardening.js` без явного исключения.
- [ ] Проверять, что production build не грузит устаревшие patch-файлы после миграции.

### Готовность этапа

- [ ] 0 production monkey-patches критических функций.
- [ ] Старые patch/hardening-файлы удалены из production bundle.
- [ ] Их функциональность покрыта нормальными modules/tests.

---

## 15. Этап 8 — Производительность и долгие сессии

**Цель:** сделать лёгкость игры измеряемым свойством.

### Analytics

- [ ] `track()` пишет сначала в memory queue.
- [ ] Диск обновляется батчами в idle/background/scheduled flush.
- [ ] Analytics не блокирует обычный игровой move.

### Generator

- [ ] Кэшировать category difficulty.
- [ ] По возможности использовать заранее подготовленные difficulty buckets.
- [ ] Не выполнять повторный полный sort одного большого pool без необходимости.
- [ ] Сохранить детерминизм seed.

### Lazy loading

- [ ] Не загружать тяжёлые hub/collectible/rare-feature модули до необходимости.
- [ ] Первый игровой кадр зависит только от critical runtime.

### Memory budgets

При тестах должны контролироваться:

- JS heap;
- DOM nodes;
- detached nodes;
- active animations;
- active timers;
- listeners;
- IndexedDB/localStorage footprint;
- pending event queue;
- profile serialized size.

---

## 16. Test strategy

### 16.1. Unit tests

Обязательные направления:

- command reducer;
- move validation;
- deterministic generator;
- scoring;
- stars merge;
- pending event idempotency;
- offline merge;
- storage migration;
- service worker manifest generation;
- sync scheduler;
- lifecycle scheduler;
- undo patches.

### 16.2. Browser integration tests

Добавить browser test harness, предпочтительно Playwright или эквивалент.

Минимум:

- Chromium;
- Firefox;
- WebKit engine.

WebKit automation не заменяет реальное тестирование iOS Safari/PWA, но является обязательным дополнительным контуром.

### 16.3. Real-device matrix

Перед закрытием плана нужны реальные smoke/soak проверки минимум на:

- iPhone Safari;
- iPhone PWA;
- Android Chrome;
- Android PWA;
- Samsung Internet;
- macOS Safari;
- Windows Chrome/Edge;
- Firefox desktop.

### 16.4. Обязательные стресс-сценарии

- [ ] 1000 игровых действий без reload.
- [ ] 100 restart одного/разных уровней.
- [ ] 100 open/close профиля.
- [ ] 100 hub ↔ game.
- [ ] 100 background ↔ foreground.
- [ ] 100 drag + cancel.
- [ ] 100 undo, где правила режима позволяют.
- [ ] 50 последовательных уровней в одной сессии.
- [ ] Force-close сразу после обычного хода.
- [ ] Force-close сразу после победы.
- [ ] Offline прохождения → force-close → reopen offline → reconnect.
- [ ] Network loss в середине sync.
- [ ] Rapid offline/online flapping.
- [ ] Повреждённый primary round snapshot.
- [ ] Storage write error/quota simulation.
- [ ] Service worker update во время активной партии.
- [ ] Service worker update в hub.
- [ ] Account switch при pending network request.
- [ ] Длинная партия на constrained device.

---

## 17. Критерии завершения всего плана

Документ может быть переведён из активного рабочего статуса только когда выполнены **все** обязательные критерии.

### Архитектура

- [ ] 0 production monkey-patches критических runtime-функций.
- [ ] 1 lifecycle owner.
- [ ] 1 round persistence owner.
- [ ] 1 profile persistence owner.
- [ ] 1 sync manager.
- [ ] 1 update manager.
- [ ] 1 animation cleanup owner.
- [ ] Engine отделён от DOM/storage/network.

### Горячий игровой путь

Для обычного успешного хода:

- [ ] нет network request;
- [ ] нет full profile serialization;
- [ ] не более одного durable round checkpoint;
- [ ] нет полной пересборки всего игрового поля;
- [ ] нет обязательной Web Animation для корректности механики;
- [ ] нет фонового polling side effect.

### Persistence

- [ ] Force-close после подтверждённого игрового действия не теряет это действие.
- [ ] Backup/recovery не удаляет единственную валидную копию.
- [ ] Pending offline events переживают перезапуск.
- [ ] Server ACK реально очищает pending queue.
- [ ] Канонический профиль не растёт линейно от каждого когда-либо сыгранного расклада.
- [ ] Нет регулярных full profile saves во время бездействия.

### Sync

- [ ] Серверный профиль остаётся единственным источником истины.
- [ ] Leaderboard только projection.
- [ ] Старое устройство не может понизить более высокий подтверждённый прогресс.
- [ ] Звёзды сливаются по конкретным уровням.
- [ ] Не начисляются искусственные звёзды из числа пройденных уровней.
- [ ] Дубликаты offline event не дают двойной награды.

### Memory

В лабораторном soak test после стабилизации/GC:

- [ ] DOM node count не растёт монотонно между завершёнными сценариями.
- [ ] Нет растущего числа detached transient nodes.
- [ ] Нет растущего числа обработчиков постоянных controls.
- [ ] Нет растущего числа active animations/timers после закрытия соответствующей функции.
- [ ] После серии из 50 уровней heap не демонстрирует устойчивый линейный рост; ориентир — не более ~20% выше стабилизированного baseline после GC, если измерение браузера позволяет корректное сравнение.

### Performance

Целевые бюджеты должны быть подтверждены baseline и тестами. Начальные ориентиры:

- [ ] p95 обычного command→paint < 50 ms на среднем современном desktop/телефоне.
- [ ] p95 command→paint < 80 ms на constrained target device.
- [ ] Нет регулярных long tasks > 100 ms в steady-state активного расклада из-за внутренней логики игры.
- [ ] Нет периодического CPU spike только из-за фонового checkpoint.

Если реальные baseline покажут необходимость корректировки чисел, изменение бюджета оформляется новой версией этого документа с обоснованием, а не тихим ослаблением критерия.

### PWA/update

- [ ] SW не активирует новое поколение runtime в середине активного round.
- [ ] Critical app shell генерируется автоматически.
- [ ] Offline launch после обновления использует согласованное поколение файлов.
- [ ] Optional asset failure не ломает critical install.

### Cross-platform

- [ ] Обязательная device/browser matrix из раздела 3 пройдена.
- [ ] Нет известного воспроизводимого crash/freeze/data-loss P0/P1 в поддерживаемой среде.
- [ ] Все найденные platform-specific workarounds локализованы в capability/platform adapter, а не размазаны по бизнес-логике.

---

## 18. Definition of Done для каждого этапа

Этап не считается завершённым только после написания кода.

Для каждого этапа обязательны:

1. отдельный PR;
2. автоматические тесты;
3. `Source quality` success;
4. соответствующий frontend/backend deploy success;
5. production smoke-test там, где применимо;
6. отсутствие регрессии сохранения прогресса;
7. обновление checklist этого документа следующей версией при содержательном продвижении;
8. удаление заменённого старого механизма, если новый уже стал единственным владельцем.

Нельзя оставлять старый и новый механизм параллельно «на всякий случай» без ограниченного срока миграции — это снова создаёт двойного владельца.

---

## 19. Порядок реализации

Рекомендуемая последовательность PR:

```text
PR A — baseline + diagnostics
PR B — runtime conflict cleanup
PR C — lifecycle + scheduler ownership
PR D — persistence foundation / IndexedDB
PR E — pending event ACK queue
PR F — pure engine command layer
PR G — incremental renderer
PR H — unified sync/background services
PR I — service worker/build refactor
PR J... — migration of v30-v39 features
PR final — remove legacy patch/hardening bundle
PR test — cross-platform soak/performance gates
```

Фактическое число PR может отличаться, но нельзя объединять весь рефакторинг в один огромный merge.

---

## 20. Стратегия безопасной миграции

Рефакторинг проводится по принципу strangler migration.

### Для критических данных

1. Новый store сначала умеет читать старый формат.
2. Выполняется миграция.
3. Новая запись проверяется.
4. На ограниченный переходный период возможна диагностическая dual-validation.
5. После подтверждения новый store становится единственным writer.
6. Старый writer удаляется.
7. Legacy data очищается только после подтверждения успешного перехода.

### Для engine

1. Выделяется pure функция для одной операции.
2. Старый UI вызывает её.
3. Результаты сравниваются тестами.
4. Следующий участок переносится только после зелёного CI.

### Для renderer

1. Full render остаётся recovery/fallback path.
2. Обычные команды постепенно переходят на incremental patches.
3. После покрытия всех команд full render перестаёт быть hot path.

---

## 21. Rollback policy

Каждый миграционный PR должен быть обратим без потери пользовательского прогресса.

Запрещено:

- мигрировать данные необратимо до успешной записи нового формата;
- удалять старый snapshot до верификации нового;
- менять идентификаторы уровней/звёзд без migration map;
- делать rollback, который понижает канонический прогресс игрока.

При аварийном rollback новая версия клиента должна уметь либо читать предыдущий формат, либо оставить его нетронутым.

---

## 22. Что не входит в этот рефакторинг

До отдельного решения этот план не требует:

- переписывать игру с нуля;
- переходить на React/Vue/Svelte;
- менять игровую механику;
- переделывать визуальный стиль;
- сбрасывать существующие профили;
- менять систему звёзд;
- менять контент уровней;
- заменять backend только ради технологического стека.

Любой такой шаг допустим только если отдельно доказано, что он необходим для достижения целей стабильности.

---

## 23. Финальный технический образ игры

После выполнения плана горячий путь обычного хода должен выглядеть примерно так:

```text
pointer/tap
   │
   ▼
GameCommand
   │
   ▼
GameEngine
   │
   ├── new state
   └── effects
        │
        ├── small DOM patch
        ├── one lightweight round checkpoint
        ├── sound/haptic
        └── optional deferred analytics
```

И в нём **не должно** происходить:

```text
full profile save
full board rebuild
network sync
leaderboard write
service worker update
mail polling
multiple JSON clones
multiple competing lifecycle handlers
```

Именно это состояние является целевым фундаментом дальнейшего развития Словасьянса.

---

## 24. История версий

### v0.01 — 2026-09-04

Первая зафиксированная рабочая версия плана.

Зафиксированы:

- результаты технического аудита после PR #18;
- cross-platform scope;
- отказ от дальнейшего наращивания patch/hardening-архитектуры;
- целевая модульная архитектура runtime;
- этапы persistence, engine, renderer, sync и service worker refactor;
- требования к offline-first и каноническому прогрессу;
- правила точного учёта звёзд по уровням;
- cross-platform test matrix;
- измеримые критерии завершения.
