# WORLD FOREST REVISIT REGISTRY — Мир Леса

> **Статус:** рабочий production revisit registry  
> **Версия:** 0.03  
> **World ID:** `forest`  
> **Охват:** meaningful revisit первого Мира Леса, уровни `1–100`, level 98 и post-world layers  
> **Основание:** `GAME_VISION_MANIFEST_v0.12`, `WORLD_FOREST_DOSSIER_v0.18`, `WORLD_FOREST_LEVEL_BLUEPRINT_v0.13`, `WORLD_FOREST_STATE_SCHEMA_v0.05`, `WORLD_FOREST_CONTENT_REGISTRY_v0.08`, `WORLD_FOREST_KNOWLEDGE_REGISTRY_v0.05`, `WORLD_FOREST_ENCOUNTER_REGISTRY_v0.04`  
> **Назначение:** зафиксировать, что означает возвращение в уже пройденную область, какие состояния мира сохраняются или меняются, какие новые knowledge-возможности возникают и как revisit углубляет старый опыт без переписывания прошлого.

---

## 1. Верхний закон

```text
REVISIT
≠
REPLAY
```

Каноническая формула:

> **Возвращение не переписывает прошлый выбор — оно создаёт новую встречу с прошлым из настоящего состояния души.**

Поэтому revisit работает одновременно с двумя истинами:

```text
PAST
что действительно произошло тогда

и

PRESENT
каким место стало сейчас
+
что душа теперь способна увидеть
```

Ни одна не отменяет другую.

---

## 2. Зачем revisit существует в Словасьянсе

Revisit нужен не ради наполнения карты повторным контентом.

Он реализует фундаментальную ширину и глубину Познания:

```text
первое прохождение
→ узнать место

новое знание
→ увидеть в знакомом другой слой

изменившийся мир
→ заметить последствия

новый персонаж / спутник
→ получить новый relational context

другой мир / Круг
→ открыть смысл,
которого раньше даже нельзя было сформулировать
```

Главный эмоциональный payoff:

> **«Это было здесь раньше — но теперь я понимаю, почему это важно».**

или:

> **«Здесь действительно стало иначе — и я понимаю, что изменилось».**

---

## 3. Что revisit НЕ делает

Revisit не является:

- обязательным фармом старых уровней;
- способом получить ★★★;
- rewind прошлого решения;
- меню альтернативных timeline;
- `New Game+` в миниатюре;
- checklist всех скрытых деталей;
- обязательным способом встретить сюжетного персонажа, которого можно открыть по основному пути;
- наказанием за то, что игрок не заметил latent clue раньше.

Особенно запрещено:

```text
«Секреты Поляны: 3 / 17»
```

если душа ещё не знает о существовании остальных деталей.

---

## 4. Revisit и `PLAYER_INITIATED_REVELATION`

Возвращение может создать:

```text
новый exposure
новое observation
новую связь
новую reconstruction eligibility
новую identity inference eligibility
новую reinterpretation eligibility
```

Но значимое knowledge-преобразование не происходит автоматически.

Flow:

```text
REVISIT AREA
↓
душа замечает / получает новый context
↓
REVELATION_READY
↓
игрок сам открывает историю
↓
[Связать / Сделать вывод / Пересмотреть / Узнать]
↓
визуальный knowledge reveal
```

Revisit особенно хорошо подходит этому принципу, потому что игрок буквально сам возвращается к старому месту и сам завершает новое понимание.

---

## 5. Шесть классов revisit-state

### `PERSISTENT_SAME`

Объект или структура физически сохраняется достаточно долго, чтобы вернуться к ней.

Примеры:

- старая отметина на дереве;
- корневая структура;
- устойчивый проход;
- структура области.

### `PERSISTENT_CHANGED`

Основа сохраняется, но текущее состояние изменилось.

Примеры:

- свежая царапина стала старше;
- молодой рост продолжил расти;
- маршрут используется иначе;
- relation изменила локальный эффект.

Exact визуальная стадия определяется authored revisit-content.

### `RESIDUE_ONLY`

Исходный момент исчез, но оставил последствия.

Примеры:

- зверь ушёл;
- первоначальная примятая трава распрямилась;
- событие больше нельзя увидеть напрямую;
- сохранилась изменённая ветка / почва / маршрут.

### `EXPIRED`

Момент действительно утрачен.

Он остаётся только:

- в event history;
- в ранее созданном observation;
- в памяти персонажей;
- в последствиях, если они были authored.

Revisit не должен его «воскресить».

### `NEW_CURRENT_FACT`

Факт не существовал на первом посещении и появился позже из-за реального изменения мира.

Он НЕ оформляется как:

> «ты просто не заметил его тогда».

### `DORMANT_REINTERPRETABLE`

Факт существовал раньше, но его более глубокий смысл доступен только после нового контекста.

Это ключевой класс для долгих красных нитей.

---

## 6. Две оси revisit

Каждый meaningful revisit проектируется по двум независимым осям.

### Ось A — `WORLD CHANGE`

```text
что реально изменилось в месте?
```

### Ось B — `SOUL CHANGE`

```text
что изменилось в способности игрока видеть это место?
```

Сильный revisit часто использует обе:

```text
место стало другим
+
душа тоже стала другой
```

---

## 7. Revisit reason

Engine может иметь внутренний `revisit_reason`, но это не скрытая задача для игрока.

Рабочие classes:

```text
FIRST_NOTICE_AVAILABLE
REINTERPRETATION_AVAILABLE
NEW_CONNECTION_AVAILABLE
RECONSTRUCTION_REVISION_AVAILABLE
CURRENT_WORLD_CHANGE
UNCHOSEN_PATH_CURRENTLY_ACCESSIBLE
CHARACTER_HISTORY_ECHO
DORMANT_THREAD_CONTEXT_AVAILABLE
CROSS_WORLD_CONTEXT_AVAILABLE
AUTHORED_REQUIRED
```

Одна область может иметь несколько причин одновременно.

---

## 8. Как revisit сигнализируется в UI

Не показывать число скрытых причин.

Допустим мягкий area-signal только если игрок уже имеет понятное основание:

```text
«Здесь осталось что-то,
на что теперь можно посмотреть иначе»
```

или:

```text
«На Поляне остался непроверенный след»
```

если такой след уже реально является частью знания души.

Нельзя:

```text
Лес: 6 новых секретов
```

### Optional revisit

Можно проигнорировать без штрафа.

### Required revisit

Level 98 является authored обязательным возвращением и встроен в основной ритм кампании.

---

## 9. RevisitDefinition — authored contract

Каждая definition должна задавать минимум:

```text
revisit_id
area_id
kind
unlock_rules
world_state_rules
persistent_fact_families
changeable_fact_families
expired_moment_rules
knowledge_opportunities
pending_revelation_actions
dormant_thread_rules
character_context_rules
completion_condition
```

Точные scene assets и copy могут быть отдельными authored records.

---

# PART I. ПОЛЯНА

## 10. `REV_FOREST_CLEARING_01`

### Роль

Поляна — эталонное место обратного углубления.

Она должна доказать игроку:

> **новое содержание не всегда находится дальше. Иногда оно находится в уже знакомом месте.**

### First-pass facts

```text
WF_F01 clearing_flower_pattern_01
WF_F02 root_branch_rhyme_01
WF_F03 old_tree_mark_01
WF_F04 small_track_partial_01
WF_F05 bent_grass_line_01
```

### State classes

| Fact | Revisit class | Правило |
|---|---|---|
| `WF_F01` | `DORMANT_REINTERPRETABLE / PERSISTENT_SAME` | геометрия может быть замечена впервые или связана с более крупным pattern позже |
| `WF_F02` | `DORMANT_REINTERPRETABLE / PERSISTENT_SAME` | ранняя визуальная рифма не обязана иметь объяснение до поздних глав |
| `WF_F03` | `PERSISTENT_CHANGED` | старая отметина физически сохраняется; позднее можно читать возраст, причину и историю иначе |
| `WF_F04` | `RESIDUE_ONLY / EXPIRED physical trace` | исходный след не обязан сохраняться в идеальном виде; ранее noticed observation остаётся |
| `WF_F05` | `PERSISTENT_CHANGED / RESIDUE_ONLY` | сама примятость может измениться, но route/context способен иметь продолжение |

### Progressive layers

#### После главы 2

Игрок умеет различать:

```text
старое
↔
свежее
```

Поэтому `WF_F03` и trace-context получают новый temporal layer.

#### После главы 3

Игрок умеет:

```text
похожее
≠
то же самое
```

Это защищает ранние Fox evidence от автоматической identity attribution.

Possible action:

```text
MAKE_INFERENCE
```

только если evidence-bundle достаточен.

#### После главы 4

Ранние следы можно читать через:

```text
потребность
действие
маршрут
среду
```

#### После главы 6

`WF_F01 / WF_F02` могут впервые войти в:

```text
SEE_PATTERN ready
```

если есть cross-context evidence.

#### После главы 7

Ранние traces можно включать в event reconstruction, но только если физические и временные основания совместимы.

#### После уровня 90

Первый спутник меняет relational context Поляны.

Кот:

```text
место первого знакомства
+
новый взгляд на память общей истории
```

Сова:

```text
место первого наблюдения
+
различие между тем,
что было видно тогда и что понимается сейчас
```

Лис:

```text
ранний след / почти пересёкшиеся пути
+
нынешнее реальное спутничество
```

### Forbidden

Нельзя после знакомства с Лисом автоматически пометить:

```text
WF_F04 = Fox confirmed
WF_F05 = Fox confirmed
```

Каждая link требует evidence compatibility.

---

## 11. `REV_FOREST_CLEARING_L98`

### Kind

```text
AUTHORED_REQUIRED
```

### Function

Это не ещё один optional revisit.

Это кульминационная проверка всего закона обратного углубления перед уровнем 99.

### Core composition

Игрок возвращается к месту, где когда-то видел:

```text
цветы
ветви
корни
след
примятую траву
старую отметину
```

Но scene строится из текущей персональной истории.

### Allowed outcomes

```text
never noticed
→ first observation now

noticed but unexplained
→ reinterpretation ready

old independent observations
→ connection ready

old hypothesis
→ revision / confirmation opportunity

companion history
→ relational echo
```

### Mandatory reveal law

Level 98 не обязан заставлять игрока раскрыть **все** ready transitions.

Он должен foreground-ить только тот minimum, который нужен драматургии предфинального возвращения.

Остальные могут остаться optional.

### Dormant Guardian

Не раскрывается принудительно.

Даже в level 98 допустимо:

```text
никакого нового Guardian clue
```

или:

```text
старый странный fact остаётся странным
```

Главная кульминация принадлежит Лесу.

---

# PART II. ДЕРЕВЬЯ

## 12. `REV_FOREST_TREES_01`

### First-pass facts

```text
WF_F06 root_interlock_01
WF_F07 low_bark_mark_01
WF_F08 old_new_damage_pair_01
WF_F09 sapling_light_bend_01
WF_F10 fur_on_low_branch_01
```

### State classes

| Fact | Revisit class | Правило |
|---|---|---|
| `WF_F06` | `PERSISTENT_SAME / DORMANT_REINTERPRETABLE` | структурный мотив сохраняется и позже получает network-context |
| `WF_F07` | `PERSISTENT_CHANGED` | свежая отметина становится старше; original freshness не переигрывается |
| `WF_F08` | `PERSISTENT_CHANGED` | пара «старое / новое» продолжает temporal history |
| `WF_F09` | `PERSISTENT_CHANGED` | молодые деревья продолжают существовать; exact later form authored отдельно |
| `WF_F10` | `EXPIRED / RESIDUE_ONLY` | клочок шерсти не обязан ждать игрока вечно; observation сохраняется, если был создан |

### Knowledge layers

После главы 3:

```text
похожая форма повреждения
≠
одна причина
```

После главы 4:

```text
след
→ возможное действие
→ relation со средой
```

После главы 6:

```text
WF_F06
→ candidate hidden-network context
```

После главы 7:

```text
WF_F07 / F08
→ temporal reconstruction input
```

После главы 9:

рост, повреждение и восстановление могут читаться как процесс, а не статичная характеристика.

### Character echoes

Кот особенно естественно foreground-ит:

```text
что было тогда
↔
что изменилось сейчас
```

Сова:

```text
что реально видно сейчас
↔
что мы только предполагаем о прошлом
```

Лис:

```text
какие route affordance вокруг деревьев изменились
```

Ни один companion не даёт exclusive content lock.

---

# PART III. РАСТЕНИЯ

## 13. `REV_FOREST_PLANTS_01`

### Facts

```text
WF_F11 similar_leaf_pair_01
WF_F12 stem_difference_01
WF_F13 narrow_gap_route_01
WF_F14 fox_scale_context_01
WF_F15 repeated_small_route_01
WF_F66 full_small_track_01
```

### State classes

| Fact | Revisit class | Правило |
|---|---|---|
| `WF_F11 / F12` | `PERSISTENT_SAME / PERSISTENT_CHANGED` | distinguishing features остаются важны; exact growth-state authored отдельно |
| `WF_F13` | `PERSISTENT_CHANGED` | passage может сохраняться, становиться заметнее/иначе использоваться; snapshot прошлого не гарантируется |
| `WF_F14` | `DORMANT_REINTERPRETABLE` | scale-context становится meaningful только вместе с identity/evidence |
| `WF_F15` | `KNOWLEDGE DERIVED` | это связь между evidence, а не физический предмет, ожидающий игрока на месте |
| `WF_F66` | `EXPIRED physical trace / persistent observation` | отпечаток может исчезнуть; record остаётся, если игрок его заметил |

### Later layers

После главы 4:

```text
растение
→ укрытие / маршрут / ресурс
```

После главы 5:

```text
растение
→ часть нескольких систем
```

После главы 6:

```text
видимая часть
↔
скрытая связь
```

После знакомства с Лисом:

raw observations могут получить `same_subject / evidence_of` links, но только после player action и authored compatibility.

---

# PART IV. ЗВЕРИ

## 14. `REV_FOREST_ANIMALS_01`

### Facts

```text
WF_F16 feeding_trace_01
WF_F17 shelter_variants_01
WF_F18 crossed_tracks_01
WF_F19 environment_affordance_01
WF_F20 interrupted_route_01
WF_F67 bark_scrape_trace_01
WF_F68 disturbed_ground_trace_01
WF_F69 broken_branch_trace_01
```

### State classes

| Family | Revisit class | Правило |
|---|---|---|
| food / track residue | `RESIDUE_ONLY / EXPIRED` | не обязаны физически сохраняться до бесконечности |
| shelter | `PERSISTENT_CHANGED` | структура может сохраниться, occupancy / use не обязаны |
| environment affordance | `PERSISTENT_CHANGED` | среда остаётся, но лучший/реальный route способен измениться |
| interrupted route | `CURRENT_WORLD_CHANGE` | revisit показывает не повтор interruption, а его текущее следствие |
| F67–F69 | `RESIDUE_ONLY` | используются как independent evidence только если current authored state это позволяет |

### Later layers

После главы 7:

несколько animal-trace observations могут стать reconstruction input.

После главы 8:

```text
поведение одного зверя
→ давление / возможность для другого
```

После главы 9:

```text
остаток действия
→ input следующего процесса
```

### Fox

Если Лис уже знаком, revisit не превращается в экскурсию «вот все места, где был Лис».

Разрешён только честный retrospective link.

---

# PART V. ПТИЦЫ

## 15. `REV_FOREST_BIRDS_01`

### Facts

```text
WF_F21 repeated_perch_01
WF_F22 wind_route_01
WF_F23 carried_seed_01
WF_F24 multi_system_bird_01
WF_F25 predator_prey_role_shift_01
WF_F26 route_connects_sites_01
WF_F27 displaced_route_01
```

### Core revisit purpose

Глава Птиц особенно хорошо доказывает:

> **роль является свойством отношения и контекста, а не вечной наклейкой на сущности.**

### State classes

| Family | Revisit class |
|---|---|
| perch / route | `PERSISTENT_CHANGED` |
| wind corridor | `CURRENT_STATE_DEPENDENT` |
| carried seed | `PERSISTENT_CHANGED / NEW_CURRENT_FACT potential` |
| multi-system identity | `DORMANT_REINTERPRETABLE` |
| predator/prey role | `RELATIONAL CURRENT STATE` |
| displaced route | `CURRENT_WORLD_CHANGE` |

Exact post-visit physical changes требуют отдельного scene authoring.

### Later layers

После главы 7:

устойчивый маршрут создаёт основание для meaningful absence:

```text
ожидал повтор
+
повтор отсутствует
→ absence may become evidence
```

После главы 8:

роль птицы читается через направленные relations.

После главы 9:

перенос семени можно видеть как часть длинного process chain.

---

# PART VI. ГРИБЫ

## 16. `REV_FOREST_FUNGI_01`

### Facts

```text
WF_F28 fruiting_cluster_01
WF_F29 synchronized_change_01
WF_F30 hidden_connection_gap_01
WF_F31 soil_moisture_pattern_01
WF_F32 multi_manifestation_01
WF_F33 underground_route_mismatch_01
WF_F34 propagated_effect_01
WE_FOREST_RESPONSE_01
```

### Core revisit purpose

Это первая область, где сильный revisit может показать:

> **видимое проявление исчезло, но модель скрытой системы всё ещё объясняет новые effects.**

### State classes

| Family | Revisit class | Правило |
|---|---|---|
| fruiting bodies | `PERSISTENT_CHANGED / EXPIRED presentation` | конкретные видимые грибы не обязаны сохранять первый snapshot |
| synchronized change | `RESIDUE_ONLY / pattern history` | исходный synchronized moment не переигрывается |
| hidden gap / route mismatch | `DORMANT_REINTERPRETABLE` | structural relation может стать понятнее позже |
| soil moisture | `CURRENT_STATE_DEPENDENT` | current environmental evidence может отличаться |
| propagated effect | `PERSISTENT_CHANGED` | эффект может иметь дальнейшее последствие |
| Forest Response | `EXPIRED EVENT / persistent history` | level-60 response не повторяется только ради revisit |

### Knowledge opportunities

```text
SEE_PATTERN
REVISE_INTERPRETATION
INTEGRATE_SYSTEM
```

Если игрок не создал `KR_FOREST_RESPONSE_COORDINATED` на первом прохождении, поздний revisit не имеет права сказать, что он тогда заметил согласованность.

Он может:

- впервые заметить остаточные связи сейчас;
- связать старые observations;
- построить новую model настоящего состояния.

### Guardian dormant thread

Именно здесь может позднее стать meaningful один из deferred Guardian-compatible facts.

Но:

```text
first Forest completion
≠
Guardian reveal
```

До будущего context-key area остаётся без специального marker.

---

# PART VII. СЛЕДЫ

## 17. `REV_FOREST_TRACKS_01`

### Core role

Это наиболее временная область первого мира.

Поэтому её revisit должен особенно ясно показать:

> **прошлое не хранится как музейный снимок. Оно остаётся в последствиях, записях и новых слоях следов.**

### Facts

```text
WF_F35 fresh_track_cluster_01
WF_F36 trace_age_pair_01
WF_F37 multi_trace_event_01
WF_F38 ambiguous_broken_branch_01
WF_F39 missing_expected_trace_01
WF_F40 trace_overlap_sequence_01
WF_F41 contradiction_trace_01
WF_F42 overlapping_histories_01
WF_F43 incomplete_event_record_01
```

### State law

Большинство конкретных physical traces относятся к:

```text
RESIDUE_ONLY
или
EXPIRED
```

Их **knowledge records** могут сохраняться постоянно.

Это важнейшее различие:

```text
след исчез
≠
игрок забыл observation
```

### Revisit content

Вместо восстановления старых следов 1:1 область может показывать:

- новые traces поверх старых последствий;
- исчезновение ожидаемого следа;
- оставшийся physical residue;
- изменённый route;
- следствие ранее реконструированного события;
- contradiction к старой reconstruction.

### Knowledge actions

```text
RECONSTRUCT_EVENT
REVISE_INTERPRETATION
LINK_OBSERVATIONS
```

### Reconstruction history

Если old reconstruction существует:

```text
old model
+
new current evidence
↓
REVISE ready
```

но не automatic revision.

### Dormant Guardian

Chapter 7 может хранить очень слабый deferred fact.

Revisit не обязан его foreground-ить даже после level 100.

Его future reveal должен требовать нового контекста, а не только «вернись после финала».

---

# PART VIII. СОСЕДСТВО

## 18. `REV_FOREST_NEIGHBORHOOD_01`

### Facts

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

### Core purpose

Это главная область для закона:

> **устойчивая система не обязана оставаться в одном состоянии.**

### Revisit state

Здесь **нормально**, если current relation graph отличается от первой модели.

Но прошлое остаётся:

```text
first network reconstruction
+
current network reconstruction
```

а не:

```text
первая model была «переписана»
```

### Allowed current changes

Authored revisit может менять:

```text
resource pressure
route availability
third-party presence
local relation effect
balance state
```

без изменения historical event sequence.

### Knowledge action

Если current state materially отличается:

```text
REVISE_INTERPRETATION
```

или:

```text
INTEGRATE_SYSTEM
```

становится ready.

### Companion echo

Если temporary ally / first companion связан с Encounter 8, area может напомнить shared task.

Но это не exclusive revisit.

Другой companion должен иметь собственный contextual reaction без переписывания того, кто был союзником тогда.

---

# PART IX. КРУГОВОРОТ

## 19. `REV_FOREST_CYCLE_01`

### Facts

```text
WF_F52 process_residue_01
WF_F53 decomposition_transition_01
WF_F54 output_as_input_01
WF_F55 first_closed_loop_01
WF_F56 multiple_cycle_entry_01
WF_F57 cycle_disruption_01
WF_F58 alternate_cycle_path_01
WF_F59 interlocked_cycles_01
WF_F60 relationship_synthesis_prelude_01
```

### Core purpose

Revisit должен показать:

> **цикл продолжает происходить после того, как игрок ушёл.**

Не существует обязательного возврата к «идеальной первой картинке».

### State classes

```text
process residue
→ current-state dependent

disruption event
→ expired event with persistent consequences

alternate path
→ persistent current system possibility

interlocked cycles
→ model can deepen later
```

### After level 90

Relationship history становится новым context.

Если Encounter 9 и Encounter 10 использовали один и тот же маскотный метод, revisit может показать:

```text
как shared method работает
без кульминационного давления
```

Если персонажи различались, история сохраняет оба контекста.

### After level 100

Cycle facts могут связываться с Forest-scale whole, но не исчезают внутри `KR_FOREST_WORLD_SYNTHESIS`.

---

# PART X. ЛЕС КАК ЦЕЛОЕ

## 20. Почему нет обычного `REV_FOREST_WHOLE_01`

`AREA_FOREST_WHOLE` в уровнях 91–100 является в большой степени **синтетическим взглядом на весь Мир Леса**, а не ещё одной изолированной географической полкой.

Поэтому v0.01 не создаёт отдельную десятую локальную revisit-zone только ради симметрии.

Факты:

```text
WF_F61 lingering_influence_01
WF_F62 local_global_conflict_01
WF_F63 influence_boundary_01
WF_F64 distributed_system_01
WF_F65 cross_scale_pattern_01
```

должны позднее переосмысливаться через реальные прежние области.

Это сильнее, чем создать комнату «Лес как целое».

---

## 21. `REV_FOREST_POSTWORLD_01`

### Unlock

```text
level 100 complete
```

### Meaning

Открывает не «второе прохождение Леса», а возможность:

```text
возвращаться в конкретные области
с post-world knowledge context
```

### Immediately after level 100

Можно:

- связать честные element-thread observations с Elemental history;
- переосмыслить ранние distributed-system motifs;
- увидеть последствия завершённых world events;
- продолжить mature mascot threads;
- сохранить unresolved mysteries.

### Нельзя

```text
после Elemental
→ все unknown facts получают answer
```

### Future worlds

Новый большой мир может добавить context-key:

```text
CROSS_WORLD_CONTEXT_AVAILABLE
```

для конкретного Forest revisit.

Примерный принцип:

```text
новое знание о другом типе системы
+
старый Forest fact
→ новая interpretation
```

Это и есть настоящий второй слой Мира Леса без необходимости создавать копию мира.

---

# PART XI. ДОЛГИЕ НИТИ

## 22. Медведь-страж и персонажи длинного горизонта

Долгая нить может проходить через:

```text
первый Мир Леса
→ другой мир
→ ещё несколько миров
→ новый Круг Познания
→ поздний revisit Леса
```

и только тогда стать различимой как персонаж.

### First Forest rule

Игрок может:

- не увидеть ничего;
- увидеть странность без карточки;
- получить observation без identity;
- построить неверную, но разумную hypothesis;
- закончить мир, не имея никакого knowledge-record этой нити.

Все варианты допустимы.

### Future activation

Dormant thread не активируется просто условием:

```text
forest_complete = true
```

Нужно новое содержательное основание:

```text
future context
+
compatible old fact
+
новый evidence / способ Познания
```

### UI law

До активации нет:

```text
«Найдите Медведя: 1 / 4 следа»
```

После появления честной hypothesis может возникнуть обычный observation-history, но identity всё ещё не обязана быть известна.

---

# PART XII. PLAYER-INITIATED REVISIT KNOWLEDGE

## 23. Revisit не должен сам «обновить все карточки» при входе

Плохой flow:

```text
игрок вошёл на Поляну
↓
12 карточек автоматически обновились
↓
игрок не понял, что произошло
```

Правильный flow:

```text
игрок входит
↓
видит current-state
↓
замечает конкретную новую связь
↓
1–2 значимых transitions становятся ready
↓
игрок сам их раскрывает
```

### Batch reveal

Не рекомендуется universal:

```text
«Обновить всё»
```

для narrative knowledge.

Если несколько transitions относятся к одному смысловому открытию, их можно собрать в **один authored reveal**, но не в административный bulk-update.

---

## 24. Revisit reveal actions

Типовые actions:

| Revisit result | Action |
|---|---|
| старый fact впервые стал observation | `LINK_OBSERVATIONS` или contextual notice action |
| старый observation получил новую hypothesis | `MAKE_INFERENCE` |
| old model сломалась | `REVISE_INTERPRETATION` |
| несколько старых следов образовали событие | `RECONSTRUCT_EVENT` |
| motif повторился на новом масштабе | `SEE_PATTERN` |
| старый unknown trace честно связан с known character | `RECOGNIZE_ENTITY / LINK_OBSERVATIONS` |
| локальная model стала system model | `INTEGRATE_SYSTEM` |

---

# PART XIII. OPTIONALITY AND PACING

## 25. Revisit не конкурирует с основной кампанией

По умолчанию revisit:

```text
OPTIONAL
```

Кроме authored level 98.

Он не должен создавать ощущение:

> «перед каждым новым уровнем сначала проверь девять старых областей».

### Notification budget

Рекомендуемый product law:

- не сигнализировать каждую маленькую reinterpretation;
- foreground-ить только действительно содержательные причины;
- объединять несколько слабых reasons в один спокойный area-state;
- позволять игроку самому открыть карту и вернуться позже.

Точные notification budgets фиксируются UX-документом.

---

## 26. Revisit не даёт обязательную силу

Optional revisit может давать:

- knowledge;
- relationship context;
- реликвию / память, если отдельно authored;
- дополнительный lore;
- новый путь знакомства;
- cosmetic / narrative reward.

Но он не должен становиться обязательным скрытым grind для:

- следующего мира;
- первого companion;
- Elemental encounter;
- core ability power.

Это продолжает правило, что обязательный backtracking не используется как основной путь спутничества.

---

# PART XIV. DATA / STATE CONTRACT

## 27. RevisitInstance

Recommended logical record:

```json
{
  "revisit_instance_id": "runtime-id",
  "definition_id": "REV_FOREST_CLEARING_01",
  "area_id": "AREA_FOREST_CLEARING",

  "entry_sequence": 1401,
  "world_state_version": 7,

  "active_reasons": [
    "REINTERPRETATION_AVAILABLE",
    "CHARACTER_HISTORY_ECHO"
  ],

  "current_world_fact_ids": [],
  "expired_event_ids": [],

  "knowledge_records_created": [],
  "pending_revelation_ids": [],

  "completed_sequence": null
}
```

Это projection/runtime aid, а не замена semantic event history.

---

## 28. Historical snapshot

Revisit engine должен иметь доступ к:

```text
first_visit_sequence
first_visit choices
old exposure
old observations
old interpretations
old reconstructions
old encounter history
```

но не для изменения прошлого.

Они используются как контекст сравнения.

---

## 29. Expiry contract

Authored content должен явно различать:

```text
persistent fact
current mutable fact
one-time event
residue
```

Если exact expiry пока не authored:

```text
TBD_AUTHORED
```

лучше, чем вечное сохранение временного следа по умолчанию.

---

# PART XV. QA

## 30. QA — старый choice

Первый визит:

```text
выбран путь A
путь B не выбран
```

Revisit:

```text
путь B исследуется сейчас
```

Expected:

```text
historical choice A unchanged
```

---

## 31. QA — исчезнувший след

На level 3 был physical `WF_F04`.

Поздний revisit происходит после большого количества world-state changes.

Expected:

```text
original print may be gone
```

Если player had observation:

```text
knowledge remains
```

Если player never noticed:

игра не обязана искусственно сохранять footprint ради completion.

Другой current evidence может открыть нить позже.

---

## 32. QA — first notice on revisit

Persistent fact реально существует и раньше был `exposed=false` для конкретного игрока.

Current revisit authored scene теперь показывает его.

Expected:

```text
first_exposed / first_noticed = revisit
```

Не:

```text
«ты всегда это видел»
```

---

## 33. QA — new fact vs old hidden fact

После первого визита в area реально появился новый world fact.

Expected:

```text
NEW_CURRENT_FACT
```

Не:

```text
DORMANT_REINTERPRETABLE
```

Narrative copy не говорит:

> «оно было здесь всё это время».

---

## 34. QA — automatic card storm

Игрок возвращается после level 90, и 7 old observations получают новый context.

Expected:

```text
0 automatic major presentation transitions
```

Engine может создать multiple `REVELATION_READY`, но UX foreground-ит только authored meaningful reveal.

---

## 35. QA — Elemental overclaim

После level 100 игрок revisits Fungi.

Expected:

```text
supported pattern / Response
may link to Elemental
```

Но Guardian-compatible anomaly остаётся unresolved.

---

## 36. QA — companion history

Encounter 8 ally = Cat.
First companion = Owl.

Revisit Neighborhood after level 90.

Expected:

```text
area remembers Cat was temporary ally
+
current Owl companion may comment as current companion
```

История не переписывается так, будто Owl участвовала тогда.

---

## 37. QA — dormant Guardian

Player completes Forest and revisits every area.

Expected:

```text
Guardian may remain completely undiscovered
```

Revisit completion не требует его clues.

---

## 38. QA — player initiated revision

Old reconstruction contradicted by current revisit evidence.

Expected:

```text
REVISE ready
old reconstruction remains current presentation
until player action
```

Если mandatory story later needs new model, corresponding checkpoint foreground-ит revision action.

---

## 39. QA — reduced motion

Player uses reduced-motion setting.

Expected:

```text
same revelation action
same semantic event
same knowledge transition
```

без обязательной интенсивной анимации.

---

# PART XVI. AUTHORING STATUS

## 40. Что v0.01 фиксирует

```text
revisit ≠ replay
past + present dual truth
six revisit state classes
revisit reason taxonomy
anti-checklist law
player-initiated revelation inside revisit
progressive area model
Clearing / Trees / Plants / Animals / Birds / Fungi / Tracks / Neighborhood / Cycle contracts
level 98 authored revisit
post-world revisit layer
Whole-area as synthetic lens rather than forced tenth revisit-zone
dormant Guardian long-horizon rule
optional pacing law
expiry contract
QA invariants
```

---

## 41. Что остаётся `TBD_AUTHORED`

1. точные визуальные current-state variants каждой области;
2. какие конкретно temporary facts исчезают после какого world event;
3. точный набор revisit scene IDs внутри area;
4. точный map/UI signal;
5. exact post-world reactions первого спутника;
6. future-world context keys;
7. exact Guardian dossier и stable source facts `01–02`;
8. rewards отдельных optional revisit;
9. exact reveal animation language;
10. exact notification budget.

Эти пробелы нельзя заполнять случайным таймером или generic respawn-логикой.

---

## 42. Статус после Revisit Registry v0.03

Synthesis-layer уже зафиксирован в:

```text
WORLD_FOREST_SYNTHESIS_REGISTRY_v0.03
```

Fundamental Forest content architecture завершена.

Следующий revisit-pass будет implementation-facing: нормализовать только те current-state правила, которые сейчас намеренно остаются authored prose, после сопоставления с реальным хранением world/player state.
