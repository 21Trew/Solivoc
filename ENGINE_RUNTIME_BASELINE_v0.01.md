# ENGINE RUNTIME BASELINE — Словасьянс

> **Статус:** рабочий runtime baseline
> **Версия:** 0.01
> **Дата:** 2026-09-04
> **Stability plan:** `ENGINE_RUNTIME_STABILITY_PLAN_v0.01.md`
> **Audit baseline commit:** `204c482b5da305c05adea661a37b35592ecd1d4e`
> **Stage 0 implementation base:** `664e799ce7df98b3ff71c949f322504bebcb4868`

## 1. Назначение

Этот документ фиксирует формат измеряемого baseline для планового runtime-рефакторинга. Он не меняет игровые правила и не объявляет проблемы стабильности закрытыми.

Baseline снимается одним и тем же диагностическим контуром до и после каждого следующего этапа.

## 2. Включение диагностики

Диагностика отключена по умолчанию.

Временно включить для одной сессии:

```text
?runtimeDiagnostics=1
```

Либо для нескольких перезапусков устройства:

```js
localStorage.setItem("solivoc-runtime-diagnostics", "1")
```

Снять snapshot в консоли:

```js
runtimeDiagnostics.sampleRuntime()
runtimeDiagnostics.snapshot()
```

После теста постоянный флаг нужно удалить:

```js
localStorage.removeItem("solivoc-runtime-diagnostics")
```

## 3. Метрики v0.01

Диагностический слой фиксирует:

- `roundSaves` — число фактических изменений durable round snapshot, прошедших через текущий `persistStateNow()`;
- `profileSaves` — число выполнений текущего profile writer;
- `stateBytes` — размер сериализованного игрового state;
- `profileBytes` — размер сериализованного профиля;
- `networkCalls` — вызовы текущего `apiFetch()`;
- `render` — синхронная длительность текущего renderer;
- `roundPersist` — длительность текущего round persistence;
- `profileSave` — длительность текущего profile save;
- `domNodes` — текущий DOM node count;
- `activeAnimations` — число Web Animations, видимых через `document.getAnimations()`;
- `heapUsedBytes / heapLimitBytes` — только там, где браузер предоставляет `performance.memory`;
- `longTasks` — только там, где поддерживается Long Tasks API;
- `trackedActiveTimers` — best-effort счётчик известных timer slots текущей архитектуры.

### Ограничение v0.01

В текущей patch/hardening-архитектуре нет единого реестра browser listeners и timers. Поэтому diagnostics **не подменяет глобально** `addEventListener`, `setTimeout` или `setInterval`: такой monkey-patch исказил бы baseline и сам стал бы новым runtime-риском.

Полный listener/timer ownership должен появиться вместе с `LifecycleManager / Scheduler`, после чего эти метрики становятся точными.

## 4. Обязательные сценарии

Machine-readable список хранится в:

```text
scripts/runtime-baseline-scenarios.mjs
```

Он фиксирует одинаковые stress/soak families для всех последующих сравнений: 1000 действий, 100 restart, 100 profile cycles, 100 lifecycle cycles, 100 drag/cancel, 50 уровней, offline recovery, network flapping, storage failure, service-worker update и account switch.

## 5. Матрица baseline

Значения ниже нельзя заполнять предположениями. Они вносятся только после реального прогона соответствующей среды.

| Среда | Статус | Snapshot / артефакт |
|---|---|---|
| Desktop Chromium | `PENDING_RUN` | — |
| Firefox desktop | `PENDING_RUN` | — |
| Safari macOS | `PENDING_RUN` | — |
| Android Chrome | `PENDING_DEVICE_RUN` | — |
| iPhone Safari | `PENDING_DEVICE_RUN` | — |
| iPhone PWA | `PENDING_DEVICE_RUN` | — |

## 6. Stage 0 gate

Stage 0 можно считать закрытым только после того, как:

1. `Source quality` и автоматические тесты зелёные;
2. frontend build/deploy зелёный;
3. обязательные browser/device baseline-прогоны записаны численно;
4. есть минимум один snapshot каждого обязательного класса среды;
5. дальнейшие PR сравниваются с этим baseline тем же diagnostic format.

До выполнения пунктов 2–4 PR Stage 0 должен оставаться draft и не помечаться как завершённый этап плана.
