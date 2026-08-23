"""Preview tab: embedded PNG, then an interactive 3D viewport, then a
cached offscreen render as a fallback when no viewport is available.

One `pyvistaqt.QtInteractor` instance is created once and reused across
selections rather than rebuilt (PLAN.md) — recreating a VTK render window
per row is the difference between snappy and unusable. If pyvistaqt can't
initialize (no GPU/display), the panel falls back to a static offscreen
render (still trying to show *something*) before degrading to a text
placeholder.
"""

from __future__ import annotations

import sqlite3

from PySide6.QtCore import Qt
from PySide6.QtGui import QPixmap
from PySide6.QtWidgets import QLabel, QStackedWidget, QVBoxLayout, QWidget

from model_librarian.gui import thumbs

try:
    from pyvistaqt import QtInteractor
except Exception:  # noqa: BLE001 - optional at runtime (no GPU/display)
    QtInteractor = None

_RENDERABLE = frozenset({".stl", ".obj", ".3mf"})
_NO_PREVIEW_TEXT = "No preview available"
_STEP_PLACEHOLDER_TEXT = "Preview unavailable — install the `step` extra for 3D preview."


class PreviewPanel(QWidget):
    def __init__(self, conn: sqlite3.Connection, parent=None):
        super().__init__(parent)
        self._conn = conn
        self._label = QLabel(_NO_PREVIEW_TEXT)
        self._label.setAlignment(Qt.AlignmentFlag.AlignCenter)

        self._interactor = None
        if QtInteractor is not None:
            try:
                self._interactor = QtInteractor(self)
            except Exception:  # noqa: BLE001 - no GPU/display at runtime
                self._interactor = None

        self._stack = QStackedWidget()
        self._stack.addWidget(self._label)
        if self._interactor is not None:
            self._stack.addWidget(self._interactor)

        layout = QVBoxLayout(self)
        layout.addWidget(self._stack)

    def clear(self) -> None:
        self._label.setPixmap(QPixmap())
        self._label.setText(_NO_PREVIEW_TEXT)
        self._stack.setCurrentWidget(self._label)
        if self._interactor is not None:
            self._interactor.clear()

    def show_file(self, row) -> None:
        file_id, path, ext = row["id"], row["path"], row["ext"]

        png_bytes = thumbs.embedded_preview_png(path, ext)
        if png_bytes and self._show_pixmap(png_bytes):
            return

        if self._interactor is not None and ext in _RENDERABLE:
            mesh = thumbs.load_pyvista_mesh(path)
            if mesh is not None:
                self._interactor.clear()
                self._interactor.add_mesh(mesh, color="lightgray", smooth_shading=True)
                # A dead-on default view plus flat shading reads as a flat gray
                # silhouette for boxy models — an angled camera and computed
                # normals are what make faces actually look shaded and 3D.
                self._interactor.camera_position = "iso"
                self._stack.setCurrentWidget(self._interactor)
                return

        if ext in _RENDERABLE:
            rendered = thumbs.get_or_render_thumbnail(self._conn, file_id, path, ext)
            if rendered and self._show_pixmap(rendered):
                return

        self._label.setPixmap(QPixmap())
        self._label.setText(_STEP_PLACEHOLDER_TEXT if ext == ".step" else _NO_PREVIEW_TEXT)
        self._stack.setCurrentWidget(self._label)

    def _show_pixmap(self, png_bytes: bytes) -> bool:
        pixmap = QPixmap()
        if not pixmap.loadFromData(png_bytes):
            return False
        self._label.setPixmap(
            pixmap.scaled(
                512,
                512,
                Qt.AspectRatioMode.KeepAspectRatio,
                Qt.TransformationMode.SmoothTransformation,
            )
        )
        self._stack.setCurrentWidget(self._label)
        return True
