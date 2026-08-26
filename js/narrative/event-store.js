/* Durable local queue for World Campaign semantic commands. */
(() => {
  const DB_NAME = "solivoc-narrative-v1";
  const DB_VERSION = 1;
  const PENDING = "pendingCommands";
  const META = "meta";

  function openDb() {
    return new Promise((resolve, reject) => {
      if (!("indexedDB" in globalThis)) return reject(new Error("indexeddb_unavailable"));
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(PENDING)) db.createObjectStore(PENDING, { keyPath: "commandId" });
        if (!db.objectStoreNames.contains(META)) db.createObjectStore(META, { keyPath: "key" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("indexeddb_open_failed"));
    });
  }

  async function withStore(name, mode, work) {
    const db = await openDb();
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(name, mode), store = tx.objectStore(name);
        let result;
        try { result = work(store); } catch (error) { reject(error); return; }
        tx.oncomplete = () => resolve(result);
        tx.onerror = () => reject(tx.error || new Error("indexeddb_transaction_failed"));
        tx.onabort = () => reject(tx.error || new Error("indexeddb_transaction_aborted"));
      });
    } finally { db.close(); }
  }

  const requestValue = (request) => new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  function normalizeCommand(command) {
    if (!command?.commandId || !Array.isArray(command?.events) || !command.events.length)
      throw new Error("invalid_semantic_command");
    return { ...command, queuedAt: Number(command.queuedAt) || Date.now(), attempts: Math.max(0, Number(command.attempts) || 0) };
  }

  async function enqueue(command) {
    const record = normalizeCommand(command);
    await withStore(PENDING, "readwrite", (store) => store.put(record));
    return record;
  }

  async function commit(command, metaKey, value) {
    const record = normalizeCommand(command);
    const key = String(metaKey || "").trim();
    if (!key) throw new Error("invalid_meta_key");
    const db = await openDb();
    try {
      await new Promise((resolve, reject) => {
        const tx = db.transaction([PENDING, META], "readwrite");
        tx.objectStore(PENDING).put(record);
        tx.objectStore(META).put({ key, value, updatedAt: Date.now() });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error || new Error("indexeddb_transaction_failed"));
        tx.onabort = () => reject(tx.error || new Error("indexeddb_transaction_aborted"));
      });
    } finally { db.close(); }
    return record;
  }

  async function pending(limit = 50) {
    const db = await openDb();
    try {
      const tx = db.transaction(PENDING, "readonly");
      const all = await requestValue(tx.objectStore(PENDING).getAll());
      return (Array.isArray(all) ? all : []).sort((a, b) => (a.queuedAt || 0) - (b.queuedAt || 0)).slice(0, Math.max(1, limit));
    } finally { db.close(); }
  }

  async function acknowledge(commandId) {
    await withStore(PENDING, "readwrite", (store) => store.delete(String(commandId || "")));
  }

  async function markAttempt(command, reason, status = 0) {
    const record = normalizeCommand({
      ...command,
      attempts: Math.max(0, Number(command?.attempts) || 0) + 1,
      lastAttemptAt: Date.now(),
      lastError: String(reason || "sync_failed").slice(0, 160),
      lastStatus: Math.max(0, Number(status) || 0),
    });
    await withStore(PENDING, "readwrite", (store) => store.put(record));
    return record;
  }

  async function flush(limit = 20) {
    const queue = await pending(limit);
    const report = { attempted: 0, acknowledged: 0, stoppedReason: null };
    if (typeof globalThis.apiFetch !== "function") {
      report.stoppedReason = "api_unavailable";
      return report;
    }
    for (const command of queue) {
      report.attempted++;
      let response;
      try {
        response = await globalThis.apiFetch("/api/semantic-events", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(command),
        });
      } catch (error) {
        await markAttempt(command, error?.message || "network_error");
        report.stoppedReason = "network_error";
        break;
      }
      const data = await response.json().catch(() => ({}));
      if (response.ok && data?.ok !== false) {
        await acknowledge(command.commandId);
        report.acknowledged++;
        continue;
      }
      await markAttempt(command, data?.error || `http_${response.status}`, response.status);
      report.stoppedReason = data?.error || `http_${response.status}`;
      break;
    }
    return report;
  }

  async function setMeta(key, value) {
    await withStore(META, "readwrite", (store) => store.put({ key, value, updatedAt: Date.now() }));
  }

  async function getMeta(key) {
    const db = await openDb();
    try {
      const tx = db.transaction(META, "readonly");
      return (await requestValue(tx.objectStore(META).get(key)))?.value ?? null;
    } finally { db.close(); }
  }

  globalThis.SolivocNarrativeStore = Object.freeze({
    openDb, enqueue, commit, pending, acknowledge, flush, setMeta, getMeta,
  });
})();
