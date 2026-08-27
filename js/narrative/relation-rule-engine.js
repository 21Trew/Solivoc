/* Ordered semantic relation rules shared by gameplay, solver and future authored content. */
(() => {
  function categoryIdOf(value) {
    const card = Array.isArray(value?.cards) ? value.cards[0] : value;
    return card?.cat;
  }

  function normalizeList(value) {
    if (value == null) return null;
    const list = Array.isArray(value) ? value : [value];
    const normalized = [...new Set(list.map((item) => String(item || "").trim()).filter(Boolean))];
    return normalized.length ? Object.freeze(normalized) : null;
  }

  function normalizeContext(context = {}) {
    const state = context?.state || null;
    return Object.freeze({
      purpose: context?.purpose || null,
      mode: context?.mode || state?.mode || null,
      worldId: context?.worldId || state?.worldId || state?.world?.id || null,
      sceneId: context?.sceneId || state?.sceneId || null,
      encounterId: context?.encounterId || state?.encounterId || null,
      sourceRole: context?.sourceRole || null,
      targetRole: context?.targetRole || null,
      state,
    });
  }

  function normalizePolicy(value = {}) {
    const policy = {
      purposes: normalizeList(value?.purposes),
      modes: normalizeList(value?.modes),
      worldIds: normalizeList(value?.worldIds),
      sceneIds: normalizeList(value?.sceneIds),
      encounterIds: normalizeList(value?.encounterIds),
      sourceRoles: normalizeList(value?.sourceRoles),
      targetRoles: normalizeList(value?.targetRoles),
    };
    const scoped = Object.values(policy).some(Boolean);
    return Object.freeze({ ...policy, scoped });
  }

  function policyAllows(policy, context) {
    if (!policy?.scoped) return false;
    const checks = [
      [policy.purposes, context.purpose],
      [policy.modes, context.mode],
      [policy.worldIds, context.worldId],
      [policy.sceneIds, context.sceneId],
      [policy.encounterIds, context.encounterId],
      [policy.sourceRoles, context.sourceRole],
      [policy.targetRoles, context.targetRole],
    ];
    return checks.every(([allowed, actual]) => !allowed || (actual != null && allowed.includes(String(actual))));
  }

  function RelationRuleEngine() {
    const rules = [];
    const ids = new Set();

    this.register = (rule) => {
      const id = String(rule?.id || "").trim();
      if (!id) throw new TypeError("Relation rule requires a stable id");
      if (ids.has(id)) throw new Error(`Relation rule already registered: ${id}`);
      if (typeof rule?.matches !== "function") throw new TypeError(`Relation rule ${id} requires matches(left, right, context)`);
      const normalized = Object.freeze({ id, policy: normalizePolicy(rule.policy), matches: rule.matches });
      rules.push(normalized);
      ids.add(id);
      return normalized;
    };

    this.matchingRule = (left, right, context = {}) => {
      if (!left || !right) return null;
      const normalizedContext = normalizeContext(context);
      for (const rule of rules) {
        if (!policyAllows(rule.policy, normalizedContext)) continue;
        try {
          if (rule.matches(left, right, normalizedContext) === true) return rule.id;
        } catch (error) {
          console.warn?.("relation rule failed", { rule: rule.id, error });
        }
      }
      return null;
    };

    this.canRelate = (left, right, context = {}) => this.matchingRule(left, right, context) !== null;
    this.ruleIds = () => rules.map((rule) => rule.id);
  }

  function installStoryPresentation() {
    if (typeof document === "undefined") return;
    const modules = [
      ["story-presentation", "./js/narrative/story-presentation.js"],
      ["story-level1", "./js/narrative/story-level1.js"],
    ];
    for (const [key, src] of modules) {
      if (document.querySelector(`script[data-solivoc-story-module="${key}"]`)) continue;
      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.dataset.solivocStoryModule = key;
      document.head.appendChild(script);
    }
  }

  const engine = new RelationRuleEngine();
  engine.register({
    id: "legacy-category",
    policy: { purposes: ["gameplay-merge", "solver-merge"] },
    matches(left, right) {
      const leftCategory = categoryIdOf(left), rightCategory = categoryIdOf(right);
      return leftCategory != null && leftCategory === rightCategory;
    },
  });

  globalThis.RelationRuleEngine = RelationRuleEngine;
  globalThis.relationRuleEngine = engine;
  installStoryPresentation();
})();
