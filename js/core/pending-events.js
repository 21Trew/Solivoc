/* Durable pending event queue with ACK-based removal. */
(() => {
  const root = typeof window !== "undefined" ? window : globalThis;
  if (root.SolivocPendingEvents) return;

  const STORAGE_KEY = "solivoc-pending-events-v1";
  const QUEUE_VERSION = 1;
  const RECENT_LIMIT = 512;
  const DEFAULT_BATCH_LIMIT = 100;
  let lastError = "";
  let lastLocalWriteOk = true;
  let loadedFromLocal = false;

  const clone = (value) => {
    try { return JSON.parse(JSON.stringify(value)); } catch { return null; }
  };
  const safeToken = (value, max = 120) => String(value || "")
    .replace(/[^a-zA-Z0-9_.:-]/g, "")
    .slice(0, max);
  const safeOwner = (value) => safeToken(value, 64);
  const int = (value, min = 0, max = Number.MAX_SAFE_INTEGER) => {
    const n = Math.trunc(Number(value));
    return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : min;
  };
  const storage = () => {
    try { return root.localStorage || (typeof localStorage !== "undefined" ? localStorage : null); }
    catch { return null; }
  };

  function randomStreamId() {
    try {
      const bytes = new Uint32Array(3);
      (root.crypto || crypto).getRandomValues(bytes);
      return `s_${[...bytes].map((n) => n.toString(36)).join("")}`.slice(0, 48);
    } catch {
      return `s_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`.slice(0, 48);
    }
  }

  function emptyEnvelope() {
    return {
      version: QUEUE_VERSION,
      streamId: randomStreamId(),
      nextSequence: 1,
      updatedAt: 0,
      events: [],
      recent: [],
    };
  }

  function normalizeEvent(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const streamId = safeToken(raw.streamId, 48);
    const sequenceNo = int(raw.sequenceNo, 1, 1_000_000_000);
    const eventId = safeToken(raw.eventId || `${streamId}:${sequenceNo}`, 120);
    const eventType = safeToken(raw.eventType || "completion", 32);
    if (!streamId || !sequenceNo || !eventId || !eventType) return null;
    return {
      schemaVersion: Math.max(1, int(raw.schemaVersion, 1, 10)),
      eventId,
      streamId,
      sequenceNo,
      idempotencyKey: safeToken(raw.idempotencyKey || eventId, 120) || eventId,
      eventType,
      owner: safeOwner(raw.owner),
      occurredAt: int(raw.occurredAt, 0, 9_999_999_999_999) || Date.now(),
      source: safeToken(raw.source || "game", 32) || "game",
      buildId: safeToken(raw.buildId, 48),
      transactionId: safeToken(raw.transactionId, 120),
      commandId: safeToken(raw.commandId, 120),
      payload: clone(raw.payload && typeof raw.payload === "object" ? raw.payload : {}) || {},
    };
  }

  function normalizeRecent(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const transactionId = safeToken(raw.transactionId, 120);
    if (!transactionId) return null;
    return {
      transactionId,
      eventId: safeToken(raw.eventId, 120),
      owner: safeOwner(raw.owner),
      at: int(raw.at, 0, 9_999_999_999_999),
    };
  }

  function normalizeEnvelope(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const streamId = safeToken(raw.streamId, 48) || randomStreamId();
    const events = Array.isArray(raw.events) ? raw.events.map(normalizeEvent).filter(Boolean) : [];
    const recent = Array.isArray(raw.recent) ? raw.recent.map(normalizeRecent).filter(Boolean).slice(-RECENT_LIMIT) : [];
    const maxCurrentSequence = events
      .filter((event) => event.streamId === streamId)
      .reduce((max, event) => Math.max(max, event.sequenceNo), 0);
    return {
      version: QUEUE_VERSION,
      streamId,
      nextSequence: Math.max(int(raw.nextSequence, 1, 1_000_000_001), maxCurrentSequence + 1, 1),
      updatedAt: int(raw.updatedAt, 0, 9_999_999_999_999),
      events,
      recent,
    };
  }

  function readLocal() {
    try {
      const raw = storage()?.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = normalizeEnvelope(JSON.parse(raw));
      if (parsed) loadedFromLocal = true;
      return parsed;
    } catch { return null; }
  }

  let state = readLocal() || emptyEnvelope();

  function report(error) {
    lastError = String(error?.name || error?.message || error || "pending_events_error").slice(0, 160);
    try {
      root.dispatchEvent?.(new CustomEvent("solivoc:pending-events-error", { detail: { message: lastError } }));
    } catch {}
    try { root.recordStabilityEvent?.("pending_events_error", { error: lastError }); } catch {}
  }

  function mirror(raw) {
    try {
      const persistence = root.SolivocPersistence;
      if (!persistence?.put) return;
      Promise.resolve(persistence.put(STORAGE_KEY, raw, { source: "pending-events" })).catch(report);
    } catch (error) { report(error); }
  }

  function persist() {
    state.updatedAt = Date.now();
    let raw = "";
    try { raw = JSON.stringify(state); }
    catch (error) { report(error); return false; }
    lastLocalWriteOk = false;
    try {
      const target = storage();
      if (!target) throw new Error("local_storage_unavailable");
      target.setItem(STORAGE_KEY, raw);
      lastLocalWriteOk = target.getItem(STORAGE_KEY) === raw;
      if (!lastLocalWriteOk) throw new Error("pending_events_write_verify_failed");
      loadedFromLocal = true;
    } catch (error) { report(error); }
    mirror(raw);
    return lastLocalWriteOk;
  }

  function mergeMirrorEnvelope(mirrorState) {
    const parsed = normalizeEnvelope(mirrorState);
    if (!parsed) return false;
    if (!loadedFromLocal) {
      state = parsed;
      persist();
      return true;
    }
    const byId = new Map(state.events.map((event) => [event.eventId, event]));
    for (const event of parsed.events) if (!byId.has(event.eventId)) byId.set(event.eventId, event);
    const recentByTx = new Map();
    for (const item of [...parsed.recent, ...state.recent]) recentByTx.set(item.transactionId, item);
    state.events = [...byId.values()];
    state.recent = [...recentByTx.values()].sort((a, b) => a.at - b.at).slice(-RECENT_LIMIT);
    if (parsed.streamId === state.streamId) state.nextSequence = Math.max(state.nextSequence, parsed.nextSequence);
    persist();
    return true;
  }

  async function hydrateFromMirror() {
    try {
      const persistence = root.SolivocPersistence;
      if (!persistence?.get) return false;
      const record = await persistence.get(STORAGE_KEY);
      if (!record?.value) return false;
      const parsed = JSON.parse(record.value);
      return mergeMirrorEnvelope(parsed);
    } catch (error) {
      report(error);
      return false;
    }
  }

  function hasTransaction(transactionId) {
    const id = safeToken(transactionId, 120);
    if (!id) return false;
    return state.events.some((event) => event.transactionId === id)
      || state.recent.some((item) => item.transactionId === id);
  }

  function buildId() {
    try {
      return safeToken(root.document?.querySelector?.('meta[name="slovasyans-build"]')?.content, 48);
    } catch { return ""; }
  }

  function enqueue({
    owner = "",
    eventType = "completion",
    payload = {},
    transactionId = "",
    commandId = "",
    source = "game",
    occurredAt = Date.now(),
  } = {}) {
    const tx = safeToken(transactionId, 120);
    if (tx && hasTransaction(tx)) {
      const existing = state.events.find((event) => event.transactionId === tx) || null;
      return { event: clone(existing), duplicate: true, persistedLocal: lastLocalWriteOk };
    }
    const sequenceNo = state.nextSequence++;
    const streamId = state.streamId;
    const eventId = safeToken(`${streamId}:${sequenceNo}`, 120);
    const event = normalizeEvent({
      schemaVersion: 1,
      eventId,
      streamId,
      sequenceNo,
      idempotencyKey: eventId,
      eventType,
      owner,
      occurredAt,
      source,
      buildId: buildId(),
      transactionId: tx,
      commandId,
      payload,
    });
    if (!event) throw new Error("pending_event_invalid");
    state.events.push(event);
    const persistedLocal = persist();
    return { event: clone(event), duplicate: false, persistedLocal };
  }

  function orderedPending(events) {
    const groups = new Map();
    for (const event of events) {
      if (!groups.has(event.streamId)) groups.set(event.streamId, []);
      groups.get(event.streamId).push(event);
    }
    const orderedGroups = [...groups.values()]
      .map((group) => group.sort((a, b) => a.sequenceNo - b.sequenceNo))
      .sort((a, b) => (a[0]?.occurredAt || 0) - (b[0]?.occurredAt || 0));
    return orderedGroups.flat();
  }

  function pending({ owner = null, limit = DEFAULT_BATCH_LIMIT } = {}) {
    const normalizedOwner = owner == null ? null : safeOwner(owner);
    const selected = normalizedOwner == null
      ? state.events
      : state.events.filter((event) => event.owner === normalizedOwner);
    return clone(orderedPending(selected).slice(0, Math.max(1, int(limit, 1, 500)))) || [];
  }

  function claimGuest(owner) {
    const normalizedOwner = safeOwner(owner);
    if (!normalizedOwner) return 0;
    let changed = 0;
    for (const event of state.events) {
      if (event.owner) continue;
      event.owner = normalizedOwner;
      changed++;
    }
    if (changed) persist();
    return changed;
  }

  function ack(eventIds = []) {
    const ids = new Set((Array.isArray(eventIds) ? eventIds : []).map((value) => safeToken(value, 120)).filter(Boolean));
    if (!ids.size) return 0;
    const kept = [];
    const removed = [];
    for (const event of state.events) (ids.has(event.eventId) ? removed : kept).push(event);
    if (!removed.length) return 0;
    state.events = kept;
    const recentByTx = new Map(state.recent.map((item) => [item.transactionId, item]));
    for (const event of removed) {
      if (!event.transactionId) continue;
      recentByTx.set(event.transactionId, {
        transactionId: event.transactionId,
        eventId: event.eventId,
        owner: event.owner,
        at: Date.now(),
      });
    }
    state.recent = [...recentByTx.values()].sort((a, b) => a.at - b.at).slice(-RECENT_LIMIT);
    persist();
    return removed.length;
  }

  function dropOwner(owner) {
    const normalizedOwner = safeOwner(owner);
    if (!normalizedOwner) return 0;
    const before = state.events.length;
    state.events = state.events.filter((event) => event.owner !== normalizedOwner);
    state.recent = state.recent.filter((item) => item.owner !== normalizedOwner);
    const removed = before - state.events.length;
    if (removed) persist();
    return removed;
  }

  function count(owner = null) {
    if (owner == null) return state.events.length;
    const normalizedOwner = safeOwner(owner);
    return state.events.filter((event) => event.owner === normalizedOwner).length;
  }

  function status() {
    return {
      version: QUEUE_VERSION,
      streamId: state.streamId,
      nextSequence: state.nextSequence,
      pending: state.events.length,
      recent: state.recent.length,
      localWriteOk: lastLocalWriteOk,
      lastError,
    };
  }

  root.SolivocPendingEvents = Object.freeze({
    storageKey: STORAGE_KEY,
    enqueue,
    pending,
    ack,
    claimGuest,
    dropOwner,
    hasTransaction,
    count,
    status,
    hydrateFromMirror,
  });

  if (root.SolivocPersistence?.get) Promise.resolve().then(hydrateFromMirror).catch(() => {});
})();
