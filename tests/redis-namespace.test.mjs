import test from "node:test";
import assert from "node:assert/strict";
import { namespaceRedisCommand, redisKey } from "../api/_redis-namespace.mjs";
import fs from "node:fs";

function withPrefix(prefix, fn) {
  const previous = process.env.REDIS_KEY_PREFIX;
  if (prefix == null) delete process.env.REDIS_KEY_PREFIX;
  else process.env.REDIS_KEY_PREFIX = prefix;
  try { return fn(); }
  finally {
    if (previous == null) delete process.env.REDIS_KEY_PREFIX;
    else process.env.REDIS_KEY_PREFIX = previous;
  }
}

test("production Redis commands remain unchanged without a namespace", () => {
  withPrefix(null, () => {
    assert.deepEqual(namespaceRedisCommand(["GET", "worditaire:auth:user:u1"]), ["GET", "worditaire:auth:user:u1"]);
    assert.equal(redisKey("worditaire:narrative:v1:seq:u1"), "worditaire:narrative:v1:seq:u1");
  });
});

test("beta prefixes ordinary, multi-key and SCAN commands", () => {
  withPrefix("beta", () => {
    assert.deepEqual(namespaceRedisCommand(["GET", "worditaire:auth:user:u1"]), ["GET", "beta:worditaire:auth:user:u1"]);
    assert.deepEqual(namespaceRedisCommand(["DEL", "worditaire:a", "worditaire:b"]), ["DEL", "beta:worditaire:a", "beta:worditaire:b"]);
    assert.deepEqual(namespaceRedisCommand(["MGET", "worditaire:a", "worditaire:b"]), ["MGET", "beta:worditaire:a", "beta:worditaire:b"]);
    assert.deepEqual(namespaceRedisCommand(["SCAN", "0", "MATCH", "worditaire:leaderboard:*", "COUNT", 200]), ["SCAN", "0", "MATCH", "beta:worditaire:leaderboard:*", "COUNT", 200]);
  });
});

test("beta prefixes all EVAL KEYS and refuses unknown commands", () => {
  withPrefix("beta", () => {
    assert.deepEqual(
      namespaceRedisCommand(["EVAL", "return 1", "3", "worditaire:a", "worditaire:b", "worditaire:c", "arg"]),
      ["EVAL", "return 1", "3", "beta:worditaire:a", "beta:worditaire:b", "beta:worditaire:c", "arg"],
    );
    assert.throws(() => namespaceRedisCommand(["MYSTERY", "worditaire:a"]), /REDIS_NAMESPACE_UNSUPPORTED_COMMAND:MYSTERY/);
  });
});

test("Story Lua receives a fully namespaced dynamic guard prefix", () => {
  const source = fs.readFileSync(new URL("../api/_semantic-lib.mjs", import.meta.url), "utf8");
  assert.match(source, /import \{ redis, redisKey \} from "\.\/_push-lib\.mjs"/);
  assert.match(source, /recordedAt, redisKey\(keys\.eventGuardPrefix\)/);
});
