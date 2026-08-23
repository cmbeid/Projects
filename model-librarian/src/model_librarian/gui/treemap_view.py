"""A WinDirStat-style treemap of the scanned files, colored by extension.

Rectangle area is proportional to file size; a folder recurses into its own
sub-treemap so the layout mirrors the same folder hierarchy `file_tree.py`
groups the browser by. The squarified layout math lives in
`core/treemap.py`, Qt-free and independently testable — this widget only
paints the rectangles it returns and turns clicks into a `fileSelected`
signal, the same contract `MainWindow` already gets from the tree view's
selection.
"""

from __future__ import annotations

from PySide6.QtCore import QPointF, QRectF, Qt, Signal
from PySide6.QtGui import QColor, QMouseEvent, QPainter, QPaintEvent, QPen
from PySide6.QtWidgets import QToolTip, QWidget

from model_librarian.core.treemap import TreemapNode, TreemapRect, build_tree, layout
from model_librarian.gui.format_utils import human_size

_PADDING = 1.0
_MIN_LABEL_SIZE = 36.0

# A fixed palette keyed by extension rather than a hash, so a given
# extension is always the same color across a session instead of shifting
# whenever the set of scanned extensions changes.
_EXT_COLORS = {
    ".stl": QColor("#4C8BF5"),
    ".obj": QColor("#34A853"),
    ".3mf": QColor("#F4B400"),
    ".step": QColor("#DB4437"),
    ".stp": QColor("#DB4437"),
}
_FALLBACK_COLOR = QColor("#9AA0A6")
_BORDER_COLOR = QColor("#202124")
_EMPTY_TEXT = "No files scanned yet"


class TreemapView(QWidget):
    fileSelected = Signal(int)

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setMouseTracking(True)
        self.setMinimumHeight(150)
        self._tree: TreemapNode | None = None
        self._rects: list[TreemapRect] = []
        self._hovered: TreemapRect | None = None

    def set_rows(self, rows, root_paths: dict[int, str]) -> None:
        self._tree = build_tree(rows, root_paths)
        self._relayout()
        self.update()

    def resizeEvent(self, event) -> None:  # noqa: N802 - Qt override
        self._relayout()
        super().resizeEvent(event)

    def _relayout(self) -> None:
        if self._tree is None:
            self._rects = []
            return
        self._rects = layout(self._tree, 0.0, 0.0, float(self.width()), float(self.height()))
        self._hovered = None

    def paintEvent(self, event: QPaintEvent) -> None:  # noqa: N802 - Qt override
        painter = QPainter(self)
        if not self._rects:
            painter.setPen(QColor("#888888"))
            painter.drawText(self.rect(), Qt.AlignmentFlag.AlignCenter, _EMPTY_TEXT)
            painter.end()
            return

        for rect in self._rects:
            self._paint_rect(painter, rect)
        painter.end()

    def _paint_rect(self, painter: QPainter, rect: TreemapRect) -> None:
        color = _EXT_COLORS.get(rect.node.ext, _FALLBACK_COLOR)
        if rect is self._hovered:
            color = color.lighter(130)
        qrect = QRectF(
            rect.x + _PADDING,
            rect.y + _PADDING,
            max(0.0, rect.w - 2 * _PADDING),
            max(0.0, rect.h - 2 * _PADDING),
        )
        painter.fillRect(qrect, color)
        painter.setPen(QPen(_BORDER_COLOR, 1))
        painter.drawRect(qrect)

        if rect.w >= _MIN_LABEL_SIZE and rect.h >= _MIN_LABEL_SIZE:
            painter.setPen(QColor("#FFFFFF"))
            painter.drawText(
                qrect.adjusted(2, 2, -2, -2),
                int(Qt.TextFlag.TextWordWrap),
                rect.node.name,
            )

    def _rect_at(self, pos: QPointF) -> TreemapRect | None:
        for rect in self._rects:
            if rect.x <= pos.x() <= rect.x + rect.w and rect.y <= pos.y() <= rect.y + rect.h:
                return rect
        return None

    def mouseMoveEvent(self, event: QMouseEvent) -> None:  # noqa: N802 - Qt override
        rect = self._rect_at(event.position())
        if rect is not self._hovered:
            self._hovered = rect
            self.update()
        if rect is not None:
            node = rect.node
            QToolTip.showText(
                event.globalPosition().toPoint(),
                f"{node.name}\n{human_size(node.size)}",
                self,
            )
        else:
            QToolTip.hideText()
        super().mouseMoveEvent(event)

    def leaveEvent(self, event) -> None:  # noqa: N802 - Qt override
        if self._hovered is not None:
            self._hovered = None
            self.update()
        super().leaveEvent(event)

    def mousePressEvent(self, event: QMouseEvent) -> None:  # noqa: N802 - Qt override
        if event.button() == Qt.MouseButton.LeftButton:
            rect = self._rect_at(event.position())
            if rect is not None and rect.node.file_id is not None:
                self.fileSelected.emit(rect.node.file_id)
        super().mousePressEvent(event)
