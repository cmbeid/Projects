"""The main window: search bar, folder-grouped file tree, and detail tabs.

`_scan_worker` runs on a `QThread` (gui/workers.py) so indexing hundreds of
files never blocks this event loop; results are pulled back into the tree
via `refresh_table()` once a scan completes.
"""

from __future__ import annotations

from PySide6.QtCore import QItemSelectionModel, QSortFilterProxyModel, Qt
from PySide6.QtGui import QAction
from PySide6.QtWidgets import (
    QAbstractItemView,
    QFileDialog,
    QLineEdit,
    QMainWindow,
    QSplitter,
    QTabWidget,
    QToolBar,
    QTreeView,
    QVBoxLayout,
    QWidget,
)

from model_librarian.core import appdirs, db
from model_librarian.gui.details.info import InfoPanel
from model_librarian.gui.details.objects import ObjectsPanel
from model_librarian.gui.details.preview import PreviewPanel
from model_librarian.gui.details.settings import SettingsPanel
from model_librarian.gui.duplicates_view import DuplicatesView
from model_librarian.gui.file_tree import SORT_ROLE, FileTreeModel
from model_librarian.gui.treemap_view import TreemapView
from model_librarian.gui.workers import ScanWorker


class MainWindow(QMainWindow):
    def __init__(self, db_path: str | None = None, parent=None):
        super().__init__(parent)
        self.setWindowTitle("Model Librarian")
        self.resize(1200, 800)

        self.db_path = db_path or appdirs.default_db_path()
        self.conn = db.connect(self.db_path)
        self._scan_worker: ScanWorker | None = None
        self._scanned_count = 0
        self._scan_ended_normally = False

        self._build_ui()
        self.refresh_table()

    def _build_ui(self) -> None:
        toolbar = QToolBar("Main", self)
        self.addToolBar(toolbar)

        self.open_action = QAction("Open Folder…", self)
        self.open_action.triggered.connect(self._on_open_folder)
        toolbar.addAction(self.open_action)

        self.cancel_action = QAction("Cancel", self)
        self.cancel_action.setEnabled(False)
        self.cancel_action.triggered.connect(self._on_cancel_clicked)
        toolbar.addAction(self.cancel_action)

        self.filter_edit = QLineEdit(self)
        self.filter_edit.setPlaceholderText("Filter by name…")
        self.filter_edit.textChanged.connect(self._on_filter_changed)
        toolbar.addWidget(self.filter_edit)

        self.tree_model = FileTreeModel(self)
        self.proxy_model = QSortFilterProxyModel(self)
        self.proxy_model.setSourceModel(self.tree_model)
        self.proxy_model.setFilterCaseSensitivity(Qt.CaseSensitivity.CaseInsensitive)
        self.proxy_model.setFilterKeyColumn(0)
        self.proxy_model.setRecursiveFilteringEnabled(True)
        self.proxy_model.setSortRole(SORT_ROLE)

        self.tree_view = QTreeView(self)
        self.tree_view.setModel(self.proxy_model)
        self.tree_view.setSelectionBehavior(QAbstractItemView.SelectionBehavior.SelectRows)
        self.tree_view.setSelectionMode(QAbstractItemView.SelectionMode.SingleSelection)
        self.tree_view.setSortingEnabled(True)
        self.tree_view.setUniformRowHeights(True)
        self.tree_view.header().setStretchLastSection(True)
        self.tree_view.selectionModel().selectionChanged.connect(self._on_selection_changed)

        self.treemap_view = TreemapView(self)
        self.treemap_view.fileSelected.connect(self._on_view_file_selected)

        self.duplicates_view = DuplicatesView(self.conn, self)
        self.duplicates_view.fileSelected.connect(self._on_view_file_selected)

        self.browser_tabs = QTabWidget(self)
        self.browser_tabs.addTab(self.tree_view, "List")
        self.browser_tabs.addTab(self.treemap_view, "Treemap")
        self.browser_tabs.addTab(self.duplicates_view, "Duplicates")
        self.browser_tabs.currentChanged.connect(self._on_browser_tab_changed)

        self.preview_panel = PreviewPanel(self.conn)
        self.objects_panel = ObjectsPanel()
        self.settings_panel = SettingsPanel()
        self.info_panel = InfoPanel()

        self.detail_tabs = QTabWidget(self)
        self.detail_tabs.addTab(self.preview_panel, "Preview")
        self.detail_tabs.addTab(self.objects_panel, "Objects")
        self.detail_tabs.addTab(self.settings_panel, "Settings")
        self.detail_tabs.addTab(self.info_panel, "Info")

        splitter = QSplitter(self)
        splitter.addWidget(self.browser_tabs)
        splitter.addWidget(self.detail_tabs)
        splitter.setStretchFactor(0, 2)
        splitter.setStretchFactor(1, 1)

        central = QWidget(self)
        layout = QVBoxLayout(central)
        layout.addWidget(splitter)
        self.setCentralWidget(central)

        self.statusBar().showMessage("Ready")

    def _on_open_folder(self) -> None:
        directory = QFileDialog.getExistingDirectory(self, "Choose a folder to index")
        if directory:
            self.start_scan(directory)

    def start_scan(self, directory: str) -> None:
        if self._scan_worker is not None and self._scan_worker.isRunning():
            return
        self._scanned_count = 0
        self._scan_ended_normally = False
        self.statusBar().showMessage(f"Indexing {directory}…")
        self.open_action.setEnabled(False)
        self.cancel_action.setEnabled(True)

        self._scan_worker = ScanWorker(self.db_path, directory, self)
        self._scan_worker.file_done.connect(self._on_file_done)
        self._scan_worker.finished_scan.connect(self._on_scan_finished)
        self._scan_worker.failed.connect(self._on_scan_failed)
        self._scan_worker.finished.connect(self._on_scan_thread_finished)
        self._scan_worker.start()

    def _on_cancel_clicked(self) -> None:
        if self._scan_worker is not None and self._scan_worker.isRunning():
            self._scan_worker.cancel()
            self.statusBar().showMessage("Cancelling…")

    def _on_file_done(self, path: str, cached: bool) -> None:
        self._scanned_count += 1
        verb = "cached" if cached else "indexed"
        self.statusBar().showMessage(f"{self._scanned_count} files {verb} so far… ({path})")

    def _on_scan_finished(self, stats) -> None:
        self._scan_ended_normally = True
        self.statusBar().showMessage(
            f"Scanned {stats.scanned} files: {stats.probed} probed, {stats.cached} cached, "
            f"{stats.errors} errors, {stats.missing} newly missing."
        )
        self.refresh_table()

    def _on_scan_failed(self, message: str) -> None:
        self._scan_ended_normally = True
        self.statusBar().showMessage(f"Scan failed: {message}")

    def _on_scan_thread_finished(self) -> None:
        # finished_scan/failed are skipped entirely on cancellation, so this
        # QThread-native signal (which always fires) is what resets the
        # buttons and reports a cancellation the other two signals can't.
        self.open_action.setEnabled(True)
        self.cancel_action.setEnabled(False)
        if not self._scan_ended_normally:
            self.statusBar().showMessage("Scan cancelled.")

    def refresh_table(self) -> None:
        root_paths = {row["id"]: row["path"] for row in db.list_scan_roots(self.conn)}
        rows = db.list_files(self.conn)
        self.tree_model.set_rows(rows, root_paths)
        self.tree_view.expandAll()
        self.treemap_view.set_rows(rows, root_paths)
        self.duplicates_view.mark_stale()

    def _on_filter_changed(self, text: str) -> None:
        self.proxy_model.setFilterFixedString(text)

    def _on_selection_changed(self, *_args) -> None:
        indexes = self.tree_view.selectionModel().selectedRows()
        if not indexes:
            self._show_file(None)
            return
        source_index = self.proxy_model.mapToSource(indexes[0])
        self._show_file(self.tree_model.file_id_for_index(source_index))

    def _on_view_file_selected(self, file_id: int) -> None:
        """Shared by the Treemap and Duplicates tabs, whose selection model
        isn't the tree's — each just emits a plain file id."""
        self._show_file(file_id)

        # Keep the List tab's selection in sync so switching tabs doesn't
        # lose track of what's currently shown in the detail panels.
        source_index = self.tree_model.index_for_file_id(file_id)
        if not source_index.isValid():
            return
        proxy_index = self.proxy_model.mapFromSource(source_index)
        self.tree_view.selectionModel().select(
            proxy_index,
            QItemSelectionModel.SelectionFlag.ClearAndSelect
            | QItemSelectionModel.SelectionFlag.Rows,
        )
        self.tree_view.scrollTo(proxy_index)

    def _on_browser_tab_changed(self, _index: int) -> None:
        if (
            self.browser_tabs.currentWidget() is self.duplicates_view
            and self.duplicates_view.is_stale
        ):
            self.duplicates_view.refresh()

    def _show_file(self, file_id: int | None) -> None:
        if file_id is None:
            self.preview_panel.clear()
            self.objects_panel.clear()
            self.settings_panel.clear()
            self.info_panel.clear()
            return

        row = self.conn.execute("SELECT * FROM files WHERE id = ?", (file_id,)).fetchone()
        objects = db.get_objects(self.conn, file_id)
        settings = db.get_settings(self.conn, file_id)
        metadata_rows = self.conn.execute(
            "SELECT key, value FROM metadata WHERE file_id = ?", (file_id,)
        ).fetchall()
        external_refs = self.conn.execute(
            "SELECT kind, ref, resolved FROM external_refs WHERE file_id = ?", (file_id,)
        ).fetchall()

        self.preview_panel.show_file(row)
        self.objects_panel.show_objects(objects)
        self.settings_panel.show_settings(settings)
        self.info_panel.show_file(row, metadata_rows, external_refs)
