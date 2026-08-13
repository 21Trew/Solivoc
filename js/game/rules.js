/* Move payloads, drop validation and state mutations. */
function getDragPayload(card) {
  const source = card.dataset.source;
  if (source === "column") {
    const ci = +card.dataset.col,
      col = state.columns[ci],
      start = firstOpenIndex(col);
    if (start >= col.length) return null;
    return { source, ci, start, groups: col.slice(start) };
  }
  if (source === "waste") {
    const c = state.waste[state.waste.length - 1];
    return c ? { source, groups: [{ cards: [c], faceUp: true }] } : null;
  }
  if (source === "slot") {
    const si = +card.dataset.index;
    return { source, si, groups: [state.slots[si]] };
  }
  return null;
}
function targetFromPoint(x, y) {
  const e = document.elementFromPoint(x, y);
  return e?.closest("[data-zone]") || null;
}
function payloadGroup(p) {
  return { cards: p.groups.flatMap((g) => g.cards), faceUp: true };
}
function canDrop(p, target) {
  if (!target) return false;
  const zone = target.dataset.zone,
    idx = +target.dataset.index,
    moving = payloadGroup(p),
    cc = categoryCard(moving);
  if (zone === "slot") {
    const dest = state.slots[idx];
    if (!dest) return !!cc;
    return canMerge(dest, moving) && !!categoryCard(dest);
  }
  if (zone === "column") {
    if (cc) return false;
    const col = state.columns[idx];
    if (p.source === "column" && p.ci === idx) return false;
    if (!col.length) return true;
    const last = col[col.length - 1];
    return last.faceUp && canMerge(last, moving);
  }
  return false;
}
function detachPayload(p) {
  if (p.source === "column") {
    const col = state.columns[p.ci],
      start = firstOpenIndex(col),
      groups = col.slice(start);
    col.splice(start);
    revealLast(col);
    return groups;
  }
  if (p.source === "waste") return [{ cards: [state.waste.pop()], faceUp: true }];
  if (p.source === "slot") {
    const g = state.slots[p.si];
    state.slots[p.si] = null;
    return [g];
  }
  return [];
}
function completeSlot(i) {
  const g = state.slots[i],
    cc = g && categoryCard(g);
  if (cc && wordCount(g) === cc.total) {
    state.slots[i] = null;
    state.completed++;
    if (state.mode !== "tutorial") {
      profile.stats.categoriesCompleted++;
      if (!profile.discovered.includes(cc.cat)) profile.discovered.push(cc.cat);
      track("category_completed", { category: cc.cat, mode: state.mode });
      checkAchievements();
    }
    burst(false);
    haptic([12, 22, 28]);
    showToast(`✓ ${cc.label}: собрано!`);
  }
}
function performDrop(p, target) {
  if (!canDrop(p, target)) return false;
  pushHistory();
  const groups = detachPayload(p),
    moving = { cards: groups.flatMap((g) => g.cards), faceUp: true },
    zone = target.dataset.zone,
    idx = +target.dataset.index;
  if (zone === "slot") {
    if (state.slots[idx]) state.slots[idx].cards.push(...moving.cards);
    else state.slots[idx] = moving;
    completeSlot(idx);
  } else {
    const col = state.columns[idx];
    if (col.length) col[col.length - 1].cards.push(...moving.cards);
    else col.push(moving);
  }
  state.run.moves++;
  haptic(9);
  render();
  return true;
}
