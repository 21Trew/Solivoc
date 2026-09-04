import { createHash } from "node:crypto";
import { redis, redisPipeline } from "./_push-lib.mjs";

export const LEADERBOARD_BOARDS = Object.freeze([
  "stars", "levels", "daily", "marathon", "zen", "combo", "duel", "pictures",
  "time", "moves", "noMistakes", "onePass", "hardcore",
]);

const LEADERBOARD_MAX_MEMBERS = 2000;
const LEADERBOARD_TTL = 180 * 24 * 60 * 60;
const PLAYER_TTL = 90 * 24 * 60 * 60;
const num = (value, max = 1e12) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.min(max, n)) : 0;
};
const int = (value, max = 1e12) => Math.floor(num(value, max));
const object = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {};
const playerKey = (id) => `worditaire:leaderboard:player:${String(id || "").slice(0, 64)}`;
const boardKey = (id) => `worditaire:leaderboard:v1:${id}`;

function scoreFor(board, value) {
  if (board === "time") return value > 0 ? 1_000_000_000 - value : 0;
  if (board === "moves") return value > 0 ? 1_000_000 - value : 0;
  return value;
}

function bestModeCombo(modeStats = {}) {
  return Math.max(0, ...Object.values(object(modeStats)).map((row) => Number(row?.bestCombo) || 0));
}

export function leaderboardValuesFromProfile(profile = {}) {
  const stats = object(profile.stats);
  const modes = object(profile.modeStats);
  return {
    stars: int(profile.totalStars, 10_000_000),
    levels: int(stats.levelsCompleted, 10_000_000),
    daily: int(stats.dailyCompleted, 10_000_000),
    marathon: int(stats.bestMarathon, 10_000_000),
    zen: int(modes.zen?.completed ?? stats.zenCompleted, 10_000_000),
    combo: int(Math.max(Number(stats.maxCombo) || 0, Number(stats.maxDragCombo) || 0, bestModeCombo(modes)), 10_000_000),
    duel: int(stats.duelRating, 10_000_000),
    pictures: int(modes.pictures?.completed ?? stats.picturesCompleted ?? stats.pictureModeCompleted, 10_000_000),
    time: int(modes.time?.bestTimeMs, 86_400_000),
    moves: int(modes.moves?.bestMoves, 100_000),
    noMistakes: int(modes.noMistakes?.completed, 10_000_000),
    onePass: int(modes.onePass?.completed, 10_000_000),
    hardcore: int(Math.max(Number(stats.bestHardcore) || 0, Number(modes.hardcore?.best) || 0), 10_000_000),
  };
}

export function duelStatsFromProfile(profile = {}) {
  const stats = object(profile.stats);
  return {
    matches: int(stats.duelMatches, 10_000_000),
    wins: int(stats.duelWins, 10_000_000),
    losses: int(stats.duelLosses, 10_000_000),
    draws: int(stats.duelDraws, 10_000_000),
    gold: int(stats.duelGold, 10_000_000),
    silver: int(stats.duelSilver, 10_000_000),
    bronze: int(stats.duelBronze, 10_000_000),
    xp: int(stats.duelXp, 100_000_000),
    rating: int(stats.duelRating, 100_000_000),
  };
}

function accountKey(email) {
  const normalized = String(email || "").trim().toLowerCase();
  return normalized ? createHash("sha256").update(`solivoc-leaderboard:${normalized}`).digest("hex").slice(0, 32) : "";
}

export function leaderboardRecordFromProfile(userId, profile = {}, user = {}, previous = {}) {
  return {
    ...previous,
    playerId: String(userId || "").slice(0, 64),
    name: String(profile.playerName || previous.name || "Игрок").trim().slice(0, 20) || "Игрок",
    avatar: String(profile.avatarEmoji || previous.avatar || "🙂").slice(0, 8) || "🙂",
    values: leaderboardValuesFromProfile(profile),
    duelStats: duelStatsFromProfile(profile),
    account: true,
    accountKey: accountKey(user?.email || previous.accountKeySource || ""),
    projectionVersion: 2,
    updatedAt: Date.now(),
  };
}

export async function syncLeaderboardProjection(userId, profile, user = {}, previous = null) {
  const id = String(userId || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
  if (!/^u_[a-zA-Z0-9_-]{8,62}$/.test(id) || !profile || typeof profile !== "object") return null;
  let prior = previous;
  if (!prior) {
    try {
      const raw = await redis(["GET", playerKey(id)]);
      prior = raw ? JSON.parse(raw) : {};
    } catch { prior = {}; }
  }
  const record = leaderboardRecordFromProfile(id, profile, user, prior || {});
  const commands = [["SET", playerKey(id), JSON.stringify(record), "EX", PLAYER_TTL]];
  for (const board of LEADERBOARD_BOARDS) {
    const value = Number(record.values?.[board]) || 0;
    const key = boardKey(board);
    if (value > 0) {
      commands.push(
        ["ZADD", key, scoreFor(board, value), id],
        ["ZREMRANGEBYRANK", key, 0, -(LEADERBOARD_MAX_MEMBERS + 1)],
        ["EXPIRE", key, LEADERBOARD_TTL],
      );
    } else {
      commands.push(["ZREM", key, id]);
    }
  }
  await redisPipeline(commands);
  return record;
}
