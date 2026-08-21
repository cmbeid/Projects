import { activeIndex } from '../data/index';
import { store } from '../state/store';
import { play, primeAudio } from '../audio/sfx';
import type { Board } from './board';
import { attachGesture, type Point } from './gesture';
import { iconSpan } from './icons';
import { TOKEN_SIZE, type LayoutWatcher } from './layout';

interface Refs {
  root: HTMLElement;
  handle: HTMLButtonElement;
  label: HTMLElement;
  grid: HTMLElement;
  empty: HTMLElement;
  search: HTMLInputElement;
  dragLayer: HTMLElement;
}

/**
 * The list of discovered elements.
 *
 * One component serves both layouts: a bottom drawer on a narrow screen and a
 * permanent sidebar on a wide one. The difference is entirely CSS driven by
 * `data-layout`, so behaviour cannot drift between the two.
 */
export class Inventory {
  private query = '';
  private open = false;
  private ghost: HTMLElement | null = null;

  constructor(
    private readonly refs: Refs,
    private readonly layout: LayoutWatcher,
    private readonly board: Board,
    private readonly onInspect: (elementId: string) => void,
  ) {}

  init(): void {
    this.refs.search.addEventListener('input', () => {
      this.query = this.refs.search.value.trim().toLowerCase();
      this.render();
    });

    this.refs.handle.addEventListener('click', () => this.toggle());

    store.subscribe(() => this.render());
    this.layout.subscribe(() => this.syncDrawerState());

    this.syncDrawerState();
    this.render();
  }

  private toggle(): void {
    if (this.layout.getMode() === 'expanded') return;
    this.open = !this.open;
    this.syncDrawerState();
    // Reaching for the drawer is usually a prelude to searching.
    if (this.open) this.refs.search.focus({ preventScroll: true });
  }

  private syncDrawerState(): void {
    const expanded = this.layout.getMode() === 'expanded' || this.open;
    this.refs.root.classList.toggle('is-open', this.open);
    this.refs.handle.setAttribute('aria-expanded', String(expanded));
  }

  private render(): void {
    const discovered = store.get().discovered;
    const matches = discovered
      .map((id) => activeIndex().byId.get(id))
      .filter((element): element is NonNullable<typeof element> => element !== undefined)
      .filter((element) => !this.query || element.name.toLowerCase().includes(this.query));

    // Alphabetical: with hundreds of elements, discovery order stops being a
    // way anyone can find anything.
    matches.sort((a, b) => a.name.localeCompare(b.name));

    const fragment = document.createDocumentFragment();
    for (const element of matches) {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'inv-item';
      item.dataset['elementId'] = element.id;

      const isFinal = activeIndex().finalIds.has(element.id);
      if (isFinal) {
        item.classList.add('is-final');
        item.title = `${element.name} — final element`;
      }

      item.append(iconSpan(element, 'inv-emoji'));
      const name = document.createElement('span');
      name.className = 'inv-name';
      name.textContent = element.name;
      item.append(name);
      item.setAttribute(
        'aria-label',
        isFinal ? `${element.name}, final element` : element.name,
      );

      this.attachItemGestures(item, element.id);
      fragment.append(item);
    }

    this.refs.grid.replaceChildren(fragment);
    this.refs.empty.hidden = matches.length > 0;
    this.refs.label.textContent = this.query
      ? `${matches.length} of ${discovered.length}`
      : `Elements · ${discovered.length}`;
  }

  private attachItemGestures(item: HTMLElement, elementId: string): void {
    attachGesture(item, {
      onTap: () => {
        primeAudio();
        play('pick');
        this.board.spawnCentered(elementId);
      },
      onLongPress: () => this.onInspect(elementId),
      onDragStart: (point) => this.beginGhost(elementId, point),
      onDragMove: (point) => this.moveGhost(point),
      onDragEnd: (point) => this.endGhost(elementId, point),
    });
  }

  // --- Drag out of the list ------------------------------------------------

  /**
   * Dragging from the list uses a floating copy rather than moving the list
   * item itself, so the list keeps its layout and can still scroll underneath.
   */
  private beginGhost(elementId: string, point: Point): void {
    const element = activeIndex().byId.get(elementId);
    if (!element) return;

    primeAudio();

    const ghost = document.createElement('div');
    ghost.className = 'drag-ghost';
    ghost.append(iconSpan(element, 'token-emoji'));

    const name = document.createElement('span');
    name.className = 'token-name';
    name.textContent = element.name;
    ghost.append(name);

    this.refs.dragLayer.append(ghost);
    this.ghost = ghost;
    this.moveGhost(point);
  }

  private moveGhost(point: Point): void {
    if (!this.ghost) return;
    this.ghost.style.left = `${point.x - TOKEN_SIZE / 2}px`;
    this.ghost.style.top = `${point.y - TOKEN_SIZE / 2}px`;
  }

  private endGhost(elementId: string, point: Point): void {
    this.ghost?.remove();
    this.ghost = null;

    if (!this.board.containsPoint(point.x, point.y)) return;
    play('pick');
    this.board.spawnAt(elementId, point.x, point.y);
  }
}
