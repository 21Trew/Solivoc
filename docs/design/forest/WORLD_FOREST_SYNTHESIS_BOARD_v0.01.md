# WORLD FOREST SYNTHESIS BOARD — SYN_FOREST_WORLD_01_BOARD

> **Статус:** production draft  
> **Версия контента:** `0.01`  
> **World ID:** `forest`  
> **Level:** `99`  
> **Synthesis ID:** `SYN_FOREST_WORLD_01`  
> **Board ID:** `SYN_FOREST_WORLD_01_BOARD`

## 1. Роль board

Это не recap девяти глав и не временный mock.

`SYN_FOREST_WORLD_01_BOARD v0.01` — первая production-версия финального системного узла Мира Леса. Она может балансироваться и визуально уточняться без смены stable Board ID.

Основной вопрос:

> **Как локальное изменение становится частью распределённой системы, если ни один объект не управляет всем участком?**

## 2. Authored situation

После сильного ветра крупная ветка старого дерева падает на участок.

Это одно событие одновременно:

- меняет доступ света;
- оставляет древесину вне её прежней роли;
- создаёт новый субстрат для разложения;
- меняет состояние почвы через промежуточные процессы;
- влияет на следующий рост;
- существует рядом с системой питания и переноса семян.

Board не сообщает игроку готовую причинную схему. Игрок собирает её по фазам.

## 3. Nodes

| ID | Player-facing | Semantic role |
|---|---|---|
| `SYN_NODE_TREE` | Старое дерево | `STRUCTURAL_LIVING_NODE` |
| `SYN_NODE_WOOD` | Упавшая ветка | `RESIDUE_OR_TRACE` |
| `SYN_NODE_LIGHT` | Световое окно | `RESOURCE_OR_CONDITION` |
| `SYN_NODE_BERRY` | Ягодный куст | `PLANT_OR_SEED`, `RESOURCE_OR_CONDITION` |
| `SYN_NODE_BIRD` | Лесная птица | `MOBILE_CREATURE` |
| `SYN_NODE_SEED` | Семя | `PLANT_OR_SEED` |
| `SYN_NODE_LITTER` | Растительный остаток | `RESIDUE_OR_TRACE` |
| `SYN_NODE_FUNGI` | Грибница | `DECOMPOSER` |
| `SYN_NODE_SOIL` | Почва | `SOIL_OR_SUBSTRATE`, `RESOURCE_OR_CONDITION` |

`ROUTE_OR_ACCESS` представлен relation `SYN_REL_WOOD_OPENS_LIGHT`: после падения ветки меняется доступ света к участку.

## 4. Core relations

| ID | Relation | Family |
|---|---|---|
| `SYN_REL_TREE_SHELTER_BIRD` | Старое дерево → птица: даёт укрытие | `FUNCTION_USE` |
| `SYN_REL_BERRY_FEEDS_BIRD` | Ягодный куст → птица: служит пищей | `FUNCTION_USE` |
| `SYN_REL_BIRD_CARRIES_SEED` | Птица → семя: переносит | `MOVEMENT_TRANSPORT` |
| `SYN_REL_LIGHT_SUPPORTS_BERRY` | Световое окно → куст: создаёт условие роста | `DEPENDENCY_CONDITION` |
| `SYN_REL_WOOD_OPENS_LIGHT` | Упавшая ветка → свет: открывает доступ | `MOVEMENT_TRANSPORT` |
| `SYN_REL_WOOD_FEEDS_FUNGI` | Упавшая ветка → грибница: становится субстратом | `TRANSFORMATION` |
| `SYN_REL_FUNGI_CHANGES_SOIL` | Грибница → почва: изменяет состояние | `TRANSFORMATION` |
| `SYN_REL_SOIL_SUPPORTS_BERRY` | Почва → куст: поддерживает следующий рост | `DEPENDENCY_CONDITION` |
| `SYN_REL_BERRY_LEAVES_LITTER` | Куст → остаток: оставляет последствие | `TRACE_CONSEQUENCE` |
| `SYN_REL_LITTER_FEEDS_FUNGI` | Остаток → грибница: разлагается | `TRANSFORMATION` |
| `SYN_REL_BIRD_PRESSURES_BERRY` | Птица → куст: уменьшает часть плодов | `PRESSURE_CONSTRAINT` |
| `SYN_REL_WOOD_MEDIATES_BERRY` | Ветка → куст через грибницу и почву | `MEDIATED_INFLUENCE` |

## 5. Distributed / temporal invariants

Board содержит обязательные структуры:

```text
куст → остаток → грибница → почва → куст
```

Это feedback/cycle fragment.

Направления:

```text
куст → птица
пища

птица → куст
давление на ресурс
```

Они обе истинны, но означают разное.

Mediated influence:

```text
упавшая ветка
→ грибница
→ почва
→ условия роста куста
```

Нельзя заменить это relation:

```text
ветка → напрямую управляет кустом
```

## 6. Distractors v0.01

Board содержит authored ошибочные гипотезы, а не случайный шум:

- похожая форма дерева и куста означает одинаковую функцию;
- птица напрямую изменяет почву;
- свет служит грибнице пищей;
- дерево управляет разложением.

Каждый distractor имеет authored explanation, чтобы ошибка читалась как проверяемая гипотеза, а не как «НЕПРАВИЛЬНО».

## 7. Phase contract

### I — DISTINGUISH

Игрок отделяет functional relation от соседства и похожей формы.

Required foundation:

- дерево → птица: укрытие;
- куст → птица: пища;
- свет → куст: условие роста;
- древесина → грибница: субстрат.

### II — MULTI_RELATION

Один объект не получает единственный label.

Птица одновременно:

- получает пищу;
- переносит семя;
- меняет количество плодов.

### III — DIRECTION

Игрок удерживает:

- куст → птица;
- птица → куст;
- mediated path ветка → грибница/почва → куст.

### IV — TIME

Игрок собирает одну и ту же систему во времени:

```text
куст
→ растительный остаток
→ грибница
→ почва
→ следующий рост
```

Entry point в cycle не фиксирован.

### V — WHOLE

Финальная модель объединяет укрытие, питание, перенос, свет, разложение, почву, последствия и mediated influence.

Она намеренно не требует выбрать каждую истинную relation. `SYN_REL_BIRD_PRESSURES_BERRY` остаётся истинной, но не обязательной для sufficient Whole model.

## 8. Companion parity

Core board и hard solution одинаковы для:

- Кота;
- Совы;
- Лиса.

Меняется только lens:

- Кот foreground-ит время и изменение;
- Сова — различение observation / interpretation и direction;
- Лис — альтернативные пути влияния.

Спутник не решает relation вместо игрока.

## 9. Optional history

Core solution требует только честно пройденные уровни `1–98` и первого спутника.

Optional observations/reconstructions могут использоваться как provenance/echo, но:

- не открывают обязательный shortcut;
- не добавляют hidden gate;
- не делают финал «лучше»;
- не меняют hard target.

## 10. Production evolution

Stable ID:

```text
SYN_FOREST_WORLD_01_BOARD
```

не меняется при балансировке.

Изменения фиксируются через:

```text
contentVersion
0.01 → 0.02 → ...
```

Новый Board ID нужен только если меняется identity и смысл финального испытания, а не если меняются layout, distractors или баланс.

## 11. Что остаётся после v0.01

Для beta не блокируют прохождение:

- финальный арт / motion;
- финальные voice lines;
- mastery/★★★ criteria;
- тонкая балансировка количества revision;
- post-world presentation.

Board v0.01 уже является каноническим играбельным production draft, а не test fixture.
