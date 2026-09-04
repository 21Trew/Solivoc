/* Strangler bridge: keep localStorage authoritative while mirroring durable runtime state to IndexedDB. */
(() => {
  if (typeof window === "undefined" || window.__solivocPersistenceBridge) return;
  window.__solivocPersistenceBridge = true;

  const persistence = window.SolivocPersistence;
  if (!persistence) return;

  const profileKey = typeof PROFILE_KEY !== "undefined" ? PROFILE_KEY : "worditaire-profile-v7";
  const roundKey = typeof SAVE_KEY !== "undefined" ? SAVE_KEY : "assoc-klondike-v7";
  const roundBackupKey = typeof SAVE_BACKUP_KEY !== "undefined" ? SAVE_BACKUP_KEY : `${roundKey}-backup`;
  const managedKeys = [profileKey, roundKey, roundBackupKey].filter(Boolean);

  function mirrorKey(key, source) {
    try {
      const raw = localStorage.getItem(key);
      if (raw == null) return;
      persistence.put(key, raw, { source });
    } catch {}
  }

  function removeKey(key) {
    try { persistence.remove(key); } catch {}
  }

  if (typeof saveProfile === "function" && !saveProfile.__solivocIndexedDbMirror) {
    const baseSaveProfile = saveProfile;
    saveProfile = function indexedDbMirroredProfileSave(...args) {
      const result = baseSaveProfile.apply(this, args);
      mirrorKey(profileKey, "profile-save");
      return result;
    };
    saveProfile.__solivocIndexedDbMirror = true;
  }

  if (typeof persistStateNow === "function" && !persistStateNow.__solivocIndexedDbMirror) {
    const basePersistStateNow = persistStateNow;
    persistStateNow = function indexedDbMirroredRoundSave(...args) {
      const result = basePersistStateNow.apply(this, args);
      if (result !== false) {
        mirrorKey(roundKey, "round-save");
        mirrorKey(roundBackupKey, "round-backup");
      }
      return result;
    };
    persistStateNow.__solivocIndexedDbMirror = true;
  }

  if (typeof clearCompletedSavedRound === "function" && !clearCompletedSavedRound.__solivocIndexedDbMirror) {
    const baseClearCompletedSavedRound = clearCompletedSavedRound;
    clearCompletedSavedRound = function indexedDbMirroredRoundClear(...args) {
      const result = baseClearCompletedSavedRound.apply(this, args);
      removeKey(roundKey);
      removeKey(roundBackupKey);
      return result;
    };
    clearCompletedSavedRound.__solivocIndexedDbMirror = true;
  }

  // Seed existing installations into the durable mirror once the bridge is live.
  // localStorage remains the authoritative synchronous boot source in Stage 3.
  persistence.seedFromLocalStorage(managedKeys).catch(() => {});

  window.SolivocPersistenceBridge = Object.freeze({
    managedKeys: () => [...managedKeys],
    mirrorNow: () => persistence.seedFromLocalStorage(managedKeys),
  });
})();
