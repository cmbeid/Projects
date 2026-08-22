"""Tier-1 probe for `.3mf` — the richest format.

A 3MF is an OPC ZIP. This reads only the central directory plus a handful
of small XML/JSON members — never the whole archive, and never any
geometry beyond `<vertex>`/`<triangle>` element *counts* via a streaming
`iterparse` (constant memory, no DOM).

Safety: member paths are validated against zip-slip (absolute / `..`),
individual and total inflated size are capped, and encrypted entries are
skipped rather than raising — the same guards the future zip-peeking
feature (PLAN.md) will reuse.
"""

from __future__ import annotations

import json
import zipfile
from dataclasses import dataclass, field
from typing import BinaryIO
from xml.etree import ElementTree as ET

from model_librarian.core.models import FileFacts, ObjectInfo, SettingsBlock

_PROD_NS = "http://schemas.microsoft.com/3dmanufacturing/production/2015/06"
_MODEL_MEMBER = "3D/3dmodel.model"
_MAX_MEMBER_SIZE = 32 * 1024 * 1024
_MAX_TOTAL_CONFIG_SIZE = 64 * 1024 * 1024
_PREVIEW_CANDIDATES = (
    "Metadata/thumbnail.png",
    "Metadata/plate_1.png",
    "Metadata/plate_no_light_1.png",
)
_METADATA_KEYS = (
    "Title",
    "Designer",
    "Description",
    "Application",
    "CreationDate",
    "ModificationDate",
    "LicenseTerms",
    "Rating",
    "Copyright",
)
_CONFIG_SOURCES = {
    "Metadata/project_settings.config": "project_settings",
    "Metadata/model_settings.config": "model_settings",
    "Metadata/slice_info.config": "slice_info",
    "Metadata/Slic3r_PE.config": "Slic3r_PE",
    "Metadata/Slic3r_PE_model.config": "Slic3r_PE_model",
}


@dataclass
class _RawObject:
    member: str
    objectid: int
    obj_type: str = "model"
    name: str | None = None
    has_mesh: bool = False
    vertex_count: int = 0
    triangle_count: int = 0
    components: list[tuple[str, int]] = field(default_factory=list)  # (member, objectid)


def probe(stream: BinaryIO, *, size: int, path: str) -> FileFacts:
    try:
        zf = zipfile.ZipFile(stream)
    except zipfile.BadZipFile:
        return FileFacts(
            path=path,
            ext=".3mf",
            format="3mf",
            size=size,
            mtime_ns=0,
            error="not a valid zip archive",
        )

    safe_names = _safe_member_names(zf)
    if _MODEL_MEMBER not in safe_names:
        return FileFacts(
            path=path,
            ext=".3mf",
            format="3mf",
            size=size,
            mtime_ns=0,
            error="missing 3D/3dmodel.model",
        )

    warnings: list[str] = []
    visited_members: set[str] = set()
    raw_objects: dict[tuple[str, int], _RawObject] = {}

    root_data = _parse_model_member(zf, _MODEL_MEMBER, raw_objects, visited_members)

    for member, objectid in list(raw_objects):
        obj = raw_objects[(member, objectid)]
        for child_member, _child_id in obj.components:
            if child_member != _MODEL_MEMBER and child_member not in visited_members:
                if child_member in safe_names:
                    _parse_model_member(zf, child_member, raw_objects, visited_members)
                else:
                    warnings.append(f"referenced object file missing from archive: {child_member}")

    placed_ids = {item_id for item_id, _printable in root_data.build_items}
    objects, index_by_key = _build_object_tuple(raw_objects, placed_ids)

    settings = _read_settings(zf, safe_names, warnings)
    preview_members = tuple(name for name in _preview_member_names(safe_names) if name)
    materials = root_data.materials

    return FileFacts(
        path=path,
        ext=".3mf",
        format="3mf",
        size=size,
        mtime_ns=0,
        unit=root_data.unit,
        metadata=root_data.metadata,
        objects=objects,
        defined_object_count=len(objects) or None,
        build_object_count=len(root_data.build_items) or None,
        settings=settings,
        materials=materials,
        embedded_preview_members=preview_members,
        triangle_count=sum(o.triangle_count or 0 for o in objects) or None,
        vertex_count=sum(o.vertex_count or 0 for o in objects) or None,
        warnings=tuple(warnings),
    )


def extract_embedded_preview(path: str) -> bytes | None:
    """Return the best embedded plate/thumbnail PNG bytes, if any."""
    try:
        with zipfile.ZipFile(path) as zf:
            names = set(_safe_member_names(zf))
            for candidate in _PREVIEW_CANDIDATES:
                if candidate in names:
                    return zf.read(candidate)
            for name in sorted(names):
                if name.startswith("Metadata/") and name.lower().endswith(".png"):
                    return zf.read(name)
    except (OSError, zipfile.BadZipFile):
        return None
    return None


@dataclass
class _RootData:
    unit: str | None = None
    metadata: dict[str, str] = field(default_factory=dict)
    materials: tuple[str, ...] = ()
    build_items: list[tuple[int, bool]] = field(default_factory=list)


def _parse_model_member(
    zf: zipfile.ZipFile,
    member: str,
    raw_objects: dict[tuple[str, int], _RawObject],
    visited_members: set[str],
) -> _RootData:
    visited_members.add(member)
    root_data = _RootData()
    materials: list[str] = []
    current: _RawObject | None = None
    in_build = False

    with zf.open(member) as fh:
        for event, elem in ET.iterparse(fh, events=("start", "end")):
            local = _local(elem.tag)
            if event == "start":
                if local == "model":
                    root_data.unit = elem.get("unit", "millimeter")
                elif local == "build":
                    in_build = True
                elif local == "item" and in_build:
                    objectid = _as_int(elem.get("objectid"))
                    printable = elem.get("printable", "1") not in ("0", "false", "False")
                    if objectid is not None:
                        root_data.build_items.append((objectid, printable))
                elif local == "object":
                    objectid = _as_int(elem.get("id"))
                    if objectid is not None:
                        current = raw_objects.setdefault(
                            (member, objectid), _RawObject(member=member, objectid=objectid)
                        )
                        current.obj_type = elem.get("type", "model")
                        current.name = elem.get("name") or current.name
                elif local == "component" and current is not None:
                    objectid = _as_int(elem.get("objectid"))
                    ref_path = elem.get(f"{{{_PROD_NS}}}path")
                    child_member = _resolve_member_path(ref_path) if ref_path else member
                    if objectid is not None:
                        current.components.append((child_member, objectid))
                elif local == "base":
                    name = elem.get("name")
                    if name:
                        materials.append(name)
            else:  # end
                if local == "model" and not root_data.metadata:
                    pass
                elif local == "metadata" and current is None and not in_build:
                    name = elem.get("name")
                    if name in _METADATA_KEYS and elem.text:
                        root_data.metadata[name] = elem.text.strip()
                elif local == "vertex" and current is not None:
                    current.has_mesh = True
                    current.vertex_count += 1
                elif local == "triangle" and current is not None:
                    current.has_mesh = True
                    current.triangle_count += 1
                elif local == "object":
                    current = None
                    elem.clear()
                elif local == "build":
                    in_build = False

    root_data.materials = tuple(materials)
    return root_data


def _build_object_tuple(
    raw_objects: dict[tuple[str, int], _RawObject], placed_ids: set[int]
) -> tuple[tuple[ObjectInfo, ...], dict[tuple[str, int], int]]:
    keys = list(raw_objects.keys())
    index_by_key = {key: i for i, key in enumerate(keys)}
    parent_of: dict[tuple[str, int], tuple[str, int]] = {}
    for key, obj in raw_objects.items():
        for child_key in obj.components:
            if child_key in index_by_key:
                parent_of[child_key] = key

    objects = []
    for key in keys:
        obj = raw_objects[key]
        parent_key = parent_of.get(key)
        objects.append(
            ObjectInfo(
                index=index_by_key[key],
                name=obj.name or f"object {obj.objectid}",
                obj_type=obj.obj_type,
                parent_index=index_by_key.get(parent_key) if parent_key else None,
                triangle_count=obj.triangle_count if obj.has_mesh else None,
                vertex_count=obj.vertex_count if obj.has_mesh else None,
                placed=obj.objectid in placed_ids if obj.member == _MODEL_MEMBER else None,
            )
        )
    return tuple(objects), index_by_key


def _read_settings(
    zf: zipfile.ZipFile, safe_names: set[str], warnings: list[str]
) -> tuple[SettingsBlock, ...]:
    blocks: list[SettingsBlock] = []
    total = 0
    for member, source in _CONFIG_SOURCES.items():
        if member not in safe_names:
            continue
        info = zf.getinfo(member)
        if info.file_size > _MAX_MEMBER_SIZE:
            warnings.append(f"skipped oversized config member: {member}")
            continue
        total += info.file_size
        if total > _MAX_TOTAL_CONFIG_SIZE:
            warnings.append("stopped reading config members: total size cap exceeded")
            break
        try:
            data = zf.read(member)
        except (OSError, zipfile.BadZipFile, NotImplementedError):
            continue
        try:
            if source == "project_settings":
                blocks.extend(_parse_json_settings(data, source))
            elif source == "Slic3r_PE":
                blocks.extend(_parse_ini_comment_settings(data, source))
            else:
                blocks.extend(_parse_object_metadata_xml(data, source))
        except (ET.ParseError, json.JSONDecodeError, ValueError):
            warnings.append(f"failed to parse config member: {member}")
    return tuple(blocks)


def _parse_json_settings(data: bytes, source: str) -> list[SettingsBlock]:
    obj = json.loads(data)
    blocks = []
    if isinstance(obj, dict):
        for key, value in obj.items():
            text = value if isinstance(value, str) else json.dumps(value)
            blocks.append(SettingsBlock(source=source, key=key, value=text))
    return blocks


def _parse_ini_comment_settings(data: bytes, source: str) -> list[SettingsBlock]:
    blocks = []
    for line in data.decode("utf-8", errors="replace").splitlines():
        line = line.strip()
        if not line.startswith(";"):
            continue
        content = line.lstrip(";").strip()
        if " = " not in content:
            continue
        key, _, value = content.partition(" = ")
        blocks.append(SettingsBlock(source=source, key=key.strip(), value=value.strip()))
    return blocks


def _parse_object_metadata_xml(data: bytes, source: str) -> list[SettingsBlock]:
    blocks = []
    root = ET.fromstring(data)
    for obj_el in root.iter():
        kind = _local(obj_el.tag)
        if kind not in ("object", "plate"):
            continue
        metas = obj_el.findall("metadata")
        if kind == "plate":
            # A <plate> has no id attribute of its own; its plate-index metadata
            # entry is named "plater_id" (model_settings.config) or "index"
            # (slice_info.config) depending on which file wrote it.
            obj_id = next(
                (m.get("value") for m in metas if m.get("key") in ("plater_id", "index")), None
            )
        else:
            obj_id = obj_el.get("id")
        for meta in metas:
            key = meta.get("key")
            value = meta.get("value")
            if key is None or (kind == "plate" and key in ("plater_id", "index")):
                continue
            blocks.append(
                SettingsBlock(
                    source=source, key=f"{kind}[{obj_id or '?'}].{key}", value=value or ""
                )
            )
        for filament_el in obj_el.findall("filament"):
            fid = filament_el.get("id", "?")
            for attr, value in filament_el.attrib.items():
                if attr == "id":
                    continue
                blocks.append(
                    SettingsBlock(
                        source=source,
                        key=f"{kind}[{obj_id or '?'}].filament[{fid}].{attr}",
                        value=value,
                    )
                )
    return blocks


def _preview_member_names(safe_names: set[str]) -> tuple[str, ...]:
    found = [name for name in _PREVIEW_CANDIDATES if name in safe_names]
    found.extend(
        sorted(
            name
            for name in safe_names
            if name.startswith("Metadata/") and name.lower().endswith(".png") and name not in found
        )
    )
    return tuple(found)


def _safe_member_names(zf: zipfile.ZipFile) -> set[str]:
    safe = set()
    total = 0
    for info in zf.infolist():
        name = info.filename
        if name.startswith("/") or ".." in name.split("/"):
            continue
        if info.flag_bits & 0x1:  # encrypted
            continue
        if info.file_size > _MAX_MEMBER_SIZE:
            continue
        total += info.file_size
        if total > _MAX_TOTAL_CONFIG_SIZE * 4:
            break
        safe.add(name)
    return safe


def _resolve_member_path(ref_path: str) -> str:
    return ref_path.lstrip("/")


def _local(tag: str) -> str:
    return tag.rsplit("}", 1)[-1] if "}" in tag else tag


def _as_int(value: str | None) -> int | None:
    if value is None:
        return None
    try:
        return int(value)
    except ValueError:
        return None
