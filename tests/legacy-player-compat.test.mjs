import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const compatSource = await readFile(new URL("../js/narrative/product-mode-compat.js", import.meta.url), "utf8");
const runtimeConfigSource = await readFile(new URL("../js/runtime-config.js", import.meta.url), "utf8");
const authSource = await readFile(new URL("../api/_auth-lib.mjs", import.meta.url), "utf8");
const relationSource = await readFile(new URL("../js/narrative/relation-rule-engine.js", import.meta.url), "utf8");
const swSource = await readFile(new URL("../sw.js", import.meta.url), "utf8");

function starsThrough(level) {
  return Object.fromEntries(Array.from({ length: level }, (_, index) => [index + 1, index % 5 === 0 ? 3 : index % 2 === 0 ? 2 : 1]));
}

function storageSandbox(initial = {}) {
  const data = new Map(Object.entries(initial));
  const localStorage = {
    getItem(key) { return data.has(key) ? data.get(key) : null; },
    setItem(key, value) { data.set(String(key), String(value)); },
    removeItem(key) { data.delete(String(key)); },
  };
  const sandbox = {
    console,
    localStorage,
    sessionStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    navigator: {},
    location: { protocol: "https:", hostname: "solivoc.ru" },
    setTimeout() { return 1; },
    clearTimeout() {},
  };
  sandbox.window = sandbox;
  sandbox.window.location = sandbox.location;
  sandbox.globalThis = sandbox;
  return { sandbox, data };
}

test("modern production profile survives Forest upgrade without losing XP, achievements, mascots or Classic progress", () => {
  const classicStars = starsThrough(137);
  const oldProfile = {
    currentLevel: 138,
    starsByLevel: classicStars,
    totalStars: Object.values(classicStars).reduce((a, b) => a + b, 0),
    xp: 12450,
    campaignProgressVersion: 2,
    xpMigrated: true,
    achievements: ["first_win", "collector", "long_run"],
    companionsUnlocked: ["owl", "cat", "fox"],
    mascotProgressVersion: 4,
    mascotProgress: { owl: { affinity: 320, tier: 3 }, cat: { affinity: 210, tier: 2 }, fox: { affinity: 115, tier: 1 } },
    stats: { levelsCompleted: 137, chapterFinalsCompleted: 13, gamesPlayed: 412 },
    levelRecords: { 136: { stars: 2, moves: 71 }, 137: { stars: 1, moves: 83 } },
  };
  const before = structuredClone(oldProfile);
  const { sandbox, data } = storageSandbox({ "worditaire-profile-v7": JSON.stringify(oldProfile) });
  vm.runInNewContext(runtimeConfigSource, sandbox, { filename: "runtime-config.js" });
  const after = JSON.parse(data.get("worditaire-profile-v7"));

  assert.equal(after.xp, before.xp);
  assert.deepEqual(after.achievements, before.achievements);
  assert.deepEqual(after.companionsUnlocked, before.companionsUnlocked);
  assert.deepEqual(after.mascotProgress, before.mascotProgress);
  assert.equal(after.currentLevel, 138);
  assert.deepEqual(after.starsByLevel, before.starsByLevel);
  assert.equal(after.stats.levelsCompleted, 137);
  assert.equal(after.campaignProgressFloor, 137);
  assert.equal(after.campaignRepairXpAdjusted, true);
});

test("cloud campaign repair is destructive only for legacy profiles and modern progress has a monotonic floor", () => {
  assert.match(authSource, /Number\(profile\.campaignProgressVersion \|\| 0\) < 2/);
  assert.match(authSource, /profile\.campaignProgressFloor = Math\.max\(progressFloor, completedThrough\)/);
  assert.match(runtimeConfigSource, /Campaign progress is append-only for modern profiles/);
});

test("Classic is a product entry over the existing regular campaign, not a copied progression domain", () => {
  const calls = { makeLevel: [], close: 0, render: 0 };
  const profile = { currentLevel: 138, starsByLevel: starsThrough(137) };
  const sandbox = {
    console,
    profile,
    state: null,
    closeHub() { calls.close++; },
    makeLevel(level, options) { calls.makeLevel.push({ level, options }); return true; },
    render() { calls.render++; },
    updateCoach() {},
    setBackgroundMusic() {},
    musicModeForState() { return "game"; },
  };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(compatSource, sandbox, { filename: "product-mode-compat.js" });
  const api = sandbox.SolivocProductModes;
  const before = JSON.stringify(profile);
  const model = api.classicProgressModel(profile, null);

  assert.equal(model.mode, "regular");
  assert.equal(model.nextLevel, 138);
  assert.equal(model.completed, 137);
  api.launchClassic();
  assert.equal(calls.makeLevel.length, 1);
  assert.equal(calls.makeLevel[0].level, 138);
  assert.equal(calls.makeLevel[0].options.mode, "regular");
  assert.equal(JSON.stringify(profile), before);
});

test("active Classic round resumes instead of generating a replacement level", () => {
  const calls = { makeLevel: 0, render: 0 };
  const sandbox = {
    console,
    profile: { currentLevel: 138, starsByLevel: starsThrough(137) },
    state: { mode: "regular", level: 137, rewarded: false, failed: false },
    closeHub() {},
    makeLevel() { calls.makeLevel++; },
    render() { calls.render++; },
    updateCoach() {},
    setBackgroundMusic() {},
    musicModeForState() { return "game"; },
  };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(compatSource, sandbox, { filename: "product-mode-compat.js" });
  const result = sandbox.SolivocProductModes.launchClassic();
  assert.equal(result.resumed, true);
  assert.equal(result.mode, "regular");
  assert.equal(calls.makeLevel, 0);
  assert.equal(calls.render, 1);
});

test("player-facing shell says Story and Modes, with Classic inside Modes", () => {
  const sandbox = { console }; sandbox.globalThis = sandbox;
  vm.runInNewContext(compatSource, sandbox, { filename: "product-mode-compat.js" });
  const sourceMarkup = '<section aria-label="История и Расклады"><b>Расклады</b><small>Свободная игра и режимы</small><h3>Расклады</h3><span>Расклады</span></section>';
  const normalized = sandbox.SolivocProductModes.normalizeProductMarkup(sourceMarkup);
  assert.match(normalized, /История и Режимы/);
  assert.match(normalized, /<b>Режимы<\/b><small>Классика и другие режимы<\/small>/);
  assert.match(normalized, /<h3>Режимы игры<\/h3>/);
  assert.doesNotMatch(normalized, />Расклады</);
});

test("compatibility bridge loads after Story presentation and is available offline", () => {
  const storyAt = relationSource.indexOf('"story-presentation"');
  const compatAt = relationSource.indexOf('"product-mode-compat"');
  const knowledgeAt = relationSource.indexOf('"story-knowledge-ui"');
  assert.ok(storyAt >= 0 && compatAt > storyAt && knowledgeAt > compatAt);
  assert.ok(swSource.includes('"./js/narrative/product-mode-compat.js"'));
});
