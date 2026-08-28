const SINGLE_KEY_COMMANDS = new Set([
  "GET", "SET", "SETNX", "GETSET", "GETDEL", "INCR", "INCRBY", "DECR", "DECRBY",
  "EXPIRE", "PEXPIRE", "TTL", "PTTL", "PERSIST", "TYPE", "DUMP", "RESTORE",
  "SADD", "SREM", "SMEMBERS", "SCARD", "SISMEMBER",
  "HSET", "HGET", "HGETALL", "HDEL", "HEXISTS", "HINCRBY",
  "LPUSH", "RPUSH", "LPOP", "RPOP", "LRANGE", "LLEN", "LREM", "LTRIM",
  "ZADD", "ZREM", "ZRANGE", "ZREVRANGE", "ZCARD", "ZSCORE", "ZINCRBY", "ZRANK", "ZREVRANK",
  "XADD", "XRANGE", "XREVRANGE", "XLEN",
]);
const MULTI_KEY_COMMANDS = new Set(["DEL", "UNLINK", "EXISTS", "MGET"]);

function namespacePrefix() {
  const raw = String(process.env.REDIS_KEY_PREFIX || "").trim();
  if (!raw) return "";
  if (!/^[a-zA-Z0-9:_-]{1,48}$/.test(raw)) throw new Error("REDIS_KEY_PREFIX_INVALID");
  return raw.endsWith(":") ? raw : `${raw}:`;
}

export function redisKey(value) {
  const key = String(value ?? "");
  const prefix = namespacePrefix();
  if (!prefix || key.startsWith(prefix)) return key;
  return `${prefix}${key}`;
}

function namespacePattern(value) {
  const pattern = String(value ?? "*");
  const prefix = namespacePrefix();
  if (!prefix || pattern.startsWith(prefix)) return pattern;
  return `${prefix}${pattern}`;
}

function namespaceEval(out) {
  const keyCount = Math.max(0, Math.trunc(Number(out[2]) || 0));
  for (let index = 0; index < keyCount; index++) out[3 + index] = redisKey(out[3 + index]);
  return out;
}

function namespaceScan(out) {
  const matchIndex = out.findIndex((value, index) => index >= 2 && String(value).toUpperCase() === "MATCH");
  if (matchIndex >= 0) out[matchIndex + 1] = namespacePattern(out[matchIndex + 1]);
  else out.push("MATCH", namespacePattern("*"));
  return out;
}

export function namespaceRedisCommand(command) {
  if (!Array.isArray(command) || !command.length) throw new Error("REDIS_COMMAND_INVALID");
  const prefix = namespacePrefix();
  const out = [...command];
  if (!prefix) return out;
  const name = String(out[0] || "").toUpperCase();

  if (SINGLE_KEY_COMMANDS.has(name)) {
    out[1] = redisKey(out[1]);
    return out;
  }
  if (MULTI_KEY_COMMANDS.has(name)) {
    for (let index = 1; index < out.length; index++) out[index] = redisKey(out[index]);
    return out;
  }
  if (name === "MSET") {
    for (let index = 1; index < out.length; index += 2) out[index] = redisKey(out[index]);
    return out;
  }
  if (name === "RENAME" || name === "RENAMENX" || name === "COPY") {
    out[1] = redisKey(out[1]);
    out[2] = redisKey(out[2]);
    return out;
  }
  if (name === "EVAL" || name === "EVALSHA") return namespaceEval(out);
  if (name === "SCAN") return namespaceScan(out);
  if (name === "KEYS") {
    out[1] = namespacePattern(out[1]);
    return out;
  }
  if (name === "PING" || name === "TIME") return out;

  throw new Error(`REDIS_NAMESPACE_UNSUPPORTED_COMMAND:${name || "UNKNOWN"}`);
}
