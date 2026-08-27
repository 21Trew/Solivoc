/* Ordered semantic relation rules shared by gameplay, solver and authored Story content. */
(() => {
  function categoryIdOf(value) { const card = Array.isArray(value?.cards) ? value.cards[0] : value; return card?.cat; }
  function normalizeList(value) { if (value == null) return null; const list = Array.isArray(value) ? value : [value]; const normalized = [...new Set(list.map((item) => String(item || "").trim()).filter(Boolean))]; return normalized.length ? Object.freeze(normalized) : null; }
  function normalizeContext(context = {}) { const state = context?.state || null; return Object.freeze({ purpose: context?.purpose || null, mode: context?.mode || state?.mode || null, worldId: context?.worldId || state?.worldId || state?.world?.id || null, sceneId: context?.sceneId || state?.sceneId || null, encounterId: context?.encounterId || state?.encounterId || null, sourceRole: context?.sourceRole || null, targetRole: context?.targetRole || null, state }); }
  function normalizePolicy(value = {}) { const policy = { purposes: normalizeList(value?.purposes), modes: normalizeList(value?.modes), worldIds: normalizeList(value?.worldIds), sceneIds: normalizeList(value?.sceneIds), encounterIds: normalizeList(value?.encounterIds), sourceRoles: normalizeList(value?.sourceRoles), targetRoles: normalizeList(value?.targetRoles) }; return Object.freeze({ ...policy, scoped: Object.values(policy).some(Boolean) }); }
  function policyAllows(policy, context) { if (!policy?.scoped) return false; return [[policy.purposes, context.purpose], [policy.modes, context.mode], [policy.worldIds, context.worldId], [policy.sceneIds, context.sceneId], [policy.encounterIds, context.encounterId], [policy.sourceRoles, context.sourceRole], [policy.targetRoles, context.targetRole]].every(([allowed, actual]) => !allowed || (actual != null && allowed.includes(String(actual)))); }
  function RelationRuleEngine() {
    const rules = [], ids = new Set();
    this.register = (rule) => { const id = String(rule?.id || "").trim(); if (!id) throw new TypeError("Relation rule requires a stable id"); if (ids.has(id)) throw new Error(`Relation rule already registered: ${id}`); if (typeof rule?.matches !== "function") throw new TypeError(`Relation rule ${id} requires matches(left, right, context)`); const normalized = Object.freeze({ id, policy: normalizePolicy(rule.policy), matches: rule.matches }); rules.push(normalized); ids.add(id); return normalized; };
    this.matchingRule = (left, right, context = {}) => { if (!left || !right) return null; const normalizedContext = normalizeContext(context); for (const rule of rules) { if (!policyAllows(rule.policy, normalizedContext)) continue; try { if (rule.matches(left, right, normalizedContext) === true) return rule.id; } catch (error) { console.warn?.("relation rule failed", { rule: rule.id, error }); } } return null; };
    this.canRelate = (left, right, context = {}) => this.matchingRule(left, right, context) !== null;
    this.ruleIds = () => rules.map((rule) => rule.id);
  }

  function installStoryRuntimeModules() {
    if (typeof document === "undefined") return;
    if (!Object.prototype.hasOwnProperty.call(globalThis, "state")) { try { Object.defineProperty(globalThis, "state", { configurable: true, enumerable: false, get() { try { return state; } catch { return undefined; } }, set(value) { try { state = value; } catch {} } }); } catch {} }
    const modules = [
      ["story-generation", "./js/narrative/story-generation.js"],
      ["story-perspective-runtime", "./js/narrative/story-perspective-runtime.js"],
      ["story-choice-runtime", "./js/narrative/story-choice-runtime.js"],
      ["story-encounter-routing", "./js/narrative/story-encounter-routing.js"],
      ["story-runtime-boundary", "./js/narrative/story-runtime-boundary.js"],
      ["story-routing-projection", "./js/narrative/story-routing-projection.js"],
      ["story-encounter-lifecycle", "./js/narrative/story-encounter-lifecycle.js"],
      ["story-encounter-presentation", "./js/narrative/story-encounter-presentation.js"],
      ["story-primitives", "./js/narrative/story-primitives.js"],
      ["story-synthesis-board-runtime", "./js/narrative/story-synthesis-board-runtime.js"],
      ["story-presentation", "./js/narrative/story-presentation.js"],
      ["story-knowledge-ui", "./js/narrative/story-knowledge-ui.js"],
    ];
    for (const [key, src] of modules) { if (document.querySelector(`script[data-solivoc-story-module="${key}"]`)) continue; const script = document.createElement("script"); script.src = src; script.async = false; script.dataset.solivocStoryModule = key; document.head.appendChild(script); }
  }

  const engine = new RelationRuleEngine();
  engine.register({ id: "legacy-category", policy: { purposes: ["gameplay-merge", "solver-merge"] }, matches(left, right) { const leftCategory = categoryIdOf(left), rightCategory = categoryIdOf(right); return leftCategory != null && leftCategory === rightCategory; } });
  globalThis.RelationRuleEngine = RelationRuleEngine;
  globalThis.relationRuleEngine = engine;
  installStoryRuntimeModules();
})();