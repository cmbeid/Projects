"""core/treemap.py: squarified layout over the folder hierarchy build_tree
groups files into. Pure logic, no Qt needed."""

from __future__ import annotations

from model_librarian.core.treemap import build_tree, layout


def _row(file_id, root_id, path, size=1000, ext=".stl"):
    return {
        "id": file_id,
        "root_id": root_id,
        "path": path,
        "name": path.rsplit("/", 1)[-1],
        "ext": ext,
        "size": size,
    }


def test_build_tree_groups_nested_files_like_file_tree_model():
    rows = [_row(1, 1, "/root/a.stl"), _row(2, 1, "/root/sub/b.stl")]
    tree = build_tree(rows, {1: "/root"})

    assert len(tree.children) == 2  # "a.stl" leaf and the "sub" folder
    sub = next(c for c in tree.children if c.is_folder)
    assert sub.name == "sub"
    assert len(sub.children) == 1
    assert sub.children[0].file_id == 2


def test_build_tree_aggregates_folder_size_recursively():
    rows = [
        _row(1, 1, "/root/sub/a.stl", size=1000),
        _row(2, 1, "/root/sub/b.stl", size=2000),
    ]
    tree = build_tree(rows, {1: "/root"})

    sub = next(c for c in tree.children if c.is_folder)
    assert sub.size == 3000
    assert tree.size == 3000


def test_layout_conserves_total_area_for_flat_files():
    rows = [_row(1, 1, "/root/a.stl", size=1000), _row(2, 1, "/root/b.stl", size=3000)]
    tree = build_tree(rows, {1: "/root"})

    rects = layout(tree, 0.0, 0.0, 200.0, 100.0)

    assert len(rects) == 2
    total_area = sum(r.w * r.h for r in rects)
    assert total_area == 200.0 * 100.0

    # The larger file gets the larger rectangle.
    by_id = {r.node.file_id: r for r in rects}
    assert by_id[2].w * by_id[2].h > by_id[1].w * by_id[1].h


def test_layout_places_leaves_only_recurses_through_folders():
    rows = [_row(1, 1, "/root/sub/deep.stl", size=1000), _row(2, 1, "/root/other.stl", size=500)]
    tree = build_tree(rows, {1: "/root"})

    rects = layout(tree, 0.0, 0.0, 100.0, 100.0)

    assert {r.node.file_id for r in rects} == {1, 2}
    assert all(not r.node.is_folder for r in rects)


def test_nested_folder_rects_stay_within_parent_bounds():
    rows = [
        _row(1, 1, "/root/sub/a.stl", size=1000),
        _row(2, 1, "/root/sub/b.stl", size=1000),
        _row(3, 1, "/root/other.stl", size=2000),
    ]
    tree = build_tree(rows, {1: "/root"})

    rects = layout(tree, 0.0, 0.0, 300.0, 100.0)

    for rect in rects:
        assert rect.x >= 0.0
        assert rect.y >= 0.0
        assert rect.x + rect.w <= 300.0 + 1e-6
        assert rect.y + rect.h <= 100.0 + 1e-6


def test_layout_handles_zero_size_files_without_crashing():
    rows = [_row(1, 1, "/root/empty.stl", size=0), _row(2, 1, "/root/real.stl", size=1000)]
    tree = build_tree(rows, {1: "/root"})

    rects = layout(tree, 0.0, 0.0, 100.0, 100.0)

    # Zero-size files contribute nothing to the layout, but must not crash it.
    assert {r.node.file_id for r in rects} == {2}


def test_layout_empty_tree_returns_no_rects():
    tree = build_tree([], {})
    assert layout(tree, 0.0, 0.0, 100.0, 100.0) == []
