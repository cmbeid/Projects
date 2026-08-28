/**
 * The render loop.
 *
 * A number-heavy idle UI updates constantly and has no framework to lean on, so
 * the strategy is simple and strict:
 *
 *  1. Panels build their DOM once and register *bindings* — a node plus a
 *     function that returns what it should say.
 *  2. Every frame, each binding's string is compared to the last one written,
 *     and the DOM is touched only when it differs. Because `formatDecimal` is
 *     stable to three significant figures, a value climbing exponentially still
 *     only changes its rendered form a few times a second, so almost every
 *     frame writes nothing at all.
 *  3. Anything expensive that nobody can perceive at 60fps — affordability
 *     colouring, disabled states — runs at 10Hz instead.
 *
 * Widening the formatter's precision would quietly disable most of this.
 */

const SLOW_INTERVAL_MS = 100;

interface TextBinding {
  node: Node;
  read: () => string;
  last: string | null;
}

interface FlagBinding {
  element: HTMLElement;
  className: string;
  read: () => boolean;
  last: boolean | null;
}

export class Ticker {
  private texts: TextBinding[] = [];
  private flags: FlagBinding[] = [];
  private frame: number | null = null;
  private lastFrameMs = 0;
  private lastSlowMs = 0;

  /** Binds a node's text content to a function. Updated every frame, written rarely. */
  text(node: Node, read: () => string): void {
    this.texts.push({ node, read, last: null });
  }

  /** Binds a class name to a predicate. Evaluated at 10Hz. */
  flag(element: HTMLElement, className: string, read: () => boolean): void {
    this.flags.push({ element, className, read, last: null });
  }

  /** Drops every binding, for when a panel rebuilds its subtree. */
  clear(): void {
    this.texts = [];
    this.flags = [];
  }

  start(onTick: (deltaSeconds: number) => void): void {
    if (this.frame !== null) return;
    this.lastFrameMs = performance.now();

    const loop = (nowMs: number): void => {
      this.frame = requestAnimationFrame(loop);

      // Clamped: a backgrounded tab can deliver a delta of many seconds, and
      // simulating that as one frame is offline progress' job, not the loop's.
      const delta = Math.min((nowMs - this.lastFrameMs) / 1000, 0.25);
      this.lastFrameMs = nowMs;
      if (delta > 0) onTick(delta);

      this.render(nowMs);
    };
    this.frame = requestAnimationFrame(loop);
  }

  stop(): void {
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.frame = null;
  }

  /** Paints immediately, for the first frame and after a structural rebuild. */
  render(nowMs = performance.now()): void {
    for (const binding of this.texts) {
      const next = binding.read();
      if (next === binding.last) continue;
      binding.last = next;
      binding.node.textContent = next;
    }

    if (nowMs - this.lastSlowMs < SLOW_INTERVAL_MS) return;
    this.lastSlowMs = nowMs;

    for (const binding of this.flags) {
      const next = binding.read();
      if (next === binding.last) continue;
      binding.last = next;
      binding.element.classList.toggle(binding.className, next);
    }
  }
}

/** `document.createElement` with the boilerplate folded in. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
