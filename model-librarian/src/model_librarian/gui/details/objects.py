"""Objects tab: a `QTreeView`-equivalent tree of the object/component
hierarchy (3MF components, STEP assembly occurrences)."""

from __future__ import annotations

from PySide6.QtWidgets import QTreeWidget, QTreeWidgetItem

_COLUMNS = ("Name", "Type", "Triangles", "Volume (mm³)", "Placed", "Material")
_PLACED_TEXT = {1: "yes", 0: "no", None: ""}


class ObjectsPanel(QTreeWidget):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setColumnCount(len(_COLUMNS))
        self.setHeaderLabels(list(_COLUMNS))

    def show_objects(self, rows) -> None:
        self.clear()
        rows = list(rows)
        items_by_id: dict[int, QTreeWidgetItem] = {}
        for row in rows:
            triangles = row["triangle_count"]
            volume = row["volume_mm3"]
            items_by_id[row["id"]] = QTreeWidgetItem(
                [
                    row["name"],
                    row["obj_type"],
                    "" if triangles is None else str(triangles),
                    "" if volume is None else f"{volume:.2f}",
                    _PLACED_TEXT.get(row["placed"], ""),
                    row["material"] or "",
                ]
            )
        for row in rows:
            item = items_by_id[row["id"]]
            parent_id = row["parent_id"]
            parent_item = items_by_id.get(parent_id) if parent_id is not None else None
            if parent_item is not None:
                parent_item.addChild(item)
            else:
                self.addTopLevelItem(item)
        self.expandAll()
        for i in range(len(_COLUMNS)):
            self.resizeColumnToContents(i)
