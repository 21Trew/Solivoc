# WORLD FOREST SYNTHESIS REGISTRY — Мир Леса

> **Статус:** рабочий production synthesis registry  
> **Версия:** 0.03  
> **World ID:** `forest`  
> **Охват:** подготовка уровней `91–98`, Испытание Синтеза Леса `99`, player-initiated world reveal и handoff в уровень `100`  
> **Основание:** `WORLD_FOREST_LEVEL_BLUEPRINT_v0.13`, `WORLD_FOREST_DOSSIER_v0.18`, `WORLD_FOREST_STATE_SCHEMA_v0.05`, `WORLD_FOREST_CONTENT_REGISTRY_v0.08`, `WORLD_FOREST_KNOWLEDGE_REGISTRY_v0.05`, `WORLD_FOREST_ENCOUNTER_REGISTRY_v0.04`, `WORLD_FOREST_REVISIT_REGISTRY_v0.03`, `GAME_VISION_MANIFEST_v0.12`  
> **Назначение:** зафиксировать содержательный и state-контракт финального Синтеза первого большого мира: что именно проверяется, как работают пять фаз, как участвует первый спутник, как устроены подсказки и ошибки, каким действием игрок сам завершает системное понимание и почему это открывает встречу с Лесным элементалем, не создавая его.

---

## 1. Верхний закон

Испытание Синтеза НЕ спрашивает:

> **«Помнишь ли ты девять предыдущих уроков?»**

Оно спрашивает:

> **«Способен ли ты теперь смотреть на один живой узел так, чтобы части, отношения, направление, время и контекст одновременно образовали рабочую систему?»**

Формула:

```text
отдельные знания
↓
не повторяются по очереди

они
↓
работают одновременно

и только тогда
↓
становится различимым целое
```

---

## 2. Синтез не является экзаменом на completion

Hard prerequisites:

```text
levels 1–98 core progression complete
+
first companion acquired
+
mandatory companion reveal level 90 completed
```

Не являются gates:

```text
all optional observations
all reconstructions
all revisits
all ★★★
Fox encountered
Pattern card opened
Forest Response card opened
partial manifestation card opened
high Cognition score
```

Если игрок дошёл до 99-го уровня честным основным путём, core campaign уже обязана была дать ему необходимый язык.

Отдельный скрытый `knowledge_score` не может запретить Синтез.

---

## 3. Что optional history меняет

Optional history влияет на:

```text
provenance
personal echoes
доступные дополнительные узнавания
реплики спутника
варианты визуального retrospective
дополнительные допустимые связи
```

Но не создаёт:

```text
более «правильный» финал
обязательный shortcut
скрытый пропуск
автоматическое решение
```

Канонический принцип:

> **Внимательность углубляет Синтез, но не покупает право на него.**

---

## 4. Уровни 91–98 — подготовка, а не восемь частей экзамена

Финальный ритм уже фиксирован:

```text
91–93
спутничество становится обычной жизнью

94–96
масштаб вопроса расширяется
от локальной связи к распределённой системе

97
один организационный мотив
виден на разных масштабах,
но сходство не объявляется общей причиной

98
Поляна увидена снова
из текущего состояния души

99
Синтез

100
взаимная различимость
с Лесным элементалем
```

Уровень 99 не должен заново обучать этим идеям.

Он предполагает, что игрок уже встречал их в gameplay.

---

## 5. Подготовительная функция уровней 91–98

| Level | Что становится нормой перед Синтезом |
|---:|---|
| `91` | один объект одновременно участвует в нескольких знакомых отношениях; спутник — новая обычная часть пути |
| `92` | роль объекта зависит от системы и контекста |
| `93` | влияние продолжается после завершения исходного действия |
| `94` | локально хорошее решение может создавать системное давление |
| `95` | граница объекта не равна границе его влияния |
| `96` | целостная система не обязана иметь управляющий центр |
| `97` | похожая форма организации не означает буквальную общую причину |
| `98` | знакомое место становится другим знанием без переписывания прошлого |

---

# PART I. SYNTHESIS CONTENT IDENTITY

## 6. Главный authored ID

```text
SYN_FOREST_WORLD_01
```

Тип:

```text
world_synthesis
```

Level:

```text
99
```

Core scene:

```text
SCN_FOREST_L099_WORLD_SYNTHESIS
```

Player-initiated culmination scene:

```text
SCN_FOREST_L099_SYNTHESIS_REVELATION
```

Knowledge output:

```text
REC_FOREST_WORLD_SYNTHESIS_01
→
KR_FOREST_WORLD_SYNTHESIS
```

---

## 7. Пять authored phases

```text
SYN_FOREST_WORLD_01_DISTINGUISH
SYN_FOREST_WORLD_01_MULTI_RELATION
SYN_FOREST_WORLD_01_DIRECTION
SYN_FOREST_WORLD_01_TIME
SYN_FOREST_WORLD_01_WHOLE
```

После пятой фазы существует отдельное состояние:

```text
MODEL_SOLVED
```

Оно НЕ равно:

```text
forest_synthesis_complete
```

Переход к `forest_synthesis_complete` выполняется только через player-initiated revelation.

---

## 8. Не шестая фаза, а момент Познания

После успешного `WHOLE`:

```text
SYNTHESIS_MODEL_SOLVED
↓
INTEGRATE_SYSTEM ready
↓
игрок сам нажимает
[Увидеть целое]
↓
WORLD SYNTHESIS REVELATION
↓
forest_synthesis_complete = true
↓
level 100 unlocked
```

Техническое action:

```text
INTEGRATE_SYSTEM
```

Рекомендуемый player-facing copy первого мира:

> **Увидеть целое**

Это не выбор правильного ответа.

Ответ уже построен самим игроком в пяти фазах.

Кнопка означает:

> **«Я связываю то, что только что смог удержать вместе, в новое состояние знания».**

---

# PART II. SYSTEM BOARD

## 9. Один живой узел вместо энциклопедии Леса

Level 99 использует не:

```text
по одному объекту
из каждой главы
для галочки
```

а один authored **живой участок Леса**, в котором знания девяти глав реально пересекаются.

Рабочий authored board:

```text
SYN_FOREST_WORLD_01_BOARD
```

Смысл:

> **локальное изменение проходит через участок Леса и обнаруживает несколько пересекающихся систем.**

Точный набор слов/карт может проходить финальный lexical pass, но semantic roles фиксируются этим registry.

---

## 10. Core semantic roles board

Board должен содержать минимум следующие роли:

```text
STRUCTURAL_LIVING_NODE
дерево / крупное растение / устойчивая структура

MOBILE_CREATURE
птица или зверь

PLANT_OR_SEED
растение / плод / семя

DECOMPOSER
гриб / процесс разложения

SOIL_OR_SUBSTRATE
почва / среда

RESOURCE_OR_CONDITION
свет / влага / пищевой ресурс

RESIDUE_OR_TRACE
последствие уже завершившегося действия

ROUTE_OR_ACCESS
маршрут / доступ / перемещение
```

Не все роли обязаны быть отдельными буквальными карточками.

Некоторые могут быть:

- состоянием;
- relation;
- последствием;
- environmental condition.

---

## 11. Core semantic graph должен быть распределённым

Внутренний target graph обязан содержать:

```text
6+ meaningful nodes
7+ meaningful relations
4+ relation families
1+ node with multiple contextual roles
1+ asymmetric/directional relation
1+ mediated relation
1+ temporal continuation
1+ feedback/cycle fragment
```

Это internal validation.

Игрок НЕ видит checklist:

```text
Relations 6/7
Systems 3/4
```

---

## 12. Запрещён центральный контроллер

Target graph не должен быть устроен:

```text
FOREST
→ controls everything
```

или:

```text
ONE TREE
→ all other nodes
```

Даже если один объект является локальным focus конкретной фазы, итоговая целостность должна переживать мыслительный эксперимент:

```text
если убрать предполагаемый центр,
существуют ли другие пути связи?
```

Это продолжает уровень 96:

> **Целостность может быть распределённым свойством отношений.**

---

# PART III. RELATION LANGUAGE

## 13. Relation families

Level 99 использует знакомые player-facing отношения, а не новую техническую терминологию.

Core families:

```text
FUNCTION / USE
служит пищей
даёт укрытие
создаёт ресурс

DEPENDENCY / CONDITION
зависит от света
зависит от влаги
нуждается в среде / субстрате

MOVEMENT / TRANSPORT
переносит
соединяет маршрутом
изменяет доступ

TRANSFORMATION
разлагает
превращает результат в новый ресурс
изменяет почву / состояние среды

PRESSURE / CONSTRAINT
конкурирует за ресурс
ограничивает путь
создаёт давление

TRACE / CONSEQUENCE
оставляет след
последствие продолжается после действия

MEDIATED INFLUENCE
A → среда → C

TEMPORAL / CYCLE
результат одного процесса
становится условием следующего
```

Ни одна family не является моральной шкалой.

---

## 14. Истинная связь может быть несущественной текущему вопросу

Одна из главных сложностей Синтеза:

```text
relation TRUE
≠
relation RELEVANT HERE
```

Например у объекта одновременно могут быть реальные связи с:

- пищей;
- укрытием;
- маршрутом;
- переносом;
- угрозой.

Phase 2 требует понять:

> **какая из нескольких правдивых связей объясняет текущий системный вопрос?**

Это продолжает фундамент неоднозначности Словасьянса.

---

# PART IV. PHASE I — DISTINGUISH

## 15. `SYN_FOREST_WORLD_01_DISTINGUISH`

Главный вопрос:

> **«Какие ближайшие отношения здесь действительно существуют?»**

### Input

Player видит:

- несколько объектов/состояний;
- несколько plausible relation;
- часть relations похожи по внешнему признаку, но различаются по функции.

### Required cognition

```text
observation
comparison
verification
context
```

### Task contract

Игрок связывает несколько direct relations.

Он должен отличить:

```text
объект рядом
≠
объект функционально связан
```

и:

```text
похожая форма
≠
одинаковая функция
```

### Success

Phase считается решённой, когда direct relation foundation достаточно надёжен для дальнейших фаз.

### Ошибка

Неверная или недостаточно поддержанная relation не сопровождается:

```text
«НЕПРАВИЛЬНО»
```

без объяснения.

Игра показывает:

- какой ожидаемый effect не возникает;
- какой контекст не совпадает;
- какое evidence противоречит связи.

---

# PART V. PHASE II — MULTI RELATION

## 16. `SYN_FOREST_WORLD_01_MULTI_RELATION`

Главный вопрос:

> **«Как одна и та же вещь может быть частью нескольких систем одновременно?»**

### Core structure

Минимум один node имеет:

```text
2–3 реальные relation
```

к разным systems.

Например один mobile creature может одновременно:

- использовать укрытие;
- питаться;
- переносить;
- быть добычей;
- менять маршрут другого.

### Player task

Не найти единственную «настоящую роль».

Нужно:

1. удержать несколько истинных roles;
2. выбрать relation, существенную текущему вопросу;
3. не уничтожить остальные.

### Success

Model сохраняет:

```text
MULTI_ROLE
```

вместо:

```text
SINGLE_LABEL
```

---

# PART VI. PHASE III — DIRECTION

## 17. `SYN_FOREST_WORLD_01_DIRECTION`

Главный вопрос:

> **«Куда именно проходит влияние — и обязательно ли оно прямое?»**

### Required structures

Phase содержит минимум:

```text
A → B
B → A
```

с разным смыслом,

и:

```text
A → environment → C
```

или другой mediated path.

### Player task

Нужно различить:

```text
кто на кого влияет
каким способом
через что проходит влияние
```

### Forbidden simplification

```text
A связан с B
```

без direction недостаточно там, где направление меняет смысл.

### Success

В model появляется минимум:

```text
1 asymmetric relation
+
1 mediated relation
```

---

# PART VII. PHASE IV — TIME

## 18. `SYN_FOREST_WORLD_01_TIME`

Главный вопрос:

> **«Что происходит со связью после того, как исходное действие закончилось?»**

### Required structure

Часть effect превращается в новый condition:

```text
ACTION
↓
RESULT
↓
NEW CONDITION
↓
NEXT PROCESS
```

и хотя бы один fragment становится:

```text
feedback / cycle
```

### Player task

Игрок добавляет temporal order к уже построенной network.

Это не новая отдельная сеть.

Это:

> **та же система, увиденная во времени.**

### Important law

Cycle не обязан иметь absolute start.

Phase принимает разные valid entry points, если causal order внутри модели согласован.

---

# PART VIII. PHASE V — WHOLE

## 19. `SYN_FOREST_WORLD_01_WHOLE`

Главный вопрос:

> **«При какой структуре эти части становятся одной работающей системой?»**

### Не просит

```text
выбрать карту «Лес»
```

### Player task

Игрок должен:

- удержать direct relations;
- сохранить multi-role;
- учитывать direction;
- учитывать mediated effects;
- учитывать time;
- не искать одного управляющего центра;
- собрать достаточную, но не исчерпывающую network model.

### Success invariant

Система считается решённой, если model:

```text
coherent
distributed
context-sensitive
temporally meaningful
```

и объясняет заданное изменение участка без одного универсального ответа.

### Important

Игрок НЕ обязан соединить каждую возможную пару.

> **Синтез — это достаточная модель целого, а не максимальное количество линий.**

---

# PART IX. COMPANION INTEGRATION

## 20. Спутник — перспектива, не ключ

Первый спутник присутствует на уровне 99.

Но:

```text
Cat
Owl
Fox
```

не создают три разные версии сложности.

Core system board один.

---

## 21. Кот — synthesis lens

Кот foreground-ит:

```text
что было раньше
что изменилось
какое старое observation
теперь входит в другую историю
```

Его подсказка помогает фазам:

```text
TIME
WHOLE
```

но может быть полезна раньше.

### Не делает

Кот не строит temporal chain вместо игрока.

---

## 22. Сова — synthesis lens

Сова foreground-ит:

```text
что observation
что interpretation
какой признак различает
две близкие relation
что можно проверить
```

Особенно естественна для:

```text
DISTINGUISH
DIRECTION
```

### Не делает

Сова не подсвечивает «правильную стрелку».

---

## 23. Лис — synthesis lens

Лис foreground-ит:

```text
какой другой путь влияния существует
что произойдёт,
если текущий route закрыть
можно ли пройти через другой узел
```

Особенно естественен для:

```text
DIRECTION
WHOLE
```

### Не делает

Лис не превращает финал в поиск secret route.

---

## 24. Companion ability usage optional

Игрок может:

```text
использовать ability
не использовать
использовать редко
```

Это НЕ влияет на:

- relationship quality;
- право пройти;
- число звёзд автоматически;
- финальную встречу.

После уровня 90 спутничество уже не проверяется через «докажи, что используешь способность».

---

# PART X. HINT CONTRACT

## 25. Общая подсказка существует у всех

Любой игрок, независимо от спутника, имеет common fallback-hint.

Подсказка отвечает:

> **«На какую сторону модели ещё стоит посмотреть?»**

а не:

> «соедини X с Y».

---

## 26. Common hint by phase

### DISTINGUISH

> **Какая связь здесь подтверждается не соседством, а тем, что эти вещи действительно делают друг с другом?**

### MULTI_RELATION

> **Может ли этот объект быть частью нескольких правдивых отношений одновременно?**

### DIRECTION

> **Если влияние идёт отсюда, куда именно оно приходит — и нет ли между ними промежуточного звена?**

### TIME

> **Что становится условием следующего изменения после того, как это действие уже закончилось?**

### WHOLE

> **Если убрать предполагаемый главный узел, останутся ли другие пути, которые удерживают систему связанной?**

Exact copy может уточняться в UX/voice pass.

---

## 27. Companion-specific hint меняет lens, а не ответ

Для одной и той же проблемной точки:

```text
Кот
→ «что изменилось по сравнению с тем,
что уже было?»

Сова
→ «что здесь observation,
а что мы только объясняем?»

Лис
→ «каким другим путём
это влияние могло пройти?»
```

Ни один hint не выдаёт ready-made relation.

---

# PART XI. OPTIONAL KNOWLEDGE ENRICHMENT

## 28. Optional cards do not enter required slot list

Если игрок имеет:

```text
KR_FOREST_PATTERN_REPEATING
KR_FOREST_RESPONSE_COORDINATED
event reconstructions
Fox history
optional revisit knowledge
```

Level 99 может:

- узнаваемо визуально рифмовать их;
- показывать extra provenance;
- давать короткую companion reaction;
- разрешать дополнительную true relation.

Но core board остаётся решаемым без них.

---

## 29. Pending optional revelations before level 99

Игрок не обязан очищать inbox knowledge перед Синтезом.

Допустимо:

```text
optional REVELATION_READY remains pending
```

Level 99 не блокируется.

Исключение:

```text
mandatory companion reveal level 90
```

потому что глава 10 уже требует реального спутника.

---

## 30. Level 98 foreground budget

Level 98 может foreground-ить максимум небольшой authored набор новых пониманий, нужных драматургии.

Он не должен превращаться в:

```text
«перед финалом открой 14 накопленных карточек»
```

Синтез начинается с ощущения собранности, а не с административной уборки.

---

# PART XII. FAILURE, REVISION, RETRY

## 31. Ошибка — это локальная гипотеза

Неправильная relation трактуется как:

```text
model proposal
```

а не:

```text
провал души
```

Feedback показывает:

- где model перестала объяснять system state;
- где consequence не совпало;
- какое relation конфликтует с context.

---

## 32. No relationship penalty

Ошибка / restart / hint:

```text
НЕ уменьшают
understanding
reciprocity
cooperation
companion state
```

Спутник не разочаровывается в игроке из-за normal reasoning error.

---

## 33. Phase checkpointing

После каждой завершённой phase сервер фиксирует:

```text
FOREST_SYNTHESIS_PHASE_COMPLETED
```

с:

```text
synthesis_id
phase_id
attempt_id
solution_state_hash / authored equivalent
```

Crash/reconnect восстанавливает последний committed checkpoint.

---

## 34. Внутрифазовая persistence

Рекомендуется сохранять current attempt snapshot достаточно часто, чтобы mobile crash не заставлял заново проходить большую часть level 99.

Но granular drag/card movements:

- не обязаны становиться вечными semantic events;
- могут храниться как resumable gameplay snapshot.

Semantic history сохраняет phase outcomes.

---

## 35. Restart

Игрок может:

```text
перезапустить текущую phase
или
перезапустить attempt
```

Story progress не уменьшается.

Если возвращается к фазе I, это не стирает knowledge, полученное до level 99.

---

## 36. Replay after world completion

После first completion:

```text
REPLAY LEVEL 99
```

может существовать для:

- ★★★;
- mastery;
- personal record.

Он НЕ:

- повторяет first world revelation;
- снова ставит `forest_synthesis_complete`;
- повторно unlock-ит Encounter 11;
- создаёт второй `KR_FOREST_WORLD_SYNTHESIS`.

---

# PART XIII. PLAYER-INITIATED WORLD REVELATION

## 37. Solve is not reveal

После Phase V:

```text
synthesis_model_solved = true
```

Сервер фиксирует:

```text
FOREST_SYNTHESIS_MODEL_SOLVED
FOREST_KNOWLEDGE_REVELATION_READY
```

Но пока:

```text
forest_synthesis_complete = false
KR_FOREST_WORLD_SYNTHESIS
не создаётся / не обновляется до final state
level 100 locked
```

---

## 38. Player action

Игрок видит итоговую network, которую сам построил.

Доступно действие:

> **Увидеть целое**

Technical:

```text
INTEGRATE_SYSTEM
```

После нажатия начинается:

```text
SCN_FOREST_L099_SYNTHESIS_REVELATION
```

---

## 39. Визуальный принцип revelation

Точный motion language остаётся UX-pass.

Но семантика фиксирована:

1. исходные nodes не исчезают;
2. relations не заменяются одной картой;
3. локальные clusters начинают читаться одновременно;
4. temporal layer перестаёт быть отдельной «фазой» и становится частью общей модели;
5. изображение становится цельнее, но не превращается в силуэт элементаля;
6. появляется `KR_FOREST_WORLD_SYNTHESIS`.

Игрок должен почувствовать:

> **«Я не получил ответ. Я наконец способен удержать эту структуру целиком».**

---

## 40. Knowledge output

После `INTEGRATE_SYSTEM`:

```text
REC_FOREST_WORLD_SYNTHESIS_01
→ current reconstruction/system model

KR_FOREST_WORLD_SYNTHESIS
→ player-facing knowledge record
```

Рабочая proposition:

> **Лес является целым не потому, что рядом находится много живого, а потому, что между его частями существует распределённая сеть взаимного влияния.**

Это НЕ:

> «Я знаю всё о Лесе».

---

## 41. Completion transaction level 99

Atomic transaction:

```text
FOREST_KNOWLEDGE_REVELATION_STARTED
FOREST_SYNTHESIS_COMPLETED
FOREST_KNOWLEDGE_REVELATION_COMPLETED

forest_synthesis_complete = true

create/update:
REC_FOREST_WORLD_SYNTHESIS_01
KR_FOREST_WORLD_SYNTHESIS

unlock:
level 100
```

Idempotency scope:

```text
player
+
SYN_FOREST_WORLD_01
+
INTEGRATE_SYSTEM
```

Повторный tap/retry не создаёт дубль.

---

## 42. Reduced motion

Reduced-motion:

- сохраняет player action;
- сохраняет паузу и момент открытия;
- использует спокойное crossfade / focus shift / line reveal;
- приводит к абсолютно тем же semantic events.

Accessibility не уменьшает значимость момента.

---

# PART XIV. HANDOFF TO LEVEL 100

## 43. Что level 99 НЕ делает

После `Увидеть целое`:

```text
НЕ появляется Лесной элементаль
НЕ создаётся boss
НЕ подтверждаются все mysteries
НЕ выдаётся world completion
```

Синтез создаёт:

> **способность души различить целое.**

---

## 44. Start condition level 100

Level 100 доступен только если:

```text
forest_synthesis_complete = true
KR_FOREST_WORLD_SYNTHESIS revelation completed
first_companion_acquired = true
```

---

## 45. Level 100 begins with familiar Forest

Начало level 100 должно сначала показать:

```text
тот же Лес
```

а не:

```text
новую арену босса
```

Игрок уже имеет system model.

Поэтому знакомые:

- звуки;
- ветвящиеся формы;
- маршруты;
- отклики;
- циклы

могут читаться одновременно.

---

## 46. Elemental is not spawned by synthesis

Каноническая причинность:

```text
душа стала способна
различить целое
+
Лес способен ответить
↓
возможна встреча
```

Не:

```text
правильный ответ
→ summon elemental
```

---

# PART XV. ELEMENTAL RECOGNITION

## 47. Encounter 11 confirms encounter reality, not silent card morph

На level 100:

```text
WE_FOREST_ELEMENTAL_FULL_MANIFESTATION_01
+
ENC_FOREST_11_ELEMENTAL
```

делают direct confirmation реальной встречи.

Но player-facing knowledge transition следует `PLAYER_INITIATED_REVELATION`.

После encounter становится ready:

```text
RECOGNIZE_ENTITY
```

Рекомендуемый copy:

> **Узнать**

или более контекстная формулировка из будущего Elemental Dossier.

---

## 48. Elemental KnowledgeRecord transition

### Если была partial manifestation card

```text
KR_FOREST_MANIFESTATION_PARTIAL
observation
↓
RECOGNIZE_ENTITY
↓
same root history
character.forest_elemental
```

### Если partial record не был создан

После `RECOGNIZE_ENTITY` создаётся:

```text
KR_FOREST_ELEMENTAL_CHARACTER
```

`Pattern` и `Response` остаются отдельными linked observations.

---

## 49. World completion ritual

Для первого мира рекомендуется считать mandatory Elemental recognition частью завершения level 100.

То есть:

```text
Encounter 11 direct meeting
↓
RECOGNIZE_ENTITY ready
↓
игрок нажимает
[Узнать]
↓
Elemental knowledge reveal
↓
forest_world_complete = true
```

Это делает финальное раскрытие не фоновой записью save-state, а прожитой кульминацией.

---

## 50. World completion transaction

После mandatory `RECOGNIZE_ENTITY`:

```text
FOREST_KNOWLEDGE_REVELATION_STARTED
FOREST_ELEMENTAL_STAGE_CHANGED → FULL_MANIFESTATION
FOREST_ENCOUNTER_11_COMPLETED
FOREST_KNOWLEDGE_REVELATION_COMPLETED

forest_elemental_encountered = true
forest_world_complete = true
```

При этом:

```text
forest_synthesis_complete
```

уже был установлен на уровне 99.

---

# PART XVI. ELEMENTAL LINKING

## 51. Allowed final links

После reveal могут быть связаны с Elemental history:

```text
KR_FOREST_PATTERN_REPEATING
KR_FOREST_RESPONSE_COORDINATED
KR_FOREST_MANIFESTATION_PARTIAL
KR_FOREST_WORLD_SYNTHESIS
```

и дополнительные записи только при explicit elemental provenance.

---

## 52. Не все mystery получают ответ

Не связывать автоматически:

```text
Fox evidence
Guardian dormant facts
каждый old mark
каждый animal track
все незавершённые reconstruction
```

Финальный закон:

> **Увидеть целое не значит узнать всё.**

---

# PART XVII. WF_F70 HANDOFF

## 53. После Elemental encounter появляется ещё больший вопрос

Objective fact:

```text
WF_F70 constellation_fragment_01
```

Player-facing:

```text
KR_FOREST_CONSTELLATION_INCOMPLETE
```

Рабочее имя:

> **Неполный узор**

---

## 54. `WF_F70` не обязана автоматически становиться карточкой

После world completion возможно:

```text
WF_F70 exposed
```

Но отдельная observation появляется только если игрок:

- замечает;
- рассматривает;
- осмысленно выделяет деталь.

Если не выделил:

```text
exposed = true
noticed = false
```

и future content может честно вернуть её позже.

World completion не блокируется.

---

## 55. Почему это важно

Финал должен одновременно дать:

```text
ЗАВЕРШЕНИЕ
«я увидел Лес как целое»

и

ОТКРЫТОСТЬ
«за этим целым существует
ещё больший рисунок»
```

То есть:

```text
world complete
≠
knowledge closed
```

---

# PART XVIII. STATE CONTRACT

## 56. Attempt state

Runtime attempt должен различать:

```text
NOT_STARTED
IN_PROGRESS
MODEL_SOLVED
REVELATION_READY
REVELATION_IN_PROGRESS
COMPLETED
```

`COMPLETED` означает:

```text
INTEGRATE_SYSTEM committed
```

а не просто Phase V solved.

---

## 57. Phase state

Для каждой phase:

```text
locked
active
solved
```

Допустим resumable `working_snapshot`.

Phase state является attempt-state, а не lifetime Cognition property.

---

## 58. Required semantic events

```text
FOREST_SYNTHESIS_STARTED
FOREST_SYNTHESIS_PHASE_COMPLETED
FOREST_SYNTHESIS_MODEL_SOLVED

FOREST_KNOWLEDGE_REVELATION_READY
FOREST_KNOWLEDGE_REVELATION_STARTED
FOREST_SYNTHESIS_COMPLETED
FOREST_KNOWLEDGE_REVELATION_COMPLETED
```

---

## 59. Не создаём итоговый рейтинг Познания

После уровня 99/100 не появляется:

```text
Синтез: 83%
Системность: A+
Тип души: Аналитик
```

Gameplay mastery может иметь:

- звёзды;
- score;
- retry goals;

но narrative interpretation не превращается в экзаменационную оценку личности.

---

# PART XIX. QA

## 60. QA — optional completion

Player:

```text
Fox unseen
Pattern card absent
few revisits
core 1–98 complete
companion = Owl
```

Expected:

```text
level 99 available
all five phases solvable
```

---

## 61. QA — no hidden knowledge gate

Player reached 99 but some rebuildable `CognitionProjection` was reset.

Expected:

```text
Synthesis remains available
```

Core progression is enough.

---

## 62. QA — companion parity

Run same core board with:

```text
Cat
Owl
Fox
```

Expected:

```text
same semantic target
same hard success criteria
different lens/hints/reactions
```

No route has a strictly easier mandatory solution.

---

## 63. QA — not recap

If a phase can be solved only by remembering:

```text
«в главе 4 нам сказали X»
```

without reading current system state, authoring fails.

---

## 64. QA — true but irrelevant relation

A relation is globally plausible/true but does not answer current system question.

Expected:

```text
game explains relevance/context mismatch
```

not arbitrary «wrong».

---

## 65. QA — direction

Player creates:

```text
A ↔ B
```

where authored meaning requires:

```text
A → B
```

Expected:

```text
model insufficient
```

unless reverse relation separately exists.

---

## 66. QA — cycle start

Two players enter same valid cycle from different nodes.

Expected:

```text
both accepted
```

if temporal causal structure is coherent.

---

## 67. QA — no central controller

Player builds star graph around one central node.

Expected:

- Phase V demonstrates fragility/insufficiency;
- player must recognize alternate distributed relations.

Not:

```text
central controller accepted
```

only because every node is connected.

---

## 68. QA — wrong hypothesis

Player proposes reasonable relation that later breaks.

Expected:

```text
revision
no relationship penalty
no Cognition penalty
```

---

## 69. QA — crash after phase IV

App closes after committed Phase IV.

Expected on resume:

```text
Phases I–IV solved
Phase V active
```

No need replay whole level.

---

## 70. QA — crash after model solved, before reveal

Expected:

```text
MODEL_SOLVED
REVELATION_READY
button «Увидеть целое»
```

Level 100 remains locked.

---

## 71. QA — double tap reveal

Expected:

```text
one synthesis completion
one KnowledgeRecord transition
one level-100 unlock
```

---

## 72. QA — replay level 99

After world completion replay level 99.

Expected:

```text
mastery attempt only
no first reveal
no duplicate KR
no duplicate elemental unlock
```

---

## 73. QA — Elemental not auto-revealed

After `INTEGRATE_SYSTEM` level 99:

Expected:

```text
forest_synthesis_complete = true
forest_elemental_encountered = false
```

---

## 74. QA — Elemental card requires ritual

Encounter 11 occurred, direct confirmation exists.

Before player action:

```text
RECOGNIZE_ENTITY ready
```

After action:

```text
character.forest_elemental
world complete
```

No duplicate if retried.

---

## 75. QA — WF_F70 remains optional

Player completes world but does not inspect the new distant pattern.

Expected:

```text
forest_world_complete = true
WF_F70 exposed
noticed = false
no KR_FOREST_CONSTELLATION_INCOMPLETE
```

Later content can surface it honestly.

---

# PART XX. AUTHORING STATUS

## 76. Что v0.01 фиксирует

```text
hard prerequisites level 99
no hidden knowledge-score gate
91–98 preparation responsibilities
one living-system board law
distributed target graph
relation-family language
five phase contracts
companion parity and lens
common + companion hint law
optional knowledge enrichment
failure/revision contract
phase checkpointing
crash/retry contract
MODEL_SOLVED ≠ COMPLETE
mandatory [Увидеть целое]
KR_FOREST_WORLD_SYNTHESIS reveal
99 → 100 handoff
Elemental is not spawned
mandatory Elemental recognition ritual
world completion after RECOGNIZE_ENTITY
WF_F70 optional observation handoff
QA invariants
```

---

## 77. Что остаётся `TBD_AUTHORED`

1. exact lexical/card set `SYN_FOREST_WORLD_01_BOARD`;
2. exact визуальная композиция board;
3. exact relation distractors;
4. exact star/mastery criteria;
5. exact number of allowed undo/revision without mastery cost;
6. final hint copy;
7. final companion voice lines;
8. motion/audio language `Увидеть целое`;
9. full Elemental Dossier/name/voice;
10. exact visual appearance of `WF_F70`;
11. exact post-world screen/navigation.

Эти пункты не меняют фундаментальную synthesis architecture.

---

## 78. Статус первого Мира Леса после этого registry

Фундаментальные content-pass:

```text
ENCOUNTER
✓

KNOWLEDGE
✓

REVISIT
✓

SYNTHESIS
✓
```

Machine-readable content package уже сформирован и валидируется автоматически.

Следующий этап:

```text
implementation architecture audit
+
migration plan
+
final script/copy pass
+
character ability specs
+
Elemental dossier
```

Нового фундаментального design-layer Мира Леса перед этим не требуется.
