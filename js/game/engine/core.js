/* Pure deterministic board engine: state + command -> newState + effects. */
(() => {
  "use strict";

  const root = typeof window !== "undefined" ? window : globalThis;
  if (root.SolivocGameEngine) return;

  const COMMAND = Object.freeze({
    MOVE_CARD: "MOVE_CARD",
    DRAW_STOCK: "DRAW_STOCK",
    RECYCLE_WASTE: "RECYCLE_WASTE",
    USE_HINT: "USE_HINT",
    UNDO: "UNDO",
  });

  const clone = (value) => {
    if (typeof structuredClone === "function") {
      try { return structuredClone(value); } catch {}
    }
    try { return JSON.parse(JSON.stringify(value)); } catch { return null; }
  };
  const int = (value, min = 0, max = Number.MAX_SAFE_INTEGER) => {
    const n = Math.trunc(Number(value));
    return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : min;
  };
  const groupCards = (group) => Array.isArray(group?.cards) ? group.cards : [];
  const categoryCard = (group) => groupCards(group).find((card) => card?.type === "category") || null;
  const wordCount = (group) => groupCards(group).filter((card) => card?.type === "word").length;
  const catOfGroup = (group) => groupCards(group)[0]?.cat || "";
  const canMerge = (left, right) => !!left && !!right && !!catOfGroup(left) && catOfGroup(left) === catOfGroup(right);
  const firstOpenIndex = (column) => {
    const list = Array.isArray(column) ? column : [];
    const index = list.findIndex((group) => !!group?.faceUp);
    return index < 0 ? list.length : index;
  };
  const payloadGroup = (payload) => ({
    cards: (Array.isArray(payload?.groups) ? payload.groups : []).flatMap((group) => groupCards(group)),
    faceUp: true,
  });

  function maxStockRecycles(state) {
    const specialLimit = Number(state?.special?.maxRecycles);
    const ruleLimit = Number(state?.rules?.maxRecycles);
    const limits = [specialLimit, ruleLimit].filter(Number.isFinite);
    return limits.length ? Math.min(...limits) : Infinity;
  }

  function canRecycleStock(state) {
    return !!state?.waste?.length && int(state?.run?.recycles) < maxStockRecycles(state);
  }

  function payloadForSource(state, source = {}) {
    if (!state || !source) return null;
    const zone = String(source.zone || source.source || "");
    if (zone === "column") {
      const index = int(source.index ?? source.ci, 0, Math.max(0, (state.columns?.length || 1) - 1));
      const column = state.columns?.[index];
      if (!Array.isArray(column)) return null;
      const start = firstOpenIndex(column);
      if (start >= column.length) return null;
      if (source.start != null && int(source.start) !== start) return null;
      return { source: "column", ci: index, start, groups: column.slice(start) };
    }
    if (zone === "waste") {
      const card = state.waste?.at?.(-1) ?? state.waste?.[state.waste.length - 1];
      return card ? { source: "waste", groups: [{ cards: [card], faceUp: true }] } : null;
    }
    if (zone === "slot") {
      const index = int(source.index ?? source.si, 0, Math.max(0, (state.slots?.length || 1) - 1));
      const group = state.slots?.[index];
      return group ? { source: "slot", si: index, groups: [group] } : null;
    }
    return null;
  }

  function canDropTo(state, payload, zone, index) {
    if (!state || !payload) return false;
    const idx = int(index, 0);
    const moving = payloadGroup(payload);
    const cc = categoryCard(moving);
    if (zone === "slot") {
      if (!Array.isArray(state.slots) || idx >= state.slots.length) return false;
      if (state.special?.lockedSlot && idx === state.slots.length - 1 && int(state.completed) < int(state.special.unlockAfter, 1)) return false;
      const dest = state.slots[idx];
      if (!dest) return !!cc;
      return canMerge(dest, moving) && !!categoryCard(dest);
    }
    if (zone === "column") {
      if (cc) return false;
      if (!Array.isArray(state.columns) || idx >= state.columns.length) return false;
      const column = state.columns[idx];
      if (payload.source === "column" && payload.ci === idx) return false;
      if (!column.length) return true;
      const last = column[column.length - 1];
      return !!last?.faceUp && canMerge(last, moving);
    }
    return false;
  }

  function isProductiveDrop(state, payload, zone, index) {
    if (zone === "slot") return true;
    if (zone !== "column") return false;
    const column = state?.columns?.[int(index, 0)];
    if (!Array.isArray(column)) return false;
    if (column.length) return canMerge(column[column.length - 1], payloadGroup(payload));
    if (payload?.source !== "column") return false;
    return int(payload.start) > 0;
  }

  function slotIsComplete(state, index) {
    const group = state?.slots?.[int(index, 0)];
    const cc = group && categoryCard(group);
    return !!(cc && wordCount(group) === int(cc.total));
  }

  function detachPayload(state, payload, effects) {
    if (payload.source === "column") {
      const column = state.columns[payload.ci];
      const start = firstOpenIndex(column);
      const groups = column.slice(start);
      column.splice(start);
      if (column.length && !column[column.length - 1]?.faceUp) {
        column[column.length - 1].faceUp = true;
        const uid = column[column.length - 1]?.cards?.[0]?.uid || null;
        effects.push({ type: "CARD_REVEALED", uid, columnIndex: payload.ci });
      }
      return groups;
    }
    if (payload.source === "waste") {
      const card = state.waste.pop();
      return card ? [{ cards: [card], faceUp: true }] : [];
    }
    if (payload.source === "slot") {
      const group = state.slots[payload.si];
      state.slots[payload.si] = null;
      return group ? [group] : [];
    }
    return [];
  }

  function reduceMove(inputState, command) {
    const state = clone(inputState);
    if (!state) return rejected(inputState, command, "invalid_state");
    const payload = payloadForSource(state, command.source);
    const zone = String(command.target?.zone || "");
    const index = int(command.target?.index, 0);
    if (!payload) return rejected(inputState, command, "invalid_source");
    if (!canDropTo(state, payload, zone, index)) return rejected(inputState, command, "invalid_target");

    const effects = [];
    const productive = isProductiveDrop(state, payload, zone, index);
    const groups = detachPayload(state, payload, effects);
    const moving = { cards: groups.flatMap((group) => groupCards(group)), faceUp: true };
    if (!moving.cards.length) return rejected(inputState, command, "empty_payload");

    if (zone === "slot") {
      if (state.slots[index]) state.slots[index].cards.push(...moving.cards);
      else state.slots[index] = moving;
    } else {
      const column = state.columns[index];
      if (column.length) column[column.length - 1].cards.push(...moving.cards);
      else column.push(moving);
    }
    state.run ||= {};
    state.run.moves = int(state.run.moves) + 1;

    effects.push({
      type: "MOVE_APPLIED",
      source: { source: payload.source, ci: payload.ci, si: payload.si, start: payload.start },
      target: { zone, index },
      productive,
      movedCardUids: moving.cards.map((card) => card?.uid).filter(Boolean),
      categoryCard: !!categoryCard(moving),
    });
    if (zone === "slot" && slotIsComplete(state, index)) {
      const cc = categoryCard(state.slots[index]);
      effects.push({
        type: "SLOT_COMPLETED",
        slotIndex: index,
        category: cc ? { cat: String(cc.cat || ""), label: String(cc.label || ""), total: int(cc.total) } : null,
      });
    }
    return accepted(state, command, effects);
  }

  function reduceDrawStock(inputState, command, forceRecycle = false) {
    const state = clone(inputState);
    if (!state) return rejected(inputState, command, "invalid_state");
    state.stock = Array.isArray(state.stock) ? state.stock : [];
    state.waste = Array.isArray(state.waste) ? state.waste : [];
    state.run ||= {};
    const effects = [];

    if (!forceRecycle && state.stock.length) {
      const card = state.stock.pop();
      state.waste.push(card);
      state.run.moves = int(state.run.moves) + 1;
      effects.push({ type: "STOCK_DRAWN", uid: card?.uid || null });
      return accepted(state, command, effects);
    }

    if (state.stock.length) return rejected(inputState, command, "stock_not_empty");
    if (!canRecycleStock(state)) return rejected(inputState, command, state.waste.length ? "recycle_limit" : "empty_stock");
    state.stock = state.waste.slice().reverse();
    state.waste = [];
    state.run.recycles = int(state.run.recycles) + 1;
    state.run.moves = int(state.run.moves) + 1;
    effects.push({ type: "STOCK_RECYCLED", recycles: state.run.recycles });
    return accepted(state, command, effects);
  }

  function currentMovePayloads(state) {
    const payloads = [];
    (state?.columns || []).forEach((column, ci) => {
      const start = firstOpenIndex(column);
      if (start < column.length) payloads.push({ source: "column", ci, start, groups: column.slice(start) });
    });
    if (state?.waste?.length) {
      const card = state.waste[state.waste.length - 1];
      payloads.push({ source: "waste", groups: [{ cards: [card], faceUp: true }] });
    }
    return payloads;
  }

  function findUsefulBoardMove(state) {
    const payloads = currentMovePayloads(state);
    const zones = [
      ...(state?.slots || []).map((_, index) => ({ zone: "slot", index })),
      ...(state?.columns || []).map((_, index) => ({ zone: "column", index })),
    ];
    for (const payload of payloads) {
      const ranked = zones.slice().sort((a, b) => (a.zone === "slot" ? -1 : 1) - (b.zone === "slot" ? -1 : 1));
      for (const target of ranked) {
        if (canDropTo(state, payload, target.zone, target.index) && isProductiveDrop(state, payload, target.zone, target.index)) {
          return { payload: clone(payload), ...target };
        }
      }
    }
    return null;
  }

  function accessibleReserveCards(state) {
    const reserve = [...(state?.stock || [])];
    if (canRecycleStock(state)) reserve.push(...(state?.waste || []));
    else if (state?.waste?.length) reserve.push(state.waste[state.waste.length - 1]);
    return reserve;
  }

  function reserveHasFutureMove(state) {
    const reserve = accessibleReserveCards(state);
    if (!reserve.length) return false;
    const freeSlot = (state?.slots || []).some((group) => !group);
    const activeCats = new Set((state?.slots || []).filter(Boolean).map(catOfGroup));
    return reserve.some((card) => card?.type === "category" ? freeSlot : activeCats.has(card?.cat));
  }

  function isDeadlocked(state) {
    if (!state || state.rewarded || int(state.completed) >= int(state.totalCategories)) return false;
    if (findUsefulBoardMove(state)) return false;
    return !reserveHasFutureMove(state);
  }

  function findHint(state) {
    const board = findUsefulBoardMove(state);
    if (board) return board;
    if (state?.stock?.length) return { action: "draw" };
    if (canRecycleStock(state)) return { action: "recycle" };
    return null;
  }

  function reduceHint(inputState, command) {
    const state = clone(inputState);
    if (!state) return rejected(inputState, command, "invalid_state");
    if (state.special?.noHints || state.rules?.noHints) return rejected(inputState, command, "hints_disabled");
    state.run ||= {};
    state.run.hints = int(state.run.hints) + 1;
    return accepted(state, command, [{ type: "HINT_REQUESTED", hint: findHint(state) }]);
  }

  function reduceUndo(inputState, command) {
    const previous = clone(command?.snapshot);
    if (!previous || typeof previous !== "object") return rejected(inputState, command, "invalid_snapshot");
    previous.run ||= {};
    previous.run.undos = int(command?.undoCount ?? previous.run.undos);
    return accepted(previous, command, [{ type: "UNDO_APPLIED", undoCount: previous.run.undos }]);
  }

  function accepted(state, command, effects = []) {
    return { accepted: true, state, command: clone(command), effects };
  }
  function rejected(state, command, reason) {
    return { accepted: false, state, command: clone(command), effects: [], reason };
  }

  function reduce(state, command = {}) {
    switch (command.type) {
      case COMMAND.MOVE_CARD: return reduceMove(state, command);
      case COMMAND.DRAW_STOCK: return reduceDrawStock(state, command, false);
      case COMMAND.RECYCLE_WASTE: return reduceDrawStock(state, command, true);
      case COMMAND.USE_HINT: return reduceHint(state, command);
      case COMMAND.UNDO: return reduceUndo(state, command);
      default: return rejected(state, command, "unknown_command");
    }
  }

  root.SolivocGameEngine = Object.freeze({
    COMMAND,
    reduce,
    canDropTo,
    canRecycleStock,
    findHint,
    findUsefulBoardMove,
    isDeadlocked,
    payloadForSource,
    payloadGroup,
    isProductiveDrop,
    slotIsComplete,
  });
})();
