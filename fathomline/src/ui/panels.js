// Bottom-sheet (mobile) <-> docked-rail (desktop) panel. Phase 7 adds the
// drag-handle gesture; for now open/close is button-driven, which already
// satisfies "one implementation, `lg:` variants swap the mode via CSS."
// Tailwind's `translate-y-full` moves an element by 100% of *its own*
// height. A closed panel with no body content yet (nothing has opened it,
// so setContent() never ran) is short — just its header — so translating
// by its own height doesn't clear the bottom-16 offset below, and it ends
// up re-covering the tab bar it was supposed to stay clear of. Translating
// by a fixed 100vh instead is unaffected by content height and is always
// enough, since max-h below caps every panel well under the viewport.
const CLOSED_CLASSES = ['translate-y-[100vh]', 'pointer-events-none'];

export function createPanel(root, { title }) {
  const el = document.createElement('div');
  el.className = [
    // bottom-16 (not bottom-0): leaves the tab bar visible and clickable
    // above the sheet instead of the sheet burying it — otherwise tapping a
    // different tab while one panel is open hits the sheet, not the button.
    'fixed inset-x-0 bottom-16 z-20 max-h-[calc(85vh-4rem)] overflow-y-auto overscroll-contain',
    'rounded-t-2xl bg-tide shadow-xl transition-transform duration-200',
    'lg:static lg:translate-y-0 lg:pointer-events-auto lg:max-h-none lg:h-full lg:rounded-none lg:shadow-none lg:border-l lg:border-white/10',
    ...CLOSED_CLASSES,
  ].join(' ');
  el.innerHTML = `
    <div class="flex items-center justify-between px-4 py-3 border-b border-white/10">
      <h2 class="font-semibold">${title}</h2>
      <button data-panel="close" class="text-sm opacity-70 lg:hidden">Close</button>
    </div>
    <div data-panel="body" class="p-4"></div>`;
  root.appendChild(el);

  const body = el.querySelector('[data-panel="body"]');
  el.querySelector('[data-panel="close"]').addEventListener('click', () => api.close());

  const api = {
    el,
    body,
    isOpen: false,
    open() {
      el.classList.remove(...CLOSED_CLASSES);
      api.isOpen = true;
    },
    close() {
      el.classList.add(...CLOSED_CLASSES);
      api.isOpen = false;
    },
    toggle() {
      api.isOpen ? api.close() : api.open();
    },
    setContent(html) {
      body.innerHTML = html;
    },
  };
  return api;
}
