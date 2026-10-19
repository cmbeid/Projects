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
  const original = JSON.stringify(sample(), null, '\t').replace(/\n/g, '\r\n') + '\r\n';
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
