# Dragonwilds Save Editor

A character save editor for RuneScape: Dragonwilds that runs in the browser.
It changes worn gear (head, body, legs, cape, ring), item quantities and
durability, adds or removes items, and unlocks recipes, for example to wear a
Fire Cape. The save is read and written locally; nothing is uploaded.

## Using it

1. Go back to the game's main menu, or quit. In a world the game keeps the
   character in memory and writes over the file.
2. Back up `%LOCALAPPDATA%\RSDragonwilds\Saved\SaveCharacters`, which holds one
   `<CharacterName>.json` per character.
3. Open `index.html` (straight from disk is fine, or the Pages build) and load
   the character file. The tabs:
   - **Gear**: what is worn, with durability and **Take off**.
   - **Inventory**: grouped into hotbar, bag, runes, arrows and quest items.
     Filter, change **Qty** or **Durability**, **Wear** gear in its slot, or
     **Remove** an item.
   - **Add items**: search all items and add them. Runes, arrows and quest
     items go in their own section; everything else in the bag, then the
     hotbar.
   - **Recipes**: search, then **Unlock** or **Lock**.
4. Press **Save** to write over the original (Chrome/Edge), or **Download** and
   put the file back under the same name. Then load the character in the game.

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
- `Inventory` slots are sectioned: 0–7 hotbar, 8–39 bag, 40–71 runes, 72–103
  arrows and bolts, 104–119 quest items and keys (`MaxSlotIndex` 119).
- `Loadout` slots 0–4 (head, body, legs, cape, ring) hold the item itself.
  Slots that hold only a `PlayerInventoryItemIndex` (weapon, shield, ammo and
  so on) point back into `Inventory`, and this editor does not touch them.
- The trailing `Backup` number is left as it is; the game accepts edited files
  without it changing.
- Item entries are `GUID`, `ItemData`, then `Durability` (gear that wears)
  and `NumUpgradesApplied`, or `Count` (stacks of more than one; the game
  leaves it out at 1), then `AddedToInventoryTimestamp` in .NET ticks. Capes
  have neither field. Added items get a random 22-character `GUID`; gear gets
  no `Durability`, so the game starts it at its own default. Maximum
  durability is not in the save or the item assets, so the editor accepts any
  number.
- Item names come from the game's own data files (1,270 items, October 2026;
  the Fire Cape is `36kwMUzRF5L6DG-k7YgkSw`). Items added by later patches
  show as "Unknown item" with their raw ID until the list is regenerated.

## Recipes and the Fire Cape

`GameProgress.Progress.RecipesUnlocked` lists the recipe IDs a character
knows. Loading a character without `RECIPE_Armour_T0_Cape_Fire`
(`1RBw-UqvGfavD2KdV-65Jg`, normally from the Fight Caves vestige) took the
Fire Cape off it; the cape asset is tagged
`UI.Notification.Inventory.CannotEquipDueToEntitlement`. With the recipe
unlocked, the cape stays equipped in game (confirmed October 2026). Worn gear
and gear in the bag whose recipe is locked shows an **Unlock recipe** button.

Quest progress is `GameProgress.QuestProgress.Quests`: one entry per quest
with `QuestId`, `QuestState` (0 not started, 1 in progress, 2 complete),
`QuestObjective` and named `QuestInts` / `QuestBools`. The Fight Caves are
part of the Umbral Sands main quest (`kPtTW0exXrqw2BqELR_bFA`) and have no
completion flag of their own in the save.

## Regenerating the item and recipe lists

`items.js` and `recipes.js` are built from the game's paks by `tools/itemdump` (C#, .NET 10,
[CUE4Parse](https://github.com/FabianFG/CUE4Parse)). The paks are unencrypted
UE 5.6. Each `ITEM_*` asset's `PersistenceID` is the 22-character ID the save
uses, and its `Name` points into a string table such as `ST_ItemNames`.
`RECIPE_*` assets carry the IDs in `RecipesUnlocked`. A recipe is named after
the item it makes, picked from the items it references by matching asset names.

The tool needs a `.usmap` to open the packages; the one in
[PEAKEGames/DWCharacterEditor](https://github.com/PEAKEGames/DWCharacterEditor/tree/main/DragonwildsUpdater)
works even though it predates 1.0, because the tool reads IDs and name keys
from the raw asset bytes rather than parsing properties through it. The first
run downloads the Oodle and zlib-ng DLLs into `tools/itemdump/bin/.../native`.

```bash
dotnet run -c Release --project tools/itemdump -- "<Steam>/steamapps/common/RSDragonwilds/RSDragonwilds/Content/Paks" path/to/RSDragonwilds.usmap dump.json
node scripts/gen-items.js dump.json
```

Names the game leaves blank (some skill capes, test items) keep the name
already in `items.js`, or fall back to the asset's file name. Categories come
from the asset's folder and are for display only.

## Scripts

```bash
npm test        # save logic tests (node:test, no dependencies)
npm run build   # copies the four static files to dist/
```
