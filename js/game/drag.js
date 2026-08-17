/* Drag, double-tap auto move and source vacancy visuals. */
function sourceNodesForPayload(payload, card) {
  if (payload.source === "column")
    return [...document.querySelectorAll(`.card[data-source="column"][data-col="${payload.ci}"]`)];
  return [card];
}
function sourceVacancyNodes(payload) {
  if (payload.source === "column") {
    const col = state.columns[payload.ci];
    if (firstOpenIndex(col) === 0) {
      const node = document.querySelector(`.column[data-index="${payload.ci}"]`);
      return node ? [node] : [];
    }
  }
  if (payload.source === "slot") {
    const node = document.querySelector(`.slot[data-index="${payload.si}"]`);
    return node ? [node] : [];
  }
  if (payload.source === "waste" && state.waste.length === 1) return wasteEl ? [wasteEl] : [];
  return [];
}
function setSourceVacancy(nodes, visible) {
  nodes?.forEach((node) => node.classList.toggle("drag-vacated", visible));
}

function payloadTapKey(p) {
  if (p.source === "column") return `column:${p.ci}:${p.start}`;
  if (p.source === "waste") return `waste:${state.waste.at(-1)?.uid || ""}`;
  if (p.source === "slot") return `slot:${p.si}`;
  return "";
}
function autoTargetForPayload(p) {
  const moving = payloadGroup(p),
    cc = categoryCard(moving);
  if (cc) {
    if (p.source === "slot") return null;
    const i = state.slots.findIndex((g) => !g);
    return i >= 0 ? document.querySelector(`.slot[data-index="${i}"]`) : null;
  }
  const cat = catOfGroup(moving),
    i = state.slots.findIndex((g) => g && categoryCard(g) && catOfGroup(g) === cat);
  return i >= 0 ? document.querySelector(`.slot[data-index="${i}"]`) : null;
}
const nextPaint = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
let autoMoveLifecycleToken = 0;
function cleanupAutoMoveVisuals() {
  document.querySelectorAll(".auto-fly").forEach((node) => { try { node.getAnimations?.().forEach((a)=>a.cancel()); } catch {} node.remove(); });
  document.querySelectorAll(".auto-source").forEach((node)=>node.classList.remove("auto-source"));
  document.querySelectorAll(".drag-vacated").forEach((node)=>node.classList.remove("drag-vacated"));
}
function cancelAutoMoveForLifecycle() {
  autoMoveLifecycleToken++;
  cleanupAutoMoveVisuals();
  autoMoveBusy = false;
}
async function animateAutoMove(card, payload, target) {
  if (autoMoveBusy || categoryAnimating) return;
  const lifecycleToken = ++autoMoveLifecycleToken;
  autoMoveBusy = true;
  const targetCard = target.querySelector(".card"),
    targetRect = (targetCard || target).getBoundingClientRect(),
    sources = sourceNodesForPayload(payload, card).filter((n) => n?.isConnected),
    vacancyNodes = sourceVacancyNodes(payload);
  if (!sources.length) {
    autoMoveBusy = false;
    return;
  }
  const reduced = motionReduced(),
    duration = reduced ? 70 : 145,
    flies = sources.map((source, i) => {
      const r = source.getBoundingClientRect(),
        fly = source.cloneNode(true);
      fly.classList.remove("movable", "drag-source", "hint", "auto-source");
      fly.classList.add("auto-fly");
      Object.assign(fly.style, {
        left: r.left + "px",
        top: r.top + "px",
        width: r.width + "px",
        height: r.height + "px",
        zIndex: String(10020 + i),
      });
      fly.removeAttribute("data-source");
      document.body.appendChild(fly);
      fitAllCardText(fly);
      return { source, fly, rect: r };
    });
  await nextPaint();
  if (lifecycleToken !== autoMoveLifecycleToken || document.hidden) { cleanupAutoMoveVisuals(); autoMoveBusy = false; return; }
  setSourceVacancy(vacancyNodes, true);
  sources.forEach((n) => n.classList.add("auto-source"));
  playSfx("pickup", 0.8);
  const cx = targetRect.left + targetRect.width / 2,
    cy = targetRect.top + targetRect.height / 2;
  await Promise.all(
    flies.map(({ fly, rect }, i) => {
      const dx = cx - (rect.left + rect.width / 2),
        dy = cy - (rect.top + rect.height / 2);
      return fly
        .animate(
          [
            { transform: "translate3d(0,0,0) scale(1)", opacity: 1 },
            { transform: `translate3d(${dx * 0.45}px,${dy * 0.45}px,0) scale(1.035)`, opacity: 1, offset: 0.42 },
            { transform: `translate3d(${dx}px,${dy}px,0) scale(.96)`, opacity: 1 },
          ],
          { duration: duration + Math.min(i, 4) * 7, easing: "cubic-bezier(.22,.78,.18,1)", fill: "forwards" },
        )
        .finished.catch(() => {});
    }),
  );
  if (lifecycleToken !== autoMoveLifecycleToken || document.hidden) { cleanupAutoMoveVisuals(); autoMoveBusy = false; return; }
  state.run.autoMoves++;
  profile.stats.autoMoves++;
  track("auto_move", { mode: state.mode });
  const moved = performDrop(payload, target, { comboEligible: true, comboSource: "auto" });
  if (!moved) {
    sources.forEach((n) => n.classList.remove("auto-source"));
    setSourceVacancy(vacancyNodes, false);
    flies.forEach((x) => x.fly.remove());
    autoMoveBusy = false;
    feedbackWrongMove(sources, target);
    return;
  }
  setSourceVacancy(vacancyNodes, false);
  await nextPaint();
  if (lifecycleToken !== autoMoveLifecycleToken || document.hidden) { cleanupAutoMoveVisuals(); autoMoveBusy = false; return; }
  await Promise.all(
    flies.map(({ fly }) =>
      fly
        .animate([{ opacity: 1 }, { opacity: 0 }], { duration: reduced ? 25 : 70, fill: "forwards" })
        .finished.catch(() => {}),
    ),
  );
  flies.forEach((x) => x.fly.remove());
  autoMoveBusy = false;
}
function handleCardTap(card, payload) {
  const now = performance.now(),
    key = payloadTapKey(payload);
  if (lastTap.key === key && now - lastTap.time < 340) {
    lastTap = { key: null, time: 0 };
    const target = autoTargetForPayload(payload),
      moving = payloadGroup(payload),
      cc = categoryCard(moving);
    if (!target || !canDrop(payload, target)) {
      feedbackWrongMove([card], target, cc ? "Нет свободного поля категории" : "Сначала открой категорию");
      return;
    }
    animateAutoMove(card, payload, target);
  } else lastTap = { key, time: now };
}
function startDrag(e) {
  if (
    autoMoveBusy ||
    categoryAnimating ||
    dealAnimating ||
    hub.classList.contains("show") ||
    modal.classList.contains("show") ||
    $("#deadlockModal")?.classList.contains("show")
  )
    return;
  const card = e.target.closest(".card.movable");
  if (!card) return;
  e.preventDefault();
  try { card.setPointerCapture?.(e.pointerId); } catch {}
  const payload = getDragPayload(card);
  if (!payload) return;
  const sourceNodes = sourceNodesForPayload(payload, card).filter((n) => n?.isConnected);
  if (!sourceNodes.length) return;
  const rects = sourceNodes.map((n) => ({ node: n, rect: n.getBoundingClientRect() }));
  const left = Math.min(...rects.map((x) => x.rect.left)),
    top = Math.min(...rects.map((x) => x.rect.top)),
    right = Math.max(...rects.map((x) => x.rect.right)),
    bottom = Math.max(...rects.map((x) => x.rect.bottom));
  const ghost = document.createElement("div");
  ghost.className = "drag-stack";
  ghost.style.opacity = "0";
  ghost.style.width = right - left + "px";
  ghost.style.height = bottom - top + "px";
  rects.forEach(({ node, rect }, i) => {
    const clone = node.cloneNode(true);
    clone.classList.remove("movable", "hint", "drag-source", "auto-source", "deal-card", "reveal-card");
    clone.removeAttribute("data-source");
    clone.style.left = rect.left - left + "px";
    clone.style.top = rect.top - top + "px";
    clone.style.width = rect.width + "px";
    clone.style.height = rect.height + "px";
    clone.style.zIndex = String(10 + i);
    clone.style.setProperty("--y", "0px");
    ghost.appendChild(clone);
  });
  document.body.appendChild(ghost);
  fitAllCardText(ghost);
  drag = {
    payload,
    card,
    ghost,
    sourceNodes,
    vacancyNodes: sourceVacancyNodes(payload),
    startX: e.clientX,
    startY: e.clientY,
    gripX: e.clientX - left,
    gripY: e.clientY - top,
    originLeft: left,
    originTop: top,
    sourceBounds: { left, top, right, bottom },
    lastX: e.clientX,
    lastY: e.clientY,
    moved: false,
  };
  moveDrag(e);
}
function moveDrag(e) {
  if (!drag) return;
  e.preventDefault();
  const d = Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY);
  if (!drag.moved && d > 3) {
    drag.moved = true;
    setSourceVacancy(drag.vacancyNodes, true);
    drag.sourceNodes.forEach((n) => n.classList.add("drag-source"));
    drag.ghost.style.opacity = "1";
    playSfx("pickup");
    haptic(4);
  }
  drag.ghost.style.left = e.clientX - drag.gripX + "px";
  drag.ghost.style.top = e.clientY - drag.gripY + "px";
  const vx = e.clientX - drag.lastX;
  const tilt = Math.max(-4.5, Math.min(4.5, vx * 0.55));
  drag.ghost.style.setProperty("--drag-tilt", `${tilt.toFixed(2)}deg`);
  drag.lastX = e.clientX;
  drag.lastY = e.clientY;
  const nx = (e.clientX / Math.max(1, innerWidth) - 0.5) * 2;
  const ny = (e.clientY / Math.max(1, innerHeight) - 0.5) * 2;
  document.documentElement.style.setProperty("--parallax-x", `${(nx * 4).toFixed(1)}px`);
  document.documentElement.style.setProperty("--parallax-y", `${(ny * 3).toFixed(1)}px`);
}
async function returnDragGhost(d) {
  if (motionReduced()) return;
  const currentLeft = parseFloat(d.ghost.style.left) || d.originLeft,
    currentTop = parseFloat(d.ghost.style.top) || d.originTop,
    dx = d.originLeft - currentLeft,
    dy = d.originTop - currentTop;
  await d.ghost
    .animate(
      [
        { transform: "translate3d(0,0,0) scale(1)", opacity: 1 },
        { transform: `translate3d(${dx}px,${dy}px,0) scale(.985)`, opacity: 0.98 },
      ],
      { duration: 155, easing: "cubic-bezier(.2,.8,.2,1)", fill: "forwards" },
    )
    .finished.catch(() => {});
}
function resetDragParallax() {
  document.documentElement.style.setProperty("--parallax-x", "0px");
  document.documentElement.style.setProperty("--parallax-y", "0px");
}
function droppedBackOnOrigin(d, target, e) {
  if (!d) return false;
  if (d.payload.source === "column" && target?.dataset.zone === "column" && +target.dataset.index === d.payload.ci) return true;
  if (d.payload.source === "slot" && target?.dataset.zone === "slot" && +target.dataset.index === d.payload.si) return true;
  const b = d.sourceBounds, pad = 18;
  return !!b && e.clientX >= b.left - pad && e.clientX <= b.right + pad && e.clientY >= b.top - pad && e.clientY <= b.bottom + pad;
}
async function cancelDragWithoutPenalty(d) {
  await returnDragGhost(d);
  d.sourceNodes.forEach((n) => n.classList.remove("drag-source"));
  setSourceVacancy(d.vacancyNodes, false);
  d.ghost.remove();
  resetDragParallax();
}

function cancelActiveDragForLifecycle() {
  if (!drag) return;
  const d = drag; drag = null;
  try { d.sourceNodes?.forEach((n) => n?.classList?.remove("drag-source")); } catch {}
  try { setSourceVacancy(d.vacancyNodes || [], false); } catch {}
  try { d.ghost?.remove(); } catch {}
  resetDragParallax();
}

async function endDrag(e) {
  if (!drag) return;
  const d = drag;
  drag = null;
  if (!d.moved) {
    d.ghost.remove();
    resetDragParallax();
    handleCardTap(d.card, d.payload);
    return;
  }
  const target = targetFromPoint(e.clientX, e.clientY);
  if (droppedBackOnOrigin(d, target, e)) {
    await cancelDragWithoutPenalty(d);
    return;
  }
  const valid = canDrop(d.payload, target);
  if (!valid) {
    await returnDragGhost(d);
    d.sourceNodes.forEach((n) => n.classList.remove("drag-source"));
    setSourceVacancy(d.vacancyNodes, false);
    d.ghost.remove();
    resetDragParallax();
    feedbackWrongMove(d.sourceNodes, target);
    scheduleDeadlockCheck(260);
    return;
  }
  d.ghost.remove();
  d.sourceNodes.forEach((n) => n.classList.remove("drag-source"));
  setSourceVacancy(d.vacancyNodes, false);
  resetDragParallax();
  if (!performDrop(d.payload, target, { comboEligible: true })) feedbackWrongMove(d.sourceNodes, target);
}
