export interface Point {
  x: number;
  y: number;
}

export interface GestureHandlers {
  /** Pressed and released without moving much. */
  onTap?: () => void;
  /** Held still past the long-press delay. Cancels the tap and any drag. */
  onLongPress?: () => void;
  onDragStart?: (point: Point) => void;
  onDragMove?: (point: Point, delta: Point) => void;
  onDragEnd?: (point: Point) => void;
  /**
   * A fast, early swipe past the drag threshold is read as "scroll the list
   * underneath me" rather than "pick this up" — this reports its deltas
   * instead of starting a drag. Only takes effect when `dragArmDelay` is set.
   */
  onScrollMove?: (delta: Point) => void;
  /**
   * Fired when a scroll gesture (see `onScrollMove`) ends, with the release
   * velocity in CSS pixels per millisecond. Lets the caller keep scrolling
   * with momentum after the finger lifts.
   */
  onScrollEnd?: (velocity: Point) => void;
  /**
   * If set, movement past the drag threshold only starts a drag once this
   * many milliseconds have elapsed since the press began; a threshold-crossing
   * swipe earlier than that is routed to `onScrollMove` instead. Lets a list
   * of draggable items still be flick-scrolled.
   */
  dragArmDelay?: number;
}

/** Movement, in CSS pixels, that turns a press into a drag or a scroll. */
const DRAG_THRESHOLD = 7;
const LONG_PRESS_MS = 450;
/** Only recent samples count toward release velocity, so a swipe that pauses before lifting doesn't fling. */
const VELOCITY_WINDOW_MS = 100;

/**
 * One pointer-events gesture recogniser for taps, long-presses and drags.
 *
 * Pointer events rather than separate touch and mouse paths: a phone, a mouse
 * and a stylus all arrive here identically, so there is one set of behaviour
 * to reason about instead of three that drift apart.
 */
export function attachGesture(element: HTMLElement, handlers: GestureHandlers): () => void {
  let pointerId: number | null = null;
  let start: Point = { x: 0, y: 0 };
  let startTime = 0;
  let last: Point = { x: 0, y: 0 };
  let dragging = false;
  let scrolling = false;
  let longPressed = false;
  let longPressTimer: ReturnType<typeof setTimeout> | null = null;
  let samples: { point: Point; time: number }[] = [];

  const clearLongPress = () => {
    if (longPressTimer !== null) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  };

  const onPointerDown = (event: PointerEvent) => {
    // Ignore secondary buttons and any second finger mid-gesture.
    if (pointerId !== null || (event.pointerType === 'mouse' && event.button !== 0)) return;

    pointerId = event.pointerId;
    start = { x: event.clientX, y: event.clientY };
    startTime = performance.now();
    last = start;
    dragging = false;
    scrolling = false;
    longPressed = false;
    samples = [{ point: start, time: startTime }];

    element.setPointerCapture(event.pointerId);

    if (handlers.onLongPress) {
      longPressTimer = setTimeout(() => {
        longPressTimer = null;
        if (dragging) return;
        longPressed = true;
        handlers.onLongPress?.();
      }, LONG_PRESS_MS);
    }
  };

  const onPointerMove = (event: PointerEvent) => {
    if (event.pointerId !== pointerId || longPressed) return;

    const point = { x: event.clientX, y: event.clientY };
    const delta = { x: point.x - last.x, y: point.y - last.y };

    if (scrolling) {
      handlers.onScrollMove?.(delta);
      last = point;
      const now = performance.now();
      samples.push({ point, time: now });
      while (samples.length > 1 && now - samples[0]!.time > VELOCITY_WINDOW_MS) samples.shift();
      return;
    }

    if (!dragging) {
      const travelled = Math.hypot(point.x - start.x, point.y - start.y);
      if (travelled < DRAG_THRESHOLD) return;
      clearLongPress();

      if (handlers.dragArmDelay !== undefined && performance.now() - startTime < handlers.dragArmDelay) {
        // Crossed the threshold too quickly to be a deliberate pick-up: read
        // it as the start of a scroll instead of a drag.
        scrolling = true;
        handlers.onScrollMove?.(delta);
        last = point;
        samples.push({ point, time: performance.now() });
        return;
      }

      dragging = true;
      handlers.onDragStart?.(start);
    }

    handlers.onDragMove?.(point, delta);
    last = point;
  };

  const finish = (event: PointerEvent, cancelled: boolean) => {
    if (event.pointerId !== pointerId) return;

    clearLongPress();
    if (element.hasPointerCapture(event.pointerId)) {
      element.releasePointerCapture(event.pointerId);
    }
    pointerId = null;

    if (dragging) {
      handlers.onDragEnd?.({ x: event.clientX, y: event.clientY });
    } else if (scrolling && !cancelled) {
      const first = samples[0]!;
      const last = samples[samples.length - 1]!;
      const dt = last.time - first.time;
      const velocity =
        dt > 0
          ? { x: (last.point.x - first.point.x) / dt, y: (last.point.y - first.point.y) / dt }
          : { x: 0, y: 0 };
      handlers.onScrollEnd?.(velocity);
    } else if (!longPressed && !cancelled && !scrolling) {
      handlers.onTap?.();
    }

    dragging = false;
    scrolling = false;
    longPressed = false;
    samples = [];
  };

  const onPointerUp = (event: PointerEvent) => finish(event, false);
  const onPointerCancel = (event: PointerEvent) => finish(event, true);

  element.addEventListener('pointerdown', onPointerDown);
  element.addEventListener('pointermove', onPointerMove);
  element.addEventListener('pointerup', onPointerUp);
  element.addEventListener('pointercancel', onPointerCancel);
  // Long-press on touch pops up the system menu unless suppressed.
  element.addEventListener('contextmenu', preventDefault);

  return () => {
    clearLongPress();
    element.removeEventListener('pointerdown', onPointerDown);
    element.removeEventListener('pointermove', onPointerMove);
    element.removeEventListener('pointerup', onPointerUp);
    element.removeEventListener('pointercancel', onPointerCancel);
    element.removeEventListener('contextmenu', preventDefault);
  };
}

function preventDefault(event: Event): void {
  event.preventDefault();
}
