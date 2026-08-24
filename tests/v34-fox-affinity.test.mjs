import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../js/v33-fox-journey.js", import.meta.url), "utf8");

test("Fox affinity thresholds are substantially increased", () => {
  const match = source.match(/LEVEL_THRESHOLDS\s*=\s*Object\.freeze\(\[([^\]]+)\]\)/);
  assert.ok(match, "LEVEL_THRESHOLDS missing");
  const thresholds = match[1].split(",").map((x) => Number(x.trim()));
  assert.deepEqual(thresholds, [0, 300, 900, 1800, 3000]);
  assert.ok(thresholds[4] > 800 * 3);
});

test("Fox quests unlock only after the current affinity gauge is full", () => {
  assert.match(source, /questGates/);
  assert.match(source, /if \(level < 5 && progress\.progressXp >= target && !journey\.questGates\[String\(level\)\]\)/);
  assert.match(source, /if \(quest\.level !== level \|\| !questGateAt\(level\)\) continue/);
  assert.match(source, /runTimestamp\(run\) > gateAt/);
});

test("Fox level-up quests are harder than v33 launch values", () => {
  const expected = [
    ["fox-trust", 5], ["fox-no-trace", 8], ["fox-combo", 5], ["fox-daily", 3], ["fox-detour", 5], ["fox-sparring", 3],
  ];
  for (const [id, target] of expected) {
    const pattern = new RegExp(`id: "${id}"[^\\n]+target: ${target}`);
    assert.match(source, pattern, `${id} target mismatch`);
  }
});

test("Fox dialogue contains five distinct relationship tiers", () => {
  for (let tier = 1; tier <= 5; tier++) assert.match(source, new RegExp(`\\n    ${tier}: \\{`));
  assert.match(source, /Доверие|довер/iu);
  assert.match(source, /старый друг|вместе/iu);
});
