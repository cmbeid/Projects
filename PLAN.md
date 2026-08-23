# Model Librarian — a desktop app for triaging a 3D-model hoard

## Context

The library is hundreds of `.step`/`.stp`, `.3mf`, `.stl`, and `.obj` files spread across
nested folders — largely MakerWorld/Printables downloads plus their own CAD exports. The
filesystem tells them almost nothing: a `.3mf` may be a full slicer project with dozens of
named objects, print settings, and plate previews, while a sibling `.stl` may be the exact
same model re-exported under a meaningless name. Opening each one in a slicer to find out is
the bottleneck.

The goal is a Python GUI app that recursively indexes a folder, shows what is actually
*inside* each file — a visual preview, object counts, object names, and (for `.3mf`) the
saved slicer configuration — and surfaces duplicates and clutter so the library can be
organized with confidence.

Decisions settled up front:

| Decision | Choice |
| --- | --- |
| Primary platform | **Windows** (keep the core OS-agnostic; don't pay for cross-platform packaging yet) |
| STEP support in v1 | **Metadata only** — header + entity stats. 3D preview deferred behind an optional `[step]` extra |
| Disk writes in v1 | **Read-only.** Index, preview, tag, and *report*. Move/rename/quarantine is phase 2 |
| Name | `model-librarian/`, Python package `model_librarian` |

### Repo fit

`cmbeid/projects` is a monorepo of independent projects — one directory each, own
dependencies, no shared build (see `README.md`). Today it holds only `alchemy-forge/`
(TypeScript/Vite). This is the first Python project, and the first desktop (non-web) one, so
there is no existing code to reuse — but the *convention* to follow is clear: a
self-contained directory with its own manifest and README, plus one new row in the root
`README.md` project table. **No deploy workflow is added** — `.github/workflows/` exists to
push static sites to S3, which does not apply to a desktop app. That is worth stating
explicitly in the root README so the "Live at" table's omission doesn't look like an
oversight.

---

## Scope

### v1 (this plan)
Recursive scan → cached index → browse, preview, inspect, and find duplicates. No file
modification of any kind.

### Deferred, designed for but not built
- **Phase 2:** organize actions — tag-driven bulk move/rename by template, duplicate
  resolution, quarantine. Dry-run preview + replayable JSON undo journal; never `os.remove`,
  always move to a quarantine dir.
- **Phase 3:** STEP tessellation and 3D preview via OpenCascade.
- **Phase 4:** peeking inside `.zip` archives (detailed at the end — the seams for it are
  built into v1's data model).

---

## Architecture

Hard split between a Qt-free core and the GUI. Everything interesting is testable without a
display, and the same core backs a CLI.

```
model-librarian/
  pyproject.toml            # deps + [project.optional-dependencies] step/dev
  README.md
  src/model_librarian/
    __main__.py             # `python -m model_librarian` -> GUI
    cli.py                  # `model-librarian scan DIR --json` -> headless index
    core/
      scanner.py            # os.scandir walk, ignore rules, change detection
      probe.py              # dispatch path/bytes -> FileFacts, tier orchestration
      formats/
        stl.py  obj.py  threemf.py  step.py
      models.py             # frozen dataclasses: FileFacts, ObjectInfo, SettingsBlock
      db.py                 # SQLite schema, migrations, upsert/query
      thumbs.py             # embedded-PNG extraction + offscreen VTK render
      fingerprint.py        # content hash + rotation-invariant geometry hash
      dupes.py              # grouping / clutter heuristics
    gui/
      app.py  main_window.py
      file_table.py         # QAbstractTableModel + QSortFilterProxyModel
      details/              # preview.py objects.py settings.py info.py
      workers.py            # process pool <-> Qt signal bridge
  tests/
    conftest.py             # synthesizes fixture files at test time
    test_stl.py test_obj.py test_threemf.py test_step.py
    test_scanner.py test_db.py test_dupes.py test_gui_smoke.py
```

### Dependency choices

| Need | Pick | Why |
| --- | --- | --- |
| GUI | **PySide6** | Official Qt binding, LGPL, mature model/view for a virtualized table of thousands of rows, dock widgets, first-class threading. |
| Geometry | **trimesh** + **numpy** | Loads STL/OBJ/3MF meshes, computes volume/area/watertightness, splits connected components, and ships `identifier_hash` — a rotation- and translation-invariant mesh fingerprint that is exactly the near-duplicate primitive needed. |
| Render | **pyvista** (VTK) + **pyvistaqt** | `QtInteractor` embeds a real interactive 3D viewport in Qt; the same VTK can render offscreen in a worker process for thumbnails. Avoids trimesh's pyglet viewer, which needs a real window. |
| 3MF / STEP / STL / OBJ metadata | **stdlib** (`zipfile`, `xml.etree`, `json`, `struct`, `re`) | The valuable metadata is slicer-vendor-specific and not exposed by any library. Parsing it ourselves is both cheaper and more complete than any dependency. |
| STEP geometry (deferred) | `cadquery-ocp`, optional extra | ~200MB. Never required for the app to start. |
| Tests | pytest, pytest-qt | pytest-qt only for one GUI smoke test. |

### Tiered extraction — the central idea

Hundreds of files, some of them large, must not mean a multi-minute freeze. Every format
exposes three tiers, and the GUI only ever blocks on tier 0.

- **Tier 0 — stat.** `os.scandir` gives size/mtime for free. Rows appear instantly.
- **Tier 1 — cheap probe (target < 10 ms/file).** Header reads, streaming text scans, and
  ZIP *directory* reads. Yields object counts, object names, slicer settings, and embedded
  preview PNGs — **no geometry is loaded**. This tier alone answers most of the user's
  questions.
- **Tier 2 — full parse.** trimesh load for accurate volume/area/watertightness, connected-
  component splitting, and geometry fingerprints. Background, on demand, cached forever.
- **Tier 3 — render.** Offscreen VTK thumbnail, only when no embedded preview exists.

Tiers 1–3 run in a `ProcessPoolExecutor` and every result is cached in SQLite keyed by
content hash, so a rescan of an unchanged library is pure `stat` work.

---

## Format extraction — what each tier 1 probe actually reads

This is the heart of the app; each parser is a small, separately tested module.

### `.3mf` — the richest format (`formats/threemf.py`)

A 3MF is an OPC ZIP. Read the central directory and pull only the small XML/JSON members.

**Core spec — `3D/3dmodel.model`:**
- `<model unit="millimeter">` — **unit matters**; a model authored in inches must not be
  reported in mm.
- `<metadata name="...">` — the standard `Title`, `Designer`, `Description`, `Application`,
  `CreationDate`, `LicenseTerms`, `Rating` keys. `Application` identifies the producing
  slicer/CAD tool.
- `<resources>` → `<object id type name pid>` — **the object names the user asked for.**
  `type` distinguishes `model` from `support`/`solidsupport`/`surface`/`other`, which is why
  a naive "object count" is often wrong and this one won't be.
- `<components><component objectid transform/>` — assemblies; an object can be a composition
  of other objects. Walk this into a real tree, not a flat count.
- `<build><item objectid transform printable/>` — what is actually *placed on the plate*, as
  opposed to merely defined. Report both numbers; they differ constantly.
- `<basematerials><base name displaycolor/>` — material/color names.
- Triangle/vertex counts per object by counting `<triangle>`/`<vertex>` elements with
  `iterparse` (streaming, constant memory) rather than building a DOM.
- Bambu splits large models into `3D/Objects/*.model` referenced by `p:path` — follow those.

**Slicer configuration** — the "settings included in the project file":

| Member | Producer | Contents |
| --- | --- | --- |
| `Metadata/project_settings.config` | Bambu Studio / OrcaSlicer | JSON: the complete profile — layer height, wall count, infill, supports, temperatures, printer model, per-extruder filament list |
| `Metadata/model_settings.config` | Bambu / Orca | XML: per-object display names, per-object setting overrides, plate names |
| `Metadata/slice_info.config` | Bambu / Orca | XML: per-plate predicted print time, weight, and filament usage (`used_g`, `used_m`, color) |
| `Metadata/Slic3r_PE.config` | PrusaSlicer | `; key = value` ini lines |
| `Metadata/Slic3r_PE_model.config` | PrusaSlicer | XML: object/volume names and per-object config |
| `Metadata/custom_gcode_per_layer.xml` | both | Manual filament changes / color swaps |
| `Auxiliaries/**` | MakerWorld | Model description, README, images bundled by the site |

Normalize all of these into one `SettingsBlock(source, key, value)` list so the Settings tab
is uniform regardless of which slicer wrote the file, while keeping `source` visible.

**Embedded previews** — `Metadata/plate_*.png`, `plate_*_small.png`, `top_*.png`,
`Metadata/thumbnail.png`. **This is a major win: most 3MFs already contain the exact plate
image the user recognizes from their slicer.** Extract it and skip rendering entirely.

Safety: cap member size and total inflated size, reject absolute/`..` member paths, skip
encrypted entries — the same guards the future zip feature needs.

### `.stl` — cheap stats, expensive truth (`formats/stl.py`)

- Detect binary vs ASCII by the size identity `84 + 50*n == filesize`, **not** by a leading
  `solid` (binary files often start with it too).
- Binary: triangle count is a `uint32` at byte 80 — one seek, no parse. The 80-byte header
  frequently carries the exporter string ("Exported from Blender", Magics color extension) —
  surface it.
- ASCII: count `facet normal` occurrences in a buffered scan.
- STL has **no object names and no object concept** — be explicit about that in the UI rather
  than showing a misleading "1 object". The meaningful count is *connected components*, which
  requires tier 2 (`trimesh` split). Show it as "N loose bodies" once computed, since a
  multi-body STL is a common source of "why won't this slice right".
- Tier 2 also yields watertightness and volume — the two facts that decide whether an STL is
  printable at all.

### `.obj` — text, and rarely self-contained (`formats/obj.py`)

Single streaming pass, counting line prefixes:
- `o <name>` → **object names**; `g <name>` → group names.
- `usemtl` → materials used; `mtllib` → **referenced external `.mtl` files**.
- `v`/`vt`/`vn`/`f` counts → vertex/UV/normal/face totals.

The `mtllib` reference is a genuine cleanup signal: resolve it against the file's directory
and flag `.obj` files whose material library or referenced textures are **missing**. An OBJ
copied out of its folder is silently broken, and nothing else in the user's workflow tells
them so.

### `.step` / `.stp` — metadata only in v1 (`formats/step.py`)

ISO 10303-21 is plain text, so a streaming regex pass gets a lot without any CAD kernel:

- `HEADER` → `FILE_NAME(...)` gives the original filename, timestamp, author, organization,
  and **originating system** (SolidWorks / Fusion 360 / Onshape / FreeCAD) — genuinely useful
  provenance. `FILE_SCHEMA` gives AP203 / AP214 / AP242.
- `DATA` entity tallies: `PRODUCT(...)` → **part names**;
  `NEXT_ASSEMBLY_USAGE_OCCURRENCE` → assembly instances, i.e. whether this is one part or an
  assembly of many; `MANIFOLD_SOLID_BREP` → solid body count; `ADVANCED_FACE` → face count as
  a complexity proxy.

The details panel shows a "preview unavailable — install the `step` extra" placeholder rather
than an error. Phase 3 swaps in OCC tessellation → the same VTK path as meshes.

---

## Preview strategy

Priority order, first hit wins:
1. **Embedded PNG** from the 3MF (instant, and it is the plate the user remembers).
2. **Cached rendered thumbnail** (SQLite/on-disk, keyed by content hash — survives renames
   and moves).
3. **Offscreen VTK render** in a worker process: load with trimesh → PyVista mesh → isometric
   camera, auto-framed, soft two-light setup, 512px PNG.
4. **Format placeholder** (STEP in v1, or an unparseable file).

Selecting a row opens the **interactive** viewport (`pyvistaqt.QtInteractor`): orbit/pan/zoom,
plus toggles for wireframe, per-object coloring, bounding box, and — for multi-object 3MFs — a
checkbox list to isolate individual objects. One viewport instance is reused across selections
rather than rebuilt, which is the difference between snappy and unusable.

---

## Duplicate and clutter detection

Three independent signals, presented as *findings to review*, never as automatic actions:

1. **Byte-identical** — SHA-256, pre-filtered by size then by a 64KB head+tail hash so full
   hashing only runs on real candidates.
2. **Geometrically identical** — `trimesh.Trimesh.identifier_hash`, which is invariant to
   translation, rotation, and vertex ordering. This catches the same model re-exported, renamed,
   or saved in a *different format* — the `model_v2_final.stl` problem. Backed by a coarse
   bucket key of (rounded volume, area, sorted bbox dims, triangle count) so it stays a lookup,
   not an O(n²) comparison.
3. **Contained-in** — an `.stl` whose geometry fingerprint matches an object *inside* a `.3mf`.
   This is the single most common form of MakerWorld clutter: the download ships the project
   file and the loose meshes it was built from.

Plus lightweight clutter flags: orphaned `.obj` (missing `.mtl`), zero-triangle or
non-watertight meshes, files under a size floor, and near-identical filename families
(`thing.stl`, `thing (1).stl`, `thing_v2.stl`).

---

## Index storage (SQLite, in the OS app-data dir)

```
scan_roots(id, path, last_scan_at)
files(id, path UNIQUE, root_id, name, ext, size, mtime_ns, content_hash,
      container_id, member_path,          -- NULL now; the zip-peeking seam
      probe_version, probed_at, status)
objects(id, file_id, parent_id, idx, name, obj_type, plate,
        triangle_count, vertex_count, bbox_x, bbox_y, bbox_z, volume_mm3, material)
settings(file_id, source, key, value)     -- source = project_settings | Slic3r_PE | ...
fingerprints(file_id, identifier_hash, tri_count, vert_count, volume, area, bbox_key)
thumbs(content_hash, kind, width, height, png)   -- kind = embedded | rendered
tags(id, name)  file_tags(file_id, tag_id)
```

`objects` is self-referencing (`parent_id`) so 3MF component assemblies and STEP assembly
trees store naturally. `container_id`/`member_path` are added **now**, unused, so the zip
feature is a data-population change rather than a schema migration.

Cache invalidation: `(size, mtime_ns)` mismatch → re-probe; `probe_version` bump → re-probe
everything after a parser change. Content hash keys thumbnails so moving or renaming a file
never costs a re-render.

---

## GUI layout (PySide6)

```
┌─ Search ─────────────── [ext ▾][objects ▾][has preview][dupes only][tags ▾] ─┐
├──────────────┬──────────────────────────────┬────────────────────────────────┤
│ Folder tree  │  File table (virtualized)    │  Details                       │
│ Scan roots   │  ▣ thumb │ name │ ext │ size │  ┌ Preview │ Objects │ Settings │
│ Tags         │  │ objs │ tris │ app │ dupe │  │ Info ┐                       │
│ Saved views  │  │ modified │ tags          │  │  interactive 3D / plate PNG  │
├──────────────┴──────────────────────────────┴────────────────────────────────┤
│ Indexing 412 / 780 · 3 workers · [Cancel]                                    │
└──────────────────────────────────────────────────────────────────────────────┘
```

- **File table** — `QAbstractTableModel` over the SQLite index with a `QSortFilterProxyModel`;
  rows appear from tier 0 immediately and cells fill in as tier 1/2/3 results land.
- **Objects tab** — a `QTreeView` of the object/component hierarchy: name, type, triangles,
  bbox, volume, plate. Clicking an object isolates it in the viewport.
- **Settings tab** — grouped key/value table of the normalized slicer config, with a filter
  box and a "compare against another file" mode for answering *what changed between these two
  project files*.
- **Info tab** — path, hashes, format-specific header (STL exporter string, STEP originating
  system, 3MF `Application`), external file references and whether they resolve, and duplicate
  group membership with jump links.

### Concurrency

A scanner `QThread` walks with `os.scandir` and emits row batches; a
`ProcessPoolExecutor` handles tiers 1–3. Results return through a queue drained by a
`QTimer` on the GUI thread and dispatched as Qt signals. Windows-specific constraints to
respect from the first commit: `spawn` start method means the core must be import-safe, all
task arguments must be plain picklable values (paths and ints, never Qt objects), and the
executor must be created under `if __name__ == "__main__"` guarding.

---

## Verification

Fixtures are **generated at test time** in `conftest.py`, not committed as binaries: a binary
STL and an ASCII STL written with `struct`, a multi-object OBJ with an `mtllib` reference, and
synthetic 3MF ZIPs assembled with `zipfile` — one Bambu-shaped (with `project_settings.config`,
`model_settings.config`, `slice_info.config`, `plate_1.png`) and one PrusaSlicer-shaped (with
`Slic3r_PE.config`) — plus a small hand-written STEP file with a two-part assembly header. This
keeps the repo light and makes every parser assertion explicit about the bytes it is reading.

1. `pytest` — parser unit tests assert exact object names, counts, unit handling, settings
   keys, and embedded-thumbnail extraction; scanner tests cover incremental rescan and cache
   invalidation; dedupe tests assert that the same cube exported as STL, OBJ, and 3MF lands in
   one geometry group, and that a rotated copy still matches.
2. `python -m model_librarian.cli scan tests/fixtures --json` — headless end-to-end index,
   diffable output, no display required. This is also the CI-friendly path.
3. `pytest tests/test_gui_smoke.py` (pytest-qt) — window constructs, scans a fixture dir, and
   selects a row without exceptions.
4. **Manual, on the real library (Windows):** point it at the actual downloads folder; confirm
   hundreds of files index without freezing the UI, 3MF plate previews appear, object names
   match what Bambu Studio shows for a known project, and the reported duplicates are checked
   by hand before phase 2 is allowed to touch anything.

Ruff for lint/format, configured in `pyproject.toml`.

---

## Future enhancement: peeking inside `.zip`

Designed for now, built later. MakerWorld and Printables downloads arrive as archives, so an
un-extracted `.zip` is currently a blind spot in the index.

- **Model:** a zip becomes a *container* row in `files`; each interesting member becomes its
  own row with `container_id` set and `member_path` holding the in-archive path. Everything
  downstream — table, filters, dedupe, tags — works unchanged, because it all keys off `files`.
  The GUI shows containers as expandable rows.
- **Probing without extraction:** every tier 1 parser is written against a **file-like object**,
  not a path, specifically so a `zipfile.ZipExtFile` (or a `BytesIO` for seek-hungry formats
  like binary STL) can be passed straight in. Reading a zip's central directory is enough to
  answer "does this archive contain print files?" almost for free.
- **Nested 3MF:** a `.3mf` inside a `.zip` is a zip inside a zip. Read the member fully into
  `BytesIO`, then hand it to the ordinary 3MF parser. Cap nesting at one level.
- **Tier 2/3** extract on demand to a temp dir, keyed by content hash, with an LRU budget.
- **Safety:** total-inflated-size and compression-ratio caps (zip bombs), reject absolute and
  `..` member paths, skip encrypted archives with a clear status rather than a prompt.
- **Payoff:** the app can tell the user which downloaded archives are worth extracting and
  which duplicate models they already have unpacked — the highest-value cleanup signal in the
  whole tool, which is why the seams for it are in v1.

---

## Implementation order (for whenever work is authorized)

1. Skeleton: `pyproject.toml`, package layout, ruff/pytest config, README, root README row.
2. `core/models.py`, `core/formats/*` + parser tests. **No GUI yet** — this is where the value is.
3. `core/scanner.py` + `core/db.py` + `cli.py`; headless index over the fixture tree.
4. PySide6 shell: table, filters, Objects/Settings/Info tabs on tier 1 data.
5. Thumbnails: embedded 3MF PNG first, then offscreen VTK; then the interactive viewport.
6. Tier 2 geometry, fingerprints, `dupes.py`, and the duplicates view.
7. Polish: persisted window state, per-root settings, progress/cancel, error surfacing.

Phases 2–4 (write actions, STEP previews, zip peeking) are separate follow-up efforts.

---

## Status

v1 implemented: steps 1-6 of the order above plus a working PySide6 GUI (step 4-ish),
covering all four format probes, the scanner/SQLite index/CLI, tier-2 geometry
fingerprinting and duplicate/clutter detection, and the file table with
Preview/Objects/Settings/Info tabs. See `model-librarian/README.md` for the current
status and known gaps (interactive 3D viewport and process-pool concurrency are
unverified without a real GPU/display; built and tested in a headless container).
