import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const configSource = fs.readFileSync(new URL("../js/config.js", import.meta.url), "utf8");
const patchSource = fs.readFileSync(new URL("../js/v39-rarity-collectibles.js", import.meta.url), "utf8");
const profileSource = fs.readFileSync(new URL("../js/profile.js", import.meta.url), "utf8");
const builderSource = fs.readFileSync(new URL("../scripts/build-frontend.mjs", import.meta.url), "utf8");

function catalogContext() {
  const context = vm.createContext({ console });
  vm.runInContext(configSource, context, { filename: "js/config.js" });
  vm.runInContext(patchSource, context, { filename: "js/v39-rarity-collectibles.js" });
  return context;
}

test("folklore rarity keeps the 1×7 progression", () => {
  const ctx = catalogContext();
  const values = vm.runInContext(`[RARITY_DEFS.common.weight,RARITY_DEFS.uncommon.weight,RARITY_DEFS.rare.weight,RARITY_DEFS.epic.weight,RARITY_DEFS.legendary.weight]`, ctx);
  assert.deepEqual(Array.from(values), [1, 7, 49, 343, 2401]);
  const labels = vm.runInContext(`RARITY_IDS.map((id)=>RARITY_DEFS[id].labels.plural)`, ctx);
  assert.deepEqual(Array.from(labels), ["Простые", "Дивные", "Вещие", "Заповедные", "Сокровенные"]);
});

test("every live collectible has rarity and source metadata", () => {
  const ctx = catalogContext();
  assert.deepEqual(Array.from(ctx.__solivocV39Test.validateCollectibleCatalog()), []);
  const counts = Object.fromEntries(ctx.__solivocV39Test.catalogGroups().map(([type, defs]) => [type, defs.length]));
  assert.equal(counts.theme, 12);
  assert.equal(counts.cardBack, 23);
  assert.equal(counts.frame, 15);
  assert.ok(counts.avatar >= 130);
  assert.ok(counts.title >= 13);
  assert.equal(counts.relic, 6);
});

test("existing avatar save format stays emoji based", () => {
  const ctx = catalogContext();
  const result = vm.runInContext(`({base:AVATAR_EMOJIS.every((x)=>availableAvatarEmojis({xp:0,retention:{totalOpenDays:0}}).includes(x)), value:avatarDefByEmoji("🙂").emoji, rank:avatarDefByEmoji("🧠").unlock.rank})`, ctx);
  assert.equal(result.base, true);
  assert.equal(result.value, "🙂");
  assert.equal(result.rank, 2);
  assert.match(profileSource, /avatarEmoji:\s*"🙂"/);
});

test("collectibles profile domain is persistent and bounded", () => {
  assert.match(profileSource, /collectibles:\s*\{ version: 1, unlocked: \[\], discovered: \[\], seen: \[\] \}/);
  assert.match(profileSource, /p\.collectibles\?\.unlocked/);
  assert.match(profileSource, /\.slice\(0, 500\)/);
});

test("relics begin at Veshchee and do not invent Sokrovennoe rewards", () => {
  const ctx = catalogContext();
  const relics = ctx.__solivocV39Test.catalogGroups().find(([type]) => type === "relic")[1];
  assert.ok(relics.every((def) => ["rare", "epic"].includes(def.rarity)));
  assert.equal(relics.some((def) => def.rarity === "legendary"), false);
  const world = relics.find((def) => def.id === "first-world-seal");
  assert.equal(world.unlocked({ stats:{ levelsCompleted:99 } }), false);
  assert.equal(world.unlocked({ stats:{ levelsCompleted:100 } }), true);
});

test("old achievement rarity words are translated in the UI layer", () => {
  assert.match(patchSource, /легендарное"," · Заповедное/);
  assert.match(patchSource, /редкое"," · Вещее/);
  assert.match(patchSource, />Редкие</);
  assert.match(patchSource, />Легендарные</);
});

test("one rarity filter component is used across all requested collections", () => {
  for (const scope of ["themes", "backs", "frames", "avatars", "titles"]) assert.match(patchSource, new RegExp(`filterState[^;]*${scope}|${scope}:\"all\"`));
  assert.match(patchSource, /v39-rarity-filters/);
});

test("frontend build injects v39 before app bootstrap", () => {
  const patchAt = builderSource.indexOf('".\/js\/v39-rarity-collectibles.js"');
  const appAt = builderSource.indexOf('const appScriptTag');
  assert.ok(patchAt > appAt);
  assert.match(builderSource, /v39-rarity-collectibles\.js/);
});
