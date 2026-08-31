// Tiny pub/sub bus so systems can emit events (fish caught, coin earned,
// codex discovery, ...) without importing UI modules directly.
export function createEventBus() {
  const listeners = new Map();
  return {
    on(event, fn) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event).add(fn);
      return () => listeners.get(event)?.delete(fn);
    },
    emit(event, payload) {
      listeners.get(event)?.forEach((fn) => fn(payload));
    },
  };
}
