/* IndexedDB durability mirror for local player state. */
(() => {
  if (typeof window === "undefined" || window.SolivocPersistence) return;

  const DB_NAME = "solivoc-runtime-v1";
  const DB_VERSION = 1;
  const STORE_NAME = "records";
  const SCHEMA_VERSION = 1;
  const writeChains = new Map();
  let dbPromise = null;
  let disabled = typeof indexedDB === "undefined";
  let lastError = "";

  function reportError(error) {
    lastError = String(error?.name || error?.message || error || "unknown").slice(0, 160);
    try {
      window.dispatchEvent(new CustomEvent("solivoc:persistence-error", {
        detail: { message: lastError },
      }));
    } catch {}
  }

  function openDb() {
    if (disabled) return Promise.resolve(null);
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve) => {
      let request;
      try { request = indexedDB.open(DB_NAME, DB_VERSION); }
      catch (error) {
        disabled = true;
        reportError(error);
        resolve(null);
        return;
      }
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: "key" });
      };
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => { try { db.close(); } catch {} dbPromise = null; };
        resolve(db);
      };
      request.onerror = () => {
        disabled = true;
        reportError(request.error || new Error("indexeddb_open_failed"));
        resolve(null);
      };
      request.onblocked = () => reportError(new Error("indexeddb_open_blocked"));
    });
    return dbPromise;
  }

  async function transact(mode, action) {
    const db = await openDb();
    if (!db) return null;
    return new Promise((resolve) => {
      let settled = false;
      let result = null;
      let tx;
      try {
        tx = db.transaction(STORE_NAME, mode);
        result = action(tx.objectStore(STORE_NAME));
      } catch (error) {
        reportError(error);
        resolve(null);
        return;
      }
      const finish = (value) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };
      tx.oncomplete = () => finish(result);
      tx.onerror = () => { reportError(tx.error || new Error("indexeddb_transaction_failed")); finish(null); };
      tx.onabort = () => { reportError(tx.error || new Error("indexeddb_transaction_aborted")); finish(null); };
    });
  }

  async function get(key) {
    const normalized = String(key || "").trim();
    if (!normalized) return null;
    const db = await openDb();
    if (!db) return null;
    return new Promise((resolve) => {
      let tx;
      try {
        tx = db.transaction(STORE_NAME, "readonly");
        const request = tx.objectStore(STORE_NAME).get(normalized);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => { reportError(request.error || new Error("indexeddb_read_failed")); resolve(null); };
      } catch (error) {
        reportError(error);
        resolve(null);
      }
    });
  }

  function enqueue(key, operation) {
    const normalized = String(key || "").trim();
    if (!normalized) return Promise.resolve(false);
    const prior = writeChains.get(normalized) || Promise.resolve();
    const next = prior.catch(() => {}).then(operation).catch((error) => {
      reportError(error);
      return false;
    });
    writeChains.set(normalized, next);
    next.finally(() => { if (writeChains.get(normalized) === next) writeChains.delete(normalized); });
    return next;
  }

  function put(key, value, { updatedAt = Date.now(), source = "runtime" } = {}) {
    const normalized = String(key || "").trim();
    if (!normalized) return Promise.resolve(false);
    const raw = typeof value === "string" ? value : JSON.stringify(value);
    return enqueue(normalized, async () => {
      const result = await transact("readwrite", (store) => {
        store.put({
          key: normalized,
          value: raw,
          updatedAt: Math.max(0, Number(updatedAt) || Date.now()),
          source: String(source || "runtime").slice(0, 48),
          schemaVersion: SCHEMA_VERSION,
        });
        return true;
      });
      return result === true;
    });
  }

  function remove(key) {
    const normalized = String(key || "").trim();
    if (!normalized) return Promise.resolve(false);
    return enqueue(normalized, async () => {
      const result = await transact("readwrite", (store) => { store.delete(normalized); return true; });
      return result === true;
    });
  }

  function localRaw(key) {
    try { return localStorage.getItem(key); } catch { return null; }
  }

  function validJson(raw) {
    if (typeof raw !== "string" || !raw.trim()) return false;
    try { return JSON.parse(raw) !== null; } catch { return false; }
  }

  async function mirrorLocalStorage(key) {
    const raw = localRaw(key);
    if (raw == null) return false;
    return put(key, raw, { source: "localStorage" });
  }

  async function seedFromLocalStorage(keys = []) {
    let mirrored = 0;
    for (const key of [...new Set(keys.map((value) => String(value || "").trim()).filter(Boolean))]) {
      if (await mirrorLocalStorage(key)) mirrored++;
    }
    return mirrored;
  }

  async function recoverMissing(keys = []) {
    const recovered = [];
    for (const key of [...new Set(keys.map((value) => String(value || "").trim()).filter(Boolean))]) {
      const local = localRaw(key);
      if (validJson(local)) continue;
      const record = await get(key);
      if (!record || !validJson(record.value)) continue;
      try {
        localStorage.setItem(key, record.value);
        recovered.push(key);
      } catch (error) {
        reportError(error);
      }
    }
    return recovered;
  }

  async function ready() { return !!(await openDb()); }
  function status() {
    return {
      dbName: DB_NAME,
      schemaVersion: SCHEMA_VERSION,
      available: !disabled,
      pendingWrites: writeChains.size,
      lastError,
    };
  }

  window.SolivocPersistence = Object.freeze({
    ready,
    get,
    put,
    remove,
    mirrorLocalStorage,
    seedFromLocalStorage,
    recoverMissing,
    status,
  });
})();
