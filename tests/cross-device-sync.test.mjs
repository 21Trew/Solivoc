import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const client = await readFile(new URL("../js/cross-device-sync-hardening.js", import.meta.url), "utf8");
const login = await readFile(new URL("../api/account-login.mjs", import.meta.url), "utf8");
const account = await readFile(new URL("../api/account.mjs", import.meta.url), "utf8");
const router = await readFile(new URL("../yandex/index.mjs", import.meta.url), "utf8");
const build = await readFile(new URL("../scripts/build-frontend.mjs", import.meta.url), "utf8");

test("second-device login never uploads the local profile before cloud read", () => {
  assert.match(client, /\/api\/account-login/);
  assert.doesNotMatch(client, /account-login[^\n]+profile:/);
  assert.doesNotMatch(login, /mergeCloudProfile/);
  assert.doesNotMatch(login, /writeJsonKey\(profileKey/);
  assert.match(login, /leaderboardCampaignFloor/);
  assert.match(login, /profileBehindCampaignFloor/);
});

test("same-account offline progress is preserved after cloud-first login", () => {
  assert.match(client, /knownSameAccount/);
  assert.match(client, /localBeforeLogin/);
  assert.match(client, /mergeAccountProfiles\(localBeforeLogin, data\.profile/);
  assert.match(client, /scheduleAccountSync\?\.\(250\)/);
});

test("session restore reads through account endpoint and retries cloud refresh", () => {
  assert.match(client, /apiFetch\("\/api\/account"/);
  assert.match(client, /timeout: 8000/);
  assert.match(client, /setTimeout\(\(\) => refreshAccountFromCloud\(\{ force: true \}\), 5000\)/);
  assert.match(client, /addEventListener\("online"/);
  assert.match(client, /addEventListener\("focus"/);
  assert.match(client, /visibilitychange/);
});

test("account sync applies the server-confirmed campaign floor", () => {
  assert.match(account, /readCampaignFloor/);
  assert.match(account, /profileBehindCampaignFloor/);
  assert.match(account, /applyCampaignFloor\(profile, campaignFloor\)/);
  assert.match(account, /readProfileWithServerFloor/);
});

test("new login endpoint is routed and frontend guard is built", () => {
  assert.match(router, /account-login/);
  assert.match(build, /cross-device-sync-hardening\.js/);
  const durability = build.indexOf("client-stability-hardening.js");
  const consistency = build.indexOf("mobile-consistency-hardening.js");
  const crossDevice = build.indexOf("cross-device-sync-hardening.js");
  assert.ok(durability >= 0 && consistency > durability && crossDevice > consistency);
});
