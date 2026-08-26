# WORLD FOREST MACHINE PACKAGE SPEC — Мир Леса

> **Статус:** рабочий production export spec  
> **Версия:** 0.03  
> **World ID:** `forest`  
> **Package:** `WORLD_FOREST_MACHINE_PACKAGE_v0.03`  
> **Основание:** `WORLD_FOREST_CONTENT_REGISTRY_v0.08`, `WORLD_FOREST_STATE_SCHEMA_v0.05`, `WORLD_FOREST_ENCOUNTER_REGISTRY_v0.04`, `WORLD_FOREST_KNOWLEDGE_REGISTRY_v0.05`, `WORLD_FOREST_REVISIT_REGISTRY_v0.03`, `WORLD_FOREST_SYNTHESIS_REGISTRY_v0.03`  
> **Назначение:** определить границу между human-readable design canon и machine-readable authored content первого Мира Леса.

---

## 1. Главный принцип

```text
DESIGN REGISTRY
источник authored-смысла

↓

MACHINE PACKAGE
нормализованное представление

↓

ENGINE
исполняет authored правила
```

Package НЕ является самостоятельным автором контента.

> **Если authored-правило ещё `TBD`, экспорт обязан сохранить `TBD`, а не заполнить пробел правдоподобным значением.**

---

## 2. Почему package нужен сейчас

После четырёх фундаментальных pass:

```text
ENCOUNTER    ✓
KNOWLEDGE    ✓
REVISIT      ✓
SYNTHESIS    ✓
```

главный риск смещается с «что мы вообще хотим сделать?» на:

```text
совпадают ли ID?
существуют ли ссылки?
не потерялись ли guards?
не расходятся ли версии?
можно ли загрузить authored content
без чтения Markdown во время runtime?
```

Package закрывает именно этот слой.

---

## 3. Состав

```text
WORLD_FOREST_MACHINE_PACKAGE_v0.03/
├── package.manifest.json
├── forest.bundle.json
├── validation_report.json
├── README.md
├── data/
│   ├── areas.json
│   ├── scenes.json
│   ├── choices.json
│   ├── encounters.json
│   ├── world_facts.json
│   ├── world_events.json
│   ├── knowledge_presentations.json
│   ├── knowledge_mappings.json
│   ├── revelation_actions.json
│   ├── reconstructions.json
│   ├── revisits.json
│   ├── revisit_state_classes.json
│   ├── syntheses.json
│   ├── synthesis_phases.json
│   ├── synthesis_contract.json
│   ├── elemental_completion_contract.json
│   ├── threads.json
│   ├── thread_links.json
│   ├── semantic_events.json
│   ├── rules.json
│   ├── tbd_registry.json
│   └── source_versions.json
├── schemas/
│   └── *.schema.json
└── tools/
    └── validate_package.py
```

---

## 4. Два режима использования

### Split data

Production loader предпочтительно читает отдельные domain-файлы.

Это позволяет:

- валидировать subsystem отдельно;
- делать узкие content migrations;
- не загружать весь мир для одного lookup.

### Combined bundle

`forest.bundle.json` нужен для:

- tooling;
- diff;
- debug;
- прототипа importer;
- QA;
- визуализации графа зависимостей.

Он не обязан стать финальным runtime format.

---

## 5. Source versions

```json
{
  "DOCUMENTATION_STANDARD": "1.00",
  "RARITY_SYSTEM": "1.00",
  "GAME_VISION_MANIFEST": "0.12",
  "WORLD_CAMPAIGN_MANIFEST": "0.21",
  "CHARACTER_WORLD_MANIFEST": "0.15",
  "WORLD_FOREST_DOSSIER": "0.18",
  "WORLD_FOREST_LEVEL_BLUEPRINT": "0.13",
  "WORLD_FOREST_STATE_MAP": "0.03",
  "WORLD_FOREST_STATE_SCHEMA": "0.05",
  "WORLD_FOREST_CONTENT_REGISTRY": "0.08",
  "WORLD_FOREST_ENCOUNTER_REGISTRY": "0.04",
  "WORLD_FOREST_KNOWLEDGE_REGISTRY": "0.05",
  "WORLD_FOREST_REVISIT_REGISTRY": "0.03",
  "WORLD_FOREST_SYNTHESIS_REGISTRY": "0.03"
}
```

При build нового package source-version snapshot должен обновляться.

---

## 6. Stable authored identity

Package сохраняет ID из registries:

```text
AREA_*
SCN_*
CHOICE_*
ENC_*
WF_*
WE_*
KR_*
REC_*
REV_*
SYN_*
THREAD_*
KACT_*
```

Display copy не является identity.

---

## 7. Choice weights

Числовые weights сериализуются только там, где они уже authored.

Например:

```json
{
  "signal": "memory",
  "value": 2
}
```

Если registry говорит:

```text
TBD_WEIGHTS
```

package хранит:

```json
{
  "status": "TBD_WEIGHTS",
  "weights": []
}
```

Это жёсткий guard от случайного balancing автором exporter-а.

---

## 8. Encounter export

Каждый encounter содержит:

```text
window
function
variants
routing invariants
```

Variant может дополнительно содержать:

```text
participants
relationship_target
core_contradiction
```

если эти данные уже нормализованы в Encounter Registry.

Финальный script не создаётся package-ом.

---

## 9. Knowledge export

Разделены:

```text
knowledge definition
knowledge mapping
revelation action
```

То есть:

```text
WF_F10
```

не становится карточкой только потому, что `knowledge_presentations.json` содержит связанную presentation definition.

Нужен authored mapping/guard и runtime history конкретного игрока.

---

## 10. `PLAYER_INITIATED_REVELATION`

Package отдельно хранит stable actions:

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

Readiness и completion остаются двумя разными semantic events/state.

---

## 11. Revisit export

`revisits.json` хранит authored identity каждого revisit и normalized state rules там, где они уже оформлены структурной таблицей.

Если правило в `WORLD_FOREST_REVISIT_REGISTRY_v0.03` пока существует только как свободный prose, package v0.03 ставит:

```text
SOURCE_AUTHORED_PROSE_NOT_FULLY_NORMALIZED
```

Это сознательная граница.

Нельзя преобразовывать содержательный текст в точный runtime condition без отдельного authoring decision.

---

## 12. Synthesis export

`data/synthesis_contract.json` уже фиксирует:

```text
five phases
graph constraints
companion parity
hard / non-hard prerequisites
attempt states
semantic events
INTEGRATE_SYSTEM
```

Ключевой state-law:

```text
WHOLE solved
↓
MODEL_SOLVED
↓
REVELATION_READY
↓
player «Увидеть целое»
↓
forest_synthesis_complete
```

---

## 13. Level 100 export

`elemental_completion_contract.json` фиксирует:

```text
forest_synthesis_complete
↓
Encounter 11
↓
direct confirmation
↓
RECOGNIZE_ENTITY ready
↓
player «Узнать»
↓
forest_world_complete
```

`WF_F70` при этом может остаться:

```text
exposed = true
noticed = false
```

---

## 14. Validation

Validator проверяет:

- уникальность authored-ID;
- `1–100` core scenes без пропусков;
- существование `area_id`;
- число и parent каждого encounter variant;
- reconstruction → knowledge presentation refs;
- revisit → area refs;
- synthesis parent/phase order;
- synthesis/Elemental scene refs;
- revelation action refs;
- наличие semantic events нового synthesis-flow;
- JSON Schema structural validity.

---

## 15. Что validator НЕ должен считать ошибкой

```text
TBD_WEIGHTS
TBD final dialogue
TBD Elemental voice
TBD exact synthesis cards
TBD Guardian future facts
```

Если эти пробелы действительно зафиксированы source docs.

Они становятся warnings / `tbd_registry`, а не выдуманными defaults.

---

## 16. Найденная при экспорте проблема source registry

Исторический machine-pass обнаружил технический дефект `CONTENT_REGISTRY_v0.05`:

```text
Reconstruction Registry
```

был разорван строкой:

```text
Presentation: KR_FOREST_RECONSTRUCTION_TRACE_SEQUENCE
```

из-за чего обычный Markdown parser видел только первые две reconstruction строки.

Он был исправлен ещё в исторической редакции:

```text
WORLD_FOREST_CONTENT_REGISTRY_v0.06
```

Без изменения смыслового канона.

Дополнительно presentation bindings пяти reconstruction собраны явно.

---

## 17. Package versioning

Machine package следует тому же стандарту:

```text
WORLD_FOREST_MACHINE_PACKAGE_v0.01
WORLD_FOREST_MACHINE_PACKAGE_v0.03
...
```

Новая package-version нужна, если меняется:

- serialized authored content;
- schema;
- mapping;
- validation rule;
- source-version snapshot.

Она не обязана совпадать номером с Content Registry.

---

## 18. Следующий технический этап

После этого package можно сопоставлять с реальным проектом:

```text
existing game code
↔
machine package
```

Нужно определить:

1. где сейчас живут levels/content;
2. как сейчас хранится player progress;
3. есть ли backend source of truth;
4. какие существующие IDs можно сохранить;
5. где нужен content loader;
6. где нужен event store;
7. какие projections уже существуют;
8. как провести миграцию без потери текущих аккаунтов.

Это уже **implementation architecture audit**, а не ещё один design-manifest.
