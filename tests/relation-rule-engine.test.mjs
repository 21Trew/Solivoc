import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../js/narrative/relation-rule-engine.js", import.meta.url), "utf8");

function loadEngine() {
  const sandbox = { console: { warn() {} } };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(source, sandbox, { filename: "relation-rule-engine.js" });
  return sandbox;
}

test("legacy-category preserves strict category merge semantics in declared runtime contexts", () => {
  const { relationRuleEngine } = loadEngine();
  const gameplay = { purpose: "gameplay-merge", state: { mode: "regular" } };
  const solver = { purpose: "solver-merge", state: { mode: "daily" } };
  assert.deepEqual(Array.from(relationRuleEngine.ruleIds()), ["legacy-category"]);
  assert.equal(relationRuleEngine.canRelate({ cards: [{ cat: "fruit" }] }, { cards: [{ cat: "fruit" }] }, gameplay), true);
  assert.equal(relationRuleEngine.canRelate({ cards: [{ cat: "fruit" }] }, { cards: [{ cat: "sea" }] }, gameplay), false);
  assert.equal(relationRuleEngine.canRelate({ cat: "fruit" }, { cat: "fruit" }, solver), true);
  assert.equal(relationRuleEngine.canRelate({ cat: null }, { cat: null }, gameplay), false);
});

test("unscoped relation calls fail closed", () => {
  const { relationRuleEngine, RelationRuleEngine } = loadEngine();
  assert.equal(relationRuleEngine.canRelate({ cat: "fruit" }, { cat: "fruit" }), false);
  const engine = new RelationRuleEngine();
  engine.register({ id: "unsafe", matches: () => true });
  assert.equal(engine.canRelate({ id: "a" }, { id: "b" }, { purpose: "gameplay-merge" }), false);
});

test("policy guards relation rules by purpose, world and target role", () => {
  const { RelationRuleEngine } = loadEngine();
  const engine = new RelationRuleEngine();
  engine.register({
    id: "forest-memory",
    policy: {
      purposes: ["gameplay-merge"],
      worldIds: ["forest"],
      targetRoles: ["tableau-group"],
    },
    matches: (left, right) => left?.semantic === right?.semantic,
  });
  const pair = [{ semantic: "memory" }, { semantic: "memory" }];
  assert.equal(engine.canRelate(...pair, { purpose: "gameplay-merge", worldId: "forest", targetRole: "tableau-group" }), true);
  assert.equal(engine.canRelate(...pair, { purpose: "gameplay-merge", worldId: "forest", targetRole: "category-slot" }), false);
  assert.equal(engine.canRelate(...pair, { purpose: "solver-merge", worldId: "forest", targetRole: "tableau-group" }), false);
  assert.equal(engine.canRelate(...pair, { purpose: "gameplay-merge", worldId: "classic", targetRole: "tableau-group" }), false);
});

test("relation rules remain ordered and additive inside the same allowed context", () => {
  const { RelationRuleEngine } = loadEngine();
  const engine = new RelationRuleEngine();
  const policy = { purposes: ["story-relation"] };
  engine.register({ id: "first", policy, matches: () => false });
  engine.register({ id: "semantic", policy, matches: (left, right) => left?.semantic != null && left.semantic === right?.semantic });
  assert.equal(engine.matchingRule({ semantic: "memory" }, { semantic: "memory" }, { purpose: "story-relation" }), "semantic");
  assert.deepEqual(Array.from(engine.ruleIds()), ["first", "semantic"]);
});

test("rule ids are stable and duplicate registration is rejected", () => {
  const { RelationRuleEngine } = loadEngine();
  const engine = new RelationRuleEngine();
  engine.register({ id: "stable", policy: { purposes: ["test"] }, matches: () => true });
  assert.throws(() => engine.register({ id: "stable", policy: { purposes: ["test"] }, matches: () => false }), /already registered/);
});

test("runtime callers declare their relation purpose and strict slot identity stays separate", async () => {
  const stateSource = await readFile(new URL("../js/game/state.js", import.meta.url), "utf8");
  const generatorSource = await readFile(new URL("../js/generator.js", import.meta.url), "utf8");
  const rulesSource = await readFile(new URL("../js/game/rules.js", import.meta.url), "utf8");
  assert.match(stateSource, /relationRuleEngine\?\.canRelate\(a, b, \{ purpose: "gameplay-merge", state \}\)/);
  assert.match(generatorSource, /relationRuleEngine\?\.canRelate\(ta, tb, \{ purpose: "solver-merge", state: s \}\)/);
  assert.match(rulesSource, /activeGroups\.some\(\(group\) => canMerge\(group, moving\)\)/);
  assert.match(rulesSource, /currentCc\.cat !== cc\.cat/, "slot completion must keep strict category identity");
});

test("relation engine loads before generator and is precached", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const sw = await readFile(new URL("../sw.js", import.meta.url), "utf8");
  const engineAt = html.indexOf("./js/narrative/relation-rule-engine.js");
  const generatorAt = html.indexOf("./js/generator.js");
  assert.ok(engineAt >= 0 && generatorAt > engineAt, "relation engine must load before generator");
  assert.match(sw, /"\.\/js\/narrative\/relation-rule-engine\.js"/);
});
