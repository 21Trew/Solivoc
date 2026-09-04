/* Canonical progress sync: one server source of truth + exact offline star history. */
(() => {
  "use strict";

  const cleanStars = (input) => {
    const out = {};
    for (const [rawLevel, rawStars] of Object.entries(input && typeof input === "object" ? input : {})) {
      const level = Math.trunc(Number(rawLevel));
      const stars = Math.trunc(Number(rawStars));
      if (!Number.isFinite(level) || level < 1 || level > 10000 || stars < 1) continue;
      out[level] = Math.max(1, Math.min(3, stars));
    }
    return out;
  };

  const highestRecordLevel = (p) => Math.max(0, ...Object.entries(p?.levelRecords || {})
    .filter(([key, record]) => Number(key) >= 1 && (Number(record?.stars) > 0 || Number(record?.moves) > 0 || Number(record?.timeMs) > 0))
    .map(([key]) => Number(key))
    .filter(Number.isFinite));

  const highestTransactionLevel = (p) => Math.max(0, ...Object.values(p?.completionTransactions || {})
    .filter((tx) => tx && typeof tx === "object" && tx.campaign && tx.type === "completion")
    .map((tx) => Number(tx.level) || 0));

  function exactCampaignReconcile(p = profile) {
    if (!p || typeof p !== "object") return 0;
    const previousTotal = Math.max(0, Math.trunc(Number(p.totalStars) || 0));
    const stars = cleanStars(p.starsByLevel);
    const transactions = p.completionTransactions && typeof p.completionTransactions === "object" ? p.completionTransactions : {};
    for (const tx of Object.values(transactions)) {
      if (!tx || typeof tx !== "object" || !tx.campaign || tx.type !== "completion") continue;
      const level = Math.trunc(Number(tx.level) || 0);
      const earned = Math.max(0, Math.min(3, Math.trunc(Number(tx.stars) || 0)));
      if (level >= 1 && level <= 10000 && earned >= 1) stars[level] = Math.max(Number(stars[level]) || 0, earned);
    }
    const highestStar = Math.max(0, ...Object.keys(stars).map(Number).filter(Number.isFinite));
    const completed = Math.max(
      0,
      Math.trunc(Number(p.stats?.levelsCompleted) || 0),
      Math.trunc(Number(p.currentLevel) || 1) - 1,
      Math.trunc(Number(p.campaignProgressFloor) || 0),
      highestStar,
      highestRecordLevel(p),
      highestTransactionLevel(p),
    );
    const exactTotal = Object.values(stars).reduce((sum, value) => sum + Math.max(1, Math.min(3, Number(value) || 1)), 0);
    p.starsByLevel = stars;
    p.stats ||= {};
    p.stats.levelsCompleted = completed;
    p.stats.chapterFinalsCompleted = Math.max(Number(p.stats.chapterFinalsCompleted) || 0, Math.floor(completed / 10));
    p.stats.tripleStarWins = Object.values(stars).filter((value) => Number(value) === 3).length;
    p.currentLevel = completed + 1;
    p.campaignProgressFloor = completed;
    if (Number(p.canonicalProgressVersion) >= 1 || Number(p.campaignProgressVersion) >= 3) {
      p.totalStars = exactTotal;
      p.campaignProgressVersion = Math.max(3, Number(p.campaignProgressVersion) || 0);
      p.canonicalProgressVersion = 1;
    } else {
      // Transitional legacy clients keep their historical displayed total until
      // the server returns a canonical profile, but no missing star rows are created.
      p.totalStars = Math.max(previousTotal, exactTotal);
    }
    return completed;
  }

  if (typeof reconcileCampaignProgress === "function" && !window.__solivocCanonicalCampaignReconcile) {
    window.__solivocCanonicalCampaignReconcile = true;
    reconcileCampaignProgress = exactCampaignReconcile;
  }

  if (typeof saveProfile === "function" && !window.__solivocCanonicalSaveProfile) {
    window.__solivocCanonicalSaveProfile = true;
    const baseSaveProfile = saveProfile;
    saveProfile = function canonicalSaveProfile(options = {}) {
      exactCampaignReconcile(profile);
      return baseSaveProfile(options);
    };
  }

  if (typeof syncLeaderboardNonBlocking === "function" && !window.__solivocCanonicalLeaderboardProjection) {
    window.__solivocCanonicalLeaderboardProjection = true;
    let lastProjectionAt = 0;
    syncLeaderboardNonBlocking = async function canonicalLeaderboardProjection(force = false) {
      if (!/^https?:$/.test(location.protocol) || navigator.onLine === false || !profile?.playerId || !(typeof accountSignedIn === "function" && accountSignedIn())) return false;
      if (!force && Date.now() - lastProjectionAt < 30000) return false;
      lastProjectionAt = Date.now();
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 2200);
        const response = await apiFetch("/api/leaderboard", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projection: true }),
          signal: controller.signal,
          cache: "no-store",
        });
        clearTimeout(timer);
        return response.ok;
      } catch { return false; }
    };
  }

  if (typeof profile !== "undefined") exactCampaignReconcile(profile);
})();
