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
function plain(value) { return JSON.parse(JSON.stringify(value)); }

test("folklore rarity keeps the 1×7 progression", () => {
  const ctx = catalogContext();
  const values = vm.runInContext(`[RARITY_DEFS.common.weight,RARITY_DEFS.uncommon.weight,RARITY_DEFS.rare.weight,RARITY_DEFS.epic.weight,RARITY_DEFS.legendary.weight]`, ctx);
  assert.deepEqual(Array.from(values), [1, 7, 49, 343, 2401]);
  const labels = vm.runInContext(`RARITY_IDS.map((id)=>RARITY_DEFS[id].labels.plural)`, ctx);
  assert.deepEqual(Array.from(labels), ["Простые", "Дивные", "Вещие", "Заповедные", "Сокровенные"]);
});

test("every rarity-bearing reward has centralized rarity and source metadata", () => {
  const ctx = catalogContext();
  assert.deepEqual(Array.from(ctx.__solivocV39Test.validateCollectibleCatalog()), []);
  assert.deepEqual(Array.from(ctx.__solivocV39Test.linkedAchievementMismatches()), []);
  const groups = Object.fromEntries(ctx.__solivocV39Test.catalogGroups().map(([type, defs]) => [type, defs.length]));
  assert.deepEqual(groups, {
    theme:12, cardBack:23, frame:15, avatar:136, title:86, achievement:73,
    effect:12, sound:4, appIcon:3, appIconFrame:4, loginReward:5, relic:6, mascotHome:0,
  });
});

test("achievement audit uses all five tiers instead of legacy binary rarity", () => {
  const ctx = catalogContext();
  const summary = plain(ctx.__solivocV39Test.rarityAuditSummary().achievement);
  assert.deepEqual(summary, { total:73, common:12, uncommon:30, rare:22, epic:7, legendary:2 });
  assert.equal(vm.runInContext(`ACHIEVEMENTS.find((a)=>a.id==="retro90").rarity`, ctx), "legendary");
  assert.equal(vm.runInContext(`ACHIEVEMENTS.find((a)=>a.id==="allAchievements").rarity`, ctx), "legendary");
  assert.equal(vm.runInContext(`ACHIEVEMENTS.find((a)=>a.id==="daily100").rarity`, ctx), "epic");
  assert.equal(vm.runInContext(`ACHIEVEMENTS.find((a)=>a.id==="first").rarity`, ctx), "common");
});

test("card backs are rebalanced instead of clustering in Zapovednoe", () => {
  const ctx = catalogContext();
  assert.deepEqual(plain(ctx.__solivocV39Test.rarityAuditSummary().cardBack), { total:23, common:4, uncommon:6, rare:8, epic:4, legendary:1 });
  assert.equal(vm.runInContext(`CARD_BACK_DEFS.find((x)=>x.id==="grand-trophy").rarity`, ctx), "legendary");
  assert.equal(vm.runInContext(`CARD_BACK_DEFS.find((x)=>x.id==="anniversary").rarity`, ctx), "epic");
  assert.equal(vm.runInContext(`CARD_BACK_DEFS.find((x)=>x.id==="velvet").rarity`, ctx), "uncommon");
});

test("linear cosmetic tracks do not manufacture Zapovednoe tiers", () => {
  const ctx = catalogContext();
  const audit = plain(ctx.__solivocV39Test.rarityAuditSummary());
  assert.equal(audit.theme.epic + audit.theme.legendary, 0);
  assert.equal(audit.frame.epic + audit.frame.legendary, 0);
  assert.equal(audit.effect.epic + audit.effect.legendary, 0);
  assert.deepEqual(audit.sound, { total:4, common:2, uncommon:1, rare:1, epic:0, legendary:0 });
  assert.deepEqual(audit.appIconFrame, { total:4, common:2, uncommon:1, rare:1, epic:0, legendary:0 });
});

test("login milestones and late rank avatars participate in rarity", () => {
  const ctx = catalogContext();
  assert.deepEqual(Array.from(vm.runInContext(`LOGIN_REWARD_DEFS.map((x)=>x.rarity)`, ctx)), ["uncommon","uncommon","rare","epic","epic"]);
  assert.equal(vm.runInContext(`avatarDefByEmoji(rankRewardAvatar(10)).rarity`, ctx), "common");
  assert.equal(vm.runInContext(`avatarDefByEmoji(rankRewardAvatar(30)).rarity`, ctx), "uncommon");
  assert.equal(vm.runInContext(`avatarDefByEmoji(rankRewardAvatar(75)).rarity`, ctx), "rare");
  assert.equal(vm.runInContext(`avatarDefByEmoji(rankRewardAvatar(100)).rarity`, ctx), "epic");
  assert.match(patchSource, /decorateRankRewards/);
  assert.match(patchSource, /decorateLoginRewards/);
});

test("duplicate rank/login avatars retain every valid unlock route", () => {
  const ctx = catalogContext();
  const compassRoutes = plain(vm.runInContext(`avatarDefByEmoji("🧭").unlocks`, ctx));
  assert.ok(compassRoutes.some((x)=>x.type === "rank" && x.rank === 49));
  assert.ok(compassRoutes.some((x)=>x.type === "days" && x.days === 50));
  assert.equal(vm.runInContext(`avatarUnlocked(avatarDefByEmoji("🧭"),{xp:0,retention:{totalOpenDays:50}})`, ctx), true);
  const templeRoutes = plain(vm.runInContext(`avatarDefByEmoji("🏛️").unlocks`, ctx));
  assert.ok(templeRoutes.some((x)=>x.type === "rank" && x.rank === 51));
  assert.ok(templeRoutes.some((x)=>x.type === "days" && x.days === 100));
  assert.equal(vm.runInContext(`avatarUnlocked(avatarDefByEmoji("🏛️"),{xp:0,retention:{totalOpenDays:100}})`, ctx), true);
});

test("achievement-linked cosmetics inherit the same difficulty tier", () => {
  const ctx = catalogContext();
  const checks = [
    ["CARD_BACK_DEFS","crown","chapterPerfect1"],
    ["CARD_BACK_DEFS","chronicle","daily100"],
    ["CARD_BACK_DEFS","grand-trophy","allAchievements"],
    ["EFFECT_DEFS","petals","chapterPerfect1"],
    ["EFFECT_DEFS","comet","combo10"],
    ["TITLE_DEFS","hand","combo10"],
    ["APP_ICON_FRAME_DEFS","prism","combo10"],
  ];
  for (const [catalog,id,achievement] of checks) {
    const pair = plain(vm.runInContext(`(()=>{const d=${catalog}.find((x)=>x.id==="${id}"),a=ACHIEVEMENTS.find((x)=>x.id==="${achievement}");return [d.rarity,a.rarity]})()`, ctx));
    assert.equal(pair[0], pair[1], `${catalog}:${id}`);
  }
});

test("existing avatar save format stays emoji based", () => {
  const ctx = catalogContext();
  const result = vm.runInContext(`({base:AVATAR_EMOJIS.every((x)=>availableAvatarEmojis({xp:0,retention:{totalOpenDays:0}}).includes(x)), value:avatarDefByEmoji("🙂").emoji, rank:avatarDefByEmoji("🧠").unlocks.find((x)=>x.type==="rank").rank})`, ctx);
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
});

test("UI exposes the full folklore scale for achievements and appearance rewards", () => {
  for (const label of ["Простые","Дивные","Вещие","Заповедные","Сокровенные"]) assert.ok(patchSource.includes(label));
  assert.match(patchSource, /achievementFiltersMarkup/);
  assert.match(patchSource, /decorateAppearanceSection\("effects"/);
  assert.match(patchSource, /decorateAppearanceSection\("sounds"/);
  assert.match(patchSource, /v39-rarity-stamp/);
  assert.doesNotMatch(patchSource, />Редкие</);
  assert.doesNotMatch(patchSource, />Легендарные</);
});

test("one rarity filter component covers cosmetic collections", () => {
  for (const scope of ["themes", "backs", "frames", "effects", "sounds", "avatars", "titles"]) assert.match(patchSource, new RegExp(`${scope}:\\"all\\"|${scope}:"all"`));
  assert.match(patchSource, /v39-rarity-filters/);
});

test("frontend build injects rarity layer before app bootstrap", () => {
  const patchAt = builderSource.indexOf('"./js/v39-rarity-collectibles.js"');
  const appAt = builderSource.indexOf('const appScriptTag');
  assert.ok(patchAt > appAt);
  assert.match(builderSource, /v39-rarity-collectibles\.js/);
});
