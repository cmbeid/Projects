// Draggable window utility (UI agent) — enables dragging floating tool
// windows, inspector panels, elevator scheduling dialogs, find dialogs, etc.

// bringToFront writes an *inline* z-index, which outranks anything the
// stylesheet says. The old base of 100 therefore sank any panel the player
// tapped below the static tiers above it — most visibly on the phone tier,
// where the bottom sheets are z-index 560 and .osmodal-backdrop is 550, so the
// first tap on the Find & Search sheet dropped it behind its own backdrop.
// Start above every static tier and stay under #erroverlay (999) so a boot
// failure is always readable.
const Z_BASE = 600;
const Z_MAX = 960;
let topZIndex = Z_BASE;
const raised = new Set();

export function bringToFront(el) {
  if (!el || !el.style) return;
  raised.add(el);
  if (topZIndex >= Z_MAX) {
    // Renormalise back down to the base, preserving the current stacking
    // order, rather than creeping into #erroverlay's tier over a long session.
    const order = [...raised].sort(
      (a, b) => (parseInt(a.style.zIndex, 10) || Z_BASE) - (parseInt(b.style.zIndex, 10) || Z_BASE),
    );
    topZIndex = Z_BASE;
    for (const e of order) e.style.zIndex = String(++topZIndex);
  }
  topZIndex += 1;
  el.style.zIndex = String(topZIndex);
}

// The phone tier lays every panel out as a full-width bottom sheet
// (position: fixed; left/right/bottom: 0). Free dragging writes inline
// left/top + right/bottom:auto, which outranks that media query and leaves the
// sheet stranded as a floating box until reload — and the title bar carries a
// grabber pill, so it actively invites the gesture that breaks it. Checked per
// gesture rather than once at construction so rotation is handled for free.
const PHONE_TIER = "(max-width: 480px)";

export function isPhoneTier() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia(PHONE_TIER).matches;
}

// How far the sheet must be pulled down before release dismisses it.
const SWIPE_DISMISS_PX = 70;

// `onDismiss` opts a panel into the phone tier's swipe-down-to-close gesture.
// Only panels that actually become bottom sheets should pass it; the toolbox
// drawer and the HUD strip deliberately do not.
export function makeDraggable(windowEl, handleEl = null, { onDismiss = null } = {}) {
  if (typeof window === "undefined" || !windowEl) return;
  const handle = handleEl || windowEl;

  if (handle.style) {
    handle.style.touchAction = "none";
  }

  let startX = 0;
  let startY = 0;
  let initLeft = 0;
  let initTop = 0;
  let dragging = false;

  windowEl.addEventListener("pointerdown", () => bringToFront(windowEl));

  // Phone tier: the title bar carries a grabber pill, so pulling it down
  // dismisses the sheet. Free dragging stays off there — it writes inline
  // left/top, which outranks the media query and strands the sheet as a
  // floating box until reload.
  let swipe = null;

  const endSwipe = (commit) => {
    if (!swipe) return;
    const { dy } = swipe;
    swipe = null;
    windowEl.style.transform = "";
    windowEl.style.transition = "";
    if (commit && dy >= SWIPE_DISMISS_PX) onDismiss?.();
  };

  const onPointerDown = (e) => {
    // Ignore interactive control clicks (buttons, inputs, close X, tabs, tool cells)
    if (
      e.target &&
      e.target.closest &&
      e.target.closest("button, input, select, textarea, .oswin-x, .tw-btn, .osbtn, .tb-cell, .tb-toolbtn, .tb-item, .find-tab, a")
    ) {
      return;
    }
    if (e.button !== undefined && e.button !== 0) return; // Left-click only

    if (isPhoneTier()) {
      if (!onDismiss) return;
      swipe = { startY: e.clientY, dy: 0 };
      windowEl.style.transition = "none";
      if (handle.setPointerCapture && e.pointerId !== undefined) {
        try {
          handle.setPointerCapture(e.pointerId);
        } catch (_) {}
      }
      e.preventDefault();
      return;
    }

    dragging = true;
    startX = e.clientX;
    startY = e.clientY;

    const rect = windowEl.getBoundingClientRect();
    initLeft = rect.left;
    initTop = rect.top;

    bringToFront(windowEl);
    if (handle.setPointerCapture && e.pointerId !== undefined) {
      try {
        handle.setPointerCapture(e.pointerId);
      } catch (_) {}
    }

    e.preventDefault();
  };

  const onPointerMove = (e) => {
    if (swipe) {
      // Downward only — an upward pull should not lift the sheet off the edge.
      swipe.dy = Math.max(0, e.clientY - swipe.startY);
      windowEl.style.transform = `translateY(${swipe.dy}px)`;
      if (e.cancelable) e.preventDefault();
      return;
    }
    if (!dragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    let newLeft = initLeft + dx;
    let newTop = initTop + dy;

    const winW = typeof window !== "undefined" ? window.innerWidth : 1200;
    const winH = typeof window !== "undefined" ? window.innerHeight : 800;
    const maxLeft = Math.max(0, winW - (windowEl.offsetWidth || 100));
    const maxTop = Math.max(0, winH - (windowEl.offsetHeight || 60));

    newLeft = Math.max(0, Math.min(maxLeft, newLeft));
    newTop = Math.max(0, Math.min(maxTop, newTop));

    windowEl.style.left = `${newLeft}px`;
    windowEl.style.top = `${newTop}px`;
    windowEl.style.right = "auto";
    windowEl.style.bottom = "auto";
  };

  const onPointerUp = (e) => {
    if (swipe) {
      endSwipe(e.type !== "pointercancel");
      return;
    }
    if (dragging) {
      dragging = false;
      if (handle.releasePointerCapture && e.pointerId !== undefined) {
        try {
          handle.releasePointerCapture(e.pointerId);
        } catch (_) {}
      }
    }
  };

  handle.addEventListener("pointerdown", onPointerDown);
  if (typeof window !== "undefined") {
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
  }
}
