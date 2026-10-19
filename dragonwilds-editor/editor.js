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

  function parse(text) {
    const save = JSON.parse(text.replace(/^﻿/, ''));
    if (!save || typeof save !== 'object' || !save.Inventory || !save.Loadout) {
      throw new Error('This is not a Dragonwilds character file: it has no Inventory or Loadout.');
    }
    return save;
  }

  // The game writes tab-indented JSON; keep its line endings and trailing
  // newline so the only diff is the edit itself.
  function serialize(save, originalText) {
    const original = originalText || '';
    const eol = original.includes('\r\n') ? '\r\n' : '\n';
    let text = JSON.stringify(save, null, '\t');
    if (eol !== '\n') text = text.replace(/\n/g, eol);
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
    return slotKeys(save.Inventory).map((slot) => ({ slot, item: save.Inventory[slot] }));
  }

  function loadoutItems(save) {
    return slotKeys(save.Loadout).map((slot) => ({ slot, item: save.Loadout[slot] }));
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
    const item = save.Inventory[invSlot];
    if (!item || !item.ItemData) throw new Error(`Inventory slot ${invSlot} is empty.`);
    const previous = save.Loadout[loadoutSlot];

    save.Loadout[loadoutSlot] = item;
    bumpMaxSlot(save.Loadout, loadoutSlot);
    if (previous && previous.ItemData) {
      save.Inventory[invSlot] = previous;
    } else {
      delete save.Inventory[invSlot];
    }
    return { equipped: item, unequipped: previous && previous.ItemData ? previous : null };
  }

  function firstFreeBagSlot(save) {
    return BAG_SLOTS.find((s) => !(save.Inventory[s] && save.Inventory[s].ItemData));
  }

  // Takes the item off wearable loadout slot `loadoutSlot` and puts it in the
  // first free bag slot.
  function unequip(save, loadoutSlot) {
    if (!(loadoutSlot in WEARABLE_SLOTS)) {
      throw new Error(`Loadout slot ${loadoutSlot} is not a wearable slot.`);
    }
    const item = save.Loadout[loadoutSlot];
    if (!item || !item.ItemData) throw new Error(`Nothing is worn in the ${WEARABLE_SLOTS[loadoutSlot]} slot.`);
    const slot = firstFreeBagSlot(save);
    if (slot === undefined) throw new Error('Your bag and action bar are full; free a slot first.');
    save.Inventory[slot] = item;
    bumpMaxSlot(save.Inventory, slot);
    delete save.Loadout[loadoutSlot];
    return { slot, item };
  }

  const api = { WEARABLE_SLOTS, CAPE_SLOT, parse, serialize, inventoryItems, loadoutItems, equip, unequip };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DWSave = api;
})(typeof self !== 'undefined' ? self : this);
