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

- Character saves are plain JSON. Newer saves (Version 86 seen) keep
  `Inventory` and `Loadout` under `GameProgress`; older ones (Version 67) have
  them at the top level. Both are handled.
- The game pretty-prints with tabs, CRLF, each object's brace on its own line,
  number arrays on one line and numbers as `%.17g`. The editor writes the same
  way, so an unedited save round-trips byte for byte and an edit changes only
  the lines it touches.
- `Loadout` slots 0–4 (head, body, legs, cape, ring) hold the item itself.
  Slots that hold only a `PlayerInventoryItemIndex` (weapon, shield, ammo and
  so on) point back into `Inventory`, and this editor does not touch them.
- The trailing `Backup` number is left as it is; the game accepts edited files
  without it changing.
- Item names come from the game's own data files (1,270 items, October 2026;
  the Fire Cape is `36kwMUzRF5L6DG-k7YgkSw`). Items added by later patches
  show as "Unknown item" with their raw ID until the list is regenerated.

## Regenerating the item list

`items.js` is built from the game's paks by `tools/itemdump` (C#, .NET 10,
[CUE4Parse](https://github.com/FabianFG/CUE4Parse)). The paks are unencrypted
UE 5.6. Each `ITEM_*` asset's `PersistenceID` is the 22-character ID the save
uses, and its `Name` points into a string table such as `ST_ItemNames`.

The tool needs a `.usmap` to open the packages; the one in
[PEAKEGames/DWCharacterEditor](https://github.com/PEAKEGames/DWCharacterEditor/tree/main/DragonwildsUpdater)
works even though it predates 1.0, because the tool reads IDs and name keys
from the raw asset bytes rather than parsing properties through it. The first
run downloads the Oodle and zlib-ng DLLs into `tools/itemdump/bin/.../native`.

```bash
dotnet run -c Release --project tools/itemdump -- "<Steam>/steamapps/common/RSDragonwilds/RSDragonwilds/Content/Paks" path/to/RSDragonwilds.usmap items.json
node scripts/gen-items.js items.json
```

Names the game leaves blank (some skill capes, test items) keep the name
already in `items.js`, or fall back to the asset's file name. Categories come
from the asset's folder and are for display only.

## Scripts

```bash
npm test        # save logic tests (node:test, no dependencies)
npm run build   # copies the three static files to dist/
```
