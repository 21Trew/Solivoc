import {
  cleanEmail, emailKey, profileKey, profileVersionKey, readJsonKey,
  sha256, userKey,
} from "./_auth-lib.mjs";
import { redis } from "./_push-lib.mjs";
import { purgeSemanticData } from "./_semantic-lib.mjs";

const BOARDS = Object.freeze(["stars","levels","daily","marathon","combo","duel","time","moves","onePass"]);

const playerKey = (id) => `worditaire:leaderboard:player:${id}`;
const boardKey = (id) => `worditaire:leaderboard:v1:${id}`;

function cleanUserId(value) {
  return String(value || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
}
function parse(value) {
  if (!value) return null;
  if (typeof value === "object") return value;
  try { return JSON.parse(value); } catch { return null; }
}
async function scanKeys(pattern, limit = 5000) {
  let cursor = "0", out = [];
  do {
    const result = await redis(["SCAN", cursor, "MATCH", pattern, "COUNT", 200]);
    cursor = String(result?.[0] ?? "0");
    const keys = Array.isArray(result?.[1]) ? result[1] : [];
    out.push(...keys);
    if (out.length >= limit) break;
  } while (cursor !== "0");
  return out.slice(0, limit);
}
async function getMany(keys, batch = 80) {
  const out = [];
  for (let i = 0; i < keys.length; i += batch) {
    const part = keys.slice(i, i + batch);
    const values = part.length ? await redis(["MGET", ...part]) : [];
    for (let j = 0; j < part.length; j++) out.push({ key: part[j], raw: values?.[j] || null });
  }
  return out;
}
async function deleteKeys(keys) {
  const unique = [...new Set((keys || []).filter(Boolean))];
  for (let i = 0; i < unique.length; i += 80) {
    const part = unique.slice(i, i + 80);
    if (part.length) await redis(["DEL", ...part]);
  }
  return unique.length;
}
async function deleteUserSessions(userId) {
  const keys = await scanKeys("worditaire:auth:session:*", 5000);
  const rows = await getMany(keys);
  return deleteKeys(rows.filter(({ raw }) => String(parse(raw)?.userId || "") === userId).map(({ key }) => key));
}
function challengeContainsUser(record, userId) {
  if (!record) return false;
  return [
    record.creatorPlayerId,
    record.creatorResult?.playerId,
    record.guestResult?.playerId,
  ].some((value) => String(value || "") === userId);
}
async function deleteUserChallenges(userId) {
  const [activeKeys, resultKeys] = await Promise.all([
    scanKeys("worditaire:challenge:active:*", 5000),
    scanKeys("worditaire:challenge:result:*", 5000),
  ]);
  const rows = await getMany([...activeKeys, ...resultKeys]);
  return deleteKeys(rows.filter(({ raw }) => challengeContainsUser(parse(raw), userId)).map(({ key }) => key));
}
async function deleteEmailScopedAuthData(email) {
  const clean = cleanEmail(email);
  if (!clean) return 0;
  const hash = sha256(clean);
  return deleteKeys([
    `worditaire:auth:verify:${hash}`,
    `worditaire:auth:verify-attempts:${hash}`,
    `worditaire:auth:verify-cooldown:${hash}`,
    `worditaire:auth:recover:${hash}`,
    `worditaire:auth:recover-attempts:${hash}`,
    `worditaire:auth:recover-cooldown:${hash}`,
    `worditaire:auth:verify-email-rate:${hash}`,
    `worditaire:auth:recover-email-rate:${hash}`,
    `worditaire:auth:login-email-rate:${hash}`,
  ]);
}

/**
 * Permanently removes server-side account data.
 * Completed/pending server duels involving the deleted account are removed too,
 * so the deleted player's name/avatar/playerId is not retained for the duel TTL.
 */
export async function deleteAccountData(userIdValue, emailHint = "") {
  const userId = cleanUserId(userIdValue);
  if (!userId) {
    const error = new Error("invalid_user_id");
    error.code = "invalid_user_id";
    throw error;
  }

  const user = await readJsonKey(userKey(userId));
  if (!user && !emailHint) {
    return { deleted: false, userId, email: "", sessionsDeleted: 0, challengesDeleted: 0, authKeysDeleted: 0, narrativeKeysDeleted: 0 };
  }

  const email = cleanEmail(user?.email || emailHint);
  const mappedId = email ? String(await redis(["GET", emailKey(email)]) || "") : "";

  // Remove game-facing and semantic account data first.
  await redis(["DEL", playerKey(userId)]);
  await Promise.all(BOARDS.map((board) => redis(["ZREM", boardKey(board), userId])));

  const [sessionsDeleted, challengesDeleted, narrativeKeysDeleted] = await Promise.all([
    deleteUserSessions(userId),
    deleteUserChallenges(userId),
    purgeSemanticData(userId),
  ]);

  await redis(["DEL", profileKey(userId), profileVersionKey(userId), userKey(userId)]);
  if (email && mappedId === userId) await redis(["DEL", emailKey(email)]);
  const authKeysDeleted = await deleteEmailScopedAuthData(email);

  return {
    deleted: true,
    userId,
    email,
    sessionsDeleted,
    challengesDeleted,
    authKeysDeleted,
    narrativeKeysDeleted,
  };
}
