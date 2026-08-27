/* Deployment-specific runtime values, campaign guards and PWA update handoff. */
(() => {
  const existing = String(window.SOLIVOC_API_BASE || "").trim().replace(/\/+$/, "");
  if (existing) {
    window.SOLIVOC_API_BASE = existing;
  } else {
    const protocol = String(window.location.protocol || "");
    const host = String(window.location.hostname || "").toLowerCase();
    const local =
      protocol === "file:" ||
      host === "localhost" ||
      host === "127.0.0.1";

    window.SOLIVOC_API_BASE =
      !local && /^https?:$/.test(protocol)
        ? "https://api.solivoc.ru"
        : "";
  }
})();

/* Campaign progress is append-only for modern profiles. A historical v6 repair
   used chapterFinalsCompleted as an authority and could mistake a long real
   one-star run for synthetic migration data. Harden local evidence before
   profile.js loads, then replace the recurring reconciler with a monotonic one. */
(() => {
  const PROFILE_KEYS = [
    "worditaire-profile-v7",
    "worditaire-profile-v6",
    "worditaire-profile-v5",
    "worditaire-profile-v4",
    "worditaire-profile-v3",
    "worditaire-profile-v2",
  ];
  const ANALYTICS_KEY = "worditaire-analytics-v1";
  const SAVE_KEYS = ["worditaire-state-v10", "worditaire-state-v10-backup", "assoc-klondike-v7", "assoc-klondike-v6", "assoc-klondike-v5", "assoc-klondike-v4"];

  const objectValue = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const nonNegativeInt = (value, max = 10000) => Math.max(0, Math.min(max, Math.trunc(Number(value) || 0)));
  const parseStored = (key) => {
    try { return JSON.parse(localStorage.getItem(key) || "null"); }
    catch { return null; }
  };

  function analyticsLevelStars() {
    const out = {};
    const analytics = objectValue(parseStored(ANALYTICS_KEY));
    for (const event of Array.isArray(analytics.events) ? analytics.events : []) {
      if (event?.name !== "level_completed") continue;
      const level = nonNegativeInt(event.level);
      if (!level) continue;
      const stars = Math.max(1, Math.min(3, nonNegativeInt(event.stars, 3) || 1));
      out[level] = Math.max(out[level] || 0, stars);
    }
    return out;
  }

  function savedRoundEvidence() {
    let completed = 0;
    for (const key of SAVE_KEYS) {
      const state = objectValue(parseStored(key));
      if (!state.level || (state.mode && state.mode !== "regular")) continue;
      const level = nonNegativeInt(state.level);
      if (!level) continue;
      completed = Math.max(completed, level - (state.rewarded ? 0 : 1));
    }
    return completed;
  }

  function profileEvidence(value, extraFloor = 0) {
    const p = objectValue(value), stars = objectValue(p.starsByLevel), records = objectValue(p.levelRecords);
    const highestStar = Math.max(0, ...Object.keys(stars).map(Number).filter(Number.isFinite));
    const highestRecord = Math.max(0, ...Object.entries(records)
      .filter(([key, record]) => Number(key) >= 1 && (Number(record?.stars) > 0 || Number(record?.moves) > 0))
      .map(([key]) => Number(key)).filter(Number.isFinite));
    return Math.min(10000, Math.max(
      nonNegativeInt(p.currentLevel) - 1,
      nonNegativeInt(p.stats?.levelsCompleted),
      nonNegativeInt(p.campaignProgressFloor),
      highestStar,
      highestRecord,
      nonNegativeInt(extraFloor),
    ));
  }

  const localStars = analyticsLevelStars();
  const localFloor = Math.max(savedRoundEvidence(), ...Object.keys(localStars).map(Number).filter(Number.isFinite), 0);

  // Run before profile.js reads storage. Only v2+ profiles are hardened here;
  // truly legacy profiles still get their one-time migration path.
  for (const key of PROFILE_KEYS) {
    const stored = parseStored(key);
    if (!stored || typeof stored !== "object" || Array.isArray(stored)) continue;
    if (Number(stored.campaignProgressVersion || 0) < 2) continue;
    const evidence = profileEvidence(stored, localFloor);
    if (!evidence) continue;
    stored.starsByLevel = objectValue(stored.starsByLevel);
    for (const [level, stars] of Object.entries(localStars)) {
      if (Number(level) <= evidence) stored.starsByLevel[level] = Math.max(Number(stored.starsByLevel[level]) || 0, Number(stars) || 1);
    }
    stored.campaignProgressFloor = Math.max(nonNegativeInt(stored.campaignProgressFloor), evidence);
    stored.currentLevel = Math.max(1, nonNegativeInt(stored.currentLevel), evidence + 1);
    stored.stats = { ...objectValue(stored.stats) };
    stored.stats.levelsCompleted = Math.max(nonNegativeInt(stored.stats.levelsCompleted), evidence);
    stored.stats.chapterFinalsCompleted = Math.max(nonNegativeInt(stored.stats.chapterFinalsCompleted), Math.floor(evidence / 10));
    // Modern progress must never be treated as the old synthetic migration,
    // including the historical XP subtraction coupled to that repair.
    stored.campaignRepairXpAdjusted = true;
    try { localStorage.setItem(key, JSON.stringify(stored)); } catch {}
  }

  setTimeout(() => {
    if (typeof reconcileCampaignProgress !== "function") return;

    const safeReconcileCampaignProgress = (p = profile) => {
      p.starsByLevel = objectValue(p.starsByLevel);
      const cleanStars = {};
      for (const [rawLevel, rawStars] of Object.entries(p.starsByLevel)) {
        const level = nonNegativeInt(rawLevel), stars = nonNegativeInt(rawStars, 3);
        if (!level || !stars) continue;
        cleanStars[level] = Math.max(1, Math.min(3, stars));
      }

      const isLiveProfile = typeof profile !== "undefined" && p === profile;
      if (isLiveProfile) {
        for (const [level, stars] of Object.entries(analyticsLevelStars())) {
          const numericLevel = nonNegativeInt(level);
          if (numericLevel) cleanStars[numericLevel] = Math.max(cleanStars[numericLevel] || 0, Number(stars) || 1);
        }
      }

      const rawCurrent = Math.max(1, nonNegativeInt(p.currentLevel));
      const storedCompleted = nonNegativeInt(p.stats?.levelsCompleted);
      const previousTotalStars = Math.max(0, Math.trunc(Number(p.totalStars) || 0));
      const recordedLevels = new Set(Object.entries(objectValue(p.levelRecords))
        .filter(([key, record]) => Number(key) >= 1 && (Number(record?.stars) > 0 || Number(record?.moves) > 0))
        .map(([key]) => nonNegativeInt(key)).filter(Boolean));

      let completedThrough = 0;
      while (Number(cleanStars[completedThrough + 1]) > 0) completedThrough++;
      const highestStarLevel = Math.max(0, ...Object.keys(cleanStars).map(Number).filter(Number.isFinite));
      const highestRecordLevel = Math.max(0, ...recordedLevels);
      const progressFloor = nonNegativeInt(p.campaignProgressFloor);
      const versionedFloor = Number(p.campaignProgressVersion || 0) >= 2 ? Math.max(storedCompleted, rawCurrent - 1) : 0;
      const deviceFloor = isLiveProfile ? Math.max(savedRoundEvidence(), ...Object.keys(analyticsLevelStars()).map(Number).filter(Number.isFinite), 0) : 0;
      const evidenceThrough = Math.min(10000, Math.max(completedThrough, highestStarLevel, highestRecordLevel, progressFloor, versionedFloor, deviceFloor));
      const hadMissingStarHistory = evidenceThrough > Object.keys(cleanStars).length;

      if (evidenceThrough > completedThrough) {
        for (let level = 1; level <= evidenceThrough; level++) if (!cleanStars[level]) cleanStars[level] = 1;
        completedThrough = evidenceThrough;
      }
      if (hadMissingStarHistory && completedThrough > 0) {
        let runningTotal = Object.values(cleanStars).reduce((sum, value) => sum + Math.max(1, Math.min(3, Number(value) || 1)), 0);
        const target = Math.min(completedThrough * 3, Math.max(runningTotal, previousTotalStars));
        for (let level = 1; level <= completedThrough && runningTotal < target; level++) {
          const room = 3 - (Number(cleanStars[level]) || 1);
          if (room <= 0) continue;
          const add = Math.min(room, target - runningTotal);
          cleanStars[level] += add;
          runningTotal += add;
        }
      }

      p.starsByLevel = cleanStars;
      p.currentLevel = completedThrough + 1;
      p.stats = { ...objectValue(p.stats) };
      p.stats.levelsCompleted = completedThrough;
      p.stats.chapterFinalsCompleted = Math.floor(completedThrough / 10);
      p.stats.tripleStarWins = Object.values(cleanStars).filter((stars) => Number(stars) === 3).length;
      p.campaignProgressVersion = Math.max(2, Number(p.campaignProgressVersion) || 0);
      p.campaignProgressFloor = Math.max(progressFloor, completedThrough);
      return completedThrough;
    };

    reconcileCampaignProgress = safeReconcileCampaignProgress;
    if (typeof profile !== "undefined") {
      safeReconcileCampaignProgress(profile);
      try { if (typeof saveProfile === "function") saveProfile({ skipCloud: true }); } catch {}
    }
  }, 0);
})();

(() => {
  if (!("serviceWorker" in navigator) || !/^https?:$/.test(location.protocol)) return;

  // app.js owns the normal update flow. This tiny handoff guard only covers
  // iOS/WebKit cases where controllerchange is missed and the page reloads
  // while the same waiting worker is still visible to the next navigation.
  const REQUEST_KEY = "solivoc-pwa-update-requested-v2";
  const RECENT_MS = 45_000;
  const MIN_SUPPRESS_MS = 5_000;
  const MAX_SUPPRESS_MS = 15_000;

  const banner = document.getElementById("updateBanner");
  const updateButton = document.getElementById("updateNow");

  const hideBanner = () => {
    banner?.classList.remove("show");
    banner?.setAttribute("aria-hidden", "true");
    if (updateButton) {
      updateButton.disabled = false;
      updateButton.textContent = "Обновить";
    }
  };

  const requestedAt = () => {
    try { return Number(sessionStorage.getItem(REQUEST_KEY) || 0) || 0;
    } catch { return 0; }
  };

  const recentlyRequested = () => {
    const at = requestedAt();
    return at > 0 && Date.now() - at < RECENT_MS;
  };

  const markRequested = () => {
    try { sessionStorage.setItem(REQUEST_KEY, String(Date.now())); } catch {}
  };

  updateButton?.addEventListener("click", markRequested, { capture: true });

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!recentlyRequested()) return;
    // Keep the marker across app.js's explicit reload. The next document uses
    // it to suppress a stale copy of the same update banner.
    markRequested();
    hideBanner();
  });

  if (!recentlyRequested()) return;

  const startedAt = Date.now();
  let timer = null;
  let observer = null;

  const cleanup = () => {
    if (timer) clearTimeout(timer);
    observer?.disconnect();
    hideBanner();
    try { sessionStorage.removeItem(REQUEST_KEY); } catch {}
  };

  hideBanner();

  if (banner && "MutationObserver" in window) {
    observer = new MutationObserver(() => {
      if (recentlyRequested()) hideBanner();
    });
    observer.observe(banner, {
      attributes: true,
      attributeFilter: ["class", "aria-hidden"],
    });
  }

  const settle = async () => {
    if (!recentlyRequested()) {
      cleanup();
      return;
    }

    hideBanner();

    let registration = null;
    try { registration = await navigator.serviceWorker.getRegistration(); } catch {}

    // If WebKit reloaded before SKIP_WAITING completed, repeat the request.
    if (registration?.waiting) {
      try { registration.waiting.postMessage({ type: "SKIP_WAITING" }); } catch {}
    }

    const elapsed = Date.now() - startedAt;
    if (!registration?.waiting && elapsed >= MIN_SUPPRESS_MS) {
      cleanup();
      return;
    }

    if (elapsed >= MAX_SUPPRESS_MS) {
      // Never trap the UI permanently. If a genuinely newer update arrives,
      // app.js can show it normally after this short handoff window.
      cleanup();
      return;
    }

    timer = setTimeout(settle, 500);
  };

  settle();
})();
