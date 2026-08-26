# Design Canon — Словасьянс

> Статус: навигационный индекс, не отдельный источник канона.  
> Branch baseline: `milestone/forest-foundation`.  
> Правило: каноническими считаются только версии, перечисленные ниже.

## Общий канон

- `DOCUMENTATION_STANDARD_v1.00.md`
- `RARITY_SYSTEM_v1.00.md`
- `GAME_VISION_MANIFEST_v0.12.md`
- `WORLD_CAMPAIGN_MANIFEST_v0.21.md`
- `CHARACTER_WORLD_MANIFEST_v0.15.md`

## Мир Леса

- `forest/WORLD_FOREST_DOSSIER_v0.18.md`
- `forest/WORLD_FOREST_LEVEL_BLUEPRINT_v0.13.md`
- `forest/WORLD_FOREST_STATE_MAP_v0.03.md`
- `forest/WORLD_FOREST_STATE_SCHEMA_v0.05.md`
- `forest/WORLD_FOREST_CONTENT_REGISTRY_v0.08.md`
- `forest/WORLD_FOREST_ENCOUNTER_REGISTRY_v0.04.md`
- `forest/WORLD_FOREST_KNOWLEDGE_REGISTRY_v0.05.md`
- `forest/WORLD_FOREST_REVISIT_REGISTRY_v0.03.md`
- `forest/WORLD_FOREST_SYNTHESIS_REGISTRY_v0.03.md`
- `forest/WORLD_FOREST_MACHINE_PACKAGE_SPEC_v0.03.md`
- `forest/machine/v0.03/WORLD_FOREST_MACHINE_PACKAGE_v0.03.zip`

## Нормативная иерархия

```text
GAME VISION
↓
WORLD / CAMPAIGN
↓
CHARACTER WORLD / RARITY
↓
WORLD DOSSIER
↓
LEVEL BLUEPRINT
↓
STATE / CONTENT REGISTRIES
↓
MACHINE PACKAGE
↓
IMPLEMENTATION
```

Machine package не имеет права создавать authored-смысл, которого нет в design registries.

## Текущий статус

```text
100-level blueprint       ✓
state map / schema        ✓
content identity          ✓
encounter architecture    ✓
knowledge architecture    ✓
revisit architecture      ✓
synthesis architecture    ✓
machine-readable export   ✓
automatic validation      ✓
```

Следующий этап: **implementation architecture audit существующего кода и migration plan**.

## Legacy paths

Корневой `RARITY_SYSTEM.md` сохраняется как compatibility copy. Канонический versioned-файл: `docs/design/RARITY_SYSTEM_v1.00.md`.

`MASCOTS_README.md` — историческая implementation note и не является character canon. Канон персонажей: `docs/design/CHARACTER_WORLD_MANIFEST_v0.15.md`.
