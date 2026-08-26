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

test("legacy-category preserves strict category merge semantics", () => {
  const { relationRuleEngine } = loadEngine();
  assert.deepEqual(Array.from(relationRuleEngine.ruleIds()), ["legacy-category"]);
  assert.equal(relationRuleEngine.canRelate({ cards: [{ cat: "fruit" }] }, { cards: [{ cat: "fruit" }] }), true);
  assert.equal(relationRuleEngine.canRelate({ cards: [{ cat: "fruit" }] }, { cards: [{ cat: "sea" }] }), false);
  assert.equal(relationRuleEngine.canRelate({ cat: "fruit" }, { cat: "fruit" }), true);
  assert.equal(relationRuleEngine.canRelate({ cat: null }, { cat: null }), false);
});

test("relation rules are ordered and additive", () => {
  const { RelationRuleEngine } = loadEngine();
  const engine = new RelationRuleEngine();
  engine.register({ id: "first", matches: () => false });
  engine.register({ id: "semantic", matches: (left, right) => left?.semantic != null && left.semantic === right?.semantic });
  assert.equal(engine.matchingRule({ semantic: "memory" }, { semantic: "memory" }), "semantic");
  assert.deepEqual(Array.from(engine.ruleIds()), ["first", "semantic"]);
});

test("rule ids are stable and duplicate registration is rejected", () => {
  const { RelationRuleEngine } = loadEngine();
  const engine = new RelationRuleEngine();
  engine.register({ id: "stable", matches: () => true });
  assert.throws(() => engine.register({ id: "stable", matches: () => false }), /already registered/);
});

test("gameplay, solver and deadlock prediction use the same relation seam", async () => {
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
