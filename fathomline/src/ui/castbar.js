export function mountCastbar(container) {
  container.innerHTML = `
    <div class="px-4 pb-3 pt-2">
      <button data-castbar="button"
        class="w-full min-h-[64px] rounded-2xl bg-coin text-deep font-bold text-lg active:scale-[0.98] transition-transform select-none">
        CAST
      </button>
      <div data-castbar="caption" class="mt-1 text-center text-xs opacity-70 h-4"></div>
    </div>`;
  const button = container.querySelector('[data-castbar="button"]');
  const caption = container.querySelector('[data-castbar="caption"]');
  return {
    button,
    setLabel(text) {
      button.textContent = text;
    },
    setCaption(text) {
      caption.textContent = text ?? '';
    },
    setEnabled(enabled) {
      button.disabled = !enabled;
      button.classList.toggle('opacity-50', !enabled);
    },
  };
}
