/* Cross-platform mobile consistency: canonical game day + atomic completion commit. */
(() => {
  const CLOCK_KEY = "solivoc-server-clock-v1";
  const MAX_CLOCK_AGE = 1000 * 60 * 60 * 24 * 7;
  let completionDepth = 0;

  const readJson = (key) => {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "null");
      return value && typeof value === "object" ? value : null;
    } catch { return null; }
  };
  const writeJson = (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  };
  const clone = (value) => {
    try { return JSON.parse(JSON.stringify(value)); } catch { return null; }
  };

  function rememberServerClock(data) {
    const serverNow = Number(data?.serverNow) || 0;
    const gameDayId = /^\d{4}-\d{2}-\d{2}$/.test(String(data?.gameDayId || "")) ? String(data.gameDayId) : "";
    if (!serverNow || !gameDayId) return;
    writeJson(CLOCK_KEY, { serverNow, clientNow: Date.now(), gameDayId, savedAt: Date.now() });
  }

  function warsawDay(nowMs) {
    try {
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Europe/Warsaw",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).formatToParts(new Date(nowMs));
      const get = (type) => parts.find((part) => part.type === type)?.value || "";
      const y = get("year"), m = get("month"), d = get("day");
      if (y && m && d) return `${y}-${m}-${d}`;
    } catch {}
    return new Date(nowMs).toISOString().slice(0, 10);
  }

  function canonicalGameDay() {
    const clock = readJson(CLOCK_KEY);
    if (clock?.serverNow && clock?.clientNow && Date.now() - Number(clock.savedAt || 0) <= MAX_CLOCK_AGE) {
      const offset = Number(clock.serverNow) - Number(clock.clientNow);
      return warsawDay(Date.now() + offset);
    }
    return warsawDay(Date.now());
  }

  if (typeof accountRequest === "function" && !window.__solivocCanonicalGameDayRequest) {
    window.__solivocCanonicalGameDayRequest = true;
    const baseAccountRequest = accountRequest;
    accountRequest = async function canonicalDayAccountRequest(...args) {
      const data = await baseAccountRequest(...args);
      rememberServerClock(data);
      return data;
    };
  }

  if (typeof todayKey === "function" && !window.__solivocCanonicalGameDay) {
    window.__solivocCanonicalGameDay = true;
    todayKey = canonicalGameDay;
  }

  if (typeof currentDailyWeek === "function" && !window.__solivocCanonicalDailyWeek) {
    window.__solivocCanonicalDailyWeek = true;
    currentDailyWeek = function canonicalDailyWeek() {
      const today = canonicalGameDay();
      const [year, month, day] = today.split("-").map(Number);
      const date = new Date(Date.UTC(year, month - 1, day));
      const weekday = (date.getUTCDay() + 6) % 7;
      date.setUTCDate(date.getUTCDate() - weekday);
      const days = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(date);
        d.setUTCDate(date.getUTCDate() + i);
        days.push(d.toISOString().slice(0, 10));
      }
      const completed = new Set(profile.daily?.completedDates || []);
      return { days, count: days.filter((key) => completed.has(key)).length, key: weekKey(today) };
    };
  }

  function transactionId(s = state) {
    const raw = [
      s?.mode || "unknown",
      s?.seed || "",
      s?.level || 0,
      s?.tutorialStep || 0,
      s?.challengeCode || "",
      s?.marathonId || "",
      s?.run?.startedAt || s?.createdAt || 0,
    ].join("|");
    let hash = 2166136261;
    for (let i = 0; i < raw.length; i++) {
      hash ^= raw.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return `c_${(hash >>> 0).toString(36)}_${String(s?.run?.startedAt || 0).slice(-8)}`;
  }

  if (typeof saveProfile === "function" && !window.__solivocCompletionSaveBarrier) {
    window.__solivocCompletionSaveBarrier = true;
    const baseSaveProfile = saveProfile;
    saveProfile = function completionAwareSaveProfile(options = {}) {
      if (completionDepth > 0) return true;
      return baseSaveProfile(options);
    };
  }

  if (typeof finishLevel === "function" && !window.__solivocCompletionTransaction) {
    window.__solivocCompletionTransaction = true;
    const baseFinishLevel = finishLevel;
    finishLevel = function transactionalFinishLevel(...args) {
      if (!state) return false;
      const txId = transactionId(state);
      profile.completionTransactions ||= {};
      if (Object.prototype.hasOwnProperty.call(profile.completionTransactions, txId)) {
        state.rewarded = true;
        save?.({ immediate: true });
        return true;
      }

      const profileBefore = clone(profile);
      const rewardedBefore = !!state.rewarded;
      const failedBefore = !!state.failed;
      const lastStarsBefore = state.lastStars;
      const xpBefore = Math.max(0, Number(profile.xp) || 0);
      if (profile.completionLedgerBase == null) profile.completionLedgerBase = xpBefore;

      completionDepth++;
      try {
        const result = baseFinishLevel(...args);
        const completed = !!state.rewarded && !state.failed;
        if (!completed) return result;
        const xpAfter = Math.max(0, Number(profile.xp) || 0);
        profile.completionTransactions[txId] = Math.max(0, xpAfter - xpBefore);
        completionDepth--;
        completionDepth = Math.max(0, completionDepth);
        saveProfile({ skipCloud: false });
        save?.({ immediate: true });
        scheduleAccountSync?.(100);
        recordStabilityEvent?.("completion_committed", { mode: state.mode, level: Number(state.level) || 0 });
        return result ?? true;
      } catch (error) {
        if (profileBefore) profile = profileBefore;
        state.rewarded = rewardedBefore;
        state.failed = failedBefore;
        state.lastStars = lastStarsBefore;
        recordStabilityEvent?.("completion_rolled_back", { mode: state?.mode || "unknown", level: Number(state?.level) || 0 });
        throw error;
      } finally {
        if (completionDepth > 0) completionDepth--;
      }
    };
  }
})();
