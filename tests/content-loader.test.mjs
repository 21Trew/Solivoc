import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const engineSource = await readFile(new URL("../js/narrative/relation-rule-engine.js", import.meta.url), "utf8");
const loaderSource = await readFile(new URL("../js/narrative/content-loader.js", import.meta.url), "utf8");

function loadRuntime(fetchImpl = async () => ({ ok: false, status: 404 })) {
  const sandbox = { console: { warn() {} }, fetch: fetchImpl };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(engineSource, sandbox, { filename: "relation-rule-engine.js" });
  vm.runInNewContext(loaderSource, sandbox, { filename: "content-loader.js" });
  return sandbox;
}

test("authored adapter registers only explicit directed pairs and enforces Forest policy", () => {
  const { SolivocWorldContent, relationRuleEngine } = loadRuntime();
  const document = {
    schemaVersion: 1,
    worldId: "forest",
    packageVersion: "0.03",
    relationRules: [{
      id: "REL_FOREST_TEST_01",
      status: "BOUND",
      type: "explicit-pairs",
      policy: { purposes: ["story-relation"], targetRoles: ["tableau-group"] },
      pairs: [["WF_F01", "WF_F02"]],
    }],
  };
  const report = SolivocWorldContent.registerRelationRules(document, relationRuleEngine);
  assert.deepEqual(Array.from(report.registered), ["REL_FOREST_TEST_01"]);
  const allowed = { purpose: "story-relation", worldId: "forest", targetRole: "tableau-group" };
  assert.equal(relationRuleEngine.canRelate({ authoredId: "WF_F01" }, { authoredId: "WF_F02" }, allowed), true);
  assert.equal(relationRuleEngine.canRelate({ authoredId: "WF_F02" }, { authoredId: "WF_F01" }, allowed), false);
  assert.equal(relationRuleEngine.canRelate({ authoredId: "WF_F01" }, { authoredId: "WF_F02" }, { ...allowed, worldId: "classic" }), false);
  assert.equal(relationRuleEngine.canRelate({ authoredId: "WF_F01" }, { authoredId: "WF_F02" }, { ...allowed, purpose: "gameplay-merge" }), false);
});

test("TBD, unknown and incomplete authored rules fail closed without blocking valid rules", () => {
  const { SolivocWorldContent, relationRuleEngine } = loadRuntime();
  const document = {
    schemaVersion: 1,
    worldId: "forest",
    packageVersion: "0.03",
    relationRules: [
      { id: "REL_TBD", status: "TBD_AUTHORED", type: "explicit-pairs", policy: { purposes: ["story-relation"] }, pairs: [["A", "B"]] },
      { id: "REL_UNKNOWN", status: "BOUND", type: "semantic-similarity", policy: { purposes: ["story-relation"] }, pairs: [["A", "B"]] },
      { id: "REL_NO_PURPOSE", status: "BOUND", type: "explicit-pairs", pairs: [["A", "B"]] },
      { id: "REL_BAD_PAIR", status: "BOUND", type: "explicit-pairs", policy: { purposes: ["story-relation"] }, pairs: [["TBD_VALUE", "B"]] },
      { id: "REL_GOOD", status: "BOUND", type: "explicit-pairs", policy: { purposes: ["story-relation"] }, pairs: [["A", "B"]] },
    ],
  };
  const report = SolivocWorldContent.registerRelationRules(document, relationRuleEngine);
  assert.deepEqual(Array.from(report.registered), ["REL_GOOD"]);
  assert.deepEqual(Array.from(report.skipped, (item) => item.reason), [
    "rule_not_executable",
    "unsupported_rule_type",
    "missing_rule_purpose",
    "invalid_explicit_pair",
  ]);
});

test("relation registration is idempotent for the same runtime document", () => {
  const { SolivocWorldContent, relationRuleEngine } = loadRuntime();
  const document = {
    schemaVersion: 1,
    worldId: "forest",
    packageVersion: "0.03",
    relationRules: [{
      id: "REL_FOREST_ONCE",
      status: "BOUND",
      type: "explicit-pairs",
      policy: { purposes: ["story-relation"] },
      pairs: [["A", "B"]],
    }],
  };
  const first = SolivocWorldContent.registerRelationRules(document, relationRuleEngine);
  const second = SolivocWorldContent.registerRelationRules(document, relationRuleEngine);
  assert.deepEqual(Array.from(first.registered), ["REL_FOREST_ONCE"]);
  assert.deepEqual(Array.from(second.registered), []);
  assert.equal(second.skipped[0].reason, "already_registered");
});

test("manifest accepts only declared safe runtime json paths", () => {
  const { SolivocWorldContent } = loadRuntime();
  const base = {
    schemaVersion: 1,
    worldId: "forest",
    packageVersion: "0.03",
    source: { designArchive: "archive.zip" },
    runtimeFiles: ["data/rules.json"],
  };
  assert.equal(SolivocWorldContent.validateManifest(base).ok, true);
  assert.equal(SolivocWorldContent.validateManifest({ ...base, runtimeFiles: ["../rules.json"] }).ok, false);
  assert.equal(SolivocWorldContent.validateManifest({ ...base, runtimeFiles: ["data/rules.json", "data/rules.json"] }).ok, false);
});

test("Forest foundation export declares an empty executable relation set", async () => {
  const manifest = JSON.parse(await readFile(new URL("../content/worlds/forest/v0.03/package.manifest.json", import.meta.url), "utf8"));
  const rules = JSON.parse(await readFile(new URL("../content/worlds/forest/v0.03/data/rules.json", import.meta.url), "utf8"));
  const { SolivocWorldContent, relationRuleEngine } = loadRuntime();
  assert.ok(manifest.runtimeFiles.includes("data/rules.json"));
  assert.equal(SolivocWorldContent.validateRulesDocument(rules).ok, true);
  const report = SolivocWorldContent.registerRelationRules(rules, relationRuleEngine);
  assert.equal(report.registered.length, 0);
  assert.deepEqual(Array.from(relationRuleEngine.ruleIds()), ["legacy-category"]);
});

test("loader verifies manifest/rules identity and declaration before registration", async () => {
  const manifest = {
    schemaVersion: 1,
    worldId: "forest",
    packageVersion: "0.03",
    source: { designArchive: "archive.zip" },
    runtimeFiles: ["data/rules.json"],
  };
  const rules = { schemaVersion: 1, worldId: "forest", packageVersion: "0.03", relationRules: [] };
  const responses = new Map([
    ["./content/worlds/forest/v0.03/package.manifest.json", manifest],
    ["./content/worlds/forest/v0.03/data/rules.json", rules],
  ]);
  const fetchImpl = async (url) => ({
    ok: responses.has(url),
    status: responses.has(url) ? 200 : 404,
    async json() { return structuredClone(responses.get(url)); },
  });
  const { SolivocWorldContent, relationRuleEngine } = loadRuntime(fetchImpl);
  const loaded = await SolivocWorldContent.loadAndRegisterRelations("forest", "0.03", relationRuleEngine);
  assert.equal(loaded.report.ok, true);
  assert.equal(loaded.report.registered.length, 0);
});
