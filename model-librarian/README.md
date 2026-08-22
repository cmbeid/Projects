# model-librarian

A desktop app for triaging a hoard of `.step`/`.stp`, `.3mf`, `.stl`, and `.obj` files.
It recursively indexes a folder, shows what is actually *inside* each file — a visual
preview, object counts, object names, and (for `.3mf`) the saved slicer configuration —
and surfaces duplicates and clutter so the library can be organized with confidence.

v1 is **read-only**: it indexes, previews, tags, and reports. It never moves, renames,
or deletes anything. See [`PLAN.md`](../PLAN.md) at the repo root for the full design.

## Install

```bash
cd model-librarian
python -m venv .venv
source .venv/bin/activate      # .venv\Scripts\activate on Windows
pip install -e ".[dev]"
```

The optional `[step]` extra pulls in `cadquery-ocp` (~200MB) for STEP 3D preview; it is
never required to start the app. STEP files get metadata-only support without it.

## Run

```bash
python -m model_librarian                  # GUI
model-librarian scan DIR --json            # headless index, CLI
```

## Test

```bash
pytest
ruff check .
```

Fixture files (STL/OBJ/3MF/STEP) are synthesized at test time in `tests/conftest.py` —
none are committed as binaries.

## Status

v1 in progress, following the implementation order in `PLAN.md`. Read-only in v1;
organize/move/rename actions are a deferred phase 2.
