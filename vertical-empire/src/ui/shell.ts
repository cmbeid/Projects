/**
 * The chrome around the canvas: the build bar, the clock, and the one banner
 * that explains where the art comes from.
 *
 * Laid out for a phone held upright. Everything you tap sits in the bottom
 * third, because that is what a thumb reaches.
 */

import { FACILITIES, type Facility, type FacilityId } from '../world/facilities.js';

export type Tool = { kind: 'build'; id: FacilityId } | { kind: 'bulldoze' } | { kind: 'look' };

export interface Shell {
  canvas: HTMLCanvasElement;
  /** Called when the player picks a different tool. */
  onToolChange: (handler: (tool: Tool) => void) => void;
  /** Called when the player offers a copy of the game. */
  onArtFile: (handler: (file: File) => void) => void;
  onForgetArt: (handler: () => void) => void;
  setTool: (tool: Tool) => void;
  setClock: (text: string) => void;
  setStatus: (text: string, tone?: 'plain' | 'warn') => void;
  setArtSource: (source: 'original' | 'fallback') => void;
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
  const status = document.createElement('span');
  status.className = 'hud-status';
  hud.append(clock, status);
  root.append(hud);

  const bar = document.createElement('div');
  bar.className = 'bar';
  root.append(bar);

  const toolHandlers: ((tool: Tool) => void)[] = [];
  const buttons = new Map<string, HTMLButtonElement>();

  function toolKey(tool: Tool): string {
    return tool.kind === 'build' ? `build:${tool.id}` : tool.kind;
  }

  function addButton(tool: Tool, label: string, sub?: string): void {
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
    bar.append(button);
  }

  addButton({ kind: 'look' }, 'Look');
  for (const item of FACILITIES) addButton({ kind: 'build', id: item.id }, item.label, width(item));
  addButton({ kind: 'bulldoze' }, 'Clear');

  function setTool(tool: Tool): void {
    const key = toolKey(tool);
    for (const [name, button] of buttons) button.classList.toggle('is-active', name === key);
  }
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
    setTool,
    setClock: (text) => {
      clock.textContent = text;
    },
    setStatus: (text, tone = 'plain') => {
      status.textContent = text;
      status.dataset['tone'] = tone;
    },
    setArtSource,
  };
}

function width(item: Facility): string {
  return `${item.width}×1`;
}
