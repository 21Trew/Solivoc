export const TUTORIAL_STEPS = Object.freeze([
  Object.freeze({ step: 1, phase: "category", prompt: "Найди карточку категории и дважды нажми на неё.", target: "category-card" }),
  Object.freeze({ step: 1, phase: "collect", prompt: "Теперь собери в открытую категорию все связанные слова.", target: "matching-word" }),
  Object.freeze({ step: 2, phase: "manual", prompt: "Зажми слово и перетащи его на карту той же ассоциации.", target: "manual-move" }),
  Object.freeze({ step: 2, phase: "manual-done", prompt: "Ручной перенос засчитан. Закончи расклад.", target: "useful-move" }),
  Object.freeze({ step: 3, phase: "auto", prompt: "Дважды нажми на слово — игра сама найдёт полезное место.", target: "auto-move" }),
  Object.freeze({ step: 3, phase: "auto-done", prompt: "Двойной тап засчитан. Закончи расклад.", target: "useful-move" }),
  Object.freeze({ step: 4, phase: "stock", prompt: "Нажми на колоду, чтобы открыть следующую карту.", target: "stock" }),
  Object.freeze({ step: 4, phase: "undo", prompt: "Теперь нажми «Отмена», чтобы вернуть последний ход.", target: "undo" }),
  Object.freeze({ step: 4, phase: "hint", prompt: "Теперь нажми «Подсказку» — маскот укажет полезный ход.", target: "hint" }),
  Object.freeze({ step: 4, phase: "finish", prompt: "Все инструменты проверены. Собери категорию — обучение завершится.", target: "useful-move" }),
]);

function flags(actions = {}) {
  return {
    category: !!actions.category,
    manual: !!actions.manual,
    auto: !!actions.auto,
    stock: !!actions.stock,
    undo: !!actions.undo,
    hint: !!actions.hint,
  };
}

export function tutorialPhase(step, actions = {}) {
  const a = flags(actions);
  if (step === 1) return a.category ? "collect" : "category";
  if (step === 2) return a.manual ? "manual-done" : "manual";
  if (step === 3) return a.auto ? "auto-done" : "auto";
  if (step === 4) {
    if (!a.stock) return "stock";
    if (!a.undo) return "undo";
    if (!a.hint) return "hint";
    return "finish";
  }
  return "finish";
}

export function tutorialDescriptor(step, actions = {}) {
  const phase = tutorialPhase(step, actions);
  return TUTORIAL_STEPS.find((item) => item.step === Number(step) && item.phase === phase)
    || TUTORIAL_STEPS.at(-1);
}

export function applyTutorialAction(step, actions = {}, action = "") {
  const next = flags(actions);
  const allowed = {
    1: ["category"],
    2: ["manual"],
    3: ["auto"],
    4: ["stock", "undo", "hint"],
  }[Number(step)] || [];
  if (allowed.includes(action)) next[action] = true;
  return next;
}

export function tutorialActionExpected(step, actions = {}, action = "") {
  const descriptor = tutorialDescriptor(step, actions);
  return descriptor.phase === action || (
    descriptor.phase === "manual" && action === "manual"
  ) || (
    descriptor.phase === "auto" && action === "auto"
  );
}
