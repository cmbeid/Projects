const test = require('node:test');
const assert = require('node:assert/strict');
const DWSave = require('../editor.js');

const CAPE = { GUID: 'cape-guid', ItemData: 'FireCapeIdNotInCatalog', Durability: 500, VitalShield: 0 };
const OLD_CAPE = { GUID: 'old-guid', ItemData: 'ilFiZ9GcsUC5EOSxOrE74w', Durability: 100, VitalShield: 0 };

function sample() {
  return {
    Version: 67,
    meta_data: { char_name: 'Tester' },
    Inventory: {
      0: { GUID: 'a', ItemData: 'x', Count: 5 },
      1: { GUID: 'b', ItemData: 'y', Durability: 10 },
      9: CAPE,
      MaxSlotIndex: 81,
    },
    Loadout: { 1: { GUID: 'body', ItemData: 'z', Durability: 1 } },
    Backup: 1159903845,
  };
}

test('equipping into an empty cape slot moves the item out of the inventory', () => {
  const save = sample();
  const r = DWSave.equip(save, 9, DWSave.CAPE_SLOT);
  assert.equal(save.Loadout[3], CAPE);
  assert.equal(save.Inventory[9], undefined);
  assert.equal(r.unequipped, null);
});

test('equipping over a worn cape swaps the old one into the freed slot', () => {
  const save = sample();
  save.Loadout[3] = OLD_CAPE;
  const r = DWSave.equip(save, 9, 3);
  assert.equal(save.Loadout[3], CAPE);
  assert.equal(save.Inventory[9], OLD_CAPE);
  assert.equal(r.unequipped, OLD_CAPE);
});

test('only wearable slots that hold the item directly are allowed', () => {
  assert.throws(() => DWSave.equip(sample(), 9, 5), /not a wearable slot/);
  assert.throws(() => DWSave.equip(sample(), 4, 3), /empty/);
});

test('unequip puts the item in the first free bag slot', () => {
  const save = sample();
  DWSave.equip(save, 9, 3);
  const r = DWSave.unequip(save, 3);
  assert.equal(r.slot, 2);
  assert.equal(save.Inventory[2], CAPE);
  assert.equal(save.Loadout[3], undefined);
});

test('serialize keeps tabs, CRLF and the trailing newline, and round-trips', () => {
  const original = DWSave.serialize(sample(), '{\r\n}\r\n');
  const save = DWSave.parse('﻿' + original);
  assert.equal(DWSave.serialize(save, original), original);
  DWSave.equip(save, 9, 3);
  const out = DWSave.serialize(save, original);
  assert.match(out, /^\{\r\n\t"Version": 67,/);
  assert.ok(out.endsWith('}\r\n'));
  assert.equal(JSON.parse(out).Loadout[3].ItemData, 'FireCapeIdNotInCatalog');
  assert.equal(JSON.parse(out).Backup, 1159903845);
});

test('parse rejects files that are not character saves', () => {
  assert.throws(() => DWSave.parse('{"foo": 1}'), /not a Dragonwilds character file/);
});

// Version 86 saves nest everything under GameProgress and are written with
// each object's brace on its own line, CRLF, and %.17g numbers.
const NEW_FORMAT = [
  '{',
  '\t"Version": 86,',
  '\t"meta_data":',
  '\t{',
  '\t\t"char_name": "Tester"',
  '\t},',
  '\t"GameProgress":',
  '\t{',
  '\t\t"Character":',
  '\t\t{',
  '\t\t\t"Playtime_sim": 372399.71052306145,',
  '\t\t\t"Ratio": 0.55555558204650879,',
  '\t\t\t"Tiny": 1.0000000000000001e-05,',
  '\t\t\t"Food":',
  '\t\t\t{',
  '\t\t\t},',
  '\t\t\t"TrackedAI": []',
  '\t\t},',
  '\t\t"Inventory":',
  '\t\t{',
  '\t\t\t"15":',
  '\t\t\t{',
  '\t\t\t\t"GUID": "AWgg",',
  '\t\t\t\t"ItemData": "FireCapeIdNotInCatalog",',
  '\t\t\t\t"AddedToInventoryTimestamp": 6.3927971260733005e+17',
  '\t\t\t},',
  '\t\t\t"MaxSlotIndex": 119',
  '\t\t},',
  '\t\t"Loadout":',
  '\t\t{',
  '\t\t\t"5":',
  '\t\t\t{',
  '\t\t\t\t"PlayerInventoryItemIndex": 79',
  '\t\t\t},',
  '\t\t\t"MaxSlotIndex": 11',
  '\t\t},',
  '\t\t"MapCustomization":',
  '\t\t{',
  '\t\t\t"Pins": [',
  '\t\t\t\t{',
  '\t\t\t\t\t"PinType": 3,',
  '\t\t\t\t\t"PinLocation": [ 71998.0390625, 153273.328125 ]',
  '\t\t\t\t}',
  '\t\t\t],',
  '\t\t\t"Spells": [',
  '\t\t\t\t"a",',
  '\t\t\t\t""',
  '\t\t\t]',
  '\t\t}',
  '\t},',
  '\t"Backup": 2544458474',
  '}',
].join('\r\n');

test('a Version 86 save round-trips byte for byte', () => {
  const save = DWSave.parse(NEW_FORMAT);
  assert.equal(DWSave.serialize(save, NEW_FORMAT), NEW_FORMAT);
});

test('a Version 86 save equips from GameProgress and changes nothing else', () => {
  const save = DWSave.parse(NEW_FORMAT);
  DWSave.equip(save, 15, 3);
  const p = save.GameProgress;
  assert.equal(p.Loadout[3].ItemData, 'FireCapeIdNotInCatalog');
  assert.equal(p.Inventory[15], undefined);
  assert.equal(p.Loadout[5].PlayerInventoryItemIndex, 79);
  const out = DWSave.serialize(save, NEW_FORMAT);
  assert.match(out, /\t\t"Loadout":\r\n\t\t\{\r\n\t\t\t"3":\r\n\t\t\t\{\r\n\t\t\t\t"GUID": "AWgg",/);
  assert.match(out, /"Backup": 2544458474\r\n\}$/);
});

const WITH_RECIPES = NEW_FORMAT.replace('\t\t"Inventory":', [
  '\t\t"Progress":',
  '\t\t{',
  '\t\t\t"RecipesUnlocked": [',
  '\t\t\t\t"G2LRQkwdrgWVlZ-EXRXtcg",',
  '\t\t\t\t"NbePfEBQYxH_dpKM0pqZhw"',
  '\t\t\t],',
  '\t\t\t"RecipesNew": []',
  '\t\t},',
  '\t\t"Inventory":',
].join('\r\n'));

test('unlocking a recipe appends its ID and changes nothing else', () => {
  const save = DWSave.parse(WITH_RECIPES);
  assert.equal(DWSave.serialize(save, WITH_RECIPES), WITH_RECIPES);
  assert.equal(DWSave.unlockRecipe(save, '1RBw-UqvGfavD2KdV-65Jg'), true);
  assert.equal(DWSave.unlockRecipe(save, '1RBw-UqvGfavD2KdV-65Jg'), false);
  const out = DWSave.serialize(save, WITH_RECIPES);
  assert.equal(out, WITH_RECIPES.replace('"NbePfEBQYxH_dpKM0pqZhw"\r\n',
    '"NbePfEBQYxH_dpKM0pqZhw",\r\n\t\t\t\t"1RBw-UqvGfavD2KdV-65Jg"\r\n'));
  assert.deepEqual(save.GameProgress.Progress.RecipesNew, []);
});

test('locking a recipe removes it, and only if it was unlocked', () => {
  const save = DWSave.parse(WITH_RECIPES);
  assert.equal(DWSave.lockRecipe(save, 'G2LRQkwdrgWVlZ-EXRXtcg'), true);
  assert.equal(DWSave.lockRecipe(save, 'G2LRQkwdrgWVlZ-EXRXtcg'), false);
  assert.deepEqual(DWSave.unlockedRecipes(save), ['NbePfEBQYxH_dpKM0pqZhw']);
});

test('saves without a recipe list say so instead of inventing one', () => {
  const save = DWSave.parse(NEW_FORMAT);
  assert.equal(DWSave.unlockedRecipes(save), null);
  assert.throws(() => DWSave.unlockRecipe(save, 'x'), /no recipe list/);
});

test('setCount writes Count where the game does and drops it at 1', () => {
  const save = DWSave.parse(NEW_FORMAT);
  DWSave.setCount(save, 'Inventory', 15, 25);
  assert.deepEqual(Object.keys(save.GameProgress.Inventory[15]), ['GUID', 'ItemData', 'Count', 'AddedToInventoryTimestamp']);
  const out = DWSave.serialize(save, NEW_FORMAT);
  assert.equal(out, NEW_FORMAT.replace('"FireCapeIdNotInCatalog",\r\n', '"FireCapeIdNotInCatalog",\r\n\t\t\t\t"Count": 25,\r\n'));
  DWSave.setCount(save, 'Inventory', 15, 1);
  assert.equal(DWSave.serialize(save, NEW_FORMAT), NEW_FORMAT);
  assert.throws(() => DWSave.setCount(save, 'Inventory', 15, 0), /at least 1/);
  assert.throws(() => DWSave.setCount(save, 'Inventory', 15, 2.5), /whole number/);
  assert.throws(() => DWSave.setCount(save, 'Inventory', 3, 2), /empty/);
});

test('setDurability updates in place or goes before NumUpgradesApplied', () => {
  const save = sample();
  DWSave.setDurability(save, 'Inventory', 1, 900);
  assert.deepEqual(save.Inventory[1], { GUID: 'b', ItemData: 'y', Durability: 900 });
  save.Inventory[0] = { GUID: 'w', ItemData: 'sword', NumUpgradesApplied: 2, AddedToInventoryTimestamp: 5 };
  DWSave.setDurability(save, 'Inventory', 0, 1900);
  assert.deepEqual(Object.keys(save.Inventory[0]), ['GUID', 'ItemData', 'Durability', 'NumUpgradesApplied', 'AddedToInventoryTimestamp']);
  DWSave.setDurability(save, 'Loadout', 1, 7);
  assert.equal(save.Loadout[1].Durability, 7);
});

test('addItem fills the first free bag slot with a fresh entry', () => {
  const save = DWSave.parse(NEW_FORMAT);
  const r = DWSave.addItem(save, '_QMgbMYhjU-9jAD_euFbyQ', 500);
  assert.equal(r.slot, 0);
  const item = save.GameProgress.Inventory[0];
  assert.deepEqual(Object.keys(item), ['GUID', 'ItemData', 'Count', 'AddedToInventoryTimestamp']);
  assert.match(item.GUID, /^[A-Za-z0-9_-]{22}$/);
  assert.equal(item.Count, 500);
  assert.ok(item.AddedToInventoryTimestamp > 6.39e17);
  assert.notEqual(DWSave.addItem(save, '36kwMUzRF5L6DG-k7YgkSw').item.GUID, item.GUID);
  assert.equal(save.GameProgress.Inventory[1].Count, undefined);
  assert.throws(() => DWSave.addItem(save, 'not an id'), /not an item ID/);
});

test('addItem refuses when the bag is full', () => {
  const save = sample();
  for (let s = 0; s < 32; s++) save.Inventory[s] = { GUID: 'g' + s, ItemData: 'x' };
  assert.throws(() => DWSave.addItem(save, '_QMgbMYhjU-9jAD_euFbyQ'), /full/);
});

test('removeItem empties the inventory slot', () => {
  const save = sample();
  assert.equal(DWSave.removeItem(save, 9), CAPE);
  assert.equal(save.Inventory[9], undefined);
  assert.throws(() => DWSave.removeItem(save, 9), /empty/);
});

test('numbers are written like printf %.17g', () => {
  const cases = { 0: '0', 1468: '1468', 2544458474: '2544458474', 0.1: '0.10000000000000001',
    1e-5: '1.0000000000000001e-05', 1e17: '1e+17', 639279712607330050: '6.3927971260733005e+17', '-2.5': '-2.5' };
  for (const [n, want] of Object.entries(cases)) assert.equal(DWSave.formatNumber(Number(n)), want);
});
