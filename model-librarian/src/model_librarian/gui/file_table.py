"""The virtualized file table: `QAbstractTableModel` over the SQLite index.

Rows come from `db.list_files()` as `sqlite3.Row` objects — plain values
only, no lazy DB access from `data()` — so the model stays cheap to
refresh in full after a scan.
"""

from __future__ import annotations

from PySide6.QtCore import QAbstractTableModel, QModelIndex, Qt

_COLUMNS = ("Name", "Ext", "Format", "Size", "Objects", "Triangles", "Status")


class FileTableModel(QAbstractTableModel):
    def __init__(self, parent=None):
        super().__init__(parent)
        self._rows: list[dict] = []

    def set_rows(self, rows) -> None:
        self.beginResetModel()
        self._rows = [dict(row) for row in rows]
        self.endResetModel()

    def file_id_at(self, row: int) -> int | None:
        if 0 <= row < len(self._rows):
            return self._rows[row]["id"]
        return None

    def rowCount(self, parent: QModelIndex = QModelIndex()) -> int:  # noqa: B008
        return 0 if parent.isValid() else len(self._rows)

    def columnCount(self, parent: QModelIndex = QModelIndex()) -> int:  # noqa: B008
        return 0 if parent.isValid() else len(_COLUMNS)

    def headerData(self, section, orientation, role=Qt.ItemDataRole.DisplayRole):
        if role != Qt.ItemDataRole.DisplayRole or orientation != Qt.Orientation.Horizontal:
            return None
        return _COLUMNS[section]

    def data(self, index: QModelIndex, role=Qt.ItemDataRole.DisplayRole):
        if not index.isValid() or role != Qt.ItemDataRole.DisplayRole:
            return None
        row = self._rows[index.row()]
        column = _COLUMNS[index.column()]

        if column == "Name":
            return row["name"]
        if column == "Ext":
            return row["ext"]
        if column == "Format":
            return row["format"]
        if column == "Size":
            return _human_size(row["size"])
        if column == "Objects":
            return _format_object_count(row)
        if column == "Triangles":
            triangles = row.get("triangle_count")
            return "" if triangles is None else str(triangles)
        if column == "Status":
            return row["status"]
        return None


def _format_object_count(row: dict) -> str:
    defined = row.get("defined_object_count")
    if defined is None:
        return ""
    build = row.get("build_object_count")
    return f"{build}/{defined} placed" if build is not None else str(defined)


def _human_size(num_bytes: int) -> str:
    value = float(num_bytes)
    for unit in ("B", "KB", "MB", "GB"):
        if value < 1024 or unit == "GB":
            return f"{value:.0f} {unit}" if unit == "B" else f"{value:.1f} {unit}"
        value /= 1024
    return f"{value:.1f} TB"
