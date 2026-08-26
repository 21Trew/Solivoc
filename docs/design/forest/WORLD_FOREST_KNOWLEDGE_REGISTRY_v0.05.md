# WORLD FOREST KNOWLEDGE REGISTRY — Мир Леса

> **Статус:** рабочий production knowledge registry  
> **Версия:** 0.05  
> **World ID:** `forest`  
> **Охват:** knowledge-authoring уровней `1–100`, first-pass, meaningful revisit и post-world continuation  
> **Основание:** `WORLD_FOREST_CONTENT_REGISTRY_v0.08`, `WORLD_FOREST_ENCOUNTER_REGISTRY_v0.04`, `WORLD_FOREST_STATE_SCHEMA_v0.05`, `WORLD_FOREST_STATE_MAP_v0.03`, `WORLD_FOREST_LEVEL_BLUEPRINT_v0.13`, `WORLD_FOREST_DOSSIER_v0.18`, `WORLD_FOREST_SYNTHESIS_REGISTRY_v0.03`  
> **Назначение:** зафиксировать authored-правила превращения объективных фактов и событий Мира Леса в наблюдения, интерпретации, реконструкции, персонажные истории и системные модели конкретной души.

---

## 1. Граница документа

Этот registry отвечает:

> **Что конкретная душа имеет право знать, на каком основании и как это знание изменяется?**

Он располагается между:

```text
WORLD FACT / WORLD EVENT
что объективно существует или произошло

↓

KNOWLEDGE AUTHORING
что может быть замечено,
как может быть интерпретировано,
с чем может быть связано,
что может быть реконструировано

↓

KNOWLEDGE RECORD
что реально знает конкретный игрок

↓

UI
как это знание показывается сейчас
```

Документ НЕ фиксирует:

- финальный UI layout экрана коллекции;
- окончательную типографику карточек;
- полные литературные тексты всех карточек;
- числовые thresholds inference engine;
- SQL / API;
- финальное собственное имя Лесного элементаля;
- точное содержимое dormant Guardian facts `01–02`.

---

## 2. Верхний инвариант

Запрещён переход:

```text
backend знает истину
→
игрок получает истину
```

Правильный путь:

```text
WORLD FACT / EVENT
↓
EXPOSURE
↓
NOTICE
↓
OBSERVATION
↓
INTERPRETATION
↓
CONNECTION
↓
RECONSTRUCTION / ENTITY INFERENCE / SYSTEM MODEL
↓
CONFIRMATION или REVISION
```

Отдельные ступени могут быть пропущены только там, где существует **прямое authored revelation**.

Например:

```text
прямая встреча с Лисом
→ character.fox
```

допустима без предыдущей карточки следа.

Но:

```text
backend subject_ref = fox
→ «вероятно, лисёнок»
```

без player-accessible evidence запрещено.

---

## 3. Три разных вопроса знания

Каждый authored knowledge transition обязан различать три вопроса.

### A. Что произошло / существует?

```text
WORLD FACT
```

### B. Что душа действительно выделила?

```text
OBSERVATION
```

### C. Что это может означать?

```text
INTERPRETATION / RECONSTRUCTION
```

Пример:

```text
WF_F69
сломанная ветвь
```

не означает:

```text
«здесь прошёл крупный зверь»
```

Сначала возможно:

```text
OBSERVATION:
«Сломанная ветвь»
```

и только затем, вместе с другими evidence:

```text
RECONSTRUCTION:
«Здесь недавно прошло крупное существо»
```

---

## 4. Observation-card не равна каждому noticed fact

Если каждый замеченный факт автоматически создаёт карточку, раздел `Наблюдения` превращается в склад.

Поэтому для world fact используется authored **presentation policy**.

```text
SILENT
noticed хранится,
отдельной карточки нет

CARD_IF_SELECTED
карточка появляется,
если игрок явно исследовал деталь

CARD_IF_CONNECTED
карточка появляется,
когда деталь стала частью осмысленной связи

CARD_IF_INTERPRETED
нужно не только заметить,
но и сформулировать содержательную interpretation

ROOT_HISTORY_CANDIDATE
наблюдение может стать началом истории сущности

SYSTEM_INPUT
обычно остаётся evidence,
но может входить в reconstruction/system model
```

Один fact может иметь несколько ролей.

---

## 5. Карточка существует ради истории знания

Критерий отдельной observation-card:

> **Будет ли игроку содержательно интересно позже увидеть, что именно он заметил тогда и как смысл этой детали изменился?**

Если нет, достаточно внутреннего `noticed`.

Поэтому:

```text
noticed = true
```

не требует:

```text
knowledge_record created
```

---

## 6. UI-группы первого мира

В v0.01 фиксируются три player-facing группы:

```text
НАБЛЮДЕНИЯ
ПЕРСОНАЖИ
СПУТНИКИ
```

### `observation`

Содержит:

- отдельные значимые наблюдения;
- patterns;
- phenomena;
- reconstruction;
- network/cycle/world system models;
- cross-world observations.

### `character`

Содержит существ, identity которых уже подтверждена для игрока.

### `companion`

Содержит обретённых постоянных маскотов.

### Важный закон

```text
Character → Companion
```

не создаёт дубликат.

Один runtime `KnowledgeRecord` меняет `presentation_group`.

---

## 7. Обретённый спутник не исчезает из истории персонажей

На data-layer:

```text
presentation_group = companion
```

На будущем UX уровне можно дать фильтр:

```text
Все персонажи
```

который включает спутников.

Но в primary grouping одна запись не одновременно лежит в двух независимых каталогах.

---

## 8. Confidence относится к утверждению карточки

Semantic confidence:

```text
SUSPECTED
LIKELY
INFERRED
CONFIRMED
```

всегда относится к **текущей proposition**, а не ко всему скрытому subject.

Пример:

```text
«Несколько частей Леса
изменились почти одновременно»
```

может быть:

```text
CONFIRMED
```

если игрок действительно наблюдал это.

Но interpretation:

```text
«это сделал Лесной элементаль»
```

может вообще отсутствовать.

Следовательно:

> **подтверждённое наблюдение не подтверждает автоматически его причину.**

---

## 9. Независимость evidence

Повтор одного и того же признака не должен бесконечно усиливать inference.

Authored support делится минимум на:

```text
CORRELATED_ECHO
повтор того же типа evidence

INDEPENDENT_SUPPORT
другой признак,
который поддерживает ту же model

CONTRADICTING_SUPPORT
реальный признак,
который ослабляет model

DIRECT_CONFIRMATION
прямая встреча / явление /
authored validation proposition
```

Ключевой закон:

> **Два независимых признака сильнее пяти повторов одного и того же признака.**

---

## 10. Общая confidence-policy

### `SUSPECTED`

Есть основание поставить вопрос.

Обычно:

```text
1 meaningful observation
или
слабая связь 2 correlated evidence
```

### `LIKELY`

Есть согласованный bundle минимум из:

```text
2 независимых evidence
```

или эквивалентный authored support.

### `INFERRED`

Игрок:

- имеет достаточный evidence-bundle;
- имеет нужный контекст;
- реально совершил inference / подтвердил model действием.

Это не автоматический «score достиг X».

### `CONFIRMED`

Есть direct authored confirmation текущей proposition.

Для identity:

```text
direct encounter
```

Для события:

```text
позднее найдено прямое подтверждение
```

Для system model:

`CONFIRMED` используется осторожно и не означает окончательного всезнания.

---

## 10.1. `PLAYER_INITIATED_REVELATION` — знание не обновляется за спиной игрока

Все значимые transitions этого registry используют общий flow:

```text
source evidence / encounter / world event
↓
transition becomes ELIGIBLE
↓
REVELATION_READY
↓
игрок сам совершает смысловое действие
↓
KnowledgeRecord меняется
```

### Readiness — ещё не новый state карточки

Например:

```text
2 независимых Fox evidence
↓
FOX_LIKE transition ready
```

не означает автоматическое:

```text
fox.trace.small_creature
→ fox.trace.fox_like
```

Игрок получает возможность:

```text
[Сделать вывод]
```

и именно это действие завершает transition.

### Authored actions первого мира

```text
Связать
LINK_OBSERVATIONS

Сделать вывод
MAKE_INFERENCE

Пересмотреть
REVISE_INTERPRETATION

Восстановить событие
RECONSTRUCT_EVENT

Увидеть закономерность
SEE_PATTERN

Узнать
RECOGNIZE_ENTITY

Продолжить путь вместе
CONTINUE_TOGETHER

Собрать целое / иной contextual copy
INTEGRATE_SYSTEM
```

Технические action types стабильны.

Русский copy может быть более естественным для конкретной сцены.

### Direct confirmation

Если игрок встречает Лиса напрямую, encounter может установить:

```text
identity_known = true
```

для narrative state.

Но карточка не обязана мгновенно morph-нуться во время фонового save.

После сцены:

```text
RECOGNIZE_ENTITY ready
→ [Узнать]
→ observation/root history превращается в character.fox
```

### Reconstruction

Достаточный evidence-bundle создаёт:

```text
RECONSTRUCT_EVENT ready
```

а не готовую reconstruction-card.

Игрок сам нажимает:

```text
[Восстановить событие]
```

после чего исходные observations визуально и семантически связываются.

### Revision

Противоречащий evidence создаёт:

```text
REVISE_INTERPRETATION ready
```

Старая reconstruction остаётся current до момента пересмотра.

Если дальнейший обязательный контент требует revision, игра foreground-ит этот момент в соответствующем checkpoint.

### Pattern

Cross-context evidence создаёт:

```text
SEE_PATTERN ready
```

Игрок сам превращает разрозненные мотивы в осознанную закономерность.

### Companion

Encounter 10 создаёт relationship-basis и добровольное решение маскота.

Карточка становится `companion` после действия:

```text
[Продолжить путь вместе]
```

Это mandatory reveal уровня 90, потому что уровни 91–98 уже строятся вокруг реального совместного пути.

### UX intensity

```text
refinement
→ короткое изменение

connection
→ связь между карточками

reconstruction
→ сборка новой модели

identity
→ уникальный reveal персонажа

relationship
→ сильное преобразование Character → Companion

world
→ редкий кульминационный reveal
```

Exact motion/audio timing фиксируется позднее в UX-документе.


# PART I. CHARACTER HISTORIES

## 11. Кот

### Presentation definitions

```text
KR_FOREST_CAT_CHARACTER
KR_FOREST_CAT_COMPANION
```

### Creation

На уровне 1:

```text
Encounter 1
→ identity known
→ acquainted
→ create KnowledgeRecord
→ presentation = character.cat
→ group = character
→ confidence = CONFIRMED
```

### Companion transition

Если Encounter 10 выбран для Кота:

```text
same runtime KnowledgeRecord
character.cat
↓
companion.cat
```

### Не создаём

У Кота нет искусственной pre-character observation-card.

Новая душа знакомится с ним напрямую.

---

## 12. Сова

Полностью симметричная identity-архитектура:

```text
KR_FOREST_OWL_CHARACTER
→
KR_FOREST_OWL_COMPANION
```

Identity подтверждается Encounter 1.

Если первой спутницей становится Сова, меняется presentation того же record.

---

# PART II. FOX KNOWLEDGE CHAIN

## 13. Лис — два слоя до встречи

До identity confirmation разделяются:

```text
A. RAW OBSERVATIONS
конкретные следы мира

B. FOX ENTITY-HISTORY
гипотеза:
несколько следов могут относиться
к одному неизвестному существу
```

Это позволяет не превращать каждый рыжеватый волос в скрытую надпись:

```text
«ЛИС +1»
```

---

## 14. Raw Fox-compatible observations

Следующие presentation definitions добавляются в `CONTENT_REGISTRY_v0.03`.

| Definition | Source fact | Рабочий title | Policy |
|---|---|---|---|
| `KR_FOREST_OBS_PARTIAL_TRACK` | `WF_F04` | Неполный след | `CARD_IF_SELECTED` |
| `KR_FOREST_OBS_BENT_GRASS` | `WF_F05` | Примятая трава | `CARD_IF_SELECTED` |
| `KR_FOREST_OBS_BARK_MARK` | `WF_F07` | Свежая отметина на коре | `CARD_IF_SELECTED` |
| `KR_FOREST_OBS_FUR_SNAG` | `WF_F10` | Рыжеватая шерсть | `CARD_IF_SELECTED` |
| `KR_FOREST_OBS_FULL_SMALL_TRACK` | `WF_F66` | Чёткий маленький след | `CARD_IF_SELECTED` |

### Важно

Эти записи не имеют:

```text
subject_visibility = fox
```

для UI.

Backend может иметь semantic relation `fox_evidence_candidate`, но player-facing identity не раскрывается.

---

## 15. Какие Fox facts обычно остаются silent evidence

```text
WF_F13 narrow_gap_route_01
WF_F14 fox_scale_context_01
WF_F15 repeated_small_route_01
```

по умолчанию используются как:

```text
SYSTEM_INPUT / ENTITY_INFERENCE_INPUT
```

и не обязаны создавать отдельные карточки.

Причина:

- `WF_F13` чаще является контекстом маршрута;
- `WF_F14` — relation/scale context;
- `WF_F15` — уже connection нескольких evidence, а не ещё один физический предмет.

При особом revisit они МОГУТ породить observation-record, но exact presentation остаётся `TBD_AUTHORED`.

---

## 16. Когда появляется Fox entity-history

`KR_FOREST_FOX_TRACE_UNKNOWN` становится доступным для создания не при первом случайном следе. Значимый record появляется после соответствующего player action.

Минимальный authored смысл:

```text
душа имеет основание считать,
что 2+ observations
могут относиться
к одному неизвестному существу
```

Возможные основания:

```text
одинаковое направление
совместимый масштаб
повтор маршрута
несколько независимых признаков
прямое fleeting touch
```

### Creation guard

Нужны:

```text
1 direct touch
или
2+ compatible observations
```

и содержательное действие/interpretation игрока.

---

## 17. Fox presentation ladder

```text
KR_FOREST_FOX_TRACE_UNKNOWN
fox.trace.unknown

↓

KR_FOREST_FOX_TRACE_SMALL_CREATURE
fox.trace.small_creature

↓

KR_FOREST_FOX_TRACE_FOX_LIKE
fox.trace.fox_like

↓

KR_FOREST_FOX_TRACE_YOUNG_FOX
fox.trace.young_fox

↓

KR_FOREST_FOX_CHARACTER
character.fox

↓

KR_FOREST_FOX_COMPANION
companion.fox
```

Это **presentation states одного entity-history record**, а не шесть коллекционных объектов.

---

## 18. `TRACE_UNKNOWN → SMALL_CREATURE`

Достаточно evidence, поддерживающего:

```text
источник следов
=
небольшое живое существо
```

Например:

```text
WF_F04
+
WF_F05

или

WF_F07
+
WF_F66
```

Конкретный bundle зависит от того, что реально было exposed/noticed.

Нельзя использовать не замеченный факт.

---

## 19. `SMALL_CREATURE → FOX_LIKE`

Нужны минимум:

```text
2 независимых fox-compatible evidence
```

из разных semantic families.

Рабочие families:

```text
TRACK_SHAPE
WF_F04 / WF_F66

BODY_SCALE
WF_F14

FUR
WF_F10

ROUTE
WF_F13 / WF_F15

LOW_MARK
WF_F07
```

### Не считается независимостью

```text
WF_F04
+
WF_F66
```

если оба используются только как два изображения одного и того же признака формы следа.

Это скорее:

```text
CORRELATED_ECHO
```

---

## 20. `FOX_LIKE → YOUNG_FOX`

Нужно отдельно поддержать:

```text
fox-like identity
+
small body scale
```

То есть `WF_F14` или другое authored scale evidence должно реально присутствовать.

Запрещено:

```text
маленький след
→ автоматически «лисёнок»
```

если форма/identity ещё не поддержана.

---

## 21. Direct Fox encounter

Encounter:

```text
ENC_FOREST_03_FOX
или
ENC_FOREST_04_FOX_FIRST
```

даёт direct confirmation для narrative state и делает доступным:

```text
RECOGNIZE_ENTITY
```

### Если entity-history уже есть

```text
same record
presentation_group:
observation → character

display:
current fox.trace.*
→ character.fox
```

Все raw observations остаются linked evidence.

### Если entity-history не было

Создаётся:

```text
KR_FOREST_FOX_CHARACTER
```

на direct encounter.

Ранее реально exposed/recorded facts могут быть **переосмыслены**, но игра не создаёт задним числом observations, которых игрок не замечал.

---

## 22. Reasonable wrong Fox inference

Если игрок сделал разумную, но неверную interpretation:

```text
evidence сохраняется
interpretation получает revision
```

Нельзя:

- удалить старое наблюдение;
- скрыть ошибку из истории;
- наказать relationship;
- насмешливо представить игрока невнимательным.

Поздняя встреча должна подтверждать правильные части evidence и уточнять неверную связь.

---

# PART III. RECONSTRUCTIBLE OBSERVATIONS

## 23. Почему chapter 7 требует отдельных observation-card

Канон главы:

> **Несколько observation-card могут образовать карточку реконструкции события.**

Следовательно хотя бы часть source evidence обязана существовать как самостоятельные player-visible records.

Добавляются:

| Definition | Source fact | Рабочий title | Policy |
|---|---|---|---|
| `KR_FOREST_OBS_FRESH_TRACKS` | `WF_F35` | Свежие следы | `CARD_IF_SELECTED` |
| `KR_FOREST_OBS_TRACE_AGE` | `WF_F36` | Следы разной давности | `CARD_IF_INTERPRETED` |
| `KR_FOREST_OBS_BROKEN_BRANCH` | `WF_F38` / при нужном scene также `WF_F69` | Сломанная ветвь | `CARD_IF_SELECTED` |
| `KR_FOREST_OBS_MISSING_TRACE` | `WF_F39` | Оборвавшаяся цепочка следов | `CARD_IF_INTERPRETED` |
| `KR_FOREST_OBS_TRACE_OVERLAP` | `WF_F40` | Перекрывающиеся следы | `CARD_IF_INTERPRETED` |
| `KR_FOREST_OBS_CONTRADICTION` | `WF_F41` | След, который не сходится | `CARD_IF_CONNECTED` |

---

## 24. Missing trace guard

`KR_FOREST_OBS_MISSING_TRACE` нельзя создать только потому, что:

```text
следов нет
```

Сначала должно существовать обоснованное ожидание.

Минимальный guard:

```text
known / inferred route
или
repeated prior pattern
или
expected continuation
```

и затем:

```text
ожидаемый trace отсутствует
```

Канонический закон:

> **Отсутствие становится следом только относительно обоснованного ожидания.**

---

## 25. Один physical fact может поддерживать разные interpretations

Пример:

```text
KR_FOREST_OBS_BROKEN_BRANCH
```

не содержит в title:

```text
«ветвь, сломанная медведем»
```

или:

```text
«ветвь, сломанная бегущим зверем»
```

Карточка хранит observation.

Причина живёт в interpretation / reconstruction.

---

# PART IV. EVENT RECONSTRUCTIONS

## 26. `REC_FOREST_EVENT_CREATURE_PASSAGE_01`

### Presentation

```text
KR_FOREST_RECONSTRUCTION_PASSAGE
```

Working meaning:

> **Здесь недавно прошло крупное существо.**

Финальный copy остаётся открытым.

### Eligible source observations

Основные candidates:

```text
KR_FOREST_OBS_FRESH_TRACKS
KR_FOREST_OBS_TRACE_AGE
KR_FOREST_OBS_BROKEN_BRANCH
KR_FOREST_OBS_MISSING_TRACE
KR_FOREST_OBS_TRACE_OVERLAP
KR_FOREST_OBS_CONTRADICTION
```

Дополнительно могут участвовать подходящие raw observations из chapter 4:

```text
WF_F67 bark_scrape_trace_01
WF_F68 disturbed_ground_trace_01
WF_F69 broken_branch_trace_01
```

если для конкретного игрока они были превращены в observation/evidence.

### Creation guard

Нужно минимум:

```text
3 source observations
```

из минимум:

```text
2 разных evidence families
```

Пример families:

```text
TRACK
VEGETATION_DAMAGE
GROUND_DISTURBANCE
EXPECTED_ABSENCE
TEMPORAL_OVERLAP
```

### Не требуется

```text
все возможные следы
```

### Confidence

```text
SUSPECTED
→ при ранней сборке

LIKELY
→ 3+ согласованных independent evidence

INFERRED
→ игрок выбрал/собрал наиболее поддержанную event model

CONFIRMED
→ только direct later confirmation,
если authored content её даёт
```

Реконструкция может закончить первый мир как `INFERRED`.

---

## 27. Contradicting evidence не уничтожает reconstruction

Если появляется:

```text
KR_FOREST_OBS_CONTRADICTION
```

происходит:

```text
FOREST_RECONSTRUCTION_REVISED
```

а не:

```text
DELETE old reconstruction
```

Игрок должен иметь возможность увидеть:

```text
что он думал раньше
→
что не сошлось
→
как модель изменилась
```

---

## 28. `REC_FOREST_EVENT_TRACE_SEQUENCE_01`

### Новая presentation definition

```text
KR_FOREST_RECONSTRUCTION_TRACE_SEQUENCE
```

Working title:

> **Последовательность событий**

### Purpose

Не отвечает:

> кто именно был здесь?

А:

> **что произошло раньше, а что позже?**

### Core source requirements

Минимум:

```text
2 temporal observations
```

из:

```text
KR_FOREST_OBS_TRACE_AGE
KR_FOREST_OBS_TRACE_OVERLAP
```

или другого authored evidence с temporal relation.

`WF_F42 overlapping_histories_01` может расширять sequence.

`WF_F41 contradiction_trace_01` может заставить её пересобрать.

### Creation

Предпочтительно:

```text
66–69
```

### Important separation

```text
EVENT IDENTITY
≠
EVENT ORDER
```

Игрок может хорошо понимать последовательность, не зная участников.

---

# PART V. PATTERN KNOWLEDGE

## 29. `KR_FOREST_PATTERN_REPEATING`

### Purpose

Карточка фиксирует:

> **одна форма / структура повторяется в разных частях Леса.**

Она НЕ фиксирует:

> «это след Лесного элементаля».

### Candidate sources

Authored pattern-family:

```text
WF_F02 root_branch_rhyme_01
WF_F06 root_interlock_01
pattern exposure level 28
pattern exposure level 50
WF_F65 cross_scale_pattern_01
```

Другие source facts могут подключаться позже только после отдельного authoring.

### Creation guard

Нужно:

```text
минимум 2 разных контекста
```

и player connection между ними.

Например:

```text
ветви / корни
+
жилки листьев
```

### Confidence progression

```text
SUSPECTED
2 contexts, слабая связь

LIKELY
3+ contexts в разных главах

INFERRED
игрок осознанно связывает motif
на разных масштабах

CONFIRMED
сам факт повторяющейся структуры
становится очевидным к зрелому cross-scale evidence
```

Даже `CONFIRMED` не подтверждает причину motif.

---

## 30. Pattern card survives Elemental reveal

После level 100:

```text
KR_FOREST_PATTERN_REPEATING
```

не удаляется и не обязана превращаться в character.

Она остаётся записью:

> **что именно душа заметила до встречи.**

Она получает link:

```text
supports / part_of_pattern / reinterprets
→ KR_FOREST_ELEMENTAL_CHARACTER
```

только там, где authored element-thread действительно поддерживает связь.

---

# PART VI. FOREST RESPONSE

## 31. `KR_FOREST_RESPONSE_COORDINATED`

### Objective source

```text
WE_FOREST_RESPONSE_01
```

### Event truth

World event может произойти у всех по authored world state.

Но card создаётся только если игрок:

```text
witnessed
+
noticed coordinated nature
```

### Working proposition

> **Несколько частей Леса изменились почти одновременно. Причина пока не ясна.**

### Confidence

Сам факт coordinated response может сразу быть:

```text
CONFIRMED
```

если player видел несколько синхронных effects.

Но:

```text
cause = unknown
```

### Forbidden interpretation

```text
response occurred
→ elemental confirmed
```

---

## 32. Link to Pattern

Если есть:

```text
KR_FOREST_PATTERN_REPEATING
```

можно создать:

```text
pattern supports response interpretation
```

или:

```text
response supports larger forest pattern
```

Но не:

```text
same_subject = elemental
```

до достаточного authored basis.

---

# PART VII. DORMANT GUARDIAN KNOWLEDGE

## 33. Guardian thread намеренно не получает character-card

Текущий first-world canon допускает dormant future facts.

Но до Character Dossier Медведя:

```text
нет
KR_FOREST_GUARDIAN_CHARACTER
```

и нет knowledge state:

```text
«Медведь-страж был здесь»
```

---

## 34. Guardian-compatible facts не обязаны создавать карточку

```text
WF_FUTURE_GUARDIAN_03
WF_FUTURE_GUARDIAN_04
```

могут существовать как:

```text
exposed
noticed
interpreted = unknown anomaly
```

без отдельной card.

Это намеренно.

Долгая нить должна уметь:

```text
молчать
```

---

## 35. Future revisit law for Guardian

Если спустя другой мир / Круг / новый способ Познания игрок возвращается в Лес:

```text
старый exposure
+
новый context
+
новый evidence
```

может впервые создать observation-card.

Карточка не обязана существовать на первом прохождении.

Это сохраняет принцип:

> **мир содержал след раньше, но душа получила язык для его понимания позже.**

Exact `KR_*` для Guardian создаются только после утверждения его dossier и source facts.

---

# PART VIII. PARTIAL ELEMENTAL MANIFESTATION

## 36. `KR_FOREST_MANIFESTATION_PARTIAL`

### Source

```text
WE_FOREST_ELEMENTAL_PARTIAL_MANIFESTATION_01
```

Exact level в chapter 9 остаётся TBD в source registry.

### Player-facing meaning

Не:

```text
«Лесной элементаль»
```

А:

> **несколько процессов на мгновение сложились в одну различимую природную форму / узор.**

### Creation guard

Игрок должен:

```text
witness event
+
выделить unity across multiple processes
```

Если он увидел только красивый environmental effect:

```text
exposure only
```

без card допустим.

---

## 37. Partial manifestation as entity-root candidate

Это первый elemental observation, который может быть **не просто evidence**, а возможным root-history сущности.

При level 100:

### Если partial card существует

```text
same KnowledgeRecord
presentation:
observation
→ character

KR_FOREST_MANIFESTATION_PARTIAL
→ KR_FOREST_ELEMENTAL_CHARACTER
```

### Если partial card не существует

Encounter 11 создаёт новый:

```text
KR_FOREST_ELEMENTAL_CHARACTER
```

### Pattern / Response

Остаются отдельными observations и связываются с character-history.

Это даёт оба нужных поведения:

```text
наблюдение может стать персонажем
```

и:

```text
не все observations уничтожаются при reveal
```

---

# PART IX. NEIGHBORHOOD NETWORK

## 38. `REC_FOREST_NETWORK_NEIGHBORHOOD_01`

### Presentation

```text
KR_FOREST_NETWORK_MODEL
```

### Core source facts

```text
WF_F44 shared_space_01
WF_F45 directional_relation_01
WF_F46 mediated_relation_01
WF_F47 shared_resource_pressure_01
WF_F48 indirect_path_effect_01
WF_F49 asymmetric_outcome_01
WF_F50 third_party_shift_01
WF_F51 dynamic_balance_01
```

### Creation guard

Network reconstruction требует минимум:

```text
3 entities / nodes
+
2 directional relations
```

и хотя бы одно из:

```text
mediated influence
asymmetry
third-party change
dynamic change
```

### Почему

Две сущности с одной линией — ещё не network model.

---

## 39. Network model не является friendship graph

Allowed relations:

```text
supports
pressures
uses
changes_access
shares_resource
indirectly_affects
```

UI copy не использует обязательные:

```text
+ / -
friend / enemy
```

Отношение контекстно и направленно.

---

## 40. Network revision

Level 79 специально может менять local effect relation.

Поэтому:

```text
same nodes
+
new condition
↓
FOREST_RECONSTRUCTION_REVISED
```

Старая модель остаётся в history.

Это первая крупная демонстрация:

> **устойчивая система может быть динамической.**

---

# PART X. CYCLE MODEL

## 41. `REC_FOREST_CYCLE_LOOP_01`

### Presentation

```text
KR_FOREST_CYCLE_MODEL
```

### Source facts

```text
WF_F52 process_residue_01
WF_F53 decomposition_transition_01
WF_F54 output_as_input_01
WF_F55 first_closed_loop_01
WF_F56 multiple_cycle_entry_01
WF_F57 cycle_disruption_01
WF_F58 alternate_cycle_path_01
WF_F59 interlocked_cycles_01
```

`WF_F60` относится прежде всего к relationship synthesis prelude и не является обязательным source cycle model.

---

## 42. First cycle creation

Минимум:

```text
один результат процесса
становится input другого
+
цепочка возвращается
к функционально связанному состоянию
```

Рекомендуемый earliest point:

```text
level 84
```

### Working progression

```text
81–83
chain

84
first loop

85
multiple valid entry points

86
disruption

87
alternate route

88
interlocked cycles
```

---

## 43. Cycle has no required absolute beginning

Player UI не должен заставлять:

```text
выбрать «правильную первую карточку»
```

если cycle действительно замкнут.

Можно хранить:

```text
entry_point_used_by_player
```

как history решения.

Но это не ontology:

```text
absolute_start
```

---

## 44. Cycle revision

`WF_F57 cycle_disruption_01` может:

```text
invalidate one edge
```

без уничтожения всей model.

`WF_F58 alternate_cycle_path_01` может:

```text
restore closure differently
```

Так knowledge card показывает:

```text
cycle
≠
неподвижная схема
```

---

# PART XI. RELATIONSHIP KNOWLEDGE TRANSITIONS

## 45. Encounter knowledge effects

Encounter Registry имеет authority над:

```text
relationship effect
identity confirmation
character-specific reinterpretation
```

Knowledge Registry имеет authority над:

```text
какой record изменяется
какой presentation разрешён
что связывается
что остаётся отдельным
```

---

## 46. Encounter 2–7

Не создают автоматически новые permanent character cards для Cat/Owl:

```text
character card уже существует
```

Они добавляют в character history:

- interpretations;
- relationship milestones;
- linked world observations;
- shared reconstructions.

Это не обязано отображаться на face карточки.

---

## 47. Fox Encounter 3/4

Делает:

```text
Fox identity CONFIRMED
```

и выполняет transition entity-history.

Не делает:

```text
companion
```

---

## 48. Encounter 8/9

Temporary alliance / cooperation:

```text
не меняет UI group character → companion
```

Но character history получает:

```text
cooperation event
shared_method event
temporary_alliance history
```

---

## 49. Encounter 10

Ровно один record:

```text
Cat / Owl / Fox
```

получает:

```text
presentation_group = companion
```

Остальные остаются:

```text
character
```

со всеми earned milestones.

---

# PART XII. WORLD SYNTHESIS

## 50. `REC_FOREST_WORLD_SYNTHESIS_01`

### Presentation

```text
KR_FOREST_WORLD_SYNTHESIS
```

### Eligibility

Пять фаз:

```text
SYN_FOREST_WORLD_01
```

должны быть решены.

После Phase V:

```text
FOREST_SYNTHESIS_MODEL_SOLVED
↓
INTEGRATE_SYSTEM ready
```

Но это ещё не финальное обновление KnowledgeRecord.

### Creation / final transition

Игрок сам выполняет:

```text
INTEGRATE_SYSTEM
```

player-facing:

> **Увидеть целое**

Только после этого:

```text
REC_FOREST_WORLD_SYNTHESIS_01
create/update

KR_FOREST_WORLD_SYNTHESIS
create/update

forest_synthesis_complete = true
```

То есть:

```text
MODEL_SOLVED
≠
KNOWLEDGE REVEALED
```

### Не требуется

```text
all observations
all reconstructions
all revisits
all ★★★
Fox encountered
optional revelations cleared
```

Detailed phase contract:

```text
WORLD_FOREST_SYNTHESIS_REGISTRY_v0.01
```

---

## 51. World Synthesis is not «merge everything»

Система не делает:

```text
все KnowledgeRecord
→ один гигантский record
```

Она создаёт новую model более высокого порядка.

Источники могут включать:

```text
object/function relations
behavior/environment
multi-system role
hidden structure
event reconstruction
directed network
cycle
companion perspective
```

### Minimum semantic coverage

Authored synthesis должен потребовать минимум:

```text
4 relation families
```

из разных частей мира.

Но exact puzzle bundle остаётся `SYNTHESIS AUTHORING`.

---

## 52. `KR_FOREST_WORLD_SYNTHESIS` proposition

Рабочий смысл:

> **Лес является целым не потому, что рядом находится много живого, а потому, что между его частями существует распределённая сеть взаимного влияния.**

Это system model души.

Не энциклопедическое утверждение:

> «мы теперь знаем весь Лес».

---

# PART XIII. ELEMENTAL REVEAL

## 53. Encounter 11

### Objective event

```text
WE_FOREST_ELEMENTAL_FULL_MANIFESTATION_01
```

### Character presentation

```text
KR_FOREST_ELEMENTAL_CHARACTER
```

### Direct confirmation and reveal

Encounter 11 объективно подтверждает, что встреча с сущностью произошла.

После этого становится ready:

```text
RECOGNIZE_ENTITY
```

Player-facing transition не происходит молча.

Игрок сам нажимает:

> **Узнать**

и только после revelation:

```text
KR_FOREST_MANIFESTATION_PARTIAL
→ character.forest_elemental
```

если partial record являлся root-history candidate,

или создаётся:

```text
KR_FOREST_ELEMENTAL_CHARACTER
```

если такого root-record не было.

Для первого мира mandatory Elemental recognition является частью завершения уровня 100.

---

## 54. Какие observations можно связать с Elemental history

Allowed candidates:

```text
KR_FOREST_PATTERN_REPEATING
KR_FOREST_RESPONSE_COORDINATED
KR_FOREST_MANIFESTATION_PARTIAL
KR_FOREST_WORLD_SYNTHESIS
```

и только те дополнительные records, которые имеют explicit:

```text
elemental_thread provenance
```

---

## 55. Что НЕ присваивается Elemental

Запрещено автоматически связывать:

```text
Fox evidence
Guardian-compatible dormant facts
все broken branches
все animal routes
любую необъяснённую странность
```

Канонический инвариант:

> **Понимание целого не означает, что исчезли все неизвестные части.**

---

## 56. Elemental reveal does not mean Elemental caused the Forest

Смысл связи:

```text
распределённые отношения Леса
→ становятся различимы как единый принцип / сущность
```

Не:

```text
Elemental
→ вручную управлял
каждой птицей, веткой и грибом
```

---

# PART XIV. CROSS-WORLD OBSERVATION

## 57. `KR_FOREST_CONSTELLATION_INCOMPLETE`

### Source

```text
WF_F70 constellation_fragment_01
```

### Earliest

```text
level 100 / post-encounter
```

### Group

```text
observation
```

### Working title

```text
Неполный узор
```

### Important spoiler guard

Player-facing:

```text
НЕ:
«Созвездие Познания»
```

пока этот термин не раскрыт кампанией.

Backend identity может знать future relation.

UI — нет.

---

## 58. Cross-world record survives leaving Forest

Эта запись специально создаёт bridge:

```text
Мир Леса
→ следующий мир / будущие миры
```

Она не закрывается статусом:

```text
forest complete
```

и может получать:

- новые observations;
- links;
- reinterpretation;
- confidence changes

через другие области Познания.

---

# PART XV. REVISIT KNOWLEDGE LAW

## 59. Revisit не создаёт exposure задним числом

Если факт:

```text
существовал в старой сцене
```

но игрок тогда не видел соответствующую authored presentation:

```text
exposed = false
```

нельзя при позднем knowledge unlock сказать:

> «ты видел это раньше».

---

## 60. Что revisit может сделать

### A. First notice

```text
старый persistent fact
↓
новое настоящее посещение
↓
notice впервые
```

### B. Reinterpretation

```text
старое observation
+
новый context
↓
новая interpretation
```

### C. New connection

```text
старые независимые observations
↓
новая связь
```

### D. Reconstruction revision

```text
old model
+
new evidence
↓
revised model
```

### E. Character-history link

```text
старый trace
+
позднее known character
↓
«теперь я понимаю,
что это могло относиться к нему»
```

Только если evidence действительно поддерживает связь.

---

## 61. Revisit after Fox meeting

Допустимо:

```text
ранняя raw observation
↓
same_subject / evidence_of
→ Fox character history
```

Но нельзя:

```text
все маленькие следы
→ Fox
```

после знакомства.

Каждый link требует semantic compatibility.

---

## 62. Revisit after Elemental

Допустимо:

```text
pattern observation
→ новый контекст
```

Но мир специально сохраняет unresolved records.

Игрок должен иметь ощущение:

> **«я понял больше»**

а не:

> **«игра перекрасила все тайны в один ответ».**

---

# PART XVI. KNOWLEDGE PRESENTATION REGISTRY v0.01

## 63. Existing definitions

Сохраняются:

```text
KR_FOREST_CAT_CHARACTER
KR_FOREST_CAT_COMPANION

KR_FOREST_OWL_CHARACTER
KR_FOREST_OWL_COMPANION

KR_FOREST_FOX_TRACE_UNKNOWN
KR_FOREST_FOX_TRACE_SMALL_CREATURE
KR_FOREST_FOX_TRACE_FOX_LIKE
KR_FOREST_FOX_TRACE_YOUNG_FOX
KR_FOREST_FOX_CHARACTER
KR_FOREST_FOX_COMPANION

KR_FOREST_PATTERN_REPEATING
KR_FOREST_RESPONSE_COORDINATED
KR_FOREST_MANIFESTATION_PARTIAL
KR_FOREST_ELEMENTAL_CHARACTER

KR_FOREST_RECONSTRUCTION_PASSAGE
KR_FOREST_NETWORK_MODEL
KR_FOREST_CYCLE_MODEL
KR_FOREST_WORLD_SYNTHESIS

KR_FOREST_CONSTELLATION_INCOMPLETE
```

---

## 64. New definitions bound by Knowledge Registry

```text
KR_FOREST_OBS_PARTIAL_TRACK
KR_FOREST_OBS_BENT_GRASS
KR_FOREST_OBS_BARK_MARK
KR_FOREST_OBS_FUR_SNAG
KR_FOREST_OBS_FULL_SMALL_TRACK

KR_FOREST_OBS_FRESH_TRACKS
KR_FOREST_OBS_TRACE_AGE
KR_FOREST_OBS_BROKEN_BRANCH
KR_FOREST_OBS_MISSING_TRACE
KR_FOREST_OBS_TRACE_OVERLAP
KR_FOREST_OBS_CONTRADICTION

KR_FOREST_RECONSTRUCTION_TRACE_SEQUENCE
```

Итого Knowledge Presentation definitions после v0.01:

```text
31
```

---

## 65. New definition table

| Definition ID | Kind | UI group | display_state_key | Working title |
|---|---|---|---|---|
| `KR_FOREST_OBS_PARTIAL_TRACK` | `observation` | `observation` | `forest.obs.partial_track` | Неполный след |
| `KR_FOREST_OBS_BENT_GRASS` | `observation` | `observation` | `forest.obs.bent_grass` | Примятая трава |
| `KR_FOREST_OBS_BARK_MARK` | `observation` | `observation` | `forest.obs.bark_mark` | Свежая отметина на коре |
| `KR_FOREST_OBS_FUR_SNAG` | `observation` | `observation` | `forest.obs.fur_snag` | Рыжеватая шерсть |
| `KR_FOREST_OBS_FULL_SMALL_TRACK` | `observation` | `observation` | `forest.obs.full_small_track` | Чёткий маленький след |
| `KR_FOREST_OBS_FRESH_TRACKS` | `observation` | `observation` | `forest.obs.fresh_tracks` | Свежие следы |
| `KR_FOREST_OBS_TRACE_AGE` | `observation` | `observation` | `forest.obs.trace_age` | Следы разной давности |
| `KR_FOREST_OBS_BROKEN_BRANCH` | `observation` | `observation` | `forest.obs.broken_branch` | Сломанная ветвь |
| `KR_FOREST_OBS_MISSING_TRACE` | `observation` | `observation` | `forest.obs.missing_trace` | Оборвавшаяся цепочка следов |
| `KR_FOREST_OBS_TRACE_OVERLAP` | `observation` | `observation` | `forest.obs.trace_overlap` | Перекрывающиеся следы |
| `KR_FOREST_OBS_CONTRADICTION` | `observation` | `observation` | `forest.obs.contradiction` | След, который не сходится |
| `KR_FOREST_RECONSTRUCTION_TRACE_SEQUENCE` | `reconstruction` | `observation` | `forest.reconstruction.trace_sequence` | Последовательность событий |

Финальный literary copy этих titles может уточняться без смены identity, пока semantic meaning не меняется.

---

# PART XVII. SOURCE → KNOWLEDGE MATRIX

## 66. Critical authored mappings

| Source | Possible knowledge result | Rule |
|---|---|---|
| `WF_F04` | `KR_FOREST_OBS_PARTIAL_TRACK` | explicit notice/inspection |
| `WF_F05` | `KR_FOREST_OBS_BENT_GRASS` | explicit notice/inspection |
| `WF_F07` | `KR_FOREST_OBS_BARK_MARK` | explicit notice/inspection |
| `WF_F10` | `KR_FOREST_OBS_FUR_SNAG` | explicit notice/inspection |
| `WF_F66` | `KR_FOREST_OBS_FULL_SMALL_TRACK` | explicit notice/inspection |
| compatible Fox bundle | `KR_FOREST_FOX_TRACE_*` | connection/inference, not exposure alone |
| `WF_F02/F06` + cross-context motif | `KR_FOREST_PATTERN_REPEATING` | 2+ contexts + connection |
| `WE_FOREST_RESPONSE_01` | `KR_FOREST_RESPONSE_COORDINATED` | witnessed + coordinated nature noticed |
| `WF_F35` | `KR_FOREST_OBS_FRESH_TRACKS` | selected/noticed |
| `WF_F36` | `KR_FOREST_OBS_TRACE_AGE` | temporal difference interpreted |
| `WF_F38/F69` | `KR_FOREST_OBS_BROKEN_BRANCH` | selected/noticed |
| `WF_F39` | `KR_FOREST_OBS_MISSING_TRACE` | justified expectation required |
| `WF_F40` | `KR_FOREST_OBS_TRACE_OVERLAP` | temporal overlap interpreted |
| `WF_F41` | `KR_FOREST_OBS_CONTRADICTION` | connected to current model |
| trace bundle | `KR_FOREST_RECONSTRUCTION_PASSAGE` | reconstruction guard |
| temporal bundle | `KR_FOREST_RECONSTRUCTION_TRACE_SEQUENCE` | sequence guard |
| `WF_F44–F51` | `KR_FOREST_NETWORK_MODEL` | network guard |
| `WF_F52–F59` | `KR_FOREST_CYCLE_MODEL` | cycle guard |
| partial manifestation event | `KR_FOREST_MANIFESTATION_PARTIAL` | unity noticed |
| level 99 synthesis | `KR_FOREST_WORLD_SYNTHESIS` | synthesis complete |
| encounter 11 | `KR_FOREST_ELEMENTAL_CHARACTER` | direct confirmation |
| `WF_F70` | `KR_FOREST_CONSTELLATION_INCOMPLETE` | noticed post-world bridge |

---

# PART XVIII. QA INVARIANTS

## 67. QA — backend spoiler

Backend:

```text
WF_F10 related_threads = fox
```

Player заметил только шерсть.

Expected:

```text
«Рыжеватая шерсть»
```

Not:

```text
«След Лиса»
```

---

## 68. QA — repeated same evidence

Игрок несколько раз видит маленький отпечаток.

Expected:

```text
confidence can strengthen modestly
```

but not:

```text
CONFIRMED young fox
```

без independent identity + scale evidence.

---

## 69. QA — Fox direct meeting

Player has no Fox observations.

Encounter 4 direct meeting occurs.

Expected:

```text
create character.fox
```

No fake retroactive cards.

---

## 70. QA — Fox observation morph

Player has entity-history:

```text
fox.trace.fox_like
```

Then direct meeting.

Expected:

```text
same runtime record
→ character.fox
```

Raw track/fur cards remain linked.

---

## 71. QA — missing trace

There is no track, but player never had basis to expect one.

Expected:

```text
no KR_FOREST_OBS_MISSING_TRACE
```

Absence alone is not evidence.

---

## 72. QA — reconstruction revision

Player created creature passage model.

Contradicting trace appears.

Expected:

```text
FOREST_RECONSTRUCTION_REVISED
```

Old revision remains in history.

---

## 73. QA — Response

World event occurs but player does not notice coordination.

Expected:

```text
world event recorded
no response card
```

Later revisit cannot claim the player noticed it then.

---

## 74. QA — Elemental spoiler

Player has:

```text
Pattern
Response
```

before level 100.

Expected:

```text
no character.forest_elemental
```

unless a future authored direct revelation explicitly changes canon.

---

## 75. QA — partial manifestation morph

Player noticed partial manifestation.

At Encounter 11:

Expected:

```text
partial record
may become elemental character root
```

Pattern and Response remain separate linked observations.

---

## 76. QA — Guardian remains unresolved

After Elemental reveal there is dormant Guardian-compatible fact.

Expected:

```text
unresolved
```

Not:

```text
elemental evidence
```

and not:

```text
Bear identity
```

---

## 77. QA — network is directional

Player has:

```text
A supports B
```

Expected:

```text
B supports A
```

NOT inferred automatically.

---

## 78. QA — cycle entry point

Two players build same closed cycle from different starting nodes.

Expected:

```text
both valid
same ontology
different solution history
```

---

## 79. QA — companion grouping

At level 90 Owl becomes companion.

Expected:

```text
same owl KnowledgeRecord
group character → companion
```

No duplicate Owl card.

Cat/Fox histories unchanged.

---

## 80. QA — revisit first notice

Fact existed earlier but was not exposed/noticeable to the player.

Later current-state revisit shows it.

Expected:

```text
first_observed_at = revisit
```

Not:

```text
«ты видел это на level X»
```

---

# PART XIX. AUTHORING GAPS

## 81. What v0.01 intentionally leaves open

1. exact literary copy for 12 new presentation definitions;
2. numeric evidence thresholds;
3. exact support value of each fact;
4. final UI card layout;
5. whether every chapter gets any additional local observation-card;
6. exact level of `WE_FOREST_ELEMENTAL_PARTIAL_MANIFESTATION_01`;
7. exact confirmation fate of `REC_FOREST_EVENT_CREATURE_PASSAGE_01`;
8. exact Guardian observation definitions;
9. final Elemental name/title;
10. exact source bundle inside level 99 Synthesis puzzle.

These are explicit authored gaps, not implementation freedom.

---

## 82. What v0.01 fixes

```text
three UI knowledge groups
observation-card eligibility law
confidence proposition scope
independent-evidence law

Cat/Owl direct character history
Fox raw evidence vs entity-history separation
Fox presentation ladder
Fox direct-encounter merge behavior

12 new Knowledge Presentation IDs

chapter 7 observation-card set
missing-trace guard

creature-passage reconstruction contract
trace-sequence reconstruction contract

pattern-card creation
Response-card contract
Guardian no-card/no-identity rule

partial-manifestation → Elemental root behavior

Neighborhood network reconstruction
Cycle reconstruction
World Synthesis knowledge model

Elemental reveal link allowlist
cross-world incomplete-pattern behavior

revisit knowledge laws
QA invariants
```

---

## 83. Статус после Knowledge Registry v0.05

Связанные фундаментальные pass уже зафиксированы:

```text
REVISIT
→ WORLD_FOREST_REVISIT_REGISTRY_v0.03

SYNTHESIS
→ WORLD_FOREST_SYNTHESIS_REGISTRY_v0.03

MACHINE EXPORT
→ WORLD_FOREST_MACHINE_PACKAGE_SPEC_v0.03
```

Следующая работа над knowledge-layer относится к authored content и implementation: final card copy, exact thresholds/bundles, UX reveal language и runtime integration с event/projection model.
