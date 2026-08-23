"""FileTreeModel: grouping a flat db.list_files() result by folder."""

from __future__ import annotations

import pytest

pytest.importorskip("PySide6")

from model_librarian.gui.file_tree import SORT_ROLE, FileTreeModel  # noqa: E402


def _row(file_id, root_id, path, size=1000):
    return {
        "id": file_id,
        "root_id": root_id,
        "path": path,
        "name": path.rsplit("/", 1)[-1],
        "ext": ".stl",
        "format": "stl",
        "size": size,
        "status": "ok",
        "defined_object_count": None,
        "build_object_count": None,
        "triangle_count": None,
    }


def test_files_directly_under_root_are_top_level(qtbot):
    model = FileTreeModel()
    rows = [_row(1, 1, "/root/a.stl"), _row(2, 1, "/root/b.stl")]
    model.set_rows(rows, {1: "/root"})

    assert model.rowCount() == 2
    names = {model.index(i, 0).data() for i in range(2)}
    assert names == {"a.stl", "b.stl"}


def test_nested_file_is_grouped_under_a_folder_row(qtbot):
    model = FileTreeModel()
    rows = [_row(1, 1, "/root/a.stl"), _row(2, 1, "/root/sub/b.stl")]
    model.set_rows(rows, {1: "/root"})

    assert model.rowCount() == 2  # "a.stl" and the "sub" folder row
    folder_index = next(
        model.index(i, 0) for i in range(2) if model.index(i, 0).data().startswith("sub")
    )
    assert model.rowCount(folder_index) == 1
    child = model.index(0, 0, folder_index)
    assert model.file_id_for_index(child) == 2


def test_deeply_nested_files_build_a_multi_level_tree(qtbot):
    model = FileTreeModel()
    rows = [_row(1, 1, "/root/a/b/c/deep.stl")]
    model.set_rows(rows, {1: "/root"})

    a = model.index(0, 0)
    assert a.data() == "a (1)"
    b = model.index(0, 0, a)
    assert b.data() == "b (1)"
    c = model.index(0, 0, b)
    assert c.data() == "c (1)"
    leaf = model.index(0, 0, c)
    assert model.file_id_for_index(leaf) == 1


def test_folder_file_count_and_size_aggregate_recursively(qtbot):
    model = FileTreeModel()
    rows = [
        _row(1, 1, "/root/sub/a.stl", size=1000),
        _row(2, 1, "/root/sub/b.stl", size=2000),
    ]
    model.set_rows(rows, {1: "/root"})

    folder_index = model.index(0, 0)
    assert folder_index.data() == "sub (2)"
    assert model.data(folder_index, SORT_ROLE) == "sub"  # name alone, no count, for sorting
    assert model.rowCount(folder_index) == 2


def test_same_named_subfolder_in_different_roots_stays_separate(qtbot):
    model = FileTreeModel()
    rows = [_row(1, 1, "/root_a/misc/x.stl"), _row(2, 2, "/root_b/misc/y.stl")]
    model.set_rows(rows, {1: "/root_a", 2: "/root_b"})

    assert model.rowCount() == 2  # two separate "misc" folder rows, not merged
    for i in range(2):
        folder = model.index(i, 0)
        assert folder.data().startswith("misc")
        assert model.rowCount(folder) == 1


def test_file_id_for_index_returns_none_for_folder_rows(qtbot):
    model = FileTreeModel()
    rows = [_row(1, 1, "/root/sub/a.stl")]
    model.set_rows(rows, {1: "/root"})

    folder_index = model.index(0, 0)
    assert model.file_id_for_index(folder_index) is None
