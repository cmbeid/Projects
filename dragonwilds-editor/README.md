# Dragonwilds Save Editor

A character save editor for RuneScape: Dragonwilds that runs in the browser.
It moves items from your inventory into your worn gear (head, body, legs, cape,
ring), for example to wear a Fire Cape. The save is read and written locally;
nothing is uploaded.

## Using it

1. Quit the game.
2. Back up `%LOCALAPPDATA%\RSDragonwilds\Saved\SaveCharacters`, which holds one
   `<CharacterName>.json` per character.
3. Open `index.html` (straight from disk is fine, or the Pages build), load the
   character file, and press **Wear as cape** next to the item.
4. Save over the original (Chrome/Edge), or download the file and put it back
   under the same name.

If Steam Cloud restores the old file, turn it off for the game while you swap
the edited one in.

## Notes on the save

- Character saves are plain tab-indented JSON. `Loadout` slots 0–4 (head, body,
  legs, cape, ring) hold the item itself; 5–8 (weapon, shield, ammo, amulet)
  point back into `Inventory` through `PlayerInventoryItemIndex`, and this
  editor does not touch them.
- The trailing `Backup` number is left as it is; the game accepts edited files
  without it changing.
- Item names come from the community catalog in
  [PEAKEGames/DWCharacterEditor](https://github.com/PEAKEGames/DWCharacterEditor)
  (April 2026). Items added since, the Fire Cape among them, show as
  "Unknown item" with their raw ID.

## Scripts

```bash
npm test        # save logic tests (node:test, no dependencies)
npm run build   # copies the three static files to dist/
```
