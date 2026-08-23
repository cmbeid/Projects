"""TreemapView: wiring between the pure layout and the click-to-select signal."""

from __future__ import annotations

import pytest

pytest.importorskip("PySide6")

from PySide6.QtCore import QPointF, Qt  # noqa: E402

from model_librarian.gui.treemap_view import TreemapView  # noqa: E402


def _row(file_id, root_id, path, size=1000, ext=".stl"):
    return {
        "id": file_id,
        "root_id": root_id,
        "path": path,
        "name": path.rsplit("/", 1)[-1],
        "ext": ext,
        "size": size,
    }


def test_set_rows_lays_out_one_rect_per_file(qtbot):
    view = TreemapView()
    qtbot.addWidget(view)
    view.resize(400, 300)

    rows = [_row(1, 1, "/root/a.stl"), _row(2, 1, "/root/sub/b.stl")]
    view.set_rows(rows, {1: "/root"})

    assert len(view._rects) == 2
    assert {r.node.file_id for r in view._rects} == {1, 2}


def test_clicking_a_rect_emits_file_selected(qtbot):
    view = TreemapView()
    qtbot.addWidget(view)
    view.resize(400, 300)

    rows = [_row(1, 1, "/root/a.stl")]
    view.set_rows(rows, {1: "/root"})

    rect = view._rects[0]
    center = QPointF(rect.x + rect.w / 2, rect.y + rect.h / 2)

    with qtbot.waitSignal(view.fileSelected, timeout=1000) as blocker:
        qtbot.mouseClick(view, Qt.MouseButton.LeftButton, pos=center.toPoint())

    assert blocker.args == [1]


def test_empty_view_has_no_rects(qtbot):
    view = TreemapView()
    qtbot.addWidget(view)
    view.resize(400, 300)

    view.set_rows([], {})

    assert view._rects == []
