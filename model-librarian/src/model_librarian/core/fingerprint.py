"""Tier-2 geometry: full mesh parse via trimesh, feeding dedupe (dupes.py).

Two things are computed, both cached forever once run:

- A whole-file fingerprint (`compute_file_fingerprint`) — the merged mesh
  across every body in the file, used to catch "the same cube exported as
  STL, OBJ, and 3MF" and byte-for-byte-different re-exports.
- Per-object fingerprints for `.3mf` (`compute_3mf_object_hashes`) — the
  "contained-in" signal: a loose `.stl` whose geometry matches one object
  *inside* a `.3mf`, the most common MakerWorld clutter pattern.

`identifier_hash` is trimesh's rotation- and translation-invariant mesh
identifier: the same shape re-exported, renamed, or rotated still matches.
"""

from __future__ import annotations

import logging

import trimesh

from model_librarian.core.models import FingerprintInfo

logger = logging.getLogger(__name__)

MESH_EXTENSIONS = frozenset({".stl", ".obj", ".3mf"})
_BBOX_ROUND = 3


def compute_file_fingerprint(path: str, ext: str) -> FingerprintInfo | None:
    """Merge every body in the file into one mesh and fingerprint it."""
    if ext not in MESH_EXTENSIONS:
        return None
    try:
        mesh = trimesh.load(path, force="mesh", process=True)
    except Exception:
        logger.debug("tier-2 load failed for %s", path, exc_info=True)
        return None
    return _fingerprint_mesh(mesh)


def compute_3mf_object_hashes(path: str) -> dict[str, str]:
    """Return {object name: identifier_hash} for each geometry in a 3MF scene."""
    try:
        scene = trimesh.load(path, force=None, process=True)
    except Exception:
        logger.debug("tier-2 scene load failed for %s", path, exc_info=True)
        return {}
    geometry = getattr(scene, "geometry", None)
    if not geometry:
        return {}
    hashes = {}
    for name, mesh in geometry.items():
        if isinstance(mesh, trimesh.Trimesh) and len(mesh.vertices):
            hashes[name] = str(mesh.identifier_hash)
    return hashes


def _fingerprint_mesh(mesh) -> FingerprintInfo | None:
    if not isinstance(mesh, trimesh.Trimesh) or len(mesh.vertices) == 0:
        return None
    try:
        components = mesh.split(only_watertight=False)
        connected_components = len(components) if len(components) else 1
    except Exception:
        connected_components = 1

    volume = 0.0
    if mesh.is_watertight:
        try:
            volume = abs(float(mesh.volume))
        except Exception:
            volume = 0.0

    bbox = mesh.bounding_box.extents.tolist()
    return FingerprintInfo(
        identifier_hash=str(mesh.identifier_hash),
        triangle_count=int(mesh.faces.shape[0]),
        vertex_count=int(mesh.vertices.shape[0]),
        volume_mm3=volume,
        area_mm2=float(mesh.area),
        bbox_key=tuple(round(v, _BBOX_ROUND) for v in sorted(bbox)),
        watertight=bool(mesh.is_watertight),
        connected_components=connected_components,
    )
