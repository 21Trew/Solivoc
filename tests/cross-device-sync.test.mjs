import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const client = await readFile(new URL("../js/cross-device-sync-hardening.js", import.meta.url), "utf8");
const syncManager = await readFile(new URL("../js/core/sync-manager.js", import.meta.url), "utf8");
const login = await readFile(new URL("../api/account-login.mjs", import.meta.url), "utf8");
const account = await readFile(new URL("../api/account.mjs", import.meta.url), "utf8");
const router = await readFile(new URL("../yandex/index.mjs", import.meta.url), "utf8");
const build = await readFile(new URL("../scripts/build-frontend.mjs", import.meta.url), "utf8");

test("second-device login never uploads the local profile before cloud read", () => {
  assert.match(client, /\/api\/account-login/);
  assert.doesNotMatch(client, /account-login[^\n]+profile:/);
  assert.doesNotMatch(login, /mergeCloudProfile/);
  assert.doesNotMatch(login, /writeJsonKey\(profileKey/);
  assert.match(login, /normalizeCanonicalProfile/);
  assert.match(login, /syncLeaderboardProjection/);
  assert.doesNotMatch(login, /leaderboardCampaignFloor/);
  assert.doesNotMatch(login, /profileBehindCampaignFloor/);
});

test("same-account offline progress is preserved after cloud-first login", () => {
  assert.match(client, /knownSameAccount/);
  assert.match(client, /localBeforeLogin/);
  assert.match(client, /mergeAccountProfiles\(localBeforeLogin, data\.profile/);
  assert.match(client, /scheduleAccountSync\?\.\(250\)/);
});

test("session restore retries through the single sync owner", () => {
  assert.match(client, /apiFetch\("\/api\/account"/);
  assert.match(client, /timeout: 8000/);
  assert.match(client, /SolivocScheduler\.timeout\("sync\.cloud-restore-retry"/);
  assert.doesNotMatch(client, /SolivocLifecycle\.on\("(?:online|focus|visible)", "sync\.cloud-refresh"/);
  assert.match(syncManager, /lifecycle\.on\("online", "sync\.manager"/);
  assert.match(syncManager, /lifecycle\.on\("resume", "sync\.manager"/);
  assert.match(syncManager, /"sync\.cloud-restore-retry"/);
  assert.match(syncManager, /"sync\.cloud-refresh"/);
});

test("account sync merges canonical profile then derives leaderboard", () => {
  assert.match(account, /mergeCanonicalProfile\(current, incoming, profile\)/);
  assert.match(account, /syncLeaderboardProjection\(session\.userId, merged\.profile, session\.user\)/);
  assert.match(account, /readCanonicalProfile/);
  assert.doesNotMatch(account, /readCampaignFloor/);
  assert.doesNotMatch(account, /applyCampaignFloor/);
});

test("new login endpoint is routed and frontend guards are built in order", () => {
  assert.match(router, /account-login/);
  assert.match(build, /cross-device-sync-hardening\.js/);
  assert.match(build, /canonical-sync-hardening\.js/);
  assert.match(build, /core\/sync-manager\.js/);
  const durability = build.indexOf("client-stability-hardening.js");
  const consistency = build.indexOf("mobile-consistency-hardening.js");
  const crossDevice = build.indexOf("cross-device-sync-hardening.js");
  const canonical = build.indexOf("canonical-sync-hardening.js");
  const manager = build.indexOf("core/sync-manager.js");
  assert.ok(durability >= 0 && consistency > durability && crossDevice > consistency && canonical > crossDevice && manager > canonical);
});
