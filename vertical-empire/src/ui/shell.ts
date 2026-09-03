/**
 * The chrome around the canvas: the build bar, the clock, and the one banner
 * that explains where the art comes from.
 *
 * Laid out for a phone held upright. Everything you tap sits in the bottom
 * third, because that is what a thumb reaches.
 */

import { CATEGORIES, FACILITIES, type Facility, type FacilityCategory, type FacilityId } from '../world/facilities.js';

export type Tool = { kind: 'build'; id: FacilityId } | { kind: 'bulldoze' } | { kind: 'look' };

export interface Shell {
  canvas: HTMLCanvasElement;
  /** Called when the player picks a different tool. */
  onToolChange: (handler: (tool: Tool) => void) => void;
  /** Called when the player offers a copy of the game. */
  onArtFile: (handler: (file: File) => void) => void;
  onForgetArt: (handler: () => void) => void;
  /** Fires with the muted state the player just chose. */
  onSoundToggle: (handler: (muted: boolean) => void) => void;
  /** `undefined` hides the control entirely, for an atlas with no sounds. */
  setSound: (muted: boolean | undefined) => void;
  setTool: (tool: Tool) => void;
  setClock: (text: string) => void;
  setStatus: (text: string, tone?: 'plain' | 'warn') => void;
  setArtSource: (source: 'original' | 'fallback') => void;
  /**
   * The rating badge, as ready-made elements.
   *
   * The shell places them and says what they mean; drawing them is the
   * renderer's job, because they are palette-indexed art like everything else.
   */
  setRating: (icons: HTMLElement[], label: string) => void;
}

export function buildShell(root: HTMLElement): Shell {
  root.innerHTML = '';
  root.className = 'app';

  const canvas = document.createElement('canvas');
  canvas.className = 'stage';
  root.append(canvas);

  const hud = document.createElement('div');
  hud.className = 'hud';
  const clock = document.createElement('span');
  clock.className = 'hud-clock';
  const rating = document.createElement('span');
  rating.className = 'hud-rating';
  const status = document.createElement('span');
  status.className = 'hud-status';
  // Sound sits in the HUD rather than the toolbar: it is a property of the
  // whole tower, not a thing you build. Hidden until there is audio to mute —
  // the placeholder art has none, and a dead control is worse than no control.
  const sound = document.createElement('button');
  sound.type = 'button';
  sound.className = 'hud-sound';
  sound.hidden = true;

  hud.append(clock, rating, sound, status);
  root.append(hud);

  // Two rows: what you are doing, then what you can build while doing it.
  const controls = document.createElement('div');
  controls.className = 'controls';
  const tabs = document.createElement('div');
  tabs.className = 'tabs';
  const bar = document.createElement('div');
  bar.className = 'bar';
  controls.append(tabs, bar);
  root.append(controls);

  const toolHandlers: ((tool: Tool) => void)[] = [];
  const buttons = new Map<string, HTMLButtonElement>();

  function toolKey(tool: Tool): string {
    return tool.kind === 'build' ? `build:${tool.id}` : tool.kind;
  }

  function makeButton(tool: Tool, label: string, sub?: string): HTMLButtonElement {
    const button = document.createElement('button');
    button.className = 'tool';
    button.type = 'button';
    button.dataset['tool'] = toolKey(tool);
    button.innerHTML = sub
      ? `<span class="tool-label">${label}</span><span class="tool-sub">${sub}</span>`
      : `<span class="tool-label">${label}</span>`;
    button.addEventListener('click', () => {
      setTool(tool);
      for (const handler of toolHandlers) handler(tool);
    });
    buttons.set(toolKey(tool), button);
    return button;
  }

  // Only groups that have something in them: a drawer that opens onto nothing
  // is worse than no drawer.
  const drawers = CATEGORIES.filter((category) => FACILITIES.some((item) => item.category === category.id));

  // Every button is built once and stays in the page; opening a drawer hides
  // the others rather than rebuilding the row. Buttons that came and went would
  // mean a tool is only clickable when its drawer happens to be open, which is
  // a trap for anything driving this from outside — the screenshot script picks
  // `button[data-tool="build:office"]` straight out of the page.
  bar.append(makeButton({ kind: 'look' }, 'Look'));
  for (const item of FACILITIES) {
    const button = makeButton({ kind: 'build', id: item.id }, item.label, width(item));
    button.dataset['category'] = item.category;
    bar.append(button);
  }
  // Look and Clear bracket the row in every drawer: neither belongs to one.
  bar.append(makeButton({ kind: 'bulldoze' }, 'Clear'));

  const tabButtons = new Map<FacilityCategory, HTMLButtonElement>();

  function showDrawer(id: FacilityCategory): void {
    for (const [name, button] of tabButtons) button.classList.toggle('is-open', name === id);
    for (const button of buttons.values()) {
      const category = button.dataset['category'];
      if (category) button.hidden = category !== id;
    }
  }

  for (const drawer of drawers) {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = 'tab';
    tab.textContent = drawer.label;
    tab.addEventListener('click', () => showDrawer(drawer.id));
    tabButtons.set(drawer.id, tab);
    tabs.append(tab);
  }

  function setTool(tool: Tool): void {
    const key = toolKey(tool);
    for (const [name, button] of buttons) button.classList.toggle('is-active', name === key);
    // Choosing a facility from outside the open drawer opens the drawer holding
    // it, so the highlighted tool is always one you can see.
    if (tool.kind === 'build') {
      const home = FACILITIES.find((item) => item.id === tool.id)?.category;
      if (home) showDrawer(home);
    }
  }

  const firstDrawer = drawers[0]?.id;
  if (firstDrawer) showDrawer(firstDrawer);
  setTool({ kind: 'look' });

  // --- where the art comes from ---------------------------------------------

  const banner = document.createElement('div');
  banner.className = 'art';
  const picker = document.createElement('input');
  picker.type = 'file';
  picker.accept = '.exe,.EXE,application/octet-stream';
  picker.className = 'art-input';
  picker.id = 'art-file';

  const label = document.createElement('label');
  label.className = 'art-button';
  label.htmlFor = 'art-file';
  label.textContent = 'Use my SimTower art';

  const note = document.createElement('p');
  note.className = 'art-note';

  const forget = document.createElement('button');
  forget.type = 'button';
  forget.className = 'art-forget';
  forget.textContent = 'Back to placeholder art';
  forget.hidden = true;

  // The banner sits over the tower, which is the one thing the spike exists to
  // let you look at. Collapsed, it is a single chip in the corner that expands
  // again on a tap.
  const collapse = document.createElement('button');
  collapse.type = 'button';
  collapse.className = 'art-collapse';
  collapse.setAttribute('aria-label', 'Hide the art notice');
  collapse.textContent = '×';

  banner.append(note, label, picker, forget, collapse);
  root.append(banner);

  const reopen = document.createElement('button');
  reopen.type = 'button';
  reopen.className = 'art-chip';
  reopen.textContent = 'Art';
  reopen.hidden = true;
  root.append(reopen);

  function setCollapsed(collapsed: boolean): void {
    banner.hidden = collapsed;
    reopen.hidden = !collapsed;
  }
  collapse.addEventListener('click', () => setCollapsed(true));
  reopen.addEventListener('click', () => setCollapsed(false));

  const fileHandlers: ((file: File) => void)[] = [];
  picker.addEventListener('change', () => {
    const file = picker.files?.[0];
    // Reset, or picking the same file twice in a row fires nothing.
    picker.value = '';
    if (file) for (const handler of fileHandlers) handler(file);
  });

  const soundHandlers: ((muted: boolean) => void)[] = [];
  let muted = false;
  function setSound(state: boolean | undefined): void {
    sound.hidden = state === undefined;
    if (state === undefined) return;
    muted = state;
    sound.textContent = muted ? '🔇' : '🔊';
    const label = muted ? 'Turn sound on' : 'Turn sound off';
    sound.title = label;
    sound.setAttribute('aria-label', label);
    sound.setAttribute('aria-pressed', String(!muted));
  }
  sound.addEventListener('click', () => {
    setSound(!muted);
    for (const handler of soundHandlers) handler(muted);
  });

  const forgetHandlers: (() => void)[] = [];
  forget.addEventListener('click', () => {
    for (const handler of forgetHandlers) handler();
  });

  function setArtSource(source: 'original' | 'fallback'): void {
    banner.dataset['source'] = source;
    if (source === 'original') {
      note.textContent = 'Drawing your own copy of SimTower, read on this device.';
      label.textContent = 'Use a different copy';
      forget.hidden = false;
      reopen.textContent = 'Your art';
    } else {
      note.textContent =
        'Placeholder art, drawn to SimTower’s 8×36 grid. The original art can’t be shipped — point this at your own SIMTOWER.EXE and it stays on your device.';
      label.textContent = 'Use my SimTower art';
      forget.hidden = true;
      reopen.textContent = 'Art';
    }
  }
  setArtSource('fallback');

  return {
    canvas,
    onToolChange: (handler) => toolHandlers.push(handler),
    onArtFile: (handler) => fileHandlers.push(handler),
    onForgetArt: (handler) => forgetHandlers.push(handler),
    onSoundToggle: (handler) => soundHandlers.push(handler),
    setSound,
    setTool,
    setClock: (text) => {
      clock.textContent = text;
    },
    setStatus: (text, tone = 'plain') => {
      status.textContent = text;
      status.dataset['tone'] = tone;
    },
    setArtSource,
    setRating: (icons, label) => {
      rating.replaceChildren(...icons);
      rating.title = label;
      rating.setAttribute('aria-label', label);
      rating.hidden = icons.length === 0;
    },
  };
}

function width(item: Facility): string {
  return `${item.width}×1`;
}
