/* World Campaign semantic sidecar. Not wired into gameplay until Foundation-02. */
(() => {
  const DB_NAME = "solivoc-narrative-v1";
  const DB_VERSION = 1;
  const PENDING = "pendingCommands";
  const META = "meta";

  function openDb() {
    return new Promise((resolve, reject) => {
      if (!("indexedDB" in window)) return reject(new Error("indexeddb_unavailable"));
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

  async function enqueue(command) {
    if (!command?.commandId || !Array.isArray(command?.events) || !command.events.length) throw new Error("invalid_semantic_command");
    const record = { ...command, queuedAt: Date.now(), attempts: Math.max(0, Number(command.attempts) || 0) };
    await withStore(PENDING, "readwrite", (store) => store.put(record));
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

  window.SolivocNarrativeStore = Object.freeze({ openDb, enqueue, pending, acknowledge, setMeta, getMeta });
})();
