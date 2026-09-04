import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("profile persistence verifies lock ownership at commit", async () => {
  const source = await read("api/_profile-sync-lib.mjs");
  assert.match(source, /PROFILE_LOCK_TTL_MS = 15000/);
  assert.match(source, /profile_lock_lost/);
  assert.match(source, /redis\.call\('GET', KEYS\[1\]\) ~= ARGV\[1\]/);
});

test("account sync treats lost locks as retryable and canonicalizes ledger", async () => {
  const source = await read("api/account.mjs");
  assert.match(source, /profile_lock_lost/);
  assert.match(source, /retryable: true/);
  assert.match(source, /mergeCanonicalProfile/);
});

test("mobile consistency uses canonical server game day", async () => {
  const source = await read("js/mobile-consistency-hardening.js");
  assert.match(source, /solivoc-server-clock-v1/);
  assert.match(source, /Europe\/Warsaw/);
  assert.match(source, /todayKey = canonicalGameDay/);
  assert.match(source, /currentDailyWeek = function canonicalDailyWeek/);
});

test("level completion is committed once into durable pending events", async () => {
  const source = await read("js/mobile-consistency-hardening.js");
  assert.match(source, /transactionalFinishLevel/);
  assert.match(source, /SolivocPendingEvents/);
  assert.match(source, /queue\?\.hasTransaction\?\.\(txId\)/);
  assert.match(source, /queue\?\.enqueue\?\.\(/);
  assert.match(source, /eventType: "completion"/);
  assert.match(source, /campaign,/);
  assert.match(source, /level,/);
  assert.match(source, /stars,/);
  assert.match(source, /xpDelta:/);
  assert.match(source, /moves:/);
  assert.match(source, /durationMs:/);
  assert.match(source, /gameDayId: canonicalGameDay\(\)/);
  assert.match(source, /saveProfile\(\{ skipCloud: false \}\)/);
  assert.match(source, /save\?\.\(\{ immediate: true \}\)/);
  assert.doesNotMatch(source, /profile\.completionTransactions\[txId\] =/);
});

test("frontend build loads event queue before durability and completion owner", async () => {
  const source = await read("scripts/build-frontend.mjs");
  const queue = source.indexOf("core/pending-events.js");
  const eventSync = source.indexOf("core/pending-event-sync.js");
  const durable = source.indexOf("client-stability-hardening.js");
  const consistency = source.indexOf("mobile-consistency-hardening.js");
  const canonical = source.indexOf("canonical-sync-hardening.js");
  const app = source.indexOf('const appScriptTag');
  assert.ok(queue >= 0 && eventSync > queue && durable > eventSync && consistency > durable && canonical > consistency);
  assert.ok(app >= 0);
});
