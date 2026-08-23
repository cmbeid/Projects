"""Duplicates & clutter view: surfaces core/dupes.py's findings as a
browsable, clickable list — never as automatic actions (PLAN.md: "findings
to review"). Byte-identical and geometry-identical groups, loose files also
found inside a project, and lightweight clutter flags each get their own
section; clicking a file row selects it the same way the List/Treemap tabs
do, via a `fileSelected` signal.

Deliberately not recomputed on every scan: `find_byte_duplicates` reads file
contents (head/tail hashes, and full hashes for real candidates), so it's
cheap but not free. Results are computed on demand — first time the tab is
opened, or via the Refresh button — and `mark_stale()` just relabels them as
possibly outdated after a rescan rather than eagerly recomputing.
"""

from __future__ import annotations

import sqlite3

from PySide6.QtCore import Qt, Signal
from PySide6.QtWidgets import (
    QHBoxLayout,
    QLabel,
    QPushButton,
    QTreeWidget,
    QTreeWidgetItem,
    QVBoxLayout,
    QWidget,
)

from model_librarian.core import db, dupes
from model_librarian.gui.format_utils import human_size

_FILE_ID_ROLE = Qt.ItemDataRole.UserRole
_NOT_SCANNED_TEXT = "Not yet scanned for duplicates — click Scan."
_STALE_TEXT = "Results may be out of date after the last scan — click Scan to refresh."


class DuplicatesView(QWidget):
    fileSelected = Signal(int)

    def __init__(self, conn: sqlite3.Connection, parent=None):
        super().__init__(parent)
        self._conn = conn
        self.is_stale = True

        self._summary_label = QLabel(_NOT_SCANNED_TEXT)
        self._refresh_button = QPushButton("Scan for Duplicates")
        self._refresh_button.clicked.connect(self.refresh)

        top = QHBoxLayout()
        top.addWidget(self._summary_label, stretch=1)
        top.addWidget(self._refresh_button)

        self._tree = QTreeWidget()
        self._tree.setHeaderLabels(["Finding", "Size", "Path"])
        self._tree.itemClicked.connect(self._on_item_clicked)

        layout = QVBoxLayout(self)
        layout.addLayout(top)
        layout.addWidget(self._tree)

    def mark_stale(self) -> None:
        self.is_stale = True
        self._summary_label.setText(_STALE_TEXT)

    def refresh(self) -> None:
        self._tree.clear()

        byte_groups = dupes.find_byte_duplicates(self._conn)
        geometry_groups = dupes.find_geometry_duplicates(self._conn)
        contained = dupes.find_contained_in(self._conn)
        clutter = dupes.find_clutter(self._conn)

        self._add_group_section(
            "Byte-identical duplicates",
            byte_groups,
            lambda g: g.file_ids,
            lambda count, row: f"{count} identical files ({human_size(row['size'])} each)",
        )
        self._add_group_section(
            "Geometrically identical (may differ in file format)",
            geometry_groups,
            lambda g: g.file_ids,
            lambda count, row: f"{count} matching-geometry files",
        )
        self._add_contained_section(contained)
        self._add_clutter_section(clutter)

        self._tree.expandAll()
        self.is_stale = False
        total = len(byte_groups) + len(geometry_groups) + len(contained) + len(clutter)
        if total == 0:
            self._summary_label.setText("No duplicates or clutter found.")
        else:
            self._summary_label.setText(
                f"{len(byte_groups)} byte-identical group(s), "
                f"{len(geometry_groups)} geometry-identical group(s), "
                f"{len(contained)} loose file(s) found inside a project, "
                f"{len(clutter)} clutter flag(s)."
            )

    def _add_group_section(self, title, groups, ids_fn, label_fn) -> None:
        if not groups:
            return
        section = QTreeWidgetItem(self._tree, [title, "", ""])
        section.setFirstColumnSpanned(True)
        for group in groups:
            ids = ids_fn(group)
            rows_by_id = self._rows_by_id(ids)
            ordered = [rows_by_id[i] for i in ids if i in rows_by_id]
            if not ordered:
                continue
            group_item = QTreeWidgetItem(section, [label_fn(len(ordered), ordered[0]), "", ""])
            for row in ordered:
                self._add_file_item(group_item, row)

    def _add_contained_section(self, matches) -> None:
        if not matches:
            return
        section = QTreeWidgetItem(self._tree, ["Loose files also found inside a project", "", ""])
        section.setFirstColumnSpanned(True)
        ids = {m.loose_file_id for m in matches} | {m.container_file_id for m in matches}
        rows_by_id = self._rows_by_id(ids)
        for match in matches:
            loose = rows_by_id.get(match.loose_file_id)
            container = rows_by_id.get(match.container_file_id)
            if loose is None or container is None:
                continue
            label = f'{loose["name"]} — inside {container["name"]} as "{match.object_name}"'
            item = QTreeWidgetItem(section, [label, human_size(loose["size"]), loose["path"]])
            item.setData(0, _FILE_ID_ROLE, match.loose_file_id)

    def _add_clutter_section(self, flags) -> None:
        if not flags:
            return
        section = QTreeWidgetItem(self._tree, ["Clutter flags", "", ""])
        section.setFirstColumnSpanned(True)
        rows_by_id = self._rows_by_id({f.file_id for f in flags})
        for flag in flags:
            row = rows_by_id.get(flag.file_id)
            if row is None:
                continue
            item = QTreeWidgetItem(
                section, [f"{row['name']} — {flag.reason}", human_size(row["size"]), row["path"]]
            )
            item.setData(0, _FILE_ID_ROLE, flag.file_id)

    def _add_file_item(self, parent: QTreeWidgetItem, row: sqlite3.Row) -> None:
        item = QTreeWidgetItem(parent, [row["name"], human_size(row["size"]), row["path"]])
        item.setData(0, _FILE_ID_ROLE, row["id"])

    def _rows_by_id(self, ids) -> dict[int, sqlite3.Row]:
        return {row["id"]: row for row in db.get_files_by_ids(self._conn, ids)}

    def _on_item_clicked(self, item: QTreeWidgetItem, _column: int) -> None:
        file_id = item.data(0, _FILE_ID_ROLE)
        if file_id is not None:
            self.fileSelected.emit(file_id)
