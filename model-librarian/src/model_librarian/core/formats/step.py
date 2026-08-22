"""Tier-1 probe for `.step`/`.stp` — metadata only in v1.

ISO 10303-21 is plain text, so a regex pass over the `HEADER` and `DATA`
sections gets real provenance and structure without any CAD kernel:
originating system, part names, and whether the file is a single part or
an assembly. 3D tessellation is deferred to phase 3 behind the optional
`step` extra (`cadquery-ocp`).
"""

from __future__ import annotations

import re
from typing import BinaryIO

from model_librarian.core.models import FileFacts, ObjectInfo

_HEADER_SIZE = 16 * 1024
_CHUNK_SIZE = 4 * 1024 * 1024
_CARRY_SIZE = 8 * 1024

_FILE_NAME_RE = re.compile(
    r"FILE_NAME\s*\(\s*'((?:[^'\\]|\\.)*)'\s*,\s*'((?:[^'\\]|\\.)*)'\s*,\s*"
    r"\(([^)]*)\)\s*,\s*\(([^)]*)\)\s*,\s*'((?:[^'\\]|\\.)*)'\s*,\s*"
    r"'((?:[^'\\]|\\.)*)'\s*,\s*'((?:[^'\\]|\\.)*)'\s*\)\s*;",
    re.DOTALL,
)
_FILE_SCHEMA_RE = re.compile(r"FILE_SCHEMA\s*\(\s*\(([^)]*)\)\s*\)\s*;", re.DOTALL)
_PRODUCT_RE = re.compile(
    r"=\s*PRODUCT\s*\(\s*'((?:[^'\\]|\\.)*)'\s*,\s*'((?:[^'\\]|\\.)*)'", re.DOTALL
)
_COUNT_KEYS = {
    "assembly_instance_count": "NEXT_ASSEMBLY_USAGE_OCCURRENCE(",
    "solid_body_count": "MANIFOLD_SOLID_BREP(",
    "face_count": "ADVANCED_FACE(",
}

_SCHEMA_ALIASES = (
    ("AP242", ("AP242", "MANAGED_MODEL_BASED_3D_ENGINEERING")),
    ("AP214", ("AUTOMOTIVE_DESIGN",)),
    ("AP203", ("CONFIG_CONTROL_DESIGN",)),
)


def probe(stream: BinaryIO, *, size: int, path: str) -> FileFacts:
    header_text = stream.read(_HEADER_SIZE).decode("latin-1", errors="replace")

    metadata: dict[str, str] = {}
    originating_system = None
    file_schema = None

    name_match = _FILE_NAME_RE.search(header_text)
    if name_match:
        metadata["original_filename"] = name_match.group(1)
        metadata["timestamp"] = name_match.group(2)
        metadata["author"] = _strip_quotes(name_match.group(3))
        metadata["organization"] = _strip_quotes(name_match.group(4))
        originating_system = name_match.group(6) or None

    schema_match = _FILE_SCHEMA_RE.search(header_text)
    if schema_match:
        raw_schema = schema_match.group(1)
        file_schema = _classify_schema(raw_schema)

    product_names, counts = _scan_data_section(stream)

    objects = tuple(
        ObjectInfo(index=i, name=name, obj_type="part") for i, name in enumerate(product_names)
    )
    for key, value in counts.items():
        metadata[key] = str(value)

    return FileFacts(
        path=path,
        ext=".step" if path.lower().endswith(".step") else ".stp",
        format="step",
        size=size,
        mtime_ns=0,
        metadata=metadata,
        objects=objects,
        defined_object_count=len(objects) or None,
        originating_system=originating_system,
        file_schema=file_schema,
    )


def _scan_data_section(stream: BinaryIO) -> tuple[list[str], dict[str, int]]:
    stream.seek(0)
    product_names: list[str] = []
    counts = {key: 0 for key in _COUNT_KEYS}
    carry = ""
    while True:
        chunk = stream.read(_CHUNK_SIZE)
        if not chunk:
            break
        text = carry + chunk.decode("latin-1", errors="replace")
        boundary = len(carry)
        for match in _PRODUCT_RE.finditer(text):
            if match.start() >= boundary:
                product_names.append(match.group(2))
        for key, needle in _COUNT_KEYS.items():
            start = 0
            while True:
                pos = text.find(needle, start)
                if pos == -1:
                    break
                if pos >= boundary:
                    counts[key] += 1
                start = pos + 1
        carry = text[-_CARRY_SIZE:]
    return product_names, counts


def _classify_schema(raw_schema: str) -> str | None:
    upper = raw_schema.upper()
    for label, markers in _SCHEMA_ALIASES:
        if any(marker in upper for marker in markers):
            return label
    return None


def _strip_quotes(raw_list: str) -> str:
    return ", ".join(part.strip().strip("'") for part in raw_list.split(",") if part.strip())
