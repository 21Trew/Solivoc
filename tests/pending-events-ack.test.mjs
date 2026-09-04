import test from "node:test";
import assert from "node:assert/strict";
import { applyPendingEvents } from "../api/_pending-events-lib.mjs";

function event(sequenceNo, { streamId = "s_test", xpDelta = 10, level = sequenceNo, stars = 1 } = {}) {
  return {
    schemaVersion: 1,
    eventId: `${streamId}:${sequenceNo}`,
    streamId,
    sequenceNo,
    idempotencyKey: `${streamId}:${sequenceNo}`,
    eventType: "completion",
    owner: "u_player12345",
    occurredAt: 1000 + sequenceNo,
    source: "game",
    transactionId: `tx_${sequenceNo}`,
    payload: { version: 3, type: "completion", mode: "regular", campaign: true, level, stars, xpDelta, moves: 20, durationMs: 50000 },
  };
}

test("same event is ACKed repeatedly but applied once", () => {
  const first = applyPendingEvents({ xp: 0, starsByLevel: {}, stats: {} }, [event(1)], { userId: "u_player12345", now: 2000 });
  assert.equal(first.profile.xp, 10);
  assert.equal(first.profile.starsByLevel[1], 1);
  assert.deepEqual(first.ackedEventIds, ["s_test:1"]);
  assert.equal(first.profile.pendingEventAcks.s_test.sequenceNo, 1);

  const retry = applyPendingEvents(first.profile, [event(1)], { userId: "u_player12345", now: 3000 });
  assert.equal(retry.profile.xp, 10);
  assert.deepEqual(retry.ackedEventIds, ["s_test:1"]);
  assert.equal(retry.profile.pendingEventAcks.s_test.sequenceNo, 1);
});

test("100 offline events apply in sequence and collapse to one ACK cursor", () => {
  const events = Array.from({ length: 100 }, (_, index) => event(index + 1, { xpDelta: 3, level: index + 1, stars: (index % 3) + 1 }));
  const result = applyPendingEvents({ xp: 0, starsByLevel: {}, stats: {} }, events, { userId: "u_player12345", now: 5000 });
  assert.equal(result.ackedEventIds.length, 100);
  assert.equal(result.profile.xp, 300);
  assert.equal(result.profile.currentLevel, 101);
  assert.equal(result.profile.pendingEventAcks.s_test.sequenceNo, 100);
  assert.equal(Object.keys(result.profile.pendingEventAcks).length, 1);
  assert.equal(result.blocked.length, 0);
});

test("sequence gap is never silently ACKed", () => {
  const result = applyPendingEvents({ xp: 0, starsByLevel: {}, stats: {} }, [event(1), event(3)], { userId: "u_player12345" });
  assert.deepEqual(result.ackedEventIds, ["s_test:1"]);
  assert.equal(result.profile.xp, 10);
  assert.equal(result.profile.pendingEventAcks.s_test.sequenceNo, 1);
  assert.deepEqual(result.blocked, [{ streamId: "s_test", expectedSequenceNo: 2, receivedSequenceNo: 3 }]);
});

test("events for another account are ignored", () => {
  const foreign = { ...event(1), owner: "u_someone_else" };
  const result = applyPendingEvents({ xp: 7, starsByLevel: {}, stats: {} }, [foreign], { userId: "u_player12345" });
  assert.equal(result.profile.xp, 7);
  assert.deepEqual(result.ackedEventIds, []);
});

test("unowned events are never applied to an authenticated account", () => {
  const unowned = { ...event(1), owner: "" };
  const result = applyPendingEvents({ xp: 7, starsByLevel: {}, stats: {} }, [unowned], { userId: "u_player12345" });
  assert.equal(result.profile.xp, 7);
  assert.deepEqual(result.ackedEventIds, []);
});
