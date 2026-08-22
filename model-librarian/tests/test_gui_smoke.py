"""GUI smoke test (PLAN.md step 3): the window constructs, scans a fixture
directory, and selecting a row updates the detail tabs without exceptions.

Runs headless via the Qt "offscreen" platform plugin (set in conftest.py),
so it never requires a real display.
"""

from __future__ import annotations

import pytest

pytest.importorskip("PySide6")

from model_librarian.gui.main_window import MainWindow  # noqa: E402


def test_main_window_scans_and_selects_row(qtbot, tmp_path, binary_stl):
    db_path = tmp_path / "index.sqlite3"
    window = MainWindow(db_path=str(db_path))
    qtbot.addWidget(window)

    window.start_scan(str(binary_stl.parent))
    with qtbot.waitSignal(window._scan_worker.finished_scan, timeout=15000):
        pass

    assert window.table_model.rowCount() == 1

    window.table_view.selectRow(0)
    file_id = window.table_model.file_id_at(0)
    assert file_id is not None
    assert "cube_binary.stl" in window.info_panel.toPlainText()
    assert window.objects_panel.topLevelItemCount() == 0  # STL has no object names


def test_main_window_starts_empty(tmp_path, qtbot):
    db_path = tmp_path / "index.sqlite3"
    window = MainWindow(db_path=str(db_path))
    qtbot.addWidget(window)

    assert window.table_model.rowCount() == 0
    assert window.info_panel.toPlainText() == ""
