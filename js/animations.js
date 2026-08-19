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
  if (typeof stabilityConstrainedMode === "function" && stabilityConstrainedMode()) {
    // Do not create dozens of concurrent Web Animations + delayed audio nodes on
    // iOS standalone. The board is shown immediately and remains responsive.
    dealAnimating = false;
    stockEl.classList.remove("deal-pulse");
    return;
  }
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
    // A short, quiet card-slap follows the visual deal. Staggered tones make
    // the initial layout feel physical without turning into a loud shuffle.
    playSfx("deal", 0.56 + (i % 4) * 0.035, delay / 1000);
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
      scheduleDeadlockCheck(420);
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
  playSfx("flip", 0.7);
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
  // The waste card is rendered face-up immediately. Avoid the old flip animation:
  // on iOS it briefly exposed the card back before the open card appeared.
  pendingStockDraw = null;
}
function animateRecycle() {
  if (!pendingRecycle) return;
  pendingRecycle = false;
  if (motionReduced()) return;
  stockEl.classList.add("deal-pulse");
  playSfx("flip", 0.65);
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
