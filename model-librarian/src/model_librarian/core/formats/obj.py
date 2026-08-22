"""Tier-1 probe for `.obj` — one streaming pass over line prefixes.

OBJ is rarely self-contained: materials and textures live in separate files
referenced by relative path. A copy that lost its neighbors is silently
broken (renders as gray/untextured), and nothing else in the workflow says
so — this probe is what surfaces it.
"""

from __future__ import annotations

import os
from typing import BinaryIO

from model_librarian.core.models import ExternalRef, FileFacts, ObjectInfo

_TEXTURE_KEYS = (
    "map_Kd",
    "map_Ka",
    "map_Ks",
    "map_Ns",
    "map_d",
    "map_bump",
    "bump",
    "disp",
    "decal",
    "norm",
)


def probe(stream: BinaryIO, *, size: int, path: str) -> FileFacts:
    object_names: list[str] = []
    group_names: list[str] = []
    materials_used: dict[str, None] = {}
    mtllib_refs: list[str] = []
    counts = {"v": 0, "vt": 0, "vn": 0, "f": 0}

    for raw_line in _iter_lines(stream):
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        prefix, _, rest = line.partition(" ")
        rest = rest.strip()
        if prefix == "o" and rest:
            object_names.append(rest)
        elif prefix == "g" and rest:
            group_names.append(rest)
        elif prefix == "usemtl" and rest:
            materials_used.setdefault(rest, None)
        elif prefix == "mtllib" and rest:
            mtllib_refs.extend(rest.split())
        elif prefix in counts:
            counts[prefix] += 1

    base_dir = os.path.dirname(path)
    external_refs: list[ExternalRef] = []
    for ref in mtllib_refs:
        mtl_path = os.path.join(base_dir, ref)
        resolved = os.path.isfile(mtl_path)
        external_refs.append(ExternalRef(kind="mtllib", ref=ref, resolved=resolved))
        if resolved:
            external_refs.extend(_check_textures(mtl_path, base_dir))

    objects = tuple(
        ObjectInfo(index=i, name=name, obj_type="model") for i, name in enumerate(object_names)
    )
    warnings = []
    if not object_names and not group_names:
        warnings.append("No `o`/`g` names found — this OBJ has a single unnamed mesh.")
    if any(not ref.resolved for ref in external_refs):
        warnings.append("One or more referenced material/texture files could not be found.")

    return FileFacts(
        path=path,
        ext=".obj",
        format="obj",
        size=size,
        mtime_ns=0,
        objects=objects,
        defined_object_count=len(object_names) or None,
        materials=tuple(materials_used.keys()),
        triangle_count=counts["f"] or None,
        vertex_count=counts["v"] or None,
        external_refs=tuple(external_refs),
        warnings=tuple(warnings),
        metadata={"group_names": ", ".join(group_names)} if group_names else {},
    )


def _iter_lines(stream: BinaryIO):
    carry = b""
    chunk_size = 1 << 20
    while True:
        chunk = stream.read(chunk_size)
        if not chunk:
            break
        buf = carry + chunk
        lines = buf.split(b"\n")
        carry = lines.pop()
        for raw in lines:
            yield raw.decode("utf-8", errors="replace")
    if carry:
        yield carry.decode("utf-8", errors="replace")


def _check_textures(mtl_path: str, base_dir: str) -> list[ExternalRef]:
    refs: list[ExternalRef] = []
    try:
        with open(mtl_path, "rb") as f:
            for raw_line in _iter_lines(f):
                line = raw_line.strip()
                if not line or line.startswith("#"):
                    continue
                prefix, _, rest = line.partition(" ")
                if prefix in _TEXTURE_KEYS and rest.strip():
                    texture_name = rest.strip().split()[-1]
                    tex_path = os.path.join(base_dir, texture_name)
                    refs.append(
                        ExternalRef(
                            kind="texture", ref=texture_name, resolved=os.path.isfile(tex_path)
                        )
                    )
    except OSError:
        pass
    return refs
