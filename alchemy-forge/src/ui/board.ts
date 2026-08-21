import { activeIndex } from '../data/index';
import type { Element } from '../data/types';
import { store } from '../state/store';
import type { Token } from '../state/types';
import { play } from '../audio/sfx';
import { attachGesture, type Point } from './gesture';
import { iconSpan } from './icons';
import { TOKEN_SIZE, centerPixels, toFractions, toPixels, type LayoutWatcher } from './layout';
import { toastDiscovery } from './toast';

/** How close two token centres must be for a drop to count as a combination. */
const SNAP_RADIUS = TOKEN_SIZE * 0.8;

interface DragState {
  uid: number;
  element: HTMLElement;
  /** Pointer offset from the token's centre, so it does not jump on grab. */
  grabOffset: Point;
  /** Board-relative centre the token is currently drawn at. */
  center: Point;
  target: HTMLElement | null;
}

export class Board {
  private readonly nodes = new Map<number, HTMLElement>();
  private drag: DragState | null = null;

  constructor(
    private readonly root: HTMLElement,
    private readonly trash: HTMLElement,
    private readonly layout: LayoutWatcher,
    private readonly onInspect: (elementId: string) => void,
  ) {}

  init(): void {
    this.render();
    store.subscribe(() => this.render());
    // A resize does not change any token's stored position, only where those
    // fractions land in pixels — so reposition without rebuilding the DOM.
    this.layout.subscribe(() => this.reposition());
  }

  /** Drops a new token onto the board at a point in client coordinates. */
  spawnAt(elementId: string, clientX: number, clientY: number): void {
    const rect = this.root.getBoundingClientRect();
    const { fx, fy } = toFractions(
      clientX - rect.left,
      clientY - rect.top,
      this.layout.getSize(),
    );
    store.addToken(elementId, fx, fy);
  }

  /** Drops a new token somewhere sensible without the player aiming. */
  spawnCentered(elementId: string): void {
    // A little scatter so repeated taps do not stack into one pile.
    const fx = 0.5 + (Math.random() - 0.5) * 0.34;
    const fy = 0.45 + (Math.random() - 0.5) * 0.28;
    store.addToken(elementId, fx, fy);
  }

  /** True when the point is over the board area. */
  containsPoint(clientX: number, clientY: number): boolean {
    const rect = this.root.getBoundingClientRect();
    return (
      clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom
    );
  }

  // --- Rendering -----------------------------------------------------------

  private render(): void {
    const tokens = store.get().tokens;
    const seen = new Set<number>();

    for (const token of tokens) {
      seen.add(token.uid);
      let node = this.nodes.get(token.uid);
      if (!node) {
        node = this.createToken(token);
        this.nodes.set(token.uid, node);
        this.root.append(node);
      }
      this.place(node, token);
    }

    for (const [uid, node] of this.nodes) {
      if (seen.has(uid)) continue;
      node.remove();
      this.nodes.delete(uid);
    }

    this.root.classList.toggle('has-tokens', tokens.length > 0);
  }

  private reposition(): void {
    for (const token of store.get().tokens) {
      const node = this.nodes.get(token.uid);
      if (node && node !== this.drag?.element) this.place(node, token);
    }
  }

  private place(node: HTMLElement, token: Token): void {
    const { x, y } = toPixels(token.fx, token.fy, this.layout.getSize());
    node.style.left = `${x}px`;
    node.style.top = `${y}px`;
    node.style.transform = '';
  }

  private createToken(token: Token): HTMLElement {
    const element = activeIndex().byId.get(token.elementId);
    const node = document.createElement('div');
    node.className = 'token';
    node.dataset['uid'] = String(token.uid);
    node.dataset['elementId'] = token.elementId;

    if (element) {
      node.append(iconSpan(element, 'token-emoji'));
      const name = document.createElement('span');
      name.className = 'token-name';
      name.textContent = element.name;
      node.append(name);
      node.setAttribute('aria-label', element.name);
    }

    this.attachTokenGestures(node, token.uid, token.elementId);
    return node;
  }

  // --- Interaction ---------------------------------------------------------

  private attachTokenGestures(node: HTMLElement, uid: number, elementId: string): void {
    attachGesture(node, {
      // Tapping an element on the board duplicates it, which is far quicker
      // than going back to the inventory for the second copy.
      onTap: () => {
        const token = store.get().tokens.find((candidate) => candidate.uid === uid);
        if (!token) return;
        play('pick');
        store.addToken(elementId, clamp01(token.fx + 0.11), clamp01(token.fy + 0.06));
      },
      onLongPress: () => this.onInspect(elementId),
      onDragStart: (point) => this.beginDrag(node, uid, point),
      onDragMove: (point) => this.moveDrag(point),
      onDragEnd: (point) => this.endDrag(point),
    });
  }

  private beginDrag(node: HTMLElement, uid: number, grabPoint: Point): void {
    const token = store.get().tokens.find((candidate) => candidate.uid === uid);
    if (!token) return;

    const rect = this.root.getBoundingClientRect();
    const center = centerPixels(token.fx, token.fy, this.layout.getSize());

    // Keep the token where it was relative to the finger, so grabbing a corner
    // does not snap the token's centre under the touch point.
    const grabOffset = {
      x: grabPoint.x - rect.left - center.x,
      y: grabPoint.y - rect.top - center.y,
    };

    node.classList.add('is-dragging');
    this.root.classList.add('is-dragging');

    this.drag = { uid, element: node, grabOffset, center, target: null };
  }

  private moveDrag(point: Point): void {
    if (!this.drag) return;

    const rect = this.root.getBoundingClientRect();
    const center = {
      x: point.x - rect.left - this.drag.grabOffset.x,
      y: point.y - rect.top - this.drag.grabOffset.y,
    };
    this.drag.center = center;

    this.drag.element.style.left = `${center.x - TOKEN_SIZE / 2}px`;
    this.drag.element.style.top = `${center.y - TOKEN_SIZE / 2}px`;

    this.updateDropTarget(point);
  }

  private updateDropTarget(point: Point): void {
    if (!this.drag) return;

    const overTrash = this.isOverTrash(point);
    this.trash.classList.toggle('is-target', overTrash);

    const candidate = overTrash ? null : this.findTokenUnder(this.drag.center, this.drag.uid);
    if (candidate === this.drag.target) return;

    this.drag.target?.classList.remove('is-target');
    candidate?.classList.add('is-target');
    this.drag.target = candidate;
  }

  private endDrag(point: Point): void {
    const drag = this.drag;
    if (!drag) return;
    this.drag = null;

    drag.element.classList.remove('is-dragging');
    this.root.classList.remove('is-dragging');
    drag.target?.classList.remove('is-target');
    this.trash.classList.remove('is-target');

    if (this.isOverTrash(point)) {
      store.removeToken(drag.uid);
      play('pick');
      return;
    }

    // Commit the new position first: whether or not a combination happens,
    // this is where the player put it.
    const { fx, fy } = toFractions(drag.center.x, drag.center.y, this.layout.getSize());
    store.moveToken(drag.uid, fx, fy);

    if (!drag.target) return;

    const targetUid = Number(drag.target.dataset['uid']);
    const result = store.combineTokens(drag.uid, targetUid);

    if (result.kind === 'none') {
      this.rejectAt(drag.uid);
      play('reject');
      return;
    }

    if (result.discoveries.length > 0) {
      play('discover');
      for (const id of result.discoveries) {
        const element = activeIndex().byId.get(id);
        if (element) toastDiscovery(element);
      }
      this.flagNewTokens(result.discoveries);
    } else {
      play('combine');
    }
  }

  /** Marks freshly discovered tokens so they render with the highlight once. */
  private flagNewTokens(discoveries: readonly string[]): void {
    const wanted = new Set(discoveries);
    for (const token of store.get().tokens) {
      if (!wanted.has(token.elementId)) continue;
      const node = this.nodes.get(token.uid);
      node?.classList.add('is-new');
      setTimeout(() => node?.classList.remove('is-new'), 1400);
    }
  }

  private rejectAt(uid: number): void {
    const node = this.nodes.get(uid);
    if (!node) return;
    node.classList.remove('is-rejected');
    // Force a reflow so the animation restarts on a repeated failed drop.
    void node.offsetWidth;
    node.classList.add('is-rejected');
    node.addEventListener('animationend', () => node.classList.remove('is-rejected'), {
      once: true,
    });
  }

  private isOverTrash(point: Point): boolean {
    const rect = this.trash.getBoundingClientRect();
    return (
      point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom
    );
  }

  /** Nearest other token whose centre is within the snap radius. */
  private findTokenUnder(center: Point, ignoreUid: number): HTMLElement | null {
    const board = this.layout.getSize();
    let best: HTMLElement | null = null;
    let bestDistance = SNAP_RADIUS;

    for (const token of store.get().tokens) {
      if (token.uid === ignoreUid) continue;
      const node = this.nodes.get(token.uid);
      if (!node) continue;

      const other = centerPixels(token.fx, token.fy, board);
      const distance = Math.hypot(other.x - center.x, other.y - center.y);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = node;
      }
    }

    return best;
  }
}

/** Convenience for callers building an ad-hoc element badge. */
export function elementLabel(element: Element | undefined, fallback: string): string {
  return element?.name ?? fallback;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
