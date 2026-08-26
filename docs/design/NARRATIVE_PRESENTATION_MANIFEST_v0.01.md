# NARRATIVE PRESENTATION MANIFEST — Словасьянс

> **Статус:** рабочий presentation-канон  
> **Версия:** 0.01  
> **Область:** глубина подачи Истории, связь semantic state и UI presentation, обязательные и опциональные narrative actions  
> **Основание:** `PRODUCT_STRUCTURE_MANIFEST_v0.01`, `GAME_VISION_MANIFEST_v0.12`, `WORLD_CAMPAIGN_MANIFEST_v0.21`, `WORLD_FOREST_STATE_SCHEMA_v0.05`

---

## 1. Главный принцип

Словасьянс имеет:

```text
ОДИН КАНОН
ОДНУ STORY HISTORY
ОДИН ПРОГРЕСС МИРА
```

но допускает:

```text
РАЗНУЮ ГЛУБИНУ ПРЕЗЕНТАЦИИ
```

Игрок не выбирает отдельную «сюжетную» или «несюжетную» версию Мира.

Он проходит тот же canonical World Campaign, но может получать более краткую или более подробную форму подачи событий.

Ключевой инвариант:

> **SEMANTIC STATE ≠ PRESENTATION DEPTH**

---

## 2. Три слоя опыта

История строится как минимум из трёх независимых слоёв:

```text
GAMEPLAY
↓
CHARACTER / WORLD PRESENCE
↓
NARRATIVE DEPTH
```

### 2.1. Gameplay

Обязательный слой:

- расклады;
- связи;
- уровни;
- игровые цели;
- звёзды / результаты;
- progression gates.

### 2.2. Character / World Presence

Визуальный и эмоциональный слой, доступный и игроку с минимальной narrative вовлечённостью:

- персонажи;
- арты;
- локации;
- позы;
- реакции;
- короткие реплики;
- изменения внешности;
- визуальные события мира.

### 2.3. Narrative Depth

Углублённый слой:

- полные сцены;
- расширенные диалоги;
- dossier/history;
- knowledge context;
- reconstruction detail;
- relationship nuance;
- дополнительное объяснение систем мира.

---

## 3. Presentation profiles

Архитектура должна поддерживать как минимум:

```text
brief
balanced
full
```

Даже если первый публичный UI предлагает меньше настроек.

### 3.1. `brief`

Для игрока, который в первую очередь хочет играть.

Содержит только необходимое:

```text
ключевой арт
1–2 короткие реплики / summary
необходимый semantic action, если он есть
CTA продолжения
```

### 3.2. `balanced`

Рекомендуемый default.

Содержит:

- короткую сцену;
- ключевые реплики;
- важные relationship/world transitions;
- возможность открыть подробности.

### 3.3. `full`

Для игрока, который хочет глубже проживать Мир.

Может включать:

- полные диалоги;
- расширенный контекст;
- дополнительную визуальную драматургию;
- provenance/history;
- dossier;
- reconstruction detail.

---

## 4. Presentation preference не является Cognition

Выбор игроком краткой или подробной подачи:

```text
НЕ является показателем ума
НЕ является Cognition signal
НЕ является relationship score
НЕ уменьшает награды
НЕ меняет ending quality
```

Это только presentation preference.

Нельзя использовать отказ от длинной сцены как hidden penalty.

---

## 5. Событие и просмотр сцены — разные факты

Если canonical event объективно произошёл:

```text
FOREST_ENCOUNTER_COMPLETED
FOREST_WORLD_EVENT_OCCURRED
FOREST_RELATIONSHIP_MILESTONE
```

его semantic факт не зависит от того, просмотрел ли игрок полную presentation-анимацию.

То есть запрещено:

```text
player skipped full scene
↓
event did not happen
```

Правильно:

```text
semantic event happened
↓
presentation layer selected representation
```

---

## 6. Значимые player actions нельзя автопроживать

События, требующие реального semantic action игрока, не могут быть автоматически выбраны только потому, что включён `brief`.

К таким действиям относятся классы:

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

Для них допускаются разные UX-представления, но semantic command остаётся реальным действием игрока.

Например:

```text
FULL
подробная сцена + контекст + выбор

BRIEF
короткая визуальная формула + одна понятная CTA
```

Обе формы создают один и тот же semantic command/event только после действия игрока.

---

## 7. Mandatory и optional content

### 7.1. Mandatory semantic action

Если действие необходимо для progression:

```text
required_for_progression = true
```

игрок обязан совершить сам semantic action.

Но он не обязан читать длинную presentation-версию.

### 7.2. Optional depth

Дополнительные:

- диалоги;
- dossier;
- expanded history;
- пояснения;
- дополнительные authored observations;

могут оставаться непросмотренными.

Это:

```text
не ошибка
не штраф
не FOMO-механика
не отрицательный Cognition signal
```

---

## 8. Progressive disclosure как основной UX

Рекомендуемый паттерн после обычного narrative beat:

```text
[ключевой арт]
[короткая meaningful реплика / summary]

[Продолжить]
[Подробнее]
```

`Продолжить` не означает «пропустить канон».

Он означает:

> принять краткую presentation-форму события и вернуться к gameplay.

`Подробнее` раскрывает дополнительные authored слои.

---

## 9. История встреч должна быть доступна позже

Игрок может сначала не интересоваться персонажем, а затем захотеть глубины.

Поэтому уже произошедшие события должны иметь возможность быть представлены позже через:

- историю встреч;
- dossier;
- knowledge history;
- карточку персонажа;
- архив сцен;
- reconstruction history.

При позднем просмотре нельзя изменять ранее совершённые choices.

Архив показывает историю, а не переписывает её.

---

## 10. Choices всегда сохраняют причинность

Если authored choice влияет на дальнейшую историю, он должен быть сделан в момент, когда история его требует.

Нельзя:

```text
скрыть выбор в brief
автоматически выбрать вариант
позже спросить игрока задним числом
```

потому что последующие события уже могли зависеть от результата.

Brief presentation обязана дать компактную, но реальную форму такого выбора.

---

## 11. Visual content не является наградой за чтение

Нельзя закрывать предусмотренные story-state визуальные материалы только потому, что игрок предпочитает краткую подачу.

Если canonical state уже допускает:

- новый арт;
- новую позу;
- новую форму присутствия;
- визуальное изменение персонажа;
- новую локацию;

игрок получает это независимо от `brief/balanced/full`.

Исключение:

> если visual state сам по себе требует ещё не достигнутого semantic milestone.

---

## 12. Story companion presentation

До canonical companion acquisition персонажи присутствуют в Истории согласно authored сценам.

Коллекционная настройка свободных раскладов не влияет на этот порядок.

После `FOREST_COMPANION_ACQUIRED` История может использовать нового спутника как постоянное или контекстное присутствие согласно World Campaign rules.

Presentation depth регулирует объём реплик и сцен, но не сам факт канонического спутничества.

---

## 13. Semantic / Presentation contract

Целевой pipeline:

```text
CONTENT DEFINITIONS
+
PLAYER SEMANTIC EVENTS
↓
CURRENT PROJECTIONS
↓
NARRATIVE PRESENTATION ENGINE
↓
PLAYER UI
```

Presentation engine получает semantic state, но не переписывает его произвольно.

Он отвечает за:

- выбор brief/balanced/full variant;
- progressive disclosure;
- animation intensity;
- text density;
- optional detail;
- восстановление presentation после resume.

Он не является source of truth для:

- knowledge;
- relationships;
- choices;
- encounters;
- companion acquisition;
- world state.

---

## 14. Presentation metadata в authored content

Semantic definition не должна дублироваться для каждой глубины.

Правильная модель:

```text
SEMANTIC DEFINITION
↓
PRESENTATION VARIANTS
├── brief
├── balanced
└── full
```

Например логически:

```json
{
  "scene_id": "forest.fox.identity",
  "semantic_action": "RECOGNIZE_ENTITY",
  "presentation": {
    "brief": "forest.fox.identity.brief",
    "balanced": "forest.fox.identity.balanced",
    "full": "forest.fox.identity.full"
  }
}
```

Запрещено создавать разные semantic события вида:

```text
FOX_IDENTITY_CONFIRMED_BRIEF
FOX_IDENTITY_CONFIRMED_FULL
```

если смысл один.

---

## 15. Resume / crash rule

Presentation может быть прервана падением приложения, background или закрытием вкладки.

Semantic state и presentation state должны быть разделены.

Если semantic transaction уже подтверждена, повторный запуск presentation не должен создавать событие второй раз.

Если mandatory action ещё не committed:

```text
resume
→ восстановить pending action
→ дать краткую или полную presentation
→ commit только после action
```

Это особенно важно для:

- identity revelation;
- reconstruction;
- relationship synthesis;
- companion transition;
- World Synthesis.

---

## 16. Accessibility invariant

Reduced motion, отсутствие звука, screen reader mode или невозможность просмотреть анимацию не меняют semantic outcome.

Presentation обязана иметь эквивалентные формы, приводящие к тому же semantic command/result.

---

## 17. Рекомендуемая player-facing терминология

Не использовать как основной продуктовый выбор:

```text
Сюжет / Без сюжета
Story Mode / Gameplay Mode
```

Потому что это создаёт ложное представление о двух разных кампаниях.

Допустимы настройки класса:

```text
Подача истории
Кратко
Сбалансированно
Подробно
```

или progressive-disclosure UX без отдельной обязательной настройки.

---

## 18. Каноническая короткая формула

> **Игрок проходит одну Историю. Он может видеть её кратко или глубоко, но не получает другую историю из-за нежелания читать. События определяет semantic layer; presentation определяет только форму их показа. Значимые решения остаются решениями игрока.**
