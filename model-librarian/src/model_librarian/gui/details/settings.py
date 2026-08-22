"""Settings tab: normalized slicer config, grouped by source, with a filter box."""

from __future__ import annotations

from PySide6.QtCore import QSortFilterProxyModel, Qt
from PySide6.QtGui import QStandardItem, QStandardItemModel
from PySide6.QtWidgets import QLineEdit, QTableView, QVBoxLayout, QWidget


class SettingsPanel(QWidget):
    def __init__(self, parent=None):
        super().__init__(parent)

        self._model = QStandardItemModel(0, 3, self)
        self._model.setHorizontalHeaderLabels(["Source", "Key", "Value"])

        self._proxy = QSortFilterProxyModel(self)
        self._proxy.setSourceModel(self._model)
        self._proxy.setFilterCaseSensitivity(Qt.CaseSensitivity.CaseInsensitive)
        self._proxy.setFilterKeyColumn(-1)  # search across all columns

        self._filter_edit = QLineEdit()
        self._filter_edit.setPlaceholderText("Filter settings…")
        self._filter_edit.textChanged.connect(self._proxy.setFilterFixedString)

        self._view = QTableView()
        self._view.setModel(self._proxy)
        self._view.setSortingEnabled(True)
        self._view.horizontalHeader().setStretchLastSection(True)

        layout = QVBoxLayout(self)
        layout.addWidget(self._filter_edit)
        layout.addWidget(self._view)

    def clear(self) -> None:
        self._model.setRowCount(0)

    def show_settings(self, rows) -> None:
        self._model.setRowCount(0)
        for row in rows:
            self._model.appendRow(
                [
                    QStandardItem(row["source"]),
                    QStandardItem(row["key"]),
                    QStandardItem(row["value"]),
                ]
            )
