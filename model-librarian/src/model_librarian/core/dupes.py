"""Duplicate and clutter detection — findings to review, never actions.

Three independent signals (PLAN.md):

1. Byte-identical — SHA-256, pre-filtered by size then a 64KB head+tail hash
   so full hashing only runs on real candidates.
2. Geometrically identical — trimesh `identifier_hash` groups from the
   `fingerprints` table (core/fingerprint.py), invariant to rotation,
   translation, and vertex ordering.
3. Contained-in — a loose `.stl`/`.obj` whose fingerprint matches an
   object's `identifier_hash` *inside* a `.3mf` — the "the project file and
   the loose meshes it was built from" MakerWorld pattern.

Plus lightweight clutter flags: orphaned `.obj` (unresolved external ref),
zero-triangle or non-watertight meshes, and near-identical filename
families (`thing.stl`, `thing (1).stl`, `thing_v2.stl`).
"""

from __future__ import annotations

import hashlib
import os
import re
import sqlite3
from collections import defaultdict
from dataclasses import dataclass

_HEAD_TAIL_SIZE = 64 * 1024
_FILENAME_FAMILY_RE = re.compile(r"^(.*?)(?:\s*\(\d+\)|[_.-]?v?\d+)?$", re.IGNORECASE)


@dataclass(frozen=True, slots=True)
class ByteDuplicateGroup:
    sha256: str
    file_ids: tuple[int, ...]


@dataclass(frozen=True, slots=True)
class GeometryDuplicateGroup:
    identifier_hash: str
    file_ids: tuple[int, ...]


@dataclass(frozen=True, slots=True)
class ContainedInMatch:
    loose_file_id: int
    container_file_id: int
    object_name: str


@dataclass(frozen=True, slots=True)
class ClutterFlag:
    file_id: int
    reason: str


def find_byte_duplicates(conn: sqlite3.Connection) -> list[ByteDuplicateGroup]:
    rows = conn.execute("SELECT id, path, size FROM files WHERE status = 'ok'").fetchall()
    by_size: dict[int, list[sqlite3.Row]] = defaultdict(list)
    for row in rows:
        by_size[row["size"]].append(row)

    quick_groups: dict[bytes, list[sqlite3.Row]] = defaultdict(list)
    for _size, group in by_size.items():
        if len(group) < 2:
            continue
        for row in group:
            quick_groups[_head_tail_hash(row["path"])].append(row)

    results: list[ByteDuplicateGroup] = []
    for group in quick_groups.values():
        if len(group) < 2:
            continue
        full_hashes: dict[str, list[int]] = defaultdict(list)
        for row in group:
            digest = _sha256_file(row["path"])
            if digest is not None:
                full_hashes[digest].append(row["id"])
        for digest, ids in full_hashes.items():
            if len(ids) > 1:
                results.append(ByteDuplicateGroup(sha256=digest, file_ids=tuple(sorted(ids))))
    return results


def find_geometry_duplicates(conn: sqlite3.Connection) -> list[GeometryDuplicateGroup]:
    rows = conn.execute("SELECT file_id, identifier_hash FROM fingerprints").fetchall()
    groups: dict[str, list[int]] = defaultdict(list)
    for row in rows:
        groups[row["identifier_hash"]].append(row["file_id"])
    return [
        GeometryDuplicateGroup(identifier_hash=h, file_ids=tuple(sorted(ids)))
        for h, ids in groups.items()
        if len(ids) > 1
    ]


def find_contained_in(conn: sqlite3.Connection) -> list[ContainedInMatch]:
    loose_rows = conn.execute(
        """
        SELECT f.id AS file_id, fp.identifier_hash
        FROM files f JOIN fingerprints fp ON fp.file_id = f.id
        WHERE f.format IN ('stl', 'obj')
        """
    ).fetchall()
    loose_by_hash: dict[str, list[int]] = defaultdict(list)
    for row in loose_rows:
        loose_by_hash[row["identifier_hash"]].append(row["file_id"])
    if not loose_by_hash:
        return []

    object_rows = conn.execute(
        "SELECT file_id, name, identifier_hash FROM objects WHERE identifier_hash IS NOT NULL"
    ).fetchall()

    results: list[ContainedInMatch] = []
    for row in object_rows:
        for loose_id in loose_by_hash.get(row["identifier_hash"], ()):
            if loose_id == row["file_id"]:
                continue
            results.append(
                ContainedInMatch(
                    loose_file_id=loose_id,
                    container_file_id=row["file_id"],
                    object_name=row["name"],
                )
            )
    return results


def find_clutter(conn: sqlite3.Connection) -> list[ClutterFlag]:
    flags: list[ClutterFlag] = []

    orphaned = conn.execute(
        "SELECT DISTINCT file_id FROM external_refs WHERE resolved = 0"
    ).fetchall()
    flags.extend(ClutterFlag(row["file_id"], "unresolved external reference") for row in orphaned)

    bad_geometry = conn.execute(
        """
        SELECT file_id, tri_count, watertight FROM fingerprints
        WHERE tri_count = 0 OR watertight = 0
        """
    ).fetchall()
    for row in bad_geometry:
        reason = "zero-triangle mesh" if row["tri_count"] == 0 else "non-watertight mesh"
        flags.append(ClutterFlag(row["file_id"], reason))

    flags.extend(_find_filename_families(conn))
    return flags


def _find_filename_families(conn: sqlite3.Connection) -> list[ClutterFlag]:
    rows = conn.execute("SELECT id, root_id, name, ext FROM files WHERE status = 'ok'").fetchall()
    by_family: dict[tuple[int, str, str], list[int]] = defaultdict(list)
    for row in rows:
        stem = os.path.splitext(row["name"])[0]
        family = _FILENAME_FAMILY_RE.match(stem).group(1).strip() or stem
        by_family[(row["root_id"], family.lower(), row["ext"])].append(row["id"])

    flags = []
    for (_root_id, family, _ext), ids in by_family.items():
        if len(ids) > 1:
            flags.extend(
                ClutterFlag(file_id, f"filename family '{family}' has {len(ids)} variants")
                for file_id in ids
            )
    return flags


def _head_tail_hash(path: str) -> bytes:
    hasher = hashlib.sha256()
    try:
        size = os.path.getsize(path)
        with open(path, "rb") as f:
            hasher.update(f.read(_HEAD_TAIL_SIZE))
            if size > _HEAD_TAIL_SIZE:
                f.seek(max(0, size - _HEAD_TAIL_SIZE))
                hasher.update(f.read(_HEAD_TAIL_SIZE))
    except OSError:
        return b""
    return hasher.digest()


def _sha256_file(path: str) -> str | None:
    hasher = hashlib.sha256()
    try:
        with open(path, "rb") as f:
            for chunk in iter(lambda: f.read(1 << 20), b""):
                hasher.update(chunk)
    except OSError:
        return None
    return hasher.hexdigest()
