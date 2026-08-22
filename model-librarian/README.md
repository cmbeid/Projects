# model-librarian

A desktop app for triaging a hoard of `.step`/`.stp`, `.3mf`, `.stl`, and `.obj` files.
It recursively indexes a folder, shows what is actually *inside* each file — a visual
preview, object counts, object names, and (for `.3mf`) the saved slicer configuration —
and surfaces duplicates and clutter so the library can be organized with confidence.

v1 is **read-only**: it indexes, previews, tags, and reports. It never moves, renames,
or deletes anything. See [`PLAN.md`](../PLAN.md) at the repo root for the full design.

## Install

**Windows:** double-click `install.bat` (or run it from a terminal). It creates `.venv`
next to it and installs the app into it.

**macOS/Linux:**

```bash
cd model-librarian
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
```

The optional `[step]` extra pulls in `cadquery-ocp` (~200MB) for STEP 3D preview; it is
never required to start the app. STEP files get metadata-only support without it.

## Run

**Windows:** double-click `run.bat` (after running `install.bat` once).

**macOS/Linux:**

```bash
python -m model_librarian                  # GUI
model-librarian scan DIR --json            # headless index, CLI
```

## Uninstall

**Windows:** double-click `uninstall.bat`. It removes `.venv` after confirmation; your
scanned index (`%LOCALAPPDATA%\model-librarian`) is left alone.

**macOS/Linux:** delete the `.venv` directory.

## Test

```bash
pytest
ruff check .
```

Fixture files (STL/OBJ/3MF/STEP) are synthesized at test time in `tests/conftest.py` —
none are committed as binaries.

## Status

All of v1's implementation order in `PLAN.md` is built: tier-1 format probes for all
four extensions, the recursive scanner and SQLite index, a headless CLI, tier-2
geometry fingerprinting and duplicate/clutter detection, and a PySide6 GUI (file
table, Preview/Objects/Settings/Info tabs, background scanning). 37 tests pass.

Known gaps to verify on a real Windows machine with a GPU, since this was built in a
headless Linux container:

- The interactive 3D viewport and offscreen thumbnail rendering (pyvista/VTK) degrade
  to a placeholder here for lack of a GPU/display. The code path is in place
  (`gui/thumbs.py`, `gui/details/preview.py`) but only exercised end-to-end with a
  real embedded-PNG preview, not a rendered mesh.
- Tier-1/2 probing currently runs synchronously per file on a single `QThread`, not
  the `ProcessPoolExecutor` design PLAN.md describes for true multi-core throughput
  on a library of hundreds of files — functionally correct and non-blocking, but not
  yet the final concurrency model.
- STEP 3D preview (`[step]` extra), organize actions (phase 2), and `.zip` peeking
  (phase 4) remain deferred, as designed.

Read-only in v1; organize/move/rename actions are a deferred phase 2.
