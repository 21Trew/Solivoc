import { randomBytes } from "node:crypto";
import {
  cloudProfileVersion,
  mergeProfiles,
  profileKey,
  profileVersionKey,
  readCloudProfile,
  sanitizeProfile,
} from "./_auth-lib.mjs";
import { redis } from "./_push-lib.mjs";

const PROFILE_LOCK_TTL_MS = 8000;
const PROFILE_LOCK_ATTEMPTS = 18;

function lockKey(userId) {
  return `worditaire:auth:profile-lock:${String(userId || "").slice(0, 64)}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function acquireProfileLock(userId) {
  const key = lockKey(userId);
  const token = randomBytes(18).toString("hex");
  for (let attempt = 0; attempt < PROFILE_LOCK_ATTEMPTS; attempt++) {
    const acquired = await redis(["SET", key, token, "NX", "PX", PROFILE_LOCK_TTL_MS]);
    if (acquired === "OK") return { key, token };
    await sleep(Math.min(180, 24 + attempt * 9 + Math.floor(Math.random() * 20)));
  }
  const error = new Error("profile_busy");
  error.code = "profile_busy";
  throw error;
}

async function releaseProfileLock(lock) {
  if (!lock?.key || !lock?.token) return;
  const script = "if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) else return 0 end";
  await redis(["EVAL", script, "1", lock.key, lock.token]).catch(() => {});
}

async function persistProfileAndVersion(userId, profile) {
  const payload = JSON.stringify(profile);
  const script = "redis.call('SET', KEYS[1], ARGV[1]); return redis.call('INCR', KEYS[2])";
  const version = Number(await redis([
    "EVAL",
    script,
    "2",
    profileKey(userId),
    profileVersionKey(userId),
    payload,
  ])) || 1;
  return version;
}

export async function mergeCloudProfileAtomic(
  userId,
  incoming,
  {
    clientVersion = null,
    finalize = null,
  } = {},
) {
  const lock = await acquireProfileLock(userId);
  try {
    const [current, currentVersion] = await Promise.all([
      readCloudProfile(userId),
      cloudProfileVersion(userId),
    ]);
    const numericClientVersion = clientVersion == null ? null : Math.max(0, Number(clientVersion) || 0);
    const preferIncomingPreferences = numericClientVersion == null || numericClientVersion >= currentVersion;
    let merged = mergeProfiles(current, incoming, userId, { preferIncomingPreferences });

    if (typeof finalize === "function") {
      const finalized = await finalize({
        current,
        incoming,
        merged,
        currentVersion,
        clientVersion: numericClientVersion,
      });
      if (finalized && typeof finalized === "object") merged = finalized;
    }

    merged = sanitizeProfile(merged, userId);
    const version = await persistProfileAndVersion(userId, merged);
    return {
      profile: merged,
      version,
      previousVersion: currentVersion,
      staleClient: numericClientVersion != null && numericClientVersion < currentVersion,
    };
  } finally {
    await releaseProfileLock(lock);
  }
}
