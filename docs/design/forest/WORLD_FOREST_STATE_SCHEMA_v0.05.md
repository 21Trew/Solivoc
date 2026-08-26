# WORLD FOREST STATE SCHEMA — Мир Леса

> **Статус:** рабочий production schema  
> **Версия:** 0.05  
> **World ID:** `forest`  
> **Охват:** narrative state, knowledge state, world state, relationships, Cognition, encounters, revisit, save/recovery, migrations и QA для уровней `1–100` и поздних возвращений  
> **Основание:** `WORLD_FOREST_STATE_MAP_v0.03`, `WORLD_FOREST_LEVEL_BLUEPRINT_v0.13`, `WORLD_FOREST_DOSSIER_v0.18`, `WORLD_CAMPAIGN_MANIFEST_v0.21`, `GAME_VISION_MANIFEST_v0.12`, `CHARACTER_WORLD_MANIFEST_v0.15`, `WORLD_FOREST_SYNTHESIS_REGISTRY_v0.03`  
> **Назначение:** определить логическую модель данных и контракты переходов, достаточные для реализации narrative engine без смешивания объективного мира, знания игрока и производных персонализирующих состояний.

---

## 1. Статус и границы документа

Этот документ переводит семантическую `WORLD_FOREST_STATE_MAP` в технический контракт.

Он фиксирует:

- какие записи являются источником истины;
- какие состояния являются проекциями;
- какие ID должны быть стабильными;
- какие события меняют состояние;
- какие guards обязательны;
- как обеспечивается idempotency;
- как устроены encounter routing и fallback;
- как работают revisit и expired events;
- что сохраняется при crash/retry;
- как версии контента мигрируют без переписывания истории игрока.

Документ **не фиксирует**:

- SQL DDL;
- конкретную СУБД;
- ORM;
- язык backend;
- HTTP/GraphQL API;
- тексты диалогов;
- точные числовые thresholds Cognition;
- финальные gameplay-эффекты способностей маскотов;
- финальный UX карточек.

До выбора технического стека схемы ниже являются **логическими контрактами**, а JSON используется как нормативный пример структуры.

---

## 2. Главный архитектурный принцип

Источник истины разделяется на две категории:

```text
CONTENT DEFINITIONS
что вообще существует в версии контента

+

PLAYER SEMANTIC EVENTS
что реально произошло
с конкретной душой

=

CURRENT PROJECTIONS
текущее состояние мира,
знания, отношений и маршрутов
```

Критически важно:

```text
PROJECTION
≠
SOURCE OF TRUTH
```

Например:

```text
memory = 17
owl_ready = true
fox_confidence = LIKELY
```

могут быть удобными текущими проекциями.

Но восстановить историю только из них нельзя.

Поэтому канонические события сохраняются как append-only history.

---

## 3. Три класса данных

### 3.1. Content definitions

Версионируемые authored-описания:

- `WorldFactDefinition`;
- `AreaDefinition`;
- `ChoiceDefinition`;
- `EncounterDefinition`;
- `KnowledgePresentationDefinition`;
- `RevisitDefinition`;
- `WorldEventDefinition`;
- правила routing;
- правила derived Cognition.

Они описывают **возможность** события.

Они не утверждают, что событие произошло у конкретного игрока.

### 3.2. Canonical player history

Append-only семантические события:

- выбор;
- exposure;
- observation;
- interpretation;
- reconstruction;
- encounter;
- relationship milestone;
- изменение world state;
- companion acquisition;
- synthesis;
- revisit;
- migration/repair.

Именно эта история является основным источником истины аккаунта.

### 3.3. Rebuildable projections

Проекции, которые можно пересчитать:

- `WorldStateProjection`;
- `KnowledgeProjection`;
- `RelationshipProjection`;
- `ThreadProjection`;
- `CognitionProjection`;
- `EncounterProjection`;
- `RevisitProjection`.

Проекция может кэшироваться для производительности, но должна иметь:

```text
projection_version
source_sequence
formula_version
```

чтобы её можно было безопасно перестроить.

---

## 4. Общие правила ID

### 4.1. Stable authored ID

Authored ID:

- уникален в своём namespace;
- не меняется после публикации;
- не переиспользуется для нового смысла;
- не содержит display-текст;
- не зависит от локализации.

### 4.2. Runtime ID

Каждый runtime-record получает отдельный instance ID.

Рекомендуется:

```text
UUIDv7 / ULID
```

Конкретный формат implementation-specific.

### 4.3. ID и версия — разные вещи

Нельзя:

```text
WF_F04_v2
```

если это всё ещё тот же world fact.

Нужно:

```text
id = WF_F04
content_version = ...
```

Если смысл изменился настолько, что это уже другой факт, создаётся новый ID.

---

## 5. Namespaces Мира Леса

Рекомендуемые namespaces:

```text
WF_*      world fact definition
WE_*      authored world event definition
AREA_*    area definition
CHOICE_*  authored choice
ENC_*     encounter definition / variant
KR_*      knowledge presentation definition
REC_*     reconstruction definition
REV_*     revisit definition
THREAD_*  narrative thread definition
REL_*     relationship milestone definition
SYN_*     synthesis definition
```

Runtime `event_id`, `knowledge_record_id`, `reconstruction_instance_id` и т. п. являются отдельными instance IDs.

---

## 6. Area registry

Для первого мира фиксируется стабильный area registry:

| Area ID | Player-facing область | Основные уровни |
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

Это logical area IDs.

Конкретные вложенные локации внутри областей получают отдельные ID позднее, когда будет создана production map сцен.

---

## 7. `WorldFactDefinition`

### 7.1. Назначение

`WorldFactDefinition` описывает объективный authored-факт мира.

Факт существует независимо от того:

- увидел ли его игрок;
- понял ли;
- получил ли карточку;
- сделал ли правильный вывод.

### 7.2. Logical schema

```json
{
  "id": "WF_F04",
  "slug": "small_track_partial_01",
  "world_id": "forest",
  "area_id": "AREA_FOREST_CLEARING",

  "first_possible_level": 3,
  "persistence": "persistent",

  "semantic_tags": [
    "track",
    "small_creature",
    "fox_evidence_candidate"
  ],

  "related_threads": [
    "THREAD_FOREST_FOX"
  ],

  "valid_from_content_version": "forest_blueprint:0.11",
  "retired_in_content_version": null
}
```

### 7.3. `persistence`

Допустимые semantic values:

```text
persistent
temporary
event_residue
conditional
presentation_only
```

`presentation_only` не должен использоваться как evidence для долгой inference-chain.

Если деталь участвует в:

- позднем revisit;
- реконструкции;
- identity inference;
- migration;
- красной нити;

она должна иметь persistent authored identity.

---

## 8. Закрытие известных `TBD_ID`

`WORLD_FOREST_STATE_MAP_v0.03` выявила несколько объективных элементов без стабильного ID.

В этой schema фиксируются следующие технические ID.

### 8.1. Уровень 23 — более полный след

```text
WF_F66
full_small_track_01
```

Смысл:

> более полный маленький отпечаток в мягкой почве, пригодный для сравнения формы.

Связь:

```text
Fox evidence
```

### 8.2. Уровень 34 — неоднозначный trace-bundle

Три объективных следа получают отдельные ID, потому что они могут:

- быть замечены независимо;
- поддерживать разные hypotheses;
- использоваться при revisit;
- входить в разные reconstruction.

```text
WF_F67 bark_scrape_trace_01
WF_F68 disturbed_ground_trace_01
WF_F69 broken_branch_trace_01
```

Их общая authored-сцена может объединять 1–3 факта в зависимости от варианта.

### 8.3. Уровни 28 и 50

Визуальная рифма:

```text
ветви
корни
жилки
маршруты
```

не получает новые `WF_Fxx` только за факт повторного показа.

Это повторная **экспозиция уже существующего pattern-family**, а не новая объективная сущность.

Она хранится через:

```text
ExposureEvent
semantic_tags:
pattern.branching_network
```

и связи с соответствующими facts.

Так мы не плодим дубликаты одного мотива.

### 8.4. Уровень 40

Совместное изменение участка действиями нескольких зверей является не новым статичным world fact, а authored world event:

```text
WE_FOREST_MULTI_ANIMAL_ENVIRONMENT_SHIFT_01
```

Его последствия могут менять конкретные existing facts / area state.

### 8.5. Уровень 60

Первый согласованный Отклик:

```text
WE_FOREST_RESPONSE_01
```

Это world event.

Карточка:

```text
«Согласованный Отклик»
```

является отдельным knowledge-state и появляется не автоматически у всех.

### 8.6. Уровень 70

«Место хранит последствия нескольких старых событий» не становится одним искусственным `WF_Fxx`.

Оно строится из:

```text
existing persistent consequences
+
their timestamps/order
+
player observations
```

и используется как input для reconstruction.

### 8.7. Уровень 100

Полное проявление:

```text
WE_FOREST_ELEMENTAL_FULL_MANIFESTATION_01
```

Неполный узор за пределами Леса получает authored fact ID:

```text
WF_F70
constellation_fragment_01
```

Player-facing знание на этом этапе:

```text
«Неполный узор»
```

Backend ID не раскрывает термин «Созвездие Познания» игроку раньше времени.

---

## 9. `WorldEventDefinition`

### 9.1. Назначение

World event описывает объективное изменение состояния мира.

Пример:

```json
{
  "id": "WE_FOREST_RESPONSE_01",
  "world_id": "forest",
  "area_id": "AREA_FOREST_FUNGI",
  "trigger_scope": {
    "level": 60
  },
  "effects": [
    {
      "type": "set_world_flag",
      "key": "forest_response_occurred",
      "value": true
    }
  ],
  "persistent": true,
  "content_version": "forest_blueprint:0.11"
}
```

World event не означает автоматически:

```text
player noticed it
```

Факт события и knowledge-state игрока разделены.

---

## 10. Semantic event envelope

Все канонические player-specific события используют единый envelope.

```json
{
  "event_id": "019...runtime-id",
  "event_key": "FOREST_WORLD_FACT_EXPOSED",

  "player_id": "internal-player-ref",
  "world_id": "forest",

  "area_id": "AREA_FOREST_CLEARING",
  "chapter_id": 1,
  "level_id": 3,
  "scene_id": "forest.clearing.level03.main",

  "sequence_no": 184,
  "command_id": "019...command",
  "transaction_id": "019...transaction",

  "idempotency_key": "server-derived-stable-key",

  "payload": {},

  "semantic_tags": [],

  "canon_version": {
    "game_vision": "0.12",
    "world_campaign": "0.21",
    "forest_dossier": "0.16",
    "forest_blueprint": "0.12",
    "forest_state_schema": "0.04"
  },

  "occurred_at": "server-time",
  "recorded_at": "server-time",

  "origin": "server"
}
```

### 10.1. Обязательные runtime-поля

Обязательны:

```text
event_id
event_key
player_id
sequence_no
command_id
transaction_id
idempotency_key
payload
canon_version
recorded_at
origin
```

`world_id / area / level` могут быть nullable для мета-событий, но для событий Мира Леса должны заполняться всегда, когда контекст известен.

---

## 11. `sequence_no`

На одного игрока семантические события имеют монотонный server-side sequence.

Это позволяет:

- детерминированно rebuild projections;
- сравнивать порядок evidence;
- отличать знание «до встречи» от знания «после встречи»;
- разрешать concurrent client retry;
- строить migration.

Client timestamp не используется как единственный источник порядка.

---

## 12. `command_id`, `transaction_id`, `idempotency_key`

### 12.1. `command_id`

Одна пользовательская/серверная команда.

Например:

```text
complete_level_90
```

### 12.2. `transaction_id`

Группа событий, которая должна сохраниться атомарно.

Для уровня 90 одна transaction может включать:

```text
LEVEL_COMPLETED
ENCOUNTER_10_COMPLETED
RELATIONSHIP_SYNTHESIS_COMPLETED
KNOWLEDGE_PRESENTATION_CHANGED
COMPANION_ACQUIRED
THREAD_UPDATED
```

Нельзя получить состояние:

```text
уровень завершён
+
спутник не записан
```

из-за падения между двумя writes.

### 12.3. `idempotency_key`

Сервер формирует deterministic semantic key.

Для one-time события:

```text
player
+
event_key
+
semantic_scope
```

Например:

```text
<player>|FOREST_ENCOUNTER_COMPLETED|ENC_FOREST_10
```

Повторный retry возвращает уже принятый результат, а не создаёт второй event.

---

## 13. Canonical event types

Минимальный набор event keys v0.01:

```text
FOREST_LEVEL_STARTED
FOREST_LEVEL_COMPLETED

FOREST_CHOICE_SELECTED

FOREST_WORLD_FACT_EXPOSED
FOREST_WORLD_EVENT_OCCURRED

FOREST_OBSERVATION_CREATED
FOREST_OBSERVATION_UPDATED

FOREST_INTERPRETATION_ADDED
FOREST_INTERPRETATION_REVISED
FOREST_KNOWLEDGE_CONFIRMED
FOREST_KNOWLEDGE_LINKED

FOREST_KNOWLEDGE_REVELATION_READY
FOREST_KNOWLEDGE_REVELATION_STARTED
FOREST_KNOWLEDGE_REVELATION_COMPLETED

FOREST_RECONSTRUCTION_CREATED
FOREST_RECONSTRUCTION_REVISED
FOREST_RECONSTRUCTION_CONFIRMED

FOREST_ENCOUNTER_STARTED
FOREST_ENCOUNTER_COMPLETED

FOREST_RELATIONSHIP_MILESTONE
FOREST_TEMPORARY_ALLIANCE_STARTED
FOREST_TEMPORARY_ALLIANCE_COMPLETED
FOREST_RELATIONSHIP_SYNTHESIS_COMPLETED
FOREST_COMPANION_ACQUIRED

FOREST_THREAD_OPENED
FOREST_THREAD_STATE_CHANGED

FOREST_REVISIT_STARTED
FOREST_REVISIT_COMPLETED

FOREST_SYNTHESIS_STARTED
FOREST_SYNTHESIS_PHASE_COMPLETED
FOREST_SYNTHESIS_MODEL_SOLVED
FOREST_SYNTHESIS_COMPLETED

FOREST_ELEMENTAL_STAGE_CHANGED

FOREST_CONTENT_MIGRATION_APPLIED
FOREST_STATE_REPAIR_APPLIED
```

Не каждый UI click становится semantic event.

---

## 14. Exposure event

### 14.1. Payload

```json
{
  "world_fact_id": "WF_F04",
  "exposure_mode": "background_visible",
  "visibility_strength": "subtle",
  "required_for_core_progression": false
}
```

### 14.2. Guard

`FOREST_WORLD_FACT_EXPOSED` допустим только если authored scene действительно содержит этот fact.

Нельзя retrospectively выставить:

```text
exposed = true
```

только потому, что факт был логически возможен где-то в той же главе.

---

## 15. `ExposureProjection`

```json
{
  "player_id": "...",
  "world_fact_id": "WF_F04",

  "exposed": true,
  "first_exposed_sequence": 51,
  "last_exposed_sequence": 244,
  "exposure_count": 3,

  "first_scene_id": "forest.clearing.level03.main",
  "last_scene_id": "forest.clearing.revisit.01",

  "projection_version": 1,
  "source_sequence": 244
}
```

`exposure_count` не является автоматически Cognition signal.

---

## 16. `KnowledgeRecord`

### 16.1. Главная задача

`KnowledgeRecord` представляет стабильную player-facing историю знания.

Ключевой инвариант:

> **Observation → Character → Companion не создаёт три независимые копии одной истории.**

### 16.2. Logical schema

```json
{
  "knowledge_record_id": "runtime-stable-id",

  "record_kind": "entity_history",
  "presentation_group": "observation",

  "subject_ref": {
    "type": "character",
    "id": "fox"
  },

  "subject_visibility": "hidden",

  "display_state_key": "fox.trace.small_creature",
  "confidence": "LIKELY",

  "source_world_fact_ids": [
    "WF_F04",
    "WF_F07",
    "WF_F10"
  ],

  "linked_record_ids": [],
  "reconstruction_ids": [],

  "first_created_sequence": 86,
  "last_changed_sequence": 193,

  "content_version": "forest_state_schema:0.04"
}
```

### 16.3. `subject_ref` и player knowledge

Backend может знать:

```text
subject_ref = fox
```

при этом:

```text
subject_visibility = hidden
```

Player-facing UI не имеет права выводить скрытую identity.

После подтверждения:

```text
subject_visibility = revealed
presentation_group = character
display_state_key = character.fox
confidence = CONFIRMED
```

После level 90, если именно Лис стал спутником:

```text
presentation_group = companion
```

---

## 16.4. `PLAYER_INITIATED_REVELATION`

Значимый knowledge-transition разделяется на:

```text
ELIGIBILITY
у игрока появились основания

и

COMMIT
игрок сам инициировал раскрытие
```

### 16.4.1. `pending_transition`

`KnowledgeRecord` может иметь одно активное значимое pending-state:

```json
{
  "pending_transition": {
    "transition_id": "runtime-id",
    "transition_type": "entity_inference",

    "target_display_state_key": "fox.trace.fox_like",
    "target_presentation_group": "observation",
    "target_confidence": "LIKELY",

    "readiness": "ready",
    "required_for_progression": false,

    "player_action": "MAKE_INFERENCE",
    "revelation_tier": "connection",

    "ready_sequence": 301,
    "supporting_event_ids": []
  }
}
```

`pending_transition` описывает **доступный следующий шаг**, а не уже совершившееся знание.

До player action текущие:

```text
display_state_key
presentation_group
confidence
```

не переписываются target-state автоматически.

### 16.4.2. Semantic action types

Минимальный набор:

```text
LINK_OBSERVATIONS
MAKE_INFERENCE
REVISE_INTERPRETATION
RECONSTRUCT_EVENT
SEE_PATTERN
RECOGNIZE_ENTITY
CONTINUE_TOGETHER
INTEGRATE_SYSTEM
```

Player-facing copy задаётся authored content и не обязан буквально совпадать с technical action type.

### 16.4.3. Revelation tiers

```text
refinement
connection
reconstruction
identity
relationship
world
```

Tier определяет UX-интенсивность, но не semantic importance для backend.

### 16.4.4. Events

Добавляются canonical event keys:

```text
FOREST_KNOWLEDGE_REVELATION_READY
FOREST_KNOWLEDGE_REVELATION_STARTED
FOREST_KNOWLEDGE_REVELATION_COMPLETED
```

`READY` имеет origin `server` и фиксирует eligibility.

`STARTED` создаётся player command.

`COMPLETED` атомарно применяет target-state и provenance links.

### 16.4.5. Idempotency

Player action использует собственный `command_id`.

Повторный tap / reconnect:

```text
не создаёт второй transition
не дублирует reconstruction
не создаёт вторую character-card
не создаёт второго companion
```

### 16.4.6. Mandatory transition

Если `required_for_progression = true`, следующий обязательный контент не должен молча считать target-state уже раскрытым.

Вместо этого:

```text
checkpoint
→ foreground pending transition
→ player action
→ commit
→ continuation
```

Игрок может выйти из игры и вернуться.

Pending-state должен восстановиться из event history.

### 16.4.7. Optional transition

Optional pending-transition может оставаться непрожитым.

Это:

- не уменьшает награды;
- не создаёт FOMO;
- не считается ошибкой;
- не превращается в скрытый штраф Cognition.

### 16.4.8. Direct encounter

Прямая встреча может объективно подтвердить identity в narrative/relationship history.

Но если существует значимый player-facing card transition:

```text
observation → character
```

само преобразование presentation выполняется через `RECOGNIZE_ENTITY`.

То есть encounter создаёт:

```text
direct_confirmation
+
REVELATION_READY
```

а не обязательно silently mutates card presentation в фоне.

### 16.4.9. Companion transition

Relationship Synthesis сначала создаёт:

```text
companion_transition_ready = true
```

После authored player action:

```text
CONTINUE_TOGETHER
```

одна transaction фиксирует:

```text
FOREST_COMPANION_ACQUIRED
FOREST_KNOWLEDGE_REVELATION_COMPLETED
presentation_group = companion
```

Для Мира Леса это обязательная часть завершения уровня 90 перед открытием 91-го.

### 16.4.10. Accessibility

Revelation-state не зависит от просмотра полной анимации.

Reduced-motion presentation обязан приводить к тому же semantic transaction и тому же состоянию provenance.


## 17. `record_kind`

Минимальные значения:

```text
entity_history
phenomenon
pattern
reconstruction
system_model
cross_world_observation
```

Примеры:

```text
Лис
→ entity_history

Согласованный Отклик
→ phenomenon

Повторяющийся узор
→ pattern

Здесь недавно прошло крупное существо
→ reconstruction

Сеть соседства
→ system_model

Неполный узор
→ cross_world_observation
```

---

## 18. Объединение нескольких observation

### 18.1. Запрещён destructive merge

Если:

```text
Observation A
+
Observation B
```

позднее оказываются следами одного персонажа, нельзя удалять один record и переписывать историю.

### 18.2. Root-history rule

Если несколько player-visible records впервые связываются с одной сущностью:

1. самый ранний player-visible record, содержательно подходящий как основная история, становится `root knowledge record`;
2. остальные записи сохраняются;
3. они получают `linked_record_ids` / `evidence_of`;
4. UI может показывать их внутри History/Dossier основной карточки;
5. provenance не теряется.

### 18.3. Пример

```text
KR A:
«Следы у тропы»

KR B:
«Рыжая шерсть на ветке»

↓

identity confirmed

KR A:
presentation_group = character
display = «Лис»

KR B:
остаётся observation
linked_to = KR A
relation = evidence_of
```

Так сохраняется зафиксированный принцип «история не дублируется», но независимые наблюдения не уничтожаются.

---

## 19. `KnowledgeLink`

```json
{
  "knowledge_link_id": "runtime-id",
  "from_record_id": "KR_B",
  "to_record_id": "KR_A",

  "relation": "evidence_of",

  "confidence": "CONFIRMED",

  "created_sequence": 310,
  "superseded_sequence": null
}
```

Минимальные relation types:

```text
evidence_of
supports
contradicts
same_subject
part_of_pattern
explained_by
reinterprets
```

---

## 20. Confidence

Текущий semantic vocabulary:

```text
SUSPECTED
LIKELY
INFERRED
CONFIRMED
```

Это не процент вероятности.

Не требуется хранить:

```text
73.4%
```

если gameplay этого не использует.

Внутренний inference engine может иметь числовую support measure, но player knowledge state обязан сохранять semantic confidence.

---

## 21. Guard: знание требует evidence

`FOREST_OBSERVATION_CREATED` должен ссылаться хотя бы на одно:

```text
exposed world fact
direct encounter
world event actually witnessed
revisit scene fact
explicit authored revelation
```

`FOREST_INTERPRETATION_ADDED` должен ссылаться на observation/evidence, существовавшее **до или на том же sequence**.

Запрещено:

```text
backend knows fox
→ create «Похоже, лисёнок»
```

без доступного игроку evidence.

---

## 22. `Reconstruction`

### 22.1. Logical schema

```json
{
  "reconstruction_instance_id": "runtime-id",
  "definition_id": "REC_FOREST_EVENT_CREATURE_PASSAGE_01",

  "kind": "event",

  "source_knowledge_record_ids": [
    "KR_broken_branch",
    "KR_track",
    "KR_bent_grass"
  ],

  "current_revision": 2,
  "confidence": "LIKELY",

  "confirmation_state": "unconfirmed",

  "first_created_sequence": 710,
  "last_revised_sequence": 742
}
```

### 22.2. Revision history

Каждая новая версия — отдельное semantic event.

Не:

```text
UPDATE reconstruction
SET interpretation = ...
```

без истории.

А:

```text
FOREST_RECONSTRUCTION_CREATED
FOREST_RECONSTRUCTION_REVISED
FOREST_RECONSTRUCTION_CONFIRMED
```

Projection хранит только current view.

Event history сохраняет путь.

---

## 23. Reconstruction kinds

```text
event
network
cycle
process_history
world_synthesis
```

`world_synthesis` используется только как technical family для level 99.

Он не должен смешиваться с обычной локальной event reconstruction.

---

## 24. `RelationshipProjection`

### 24.1. Не используем единый friendship score

Схема не вводит:

```text
friendship = 82
```

Основная модель строится на реальных milestones и evidence.

### 24.2. Logical schema

```json
{
  "player_id": "...",
  "character_id": "owl",

  "identity_known": true,
  "acquainted": true,

  "borrowed_perspective": {
    "seen": true,
    "forced_tutorial_used": true,
    "voluntarily_used": true
  },

  "milestones": {
    "understanding_established": true,
    "reciprocity_established": true,
    "cooperation_established": false,
    "temporary_alliance_completed": false,
    "relationship_synthesis_completed": false,
    "companion": false
  },

  "evidence": {
    "understanding_event_ids": [],
    "reciprocity_event_ids": [],
    "cooperation_event_ids": [],
    "shared_history_event_ids": []
  },

  "unresolved_question_keys": [],

  "projection_version": 1,
  "source_sequence": 801
}
```

---

## 25. Relationship milestone guards

### `understanding_established`

Нужен хотя бы один содержательный event, где игрок:

- понял способ персонажа;
- применил его;
- или корректно различил его ограничение.

### `reciprocity_established`

Нужен event, где:

```text
не только игрок изменил понимание,
но и персонаж изменил своё
```

### `cooperation_established`

Нужен shared task, где:

```text
маскот видит один слой
+
игрок добавляет другой
+
результат требует обоих
```

### `temporary_alliance_completed`

Только завершение Encounter 8 variant, если именно этот персонаж был временным союзником.

### `relationship_synthesis_completed`

Только Encounter 10 на уровне 90.

### `companion`

Только после успешно завершённого Relationship Synthesis и добровольного решения маскота.

---

## 26. `NarrativeThreadProjection`

```json
{
  "thread_id": "THREAD_FOREST_FOX",

  "status": "active",

  "identity_state": "inferred",
  "relationship_character_id": "fox",

  "readiness_evidence_event_ids": [],

  "encounter_ids_completed": [],
  "shared_history_event_ids": [],

  "temporary_alliance_completed": false,
  "companion": false,

  "last_meaningful_sequence": 612
}
```

`readiness_evidence_event_ids` является provenance.

Проекция может дополнительно иметь cached readiness score, но такой score:

```text
не является каноном
не показывается игроку
может быть пересчитан
не заменяет evidence
```

---

## 27. `CognitionEvent`

### 27.1. Primary dimensions Forest v0.01

```text
memory
observation
comparison
verification
intuition
reinterpretation
depth
discovery
```

### 27.2. Payload authored-choice

```json
{
  "choice_id": "CHOICE_FOREST_L05_ATTENTION",
  "option_id": "bent_grass",

  "weights": {
    "discovery": 2,
    "intuition": 1,
    "observation": 1
  },

  "thread_effects": {
    "THREAD_FOREST_FOX": 1
  },

  "profile_eligible": true,
  "signal_confidence": "authored_strong"
}
```

---

## 28. Forced tutorial rule

Уровни, где игра требует:

- «Эхо памяти»;
- «Пристальный взгляд»;
- конкретный ход;

пишут semantic event с:

```text
profile_eligible = false
reason = forced_tutorial
```

Они могут обновить:

```text
familiarity
exposure
```

но не preference.

---

## 29. Gameplay / behavioral signals

Не каждый gameplay signal должен становиться canonical narrative event.

Для:

- темпа;
- пауз;
- порядка открытия колоды;
- ошибок;
- использования hints;
- повторов;
- mastery behavior;

используется отдельный `BehaviorSignalEvent`.

```json
{
  "signal_id": "runtime-id",
  "signal_type": "deck_reveal_strategy",

  "world_id": "forest",
  "level_id": 24,

  "value": "scan_first",

  "context": {
    "difficulty_band": "normal",
    "mechanic_familiarity": "known"
  },

  "profile_eligible": true,
  "consent_scope": "optional_personalization",

  "recorded_at": "server-time"
}
```

### 29.1. Почему отдельно

Это позволяет:

- не путать историю мира с телеметрией;
- выключать необязательную персонализацию;
- сбрасывать адаптивный профиль без потери сюжетного прогресса;
- не превращать каждое движение карты в вечный narrative event.

---

## 30. `CognitionProjection`

### 30.1. Три горизонта

```json
{
  "primary": {
    "memory": {
      "recent": 0,
      "world": 0,
      "lifetime": 0
    }
  },

  "derived": {
    "analysis": {
      "state": "emerging",
      "formula_version": "analysis@1",
      "evidence_event_ids": []
    }
  },

  "source_sequence": 922,
  "projection_version": 1
}
```

Конкретные числовые формулы не фиксируются этой v0.01.

### 30.2. Derived indicators

Кандидаты:

```text
analysis
pattern_recognition
contextual_reasoning
pathfinding
synthesis
causal_reasoning
behavioral_inference
cross_context_integration
systems_thinking
network_reasoning
hidden_structure_reasoning
temporal_reasoning
relational_reasoning
cycle_reasoning
```

Правило:

> persisted source = evidence history; derived state = rebuildable projection.

Не все кандидаты обязаны стать самостоятельными persisted columns.

---

## 31. Сброс адаптивного профиля

Сброс персонализации **не удаляет основной сюжетный прогресс**.

Не удаляются:

- completed levels;
- authored choices как исторические факты;
- encounters;
- acquired companion;
- knowledge, которое игрок уже реально открыл;
- relationship milestones;
- world changes.

Сбрасываются / инвалидируются:

- derived Cognition projections;
- adaptive routing caches;
- необязательные behavior-derived conclusions;
- pre-reset optional signals перестают влиять на новую adaptive projection.

Рекомендуется записывать:

```text
PERSONALIZATION_PROFILE_RESET
```

с sequence boundary.

После boundary новый профиль строится только из допустимых сигналов после reset, если игрок снова разрешил персонализацию.

Физическое хранение/удаление telemetry определяется отдельно юридической и privacy-архитектурой.

---

## 32. Encounter definitions

```json
{
  "id": "ENC_FOREST_03",
  "allowed_level_range": [25, 29],
  "max_occurrences": 1,

  "candidate_variants": [
    "ENC_FOREST_03_FOX",
    "ENC_FOREST_03_CAT",
    "ENC_FOREST_03_OWL",
    "ENC_FOREST_03_CAT_OWL"
  ],

  "fallback_variant": "ENC_FOREST_03_FALLBACK",

  "routing_contract_version": "forest-routing@1"
}
```

---

## 33. Encounter routing contract

Routing выполняется одинаково для Encounters 2–10.

### Шаг 1. Hard eligibility

Удаляются варианты, нарушающие канон.

Примеры:

```text
Fox variant
требует:
fox encounter допустим
+
есть честный вход через evidence/path/current scene

Companion synthesis
требует:
known
+
acquainted
+
understanding
+
reciprocity
+
cooperation
+
narrative compatibility
```

### Шаг 2. Required narrative stage

Проверяется, какую relational stage вариант способен реально продвинуть.

Вариант не выбирается только потому, что у него много numeric weights.

### Шаг 3. Evidence bundle

Для каждого кандидата собираются объяснимые factors:

```text
thread history
relationship milestones
recent meaningful decisions
relevant Cognition evidence
current chapter relevance
unresolved contradiction
temporary alliance history
knowledge state
```

### Шаг 4. Authored priority

Каждый EncounterDefinition задаёт ordered authored tie-break rules.

Движок не должен иметь глобальное правило:

```text
max(thread_score)
```

### Шаг 5. Deterministic tie-break

Если после authored rules два варианта всё ещё равноправны, используется заранее заданный deterministic content-order.

Не RNG.

Этот последний order существует только как техническая страховка и не должен регулярно решать содержательно важные выборы.

### Шаг 6. Fallback

Если ни один preferred variant не подходит:

```text
fallback_variant
```

обеспечивает обязательный narrative progress без фальсификации истории.

---

## 34. Explainable routing snapshot

При каждом encounter routing сохраняется diagnostic snapshot:

```json
{
  "routing_snapshot_id": "runtime-id",
  "encounter_id": "ENC_FOREST_03",

  "eligible_variants": [
    "ENC_FOREST_03_FOX",
    "ENC_FOREST_03_OWL"
  ],

  "selected_variant": "ENC_FOREST_03_FOX",

  "reasons": [
    "fox_identity_likely",
    "fox_thread_open",
    "recent_alternative_path_choice",
    "chapter_scene_supports_direct_meeting"
  ],

  "routing_contract_version": "forest-routing@1",
  "source_sequence": 418
}
```

Это internal QA/debug record.

Игроку скрытые weights не показываются.

---

## 35. Encounter 10 contract

### 35.1. Eligibility

Кандидат должен иметь:

```text
identity_known
acquainted
understanding_established
reciprocity_established
cooperation_established
narrative_compatibility = true
```

### 35.2. Ranking evidence

Учитываются:

```text
shared_history_depth
temporary_alliance_result
current_world_relevance
recent_relationship_momentum
unresolved_mutual_contradiction
```

### 35.3. Не используется

```text
random
highest_friendship
most_times_selected
paid status
rarity
```

### 35.4. Result transaction

Atomic transaction:

```text
FOREST_ENCOUNTER_10_COMPLETED
FOREST_RELATIONSHIP_SYNTHESIS_COMPLETED
FOREST_COMPANION_ACQUIRED
FOREST_THREAD_STATE_CHANGED
FOREST_KNOWLEDGE_PRESENTATION_CHANGED
```

После неё в Мире Леса:

```text
exactly_one_first_companion = true
```

---

## 36. Companion invariant

До завершения первого Мира Леса может быть обретён **ровно один** permanent mascot из:

```text
cat
owl
fox
```

Guard:

```text
if world_id == forest
and level <= 100
and existing_forest_first_companion != null
then reject second FOREST_COMPANION_ACQUIRED
```

Незавершённые отношения не обнуляются.

---

## 37. Elemental stage projection

```json
{
  "thread_id": "THREAD_FOREST_ELEMENTAL",
  "stage": "RESPONSE",

  "stage_history": [
    "TRACE",
    "INFLUENCE",
    "PATTERN",
    "RESPONSE"
  ],

  "supporting_event_ids": [],
  "source_sequence": 1022
}
```

Allowed semantic stages:

```text
TRACE
INFLUENCE
PATTERN
RESPONSE
PARTIAL_MANIFESTATION
FULL_MANIFESTATION
```

### Guard

`FULL_MANIFESTATION` требует:

```text
forest_synthesis_complete
+
first_companion_acquired
+
WE_FOREST_ELEMENTAL_FULL_MANIFESTATION_01 occurred
```

Не требует:

```text
all optional observations
all revisits
all ★★★
fox encountered
```

---

## 38. `WorldStateProjection`

```json
{
  "player_id": "...",
  "world_id": "forest",

  "campaign_phase": "chapter_7",

  "world_flags": {
    "forest_response_occurred": true,
    "forest_synthesis_complete": false,
    "forest_elemental_encountered": false
  },

  "area_states": {},
  "persistent_consequences": [],
  "expired_event_ids": [],

  "source_sequence": 1104,
  "projection_version": 1
}
```

---

## 39. World-state effects

World events меняют state через typed operations.

Минимальный набор:

```text
set_world_flag
set_area_state
add_persistent_consequence
expire_event
open_path
close_path
transform_path
set_environment_state
```

Нельзя разрешать arbitrary scripts, которые незаметно переписывают любые поля без audit trail.

---

## 40. Expired events

Одноразовый момент может быть утрачен.

Схема различает:

```text
event_existed
event_was_exposed
event_expired
residue_exists
```

Пример:

```json
{
  "event_definition_id": "WE_FOREST_FOX_TOUCH_01",
  "occurred": true,
  "exposed_to_player": false,
  "expired": true,
  "residue_world_fact_ids": [
    "WF_F04"
  ]
}
```

Поздний revisit не возвращает сам момент.

Он может показать его последствия.

---

## 41. `RevisitDefinition`

```json
{
  "id": "REV_FOREST_CLEARING_01",
  "area_id": "AREA_FOREST_CLEARING",

  "available_if": [
    "forest.chapter >= 2"
  ],

  "new_content_rules": [
    "reinterpret_old_tree_mark",
    "fox_trace_reanalysis"
  ],

  "does_not_rewrite_first_visit": true,

  "content_version": "forest_state_schema:0.04"
}
```

---

## 42. `RevisitProjection`

```json
{
  "area_id": "AREA_FOREST_CLEARING",

  "first_visit": {
    "first_sequence": 1,
    "choice_event_ids": [],
    "exposed_world_fact_ids": [
      "WF_F01",
      "WF_F02"
    ]
  },

  "revisit_count": 2,
  "last_revisit_sequence": 804,

  "new_observation_record_ids": [],
  "new_inference_event_ids": [],

  "paths": {
    "narrow_path": "persistent_changed"
  },

  "expired_event_ids": []
}
```

---

## 43. Revisit guard

При revisit запрещено:

```text
change historical selected_option
delete first_visit exposure
mark old event as newly happened
restore expired one-time scene
```

Разрешено:

```text
new observation from old exposed fact
new interpretation of known observation
new current world fact
current exploration of previously unchosen path
residue of expired event
```

---

## 44. Replay и revisit в данных

### Replay

Порождает gameplay/mastery events:

```text
LEVEL_REPLAY_STARTED
LEVEL_REPLAY_COMPLETED
STAR_RESULT_UPDATED
```

Не должен автоматически:

```text
re-run original authored choice
re-run one-time encounter
re-run first-visit world event
```

### Revisit

Порождает:

```text
FOREST_REVISIT_STARTED
FOREST_WORLD_FACT_EXPOSED
FOREST_OBSERVATION_CREATED / UPDATED
FOREST_INTERPRETATION_*
FOREST_REVISIT_COMPLETED
```

Это отдельный flow.

---

## 45. Level 98

Уровень 98 является authored meaningful revisit Поляны.

Он использует обычный revisit contract, а не специальное исключение из архитектуры.

Possible outcomes зависят от history:

```text
WF_F01 never noticed
→ первое observation

WF_F01 noticed
→ новая системная interpretation

Fox companion
→ личная relational reinterpretation раннего следа

Fox known non-companion
→ unresolved thread echo

Fox unknown
→ возможно более точный trace inference
```

Dormant Guardian не должен принудительно раскрываться.

---

## 46. Synthesis level 99

### 46.1. `SYN_FOREST_WORLD_01`

Authored definition:

```text
SYN_FOREST_WORLD_01
```

Detailed contract:

```text
WORLD_FOREST_SYNTHESIS_REGISTRY_v0.01
```

### 46.2. Required core prerequisites

Hard gates:

```text
levels 1–98 core progression complete
first_companion_acquired
mandatory companion reveal level 90 completed
```

Отдельный скрытый `knowledge_score` не используется.

Core concept experience гарантируется самой линейкой уровней `1–98`.

Не являются prerequisites:

```text
all observations
all reconstructions
all revisits
all ★★★
Fox known
high Cognition score
optional pending revelations completed
```

### 46.3. Attempt states

```text
NOT_STARTED
IN_PROGRESS
MODEL_SOLVED
REVELATION_READY
REVELATION_IN_PROGRESS
COMPLETED
```

Five authored phases:

```text
DISTINGUISH
MULTI_RELATION
DIRECTION
TIME
WHOLE
```

Phase states относятся только к конкретной попытке и не являются характеристикой личности игрока.

### 46.4. Phase completion

После каждой фазы:

```text
FOREST_SYNTHESIS_PHASE_COMPLETED
```

Crash/retry может восстановить последний committed checkpoint.

### 46.5. Model solved

После `WHOLE`:

```text
FOREST_SYNTHESIS_MODEL_SOLVED
FOREST_KNOWLEDGE_REVELATION_READY
```

При этом:

```text
forest_synthesis_complete = false
level 100 locked
```

Итоговый `KR_FOREST_WORLD_SYNTHESIS` ещё не обязан быть переведён в final presentation.

### 46.6. Player-initiated completion

Игрок сам выполняет:

```text
INTEGRATE_SYSTEM
```

player-facing copy:

```text
«Увидеть целое»
```

Atomic transaction:

```text
FOREST_KNOWLEDGE_REVELATION_STARTED
FOREST_SYNTHESIS_COMPLETED
FOREST_KNOWLEDGE_REVELATION_COMPLETED

set forest_synthesis_complete = true

create/update:
REC_FOREST_WORLD_SYNTHESIS_01
KR_FOREST_WORLD_SYNTHESIS

unlock level 100 encounter
```

`MODEL_SOLVED` без `INTEGRATE_SYSTEM` не считается завершённым Синтезом.

---

## 47. Level 100 transaction

### 47.1. Entry guard

```text
forest_synthesis_complete = true
first_companion_acquired = true
KR_FOREST_WORLD_SYNTHESIS revelation completed
```

### 47.2. Encounter truth

Во время level 100 объективно происходят:

```text
WE_FOREST_ELEMENTAL_FULL_MANIFESTATION_01
direct Encounter 11
```

Это создаёт direct confirmation встречи и:

```text
RECOGNIZE_ENTITY ready
```

но значимая player-facing карточка не должна молча morph-нуться в фоне.

### 47.3. Mandatory Elemental recognition

Игрок выполняет:

```text
RECOGNIZE_ENTITY
```

после чего одна idempotent transaction фиксирует:

```text
FOREST_KNOWLEDGE_REVELATION_STARTED
FOREST_ELEMENTAL_STAGE_CHANGED → FULL_MANIFESTATION
FOREST_ENCOUNTER_11_COMPLETED
FOREST_KNOWLEDGE_REVELATION_COMPLETED

forest_elemental_encountered = true
forest_world_complete = true
```

`KR_FOREST_MANIFESTATION_PARTIAL`, если он существует как root-history candidate, может преобразоваться в `KR_FOREST_ELEMENTAL_CHARACTER`; иначе создаётся новый character record.

### 47.4. `WF_F70`

После финальной встречи:

```text
WF_F70 exposed
```

может произойти как новый объективный bridge.

Но:

```text
knowledge «Неполный узор»
```

не создаётся автоматически, если игрок не выделил наблюдение.

World completion от этого не зависит.

Важно:

```text
forest_world_complete = true
```

не создаёт:

```text
forest_everything_known = true
```

Такого поля вообще не рекомендуется вводить.

---

## 48. Observation → Elemental linking

После Encounter 11 система может связать с Лесным элементалем только knowledge, имеющее authored causal/semantic basis.

Допустимые candidates:

```text
Согласованный Отклик
повтор распределённой сети
частичное проявление
конкретные system reactions
```

Запрещён bulk-operation:

```text
link all unresolved forest observations
to forest_elemental
```

Каждый link должен иметь:

```text
authoring relation
+
supporting event
```

---

## 49. Constellation fragment

Objective fact:

```text
WF_F70 constellation_fragment_01
```

Player knowledge:

```text
record_kind = cross_world_observation
presentation_group = observation
display_state_key = constellation.incomplete_pattern
subject_visibility = hidden
```

На уровне 100 не требуется раскрывать:

```text
Созвездие Познания
```

как термин.

Поздняя migration/knowledge progression меняет display-state, а не создаёт новый unrelated record.

---

## 50. Save snapshot

Для быстрого загрузочного snapshot рекомендуется хранить:

```json
{
  "player_id": "...",
  "world_id": "forest",

  "source_sequence": 1300,
  "projection_bundle_version": 1,

  "campaign": {},
  "world_state": {},
  "knowledge": {},
  "relationships": {},
  "threads": {},
  "cognition": {},
  "encounters": {},
  "revisit": {}
}
```

Snapshot не является source of truth.

При расхождении приоритет:

```text
semantic event history
+
content/migration rules
```

---

## 51. Crash recovery

### 51.1. Нельзя создавать Cognition из recovery

Events с origin:

```text
recovery
migration
repair
```

не участвуют в Cognition, если они не восстанавливают ранее подтверждённый authored event.

### 51.2. Atomic level completion

Narrative-critical level completion должен использовать server transaction.

Особенно:

```text
Encounter 8
Encounter 10
Level 99
Level 100
```

### 51.3. Retry

Client повторяет тот же:

```text
command_id
```

Сервер:

- возвращает уже committed transaction;
- либо завершает её один раз;
- не создаёт дублей.

---

## 52. State repair

Если обнаружен исторический баг:

```text
STATE_REPAIR
```

не должен тихо редактировать старые events.

Фиксируется:

```json
{
  "event_key": "FOREST_STATE_REPAIR_APPLIED",
  "payload": {
    "repair_id": "forest-repair-001",
    "reason": "duplicate_companion_projection",
    "affected_event_ids": []
  },
  "origin": "repair"
}
```

Repair может исправить projection или добавить компенсирующий event.

---

## 53. Versioning

Каждый authored definition имеет:

```text
valid_from_content_version
retired_in_content_version
```

Каждый player semantic event сохраняет `canon_version`.

Каждая projection сохраняет:

```text
projection_version
formula_version
source_sequence
```

---

## 54. Migration policy

### 54.1. Старые canonical events не переписываются

Нельзя менять:

```text
selected_option
old exposure
old encounter result
old companion acquisition
```

как будто история была другой.

### 54.2. Типы migration

```text
projection_only
content_alias
append_compensating_event
knowledge_reinterpretation
```

### 54.3. `projection_only`

Используется, когда:

```text
изменили формулу derived Cognition
```

История та же.

Перестраивается проекция.

### 54.4. `content_alias`

Если техническое имя нормализовано без изменения смысла:

```text
old_id → stable_id
```

хранится explicit alias.

### 54.5. `append_compensating_event`

Если старый bug создал ошибочное состояние:

```text
старый event сохраняется
+
добавляется repair/migration event
```

### 54.6. `knowledge_reinterpretation`

Если новое содержание меняет текущую интерпретацию:

```text
old observation остаётся
old interpretation остаётся в history
new interpretation становится current
```

Это идеально соответствует философии Познания.

---

## 55. Migration registry

```json
{
  "migration_id": "FOREST_MIGRATION_0001",
  "from_schema_version": "0.01",
  "to_schema_version": "0.02",

  "mode": "projection_only",

  "applies_if": [
    "source_sequence >= 0"
  ],

  "content_aliases": {},

  "created_at": "..."
}
```

Для каждого игрока фиксируется:

```text
FOREST_CONTENT_MIGRATION_APPLIED
```

с `migration_id`.

---

## 56. Authored choice IDs

P1 требует дать stable ID authored choices.

В v0.01 schema фиксируется формат:

```text
CHOICE_FOREST_L{LEVEL}_{SEMANTIC_NAME}
```

Примеры из уже определённого blueprint:

```text
CHOICE_FOREST_L05_ATTENTION
CHOICE_FOREST_L08_PERSPECTIVE
CHOICE_FOREST_L10_ROUTING
CHOICE_FOREST_L12_FOREGROUND
CHOICE_FOREST_L15_METHOD
```

Option IDs:

```text
old_tree_mark
damaged_sapling
bent_grass
flower_pattern
```

Display text не используется как ID.

Полный choice registry `1–100` создаётся отдельным content pass, чтобы schema не выдумывала отсутствующие authored choices.

---

## 57. Encounter variant IDs

Формат:

```text
ENC_FOREST_{NN}_{VARIANT}
```

Например:

```text
ENC_FOREST_02_CAT
ENC_FOREST_02_OWL
ENC_FOREST_02_CAT_OWL

ENC_FOREST_03_FOX
ENC_FOREST_03_CAT
ENC_FOREST_03_OWL
ENC_FOREST_03_CAT_OWL

ENC_FOREST_08_CAT
ENC_FOREST_08_OWL
ENC_FOREST_08_FOX

ENC_FOREST_10_CAT
ENC_FOREST_10_OWL
ENC_FOREST_10_FOX

ENC_FOREST_11_ELEMENTAL
```

Вариант получает stable ID только когда его authored content действительно существует.

---

## 58. Observation presentation definitions

Knowledge labels не хранятся в save как единственный смысл.

Используется:

```text
display_state_key
```

с локализацией отдельно.

Пример Fox:

```text
fox.trace.unknown
fox.trace.small_creature
fox.trace.fox_like
fox.trace.young_fox
character.fox
companion.fox
```

Пример Elemental:

```text
forest.pattern.repeating
forest.response.coordinated
forest.manifestation.partial
character.forest_elemental
```

Пример Constellation:

```text
constellation.incomplete_pattern
```

---

## 59. Player-facing knowledge minimization

Backend schema может хранить:

- скрытый subject_ref;
- future relation;
- authored source;
- inference support;
- thread links.

Frontend получает только разрешённую `KnowledgeView`.

```json
{
  "knowledge_record_id": "...",
  "presentation_group": "observation",
  "title_key": "fox.trace.small_creature",
  "confidence": "LIKELY",
  "history_entries": []
}
```

Нельзя отправлять клиенту future identity только с CSS `display:none`, если это создаёт риск утечки/спойлера.

---

## 60. Privacy / optional personalization boundary

Core narrative history и optional behavioral personalization должны быть технически различимы.

### Core

Нужно для:

- прогресса;
- честной истории;
- knowledge;
- relationships;
- encounters;
- save recovery.

### Optional personalization

Например часть:

- detailed timing;
- session rhythm;
- meta navigation;
- cosmetic preference;
- social preference.

У события/сигнала должен существовать:

```text
consent_scope
profile_eligible
retention_class
```

Точная privacy policy и сроки хранения определяются отдельно.

---

## 61. Invariants как database/application guards

Обязательные guards:

1. `Observation` не создаётся без доступного evidence/revelation.
2. `exposed` не выставляет автоматически `noticed`.
3. `confirmed` не выставляется без подтверждающего event/evidence.
4. `reconstruction revision` не удаляет предыдущую revision.
5. `character identification` не удаляет раннюю observation history.
6. `temporary alliance` не выставляет `companion`.
7. `companion` до уровня 100 в Forest может быть только один.
8. `companion` требует Relationship Synthesis.
9. `Encounter 11` требует Forest Synthesis и первого спутника.
10. `Forest Synthesis` не требует optional completion.
11. `revisit` не меняет first choice.
12. `expired event` не проигрывается повторно как исходный момент.
13. `crash/retry` не создаёт duplicate semantic event.
14. `repair/migration` не создаёт Cognition signal.
15. dormant future thread не становится character identity без отдельного authored reveal.
16. Elemental reveal не привязывает к себе все unresolved observations.
17. hidden subject identity не попадает в player-facing payload.
18. reset personalization не удаляет core narrative progress.

---

## 62. QA fixture A — Лис не замечен

```text
L3
WF_F04 exposed
noticed = false

L12
WF_F07 exists
player does not inspect it

L23
WF_F66 exposed
noticed = false

L28
Fox Encounter unavailable

L35–39
direct Fox encounter becomes valid authored entrance

→ create character history directly
→ no false claim:
«ты давно знал, что это был Лис»
```

Expected:

```text
early exposure remains provenance
but no retroactive noticed state
```

---

## 63. QA fixture B — Лис выведен до встречи

```text
WF_F04 noticed
WF_F07 noticed
WF_F10 noticed
WF_F66 noticed

↓

interpretations connected

↓

confidence:
LIKELY
→ INFERRED

↓

Encounter 3 Fox

↓

CONFIRMED
presentation_group:
observation → character
```

Expected:

```text
single root history
+
all source evidence preserved
```

---

## 64. QA fixture C — revisit старой тропы

```text
first visit:
path B not chosen

history:
selected A remains permanent

later:
REVISIT AREA

path B:
still exists
but state changed
```

Expected:

```text
new present exploration
≠
retroactive alternate past
```

---

## 65. QA fixture D — level 90 retry

Первый request:

```text
complete level 90
```

Server commits transaction:

```text
Encounter 10
Relationship Synthesis
Companion acquired
Level completed
```

Client не получает response из-за disconnect.

Client retry с тем же `command_id`.

Expected:

```text
same committed result returned
no second companion
no duplicate relationship event
no duplicate knowledge card
```

---

## 66. QA fixture E — migration derived Cognition

В `0.01`:

```text
analysis formula A
```

В будущем:

```text
analysis formula B
```

Migration:

```text
old choices/events preserved
new projection rebuilt
```

Expected:

```text
никакое прошлое решение не переписано
```

---

## 67. QA fixture F — Elemental reveal

До level 100:

```text
«Согласованный Отклик»
«Повторяющийся узор»
«Частичное проявление»
+
unresolved fox/guardian/other observations
```

После Encounter 11:

Связываются только authored element-thread records.

Expected:

```text
guardian clues remain unresolved
fox clues remain fox-related
unexplained facts remain unexplained
```

---

## 68. Что v0.01 теперь закрывает из P0 State Map

Закрыто:

```text
stable ID policy
missing persistent fact IDs
KnowledgeRecord logical schema
observation linking / non-destructive merge
semantic event envelope
idempotency contract
relationship representation
primary vs derived Cognition persistence rule
Encounter routing contract
world-state / expired-event persistence
migration policy
crash/retry invariants
```

Таким образом `WORLD_FOREST_STATE_MAP_v0.03` и эта schema вместе достаточны, чтобы начать проектировать реальный narrative engine.

---

## 69. Статус content-layer после schema v0.05

Пункты, которые ранняя schema помечала как P1, теперь архитектурно закрыты связанными registries:

```text
Choice / Content identity
→ WORLD_FOREST_CONTENT_REGISTRY_v0.08

Encounter variants / routing
→ WORLD_FOREST_ENCOUNTER_REGISTRY_v0.04

Knowledge / Reconstruction
→ WORLD_FOREST_KNOWLEDGE_REGISTRY_v0.05

Meaningful revisit
→ WORLD_FOREST_REVISIT_REGISTRY_v0.03

Level-99 Synthesis
→ WORLD_FOREST_SYNTHESIS_REGISTRY_v0.03

Machine export
→ WORLD_FOREST_MACHINE_PACKAGE_SPEC_v0.03
```

Открыты не базовые state-модели, а authored/implementation detail: numeric tuning, final scripts/copy, exact runtime rules для части revisit prose, Elemental dossier и миграция существующих аккаунтов.

---

## 70. Следующий технический этап

Следующий этап после этой schema — **implementation architecture audit существующего кода и migration plan**.

Нужно сопоставить:

```text
current level/content storage
current player progress
backend source of truth
local/offline recovery
existing mascot state
existing IDs

↕

semantic events
projections
content loader
knowledge records
encounter routing
revisit state
synthesis state
```

Новый abstract state-manifest перед этим не требуется.
