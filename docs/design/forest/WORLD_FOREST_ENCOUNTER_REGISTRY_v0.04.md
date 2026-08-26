# WORLD FOREST ENCOUNTER REGISTRY — Мир Леса

> **Статус:** рабочий production encounter registry  
> **Версия:** 0.04  
> **World ID:** `forest`  
> **Охват:** Encounter `1–11`, уровни `1–100`  
> **Основание:** `WORLD_FOREST_CONTENT_REGISTRY_v0.08`, `WORLD_FOREST_STATE_SCHEMA_v0.05`, `WORLD_FOREST_STATE_MAP_v0.03`, `WORLD_FOREST_LEVEL_BLUEPRINT_v0.13`, `WORLD_FOREST_DOSSIER_v0.18`, `CHARACTER_WORLD_MANIFEST_v0.15`  
> **Назначение:** зафиксировать purpose, entry guards, variant kernels, routing priority, relational/knowledge effects, exit state, fallback и QA для significant encounter первого Мира Леса.

---

## 1. Граница документа

Registry фиксирует **драматургический и state-контракт**, но не финальные реплики, точный карточный layout, анимации и числовые thresholds.

```text
CONTENT REGISTRY
какие ID существуют
↓
ENCOUNTER REGISTRY
что каждый encounter должен сделать
↓
FINAL SCRIPT / LEVEL CONTENT
как именно сцена написана и сыграна
```

---

## 2. Верхний закон routing

Encounter отвечает не на вопрос:

> **«Какой маскот больше похож на стиль игрока?»**

а:

> **«Какая встреча сейчас естественно продолжает прожитую историю и способна изменить отношения?»**

Запрещено:

```text
max(memory)      → Кот
max(observation) → Сова
max(pathfinding) → Лис
```

Cognition является evidence того, **как** игрок способен войти в сцену, а не скрытым классом, определяющим персонажа.

### 2.1. Продуктивное различие равноценно сходству

Кот может появиться не только у игрока, который часто пользуется памятью, но и у игрока, который способен показать Коту, где знакомая история перестала совпадать. Сова может появиться не только у «наблюдателя», но и у игрока, который умеет связывать её точные наблюдения в более крупную модель. Лис может быть открыт не только через exploration, но и через аналитический вывод по evidence.

### 2.2. Сам факт показа персонажа не усиливает его preference

```text
движок выбрал Кота
→ игрок прошёл сцену Кота
≠
игрок добровольно выбрал Кота
```

Encounter создаёт relationship history, но не считается новым добровольным preference-signal для следующего routing.

---

## 3. Routing factors

Каждый candidate оценивается объяснимым bundle:

```text
STAGE_FIT
какую следующую relationship-stage реально создаст сцена

THREAD_CONTINUITY
есть ли незавершённый вопрос этой нити

SCENE_FIT
соответствует ли chapter problem способу персонажа

PLAYER_COMPLEMENTARITY
есть ли у игрока честный вклад, которого не даёт персонаж

PLAYER_INITIATIVE
продолжал ли игрок нить добровольно после прошлого encounter

REPETITION_COST
не создаёт ли прошлый encounter самоподдерживающийся выбор того же персонажа
```

Один mascot может получить два encounter подряд при явном unfinished question или добровольном продолжении. Три solo-encounter подряд до Encounter 8 требуют особенно сильной authored причины. Это не квота экранного времени, а защита от feedback-loop.

---

## 4. Joint encounter law

Joint-scene допустима только если:

```text
способ A
+
способ B
+
вклад игрока
```

создают задачу, которую нельзя рассказать так же хорошо одним персонажем.

Нельзя использовать joint как административный tie-break «оба score почти равны».

---

## 5. Relationship milestones

```text
UNDERSTANDING
игрок понял метод, пользу и ограничение персонажа

RECIPROCITY
персонаж тоже изменил свою модель из-за вклада игрока

COOPERATION
shared task требует вклада обоих

TEMPORARY ALLIANCE
story-scoped совместный путь Encounter 8

RELATIONSHIP SYNTHESIS
оба меняют привычный метод → возникает новый совместный способ → companion
```

Milestone нельзя получить только за правильный ответ или простое использование способности. Hint usage не отменяет relationship progress, если после помощи игрок содержательно продолжает shared task.

---

## 5.1. Encounter создаёт основание для reveal, но не обязан молча менять карточку

Encounter и `Knowledge Presentation` являются разными слоями.

Прямая встреча может установить:

```text
identity_known = true
acquainted = true
```

потому что событие реально произошло.

Но значимый переход карточки:

```text
Observation → Character
```

следует закону `PLAYER_INITIATED_REVELATION`.

Рекомендуемый flow:

```text
Encounter подтверждает identity
↓
RECOGNIZE_ENTITY ready
↓
игрок нажимает «Узнать»
↓
карточка преобразуется
```

Аналогично Encounter 10:

```text
персонаж принимает решение идти рядом
↓
CONTINUE_TOGETHER ready
↓
игрок нажимает «Продолжить путь вместе»
↓
Character → Companion
```

Игрок не управляет волей персонажа.

Он инициирует **момент принятия и раскрытия нового состояния общей истории**.


## 6. Encounter map

| Encounter | Window | Function |
|---|---|---|
| `ENC_FOREST_01` | 1–4 | Cat+Owl acquaintance, две perspective |
| `ENC_FOREST_02` | 16–19 | first personal understanding / early reciprocity |
| `ENC_FOREST_03` | 25–29 | first true divergence; possible Fox meeting |
| `ENC_FOREST_04` | 35–39 | character-as-person; mature reciprocal beat |
| `ENC_FOREST_05` | 45–49 | player method becomes useful to mascot method |
| `ENC_FOREST_06` | 55–59 | character method meets hidden-system limitation |
| `ENC_FOREST_07` | 65–69 | reconstruction; partner readiness |
| `ENC_FOREST_08` | 76–79 | cooperation + temporary alliance |
| `ENC_FOREST_09` | 84–87 | transfer shared method to new context |
| `ENC_FOREST_10` | 89–90 | Relationship Synthesis → first companion |
| `ENC_FOREST_11` | 100 | Forest Elemental full encounter |

---

## 7. Encounter 1 — `ENC_FOREST_01_CAT_OWL`

Encounter 1 остаётся одним significant node, хотя onboarding beats продолжаются до уровня 4.

**Purpose:** новая душа знакомится с двумя разными корректными способами Познания. Кот даёт прошлый контекст и память; Сова — различающий признак и проверку. Игрок пока учится, поэтому reciprocity не требуется.

**Guards:** `world=forest`, `level=1`, encounter ещё не завершён.

**Exit:** `cat/owl identity_known`, `acquainted`, обе borrowed perspectives `seen`; forced tutorial usage не является preference-evidence. Replay не переигрывает first encounter.

---

## 8. Encounter 2 — contract

К уровню 20 минимум одна обязательная нить Cat/Owl должна иметь честное evidence для `UNDERSTANDING`. Это guarantee сюжетного графа, а не stat threshold.

Fallback не позже 19-го уровня выбирает существующий содержательный variant. Cat+Owl допустим только при реальной задаче `THEN + NOW → CHANGE`.

---

## 9. Encounter 3 — contract

Fox имеет четыре валидных входа:

```text
EXPLORATORY
ANALYTICAL INFERENCE
STORY COLLISION
LATE / NO MEETING YET
```

Ни один не считается правильным. `intuition >= X` никогда не является hard gate Fox.

Fox first-meeting должен адаптироваться к состоянию знания: no card / trace / inferred / touch. Self-inference получает payoff, но не создаёт friendship-score.

---

## 10. Encounter 4 — contract

Fox acquaintance не даёт ему вечный priority. Если игрок не продолжал Fox thread, более зрелая Cat/Owl line может получить сцену. Если Fox уже встречен и thread продолжалась, continuation естественно раскрывает его limitation: хороший интуитивный маршрут нуждается в проверке и объяснимости.

---

## 11. Encounter 5 — contract

Глава Птиц не означает автоматический Owl encounter. Identity определяется зрелостью отношений и текущим системным вопросом. Здесь впервые особенно уместен relational beat: **«твой способ позволил увидеть то, чего не хватало моему».**

---

## 12. Encounter 6 — contract

Главная функция: привычный способ персонажа сталкивается со скрытой системой. Сова учится работать со строго проверяемой косвенной гипотезой; Кот — связывать разнесённые воспоминания в hidden structure; Лис — видеть connection, не совпадающую с поверхностной тропой.

---

## 13. Encounter 7 — contract и graph guarantee

К концу Encounter 7 минимум одна доступная mascot thread должна быть:

```text
temporary_alliance_eligible
=
identity known
+
acquainted
+
understanding evidence
+
reciprocity evidence
+
shared problem history
```

Если обычный routing к 65-му уровню не создал такого кандидата, Encounter 7 обязан выбрать variant, который **внутри настоящей задачи** способен закрыть недостающую reciprocity-stage. Нельзя выставлять milestone одной репликой.

Cat+Owl здесь является сильнейшей естественной совместной сценой раннего мира: Cat даёт THEN, Owl NOW, player связывает time + evidence + uncertainty; contradiction заставляет пересмотреть модель обоих.

---

## 14. Encounter 8 — temporary alliance

Hard eligibility:

```text
known + acquainted + understanding + reciprocity + scene fit
```

Fox дополнительно должен быть реально encountered.

Encounter 8 обязан установить:

```text
cooperation_established = true
temporary_alliance_completed = true
shared_history += encounter_8
```

Flow:

```text
76 START: одной perspective недостаточно
77 ASYMMETRY: польза одному ≠ польза другому
78 THIRD PARTY: C меняет A ↔ B
79 DYNAMIC BALANCE: совместная model выдерживает изменение
→ temporary_ally = false
```

Временный союз не становится спутничеством.

---

## 15. Encounter 9 — transfer

Временный союзник Encounter 8 получает continuity advantage, но не hard-lock.

Switch к другому персонажу допустим только если он уже имеет:

```text
identity known
acquainted
understanding
reciprocity
2+ meaningful prior relationship events
```

и текущий cycle problem прямо развивает его unresolved contradiction. В таком Encounter 9 новый персонаж обязан получить реальный cooperation beat; иначе он не может внезапно стать synthesis-candidate.

Если selected character отличается от Encounter 8 ally:

```text
cooperation_established = true
temporary_alliance_completed = false
```

---

## 16. Encounter 10 — hard contract

Eligibility:

```text
identity_known
acquainted
understanding_established
reciprocity_established
cooperation_established
narrative_compatibility
```

Ranking evidence:

```text
shared_history_depth
temporary_alliance_result
Encounter 9 transfer result
current_world_relevance
recent_relationship_momentum
unresolved_mutual_contradiction
```

Forbidden:

```text
random
max friendship
highest matching Cognition stat
most times selected
rarity
paid status
```

### Player-side limitation guard

Synthesis требует mutual change, но игра не имеет права выдумывать игроку характер. Direct player pattern допустим только при evidence в `2+` независимых контекстах. Internal hooks могут быть `PREMATURE_CLOSURE`, `LOCAL_OPTIMIZATION`, `FAMILIAR_METHOD_LOCK`, `SINGLE_RELATION_FOCUS`, `EVIDENCE_OVERCOLLECTION`, `REVISION_AVOIDANCE`.

Если устойчивого pattern нет:

```text
PLAYER_CURRENT_MODEL_INCOMPLETE
```

Сцена говорит только о текущем решении, а не «ты всегда так делаешь».

### Tie-break order

1. `UNRESOLVED_MUTUAL_CONTRADICTION`;
2. `RECIPROCAL_HISTORY_DEPTH`;
3. `COOPERATION_TRANSFER` в более чем одном контексте;
4. completed temporary alliance;
5. fresh voluntary player continuation;
6. deterministic authored order `CAT → OWL → FOX` только как последняя техническая страховка.

Если пункт 6 срабатывает часто, authoring недостаточно различает истории.

### Guarantee

`eligible_candidates = 0` на level 90 является P0 narrative-state bug. Нельзя random-pick или автоматически выставлять missing milestones.

Encounter 10 сначала атомарно фиксирует:

```text
FOREST_ENCOUNTER_10_COMPLETED
FOREST_RELATIONSHIP_SYNTHESIS_COMPLETED
FOREST_THREAD_STATE_CHANGED
FOREST_KNOWLEDGE_REVELATION_READY
```

После действия игрока `CONTINUE_TOGETHER` отдельная idempotent transaction фиксирует:

```text
FOREST_COMPANION_ACQUIRED
FOREST_KNOWLEDGE_REVELATION_COMPLETED
presentation_group = companion
```

Ровно один Cat/Owl/Fox становится first permanent mascot companion. Остальные earned milestones сохраняются. Уровень 91 не открывается, пока обязательный relationship reveal уровня 90 не прожит игроком.

---

## 17. Variant summary

| Variant | Window | Participants | Relationship target | Core contradiction |
|---|---|---|---|---|
| `ENC_FOREST_02_CAT` | 16–19 | Кот | UNDERSTANDING / early RECIPROCITY | Похожая история помогает, но не обязана повторяться буквально. |
| `ENC_FOREST_02_OWL` | 16–19 | Сова | UNDERSTANDING / early RECIPROCITY | Точный признак ещё не гарантирует точности целой причины. |
| `ENC_FOREST_02_CAT_OWL` | 16–19 | Кот + Сова | UNDERSTANDING обеих нитей | Прошлое и настоящее измеряют разные части одного изменения. |
| `ENC_FOREST_03_FOX` | 25–29 | Лис | ACQUAINTANCE / UNDERSTANDING | Очевидный путь не единственный; найденный путь всё ещё требует основания. |
| `ENC_FOREST_03_CAT` | 25–29 | Кот | RECIPROCITY candidate | Похожая история ещё не означает ту же самую историю. |
| `ENC_FOREST_03_OWL` | 25–29 | Сова | RECIPROCITY candidate | Безупречные observations могут оставаться неполной картиной. |
| `ENC_FOREST_03_CAT_OWL` | 25–29 | Кот + Сова | RECIPROCITY candidate | Прошлый контекст и текущий признак нужны одновременно. |
| `ENC_FOREST_04_FOX_FIRST` | 35–39 | Лис | ACQUAINTANCE / UNDERSTANDING | Среда не только ограничивает движение — она предлагает возможности. |
| `ENC_FOREST_04_FOX_CONTINUATION` | 35–39 | Лис | RECIPROCITY | Интуитивно найденный путь ещё нужно проверить и объяснить. |
| `ENC_FOREST_04_CAT` | 35–39 | Кот | RECIPROCITY | Память о поведении не заменяет текущую среду. |
| `ENC_FOREST_04_OWL` | 35–39 | Сова | RECIPROCITY | След действия не равен наблюдению намерения. |
| `ENC_FOREST_04_CAT_OWL` | 35–39 | Кот + Сова | RECIPROCITY / shared history | Похожее действие при изменившейся среде может иметь другую причину. |
| `ENC_FOREST_05_OWL` | 45–49 | Сова | MATURE RECIPROCITY | Правильные A, B, C ещё не дают A ↔ B ↔ C. |
| `ENC_FOREST_05_CAT` | 45–49 | Кот | MATURE RECIPROCITY | Память может быть не архивом, а сетью контекстов. |
| `ENC_FOREST_05_FOX` | 45–49 | Лис | MATURE RECIPROCITY | Маршрут сам способен связывать системы. |
| `ENC_FOREST_05_CAT_OWL` | 45–49 | Кот + Сова | MATURE RECIPROCITY | Identity across time + current relation precision нужны вместе. |
| `ENC_FOREST_05_OWL_FOX` | 45–49 | Сова + Лис | MATURE RECIPROCITY | Локальные отношения и маршрут между ними — разные слои. |
| `ENC_FOREST_06_OWL` | 55–59 | Сова | LIMITATION + RECIPROCITY | Строгость не требует буквальной видимости причины. |
| `ENC_FOREST_06_CAT` | 55–59 | Кот | LIMITATION + RECIPROCITY | Разнесённые воспоминания могут быть проявлениями одной скрытой структуры. |
| `ENC_FOREST_06_FOX` | 55–59 | Лис | LIMITATION + RECIPROCITY | Путь может существовать без видимой тропы. |
| `ENC_FOREST_06_CAT_OWL` | 55–59 | Кот + Сова | RECIPROCITY / shared method | NOW + BEFORE нужны для вывода UNSEEN STRUCTURE. |
| `ENC_FOREST_06_OWL_FOX` | 55–59 | Сова + Лис | RECIPROCITY / shared method | Интуитивная route-model должна выдержать evidence test. |
| `ENC_FOREST_07_CAT` | 65–69 | Кот | PARTNER READINESS | Прошлое не имеет права автоматически диктовать нынешнюю reconstruction. |
| `ENC_FOREST_07_OWL` | 65–69 | Сова | PARTNER READINESS | Точный след ещё не равен точной истории. |
| `ENC_FOREST_07_FOX` | 65–69 | Лис | PARTNER READINESS | Красивый маршрут ≠ доказанный маршрут. |
| `ENC_FOREST_07_CAT_OWL` | 65–69 | Кот + Сова | PARTNER READINESS / cooperation evidence | Их методы измеряют разные части одной реальности. |
| `ENC_FOREST_08_CAT` | 76–79 | Кот | COOPERATION + TEMPORARY ALLIANCE | Старую сеть нельзя просто восстановить: отношения изменились. |
| `ENC_FOREST_08_OWL` | 76–79 | Сова | COOPERATION + TEMPORARY ALLIANCE | Direct observations не показывают mediated/lagged influence целиком. |
| `ENC_FOREST_08_FOX` | 76–79 | Лис | COOPERATION + TEMPORARY ALLIANCE | Лучший local route одного может ухудшить сеть для других. |
| `ENC_FOREST_09_CAT` | 84–87 | Кот | COOPERATION TRANSFER | Цикл похож на прежний, но новый input меняет повтор. |
| `ENC_FOREST_09_OWL` | 84–87 | Сова | COOPERATION TRANSFER | Не каждое звено большого цикла видно напрямую. |
| `ENC_FOREST_09_FOX` | 84–87 | Лис | COOPERATION TRANSFER | Альтернативный route может замкнуть цикл и одновременно создать pressure elsewhere. |
| `ENC_FOREST_10_CAT` | 89–90 | Кот | RELATIONSHIP SYNTHESIS → COMPANION | Память не должна превращаться в шаблон; новизна не должна отрицать прошлое. |
| `ENC_FOREST_10_OWL` | 89–90 | Сова | RELATIONSHIP SYNTHESIS → COMPANION | Verification не требует прямой видимости каждого edge; hypothesis не равна свободной догадке. |
| `ENC_FOREST_10_FOX` | 89–90 | Лис | RELATIONSHIP SYNTHESIS → COMPANION | Лучший путь оценивается по цели и последствиям; осторожность не должна убивать альтернативу. |

---

## 18. Encounter 2 variants

### `ENC_FOREST_02_CAT`

**Participants:** Кот  
**Window:** 16–19  
**Relationship target:** `UNDERSTANDING / early RECIPROCITY`

**Core contradiction**

> Похожая история помогает, но не обязана повторяться буквально.

**What mascot adds**

Кот даёт прошлое состояние, аналогию и причинную память.

**What player adds**

Игрок добавляет новый различающий признак, текущий контекст или проверку изменения.

**Knowledge / exit effect**

Уточнение старого/свежего повреждения; возможна revision старой interpretation.



### `ENC_FOREST_02_OWL`

**Participants:** Сова  
**Window:** 16–19  
**Relationship target:** `UNDERSTANDING / early RECIPROCITY`

**Core contradiction**

> Точный признак ещё не гарантирует точности целой причины.

**What mascot adds**

Сова даёт наблюдаемые признаки, различение и проверяемость.

**What player adds**

Игрок связывает признаки с целым, средой или предыдущим состоянием.

**Knowledge / exit effect**

Более осторожная causal model; observation остаются отдельны от interpretation.



### `ENC_FOREST_02_CAT_OWL`

**Participants:** Кот + Сова  
**Window:** 16–19  
**Relationship target:** `UNDERSTANDING обеих нитей`

**Core contradiction**

> Прошлое и настоящее измеряют разные части одного изменения.

**What mascot adds**

Кот даёт THEN; Сова даёт NOW.

**What player adds**

Игрок реконструирует переход THEN → CHANGE → NOW.

**Knowledge / exit effect**

Temporal/contextual connection; не административный tie-fallback.



---

## 19. Encounter 3 variants

### `ENC_FOREST_03_FOX`

**Participants:** Лис  
**Window:** 25–29  
**Relationship target:** `ACQUAINTANCE / UNDERSTANDING`

**Core contradiction**

> Очевидный путь не единственный; найденный путь всё ещё требует основания.

**What mascot adds**

Лис видит affordance среды и боковой маршрут.

**What player adds**

Игрок может сам вывести identity, проверить маршрут, различить безопасный проход или заметить упущенный признак.

**Knowledge / exit effect**

Unknown Fox history подтверждается без destructive merge.

**Entry modes:** `DIRECT / TRACE / INFERRED / TOUCH`. Один variant адаптирует introduction beat под реальное knowledge-state; old observations сохраняются как provenance.



### `ENC_FOREST_03_CAT`

**Participants:** Кот  
**Window:** 25–29  
**Relationship target:** `RECIPROCITY candidate`

**Core contradiction**

> Похожая история ещё не означает ту же самую историю.

**What mascot adds**

Кот даёт память похожего случая и причинный контекст.

**What player adds**

Игрок показывает distinguishing evidence и новую причину.

**Knowledge / exit effect**

Old analogy reinterpreted, not erased.



### `ENC_FOREST_03_OWL`

**Participants:** Сова  
**Window:** 25–29  
**Relationship target:** `RECIPROCITY candidate`

**Core contradiction**

> Безупречные observations могут оставаться неполной картиной.

**What mascot adds**

Сова даёт качественный evidence и контроль поспешных связей.

**What player adds**

Игрок связывает несколько проверенных observations в более крупную hypothesis.

**Knowledge / exit effect**

Evidence bundle → larger interpretation.



### `ENC_FOREST_03_CAT_OWL`

**Participants:** Кот + Сова  
**Window:** 25–29  
**Relationship target:** `RECIPROCITY candidate`

**Core contradiction**

> Прошлый контекст и текущий признак нужны одновременно.

**What mascot adds**

Кот узнаёт pattern; Сова различает признаки.

**What player adds**

Игрок строит третью, более точную модель.

**Knowledge / exit effect**

Joint только при структурной необходимости.



---

## 20. Encounter 4 variants

### `ENC_FOREST_04_FOX_FIRST`

**Participants:** Лис  
**Window:** 35–39  
**Relationship target:** `ACQUAINTANCE / UNDERSTANDING`

**Core contradiction**

> Среда не только ограничивает движение — она предлагает возможности.

**What mascot adds**

Лис показывает поведение через маршрут и affordance.

**What player adds**

Игрок связывает потребность, действие, среду и проверяет путь.

**Knowledge / exit effect**

First meeting адаптируется к no-card / trace / inferred / touch state.

**Guard:** first meeting может быть story collision даже без раннего Fox observation, но сцена не имеет права утверждать, что игрок замечал старые следы, если они были только exposed.



### `ENC_FOREST_04_FOX_CONTINUATION`

**Participants:** Лис  
**Window:** 35–39  
**Relationship target:** `RECIPROCITY`

**Core contradiction**

> Интуитивно найденный путь ещё нужно проверить и объяснить.

**What mascot adds**

Лис быстро находит обход.

**What player adds**

Игрок замечает несовпадение с threat/resource/environment evidence и корректирует маршрут.

**Knowledge / exit effect**

Fox признаёт, что игрок дополняет его метод.



### `ENC_FOREST_04_CAT`

**Participants:** Кот  
**Window:** 35–39  
**Relationship target:** `RECIPROCITY`

**Core contradiction**

> Память о поведении не заменяет текущую среду.

**What mascot adds**

Кот даёт прошлый behavioral pattern.

**What player adds**

Игрок показывает новую relation: ресурс, угрозу, укрытие, территорию.

**Knowledge / exit effect**

Behavior interpretation becomes contextual.



### `ENC_FOREST_04_OWL`

**Participants:** Сова  
**Window:** 35–39  
**Relationship target:** `RECIPROCITY`

**Core contradiction**

> След действия не равен наблюдению намерения.

**What mascot adds**

Сова точно восстанавливает what happened.

**What player adds**

Игрок связывает resource/environment/threat в осторожную behavioral hypothesis.

**Knowledge / exit effect**

Separates action evidence from inferred need/intention.



### `ENC_FOREST_04_CAT_OWL`

**Participants:** Кот + Сова  
**Window:** 35–39  
**Relationship target:** `RECIPROCITY / shared history`

**Core contradiction**

> Похожее действие при изменившейся среде может иметь другую причину.

**What mascot adds**

Кот даёт прошлый pattern; Сова — current trace.

**What player adds**

Игрок показывает changed context.

**Knowledge / exit effect**

Past behavior ≠ current cause.



---

## 21. Encounter 5 variants

### `ENC_FOREST_05_OWL`

**Participants:** Сова  
**Window:** 45–49  
**Relationship target:** `MATURE RECIPROCITY`

**Core contradiction**

> Правильные A, B, C ещё не дают A ↔ B ↔ C.

**What mascot adds**

Сова даёт точные локальные interactions.

**What player adds**

Игрок связывает observations в multi-system model.

**Knowledge / exit effect**

Observation → system.



### `ENC_FOREST_05_CAT`

**Participants:** Кот  
**Window:** 45–49  
**Relationship target:** `MATURE RECIPROCITY`

**Core contradiction**

> Память может быть не архивом, а сетью контекстов.

**What mascot adds**

Кот помнит одну птицу в разных местах и временах.

**What player adds**

Игрок видит один объект как узел нескольких систем.

**Knowledge / exit effect**

Cross-time history becomes system knowledge.



### `ENC_FOREST_05_FOX`

**Participants:** Лис  
**Window:** 45–49  
**Relationship target:** `MATURE RECIPROCITY`

**Core contradiction**

> Маршрут сам способен связывать системы.

**What mascot adds**

Лис видит движение между точками.

**What player adds**

Игрок показывает seed transport, territory, predator pressure и другие network effects.

**Knowledge / exit effect**

Pathfinding → network reasoning.



### `ENC_FOREST_05_CAT_OWL`

**Participants:** Кот + Сова  
**Window:** 45–49  
**Relationship target:** `MATURE RECIPROCITY`

**Core contradiction**

> Identity across time + current relation precision нужны вместе.

**What mascot adds**

Кот даёт sightings history; Сова — current roles.

**What player adds**

Игрок интегрирует их в одну multi-system model.

**Knowledge / exit effect**

Joint only for identity-across-time problem.



### `ENC_FOREST_05_OWL_FOX`

**Participants:** Сова + Лис  
**Window:** 45–49  
**Relationship target:** `MATURE RECIPROCITY`

**Core contradiction**

> Локальные отношения и маршрут между ними — разные слои.

**What mascot adds**

Сова видит interactions; Лис — route.

**What player adds**

Игрок понимает, что route является relation between systems.

**Knowledge / exit effect**

Local relation + movement structure → network.



---

## 22. Encounter 6 variants

### `ENC_FOREST_06_OWL`

**Participants:** Сова  
**Window:** 55–59  
**Relationship target:** `LIMITATION + RECIPROCITY`

**Core contradiction**

> Строгость не требует буквальной видимости причины.

**What mascot adds**

Сова даёт независимые observations и проектирует критическую проверку.

**What player adds**

Игрок предлагает hidden-network hypothesis и prediction.

**Knowledge / exit effect**

Indirect evidence can support testable knowledge.



### `ENC_FOREST_06_CAT`

**Participants:** Кот  
**Window:** 55–59  
**Relationship target:** `LIMITATION + RECIPROCITY`

**Core contradiction**

> Разнесённые воспоминания могут быть проявлениями одной скрытой структуры.

**What mascot adds**

Кот даёт события across time/sites.

**What player adds**

Игрок сопоставляет delay, direction и independent signs.

**Knowledge / exit effect**

Remembered events → distributed pattern.



### `ENC_FOREST_06_FOX`

**Participants:** Лис  
**Window:** 55–59  
**Relationship target:** `LIMITATION + RECIPROCITY`

**Core contradiction**

> Путь может существовать без видимой тропы.

**What mascot adds**

Лис видит структуру переходов и возможные routes.

**What player adds**

Игрок различает surface route и causal/network connection.

**Knowledge / exit effect**

Pathfinding → hidden network reasoning.



### `ENC_FOREST_06_CAT_OWL`

**Participants:** Кот + Сова  
**Window:** 55–59  
**Relationship target:** `RECIPROCITY / shared method`

**Core contradiction**

> NOW + BEFORE нужны для вывода UNSEEN STRUCTURE.

**What mascot adds**

Сова даёт current effects; Кот — temporal distribution.

**What player adds**

Игрок выводит скрытую сеть.

**Knowledge / exit effect**

Temporal + current evidence → network.



### `ENC_FOREST_06_OWL_FOX`

**Participants:** Сова + Лис  
**Window:** 55–59  
**Relationship target:** `RECIPROCITY / shared method`

**Core contradiction**

> Интуитивная route-model должна выдержать evidence test.

**What mascot adds**

Лис предлагает structure; Сова проверяет признаки.

**What player adds**

Игрок собирает evidence bundle и связывает их.

**Knowledge / exit effect**

Route intuition → testable network model.



---

## 23. Encounter 7 variants

### `ENC_FOREST_07_CAT`

**Participants:** Кот  
**Window:** 65–69  
**Relationship target:** `PARTNER READINESS`

**Core contradiction**

> Прошлое не имеет права автоматически диктовать нынешнюю reconstruction.

**What mascot adds**

Кот даёт past state и historical sequence.

**What player adds**

Игрок добавляет contradiction trace и перестраивает model.

**Knowledge / exit effect**

Strong reciprocity; possible cooperation evidence.



### `ENC_FOREST_07_OWL`

**Participants:** Сова  
**Window:** 65–69  
**Relationship target:** `PARTNER READINESS`

**Core contradiction**

> Точный след ещё не равен точной истории.

**What mascot adds**

Сова даёт high-quality observations.

**What player adds**

Игрок отделяет known facts от reconstructed event и границы уверенности.

**Knowledge / exit effect**

Observation ≠ reconstruction.



### `ENC_FOREST_07_FOX`

**Participants:** Лис  
**Window:** 65–69  
**Relationship target:** `PARTNER READINESS`

**Core contradiction**

> Красивый маршрут ≠ доказанный маршрут.

**What mascot adds**

Лис даёт coherent possible path.

**What player adds**

Игрок проверяет provenance следов и разделяет overlapping histories.

**Knowledge / exit effect**

Possible route vs evidenced route.



### `ENC_FOREST_07_CAT_OWL`

**Participants:** Кот + Сова  
**Window:** 65–69  
**Relationship target:** `PARTNER READINESS / cooperation evidence`

**Core contradiction**

> Их методы измеряют разные части одной реальности.

**What mascot adds**

Кот даёт THEN; Сова — NOW.

**What player adds**

Игрок связывает time + evidence + uncertainty и переживает contradiction.

**Knowledge / exit effect**

Strongest Cat+Owl joint scene before temporary alliance.



---

## 24. Encounter 8 variants

### `ENC_FOREST_08_CAT`

**Participants:** Кот  
**Window:** 76–79  
**Relationship target:** `COOPERATION + TEMPORARY ALLIANCE`

**Core contradiction**

> Старую сеть нельзя просто восстановить: отношения изменились.

**What mascot adds**

Кот даёт прошлую структуру соседства.

**What player adds**

Игрок определяет changed relations, third-party effects и новые зависимости.

**Knowledge / exit effect**

Shared task; alliance ends after node.

**Required exit:** `cooperation_established=true`, `temporary_alliance_completed=true`; после story node `temporary_ally=false`.



### `ENC_FOREST_08_OWL`

**Participants:** Сова  
**Window:** 76–79  
**Relationship target:** `COOPERATION + TEMPORARY ALLIANCE`

**Core contradiction**

> Direct observations не показывают mediated/lagged influence целиком.

**What mascot adds**

Сова даёт точные current relations.

**What player adds**

Игрок связывает indirect relation, delay и environment mediation.

**Knowledge / exit effect**

Together build a testable network model.

**Required exit:** `cooperation_established=true`, `temporary_alliance_completed=true`; после story node `temporary_ally=false`.



### `ENC_FOREST_08_FOX`

**Participants:** Лис  
**Window:** 76–79  
**Relationship target:** `COOPERATION + TEMPORARY ALLIANCE`

**Core contradiction**

> Лучший local route одного может ухудшить сеть для других.

**What mascot adds**

Лис даёт alternatives и affordance.

**What player adds**

Игрок учитывает externalities, shared resources и third-party pressure.

**Knowledge / exit effect**

Path evaluated by systemic consequences.

**Required exit:** `cooperation_established=true`, `temporary_alliance_completed=true`; после story node `temporary_ally=false`.



---

## 25. Encounter 9 variants

### `ENC_FOREST_09_CAT`

**Participants:** Кот  
**Window:** 84–87  
**Relationship target:** `COOPERATION TRANSFER`

**Core contradiction**

> Цикл похож на прежний, но новый input меняет повтор.

**What mascot adds**

Кот даёт continuity и past cycle states.

**What player adds**

Игрок выбирает другую точку входа, различает новый input и вместе с Котом прогнозирует disruption.

**Knowledge / exit effect**

Internal shared-method tag: CONTINUITY_WITH_DIFFERENCE.

**Required proof:** shared method должен реально сработать в новом контексте; простого повторного применения mascot ability недостаточно.



### `ENC_FOREST_09_OWL`

**Participants:** Сова  
**Window:** 84–87  
**Relationship target:** `COOPERATION TRANSFER`

**Core contradiction**

> Не каждое звено большого цикла видно напрямую.

**What mascot adds**

Сова даёт verified links и critical test design.

**What player adds**

Игрок строит indirect system hypothesis; вместе они проверяют prediction.

**Knowledge / exit effect**

Internal tag: MODEL_THEN_VERIFY.

**Required proof:** shared method должен реально сработать в новом контексте; простого повторного применения mascot ability недостаточно.



### `ENC_FOREST_09_FOX`

**Participants:** Лис  
**Window:** 84–87  
**Relationship target:** `COOPERATION TRANSFER`

**Core contradiction**

> Альтернативный route может замкнуть цикл и одновременно создать pressure elsewhere.

**What mascot adds**

Лис даёт rapid alternate route.

**What player adds**

Игрок map-ит consequences; вместе они перестраивают путь.

**Knowledge / exit effect**

Internal tag: PATH_WITH_CONSEQUENCES.

**Required proof:** shared method должен реально сработать в новом контексте; простого повторного применения mascot ability недостаточно.



---

## 26. Encounter 10 variants

### `ENC_FOREST_10_CAT`

**Participants:** Кот  
**Window:** 89–90  
**Relationship target:** `RELATIONSHIP SYNTHESIS → COMPANION`

**Core contradiction**

> Память не должна превращаться в шаблон; новизна не должна отрицать прошлое.

**What mascot adds**

Кот даёт глубокую history/continuity пары.

**What player adds**

Игрок различает новый element и меняет собственный подтверждённый habitual method либо current incomplete model.

**Knowledge / exit effect**

Shared synthesis tag: LIVING_MEMORY.

**Internal synthesis tag:** `LIVING_MEMORY`. Это narrative tag, не название способности и не player-facing class.



### `ENC_FOREST_10_OWL`

**Participants:** Сова  
**Window:** 89–90  
**Relationship target:** `RELATIONSHIP SYNTHESIS → COMPANION`

**Core contradiction**

> Verification не требует прямой видимости каждого edge; hypothesis не равна свободной догадке.

**What mascot adds**

Сова даёт precision, evidence quality и critical prediction.

**What player adds**

Игрок даёт system synthesis и indirect inference, затем тоже меняет свой способ.

**Knowledge / exit effect**

Shared synthesis tag: TESTABLE_WHOLE.

**Internal synthesis tag:** `TESTABLE_WHOLE`. Это narrative tag, не название способности и не player-facing class.



### `ENC_FOREST_10_FOX`

**Participants:** Лис  
**Window:** 89–90  
**Relationship target:** `RELATIONSHIP SYNTHESIS → COMPANION`

**Core contradiction**

> Лучший путь оценивается по цели и последствиям; осторожность не должна убивать альтернативу.

**What mascot adds**

Лис даёт alternatives, path network и adaptation.

**What player adds**

Игрок добавляет network consequences/third parties и меняет свой первый план.

**Knowledge / exit effect**

Shared synthesis tag: RESPONSIBLE_PATH.

**Internal synthesis tag:** `RESPONSIBLE_PATH`. Это narrative tag, не название способности и не player-facing class.



---


## 27. Participant-specific joint IDs

Рабочие generic slots Content Registry v0.01:

```text
ENC_FOREST_04_JOINT
ENC_FOREST_05_JOINT
ENC_FOREST_06_JOINT
```

недостаточно точны для runtime authored identity, потому что participant-set является частью semantic identity сцены.

В этом registry фиксируются:

```text
ENC_FOREST_04_CAT_OWL

ENC_FOREST_05_CAT_OWL
ENC_FOREST_05_OWL_FOX

ENC_FOREST_06_CAT_OWL
ENC_FOREST_06_OWL_FOX
```

Другие pairings пока не authored.

Полный variant-set первого мира теперь содержит `37` slots.

---

## 28. Fallback — policy, а не безликая сцена

Не рекомендуется создавать универсальный `ENC_FOREST_XX_FALLBACK`, означающий «никто не подошёл — пришёл кто-нибудь».

Fallback должен выбрать существующий содержательный variant по authored policy.

### Encounter 2

1. unresolved Cat/Owl stage;
2. chapter focus и voluntary action;
3. Cat+Owl только при реальном `THEN + NOW` problem;
4. encounter обязан случиться к 19.

### Encounter 3

1. честный Fox direct/inferred entry + player continuation;
2. иначе Cat/Owl с нужной relational stage;
3. joint только при structural need;
4. final tie — last voluntary character-relevant action, затем authored chapter focus.

### Encounter 4–6

1. seeded unresolved contradiction;
2. player initiative;
3. stage need;
4. solo preferred, если он рассказывает тот же смысл;
5. joint только если без обоих теряется уникальный слой.

### Encounter 7

Fallback обязан оставить минимум одну thread `temporary_alliance_eligible` честным relational event.

### Encounter 8

Если eligible ally отсутствует — это graph validation failure. Нельзя random-pick или silently grant reciprocity.

### Encounter 9

Default — continuity с Encounter 8 ally. Switch допускается только по строгим guards раздела 15.

### Encounter 10

Используется tie-break раздела 16. `eligible_candidates=0` — P0 bug.

### Schema follow-up

Будущая редакция `STATE_SCHEMA` должна предпочесть:

```text
fallback_policy
fallback_candidate_order
```

вместо семантики «одна generic fallback scene».

---

## 29. Coverage without quota

Нельзя фиксировать:

```text
к level 50 Cat должен появиться N раз
Owl N раз
Fox N раз
```

Но фиксируются graph guarantees:

```text
level 20:
минимум Cat или Owl имеет understanding

level 70:
минимум одна available thread имеет temporary-alliance readiness

level 80:
одна thread имеет cooperation

level 90:
минимум одна thread eligible for synthesis

level 100:
ровно один first mascot companion acquired
```

Sleeping thread не уменьшается и не считается проигранной.

---

## 30. Encounter 11 — `ENC_FOREST_11_ELEMENTAL`

**Guards:** `forest_synthesis_complete=true`, `first_companion_acquired=true`, full manifestation event разрешён. Не нужны all observations, all revisits, all ★★★ или Fox encounter.

**Purpose:** не boss defeat, а взаимная различимость души и распределённого принципа Леса.

**Player adds:** world synthesis, способность видеть части через отношения и уже прожитый совместный путь с первым companion.

**Elemental adds:** ответ Леса как целого и подтверждение только тех element-thread observations, для которых существует authored provenance.

Allowed final linking может включать `KR_FOREST_PATTERN_REPEATING`, `KR_FOREST_RESPONSE_COORDINATED`, `KR_FOREST_MANIFESTATION_PARTIAL`. Guardian/Fox/прочие unresolved observations не поглощаются элементалем автоматически.

Exit:

```text
forest_world_complete = true
forest_elemental_encountered = true
```

Поля `forest_everything_known` не существует. Возможно exposure `WF_F70 constellation_fragment_01` как player-facing «Неполный узор».

---

## 31. QA matrix

| Case | Expected |
|---|---|
| high `memory`, но Owl unresolved contradiction сейчас содержательнее | Owl остаётся eligible; никакого `memory → Cat` |
| high `observation`, игрок умеет показать Коту изменение знакомой истории | Cat остаётся eligible |
| почти нет exploration, но Fox identity выведена по независимому evidence | Fox first meeting eligible |
| Cat получил Encounter 2 только потому, что routing его показал | сам факт сцены не усиливает future preference |
| Fox получил Encounter 3 и игрок явно продолжил его thread | Fox Encounter 4 continuation валиден |
| Fox получил Encounter 3, затем игрок нить не продолжал | Cat/Owl конкурентоспособны в Encounter 4 |
| Cat readiness ≈ Owl readiness, но joint не нужен задаче | выбрать solo, не Cat+Owl |
| Fox впервые встретился очень поздно и не имеет reciprocity/cooperation | нельзя перепрыгнуть сразу к companion |
| Fox не встречен к 90 | first companion гарантирован Cat/Owl |
| до Encounter 8 нет eligible ally | authoring/routing validation failure |
| Encounter 8 ally Cat, Owl имеет mature reciprocity и cycle-fit | Encounter 9 switch к Owl допустим и обязан установить cooperation |
| Owl имеет лишь высокий raw observation, но нет relation history | Encounter 9 switch к Owl запрещён |
| Encounter 10 Cat/Owl почти равны | использовать authored tie-break и сохранить routing snapshot |
| нет 2+ contexts для player limitation | использовать `PLAYER_CURRENT_MODEL_INCOMPLETE`, не выдумывать привычку |
| hint использован в Encounter 8, после него игрок завершил shared task | cooperation остаётся валидным |
| reasonable wrong hypothesis сломана новым evidence | revision без relationship penalty |
| level 90 transaction retry | no duplicate synthesis / companion / KnowledgeRecord |
| Elemental reveal | link only authored element-thread knowledge |

---

## 32. Authoring checklist финального script

Перед утверждением каждой variant-scene проверить:

1. Почему встреча происходит сейчас?
2. Почему этот персонаж, а не другой?
3. Какой способ Познания он приносит?
4. Какое ограничение его метода проявляется?
5. Что игрок добавляет, чего персонаж сам не дал?
6. Есть ли evidence для персональной реакции?
7. Что персонаж меняет в собственном понимании?
8. Какой relationship milestone действительно earned?
9. Как меняется knowledge-state?
10. Можно ли удалить сцену без изменения арки?
11. Не возник ли hidden class?
12. Не стала ли joint-scene screen-time компромиссом?
13. Не повторяет ли encounter предыдущую сцену тем же способом?
14. Есть ли честный fallback?
15. Идемпотентен ли significant result при retry?

---

## 33. Что v0.01 фиксирует

```text
Encounter 1–11 purpose
windows
participant sets
37 variant IDs
anti-hidden-class routing
anti-feedback-loop routing
joint-scene law
relationship milestone semantics
Encounter 2–7 coverage responsibilities
Encounter 8 temporary alliance
Encounter 9 switch guards
Encounter 10 eligibility + tie-break
Cat/Owl/Fox synthesis kernels
Encounter 11 elemental role
fallback as authored policy
QA invariants
```

---

## 34. Что остаётся открытым

Отдельным final authoring-pass остаются:

- точные реплики и Voice Card copy;
- exact layout/puzzle каждого variant;
- level-local entrance/exit scenes;
- точные numeric routing thresholds/tuning;
- final hints;
- exact analytics reason codes;
- финальное имя, голос и encounter-format Лесного элементаля.

---

## 35. Статус после encounter architecture v0.04

Knowledge-layer уже зафиксирован в:

```text
WORLD_FOREST_KNOWLEDGE_REGISTRY_v0.05
```

Revisit и Synthesis также имеют отдельные актуальные registries.

Следующий этап encounter-системы — не новый фундаментальный документ, а final authoring + implementation:

```text
exact scripts / voice copy
exact puzzle layouts
numeric routing tuning
analytics/debug reason codes
engine integration
QA fixtures against real save-state
```
