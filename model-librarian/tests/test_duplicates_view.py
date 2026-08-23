"""DuplicatesView: turning core/dupes.py's findings into clickable rows."""

from __future__ import annotations

import pytest

pytest.importorskip("PySide6")

from model_librarian.core import db, fingerprint, probe  # noqa: E402
from model_librarian.gui.duplicates_view import DuplicatesView  # noqa: E402


def _index_with_fingerprint(conn, root_id, path):
    facts = probe.probe_path(str(path))
    file_id = db.upsert_file_facts(conn, root_id, facts)
    fp = fingerprint.compute_file_fingerprint(str(path), facts.ext)
    if fp is not None:
        db.set_fingerprint(conn, file_id, fp)
    return file_id


def test_starts_stale_with_a_not_scanned_message(qtbot):
    conn = db.connect(":memory:")
    view = DuplicatesView(conn)
    qtbot.addWidget(view)

    assert view.is_stale is True
    assert "Not yet scanned" in view._summary_label.text()


def test_refresh_lists_byte_duplicate_group_and_selecting_emits_file_id(
    qtbot, tmp_path, binary_stl
):
    duplicate_path = tmp_path / "copy_of_cube.stl"
    duplicate_path.write_bytes(binary_stl.read_bytes())

    conn = db.connect(":memory:")
    root_id = db.upsert_scan_root(conn, str(tmp_path))
    id_a = _index_with_fingerprint(conn, root_id, binary_stl)
    id_b = _index_with_fingerprint(conn, root_id, duplicate_path)

    view = DuplicatesView(conn)
    qtbot.addWidget(view)
    view.refresh()

    assert view.is_stale is False
    assert view._tree.topLevelItemCount() >= 1
    assert "1 byte-identical group" in view._summary_label.text()

    # Section -> group -> two file leaves.
    section = view._tree.topLevelItem(0)
    group = section.child(0)
    assert group.childCount() == 2

    leaf = group.child(0)
    with qtbot.waitSignal(view.fileSelected, timeout=1000) as blocker:
        view._on_item_clicked(leaf, 0)
    assert blocker.args[0] in (id_a, id_b)


def test_refresh_with_no_findings_reports_none_found(qtbot, tmp_path, binary_stl):
    conn = db.connect(":memory:")
    root_id = db.upsert_scan_root(conn, str(tmp_path))
    _index_with_fingerprint(conn, root_id, binary_stl)

    view = DuplicatesView(conn)
    qtbot.addWidget(view)
    view.refresh()

    assert view.is_stale is False
    assert view._tree.topLevelItemCount() == 0
    assert "No duplicates or clutter" in view._summary_label.text()


def test_mark_stale_relabels_without_clearing_results(qtbot, tmp_path, binary_stl):
    duplicate_path = tmp_path / "copy_of_cube.stl"
    duplicate_path.write_bytes(binary_stl.read_bytes())

    conn = db.connect(":memory:")
    root_id = db.upsert_scan_root(conn, str(tmp_path))
    _index_with_fingerprint(conn, root_id, binary_stl)
    _index_with_fingerprint(conn, root_id, duplicate_path)

    view = DuplicatesView(conn)
    qtbot.addWidget(view)
    view.refresh()
    assert view._tree.topLevelItemCount() >= 1

    view.mark_stale()

    assert view.is_stale is True
    assert "may be out of date" in view._summary_label.text()
    assert view._tree.topLevelItemCount() >= 1  # stale, not cleared
