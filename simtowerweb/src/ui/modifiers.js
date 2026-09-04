// Physical Shift/Ctrl key state ↔ game.keys bridge.
// game.keys.shift/ctrl are the single source of truth that game code reads.
// Headless-safe: no DOM access.
//
// ISSUE-040 originally paired this with on-screen sticky Shift/Ctrl chips
// for touch devices (no physical keyboard). Those chips are gone now that
// the mechanics they gated are reachable directly by touch instead: a
// long-press on the toolbox's Lobby slot arms its height (game.js
// lobbyHeight), and a long-press before a batch drag arms grid mode
// (game.js gridDragArmed) — see toolbox.js and input.js.

export function ensureModifierKeys(keys = {}) {
  keys.physShift ??= false;
  keys.physCtrl ??= false;
  return resolveModifierKeys(keys);
}

export function resolveModifierKeys(keys) {
  keys.shift = !!keys.physShift;
  keys.ctrl = !!keys.physCtrl;
  return keys;
}

export function setPhysicalModifier(keys, name, on) {
  if (name === "shift") keys.physShift = !!on;
  else if (name === "ctrl") keys.physCtrl = !!on;
  else return keys;
  return resolveModifierKeys(keys);
}
