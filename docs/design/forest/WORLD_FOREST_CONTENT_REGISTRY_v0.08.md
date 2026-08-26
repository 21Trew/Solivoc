# WORLD FOREST CONTENT REGISTRY — Мир Леса

> **Статус:** рабочий production content registry  
> **Версия:** 0.08  
> **World ID:** `forest`  
> **Охват:** authored ID Мира Леса, уровни `1–100`, first-pass и meaningful revisit  
> **Основание:** `WORLD_FOREST_STATE_SCHEMA_v0.05`, `WORLD_FOREST_STATE_MAP_v0.03`, `WORLD_FOREST_LEVEL_BLUEPRINT_v0.13`, `WORLD_FOREST_DOSSIER_v0.18`, `WORLD_FOREST_ENCOUNTER_REGISTRY_v0.04`, `WORLD_FOREST_KNOWLEDGE_REGISTRY_v0.05`, `WORLD_FOREST_SYNTHESIS_REGISTRY_v0.03`  
> **Назначение:** дать стабильную identity конкретному authored-контенту, который state engine должен сохранять, связывать, маршрутизировать и мигрировать.

---

## 1. Роль registry

`STATE_SCHEMA` отвечает:

> **как состояние представлено в данных?**

Этот документ отвечает:

> **какие именно authored-сущности Мира Леса используют эту schema?**

Здесь регистрируются:

```text
areas
core scenes
special scenes
choices
choice options
encounters
encounter variants
world facts
world events
knowledge presentation states
reconstructions
revisit definitions
synthesis definitions
thread links
```

Registry не хранит runtime player state.

---

## 2. Статусы записей

Используются явные production-status:

```text
BOUND
ID и смысл можно считать зафиксированными

BOUND_CONCEPT_*
смысл зафиксирован,
но часть реализации / copy / effects ещё открыта

BOUND_ID_TBD_AUTHORED
стабильный слот/ID можно использовать,
но конкретный authored-сценарий ещё не написан

OPTIONS_BOUND_WEIGHTS_TBD
варианты зафиксированы,
числовые authored weights ещё не определены

TBD_AUTHORED
контент реально отсутствует
и не должен быть выдуман registry
```

Главный закон:

> **Registry фиксирует пробел так же явно, как готовый контент.**

---

## 3. Правило стабильности

После первого production-use authored ID:

- не переименовывается ради красоты;
- не переиспользуется для нового смысла;
- не зависит от русского display text;
- меняет содержание через `content_version`, если identity остаётся той же;
- при полном изменении смысла получает новый ID.

Этот документ использует тот же стандарт версий проекта: рабочий документ остаётся `v0.XX`.

---

## 4. Area registry

| Area ID | Название | Уровни |
|---|---|---:|
| `AREA_FOREST_CLEARING` | Поляна | 1–10 |
| `AREA_FOREST_TREES` | Деревья | 11–20 |
| `AREA_FOREST_PLANTS` | Растения | 21–30 |
| `AREA_FOREST_ANIMALS` | Звери | 31–40 |
| `AREA_FOREST_BIRDS` | Птицы | 41–50 |
| `AREA_FOREST_FUNGI` | Грибы | 51–60 |
| `AREA_FOREST_TRACKS` | Следы | 61–70 |
| `AREA_FOREST_NEIGHBORHOOD` | Соседство | 71–80 |
| `AREA_FOREST_CYCLE` | Круговорот | 81–90 |
| `AREA_FOREST_WHOLE` | Лес | 91–100 |

---

## 5. Core scene registry — уровни 1–100

Каждый уровень получает стабильный **core scene ID**.

Это не означает, что у уровня только одна визуальная/диалоговая сцена.

Это стабильный authored anchor, к которому можно привязывать:

- world-fact exposure;
- choices;
- gameplay semantic events;
- encounter inserts;
- telemetry context;
- migration.

| Scene ID | Level | Area | Смысл уровня | Status |
|---|---:|---|---|---|
| `SCN_FOREST_L001_CORE` | 1 | `AREA_FOREST_CLEARING` | Появление | `BOUND` |
| `SCN_FOREST_L002_CORE` | 2 | `AREA_FOREST_CLEARING` | Уже увиденное | `BOUND` |
| `SCN_FOREST_L003_CORE` | 3 | `AREA_FOREST_CLEARING` | Посмотреть точнее | `BOUND` |
| `SCN_FOREST_L004_CORE` | 4 | `AREA_FOREST_CLEARING` | Теперь сам | `BOUND` |
| `SCN_FOREST_L005_CORE` | 5 | `AREA_FOREST_CLEARING` | Контекст | `BOUND` |
| `SCN_FOREST_L006_CORE` | 6 | `AREA_FOREST_CLEARING` | Похожее — не одно и то же | `BOUND` |
| `SCN_FOREST_L007_CORE` | 7 | `AREA_FOREST_CLEARING` | Что именно я увидел? | `BOUND` |
| `SCN_FOREST_L008_CORE` | 8 | `AREA_FOREST_CLEARING` | Как я хочу посмотреть? | `BOUND` |
| `SCN_FOREST_L009_CORE` | 9 | `AREA_FOREST_CLEARING` | Не вся информация дана сразу | `BOUND` |
| `SCN_FOREST_L010_CORE` | 10 | `AREA_FOREST_CLEARING` | Поляна как целое | `BOUND` |
| `SCN_FOREST_L011_CORE` | 11 | `AREA_FOREST_TREES` | Части дерева | `BOUND` |
| `SCN_FOREST_L012_CORE` | 12 | `AREA_FOREST_TREES` | Для чего нужна часть? | `BOUND` |
| `SCN_FOREST_L013_CORE` | 13 | `AREA_FOREST_TREES` | Возраст виден не сразу | `BOUND` |
| `SCN_FOREST_L014_CORE` | 14 | `AREA_FOREST_TREES` | Рост зависит от среды | `BOUND` |
| `SCN_FOREST_L015_CORE` | 15 | `AREA_FOREST_TREES` | Что произошло с деревом? | `BOUND` |
| `SCN_FOREST_L016_CORE` | 16 | `AREA_FOREST_TREES` | Одно дерево — несколько историй | `BOUND` |
| `SCN_FOREST_L017_CORE` | 17 | `AREA_FOREST_TREES` | Часть может обмануть | `BOUND` |
| `SCN_FOREST_L018_CORE` | 18 | `AREA_FOREST_TREES` | Два способа проверить одно | `BOUND` |
| `SCN_FOREST_L019_CORE` | 19 | `AREA_FOREST_TREES` | Связь частей | `BOUND` |
| `SCN_FOREST_L020_CORE` | 20 | `AREA_FOREST_TREES` | Дерево как система | `BOUND` |
| `SCN_FOREST_L021_CORE` | 21 | `AREA_FOREST_PLANTS` | Похожее | `BOUND` |
| `SCN_FOREST_L022_CORE` | 22 | `AREA_FOREST_PLANTS` | Одного признака мало | `BOUND` |
| `SCN_FOREST_L023_CORE` | 23 | `AREA_FOREST_PLANTS` | Сочетание признаков | `BOUND` |
| `SCN_FOREST_L024_CORE` | 24 | `AREA_FOREST_PLANTS` | Похожее происхождение — разный путь | `BOUND` |
| `SCN_FOREST_L025_CORE` | 25 | `AREA_FOREST_PLANTS` | Почти совпадает | `BOUND` |
| `SCN_FOREST_L026_CORE` | 26 | `AREA_FOREST_PLANTS` | Один объект — две правдоподобные версии | `BOUND` |
| `SCN_FOREST_L027_CORE` | 27 | `AREA_FOREST_PLANTS` | Проверить гипотезу | `BOUND` |
| `SCN_FOREST_L028_CORE` | 28 | `AREA_FOREST_PLANTS` | Сходство может быть полезно, даже если ответ различается | `BOUND` |
| `SCN_FOREST_L029_CORE` | 29 | `AREA_FOREST_PLANTS` | Различить и связать | `BOUND` |
| `SCN_FOREST_L030_CORE` | 30 | `AREA_FOREST_PLANTS` | Растения как различия внутри общего | `BOUND` |
| `SCN_FOREST_L031_CORE` | 31 | `AREA_FOREST_ANIMALS` | Что нужно зверю? | `BOUND` |
| `SCN_FOREST_L032_CORE` | 32 | `AREA_FOREST_ANIMALS` | Потребность не определяет один путь | `BOUND` |
| `SCN_FOREST_L033_CORE` | 33 | `AREA_FOREST_ANIMALS` | Действие оставляет след | `BOUND` |
| `SCN_FOREST_L034_CORE` | 34 | `AREA_FOREST_ANIMALS` | Один след — несколько причин | `BOUND` |
| `SCN_FOREST_L035_CORE` | 35 | `AREA_FOREST_ANIMALS` | Среда предлагает возможности | `BOUND` |
| `SCN_FOREST_L036_CORE` | 36 | `AREA_FOREST_ANIMALS` | Территория | `BOUND` |
| `SCN_FOREST_L037_CORE` | 37 | `AREA_FOREST_ANIMALS` | Поведение меняется при угрозе | `BOUND` |
| `SCN_FOREST_L038_CORE` | 38 | `AREA_FOREST_ANIMALS` | Понять намерение по последствиям | `BOUND` |
| `SCN_FOREST_L039_CORE` | 39 | `AREA_FOREST_ANIMALS` | Не каждый след принадлежит тому, кого ты ищешь | `BOUND` |
| `SCN_FOREST_L040_CORE` | 40 | `AREA_FOREST_ANIMALS` | Существо в своей среде | `BOUND` |
| `SCN_FOREST_L041_CORE` | 41 | `AREA_FOREST_BIRDS` | Птица и дерево | `BOUND` |
| `SCN_FOREST_L042_CORE` | 42 | `AREA_FOREST_BIRDS` | Птица и воздух | `BOUND` |
| `SCN_FOREST_L043_CORE` | 43 | `AREA_FOREST_BIRDS` | Птица и пища | `BOUND` |
| `SCN_FOREST_L044_CORE` | 44 | `AREA_FOREST_BIRDS` | Один поступок — несколько последствий | `BOUND` |
| `SCN_FOREST_L045_CORE` | 45 | `AREA_FOREST_BIRDS` | Один объект в нескольких системах | `BOUND` |
| `SCN_FOREST_L046_CORE` | 46 | `AREA_FOREST_BIRDS` | Система меняет значение роли | `BOUND` |
| `SCN_FOREST_L047_CORE` | 47 | `AREA_FOREST_BIRDS` | Связь проходит через движение | `BOUND` |
| `SCN_FOREST_L048_CORE` | 48 | `AREA_FOREST_BIRDS` | Изменение одной связи отзывается в другой | `BOUND` |
| `SCN_FOREST_L049_CORE` | 49 | `AREA_FOREST_BIRDS` | Не существует одной «главной» связи | `BOUND` |
| `SCN_FOREST_L050_CORE` | 50 | `AREA_FOREST_BIRDS` | Птица как узел Леса | `BOUND` |
| `SCN_FOREST_L051_CORE` | 51 | `AREA_FOREST_FUNGI` | Видимая часть | `BOUND` |
| `SCN_FOREST_L052_CORE` | 52 | `AREA_FOREST_FUNGI` | Одинаковое изменение в разных местах | `BOUND` |
| `SCN_FOREST_L053_CORE` | 53 | `AREA_FOREST_FUNGI` | Между ними ничего не видно | `BOUND` |
| `SCN_FOREST_L054_CORE` | 54 | `AREA_FOREST_FUNGI` | Косвенное доказательство | `BOUND` |
| `SCN_FOREST_L055_CORE` | 55 | `AREA_FOREST_FUNGI` | Одна сеть — разные проявления | `BOUND` |
| `SCN_FOREST_L056_CORE` | 56 | `AREA_FOREST_FUNGI` | Проверить невидимое через видимое | `BOUND` |
| `SCN_FOREST_L057_CORE` | 57 | `AREA_FOREST_FUNGI` | Сеть проходит не там, где проходит тропа | `BOUND` |
| `SCN_FOREST_L058_CORE` | 58 | `AREA_FOREST_FUNGI` | Изменение проходит по скрытой связи | `BOUND` |
| `SCN_FOREST_L059_CORE` | 59 | `AREA_FOREST_FUNGI` | Скрытая сеть не объясняет всё | `BOUND` |
| `SCN_FOREST_L060_CORE` | 60 | `AREA_FOREST_FUNGI` | То, что под поверхностью | `BOUND` |
| `SCN_FOREST_L061_CORE` | 61 | `AREA_FOREST_TRACKS` | Кто-то был здесь | `BOUND` |
| `SCN_FOREST_L062_CORE` | 62 | `AREA_FOREST_TRACKS` | Свежий и старый | `BOUND` |
| `SCN_FOREST_L063_CORE` | 63 | `AREA_FOREST_TRACKS` | Одно событие — несколько следов | `BOUND` |
| `SCN_FOREST_L064_CORE` | 64 | `AREA_FOREST_TRACKS` | Один след — несколько историй | `BOUND` |
| `SCN_FOREST_L065_CORE` | 65 | `AREA_FOREST_TRACKS` | След, которого нет | `BOUND` |
| `SCN_FOREST_L066_CORE` | 66 | `AREA_FOREST_TRACKS` | Что было раньше? | `BOUND` |
| `SCN_FOREST_L067_CORE` | 67 | `AREA_FOREST_TRACKS` | Красивое объяснение ломается | `BOUND` |
| `SCN_FOREST_L068_CORE` | 68 | `AREA_FOREST_TRACKS` | Здесь прошло несколько историй | `BOUND` |
| `SCN_FOREST_L069_CORE` | 69 | `AREA_FOREST_TRACKS` | След говорит не всё | `BOUND` |
| `SCN_FOREST_L070_CORE` | 70 | `AREA_FOREST_TRACKS` | Место помнит последствия | `BOUND` |
| `SCN_FOREST_L071_CORE` | 71 | `AREA_FOREST_NEIGHBORHOOD` | Одно место — разные потребности | `BOUND` |
| `SCN_FOREST_L072_CORE` | 72 | `AREA_FOREST_NEIGHBORHOOD` | Связь имеет направление | `BOUND` |
| `SCN_FOREST_L073_CORE` | 73 | `AREA_FOREST_NEIGHBORHOOD` | Связь без встречи | `BOUND` |
| `SCN_FOREST_L074_CORE` | 74 | `AREA_FOREST_NEIGHBORHOOD` | Один ресурс — несколько интересов | `BOUND` |
| `SCN_FOREST_L075_CORE` | 75 | `AREA_FOREST_NEIGHBORHOOD` | Чужое действие меняет мой путь | `BOUND` |
| `SCN_FOREST_L076_CORE` | 76 | `AREA_FOREST_NEIGHBORHOOD` | Попробуем вместе | `BOUND` |
| `SCN_FOREST_L077_CORE` | 77 | `AREA_FOREST_NEIGHBORHOOD` | Польза одному — не обязательно польза другому | `BOUND` |
| `SCN_FOREST_L078_CORE` | 78 | `AREA_FOREST_NEIGHBORHOOD` | Третий меняет связь двух | `BOUND` |
| `SCN_FOREST_L079_CORE` | 79 | `AREA_FOREST_NEIGHBORHOOD` | Равновесие движется | `BOUND` |
| `SCN_FOREST_L080_CORE` | 80 | `AREA_FOREST_NEIGHBORHOOD` | Соседство как сеть | `BOUND` |
| `SCN_FOREST_L081_CORE` | 81 | `AREA_FOREST_CYCLE` | Что остаётся после конца | `BOUND` |
| `SCN_FOREST_L082_CORE` | 82 | `AREA_FOREST_CYCLE` | Разложение продолжает историю | `BOUND` |
| `SCN_FOREST_L083_CORE` | 83 | `AREA_FOREST_CYCLE` | Результат становится ресурсом | `BOUND` |
| `SCN_FOREST_L084_CORE` | 84 | `AREA_FOREST_CYCLE` | Цепь начинает замыкаться | `BOUND` |
| `SCN_FOREST_L085_CORE` | 85 | `AREA_FOREST_CYCLE` | Где начало? | `BOUND` |
| `SCN_FOREST_L086_CORE` | 86 | `AREA_FOREST_CYCLE` | Нарушение цикла | `BOUND` |
| `SCN_FOREST_L087_CORE` | 87 | `AREA_FOREST_CYCLE` | Цикл находит другой путь | `BOUND` |
| `SCN_FOREST_L088_CORE` | 88 | `AREA_FOREST_CYCLE` | Несколько циклов пересекаются | `BOUND` |
| `SCN_FOREST_L089_CORE` | 89 | `AREA_FOREST_CYCLE` | Наших двух способов всё ещё недостаточно | `BOUND` |
| `SCN_FOREST_L090_CORE` | 90 | `AREA_FOREST_CYCLE` | Синтез отношений | `BOUND` |
| `SCN_FOREST_L091_CORE` | 91 | `AREA_FOREST_WHOLE` | Теперь нас двое | `BOUND` |
| `SCN_FOREST_L092_CORE` | 92 | `AREA_FOREST_WHOLE` | Один объект — несколько ролей | `BOUND` |
| `SCN_FOREST_L093_CORE` | 93 | `AREA_FOREST_WHOLE` | Связь продолжается после действия | `BOUND` |
| `SCN_FOREST_L094_CORE` | 94 | `AREA_FOREST_WHOLE` | Локально правильно — системно плохо | `BOUND` |
| `SCN_FOREST_L095_CORE` | 95 | `AREA_FOREST_WHOLE` | Где заканчивается объект? | `BOUND` |
| `SCN_FOREST_L096_CORE` | 96 | `AREA_FOREST_WHOLE` | У Леса нет единственного центра | `BOUND` |
| `SCN_FOREST_L097_CORE` | 97 | `AREA_FOREST_WHOLE` | Один узор на разных масштабах | `BOUND` |
| `SCN_FOREST_L098_CORE` | 98 | `AREA_FOREST_WHOLE` | Поляна, увиденная снова | `BOUND` |
| `SCN_FOREST_L099_CORE` | 99 | `AREA_FOREST_WHOLE` | Испытание Синтеза Леса | `BOUND` |
| `SCN_FOREST_L100_CORE` | 100 | `AREA_FOREST_WHOLE` | Лес становится различим | `BOUND` |

---

## 6. Special scene registry

| Scene ID | Level | Area | Назначение | Status |
|---|---:|---|---|---|
| `SCN_FOREST_L001_SOUL_ARRIVAL` | 1 | `AREA_FOREST_CLEARING` | появление новой души + Кот + Сова | `BOUND` |
| `SCN_FOREST_L002_CAT_PERSPECTIVE_TUTORIAL` | 2 | `AREA_FOREST_CLEARING` | обязательное безопасное знакомство с «Эхом памяти» | `BOUND_CONCEPT_EFFECT_TBD` |
| `SCN_FOREST_L003_OWL_PERSPECTIVE_TUTORIAL` | 3 | `AREA_FOREST_CLEARING` | обязательное безопасное знакомство с «Пристальным взглядом» | `BOUND_CONCEPT_EFFECT_TBD` |
| `SCN_FOREST_L008_VOLUNTARY_PERSPECTIVE` | 8 | `AREA_FOREST_CLEARING` | первая добровольная перспектива | `BOUND` |
| `SCN_FOREST_L060_RESPONSE` | 60 | `AREA_FOREST_FUNGI` | возможный первый согласованный Отклик | `BOUND` |
| `SCN_FOREST_L090_RELATIONSHIP_SYNTHESIS` | 90 | `AREA_FOREST_CYCLE` | Синтез отношений и первый спутник | `BOUND_VARIANT_SCRIPT_TBD` |
| `SCN_FOREST_L098_CLEARING_REVISIT` | 98 | `AREA_FOREST_WHOLE` | Поляна, увиденная снова | `BOUND` |
| `SCN_FOREST_L099_WORLD_SYNTHESIS` | 99 | `AREA_FOREST_WHOLE` | Испытание Синтеза Леса | `BOUND_CONTENT_DETAIL_TBD` |
| `SCN_FOREST_L099_SYNTHESIS_REVELATION` | 99 | `AREA_FOREST_WHOLE` | player-initiated **«Увидеть целое»** после `MODEL_SOLVED` | `BOUND` |
| `SCN_FOREST_L100_ELEMENTAL_MANIFESTATION` | 100 | `AREA_FOREST_WHOLE` | полное проявление Лесного элементаля | `BOUND_VISUAL_VOICE_TBD` |

Encounter-variant scenes не получают отдельные scene-ID до написания их actual authored scripts.

До этого их stable identity задаётся Encounter Variant Registry.

---

## 7. Authored Choice Registry

Здесь перечислены только те решения, которые blueprint уже формулирует как **осознанный authored action/routing choice**.

Обычные gameplay-ходы не превращаются автоматически в `CHOICE_*`.

| Choice ID | Level | Area | Kind | Options | Status |
|---|---:|---|---|---:|---|
| `CHOICE_FOREST_L05_ATTENTION` | 5 | `AREA_FOREST_CLEARING` | `attention` | 4 | `WEIGHTS_BOUND` |
| `CHOICE_FOREST_L08_PERSPECTIVE` | 8 | `AREA_FOREST_CLEARING` | `perspective` | 3 | `WEIGHTS_BOUND` |
| `CHOICE_FOREST_L10_ROUTING` | 10 | `AREA_FOREST_CLEARING` | `routing_question` | 4 | `WEIGHTS_BOUND` |
| `CHOICE_FOREST_L12_FOREGROUND` | 12 | `AREA_FOREST_TREES` | `attention` | 4 | `WEIGHTS_BOUND` |
| `CHOICE_FOREST_L15_METHOD` | 15 | `AREA_FOREST_TREES` | `investigation_method` | 4 | `WEIGHTS_BOUND` |
| `CHOICE_FOREST_L20_ROUTING` | 20 | `AREA_FOREST_TREES` | `routing_question` | 4 | `OPTIONS_BOUND_WEIGHTS_TBD` |
| `CHOICE_FOREST_L25_AMBIGUITY` | 25 | `AREA_FOREST_PLANTS` | `ambiguity_method` | 4 | `WEIGHTS_BOUND` |
| `CHOICE_FOREST_L30_ROUTING` | 30 | `AREA_FOREST_PLANTS` | `routing_question` | 4 | `OPTIONS_BOUND_WEIGHTS_TBD` |
| `CHOICE_FOREST_L36_TERRITORY_METHOD` | 36 | `AREA_FOREST_ANIMALS` | `investigation_method` | 4 | `WEIGHTS_BOUND` |
| `CHOICE_FOREST_L40_ROUTING` | 40 | `AREA_FOREST_ANIMALS` | `routing_question` | 4 | `OPTIONS_BOUND_WEIGHTS_TBD` |
| `CHOICE_FOREST_L45_SYSTEM_METHOD` | 45 | `AREA_FOREST_BIRDS` | `system_method` | 4 | `WEIGHTS_BOUND` |
| `CHOICE_FOREST_L50_ROUTING` | 50 | `AREA_FOREST_BIRDS` | `routing_question` | 4 | `OPTIONS_BOUND_WEIGHTS_TBD` |
| `CHOICE_FOREST_L53_HIDDEN_METHOD` | 53 | `AREA_FOREST_FUNGI` | `investigation_method` | 4 | `WEIGHTS_BOUND` |
| `CHOICE_FOREST_L60_ROUTING` | 60 | `AREA_FOREST_FUNGI` | `routing_question` | 4 | `OPTIONS_BOUND_WEIGHTS_TBD` |
| `CHOICE_FOREST_L65_ABSENCE_METHOD` | 65 | `AREA_FOREST_TRACKS` | `absence_method` | 4 | `WEIGHTS_BOUND` |
| `CHOICE_FOREST_L70_ROUTING` | 70 | `AREA_FOREST_TRACKS` | `routing_question` | 4 | `OPTIONS_BOUND_WEIGHTS_TBD` |
| `CHOICE_FOREST_L80_ROUTING` | 80 | `AREA_FOREST_NEIGHBORHOOD` | `routing_question` | 4 | `OPTIONS_BOUND_WEIGHTS_TBD` |

---

## 8. Choice Option Registry

| Choice ID | Option ID | Смысл | Authored weights / status |
|---|---|---|---|
| `CHOICE_FOREST_L05_ATTENTION` | `old_tree_mark` | Осмотреть старую отметину | memory +2; comparison +1; depth +2; cat_thread +1 |
| `CHOICE_FOREST_L05_ATTENTION` | `damaged_sapling` | Проверить повреждённый молодой росток | observation +2; verification +2; comparison +1; owl_thread +1 |
| `CHOICE_FOREST_L05_ATTENTION` | `bent_grass` | Посмотреть на примятую траву у края Поляны | discovery +2; intuition +1; observation +1; fox_thread +1 only with factual evidence |
| `CHOICE_FOREST_L05_ATTENTION` | `flower_pattern` | Проверить странный рисунок цветов | comparison +2; observation +2; reinterpretation +1 |
| `CHOICE_FOREST_L08_PERSPECTIVE` | `cat_memory_echo` | Эхо памяти | memory +2; cat_understanding +1; cat_thread +1 |
| `CHOICE_FOREST_L08_PERSPECTIVE` | `owl_close_look` | Пристальный взгляд | observation +2; verification +1; owl_understanding +1; owl_thread +1 |
| `CHOICE_FOREST_L08_PERSPECTIVE` | `no_borrowed_perspective` | Без заимствованной перспективы | no artificial stat |
| `CHOICE_FOREST_L10_ROUTING` | `old_tree` | Старое дерево | memory +3; depth +2; comparison +1; cat_thread +2 |
| `CHOICE_FOREST_L10_ROUTING` | `damaged_young_tree` | Молодое повреждённое дерево | observation +3; verification +2; comparison +1; owl_thread +2 |
| `CHOICE_FOREST_L10_ROUTING` | `narrow_path` | Узкая тропа | discovery +3; intuition +2; fox_thread +1 only with factual evidence |
| `CHOICE_FOREST_L10_ROUTING` | `stay_on_clearing` | Остаться на Поляне | comparison +2; reinterpretation +2; depth +1; observation +1 |
| `CHOICE_FOREST_L12_FOREGROUND` | `old_healed_wound` | Старая заросшая рана | memory +2; comparison +1; depth +1; cat_thread +1 |
| `CHOICE_FOREST_L12_FOREGROUND` | `fresh_bark_damage` | Свежая повреждённая кора | observation +2; verification +2; owl_thread +1 |
| `CHOICE_FOREST_L12_FOREGROUND` | `track_near_roots` | След рядом с корнями | discovery +2; observation +1; intuition +1; fox_thread +1 only if present |
| `CHOICE_FOREST_L12_FOREGROUND` | `root_shape_repeat` | Повтор формы корней | comparison +2; reinterpretation +1; depth +1 |
| `CHOICE_FOREST_L15_METHOD` | `remember_similar_damage` | Вспомнить похожее повреждение | memory +2; comparison +2; cat_understanding +1 |
| `CHOICE_FOREST_L15_METHOD` | `gather_more_signs` | Собрать ещё признаки | observation +2; verification +2; owl_understanding +1 |
| `CHOICE_FOREST_L15_METHOD` | `check_edge` | Проверить край участка | discovery +2; intuition +1; observation +1; fox_thread +1 only with factual evidence |
| `CHOICE_FOREST_L15_METHOD` | `compare_two_trees` | Сравнить два дерева целиком | comparison +3; reinterpretation +1 |
| `CHOICE_FOREST_L20_ROUTING` | `what_makes_similar_different` | Что делает похожее разным? | TBD_WEIGHTS |
| `CHOICE_FOREST_L20_ROUTING` | `what_changes_growth` | Что меняет рост? | TBD_WEIGHTS |
| `CHOICE_FOREST_L20_ROUTING` | `what_hides_at_edge` | Что скрывается у края? | TBD_WEIGHTS |
| `CHOICE_FOREST_L20_ROUTING` | `where_pattern_repeats` | Где повторяется знакомый рисунок? | TBD_WEIGHTS |
| `CHOICE_FOREST_L25_AMBIGUITY` | `check_distinguishing_trait` | Проверить различающий признак | observation +2; verification +3; comparison +2; owl_thread +1 only if scene-relevant |
| `CHOICE_FOREST_L25_AMBIGUITY` | `remember_similar_case` | Вспомнить прежний похожий случай | memory +2; comparison +2; depth +1; cat_thread +1 |
| `CHOICE_FOREST_L25_AMBIGUITY` | `trace_new_sign_source` | Проследить, откуда появился новый след | discovery +2; intuition +1; observation +1; fox_thread +1 only if factual trace exists |
| `CHOICE_FOREST_L25_AMBIGUITY` | `hold_both_hypotheses` | Пока оставить обе версии открытыми | comparison +2; reinterpretation +1; verification +1 |
| `CHOICE_FOREST_L30_ROUTING` | `what_creature_does` | Что существо делает | TBD_WEIGHTS |
| `CHOICE_FOREST_L30_ROUTING` | `what_creature_needs` | Что ему нужно | TBD_WEIGHTS |
| `CHOICE_FOREST_L30_ROUTING` | `where_creature_lives` | Где оно живёт | TBD_WEIGHTS |
| `CHOICE_FOREST_L30_ROUTING` | `infer_behavior_from_tracks` | По каким следам понять его поведение | TBD_WEIGHTS |
| `CHOICE_FOREST_L36_TERRITORY_METHOD` | `follow_repeated_route` | Проследить повторяющийся маршрут | discovery +2; comparison +2; intuition +1; pathfinding_evidence +1; fox_thread +1 only if actually Fox |
| `CHOICE_FOREST_L36_TERRITORY_METHOD` | `check_track_boundary` | Проверить границу следов | observation +2; verification +2; comparison +1 |
| `CHOICE_FOREST_L36_TERRITORY_METHOD` | `find_resource` | Искать ресурс, ради которого сюда возвращаются | depth +2; contextual_reasoning +2; analysis_evidence +1 |
| `CHOICE_FOREST_L36_TERRITORY_METHOD` | `compare_old_tracks` | Сопоставить с более ранними следами | memory +2; comparison +2; reinterpretation +1; cat_thread +1 only if scene-relevant |
| `CHOICE_FOREST_L40_ROUTING` | `one_creature_many_environments` | Как одно существо связано с несколькими средами | TBD_WEIGHTS |
| `CHOICE_FOREST_L40_ROUTING` | `what_is_carried` | Куда оно переносит что-то | TBD_WEIGHTS |
| `CHOICE_FOREST_L40_ROUTING` | `what_changes_through_movement` | Что меняется при перемещении | TBD_WEIGHTS |
| `CHOICE_FOREST_L40_ROUTING` | `what_direction_reveals` | Что можно понять по направлению | TBD_WEIGHTS |
| `CHOICE_FOREST_L45_SYSTEM_METHOD` | `separate_by_systems` | Разделить связи по системам | comparison +2; observation +1; verification +1; systems_evidence +1 |
| `CHOICE_FOREST_L45_SYSTEM_METHOD` | `find_common_link` | Найти общее звено между несколькими связями | comparison +2; depth +2; pattern_recognition +1; synthesis_evidence +1 |
| `CHOICE_FOREST_L45_SYSTEM_METHOD` | `follow_movement` | Проследить движение между точками | discovery +2; intuition +1; pathfinding_evidence +1; network_evidence +1 |
| `CHOICE_FOREST_L45_SYSTEM_METHOD` | `remember_previous_sightings` | Вспомнить, где эта птица уже появлялась | memory +2; reinterpretation +1; cross_context_evidence +1 |
| `CHOICE_FOREST_L50_ROUTING` | `seek_hidden` | Искать скрытое | TBD_WEIGHTS |
| `CHOICE_FOREST_L50_ROUTING` | `connect_distant` | Проверить, что связывает удалённое | TBD_WEIGHTS |
| `CHOICE_FOREST_L50_ROUTING` | `study_barely_visible` | Изучить то, чего почти не видно | TBD_WEIGHTS |
| `CHOICE_FOREST_L50_ROUTING` | `trace_below_surface` | Проследить изменение под поверхностью | TBD_WEIGHTS |
| `CHOICE_FOREST_L53_HIDDEN_METHOD` | `seek_visible_bridge` | Искать прямой видимый мост | observation +2; verification +1 |
| `CHOICE_FOREST_L53_HIDDEN_METHOD` | `compare_soil_conditions` | Сравнить почву и условия | observation +2; comparison +2; analysis_evidence +1 |
| `CHOICE_FOREST_L53_HIDDEN_METHOD` | `remember_similar_occurrence` | Вспомнить, где уже происходило похожее | memory +2; comparison +1; depth +1; cat_thread +1 |
| `CHOICE_FOREST_L53_HIDDEN_METHOD` | `observe_change_over_time` | Наблюдать изменение во времени | verification +2; depth +1; hidden_structure_evidence +1 |
| `CHOICE_FOREST_L60_ROUTING` | `seek_what_disappeared` | Искать то, что исчезло | TBD_WEIGHTS |
| `CHOICE_FOREST_L60_ROUTING` | `reconstruct_event` | Восстановить событие | TBD_WEIGHTS |
| `CHOICE_FOREST_L60_ROUTING` | `check_place_memory` | Проверить память места | TBD_WEIGHTS |
| `CHOICE_FOREST_L60_ROUTING` | `read_absence_as_trace` | Читать отсутствие как след | TBD_WEIGHTS |
| `CHOICE_FOREST_L65_ABSENCE_METHOD` | `verify_expectation_pattern` | Проверить, действительно ли паттерн был устойчивым | memory +2; verification +2 |
| `CHOICE_FOREST_L65_ABSENCE_METHOD` | `seek_new_nearby_cause` | Искать новую причину рядом | observation +2; discovery +1 |
| `CHOICE_FOREST_L65_ABSENCE_METHOD` | `check_route_change` | Проверить, изменился ли маршрут | comparison +2; pathfinding_evidence +1 |
| `CHOICE_FOREST_L65_ABSENCE_METHOD` | `withhold_absence_conclusion` | Не считать отсутствие доказательством без дополнительных оснований | verification +2; reinterpretation +1 |
| `CHOICE_FOREST_L70_ROUTING` | `who_uses_same_place` | Кто пользуется одним местом | TBD_WEIGHTS |
| `CHOICE_FOREST_L70_ROUTING` | `who_changes_others_path` | Кто меняет путь другого | TBD_WEIGHTS |
| `CHOICE_FOREST_L70_ROUTING` | `who_needs_same_resource` | Кому нужен один ресурс | TBD_WEIGHTS |
| `CHOICE_FOREST_L70_ROUTING` | `what_when_interests_cross` | Что происходит, когда интересы пересекаются | TBD_WEIGHTS |
| `CHOICE_FOREST_L80_ROUTING` | `what_happens_to_ended` | Что происходит с тем, что заканчивается | TBD_WEIGHTS |
| `CHOICE_FOREST_L80_ROUTING` | `where_used_goes` | Куда девается использованное | TBD_WEIGHTS |
| `CHOICE_FOREST_L80_ROUTING` | `what_becomes_next_resource` | Что становится ресурсом для следующего | TBD_WEIGHTS |
| `CHOICE_FOREST_L80_ROUTING` | `how_consequences_return` | Как последствия возвращаются в систему | TBD_WEIGHTS |

### 8.1. Важный guard

Если в blueprint перечислены только вопросы следующей главы, но не задана числовая семантика, registry **не изобретает веса**.

Такие значения остаются:

```text
TBD_WEIGHTS
```

до отдельного content-balancing pass.

---

## 9. Encounter Registry

| Encounter ID | Window | Variants | Функция |
|---|---|---:|---|
| `ENC_FOREST_01` | 1 | 1 | start acquaintance; one encounter-node opening two relationships |
| `ENC_FOREST_02` | 16–19 | 3 | early relationship understanding; exact fallback TBD_AUTHORED |
| `ENC_FOREST_03` | 25–29 | 4 | first true divergence; Fox can be first full meeting |
| `ENC_FOREST_04` | 35–39 | 5 | behavior/environment; exact joint composition TBD_AUTHORED |
| `ENC_FOREST_05` | 45–49 | 5 | one object in multiple systems |
| `ENC_FOREST_06` | 55–59 | 5 | indirect evidence / hidden structure |
| `ENC_FOREST_07` | 65–69 | 4 | observation vs reconstruction; Cat+Owl especially natural |
| `ENC_FOREST_08` | 76–79 | 3 | temporary alliance |
| `ENC_FOREST_09` | 84–87 | 3 | transfer of shared method |
| `ENC_FOREST_10` | 90 | 3 | Relationship Synthesis → first companion |
| `ENC_FOREST_11` | 100 | 1 | full Forest Elemental encounter |

---

## 10. Encounter Variant Registry

| Variant ID | Parent | Variant | Status |
|---|---|---|---|
| `ENC_FOREST_01_CAT_OWL` | `ENC_FOREST_01` | `CAT_OWL` | `BOUND` |
| `ENC_FOREST_02_CAT` | `ENC_FOREST_02` | `CAT` | `BOUND_CONCEPT_TBD_FINAL_SCRIPT` |
| `ENC_FOREST_02_OWL` | `ENC_FOREST_02` | `OWL` | `BOUND_CONCEPT_TBD_FINAL_SCRIPT` |
| `ENC_FOREST_02_CAT_OWL` | `ENC_FOREST_02` | `CAT_OWL` | `BOUND_CONCEPT_TBD_FINAL_SCRIPT` |
| `ENC_FOREST_03_FOX` | `ENC_FOREST_03` | `FOX` | `BOUND_CONCEPT_TBD_FINAL_SCRIPT` |
| `ENC_FOREST_03_CAT` | `ENC_FOREST_03` | `CAT` | `BOUND_CONCEPT_TBD_FINAL_SCRIPT` |
| `ENC_FOREST_03_OWL` | `ENC_FOREST_03` | `OWL` | `BOUND_CONCEPT_TBD_FINAL_SCRIPT` |
| `ENC_FOREST_03_CAT_OWL` | `ENC_FOREST_03` | `CAT_OWL` | `BOUND_CONCEPT_TBD_FINAL_SCRIPT` |
| `ENC_FOREST_04_FOX_FIRST` | `ENC_FOREST_04` | `FOX_FIRST` | `BOUND_CONCEPT_TBD_FINAL_SCRIPT` |
| `ENC_FOREST_04_FOX_CONTINUATION` | `ENC_FOREST_04` | `FOX_CONTINUATION` | `BOUND_CONCEPT_TBD_FINAL_SCRIPT` |
| `ENC_FOREST_04_CAT` | `ENC_FOREST_04` | `CAT` | `BOUND_CONCEPT_TBD_FINAL_SCRIPT` |
| `ENC_FOREST_04_OWL` | `ENC_FOREST_04` | `OWL` | `BOUND_CONCEPT_TBD_FINAL_SCRIPT` |
| `ENC_FOREST_04_CAT_OWL` | `ENC_FOREST_04` | `CAT_OWL` | `BOUND_CONCEPT_TBD_FINAL_SCRIPT` |
| `ENC_FOREST_05_OWL` | `ENC_FOREST_05` | `OWL` | `BOUND_CONCEPT_TBD_FINAL_SCRIPT` |
| `ENC_FOREST_05_CAT` | `ENC_FOREST_05` | `CAT` | `BOUND_CONCEPT_TBD_FINAL_SCRIPT` |
| `ENC_FOREST_05_FOX` | `ENC_FOREST_05` | `FOX` | `BOUND_CONCEPT_TBD_FINAL_SCRIPT` |
| `ENC_FOREST_05_CAT_OWL` | `ENC_FOREST_05` | `CAT_OWL` | `BOUND_CONCEPT_TBD_FINAL_SCRIPT` |
| `ENC_FOREST_05_OWL_FOX` | `ENC_FOREST_05` | `OWL_FOX` | `BOUND_CONCEPT_TBD_FINAL_SCRIPT` |
| `ENC_FOREST_06_OWL` | `ENC_FOREST_06` | `OWL` | `BOUND_CONCEPT_TBD_FINAL_SCRIPT` |
| `ENC_FOREST_06_CAT` | `ENC_FOREST_06` | `CAT` | `BOUND_CONCEPT_TBD_FINAL_SCRIPT` |
| `ENC_FOREST_06_FOX` | `ENC_FOREST_06` | `FOX` | `BOUND_CONCEPT_TBD_FINAL_SCRIPT` |
| `ENC_FOREST_06_CAT_OWL` | `ENC_FOREST_06` | `CAT_OWL` | `BOUND_CONCEPT_TBD_FINAL_SCRIPT` |
| `ENC_FOREST_06_OWL_FOX` | `ENC_FOREST_06` | `OWL_FOX` | `BOUND_CONCEPT_TBD_FINAL_SCRIPT` |
| `ENC_FOREST_07_CAT` | `ENC_FOREST_07` | `CAT` | `BOUND_CONCEPT_TBD_FINAL_SCRIPT` |
| `ENC_FOREST_07_OWL` | `ENC_FOREST_07` | `OWL` | `BOUND_CONCEPT_TBD_FINAL_SCRIPT` |
| `ENC_FOREST_07_FOX` | `ENC_FOREST_07` | `FOX` | `BOUND_CONCEPT_TBD_FINAL_SCRIPT` |
| `ENC_FOREST_07_CAT_OWL` | `ENC_FOREST_07` | `CAT_OWL` | `BOUND_CONCEPT_TBD_FINAL_SCRIPT` |
| `ENC_FOREST_08_CAT` | `ENC_FOREST_08` | `CAT` | `BOUND_CONCEPT_TBD_FINAL_SCRIPT` |
| `ENC_FOREST_08_OWL` | `ENC_FOREST_08` | `OWL` | `BOUND_CONCEPT_TBD_FINAL_SCRIPT` |
| `ENC_FOREST_08_FOX` | `ENC_FOREST_08` | `FOX` | `BOUND_CONCEPT_TBD_FINAL_SCRIPT` |
| `ENC_FOREST_09_CAT` | `ENC_FOREST_09` | `CAT` | `BOUND_CONCEPT_TBD_FINAL_SCRIPT` |
| `ENC_FOREST_09_OWL` | `ENC_FOREST_09` | `OWL` | `BOUND_CONCEPT_TBD_FINAL_SCRIPT` |
| `ENC_FOREST_09_FOX` | `ENC_FOREST_09` | `FOX` | `BOUND_CONCEPT_TBD_FINAL_SCRIPT` |
| `ENC_FOREST_10_CAT` | `ENC_FOREST_10` | `CAT` | `BOUND_CONCEPT_TBD_FINAL_SCRIPT` |
| `ENC_FOREST_10_OWL` | `ENC_FOREST_10` | `OWL` | `BOUND_CONCEPT_TBD_FINAL_SCRIPT` |
| `ENC_FOREST_10_FOX` | `ENC_FOREST_10` | `FOX` | `BOUND_CONCEPT_TBD_FINAL_SCRIPT` |
| `ENC_FOREST_11_ELEMENTAL` | `ENC_FOREST_11` | `ELEMENTAL` | `BOUND` |

### 10.1. Состояние encounter-authoring после v0.02

`WORLD_FOREST_ENCOUNTER_REGISTRY_v0.04` теперь фиксирует для Encounters `1–11`:

- narrative purpose;
- participant-specific variant ID;
- character contradiction;
- вклад персонажа;
- вклад игрока;
- relationship target;
- routing/fallback policy;
- Encounter 9 switch guards;
- Encounter 10 tie-break;
- QA invariants.

Поэтому encounter variants имеют статус `BOUND_CONCEPT_TBD_FINAL_SCRIPT`: **смысловая сцена и routing зафиксированы, но финальные диалоги, exact layout/puzzle, анимации и локальные scene-ID ещё не написаны.**

---

## 11. World Fact Registry

После `STATE_SCHEMA_v0.01` explicit registry содержит:

```text
WF_F01–WF_F70
```

| World Fact | Slug | First level | Area | Registry role | Status | Смысл |
|---|---|---:|---|---|---|---|
| `WF_F01` | `clearing_flower_pattern_01` | 1 | `AREA_FOREST_CLEARING` | `core` | `BOUND` | необычно чёткая геометрия нескольких цветов |
| `WF_F02` | `root_branch_rhyme_01` | 1 | `AREA_FOREST_CLEARING` | `elemental_pattern_candidate` | `BOUND` | визуальная рифма ветвей и корней |
| `WF_F03` | `old_tree_mark_01` | 2 | `AREA_FOREST_CLEARING` | `core` | `BOUND` | старая отметина / повреждение на дереве |
| `WF_F04` | `small_track_partial_01` | 3 | `AREA_FOREST_CLEARING` | `fox_evidence` | `BOUND` | неполный след небольшого зверя |
| `WF_F05` | `bent_grass_line_01` | 4 | `AREA_FOREST_CLEARING` | `core` | `BOUND` | узкая примятая линия травы к краю Поляны |
| `WF_F06` | `root_interlock_01` | 11 | `AREA_FOREST_TREES` | `elemental_pattern_candidate` | `BOUND` | корни двух соседних деревьев визуально сходятся под землёй; пока это природная деталь. |
| `WF_F07` | `low_bark_mark_01` | 12 | `AREA_FOREST_TREES` | `fox_evidence` | `BOUND` | Возможен низкая свежая отметина на коре рядом с узким проходом. |
| `WF_F08` | `old_new_damage_pair_01` | 13 | `AREA_FOREST_TREES` | `core` | `BOUND` | старый заросший рубец и свежая царапина существуют рядом. |
| `WF_F09` | `sapling_light_bend_01` | 14 | `AREA_FOREST_TREES` | `core` | `BOUND` | несколько молодых деревьев изгибаются к одному световому окну. |
| `WF_F10` | `fur_on_low_branch_01` | 15 | `AREA_FOREST_TREES` | `fox_evidence` | `BOUND` | Для FOCUS_NARROW_PATH может появиться маленький рыжеватый волос/клочок шерсти на низкой ветке. Не маркируется как «лисий». |
| `WF_F11` | `similar_leaf_pair_01` | 21 | `AREA_FOREST_PLANTS` | `core` | `BOUND` | два очень похожих растения растут рядом, но имеют едва заметно разную структуру листа. |
| `WF_F12` | `stem_difference_01` | 22 | `AREA_FOREST_PLANTS` | `core` | `BOUND` | у похожих растений различается строение стебля. |
| `WF_F13` | `narrow_gap_route_01` | 24 | `AREA_FOREST_PLANTS` | `fox_evidence` | `BOUND` | между растениями существует проход, слишком узкий и непопулярный для обычной тропы. |
| `WF_F14` | `fox_scale_context_01` | 26 | `AREA_FOREST_PLANTS` | `fox_evidence` | `BOUND` | Возможен масштаб следа становится сравним с известным объектом и даёт основание судить о размере зверя. |
| `WF_F15` | `repeated_small_route_01` | 29 | `AREA_FOREST_PLANTS` | `fox_evidence` | `BOUND` | несколько ранее разрозненных лисьих evidence складываются в устойчивый маршрут для тех, кто их notice/connected. |
| `WF_F16` | `feeding_trace_01` | 31 | `AREA_FOREST_ANIMALS` | `core` | `BOUND` | остатки пищи в месте, где самого зверя нет. |
| `WF_F17` | `shelter_variants_01` | 32 | `AREA_FOREST_ANIMALS` | `core` | `BOUND` | два разных типа укрытия выполняют близкую функцию. |
| `WF_F18` | `crossed_tracks_01` | 33 | `AREA_FOREST_ANIMALS` | `core` | `BOUND` | несколько следов пересекаются, но принадлежат разным действиям/существам. |
| `WF_F19` | `environment_affordance_01` | 35 | `AREA_FOREST_ANIMALS` | `core` | `BOUND` | один и тот же зверь меняет маршрут из-за структуры среды. |
| `WF_F20` | `interrupted_route_01` | 37 | `AREA_FOREST_ANIMALS` | `core` | `BOUND` | привычный маршрут внезапно меняется из-за внешнего фактора. |
| `WF_F21` | `repeated_perch_01` | 41 | `AREA_FOREST_BIRDS` | `core` | `BOUND` | одна и та же точка на дереве используется птицами неоднократно. |
| `WF_F22` | `wind_route_01` | 42 | `AREA_FOREST_BIRDS` | `core` | `BOUND` | движение птиц повторяет устойчивый воздушный коридор. |
| `WF_F23` | `carried_seed_01` | 43 | `AREA_FOREST_BIRDS` | `core` | `BOUND` | семя оказывается далеко от исходного растения. |
| `WF_F24` | `multi_system_bird_01` | 45 | `AREA_FOREST_BIRDS` | `core` | `BOUND` | одна птица появляется в нескольких уже известных контекстах. |
| `WF_F25` | `predator_prey_role_shift_01` | 46 | `AREA_FOREST_BIRDS` | `core` | `BOUND` | одна сущность занимает разные роли относительно разных соседей. |
| `WF_F26` | `route_connects_sites_01` | 47 | `AREA_FOREST_BIRDS` | `core` | `BOUND` | повторяющийся перелёт объединяет воду, дерево и пищевой участок. |
| `WF_F27` | `displaced_route_01` | 48 | `AREA_FOREST_BIRDS` | `core` | `BOUND` | птицы меняют привычное направление после изменения среды. |
| `WF_F28` | `fruiting_cluster_01` | 51 | `AREA_FOREST_FUNGI` | `elemental_pattern_candidate` | `BOUND` | удалённые грибы появляются в подозрительно согласованном состоянии. |
| `WF_F29` | `synchronized_change_01` | 52 | `AREA_FOREST_FUNGI` | `elemental_pattern_candidate` | `BOUND` | . |
| `WF_F30` | `hidden_connection_gap_01` | 53 | `AREA_FOREST_FUNGI` | `elemental_pattern_candidate` | `BOUND` | отсутствие видимого пути само становится значимым фактом. |
| `WF_F31` | `soil_moisture_pattern_01` | 54 | `AREA_FOREST_FUNGI` | `elemental_pattern_candidate` | `BOUND` | ; распределение влаги рифмуется с грибами. |
| `WF_F32` | `multi_manifestation_01` | 55 | `AREA_FOREST_FUNGI` | `elemental_pattern_candidate` | `BOUND` | . |
| `WF_F33` | `underground_route_mismatch_01` | 57 | `AREA_FOREST_FUNGI` | `elemental_pattern_candidate` | `BOUND` | . |
| `WF_F34` | `propagated_effect_01` | 58 | `AREA_FOREST_FUNGI` | `elemental_pattern_candidate` | `BOUND` | . |
| `WF_F35` | `fresh_track_cluster_01` | 61 | `AREA_FOREST_TRACKS` | `core` | `BOUND` | несколько свежих следов без видимого источника. |
| `WF_F36` | `trace_age_pair_01` | 62 | `AREA_FOREST_TRACKS` | `core` | `BOUND` | два сходных следа разной давности. |
| `WF_F37` | `multi_trace_event_01` | 63 | `AREA_FOREST_TRACKS` | `core` | `BOUND` | . Здесь же может существовать очень слабый dormant Guardian-fact. |
| `WF_F38` | `ambiguous_broken_branch_01` | 64 | `AREA_FOREST_TRACKS` | `core` | `BOUND` | . |
| `WF_F39` | `missing_expected_trace_01` | 65 | `AREA_FOREST_TRACKS` | `core` | `BOUND` | привычная линия следов внезапно прекращается. |
| `WF_F40` | `trace_overlap_sequence_01` | 66 | `AREA_FOREST_TRACKS` | `core` | `BOUND` | . |
| `WF_F41` | `contradiction_trace_01` | 67 | `AREA_FOREST_TRACKS` | `core` | `BOUND` | . |
| `WF_F42` | `overlapping_histories_01` | 68 | `AREA_FOREST_TRACKS` | `core` | `BOUND` | . |
| `WF_F43` | `incomplete_event_record_01` | 69 | `AREA_FOREST_TRACKS` | `core` | `BOUND` | . |
| `WF_F44` | `shared_space_01` | 71 | `AREA_FOREST_NEIGHBORHOOD` | `core` | `BOUND` | один участок несёт следы нескольких независимых потребностей. |
| `WF_F45` | `directional_relation_01` | 72 | `AREA_FOREST_NEIGHBORHOOD` | `core` | `BOUND` | . |
| `WF_F46` | `mediated_relation_01` | 73 | `AREA_FOREST_NEIGHBORHOOD` | `core` | `BOUND` | влияние существует через изменённую среду. |
| `WF_F47` | `shared_resource_pressure_01` | 74 | `AREA_FOREST_NEIGHBORHOOD` | `core` | `BOUND` | . |
| `WF_F48` | `indirect_path_effect_01` | 75 | `AREA_FOREST_NEIGHBORHOOD` | `core` | `BOUND` | . |
| `WF_F49` | `asymmetric_outcome_01` | 77 | `AREA_FOREST_NEIGHBORHOOD` | `core` | `BOUND` | . |
| `WF_F50` | `third_party_shift_01` | 78 | `AREA_FOREST_NEIGHBORHOOD` | `core` | `BOUND` | . |
| `WF_F51` | `dynamic_balance_01` | 79 | `AREA_FOREST_NEIGHBORHOOD` | `core` | `BOUND` | . |
| `WF_F52` | `process_residue_01` | 81 | `AREA_FOREST_CYCLE` | `core` | `BOUND` | остаток оказывается не мусором, а потенциальным условием следующего процесса. |
| `WF_F53` | `decomposition_transition_01` | 82 | `AREA_FOREST_CYCLE` | `core` | `BOUND` | . |
| `WF_F54` | `output_as_input_01` | 83 | `AREA_FOREST_CYCLE` | `core` | `BOUND` | . |
| `WF_F55` | `first_closed_loop_01` | 84 | `AREA_FOREST_CYCLE` | `core` | `BOUND` | . |
| `WF_F56` | `multiple_cycle_entry_01` | 85 | `AREA_FOREST_CYCLE` | `core` | `BOUND` | . |
| `WF_F57` | `cycle_disruption_01` | 86 | `AREA_FOREST_CYCLE` | `core` | `BOUND` | . |
| `WF_F58` | `alternate_cycle_path_01` | 87 | `AREA_FOREST_CYCLE` | `core` | `BOUND` | . |
| `WF_F59` | `interlocked_cycles_01` | 88 | `AREA_FOREST_CYCLE` | `core` | `BOUND` | . |
| `WF_F60` | `relationship_synthesis_prelude_01` | 89 | `AREA_FOREST_CYCLE` | `core` | `BOUND` | . |
| `WF_F61` | `lingering_influence_01` | 93 | `AREA_FOREST_WHOLE` | `core` | `BOUND` | последствие пересекает границы нескольких прежних глав. |
| `WF_F62` | `local_global_conflict_01` | 94 | `AREA_FOREST_WHOLE` | `core` | `BOUND` | . |
| `WF_F63` | `influence_boundary_01` | 95 | `AREA_FOREST_WHOLE` | `core` | `BOUND` | . |
| `WF_F64` | `distributed_system_01` | 96 | `AREA_FOREST_WHOLE` | `elemental_pattern_candidate` | `BOUND` | система сохраняет целостность без управляющего центра. |
| `WF_F65` | `cross_scale_pattern_01` | 97 | `AREA_FOREST_WHOLE` | `elemental_pattern_candidate` | `BOUND` | . Старые observation «Повторяющийся узор» получают зрелый контекст. |
| `WF_F66` | `full_small_track_01` | 23 | `AREA_FOREST_PLANTS` | `fox_evidence` | `BOUND` | более полный маленький отпечаток в мягкой почве, пригодный для сравнения формы |
| `WF_F67` | `bark_scrape_trace_01` | 34 | `AREA_FOREST_ANIMALS` | `core` | `BOUND` | содранная кора как независимый неоднозначный trace |
| `WF_F68` | `disturbed_ground_trace_01` | 34 | `AREA_FOREST_ANIMALS` | `core` | `BOUND` | разрытая / нарушенная земля как независимый trace |
| `WF_F69` | `broken_branch_trace_01` | 34 | `AREA_FOREST_ANIMALS` | `core` | `BOUND` | сломанная ветвь как независимый неоднозначный trace |
| `WF_F70` | `constellation_fragment_01` | 100 | `AREA_FOREST_WHOLE` | `cross_world_observation` | `BOUND` | объективный неполный узор большего масштаба; player-facing термин «Созвездие Познания» ещё не раскрывается |

---

## 12. Pattern exposures не дублируют world facts

Уровни 28 и 50 повторно foreground-ят:

```text
ветви
корни
жилки
маршруты
```

Registry не создаёт:

```text
WF_F71
WF_F72
```

только потому, что один motif был показан ещё раз.

Повтор хранится как новый:

```text
FOREST_WORLD_FACT_EXPOSED
```

или exposure к pattern-family.

Это сохраняет различие:

```text
новый факт
≠
новая встреча со старым фактом
```

---

## 13. World Event Registry

| World Event ID | Level / window | Area | Смысл | Status |
|---|---|---|---|---|
| `WE_FOREST_MULTI_ANIMAL_ENVIRONMENT_SHIFT_01` | 40 | `AREA_FOREST_ANIMALS` | действия нескольких зверей совместно изменили участок среды | `BOUND_ID_EFFECTS_TBD` |
| `WE_FOREST_RESPONSE_01` | 60 | `AREA_FOREST_FUNGI` | первый согласованный Отклик Леса | `BOUND` |
| `WE_FOREST_ELEMENTAL_PARTIAL_MANIFESTATION_01` | chapter 9 / exact level TBD | `AREA_FOREST_CYCLE` | частичное природное проявление без имени/диалога | `BOUND_CONCEPT_LEVEL_TBD` |
| `WE_FOREST_ELEMENTAL_FULL_MANIFESTATION_01` | 100 | `AREA_FOREST_WHOLE` | полное проявление Лесного элементаля после Синтеза | `BOUND` |

### 13.1. Не превращаем события в world facts

Отдельно существуют:

```text
Relationship Synthesis
Companion acquisition
Encounter completion
Forest Synthesis
```

Но это narrative/player events, а не `WE_*` объективного мира.

---

## 14. Knowledge Presentation Registry

Это authored presentation definitions.

Runtime `KnowledgeRecord` остаётся отдельной player-specific записью.

| Definition ID | Kind | UI group | display_state_key | Рабочий смысл / title | Status |
|---|---|---|---|---|---|
| `KR_FOREST_CAT_CHARACTER` | `entity_history` | `character` | `character.cat` | Кот | `BOUND` |
| `KR_FOREST_CAT_COMPANION` | `entity_history` | `companion` | `companion.cat` | Кот / Спутник | `BOUND` |
| `KR_FOREST_OWL_CHARACTER` | `entity_history` | `character` | `character.owl` | Сова | `BOUND` |
| `KR_FOREST_OWL_COMPANION` | `entity_history` | `companion` | `companion.owl` | Сова / Спутник | `BOUND` |
| `KR_FOREST_FOX_TRACE_UNKNOWN` | `entity_history` | `observation` | `fox.trace.unknown` | неизвестный след | `BOUND` |
| `KR_FOREST_FOX_TRACE_SMALL_CREATURE` | `entity_history` | `observation` | `fox.trace.small_creature` | следы небольшого зверя | `BOUND` |
| `KR_FOREST_FOX_TRACE_FOX_LIKE` | `entity_history` | `observation` | `fox.trace.fox_like` | следы похожи на лисьи | `BOUND` |
| `KR_FOREST_FOX_TRACE_YOUNG_FOX` | `entity_history` | `observation` | `fox.trace.young_fox` | вероятно, лисёнок | `BOUND` |
| `KR_FOREST_FOX_CHARACTER` | `entity_history` | `character` | `character.fox` | Лис | `BOUND` |
| `KR_FOREST_FOX_COMPANION` | `entity_history` | `companion` | `companion.fox` | Лис / Спутник | `BOUND` |
| `KR_FOREST_PATTERN_REPEATING` | `pattern` | `observation` | `forest.pattern.repeating` | Повторяющийся узор | `BOUND` |
| `KR_FOREST_RESPONSE_COORDINATED` | `phenomenon` | `observation` | `forest.response.coordinated` | Согласованный Отклик | `BOUND` |
| `KR_FOREST_MANIFESTATION_PARTIAL` | `phenomenon` | `observation` | `forest.manifestation.partial` | Частичное проявление | `BOUND` |
| `KR_FOREST_ELEMENTAL_CHARACTER` | `entity_history` | `character` | `character.forest_elemental` | Лесной элементаль | `TITLE_TBD` |
| `KR_FOREST_RECONSTRUCTION_PASSAGE` | `reconstruction` | `observation` | `forest.reconstruction.creature_passage` | реконструкция прохождения крупного существа | `BOUND_CONCEPT_COPY_TBD` |
| `KR_FOREST_NETWORK_MODEL` | `system_model` | `observation` | `forest.network.shared_space` | сеть отношений участка | `BOUND_CONCEPT_COPY_TBD` |
| `KR_FOREST_CYCLE_MODEL` | `system_model` | `observation` | `forest.cycle.closed_loop` | устойчивая петля / цикл | `BOUND_CONCEPT_COPY_TBD` |
| `KR_FOREST_WORLD_SYNTHESIS` | `system_model` | `observation` | `forest.system.whole` | Лес как целая система | `BOUND_CONCEPT_COPY_TBD` |
| `KR_FOREST_CONSTELLATION_INCOMPLETE` | `cross_world_observation` | `observation` | `constellation.incomplete_pattern` | Неполный узор | `BOUND` |
| `KR_FOREST_OBS_PARTIAL_TRACK` | `observation` | `observation` | `forest.obs.partial_track` | Неполный след | `BOUND_CONCEPT_COPY_TBD` |
| `KR_FOREST_OBS_BENT_GRASS` | `observation` | `observation` | `forest.obs.bent_grass` | Примятая трава | `BOUND_CONCEPT_COPY_TBD` |
| `KR_FOREST_OBS_BARK_MARK` | `observation` | `observation` | `forest.obs.bark_mark` | Свежая отметина на коре | `BOUND_CONCEPT_COPY_TBD` |
| `KR_FOREST_OBS_FUR_SNAG` | `observation` | `observation` | `forest.obs.fur_snag` | Рыжеватая шерсть | `BOUND_CONCEPT_COPY_TBD` |
| `KR_FOREST_OBS_FULL_SMALL_TRACK` | `observation` | `observation` | `forest.obs.full_small_track` | Чёткий маленький след | `BOUND_CONCEPT_COPY_TBD` |
| `KR_FOREST_OBS_FRESH_TRACKS` | `observation` | `observation` | `forest.obs.fresh_tracks` | Свежие следы | `BOUND_CONCEPT_COPY_TBD` |
| `KR_FOREST_OBS_TRACE_AGE` | `observation` | `observation` | `forest.obs.trace_age` | Следы разной давности | `BOUND_CONCEPT_COPY_TBD` |
| `KR_FOREST_OBS_BROKEN_BRANCH` | `observation` | `observation` | `forest.obs.broken_branch` | Сломанная ветвь | `BOUND_CONCEPT_COPY_TBD` |
| `KR_FOREST_OBS_MISSING_TRACE` | `observation` | `observation` | `forest.obs.missing_trace` | Оборвавшаяся цепочка следов | `BOUND_CONCEPT_COPY_TBD` |
| `KR_FOREST_OBS_TRACE_OVERLAP` | `observation` | `observation` | `forest.obs.trace_overlap` | Перекрывающиеся следы | `BOUND_CONCEPT_COPY_TBD` |
| `KR_FOREST_OBS_CONTRADICTION` | `observation` | `observation` | `forest.obs.contradiction` | След, который не сходится | `BOUND_CONCEPT_COPY_TBD` |
| `KR_FOREST_RECONSTRUCTION_TRACE_SEQUENCE` | `reconstruction` | `observation` | `forest.reconstruction.trace_sequence` | Последовательность событий | `BOUND_CONCEPT_COPY_TBD` |

### 14.1. Лесной элементаль

`character.forest_elemental` фиксирует **тип presentation-state**, но финальное собственное имя сущности пока не утверждено.

Поэтому:

```text
KR_FOREST_ELEMENTAL_CHARACTER
= BOUND identity slot

display copy/name
= TBD
```

---


### 14.2. Дополнение v0.03 — source observation cards

`WORLD_FOREST_KNOWLEDGE_REGISTRY_v0.05` фиксирует 12 дополнительных presentation definitions.

Они нужны не для превращения каждого `world_fact` в collectible-карточку, а для двух конкретных систем:

```text
raw observation
→ entity-history Лиса
```

и:

```text
несколько observation-card
→ event reconstruction / trace sequence
```

Итого в registry:

```text
31 Knowledge Presentation definitions
```

Точные literary copy новых titles остаются `COPY_TBD`, semantic identity уже `BOUND_CONCEPT`.

---

## 14.3. Knowledge Revelation Action Registry

Значимые изменения Knowledge Presentation не происходят автоматически после достижения authored conditions.

Они используют stable semantic action-family:

| Action ID | Technical action | Typical player-facing copy | Typical tier |
|---|---|---|---|
| `KACT_FOREST_LINK_OBSERVATIONS` | `LINK_OBSERVATIONS` | Связать | `connection` |
| `KACT_FOREST_MAKE_INFERENCE` | `MAKE_INFERENCE` | Сделать вывод | `connection` |
| `KACT_FOREST_REVISE` | `REVISE_INTERPRETATION` | Пересмотреть | `reconstruction` |
| `KACT_FOREST_RECONSTRUCT_EVENT` | `RECONSTRUCT_EVENT` | Восстановить событие | `reconstruction` |
| `KACT_FOREST_SEE_PATTERN` | `SEE_PATTERN` | Увидеть закономерность | `connection / world` |
| `KACT_FOREST_RECOGNIZE_ENTITY` | `RECOGNIZE_ENTITY` | Узнать | `identity` |
| `KACT_FOREST_CONTINUE_TOGETHER` | `CONTINUE_TOGETHER` | Продолжить путь вместе | `relationship` |
| `KACT_FOREST_INTEGRATE_SYSTEM` | `INTEGRATE_SYSTEM` | contextual | `world` |

Copy не является ID.

Конкретная карточка может использовать более естественный глагол, если semantic action остаётся тем же.

Главный contract:

```text
AUTHORED CONDITIONS MET
↓
REVELATION_READY
↓
PLAYER ACTION
↓
PRESENTATION TRANSITION
```


## 15. Observation → Character → Companion

Для Кота, Совы и Лиса registry не создаёт новую unrelated историю при смене UI-группы.

Лис:

```text
fox.trace.unknown
↓
fox.trace.small_creature
↓
fox.trace.fox_like
↓
fox.trace.young_fox
↓
character.fox
↓
companion.fox
```

Runtime engine использует root-history + links, определённые в `STATE_SCHEMA`.

---

## 16. Reconstruction Registry

| Reconstruction ID | Kind | Scope | Смысл | Status |
|---|---|---|---|---|
| `REC_FOREST_EVENT_CREATURE_PASSAGE_01` | `event` | 63–69 | несколько следов → наиболее поддержанная история прохождения существа | `BOUND_CONCEPT` |
| `REC_FOREST_EVENT_TRACE_SEQUENCE_01` | `event` | 66–69 | порядок 2–4 событий по возрасту и наложению следов | `BOUND_CONCEPT` |
| `REC_FOREST_NETWORK_NEIGHBORHOOD_01` | `network` | 71–80 | направленная сеть отношений участка; production peak level 80 | `BOUND_CONCEPT` |
| `REC_FOREST_CYCLE_LOOP_01` | `cycle` | 84–88 | замкнутая причинная петля / несколько пересекающихся циклов | `BOUND_CONCEPT` |
| `REC_FOREST_WORLD_SYNTHESIS_01` | `world_synthesis` | 99 | системная модель Леса через части + отношения + время + контекст | `BOUND_CONCEPT` |

Presentation bindings:

```text
REC_FOREST_EVENT_CREATURE_PASSAGE_01
→ KR_FOREST_RECONSTRUCTION_PASSAGE

REC_FOREST_EVENT_TRACE_SEQUENCE_01
→ KR_FOREST_RECONSTRUCTION_TRACE_SEQUENCE

REC_FOREST_NETWORK_NEIGHBORHOOD_01
→ KR_FOREST_NETWORK_MODEL

REC_FOREST_CYCLE_LOOP_01
→ KR_FOREST_CYCLE_MODEL

REC_FOREST_WORLD_SYNTHESIS_01
→ KR_FOREST_WORLD_SYNTHESIS
```

### 16.1. Registry не делает reconstruction объективным прошлым

`REC_*` — authored type/model.

Конкретная player reconstruction:

- имеет own runtime instance;
- имеет evidence provenance;
- может быть revised;
- может остаться unconfirmed.

---

## 17. Revisit Definition Registry

| Revisit ID | Area | Unlock | Kind | Смысл |
|---|---|---|---|---|
| `REV_FOREST_CLEARING_01` | `AREA_FOREST_CLEARING` | after chapter 1 | `progressive` | старые следы, рисунок цветов, ветви/корни, Fox evidence |
| `REV_FOREST_TREES_01` | `AREA_FOREST_TREES` | after chapter 2 | `progressive` | возраст повреждений, причинность, позднее скрытые сети и циклы |
| `REV_FOREST_PLANTS_01` | `AREA_FOREST_PLANTS` | after chapter 3 | `progressive` | похожее ≠ то же; следы маршрутов; новые функциональные связи |
| `REV_FOREST_ANIMALS_01` | `AREA_FOREST_ANIMALS` | after chapter 4 | `progressive` | потребность → действие → маршрут; след после ухода |
| `REV_FOREST_BIRDS_01` | `AREA_FOREST_BIRDS` | after chapter 5 | `progressive` | один объект в нескольких системах; absence of habitual route |
| `REV_FOREST_FUNGI_01` | `AREA_FOREST_FUNGI` | after chapter 6 | `progressive` | скрытая сеть, indirect evidence, propagated effects |
| `REV_FOREST_TRACKS_01` | `AREA_FOREST_TRACKS` | after chapter 7 | `progressive` | reconstruction и temporal evidence |
| `REV_FOREST_NEIGHBORHOOD_01` | `AREA_FOREST_NEIGHBORHOOD` | after chapter 8 | `progressive` | направленность связи и dynamic balance |
| `REV_FOREST_CYCLE_01` | `AREA_FOREST_CYCLE` | after chapter 9 | `progressive` | альтернативные пути цикла и пересечение петель |
| `REV_FOREST_CLEARING_L98` | `AREA_FOREST_CLEARING` | level 98 | `authored_required` | содержательное возвращение на Поляну перед Синтезом |
| `REV_FOREST_POSTWORLD_01` | `forest/*` | after level 100 | `post_world` | новые layers из будущих миров без изменения первого прохождения |

### 17.1. Progressive revisit

`progressive` означает:

один и тот же `RevisitDefinition` может открывать новые authored rules после новых milestones.

Это предпочтительнее, чем создавать:

```text
REV_CLEARING_AFTER_20
REV_CLEARING_AFTER_30
REV_CLEARING_AFTER_40
...
```

только ради каждого нового слоя понимания.

---

## 18. Synthesis Registry

| Synthesis ID | Kind | Level | Route | Status |
|---|---|---:|---|---|
| `SYN_FOREST_REL_CAT_01` | relationship | 90 | Cat route | `BOUND_ID_TBD_AUTHORED` |
| `SYN_FOREST_REL_OWL_01` | relationship | 90 | Owl route | `BOUND_ID_TBD_AUTHORED` |
| `SYN_FOREST_REL_FOX_01` | relationship | 90 | Fox route | `BOUND_ID_TBD_AUTHORED` |
| `SYN_FOREST_WORLD_01` | world | 99 | Forest Synthesis; five phases → `MODEL_SOLVED` → player `INTEGRATE_SYSTEM` | `BOUND` |

---

## 19. Forest Synthesis Phase Registry

| Phase ID | Parent | Order | Функция |
|---|---|---:|---|
| `SYN_FOREST_WORLD_01_DISTINGUISH` | `SYN_FOREST_WORLD_01` | 1 | различить ближайшие реальные связи |
| `SYN_FOREST_WORLD_01_MULTI_RELATION` | `SYN_FOREST_WORLD_01` | 2 | удержать один объект в нескольких системах |
| `SYN_FOREST_WORLD_01_DIRECTION` | `SYN_FOREST_WORLD_01` | 3 | различить направление и mediated influence |
| `SYN_FOREST_WORLD_01_TIME` | `SYN_FOREST_WORLD_01` | 4 | добавить время, последствия и циклы |
| `SYN_FOREST_WORLD_01_WHOLE` | `SYN_FOREST_WORLD_01` | 5 | увидеть целое через структуру отношений |

Post-phase authored culmination:

```text
SCN_FOREST_L099_SYNTHESIS_REVELATION
INTEGRATE_SYSTEM
player-facing: «Увидеть целое»
```

Это не шестая puzzle-phase. Это mandatory `PLAYER_INITIATED_REVELATION`, который переводит `MODEL_SOLVED` в `forest_synthesis_complete`.


Эти phases — состояние **конкретной попытки уровня 99**.

Они не становятся permanent player personality stats.

---

## 20. Thread Registry

| Thread ID | Type | Availability | Entry | World-1 role |
|---|---|---|---|---|
| `THREAD_FOREST_CAT` | `mascot` | `active` | level 1 direct acquaintance | может стать first companion |
| `THREAD_FOREST_OWL` | `mascot` | `active` | level 1 direct acquaintance | может стать first companion |
| `THREAD_FOREST_FOX` | `mascot` | `conditional` | trace / inference / direct encounter | может не открыться в Forest; может стать first companion |
| `THREAD_FOREST_ELEMENTAL` | `elemental` | `distributed` | trace → influence → pattern → response → manifestation | Encounter 11 level 100 |
| `THREAD_FUTURE_GUARDIAN` | `future` | `dormant` | deferred facts / later revisit | identity не фиксируется в Forest |

---

## 21. Explicit Thread Link Registry

| Thread ID | Authored refs | Relation | Guard |
|---|---|---|---|
| `THREAD_FOREST_FOX` | `WF_F04, WF_F07, WF_F10, WF_F13, WF_F14, WF_F15, WF_F66` | `evidence_candidate` | эти facts могут поддерживать Fox inference; ни один сам по себе не обязан раскрывать identity |
| `THREAD_FOREST_ELEMENTAL` | `WF_F02, WF_F06, WF_F28–WF_F34, WF_F64, WF_F65, WE_FOREST_RESPONSE_01, WE_FOREST_ELEMENTAL_PARTIAL_MANIFESTATION_01` | `supports_pattern` | не означает, что все визуально похожие facts имеют одну буквальную причину |
| `THREAD_FUTURE_GUARDIAN` | `WF_FUTURE_GUARDIAN_01–04` | `dormant_placeholder` | placeholder family из blueprint/state map; точные канонические facts ещё не утверждены |

### 21.1. Кот и Сова не «владеют» world facts

Старая отметина не становится автоматически:

```text
cat_fact
```

а точный признак:

```text
owl_fact
```

Их нити развиваются через **способ работы игрока с фактом**, encounter и relationship history.

Это защищает систему от hidden classes:

```text
memory → Cat
observation → Owl
path → Fox
```

---

## 22. Dormant Guardian placeholders

Текущие source-документы используют рабочую family:

```text
WF_FUTURE_GUARDIAN_01
WF_FUTURE_GUARDIAN_02
WF_FUTURE_GUARDIAN_03
WF_FUTURE_GUARDIAN_04
```

Registry **не повышает их до `WF_F71+`**.

Причина:

- `01–02` не имеют однозначно зафиксированного содержимого;
- `03–04` существуют как production-примеры;
- отдельный Character Dossier Медведя-стража ещё не утверждён;
- длинная нить не должна быть преждевременно привязана к identity.

Их статус:

```text
RESERVED_PLACEHOLDER_FAMILY
```

До отдельного design pass.

---

## 23. Level 60 Response binding

Связка:

```text
SCN_FOREST_L060_RESPONSE
→ WE_FOREST_RESPONSE_01
```

не означает автоматически:

```text
→ KR_FOREST_RESPONSE_COORDINATED
```

Knowledge presentation создаётся только при честном perception/interpretation path.

---

## 24. Level 90 binding

Core:

```text
SCN_FOREST_L090_RELATIONSHIP_SYNTHESIS
```

Routing selects exactly one:

```text
ENC_FOREST_10_CAT
ENC_FOREST_10_OWL
ENC_FOREST_10_FOX
```

и соответствующий synthesis:

```text
SYN_FOREST_REL_CAT_01
SYN_FOREST_REL_OWL_01
SYN_FOREST_REL_FOX_01
```

Atomic result:

```text
Relationship Synthesis
+
first companion
```

Другие mature threads сохраняются.

---

## 25. Level 98 binding

```text
SCN_FOREST_L098_CLEARING_REVISIT
→ REV_FOREST_CLEARING_L98
```

Level 98 не создаёт alternate first visit.

Он читает:

```text
first_visit state
+
current Forest state
+
current knowledge
+
first companion
```

и производит персональный retrospective layer.

---

## 26. Level 99 binding

```text
SCN_FOREST_L099_WORLD_SYNTHESIS
→ SYN_FOREST_WORLD_01
→ five phases
→ MODEL_SOLVED
→ SCN_FOREST_L099_SYNTHESIS_REVELATION
→ INTEGRATE_SYSTEM / «Увидеть целое»
```

Required core:

```text
main progression 1–98
+
first companion
+
mandatory companion reveal complete
```

Не required:

```text
all optional observations
all revisits
all ★★★
Fox known
high Cognition score
```

Only after player revelation:

```text
forest_synthesis_complete = true
level 100 unlocked
```

---

## 27. Level 100 binding

```text
forest_synthesis_complete
↓
SCN_FOREST_L100_ELEMENTAL_MANIFESTATION
↓
WE_FOREST_ELEMENTAL_FULL_MANIFESTATION_01
↓
ENC_FOREST_11_ELEMENTAL
↓
RECOGNIZE_ENTITY ready
↓
player «Узнать»
```

После mandatory Elemental reveal:

```text
forest_world_complete = true
forest_elemental_encountered = true
```

Дополнительно:

```text
WF_F70 exposed
```

может стать новым bridge.

`KR_FOREST_CONSTELLATION_INCOMPLETE` создаётся только если игрок реально выделил observation; world completion этого не требует.

---

## 28. Какие старые observations можно связать с элементалем

На данный момент registry разрешает final authored linking только для families, уже содержательно подготовленных как element-thread:

```text
KR_FOREST_PATTERN_REPEATING
KR_FOREST_RESPONSE_COORDINATED
KR_FOREST_MANIFESTATION_PARTIAL
```

и конкретных source facts/events, указанных в `THREAD_FOREST_ELEMENTAL`.

Нельзя:

```text
SELECT all unresolved observations
WHERE world = forest
→ attach to elemental
```

---

## 29. Content dependency graph

Упрощённо:

```text
AREA
↓
CORE SCENE
↓
WORLD FACT / WORLD EVENT
↓
EXPOSURE
↓
KNOWLEDGE PRESENTATION
↓
RECONSTRUCTION / THREAD
↓
ENCOUNTER VARIANT
↓
RELATIONSHIP / SYNTHESIS
↓
REVISIT
```

Одна сущность может иметь несколько связей.

Например:

```text
WF_F04
→ Fox evidence
→ observation presentation
→ late revisit
→ encounter routing

но

WF_F04
≠ Fox identity itself
```

---

## 30. Machine-readable export contract

Registry должен быть экспортируем в machine-readable content data без переименования authored ID.

Рекомендуемая future decomposition:

```text
forest.areas.json
forest.scenes.json
forest.choices.json
forest.encounters.json
forest.world_facts.json
forest.world_events.json
forest.knowledge.json
forest.reconstructions.json
forest.revisits.json
forest.synthesis.json
forest.threads.json
```

`CONTENT_REGISTRY` остаётся human-readable master index.

---


### 30.1. Текущий machine-readable package

Первый нормализованный export зафиксирован как:

```text
WORLD_FOREST_MACHINE_PACKAGE_v0.03
```

Human-readable registry остаётся источником authored-смысла, а package является проверяемым машинным представлением этого канона.

Правило:

```text
изменение authored-смысла
→ сначала design registry
→ затем новый package build

не наоборот
```

Package не имеет права самостоятельно заполнять `TBD_*`.

---

## 31. Что уже закрывает v0.01

Теперь стабильную authored identity имеют:

```text
10 area
100 core scenes
10 special scenes
17 authored choice families
67 choice options
11 encounter families
37 encounter variant slots
70 world facts
4 world events
19 knowledge presentation definitions
5 reconstruction definitions
11 revisit definitions
4 synthesis definitions
5 Forest Synthesis phases
5 narrative thread families
```

Это существенно сокращает расстояние между design-doc и data layer.

---

## 32. Что registry намеренно НЕ считает готовым

Следующие вещи остаются открыты, потому что source-документы их ещё не фиксируют достаточно точно:

1. финальный диалоговый script / Voice Card copy каждого Encounter Variant;
2. exact layout/puzzle и локальные scene-ID Encounter Variant;
3. numeric tuning routing/fallback (смысловые policies уже зафиксированы в `WORLD_FOREST_ENCOUNTER_REGISTRY_v0.04`);
4. полный список choices всех уровней, если при production будут добавлены новые осмысленные действия;
5. числовые weights routing-choice уровней `20 / 30 / 40 / 50 / 60 / 70 / 80`;
6. точные scene/location IDs внутри уровня, если один level потребует несколько физических sub-location;
7. финальный display-name Лесного элементаля;
8. его голос, арт и encounter-format;
9. финальные тексты Knowledge Presentation;
10. exact observation thresholds;
11. точные source-observation bundle каждого reconstruction;
12. точный authored layout/puzzle уровня 99;
13. точный набор post-world revisit rules;
14. каноническое содержимое Guardian placeholders.

Это не ошибка registry.

Это корректный список того, что ещё нужно **создать**, а не «додумать технически».

---

## 33. Статус content-pass после v0.08

Фундаментальные authored-слои первого Мира Леса имеют отдельные актуальные registries:

```text
ENCOUNTER
→ WORLD_FOREST_ENCOUNTER_REGISTRY_v0.04

KNOWLEDGE
→ WORLD_FOREST_KNOWLEDGE_REGISTRY_v0.05

REVISIT
→ WORLD_FOREST_REVISIT_REGISTRY_v0.03

SYNTHESIS
→ WORLD_FOREST_SYNTHESIS_REGISTRY_v0.03
```

Machine-readable representation зафиксировано отдельной спецификацией и package build.

---

## 34. Следующий этап

Новый фундаментальный Forest registry сейчас не требуется.

Следующий этап:

```text
IMPLEMENTATION ARCHITECTURE AUDIT
↓
MIGRATION PLAN
↓
CONTENT LOADER / EVENT STORE / PROJECTIONS
↓
поэтапное внедрение без потери текущего прогресса игроков
```

Оставшиеся `TBD_*` продолжают жить как explicit authored backlog и не заполняются exporter-ом или implementation-слоем самостоятельно.
