// Save logic for RuneScape: Dragonwilds character files
// (%LOCALAPPDATA%\RSDragonwilds\Saved\SaveCharacters\<Name>.json).
//
// A classic script rather than a module, so index.html still works when it is
// opened straight from disk (file:// refuses module scripts), and Node can
// require it for the tests.
(function (root) {
  'use strict';

  // Loadout slots that hold the item itself. 5-8 (weapon, shield, ammo,
  // amulet) instead point at an inventory slot through
  // PlayerInventoryItemIndex, so they are left alone here.
  const WEARABLE_SLOTS = { 0: 'Head', 1: 'Body', 2: 'Legs', 3: 'Cape', 4: 'Ring' };
  const CAPE_SLOT = 3;

  // Action bar is 0-7, the main bag 8-31. An unequipped item goes back into
  // the first free one of these.
  const BAG_SLOTS = Array.from({ length: 32 }, (_, i) => i);

  // Newer saves (Version 80-something on) keep Inventory and Loadout under
  // GameProgress; older ones have them at the top level.
  function progress(save) {
    return save.GameProgress && save.GameProgress.Inventory ? save.GameProgress : save;
  }

  function parse(text) {
    const save = JSON.parse(text.replace(/^﻿/, ''));
    const p = save && typeof save === 'object' ? progress(save) : null;
    if (!p || !p.Inventory || !p.Loadout) {
      throw new Error('This is not a Dragonwilds character file: it has no Inventory or Loadout.');
    }
    return save;
  }

  // Numbers as C's printf("%.17g"), which is how the game writes them:
  // 17 significant digits, trailing zeros dropped, exponent form outside
  // 1e-4..1e17 with at least two exponent digits.
  function formatNumber(n) {
    if (!Number.isFinite(n)) return '0';
    if (n === 0) return Object.is(n, -0) ? '-0' : '0';
    const [mant, expPart] = n.toExponential(16).split('e');
    const exp = Number(expPart);
    const trim = (str) => (str.includes('.') ? str.replace(/0+$/, '').replace(/\.$/, '') : str);
    if (exp < -4 || exp >= 17) {
      const sign = exp < 0 ? '-' : '+';
      return trim(mant) + 'e' + sign + String(Math.abs(exp)).padStart(2, '0');
    }
    return trim(n.toFixed(Math.max(0, 16 - exp)));
  }

  // Pretty-prints the way the game does, so an edited save differs from the
  // original only where it was edited: tab indents, an object's opening brace
  // on its own line under its key, arrays opening on the key's line, arrays
  // of numbers on one line as [ 1, 2 ], and empty arrays as [].
  function stringify(value, indent, eol) {
    const pad = '\t'.repeat(indent);
    const inner = '\t'.repeat(indent + 1);
    if (value === null) return 'null';
    if (typeof value === 'number') return formatNumber(value);
    if (typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) {
      if (!value.length) return '[]';
      if (value.every((v) => typeof v === 'number')) return '[ ' + value.map(formatNumber).join(', ') + ' ]';
      const items = value.map((v) => inner + stringify(v, indent + 1, eol));
      return '[' + eol + items.join(',' + eol) + eol + pad + ']';
    }
    const entries = Object.keys(value).map((k) => {
      const v = value[k];
      const key = inner + JSON.stringify(k) + ':';
      return v && typeof v === 'object' && !Array.isArray(v)
        ? key + eol + inner + stringify(v, indent + 1, eol)
        : key + ' ' + stringify(v, indent + 1, eol);
    });
    return '{' + eol + entries.join(',' + eol) + (entries.length ? eol : '') + pad + '}';
  }

  // Keeps the original's line endings and trailing newline too.
  function serialize(save, originalText) {
    const original = originalText || '';
    const eol = original.includes('\r\n') ? '\r\n' : '\n';
    let text = stringify(save, 0, eol);
    if (/\r?\n$/.test(original)) text += eol;
    return text;
  }

  function slotKeys(container) {
    return Object.keys(container)
      .filter((k) => /^\d+$/.test(k) && container[k] && typeof container[k] === 'object')
      .map(Number)
      .sort((a, b) => a - b);
  }

  function inventoryItems(save) {
    const inv = progress(save).Inventory;
    return slotKeys(inv).map((slot) => ({ slot, item: inv[slot] }));
  }

  function loadoutItems(save) {
    const loadout = progress(save).Loadout;
    return slotKeys(loadout).map((slot) => ({ slot, item: loadout[slot] }));
  }

  function bumpMaxSlot(container, slot) {
    if (typeof container.MaxSlotIndex === 'number' && slot > container.MaxSlotIndex) {
      container.MaxSlotIndex = slot;
    }
  }

  // Moves the item in inventory slot `invSlot` into wearable loadout slot
  // `loadoutSlot`. Whatever was worn there takes the item's old inventory
  // slot, so nothing is lost and no slot is shared.
  function equip(save, invSlot, loadoutSlot) {
    if (!(loadoutSlot in WEARABLE_SLOTS)) {
      throw new Error(`Loadout slot ${loadoutSlot} is not a wearable slot.`);
    }
    const { Inventory, Loadout } = progress(save);
    const item = Inventory[invSlot];
    if (!item || !item.ItemData) throw new Error(`Inventory slot ${invSlot} is empty.`);
    const previous = Loadout[loadoutSlot];

    Loadout[loadoutSlot] = item;
    bumpMaxSlot(Loadout, loadoutSlot);
    if (previous && previous.ItemData) {
      Inventory[invSlot] = previous;
    } else {
      delete Inventory[invSlot];
    }
    return { equipped: item, unequipped: previous && previous.ItemData ? previous : null };
  }

  function firstFreeBagSlot(save) {
    const inv = progress(save).Inventory;
    return BAG_SLOTS.find((s) => !(inv[s] && inv[s].ItemData));
  }

  // Takes the item off wearable loadout slot `loadoutSlot` and puts it in the
  // first free bag slot.
  function unequip(save, loadoutSlot) {
    if (!(loadoutSlot in WEARABLE_SLOTS)) {
      throw new Error(`Loadout slot ${loadoutSlot} is not a wearable slot.`);
    }
    const { Inventory, Loadout } = progress(save);
    const item = Loadout[loadoutSlot];
    if (!item || !item.ItemData) throw new Error(`Nothing is worn in the ${WEARABLE_SLOTS[loadoutSlot]} slot.`);
    const slot = firstFreeBagSlot(save);
    if (slot === undefined) throw new Error('Your bag and action bar are full; free a slot first.');
    Inventory[slot] = item;
    bumpMaxSlot(Inventory, slot);
    delete Loadout[loadoutSlot];
    return { slot, item };
  }

  // Item entries are { GUID, ItemData, Durability?, NumUpgradesApplied?,
  // Count?, AddedToInventoryTimestamp } in that order. The game writes Count
  // only for stacks of more than one, Durability only on gear that wears, and
  // neither on capes.
  const CONTAINERS = ['Inventory', 'Loadout'];

  function entryAt(save, where, slot) {
    if (!CONTAINERS.includes(where)) throw new Error(`Unknown container ${where}.`);
    const container = progress(save)[where];
    const item = container[slot];
    if (!item || !item.ItemData) throw new Error(`${where} slot ${slot} is empty.`);
    return { container, item };
  }

  // Rebuilds the entry with `key` set, placed before the first of `before`
  // that is present, so new keys land where the game would write them.
  function withKey(item, key, value, before) {
    if (key in item) return Object.assign(item, { [key]: value });
    const at = before.find((k) => k in item);
    const out = {};
    for (const k of Object.keys(item)) {
      if (k === at) out[key] = value;
      out[k] = item[k];
    }
    if (!at) out[key] = value;
    return out;
  }

  function wholeNumber(n, min, what) {
    if (!Number.isInteger(n) || n < min) throw new Error(`${what} must be a whole number of at least ${min}.`);
  }

  function setCount(save, where, slot, count) {
    wholeNumber(count, 1, 'Count');
    const { container, item } = entryAt(save, where, slot);
    if (count === 1) delete item.Count;
    else container[slot] = withKey(item, 'Count', count, ['AddedToInventoryTimestamp']);
    return container[slot];
  }

  function setDurability(save, where, slot, durability) {
    wholeNumber(durability, 0, 'Durability');
    const { container, item } = entryAt(save, where, slot);
    container[slot] = withKey(item, 'Durability', durability, ['NumUpgradesApplied', 'Count', 'AddedToInventoryTimestamp']);
    return container[slot];
  }

  function removeItem(save, invSlot) {
    const { container, item } = entryAt(save, 'Inventory', invSlot);
    delete container[invSlot];
    return item;
  }

  // 16 random bytes as 22 URL-safe base64 characters, like the game's GUIDs.
  function newGuid() {
    const bytes = new Uint8Array(16);
    globalThis.crypto.getRandomValues(bytes);
    let bin = '';
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  // .NET ticks (100 ns since 0001-01-01), which AddedToInventoryTimestamp uses.
  function ticksNow() {
    return (Date.now() + 62135596800000) * 10000;
  }

  // Puts a new item in the first free bag slot. Gear gets no Durability, so
  // the game starts it at its own default.
  function addItem(save, itemId, count) {
    const n = count === undefined ? 1 : count;
    wholeNumber(n, 1, 'Count');
    if (!/^[A-Za-z0-9_-]{22}$/.test(itemId)) throw new Error(`${itemId} is not an item ID.`);
    const slot = firstFreeBagSlot(save);
    if (slot === undefined) throw new Error('Your bag and action bar are full; free a slot first.');
    const item = { GUID: newGuid(), ItemData: itemId };
    if (n > 1) item.Count = n;
    item.AddedToInventoryTimestamp = ticksNow();
    const inv = progress(save).Inventory;
    inv[slot] = item;
    bumpMaxSlot(inv, slot);
    return { slot, item };
  }

  // Progress.RecipesUnlocked lists the recipe IDs the character knows. Some
  // gear checks it on load: the Fire Cape is taken off a character that has
  // not unlocked RECIPE_Armour_T0_Cape_Fire.
  function unlockedRecipes(save) {
    const p = progress(save).Progress;
    return p && Array.isArray(p.RecipesUnlocked) ? p.RecipesUnlocked : null;
  }

  function recipeList(save) {
    const list = unlockedRecipes(save);
    if (!list) throw new Error('This save has no recipe list (Progress.RecipesUnlocked).');
    return list;
  }

  // Returns false if the recipe was already unlocked.
  function unlockRecipe(save, id) {
    const list = recipeList(save);
    if (list.includes(id)) return false;
    list.push(id);
    return true;
  }

  // Returns false if the recipe was not unlocked.
  function lockRecipe(save, id) {
    const list = recipeList(save);
    const i = list.indexOf(id);
    if (i < 0) return false;
    list.splice(i, 1);
    return true;
  }

  const api = { WEARABLE_SLOTS, CAPE_SLOT, progress, parse, serialize, formatNumber, inventoryItems, loadoutItems, equip, unequip,
    unlockedRecipes, unlockRecipe, lockRecipe, setCount, setDurability, removeItem, addItem, firstFreeBagSlot };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DWSave = api;
})(typeof self !== 'undefined' ? self : this);
