/** Shared app state and plumbing: the save, which screen is showing, toasts and modals. */
import { setMuted, setVolumes, sfx, unlock } from '../audio/index';
import { setHaptics } from '../audio/events';
import { loadProgress, type Progress, saveProgress } from '../state/save';
import { h } from './dom';

let progress: Progress = loadProgress();
let cleanup: (() => void) | null = null;

export function getProgress(): Progress {
  return progress;
}

export function setProgress(next: Progress): void {
  progress = next;
  saveProgress(progress);
  applySettings();
}

export function applySettings(): void {
  setVolumes(progress.volumes);
  setMuted(progress.muted);
  setHaptics(progress.haptics);
}

/** Replace the whole screen. `dispose` runs when the next screen replaces it. */
export function mount(el: HTMLElement, dispose?: () => void): void {
  cleanup?.();
  cleanup = dispose ?? null;
  const root = document.getElementById('app')!;
  root.replaceChildren(el);
  closeModal();
}

let modalEl: HTMLElement | null = null;

export function modal(content: HTMLElement, opts: { dismissable?: boolean; onClose?: () => void } = {}): () => void {
  closeModal();
  const back = h('div.modal-back', {
    onclick: (ev: Event) => {
      if (ev.target === back && opts.dismissable !== false) close();
    },
  }, content);
  content.classList.add('modal');
  document.body.append(back);
  modalEl = back;
  const close = (): void => {
    if (modalEl === back) modalEl = null;
    back.remove();
    opts.onClose?.();
  };
  return close;
}

export function closeModal(): void {
  modalEl?.remove();
  modalEl = null;
}

export function modalOpen(): boolean {
  return modalEl !== null;
}

export function toast(text: string): void {
  const el = h('div.toast', {}, text);
  document.body.append(el);
  setTimeout(() => el.remove(), 2700);
}

/** A button that clicks. */
export function button(spec: string, label: string | Node, onclick: () => void, props: Record<string, unknown> = {}): HTMLButtonElement {
  return h(`button.${spec}` as 'button', {
    ...props,
    onclick: () => {
      unlock();
      sfx.click();
      onclick();
    },
  }, label);
}
