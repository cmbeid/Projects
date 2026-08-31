// Recent-catches feed — makes idle crew production visible instead of silent.
export function renderLog(entries) {
  if (entries.length === 0) return `<div class="opacity-60 text-sm">Nothing caught yet.</div>`;
  return entries
    .slice()
    .reverse()
    .map((e) => `<div class="py-1.5 border-b border-white/5 text-sm">${e}</div>`)
    .join('');
}
