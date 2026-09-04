/* Pure effect -> dirty DOM zone planner for incremental rendering. */
(() => {
  "use strict";
  const root = typeof window !== "undefined" ? window : globalThis;
  if (root.SolivocDirtyZones) return;

  function plan(effects = []) {
    const columns = new Set();
    const slots = new Set();
    let stock = false;
    let waste = false;
    let full = false;

    for (const effect of Array.isArray(effects) ? effects : []) {
      if (!effect || typeof effect !== "object") continue;
      if (effect.type === "UNDO_APPLIED" || effect.type === "START_LEVEL" || effect.type === "RESTARTED") {
        full = true;
        continue;
      }
      if (effect.type === "MOVE_APPLIED" || effect.type === "AUTO_MOVE_APPLIED") {
        if (effect.source?.source === "column" && Number.isInteger(effect.source.ci)) columns.add(effect.source.ci);
        else if (effect.source?.source === "slot" && Number.isInteger(effect.source.si)) slots.add(effect.source.si);
        else if (effect.source?.source === "waste") waste = true;
        if (effect.target?.zone === "column" && Number.isInteger(effect.target.index)) columns.add(effect.target.index);
        else if (effect.target?.zone === "slot" && Number.isInteger(effect.target.index)) slots.add(effect.target.index);
        continue;
      }
      if (effect.type === "CARD_REVEALED" && Number.isInteger(effect.columnIndex)) columns.add(effect.columnIndex);
      else if (effect.type === "STOCK_DRAWN" || effect.type === "STOCK_RECYCLED") {
        stock = true;
        waste = true;
      } else if (effect.type === "CATEGORY_COMPLETED" && Number.isInteger(effect.slotIndex)) slots.add(effect.slotIndex);
    }

    return {
      full,
      columns: [...columns].sort((a, b) => a - b),
      slots: [...slots].sort((a, b) => a - b),
      stock,
      waste,
    };
  }

  root.SolivocDirtyZones = Object.freeze({ plan });
})();
