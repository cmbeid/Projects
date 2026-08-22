"""Thumbnail/preview sourcing, in priority order (PLAN.md):

1. Embedded PNG from the 3MF (instant, and the plate the user recognizes).
2. Offscreen VTK render via pyvista, for the interactive viewport or a
   rendered thumbnail when nothing is embedded.
3. A format placeholder (STEP in v1, or an unparseable file) — handled by
   the caller, since it depends on GUI context.

Rendering is best-effort: on a machine with no GPU/display, pyvista's
offscreen path can fail, and callers must treat `None` as "no preview"
rather than an error.
"""

from __future__ import annotations

import logging
import os
import sqlite3
import tempfile

from model_librarian.core import db
from model_librarian.core.formats import threemf

logger = logging.getLogger(__name__)

_RENDERABLE_EXTENSIONS = frozenset({".stl", ".obj", ".3mf"})


def embedded_preview_png(path: str, ext: str) -> bytes | None:
    if ext == ".3mf":
        return threemf.extract_embedded_preview(path)
    return None


def load_pyvista_mesh(path: str):
    """Load a mesh for the interactive viewport or an offscreen render."""
    try:
        import pyvista as pv
        import trimesh
    except ImportError:
        return None
    try:
        mesh = trimesh.load(path, force="mesh", process=True)
        if not hasattr(mesh, "vertices") or len(mesh.vertices) == 0:
            return None
        return pv.wrap(mesh)
    except Exception:
        logger.debug("failed to load mesh for preview: %s", path, exc_info=True)
        return None


def render_thumbnail_png(path: str, ext: str, *, size: int = 512) -> bytes | None:
    """Offscreen-render a thumbnail PNG for files with no embedded preview."""
    if ext not in _RENDERABLE_EXTENSIONS:
        return None
    mesh = load_pyvista_mesh(path)
    if mesh is None:
        return None

    try:
        import pyvista as pv
    except ImportError:
        return None

    tmp_path = None
    try:
        plotter = pv.Plotter(off_screen=True, window_size=(size, size))
        plotter.add_mesh(mesh, color="lightgray")
        plotter.set_background("white")
        plotter.camera_position = "iso"
        plotter.camera.zoom(1.2)
        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
            tmp_path = tmp.name
        plotter.screenshot(tmp_path)
        plotter.close()
        with open(tmp_path, "rb") as f:
            return f.read()
    except Exception:
        logger.debug("offscreen render failed for %s", path, exc_info=True)
        return None
    finally:
        if tmp_path is not None:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass


def get_or_render_thumbnail(
    conn: sqlite3.Connection, file_id: int, path: str, ext: str, *, size: int = 512
) -> bytes | None:
    """Offscreen VTK renders are the expensive tier (PLAN.md preview
    priority #2), so results are cached — unlike an embedded 3MF PNG, which
    is cheap to re-extract from the zip's central directory every time and
    is not cached here.

    Cached by `file_id` rather than the `content_hash` the schema's `thumbs`
    table is designed around: nothing populates `files.content_hash` yet
    (dupes.py hashes on demand instead), so this cache does not yet survive
    a rename — only repeated selection and app restarts for the same path.
    """
    cache_key = str(file_id)
    cached = db.get_thumb(conn, cache_key, "rendered")
    if cached is not None:
        return cached["png"]

    png_bytes = render_thumbnail_png(path, ext, size=size)
    if png_bytes is not None:
        db.set_thumb(conn, cache_key, "rendered", size, size, png_bytes)
    return png_bytes
