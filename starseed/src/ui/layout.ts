import type { Store } from '../state/store';
import { Ticker, el } from './ticker';
import { renderResources } from './resources';
import { renderSwarm } from './swarm';
import { renderTech } from './tech';
import { renderLog } from './log';
import { renderPrestige } from './prestige';
import { mountModal } from './modal';
import { mountToasts, toast } from './toast';

export type PanelId = 'swarm' | 'tech' | 'log' | 'prestige';

const PANELS: Array<{ id: PanelId; label: string; icon: string }> = [
  { id: 'swarm', label: 'Swarm', icon: '🛰️' },
  { id: 'tech', label: 'Tech', icon: '🔬' },
  { id: 'log', label: 'Log', icon: '📖' },
  { id: 'prestige', label: 'Relaunch', icon: '📐' },
];

/**
 * The shell, and the breakpoint.
 *
 * The 700px switch is applied live through `matchMedia` rather than only at
 * load, because a foldable changes viewport width without reloading the page:
 * folding the phone shut has to reshape the layout, not orphan half of it
 * off-screen.
 *
 * Below 700px one panel shows at a time behind a tab bar; at 700px and up all
 * three sit side by side and the tabs are irrelevant.
 */
export class Layout {
  private readonly ticker = new Ticker();
  private active: PanelId = 'swarm';
  private readonly panels = new Map<PanelId, HTMLElement>();
  private rail!: HTMLElement;
  private tabs!: HTMLElement;

  constructor(
    private readonly store: Store,
    private readonly root: HTMLElement,
  ) {}

  mount(): Ticker {
    this.root.replaceChildren();
    this.root.classList.add('app');

    this.rail = el('header', 'rail');
    this.root.append(this.rail);

    const main = el('main', 'panels');
    for (const panel of PANELS) {
      const section = el('section', 'panel');
      section.dataset['panel'] = panel.id;
      this.panels.set(panel.id, section);
      main.append(section);
    }
    this.root.append(main);

    const mine = el('button', 'mine');
    mine.type = 'button';
    mine.textContent = '⛏️ Mine';
    mine.addEventListener('click', () => {
      this.store.tap();
      this.ticker.render();
    });
    this.root.append(mine);
    // The manual tap disappears the moment the Auto-Miner replaces it: leaving
    // a button that is strictly worse than the automation you just bought
    // undercuts the reward.
    this.ticker.flag(mine, 'is-hidden', () => this.store.get().automation.includes('auto-miner'));

    this.tabs = el('nav', 'tabs');
    for (const panel of PANELS) {
      const tab = el('button', 'tab');
      tab.type = 'button';
      tab.append(el('span', 'tab-icon', panel.icon), el('span', 'tab-label', panel.label));
      tab.addEventListener('click', () => this.show(panel.id));
      this.ticker.flag(tab, 'is-active', () => this.active === panel.id);
      if (panel.id === 'prestige') {
        this.ticker.flag(tab, 'is-hidden', () => !this.prestigeRevealed());
      }
      this.tabs.append(tab);
    }
    this.root.append(this.tabs);

    mountModal(this.root);
    mountToasts(this.root);
    this.watchBreakpoint();
    this.rebuild();
    this.store.subscribe(() => this.rebuild());
    return this.ticker;
  }

  /**
   * Prestige stays hidden until it is nearly in reach.
   *
   * Showing a Relaunch tab in the first ten minutes would spoil the shape of
   * the game and offer a button that only says no; a tenth of the way to the
   * threshold is late enough to be a promise rather than a tease, and it never
   * hides again once a run has been ended.
   */
  private prestigeRevealed(): boolean {
    const state = this.store.get();
    if (state.prestige.relaunches > 0 || state.prestige.schematics.isPositive) return true;
    return this.store.runValue().gte(this.store.valueForFirstSchematics().mulNumber(0.1));
  }

  show(panel: PanelId): void {
    this.active = panel;
    this.root.dataset['active'] = panel;
    this.ticker.render();
  }

  /**
   * Rebuilds every panel's DOM and re-registers its bindings.
   *
   * Called only on structural change — something unlocked or was bought — never
   * on the numbers moving. Those are handled by the bindings, sixty times a
   * second, without touching the tree.
   */
  private rebuild(): void {
    this.ticker.clear();
    renderResources(this.store, this.ticker, this.rail);
    renderSwarm(this.store, this.ticker, this.panels.get('swarm')!);
    renderTech(this.store, this.ticker, this.panels.get('tech')!);
    renderLog(this.store, this.ticker, this.panels.get('log')!);
    renderPrestige(this.store, this.ticker, this.panels.get('prestige')!);

    // Bindings registered before mount() finished are gone after a clear, so
    // the shell's own re-register here.
    const mine = this.root.querySelector<HTMLElement>('.mine');
    if (mine) {
      this.ticker.flag(mine, 'is-hidden', () =>
        this.store.get().automation.includes('auto-miner'),
      );
    }
    for (const [index, tab] of [...this.tabs.children].entries()) {
      const panel = PANELS[index];
      if (!panel) continue;
      this.ticker.flag(tab as HTMLElement, 'is-active', () => this.active === panel.id);
      if (panel.id === 'prestige') {
        this.ticker.flag(tab as HTMLElement, 'is-hidden', () => !this.prestigeRevealed());
      }
    }
    this.root.classList.toggle('has-prestige', this.prestigeRevealed());

    this.ticker.render();
  }

  private watchBreakpoint(): void {
    const wide = window.matchMedia('(min-width: 700px)');
    const apply = (): void => {
      this.root.classList.toggle('is-wide', wide.matches);
    };
    apply();
    wide.addEventListener('change', apply);
    this.show(this.active);
  }
}

export { toast };
