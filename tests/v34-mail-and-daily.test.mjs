import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const ui = await readFile(new URL("../js/v34-product-update.js", import.meta.url), "utf8");
const admin = await readFile(new URL("../js/admin-mail.js", import.meta.url), "utf8");
const api = await readFile(new URL("../api/developer-mail.mjs", import.meta.url), "utf8");
const gateway = await readFile(new URL("../yandex/index.mjs", import.meta.url), "utf8");
const gatewaySpec = await readFile(new URL("../yandex/api-gateway.template.yaml", import.meta.url), "utf8");

test("mascot daily grants affinity, never player XP", () => {
  const start = ui.indexOf("Daily assignment from the currently selected mascot");
  const end = ui.indexOf("Weekly/monthly definitions", start);
  const section = ui.slice(start, end);
  assert.match(section, /опыта привязанности|привязанности/);
  assert.equal(section.includes("awardXp("), false);
  assert.match(section, /selectedTamedMascot/);
  assert.match(section, /mascotDailyMarkup/);
});

test("admin developer mail supports global and individual delivery", () => {
  assert.match(admin, /Все зарегистрированные игроки/);
  assert.match(admin, /\/api\/admin\/mail/);
  assert.match(api, /GLOBAL_MAIL_KEY/);
  assert.match(api, /mailKeyForUser/);
  assert.match(api, /currentAdminSession/);
  assert.match(gateway, /url\.pathname === "\/api\/admin\/mail"/);
  assert.match(gateway, /\["developer-mail", developerMail\]/);
  assert.match(gatewaySpec, /\/api\/admin\/mail:/);
});

test("player mail endpoint requires a current account session before personal mail", () => {
  assert.match(api, /const session = await currentSession\(request\)/);
  assert.match(api, /if \(!session\) return json\(\{ ok:true, messages:\[\] \}\)/);
  assert.match(ui, /accountSignedIn/);
});

test("mascot daily cloud merge never carries yesterday completion into today", async () => {
  const { mergeMascotDailySnapshots } = await import(new URL("../api/_v34-profile-merge-lib.mjs", import.meta.url));
  const merged = mergeMascotDailySnapshots(
    { date:"2026-08-23", quests:{ fox:{ progress:2, completed:true, rewarded:true } }, affinityBank:{fox:40} },
    { date:"2026-08-24", quests:{}, affinityBank:{fox:0} },
  );
  assert.equal(merged.date, "2026-08-24");
  assert.deepEqual(merged.quests, {});
  assert.equal(merged.affinityBank.fox, 0);
});

test("same-day mascot daily progress merges monotonically", async () => {
  const { mergeMascotDailySnapshots } = await import(new URL("../api/_v34-profile-merge-lib.mjs", import.meta.url));
  const merged = mergeMascotDailySnapshots(
    { date:"2026-08-24", quests:{ fox:{ progress:1, completed:false, rewarded:false } }, affinityBank:{fox:20} },
    { date:"2026-08-24", quests:{ fox:{ progress:2, completed:true, rewarded:true } }, affinityBank:{fox:10} },
  );
  assert.equal(merged.quests.fox.progress, 2);
  assert.equal(merged.quests.fox.completed, true);
  assert.equal(merged.quests.fox.rewarded, true);
  assert.equal(merged.affinityBank.fox, 20);
});
