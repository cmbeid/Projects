"""GUI smoke test (PLAN.md step 3): the window constructs, scans a fixture
directory, and selecting a row updates the detail tabs without exceptions.

Runs headless via the Qt "offscreen" platform plugin (set in conftest.py),
so it never requires a real display.
"""

from __future__ import annotations

import shutil

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

    # A single file directly under the scanned root is a top-level row, same
    # as before there was any folder grouping.
    assert window.tree_model.rowCount() == 1

    source_index = window.tree_model.index(0, 0)
    proxy_index = window.proxy_model.mapFromSource(source_index)
    window.tree_view.selectionModel().select(
        proxy_index,
        window.tree_view.selectionModel().SelectionFlag.ClearAndSelect
        | window.tree_view.selectionModel().SelectionFlag.Rows,
    )

    file_id = window.tree_model.file_id_for_index(source_index)
    assert file_id is not None
    assert "cube_binary.stl" in window.info_panel.toPlainText()
    assert window.objects_panel.topLevelItemCount() == 0  # STL has no object names


def test_main_window_groups_nested_files_by_folder(qtbot, tmp_path, binary_stl):
    nested_dir = tmp_path / "sub"
    nested_dir.mkdir()
    shutil.copy(binary_stl, nested_dir / "nested_cube.stl")

    db_path = tmp_path / "index.sqlite3"
    window = MainWindow(db_path=str(db_path))
    qtbot.addWidget(window)

    window.start_scan(str(tmp_path))
    with qtbot.waitSignal(window._scan_worker.finished_scan, timeout=15000):
        pass

    # The root-level file and the "sub" folder are both top-level rows; the
    # nested file sits under the folder row, not interleaved at top level.
    assert window.tree_model.rowCount() == 2
    names = {window.tree_model.index(i, 0).data() for i in range(2)}
    assert any("sub" in name for name in names)

    folder_index = next(
        window.tree_model.index(i, 0)
        for i in range(2)
        if "sub" in window.tree_model.index(i, 0).data()
    )
    assert window.tree_model.rowCount(folder_index) == 1
    child_index = window.tree_model.index(0, 0, folder_index)
    assert window.tree_model.file_id_for_index(child_index) is not None


def test_main_window_starts_empty(tmp_path, qtbot):
    db_path = tmp_path / "index.sqlite3"
    window = MainWindow(db_path=str(db_path))
    qtbot.addWidget(window)

    assert window.tree_model.rowCount() == 0
    assert window.info_panel.toPlainText() == ""


def test_cancel_action_enabled_only_while_scanning(qtbot, tmp_path, binary_stl):
    db_path = tmp_path / "index.sqlite3"
    window = MainWindow(db_path=str(db_path))
    qtbot.addWidget(window)

    assert window.cancel_action.isEnabled() is False
    assert window.open_action.isEnabled() is True

    window.start_scan(str(binary_stl.parent))
    assert window.cancel_action.isEnabled() is True
    assert window.open_action.isEnabled() is False

    with qtbot.waitSignal(window._scan_worker.finished, timeout=15000):
        pass

    assert window.cancel_action.isEnabled() is False
    assert window.open_action.isEnabled() is True


def test_treemap_selection_selects_matching_row_in_list(qtbot, tmp_path, binary_stl):
    db_path = tmp_path / "index.sqlite3"
    window = MainWindow(db_path=str(db_path))
    qtbot.addWidget(window)

    window.start_scan(str(binary_stl.parent))
    with qtbot.waitSignal(window._scan_worker.finished_scan, timeout=15000):
        pass

    file_id = window.treemap_view._rects[0].node.file_id
    window._on_view_file_selected(file_id)

    selected = window.tree_view.selectionModel().selectedRows()
    assert len(selected) == 1
    source_index = window.proxy_model.mapToSource(selected[0])
    assert window.tree_model.file_id_for_index(source_index) == file_id


def test_switching_to_duplicates_tab_triggers_a_refresh(qtbot, tmp_path, binary_stl):
    db_path = tmp_path / "index.sqlite3"
    window = MainWindow(db_path=str(db_path))
    qtbot.addWidget(window)

    window.start_scan(str(binary_stl.parent))
    with qtbot.waitSignal(window._scan_worker.finished_scan, timeout=15000):
        pass

    assert window.duplicates_view.is_stale is True
    window.browser_tabs.setCurrentWidget(window.duplicates_view)
    assert window.duplicates_view.is_stale is False
