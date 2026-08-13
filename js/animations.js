/* Card dealing, reveal and stock animations. */
let initialDealPending = false,
  dealAnimating = false,
  dealAnimationToken = 0,
  pendingRevealUid = null,
  pendingStockDraw = null,
  pendingRecycle = false;
const motionReduced = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
function animateInitialDeal() {
  if (!initialDealPending || dealAnimating) return;
  initialDealPending = false;
  const cards = [...tableau.querySelectorAll(".card"), ...slotsAnchor.querySelectorAll(".card")];
  if (!cards.length || motionReduced()) return;
  const token = ++dealAnimationToken;
  dealAnimating = true;
  const origin = stockEl.getBoundingClientRect(),
    ox = origin.left + origin.width / 2,
    oy = origin.top + origin.height / 2;
  const ordered = cards
    .map((el, i) => ({ el, i, r: el.getBoundingClientRect() }))
    .sort((a, b) => (Math.abs(a.r.top - b.r.top) > 8 ? a.r.top - b.r.top : a.r.left - b.r.left));
  stockEl.classList.add("deal-pulse");
  let maxEnd = 0;
  ordered.forEach(({ el, r }, i) => {
    const cx = r.left + r.width / 2,
      cy = r.top + r.height / 2,
      dx = ox - cx,
      dy = oy - cy,
      delay = Math.min(i * 34, 680),
      duration = 285;
    maxEnd = Math.max(maxEnd, delay + duration);
    el.classList.add("deal-card");
    el.animate(
      [
        {
          transform: `translate3d(${dx}px,${dy}px,0) scale(.82) rotate(-4deg)`,
          opacity: 0,
          filter: "brightness(1.25)",
        },
        {
          transform: `translate3d(${dx * 0.16}px,${dy * 0.16}px,0) scale(1.035) rotate(1deg)`,
          opacity: 1,
          offset: 0.78,
        },
        { transform: "translate3d(0,0,0) scale(1) rotate(0deg)", opacity: 1, filter: "brightness(1)" },
      ],
      { duration, delay, easing: "cubic-bezier(.18,.82,.24,1)", fill: "both" },
    )
      .finished.catch(() => {})
      .finally(() => el.classList.remove("deal-card"));
  });
  setTimeout(() => {
    if (token === dealAnimationToken) {
      dealAnimating = false;
      stockEl.classList.remove("deal-pulse");
    }
  }, maxEnd + 40);
}
function animatePendingReveal() {
  if (!pendingRevealUid) return;
  const uidToReveal = pendingRevealUid;
  pendingRevealUid = null;
  if (motionReduced()) return;
  const el = document.querySelector(`.card[data-uid="${CSS.escape(uidToReveal)}"]`);
  if (!el) return;
  el.classList.add("reveal-card");
  el.animate(
    [
      { transform: "perspective(500px) rotateY(78deg) scale(.94)", opacity: 0.45 },
      { transform: "perspective(500px) rotateY(-7deg) scale(1.025)", opacity: 1, offset: 0.72 },
      { transform: "perspective(500px) rotateY(0) scale(1)", opacity: 1 },
    ],
    { duration: 250, easing: "cubic-bezier(.2,.8,.2,1)" },
  )
    .finished.catch(() => {})
    .finally(() => el.classList.remove("reveal-card"));
}
function animatePendingStockDraw() {
  if (!pendingStockDraw) return;
  const info = pendingStockDraw;
  pendingStockDraw = null;
  const el = wasteEl.querySelector(`.card[data-uid="${CSS.escape(info.uid || "")}"].movable`);
  if (!el || motionReduced()) return;
  const r = el.getBoundingClientRect(),
    fx = info.from.left + info.from.width / 2 - (r.left + r.width / 2),
    fy = info.from.top + info.from.height / 2 - (r.top + r.height / 2);
  el.animate(
    [
      { transform: `translate3d(${fx}px,${fy}px,0) rotateY(0deg) rotate(-3deg)`, opacity: 0.8 },
      {
        transform: `translate3d(${fx * 0.5}px,${fy * 0.5}px,0) rotateY(88deg) rotate(-1deg)`,
        opacity: 0.95,
        offset: 0.42,
      },
      { transform: "translate3d(0,0,0) rotateY(0deg) rotate(0deg)", opacity: 1 },
    ],
    { duration: 260, easing: "cubic-bezier(.2,.8,.2,1)" },
  ).finished.catch(() => {});
}
function animateRecycle() {
  if (!pendingRecycle) return;
  pendingRecycle = false;
  if (motionReduced()) return;
  stockEl.classList.add("deal-pulse");
  setTimeout(() => stockEl.classList.remove("deal-pulse"), 430);
}
function queuePostRenderCardAnimations() {
  requestAnimationFrame(() => {
    if (initialDealPending) animateInitialDeal();
    else {
      animatePendingStockDraw();
      animatePendingReveal();
      animateRecycle();
    }
  });
}
