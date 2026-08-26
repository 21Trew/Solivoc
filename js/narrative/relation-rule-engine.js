/* Ordered semantic relation rules shared by gameplay, solver and future authored content. */
(() => {
  function categoryIdOf(value) {
    const card = Array.isArray(value?.cards) ? value.cards[0] : value;
    return card?.cat;
  }

  function RelationRuleEngine() {
    const rules = [];
    const ids = new Set();

    this.register = (rule) => {
      const id = String(rule?.id || "").trim();
      if (!id) throw new TypeError("Relation rule requires a stable id");
      if (ids.has(id)) throw new Error(`Relation rule already registered: ${id}`);
      if (typeof rule?.matches !== "function") throw new TypeError(`Relation rule ${id} requires matches(left, right, context)`);
      const normalized = Object.freeze({ id, matches: rule.matches });
      rules.push(normalized);
      ids.add(id);
      return normalized;
    };

    this.matchingRule = (left, right, context = {}) => {
      if (!left || !right) return null;
      for (const rule of rules) {
        try {
          if (rule.matches(left, right, context) === true) return rule.id;
        } catch (error) {
          console.warn?.("relation rule failed", { rule: rule.id, error });
        }
      }
      return null;
    };

    this.canRelate = (left, right, context = {}) => this.matchingRule(left, right, context) !== null;
    this.ruleIds = () => rules.map((rule) => rule.id);
  }

  const engine = new RelationRuleEngine();
  engine.register({
    id: "legacy-category",
    matches(left, right) {
      const leftCategory = categoryIdOf(left), rightCategory = categoryIdOf(right);
      return leftCategory != null && leftCategory === rightCategory;
    },
  });

  globalThis.RelationRuleEngine = RelationRuleEngine;
  globalThis.relationRuleEngine = engine;
})();
