# WORLD FOREST STATE MAP — Мир Леса

> **Статус:** рабочая production state map  
> **Версия:** 0.03  
> **World ID:** `forest`  
> **Охват:** уровни `1–100`, первый проход, meaningful revisit, post-world revisit  
> **Источник канона:** `WORLD_FOREST_LEVEL_BLUEPRINT_v0.13`, `WORLD_FOREST_DOSSIER_v0.18`, `WORLD_CAMPAIGN_MANIFEST_v0.21`, `GAME_VISION_MANIFEST_v0.12`, `CHARACTER_WORLD_MANIFEST_v0.15`, `WORLD_FOREST_STATE_SCHEMA_v0.05`, `WORLD_FOREST_CONTENT_REGISTRY_v0.08`  
> **Назначение:** свести содержательную архитектуру Мира Леса в единую модель состояний, достаточную для последующего проектирования БД, narrative engine, save-state, migrations и QA.

---

## 1. Статус документа

Этот документ **не создаёт новый сюжетный канон**.

Он нормализует уже зафиксированные правила Мира Леса в production-слои:

```text
ОБЪЕКТИВНЫЙ МИР
что реально существует / произошло

↓

ЭКСПОЗИЦИЯ
с чем конкретная душа реально соприкоснулась

↓

ЗНАНИЕ ДУШИ
что она заметила, интерпретировала,
связала и реконструировала

↓

СЮЖЕТНЫЕ НИТИ
какие отношения / тайны / сущности
могут содержательно продвинуться

↓

ENCOUNTER ROUTING
какая встреча уместна сейчас

↓

REVISIT
что можно увидеть иначе,
не переписывая прошлое
```

Там, где исходные документы ещё не утверждают точный технический ID, threshold или schema, используется маркировка:

```text
LEGACY_TBD_ID_MARKER
TBD_THRESHOLD
TBD_SCHEMA
```

Такие места нельзя незаметно превращать в production-константы.

---

## 2. Верхний инвариант

Главная production-ошибка, которую должна предотвращать эта карта:

```text
WORLD FACT
=
PLAYER KNOWLEDGE
```

Это неверно.

Каноническое разделение:

```text
WORLD FACT
что объективно существует

OBSERVATION
что душа осмысленно заметила

INTERPRETATION
что душа из этого вывела

RECONSTRUCTION
какую историю она построила
из нескольких наблюдений

CONFIRMATION / REVISION
что позднее подтвердилось
или было пересмотрено
```

Поэтому один и тот же Лес способен быть объективно одинаковым в конкретной сцене, но давать разным игрокам разную глубину знания.

---

## 3. Семь production-слоёв состояния

### 3.1. `WorldState`

Объективное текущее состояние области.

Содержит:

```text
world_id
area_id
campaign_phase
world_fact definitions / current states
completed world events
persistent consequences
changed routes
expired events
active environmental conditions
content_version
```

`WorldState` не должен зависеть от того, заметил ли игрок конкретный факт.

---

### 3.2. `ExposureState`

Факт реального контакта души с содержанием.

Минимальный смысл:

```text
world_fact_id
scene_id
exposed
first_exposed_at
last_exposed_at
exposure_context
```

Критический инвариант:

> **`exposed = true` не означает `noticed = true`.**

Именно этот слой делает честным поздний эффект:

> «Это было перед тобой раньше, но тогда ты ещё не понимал, на что смотришь».

---

### 3.3. `KnowledgeState`

То, что уже стало частью знания конкретной души.

В текущем каноне встречаются состояния:

```text
exposed
noticed
interpreted
connected
confirmed
```

Для production рекомендуется **не хранить их одной плоской enum-лестницей**.

Причина: они описывают разные вещи.

Рекомендуемое смысловое разделение:

```text
EXPOSURE
exposed / not exposed

OBSERVATION
noticed / not noticed

INTERPRETATION
0..N интерпретаций

CONNECTION
связи между observation / knowledge-record

CONFIDENCE
SUSPECTED
LIKELY
INFERRED
CONFIRMED
```

Это production-нормализация текущего канона, а не изменение его смысла.

---

### 3.4. `KnowledgeRecord`

Player-facing история знания.

Базовый принцип:

```text
knowledge_record_id = stable
```

и:

```text
presentation_group:
observation
→ character
→ companion
```

При раскрытии сущности не создаётся новая независимая копия истории.

Пример:

```text
«Следы у края Леса»
↓
«Похоже, молодой лис»
↓
«Лис»
↓
«Лис / Спутник»
```

Ранние:

- evidence;
- догадки;
- ошибки;
- встречи;
- подтверждения;

остаются provenance той же истории.

Точная UX-механика объединения нескольких observation-record остаётся `TBD_SCHEMA` и относится также к будущему `UX_LANGUAGE_MANIFEST`.

---

### 3.5. `ReconstructionState`

Реконструкция хранит **не факт прошлого**, а текущую модель души.

Концептуальные поля из кампанийного канона:

```text
reconstruction_id
source_observation_ids
current_interpretation
confidence
supporting_evidence
contradicting_evidence
revision_history
confirmation_state
```

Дополнительные разновидности, уже фактически используемые Миром Леса:

```text
event reconstruction
network reconstruction
cycle reconstruction
process history
```

Они являются разными масштабами одного принципа, а не обязательно четырьмя отдельными backend-таблицами.

---

### 3.6. `NarrativeThreadState`

В первом мире существуют:

```text
ACTIVE MASCOT THREADS
cat
owl
fox

ELEMENTAL THREAD
forest_elemental

DORMANT FUTURE THREADS
пример: future_guardian
```

Маскотная нить хранит отдельно:

```text
known / acquaintance state
thread weight / readiness evidence
understanding
reciprocity
cooperation
shared_history
borrowed_perspective_familiarity
temporary_alliance_history
relationship_contradictions
encounter_history
companion_state
```

`thread weight` не заменяет историю отношений.

---

### 3.7. `RevisitState`

Для meaningful revisit область может хранить:

```text
first_visit_world_facts
first_visit_choices

revisit_conditions
revisit_world_state
new_observations
new_inferences
expired_events
persistent_paths
```

Возвращение:

```text
НЕ изменяет
первоначальный выбор

НЕ откатывает
мир назад

НЕ требует
replay уровня

МОЖЕТ
дать новое знание
о старом или изменившемся мире
```

---

## 4. Источник истины

Для долгой кампании нельзя хранить только итоговые агрегаты вида:

```text
memory = 17
fox_thread = 9
```

Источник истины должен сохранять семантические события.

Минимальный смысл события:

```text
event_id
event_type
world_id
chapter_id
level_id
scene_id
choice_id / action_id
selected_option
semantic_tags
weights
affected_threads
relationship_effects
knowledge_effects
world_effects
canon_version
timestamp
```

Техническая schema остаётся `TBD_SCHEMA`, но принцип event history обязателен.

Это нужно для:

- новых derived Cognition indicators;
- пересчёта после изменения формул;
- narrative debugging;
- объяснения encounter routing;
- миграций;
- восстановления после багов;
- поздних reinterpretation старого контента.

---

## 5. State domains, которые нельзя смешивать

| Домен | Что отвечает | Что НЕ должен хранить |
|---|---|---|
| `WorldFact` | что объективно существует | «заметил ли игрок» |
| `Exposure` | был ли факт реально показан игроку | интерпретацию |
| `Observation` | что игрок смыслово выделил | объективную истину о причине |
| `Interpretation` | что observation может означать | переписанный world fact |
| `Reconstruction` | модель события/сети/цикла | «как всё было на самом деле» без подтверждения |
| `Thread` | состояние сюжетной линии | универсальный affinity-score |
| `Relationship` | understanding / reciprocity / cooperation / shared history | владение персонажем до добровольного спутничества |
| `Encounter` | произошедший значимый narrative-node | фоновые следы и короткие echoes |
| `Revisit` | новое настоящее посещение старого места | альтернативную версию прошлого |
| `Cognition` | устойчивые способы Познания | IQ, мораль или ценность игрока |

---

## 6. Полная карта chapter checkpoints

| Checkpoint | Система уже должна уметь хранить |
|---|---|
| **10** | добровольная перспектива; первый routing-choice; exposure/noticing ранних world-fact; ранний Cat/Owl state; первый Fox evidence; meaningful revisit Поляны |
| **20** | focus-layer; Encounter 2; `understanding / reciprocity`; analysis/pattern evidence; Fox hypothesis confidence; Fox touch; новые revisit-reasons |
| **30** | Encounter 3; факт знакомства с Лисом или его отсутствие; способ узнавания Лиса; borrowed Fox perspective; evidence-bundle behavior; revisited early facts |
| **40** | Encounter 4; reciprocal beat; causal/behavioral inference; pathfinding evidence; факт/объяснение разделены |
| **50** | Encounter 5; несколько систем вокруг одного объекта; relative roles; systems thinking; cross-context integration; pattern card / small network |
| **60** | Encounter 6; indirect evidence; hidden-structure/network reasoning; prediction; первый Forest Response; dormant facts |
| **70** | Encounter 7; observation ≠ reconstruction; temporal evidence; justified absence; reconstruction revision; readiness к временному союзу |
| **80** | Encounter 8; `temporary_ally`; cooperation; directional/mediated relations; dynamic balance; first network reconstruction |
| **90** | Encounter 9 + Encounter 10; first companion; relationship synthesis; cycle reconstruction; mature unfinished threads |
| **100** | Forest Synthesis; Encounter 11; Forest Elemental known; world complete but not exhausted; post-world revisit; incomplete constellation-pattern observation |

---

## 7. Encounter state machine

### 7.1. Бюджет

```text
Encounter 1   level 1
Encounter 2   levels 16–19
Encounter 3   levels 25–29
Encounter 4   levels 35–39
Encounter 5   levels 45–49
Encounter 6   levels 55–59
Encounter 7   levels 65–69
Encounter 8   levels 76–79
Encounter 9   levels 84–87
Encounter 10  level 90
Encounter 11  level 100
```

Базовый маршрут:

```text
11 encounter-node
```

Допустимо:

```text
+1 / +2 adaptive encounter
```

только если конкретной relationship-арке реально не хватает содержательной стадии.

Жёсткий cap:

```text
11–13
```

---

### 7.2. Routing Encounters 2–7

| Encounter | Основные кандидаты | Главный gate |
|---|---|---|
| **2** | Кот / Сова / редкая совместная | ранний thread readiness; memory/depth vs observation/verification; Лис ещё обычно не полноценная встреча |
| **3** | Лис / Кот / Сова / редкая Cat+Owl | первое сильное расхождение историй; Fox может войти через evidence, discovery/path или аналитическое доказательство |
| **4** | Лис / Кот / Сова / совместная | поведение и среда; состояние уже знакомого или ещё не открытого Лиса |
| **5** | Сова / Кот / Лис / совместная | способность видеть один объект в нескольких системах; никакого автоматического Owl encounter только из-за темы птиц |
| **6** | Сова / Кот / Лис / совместная | способность работать с косвенным evidence и скрытой системой |
| **7** | Кот / Сова / Лис / особенно уместная Cat+Owl | observation vs reconstruction, temporal evidence, противоречащие следы, зрелость reciprocity |

Routing не использует RNG.

---

### 7.3. Encounter 8 — временный союз

Story-scoped смысловое состояние:

```text
temporary_ally = mascot_id
scope = forest_chapter_8_encounter
```

После завершения:

```text
temporary_ally = false

relationship:
cooperation ↑
reciprocity ↑
shared_history += event
```

Это **не** permanent companion.

---

### 7.4. Encounter 9 — перенос совместного метода

Encounter 9 обычно продолжает нить временного союзника, если именно она осталась наиболее зрелой.

Но это не hard-lock.

Цель:

```text
совместный метод сработал в главе 8
↓
новая структура задачи
↓
работает ли он вне исходного контекста?
```

---

### 7.5. Encounter 10 — Relationship Synthesis

Eligibility:

```text
known character
+
required relationship stages
+
sufficient understanding
+
reciprocity
+
cooperation
+
narrative compatibility
```

Затем учитываются:

```text
shared_history_depth
temporary_alliance_result
current_world_relevance
recent_relationship_momentum
```

Если кандидаты близки, используется authored tie-break.

Запрещено:

```text
random()
```

и недостаточно:

```text
max(hidden_score)
```

Результат:

```text
first_companion_id = mascot_id
character → companion
relationship_synthesis_event = recorded
```

Остальные зрелые нити сохраняются.

---

### 7.6. Encounter 11 — Лесной элементаль

Перед ним должны существовать:

```text
forest_synthesis_complete
first_companion_acquired
elemental_thread history
```

Но Encounter 11 не требует:

```text
all_optional_observations
all_revisits
all_★★★
Fox encountered
```

Полное проявление означает взаимную различимость, а не spawn-награду за правильный ответ.

---

## 8. Маскотные thread states

### 8.1. Общая модель

Не фиксируем универсальную линейную enum вида:

```text
UNSEEN → 1 → 2 → 3 → COMPANION
```

Порядок встречи и спутничества нелинеен.

Но production должен различать минимум следующие независимые факты:

```text
identity_known
acquainted
borrowed_perspective_seen
borrowed_perspective_used
understanding
reciprocity
cooperation
temporary_alliance_completed
relationship_synthesis_completed
companion
encounter_history[]
shared_history[]
unresolved_questions[]
```

---

### 8.2. Кот

Старт:

```text
level 1:
identity_known = true
acquainted = true
```

Основная relational contradiction:

> прошлый опыт помогает видеть причины, но знакомая история не обязана повторяться буквально.

Thread никогда не должен сводиться к:

```text
memory score → Cat companion
```

---

### 8.3. Сова

Старт:

```text
level 1:
identity_known = true
acquainted = true
```

Основная relational contradiction:

> точность наблюдения не гарантирует целостности модели, особенно когда причина не видна напрямую.

Thread никогда не должен сводиться к:

```text
observation score → Owl companion
```

---

### 8.4. Лис

Старт может быть любым из:

```text
no knowledge
trace
touch
self-inference
direct encounter
acquaintance
```

Важное разделение:

```text
fox_identity_confidence
≠
fox_relationship_maturity
```

Можно очень рано понять:

> «похоже, это лисёнок»

и всё ещё почти не знать самого Лиса как личность.

---

## 9. Fox knowledge state

### 9.1. Evidence sources

Основные explicit world-fact:

```text
WF_F04 small_track_partial_01
WF_F07 low_bark_mark_01
WF_F10 fur_on_low_branch_01
WF_F13 narrow_gap_route_01
WF_F14 fox_scale_context_01
WF_F15 repeated_small_route_01
```

Дополнительно blueprint содержит как минимум один **объективный Fox-evidence без стабильного WF-ID**:

```text
LEGACY_TBD_ID_MARKER
уровень 23
более полный отпечаток в мягкой почве
```

До реализации этому факту нужен стабильный ID, если он должен участвовать в долгой evidence-chain / revisit / migration.

### 9.2. Knowledge confidence

```text
SUSPECTED
↓
LIKELY
↓
INFERRED
↓
CONFIRMED
```

Пример player-facing эволюции:

```text
«Здесь кто-то проходил»
↓
«Следы небольшого зверя»
↓
«Форма похожа на лисью»
↓
«Похоже, это лисёнок»
↓
«Лис»
```

### 9.3. Identity confirmation не создаёт новую историю

После фактической встречи:

```text
old observation records
+
old hypotheses
+
encounter
↓
same knowledge history
```

---

## 10. Elemental thread state

Элементальный слой использует отдельную шкалу:

```text
TRACE
↓
INFLUENCE
↓
PATTERN
↓
RESPONSE
↓
PARTIAL_MANIFESTATION
↓
FULL_MANIFESTATION
```

Смысл стадий:

| State | Содержание |
|---|---|
| `TRACE` | ветви / корни / жилки / тропы и другие распределённые рифмы |
| `INFLUENCE` | странности существуют в нескольких частях Леса |
| `PATTERN` | изменения начинают согласованно рифмоваться |
| `RESPONSE` | Лес реагирует как единая среда; первый сильный production-момент — глава 6 / уровень 60 |
| `PARTIAL_MANIFESTATION` | глава 9: несколько циклов на мгновение складываются в один природный узор; без имени и диалога |
| `FULL_MANIFESTATION` | уровень 100 после Forest Synthesis |

Критический инвариант:

```text
forest_elemental
НЕ является
причиной всех связей Леса
```

И:

```text
elemental confirmation
НЕ присваивает
все unresolved observations
```

---

## 11. Dormant future thread

Рабочий пример:

```text
future_guardian
```

Его правила:

```text
не active mascot thread первых 100 уровней
не расходует encounter-budget
не конкурирует за first companion
не обязан иметь character-card
не обязан быть замечен
может раскрыться через миры / Круги / поздний revisit
```

В blueprint существуют рабочие stable-ID placeholders:

```text
WF_FUTURE_GUARDIAN_01
WF_FUTURE_GUARDIAN_02
WF_FUTURE_GUARDIAN_03
WF_FUTURE_GUARDIAN_04
```

Статус:

- `01–02` — ID-примеры; конкретное содержимое в текущем blueprint не закреплено однозначно;
- `03` — production-пример: скрытая грибная сеть необычно резко обрывается вдоль широкой границы;
- `04` — production-пример: очень старый широкий след давления на почву и корни, перекрытый более молодыми маршрутами.

Пока Character Dossier Медведя не утверждён, эти записи нельзя считать утверждённой identity Медведя.

---

## 12. Explicit world-fact registry

В текущем blueprint существует непрерывный explicit registry `WF_F01–WF_F65`.

| World fact | Slug | Первое появление | Глава | Содержательный факт |
|---|---|---:|---|---|
| `WF_F01` | `clearing_flower_pattern_01` | 1 | Поляна | необычно чёткая геометрия нескольких цветов |
| `WF_F02` | `root_branch_rhyme_01` | 1 | Поляна | визуальная рифма ветвей и корней |
| `WF_F03` | `old_tree_mark_01` | 2 | Поляна | старая отметина / повреждение на дереве |
| `WF_F04` | `small_track_partial_01` | 3 | Поляна | неполный след небольшого зверя |
| `WF_F05` | `bent_grass_line_01` | 4 | Поляна | узкая примятая линия травы к краю Поляны |
| `WF_F06` | `root_interlock_01` | 11 | Деревья | корни двух соседних деревьев визуально сходятся под землёй; пока это природная деталь. |
| `WF_F07` | `low_bark_mark_01` | 12 | Деревья | Возможен низкая свежая отметина на коре рядом с узким проходом. |
| `WF_F08` | `old_new_damage_pair_01` | 13 | Деревья | старый заросший рубец и свежая царапина существуют рядом. |
| `WF_F09` | `sapling_light_bend_01` | 14 | Деревья | несколько молодых деревьев изгибаются к одному световому окну. |
| `WF_F10` | `fur_on_low_branch_01` | 15 | Деревья | Для FOCUS_NARROW_PATH может появиться маленький рыжеватый волос/клочок шерсти на низкой ветке. Не маркируется как «лисий». |
| `WF_F11` | `similar_leaf_pair_01` | 21 | Растения | два очень похожих растения растут рядом, но имеют едва заметно разную структуру листа. |
| `WF_F12` | `stem_difference_01` | 22 | Растения | у похожих растений различается строение стебля. |
| `WF_F13` | `narrow_gap_route_01` | 24 | Растения | между растениями существует проход, слишком узкий и непопулярный для обычной тропы. |
| `WF_F14` | `fox_scale_context_01` | 26 | Растения | Возможен масштаб следа становится сравним с известным объектом и даёт основание судить о размере зверя. |
| `WF_F15` | `repeated_small_route_01` | 29 | Растения | несколько ранее разрозненных лисьих evidence складываются в устойчивый маршрут для тех, кто их notice/connected. |
| `WF_F16` | `feeding_trace_01` | 31 | Звери | остатки пищи в месте, где самого зверя нет. |
| `WF_F17` | `shelter_variants_01` | 32 | Звери | два разных типа укрытия выполняют близкую функцию. |
| `WF_F18` | `crossed_tracks_01` | 33 | Звери | несколько следов пересекаются, но принадлежат разным действиям/существам. |
| `WF_F19` | `environment_affordance_01` | 35 | Звери | один и тот же зверь меняет маршрут из-за структуры среды. |
| `WF_F20` | `interrupted_route_01` | 37 | Звери | привычный маршрут внезапно меняется из-за внешнего фактора. |
| `WF_F21` | `repeated_perch_01` | 41 | Птицы | одна и та же точка на дереве используется птицами неоднократно. |
| `WF_F22` | `wind_route_01` | 42 | Птицы | движение птиц повторяет устойчивый воздушный коридор. |
| `WF_F23` | `carried_seed_01` | 43 | Птицы | семя оказывается далеко от исходного растения. |
| `WF_F24` | `multi_system_bird_01` | 45 | Птицы | одна птица появляется в нескольких уже известных контекстах. |
| `WF_F25` | `predator_prey_role_shift_01` | 46 | Птицы | одна сущность занимает разные роли относительно разных соседей. |
| `WF_F26` | `route_connects_sites_01` | 47 | Птицы | повторяющийся перелёт объединяет воду, дерево и пищевой участок. |
| `WF_F27` | `displaced_route_01` | 48 | Птицы | птицы меняют привычное направление после изменения среды. |
| `WF_F28` | `fruiting_cluster_01` | 51 | Грибы | удалённые грибы появляются в подозрительно согласованном состоянии. |
| `WF_F29` | `synchronized_change_01` | 52 | Грибы | . |
| `WF_F30` | `hidden_connection_gap_01` | 53 | Грибы | отсутствие видимого пути само становится значимым фактом. |
| `WF_F31` | `soil_moisture_pattern_01` | 54 | Грибы | ; распределение влаги рифмуется с грибами. |
| `WF_F32` | `multi_manifestation_01` | 55 | Грибы | . |
| `WF_F33` | `underground_route_mismatch_01` | 57 | Грибы | . |
| `WF_F34` | `propagated_effect_01` | 58 | Грибы | . |
| `WF_F35` | `fresh_track_cluster_01` | 61 | Следы | несколько свежих следов без видимого источника. |
| `WF_F36` | `trace_age_pair_01` | 62 | Следы | два сходных следа разной давности. |
| `WF_F37` | `multi_trace_event_01` | 63 | Следы | . Здесь же может существовать очень слабый dormant Guardian-fact. |
| `WF_F38` | `ambiguous_broken_branch_01` | 64 | Следы | . |
| `WF_F39` | `missing_expected_trace_01` | 65 | Следы | привычная линия следов внезапно прекращается. |
| `WF_F40` | `trace_overlap_sequence_01` | 66 | Следы | . |
| `WF_F41` | `contradiction_trace_01` | 67 | Следы | . |
| `WF_F42` | `overlapping_histories_01` | 68 | Следы | . |
| `WF_F43` | `incomplete_event_record_01` | 69 | Следы | . |
| `WF_F44` | `shared_space_01` | 71 | Соседство | один участок несёт следы нескольких независимых потребностей. |
| `WF_F45` | `directional_relation_01` | 72 | Соседство | . |
| `WF_F46` | `mediated_relation_01` | 73 | Соседство | влияние существует через изменённую среду. |
| `WF_F47` | `shared_resource_pressure_01` | 74 | Соседство | . |
| `WF_F48` | `indirect_path_effect_01` | 75 | Соседство | . |
| `WF_F49` | `asymmetric_outcome_01` | 77 | Соседство | . |
| `WF_F50` | `third_party_shift_01` | 78 | Соседство | . |
| `WF_F51` | `dynamic_balance_01` | 79 | Соседство | . |
| `WF_F52` | `process_residue_01` | 81 | Круговорот | остаток оказывается не мусором, а потенциальным условием следующего процесса. |
| `WF_F53` | `decomposition_transition_01` | 82 | Круговорот | . |
| `WF_F54` | `output_as_input_01` | 83 | Круговорот | . |
| `WF_F55` | `first_closed_loop_01` | 84 | Круговорот | . |
| `WF_F56` | `multiple_cycle_entry_01` | 85 | Круговорот | . |
| `WF_F57` | `cycle_disruption_01` | 86 | Круговорот | . |
| `WF_F58` | `alternate_cycle_path_01` | 87 | Круговорот | . |
| `WF_F59` | `interlocked_cycles_01` | 88 | Круговорот | . |
| `WF_F60` | `relationship_synthesis_prelude_01` | 89 | Круговорот | . |
| `WF_F61` | `lingering_influence_01` | 93 | Лес | последствие пересекает границы нескольких прежних глав. |
| `WF_F62` | `local_global_conflict_01` | 94 | Лес | . |
| `WF_F63` | `influence_boundary_01` | 95 | Лес | . |
| `WF_F64` | `distributed_system_01` | 96 | Лес | система сохраняет целостность без управляющего центра. |
| `WF_F65` | `cross_scale_pattern_01` | 97 | Лес | . Старые observation «Повторяющийся узор» получают зрелый контекст. |

---

## 13. Objective facts/events без стабильного `WF_Fxx`

Blueprint содержит содержательные объективные элементы, которые **не имеют отдельного стабильного `WF_Fxx`**.

До реализации нужно решить: являются ли они самостоятельными persistent facts, event-effects или только presentation.

| Уровень | Содержание | Рекомендуемый production-статус |
|---:|---|---|
| **23** | более полный маленький отпечаток рядом с растениями | `WF_F66` — `full_small_track_01` |
| **28** | жилки листьев рифмуются с ветвями и корнями | вероятно отдельный pattern exposure или связь с существующим motif-record; `TBD_SCHEMA` |
| **34** | содранная кора / разрытая земля / сломанная ветка с несколькими candidate causes | `WF_F67` / `WF_F68` / `WF_F69` — три независимых persistent trace-fact |
| **40** | действия нескольких зверей совместно изменили участок среды | лучше как world-event + persistent consequence; конкретные ID `TBD` |
| **50** | усиленный визуальный motif ветвей / жилок / маршрутов / корней | motif exposure; решить, является ли новым fact или новым exposure существующего pattern |
| **60** | первый согласованный Отклик Леса | отдельный world-event обязателен; knowledge-card появляется не у всех |
| **70** | место хранит последствия нескольких старых событий | вероятнее reconstruction input / world-state snapshot, а не один новый fact |
| **76–79** | временный союз и его совместные действия | relationship/world events, не latent world-fact |
| **80** | первая `network reconstruction` | knowledge record, не objective world fact |
| **90** | Relationship Synthesis и обретение первого спутника | narrative/relationship event |
| **99** | итоговая системная модель Синтеза | knowledge/synthesis record |
| **100** | полное проявление элементаля + новый неполный узор за пределами Леса | минимум два события; для неполного узора существует рабочее backend-имя `constellation_fragment_01`, окончательная schema `TBD` |

Это один из главных результатов state-map: **перед кодом нужно закрыть ID-дыру между содержательным blueprint и долговременным сохранением состояния.**

---

## 14. Revisit state map

### 14.1. Три разных случая

```text
A. existed_before + exposed + not noticed
→ позднее первое observation

B. noticed_before + incomplete interpretation
→ новая interpretation / connection

C. did_not_exist_before
→ реально новый world fact после изменения мира
```

Нельзя смешивать `C` с ретроспективным «это всегда было здесь».

---

### 14.2. Основные revisit milestones

| После | Что старый Лес теперь позволяет |
|---|---|
| **13–17** | различать старые и свежие повреждения; переоценивать ранние следы Поляны |
| **20–30** | связывать Fox evidence; получить self-inference; пройти ранее не выбранную тропу в её текущем состоянии |
| **40** | читать след через потребность / действие / среду |
| **50** | видеть один объект как узел нескольких систем |
| **60** | переосмысливать распределённые ранние мотивы как возможную скрытую систему |
| **70** | читать старые участки во времени; использовать justified absence; строить reconstruction |
| **80** | превращать старые локальные связи в направленную network model |
| **87+** | видеть восстановление/перенос системы через альтернативные пути |
| **98** | обязательный для финальной dramaturgy meaningful revisit Поляны |
| **100+** | постмировые revisit layers с новым знанием других миров |

---

### 14.3. Revisit и replay — разные операции

```text
REPLAY_LEVEL
повторить расклад
ради результата / ★★★ / mastery

REVISIT_AREA
войти в текущее состояние места
ради исследования
```

`REVISIT_AREA` не обязан запускать исходный расклад.

---

## 15. Reconstruction graph первого мира

### 15.1. Event reconstruction

Основной production-пик:

```text
глава 7
```

Источники:

```text
след
сломанная ветвь
примятая трава
изменённый маршрут
absence при обоснованном expectation
```

### 15.2. Network reconstruction

Первый полный production-пик:

```text
уровень 80
```

Несколько relation-record объединяются в модель:

```text
как влияние проходит
через участок Леса
```

### 15.3. Cycle reconstruction

Production-пик:

```text
84–90
```

Сеть получает временную структуру:

```text
result
→ next condition
→ next process
→ feedback
```

### 15.4. Forest Synthesis

Уровень 99 не должен создавать «ещё одну reconstruction» того же масштаба.

Это:

```text
network reconstruction
+
cycle reconstruction
+
cross-context knowledge
+
player's learned methods
→
world synthesis
```

---

## 16. Relationship state map

Рекомендуемое смысловое разделение для каждого маскота:

```text
IDENTITY
unknown / known

ACQUAINTANCE
not_acquainted / acquainted

PERSPECTIVE
unseen / familiar / voluntarily_used

UNDERSTANDING
evidence-backed maturity, not affinity

RECIPROCITY
были ли моменты,
когда персонаж тоже изменил взгляд

COOPERATION
было ли совместное действие,
где обе стороны были необходимы

TEMPORARY ALLIANCE
story-scoped event/history

RELATIONSHIP SYNTHESIS
false / completed

COMPANION
false / true
```

Точные числовые thresholds остаются `TBD_THRESHOLD`.

---

## 17. Cognition state, используемый Лесом

Первичные направления:

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

Производные кандидаты / evidence:

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

Важное различие:

первые восемь являются рабочим минимальным набором primary первого мира.

Остальные в blueprint часто существуют как:

```text
evidence / derived reasoning
```

и **не должны автоматически становиться persisted public stats**.

---

## 18. Save / migration invariants

Эти правила следуют из уже принятой архитектуры и необходимы для реализации.

### 18.1. Нельзя терять историю ради агрегата

После миграции должны сохраняться:

```text
что реально произошло
что было exposed
что было noticed
какие choices были сделаны
какие encounters произошли
какие relationships изменились
какая reconstruction существовала тогда
```

### 18.2. Content version обязателен

Для событий и knowledge-state нужен `canon_version / content_version`.

Иначе после изменения:

- threshold;
- маршрута;
- interpretation;
- derived indicator;

невозможно понять, почему старый игрок получил конкретный narrative state.

### 18.3. Техническое восстановление не является выбором души

Crash recovery, resume и восстановление сохранения:

```text
НЕ создают
новый authored choice

НЕ изменяют
Cognition

НЕ меняют
relationship readiness
```

### 18.4. Encounter должен быть idempotent

**Production-рекомендация, не отдельный лор-канон:** значимый encounter должен иметь стабильный completion-event, чтобы повторный client retry / reconnect не мог:

- дважды начислить relationship effects;
- дважды выдать companion;
- создать дубль knowledge-record;
- повторно сдвинуть thread.

---

## 19. QA invariants

Перед реализацией/тестированием любого маршрута Мира Леса должны проходить проверки:

1. **Нет ли знания без объективного evidence?**
2. **Не выдана ли карточка только потому, что backend знает identity?**
3. **Не считается ли `exposed` автоматически `noticed`?**
4. **Не утверждает ли retrospective-текст, что игрок заметил то, чего не замечал?**
5. **Не переписывает ли revisit старый выбор?**
6. **Не возвращается ли утраченный момент как будто время откатилось?**
7. **Есть ли fallback для обязательного контента?**
8. **Не стал ли Fox доступен только через один hidden stat?**
9. **Не определяется ли companion через RNG или тупой max-score?**
10. **Произошла ли реальная reciprocity до Relationship Synthesis?**
11. **Не считается ли temporary ally уже companion?**
12. **Не создаётся ли второй permanent mascot в первом мире?**
13. **Не требует ли Forest Synthesis optional clue completion или ★★★?**
14. **Не объявлены ли все mysteries следами элементаля?**
15. **Не раскрыта ли dormant future thread раньше её содержательной готовности?**
16. **Не теряется ли provenance после observation → character → companion?**
17. **При пересмотре reconstruction сохранилась ли старая версия и её evidence?**
18. **После crash/retry не дублируется ли значимое событие?**

---

## 20. Что уже implementation-ready концептуально

После этой state map можно считать содержательно определёнными:

```text
разделение WorldFact / Exposure / Knowledge;
основные knowledge confidence states;
observation → character → companion;
reconstruction как отдельный слой;
11 базовых encounter;
маскотный relationship flow;
temporary alliance;
Relationship Synthesis;
first companion;
elemental manifestation flow;
revisit ≠ replay;
world complete ≠ world exhausted;
explicit WF_F01–WF_F65;
основные chapter checkpoint payloads.
```

---

## 21. Статус readiness после State Schema / Registries

### P0 — закрыто

Следующие блокеры этой карты закрыты в `WORLD_FOREST_STATE_SCHEMA_v0.05` и связанных registries:

```text
stable ID persistent facts → WF_F01–WF_F70
KnowledgeRecord / non-destructive merge
semantic event envelope / idempotency
relationship representation
Cognition persisted-vs-derived contract
Encounter routing contract
world-state / expired-event persistence
migration policy
```

`TBD_ID` в ранних таблицах этой state-map следует читать как историческую отметку discovery-pass; актуальные stable ID определяются `WORLD_FOREST_CONTENT_REGISTRY_v0.08`.

### P1 — архитектурно закрыто, authored-detail остаётся

Закрыты registry-level:

```text
area IDs
choice families
encounter variant IDs
knowledge presentation IDs
reconstruction IDs
revisit IDs
synthesis IDs / five phases
Fox / Elemental label evolution
```

Остаются authored-detail, а не state-machine gaps:

```text
TBD routing-choice numeric weights
final encounter scripts / puzzle layouts
atomic normalization части revisit prose
exact level-99 lexical/card set
Elemental dossier
Guardian exact future facts
```

### P2 — долгий горизонт

1. полный dormant Guardian thread после отдельного dossier;
2. post-world revisit из будущих миров;
3. дальнейшая эволюция `WF_F70` / cross-world observation;
4. long-horizon red-thread migrations через Круги Познания.

---

## 22. Следующий технический слой

State-map больше не требует нового фундаментального state-документа. Её contracts продолжены в:

```text
WORLD_FOREST_STATE_SCHEMA_v0.05
WORLD_FOREST_CONTENT_REGISTRY_v0.08
WORLD_FOREST_ENCOUNTER_REGISTRY_v0.04
WORLD_FOREST_KNOWLEDGE_REGISTRY_v0.05
WORLD_FOREST_REVISIT_REGISTRY_v0.03
WORLD_FOREST_SYNTHESIS_REGISTRY_v0.03
WORLD_FOREST_MACHINE_PACKAGE_SPEC_v0.03
```

Следующий этап — **implementation architecture audit существующего кода и migration plan**, а не новая абстрактная модель состояния.

