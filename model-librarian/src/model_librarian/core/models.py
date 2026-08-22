"""Frozen dataclasses shared by the scanner, format parsers, db, and GUI.

Every dataclass here is immutable and built from plain, picklable values
(str/int/float/bool/tuple/None) — no Qt objects, no file handles — so an
instance can cross a `ProcessPoolExecutor` boundary or land straight in
SQLite without translation.
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True, slots=True)
class ObjectInfo:
    """One node in a file's object/component tree.

    Used for 3MF `<object>`/`<component>` trees, STEP assembly occurrences,
    and (post tier-2) STL/OBJ connected components. `parent_index` is
    `None` for a top-level object; otherwise it refers to another
    `ObjectInfo.index` within the same file, letting assemblies (3MF
    components, STEP `NEXT_ASSEMBLY_USAGE_OCCURRENCE`) nest naturally.
    """

    index: int
    name: str
    obj_type: str = "model"  # model | support | solidsupport | surface | other | part
    parent_index: int | None = None
    plate: str | None = None
    triangle_count: int | None = None
    vertex_count: int | None = None
    bbox_mm: tuple[float, float, float] | None = None
    volume_mm3: float | None = None
    material: str | None = None
    placed: bool | None = None  # True if present in a <build><item>, i.e. on the plate


@dataclass(frozen=True, slots=True)
class SettingsBlock:
    """One normalized slicer-config key/value, tagged with its source file.

    `source` is the config member name the value came from (e.g.
    `project_settings`, `Slic3r_PE`) so the Settings tab can stay uniform
    across slicers while keeping provenance visible.
    """

    source: str
    key: str
    value: str


@dataclass(frozen=True, slots=True)
class ExternalRef:
    """A file reference made from inside another file (e.g. OBJ `mtllib`)."""

    kind: str  # mtllib | texture
    ref: str  # the raw reference as written in the file
    resolved: bool  # whether it was found relative to the referencing file


@dataclass(frozen=True, slots=True)
class FingerprintInfo:
    """Tier-2 geometry fingerprint, used for dedupe grouping."""

    identifier_hash: str
    triangle_count: int
    vertex_count: int
    volume_mm3: float
    area_mm2: float
    bbox_key: tuple[float, float, float]
    watertight: bool
    connected_components: int


@dataclass(frozen=True, slots=True)
class FileFacts:
    """The result of probing one file: tier-1 metadata plus tier-2/3 hooks.

    Every field beyond `path`/`ext`/`format`/`size`/`mtime_ns` is optional
    and format-dependent — most fields are `None` or empty for formats that
    don't have that concept (e.g. STL has no `objects` names at tier 1).
    """

    path: str
    ext: str
    format: str  # stl | obj | 3mf | step | unknown
    size: int
    mtime_ns: int
    content_hash: str | None = None

    # Common descriptive metadata (3MF <metadata>, STEP HEADER, ...)
    unit: str | None = None
    metadata: dict[str, str] = field(default_factory=dict)

    # Object/component tree as defined in the file, and what's placed on a
    # build plate (3MF) or otherwise "real" vs merely referenced.
    objects: tuple[ObjectInfo, ...] = ()
    defined_object_count: int | None = None
    build_object_count: int | None = None

    # Slicer configuration and materials (3MF)
    settings: tuple[SettingsBlock, ...] = ()
    materials: tuple[str, ...] = ()
    embedded_preview_members: tuple[str, ...] = ()

    # Format-specific provenance strings
    exporter: str | None = None  # STL 80-byte header text
    originating_system: str | None = None  # STEP FILE_NAME originating system
    file_schema: str | None = None  # STEP FILE_SCHEMA (AP203/AP214/AP242)

    # Cheap totals available without full geometry parsing
    triangle_count: int | None = None
    vertex_count: int | None = None

    external_refs: tuple[ExternalRef, ...] = ()
    warnings: tuple[str, ...] = ()
    error: str | None = None

    # Tier 2, filled in later and merged onto the tier-1 result.
    fingerprint: FingerprintInfo | None = None
