/**
 * A button that puts the game fullscreen, hiding the browser's address bar
 * and system bars on a phone, and takes it out again.
 *
 * Uses the Fullscreen API, with the `webkit` prefix older Safari on iPad
 * needs. iPhone Safari only lets videos go fullscreen, so where the API is
 * missing the button is simply not shown.
 */
import { h } from './dom';

type Prefixed = Document & {
  webkitFullscreenEnabled?: boolean;
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void>;
};
type PrefixedElement = HTMLElement & { webkitRequestFullscreen?: (options?: FullscreenOptions) => Promise<void> };

const doc = document as Prefixed;

export function fullscreenSupported(): boolean {
  return Boolean(doc.fullscreenEnabled || doc.webkitFullscreenEnabled);
}

export function isFullscreen(): boolean {
  return Boolean(doc.fullscreenElement ?? doc.webkitFullscreenElement);
}

export async function toggleFullscreen(): Promise<void> {
  try {
    if (isFullscreen()) {
      await (doc.exitFullscreen ? doc.exitFullscreen() : doc.webkitExitFullscreen?.());
      return;
    }
    const root = document.documentElement as PrefixedElement;
    const options: FullscreenOptions = { navigationUI: 'hide' };
    await (root.requestFullscreen ? root.requestFullscreen(options) : root.webkitRequestFullscreen?.(options));
  } catch {
    // Refused (not from a tap, or blocked by the browser): stay as we are.
  }
}

const ENTER = 'M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5';
const EXIT = 'M9 4v5H4M20 9h-5V4M15 20v-5h5M4 15h5v5';

/** The icon: corners pointing out to go fullscreen, in to come back. */
function icon(path: string): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'fullscreen-icon');
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  p.setAttribute('d', path);
  svg.append(p);
  return svg;
}

/** A toggle button, or null where fullscreen is not available. `className` picks the button style. */
export function fullscreenButton(className: string, onClick: () => void = () => undefined): HTMLButtonElement | null {
  if (!fullscreenSupported()) return null;
  const button = h('button', { className: `${className} fullscreen-button` });
  const draw = (): void => {
    const on = isFullscreen();
    button.replaceChildren(icon(on ? EXIT : ENTER));
    button.setAttribute('aria-label', on ? 'Exit full screen' : 'Full screen');
  };
  const onChange = (): void => {
    // Screens are rebuilt often; a button no longer on the page stops listening.
    if (!button.isConnected) {
      document.removeEventListener('fullscreenchange', onChange);
      document.removeEventListener('webkitfullscreenchange', onChange);
      return;
    }
    draw();
  };
  document.addEventListener('fullscreenchange', onChange);
  document.addEventListener('webkitfullscreenchange', onChange);
  button.addEventListener('click', () => {
    onClick();
    void toggleFullscreen();
  });
  draw();
  return button;
}
