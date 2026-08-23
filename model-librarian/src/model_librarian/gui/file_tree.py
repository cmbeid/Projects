"""The file browser: a `QAbstractItemModel` that groups files by folder.

A scan walks arbitrarily nested folders, so a flat file list interleaves
files from unrelated directories alphabetically. This model rebuilds the
on-disk folder structure instead: a file directly under a scan root is a
top-level row same as before, but a file inside a subfolder (at any depth)
sits under a folder row for that subfolder, mirroring the real hierarchy.

Folder identity is keyed by (root_id, relative folder path) rather than
name alone, so two different scan roots that happen to share a subfolder
name (e.g. both have a "Misc" folder) don't get merged into one node.
"""

from __future__ import annotations

import os

from PySide6.QtCore import QAbstractItemModel, QModelIndex, Qt

from model_librarian.gui.format_utils import human_size

_COLUMNS = ("Name", "Ext", "Format", "Size", "Objects", "Triangles", "Status")

# Sort by the underlying numeric/text value rather than the formatted display
# string, so e.g. "999.3 KB" sorts before "1.1 MB" instead of after it.
SORT_ROLE = Qt.ItemDataRole.UserRole


class _Node:
    __slots__ = ("name", "is_folder", "children", "row", "parent", "total_size", "file_count")

    def __init__(self, name: str, is_folder: bool, parent: _Node | None = None, row=None):
        self.name = name
        self.is_folder = is_folder
        self.children: list[_Node] = []
        self.row = row  # dict of file columns for a file leaf; None for a folder
        self.parent = parent
        self.total_size = 0
        self.file_count = 0

    def row_in_parent(self) -> int:
        return self.parent.children.index(self) if self.parent is not None else 0


class FileTreeModel(QAbstractItemModel):
    def __init__(self, parent=None):
        super().__init__(parent)
        self._root = _Node("", is_folder=True)
        self._file_nodes_by_id: dict[int, _Node] = {}

    def set_rows(self, rows, root_paths: dict[int, str]) -> None:
        """rows: db.list_files() results. root_paths: root_id -> absolute scan path."""
        self.beginResetModel()
        self._root = _Node("", is_folder=True)
        self._file_nodes_by_id = {}
        folder_nodes: dict[tuple[int, str], _Node] = {}

        for raw in rows:
            row = dict(raw)
            root_path = root_paths.get(row["root_id"])
            rel_path = os.path.relpath(row["path"], root_path) if root_path else row["name"]
            rel_dir = os.path.dirname(rel_path)
            parts = [p for p in rel_dir.split(os.sep) if p not in ("", ".")]

            parent = self._root
            accum = ""
            for part in parts:
                accum = f"{accum}/{part}" if accum else part
                key = (row["root_id"], accum)
                node = folder_nodes.get(key)
                if node is None:
                    node = _Node(part, is_folder=True, parent=parent)
                    parent.children.append(node)
                    folder_nodes[key] = node
                parent = node

            file_node = _Node(row["name"], is_folder=False, parent=parent, row=row)
            parent.children.append(file_node)
            self._file_nodes_by_id[row["id"]] = file_node

        self._aggregate(self._root)
        self._sort_children(self._root)
        self.endResetModel()

    def _aggregate(self, node: _Node) -> None:
        if not node.is_folder:
            node.total_size = node.row["size"]
            node.file_count = 1
            return
        total_size = 0
        file_count = 0
        for child in node.children:
            self._aggregate(child)
            total_size += child.total_size
            file_count += child.file_count
        node.total_size = total_size
        node.file_count = file_count

    def _sort_children(self, node: _Node) -> None:
        node.children.sort(key=lambda n: (0 if n.is_folder else 1, n.name.lower()))
        for child in node.children:
            if child.is_folder:
                self._sort_children(child)

    def file_id_for_index(self, index: QModelIndex) -> int | None:
        if not index.isValid():
            return None
        node = index.internalPointer()
        if node.is_folder or node.row is None:
            return None
        return node.row["id"]

    def index_for_file_id(self, file_id: int) -> QModelIndex:
        """For syncing selection from another view (e.g. the treemap)."""
        node = self._file_nodes_by_id.get(file_id)
        if node is None:
            return QModelIndex()
        return self.createIndex(node.row_in_parent(), 0, node)

    # --- QAbstractItemModel plumbing ---

    def index(self, row: int, column: int, parent: QModelIndex = QModelIndex()) -> QModelIndex:  # noqa: B008
        if not self.hasIndex(row, column, parent):
            return QModelIndex()
        parent_node = parent.internalPointer() if parent.isValid() else self._root
        if row >= len(parent_node.children):
            return QModelIndex()
        return self.createIndex(row, column, parent_node.children[row])

    def parent(self, index: QModelIndex = QModelIndex()) -> QModelIndex:  # noqa: B008
        if not index.isValid():
            return QModelIndex()
        parent_node = index.internalPointer().parent
        if parent_node is None or parent_node is self._root:
            return QModelIndex()
        return self.createIndex(parent_node.row_in_parent(), 0, parent_node)

    def rowCount(self, parent: QModelIndex = QModelIndex()) -> int:  # noqa: B008
        if parent.column() > 0:
            return 0
        parent_node = parent.internalPointer() if parent.isValid() else self._root
        return len(parent_node.children)

    def columnCount(self, parent: QModelIndex = QModelIndex()) -> int:  # noqa: B008
        return len(_COLUMNS)

    def headerData(self, section, orientation, role=Qt.ItemDataRole.DisplayRole):
        if role != Qt.ItemDataRole.DisplayRole or orientation != Qt.Orientation.Horizontal:
            return None
        return _COLUMNS[section]

    def data(self, index: QModelIndex, role=Qt.ItemDataRole.DisplayRole):
        if not index.isValid() or role not in (Qt.ItemDataRole.DisplayRole, SORT_ROLE):
            return None
        node = index.internalPointer()
        column = _COLUMNS[index.column()]
        sort = role == SORT_ROLE

        if node.is_folder:
            if column == "Name":
                return node.name if sort else f"{node.name} ({node.file_count})"
            if column == "Size":
                return node.total_size if sort else human_size(node.total_size)
            return None

        row = node.row
        if column == "Name":
            return row["name"]
        if column == "Ext":
            return row["ext"]
        if column == "Format":
            return row["format"]
        if column == "Size":
            return row["size"] if sort else human_size(row["size"])
        if column == "Objects":
            return _object_sort_key(row) if sort else _format_object_count(row)
        if column == "Triangles":
            triangles = row.get("triangle_count")
            if sort:
                return -1 if triangles is None else triangles
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


def _object_sort_key(row: dict) -> int:
    defined = row.get("defined_object_count")
    return -1 if defined is None else defined
