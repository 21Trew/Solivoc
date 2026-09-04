/* Event-driven knowledge tracking for incremental board paints. */
(() => {
  "use strict";
  const root = typeof window !== "undefined" ? window : globalThis;
  if (root.recordKnowledgeCards) return;

  root.recordKnowledgeCards = function recordKnowledgeCards(cards, s = state) {
    if (!s || s.mode === "tutorial" || !Array.isArray(cards) || !cards.length) return false;
    const ref = typeof levelRefLabel === "function" ? levelRefLabel(s) : null;
    const changed = new Set();
    const seen = new Set();
    for (const card of cards) {
      if (!card?.cat) continue;
      const uid = String(card.uid || `${card.cat}:${card.type}:${card.label}`);
      if (seen.has(uid)) continue;
      seen.add(uid);
      registerVisibleCategoryDiscovery?.(card.cat, ref);
      const stat = categoryStat(card.cat);
      if (!stat.firstLevel && ref) stat.firstLevel = ref;
      if (card.type === "word" && !stat.words.includes(card.label)) {
        stat.words.push(card.label);
        changed.add(card.cat);
      }
    }
    if (!changed.size) return false;
    changed.forEach((id) => String(id).startsWith("visual:") ? checkVisualCategoryMastery?.(id) : checkCategoryMastery?.(id));
    saveProfile();
    return true;
  };
})();
