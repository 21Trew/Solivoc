import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("pending queue is durable and does not soft-drop unacked events", async () => {
  const source = await read("js/core/pending-events.js");
  assert.match(source, /solivoc-pending-events-v1/);
  assert.match(source, /nextSequence/);
  assert.match(source, /sequenceNo/);
  assert.match(source, /idempotencyKey/);
  assert.match(source, /SolivocPersistence/);
  assert.match(source, /persistence\.put\(STORAGE_KEY/);
  assert.match(source, /pending_events_write_verify_failed/);
  assert.doesNotMatch(source, /state\.events\s*=\s*state\.events\.slice\(/);
  assert.doesNotMatch(source, /state\.events\.splice\(0/);
});

test("ACK removes pending events and retains bounded local transaction guard", async () => {
  const source = await read("js/core/pending-events.js");
  assert.match(source, /function ack\(eventIds = \[\]\)/);
  assert.match(source, /state\.events = kept/);
  assert.match(source, /RECENT_LIMIT = 512/);
  assert.match(source, /hasTransaction/);
});

test("event sync sends ACK batches and applies canonical snapshot", async () => {
  const source = await read("js/core/pending-event-sync.js");
  assert.match(source, /accountRequest\("\/api\/events"/);
  assert.match(source, /ackedEventIds/);
  assert.match(source, /queue\.ack\(acked\)/);
  assert.match(source, /applyAccountCloudProfile/);
  assert.match(source, /sync\.pending-events/);
});

test("profile sync waits for pending event ACKs", async () => {
  const source = await read("js/client-stability-hardening.js");
  const guard = source.indexOf("await flushEventsBeforeProfile()");
  const normal = source.indexOf("baseFlushAccountSync(options)");
  const lifecycle = source.indexOf('accountRequest("/api/account"');
  assert.ok(guard >= 0);
  assert.ok(normal > guard);
  assert.ok(lifecycle > guard);
  assert.match(source, /pending_events_before_profile/);
});

test("known signed-out account retains event ownership and guests do not accumulate server queue", async () => {
  const source = await read("js/mobile-consistency-hardening.js");
  assert.match(source, /const owner = String\(accountState\?\.userId \|\| ""\)/);
  assert.match(source, /if \(!owner\) queue\?\.ack\?\.\(\[queued\.event\.eventId\]\)/);
  assert.match(source, /else scheduleAccountSync\?\.\(100\)/);
});
