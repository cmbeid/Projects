"""Squarified treemap layout (Bruls/Huizing/van Wijk 1999) over the same
folder hierarchy `gui/file_tree.py` groups the browser by — for a
WinDirStat-style "what's actually taking up space" view.

Qt-free by design (PLAN.md's core/GUI split): `build_tree` turns a flat
`db.list_files()` result into a plain node tree, and `layout` recursively
packs each folder's children into its allotted rectangle, minimizing worst
aspect ratio row by row. `gui/treemap_view.py` only has to paint the
rectangles this returns.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field


@dataclass
class TreemapNode:
    name: str
    size: int = 0
    is_folder: bool = True
    file_id: int | None = None
    ext: str | None = None
    children: list[TreemapNode] = field(default_factory=list)


@dataclass(frozen=True, slots=True)
class TreemapRect:
    x: float
    y: float
    w: float
    h: float
    node: TreemapNode


def build_tree(rows, root_paths: dict[int, str]) -> TreemapNode:
    """Mirror file_tree.FileTreeModel's folder grouping as plain dataclasses."""
    root = TreemapNode(name="", is_folder=True)
    folder_nodes: dict[tuple[int, str], TreemapNode] = {}

    for raw in rows:
        row = dict(raw)
        root_path = root_paths.get(row["root_id"])
        rel_path = os.path.relpath(row["path"], root_path) if root_path else row["name"]
        rel_dir = os.path.dirname(rel_path)
        parts = [p for p in rel_dir.split(os.sep) if p not in ("", ".")]

        parent = root
        accum = ""
        for part in parts:
            accum = f"{accum}/{part}" if accum else part
            key = (row["root_id"], accum)
            node = folder_nodes.get(key)
            if node is None:
                node = TreemapNode(name=part, is_folder=True)
                parent.children.append(node)
                folder_nodes[key] = node
            parent = node

        parent.children.append(
            TreemapNode(
                name=row["name"],
                size=row["size"],
                is_folder=False,
                file_id=row["id"],
                ext=row["ext"],
            )
        )

    _aggregate(root)
    return root


def _aggregate(node: TreemapNode) -> int:
    if not node.is_folder:
        return node.size
    node.size = sum(_aggregate(child) for child in node.children)
    return node.size


def layout(node: TreemapNode, x: float, y: float, w: float, h: float) -> list[TreemapRect]:
    """Recursively lay `node`'s children out into the given rectangle."""
    if w <= 0 or h <= 0:
        return []
    children = sorted((c for c in node.children if c.size > 0), key=lambda c: c.size, reverse=True)
    if not children:
        return []

    total = sum(c.size for c in children)
    scale = (w * h) / total
    areas = [c.size * scale for c in children]
    placements = _squarify_areas(areas, x, y, w, h)

    result: list[TreemapRect] = []
    for child, (rx, ry, rw, rh) in zip(children, placements, strict=True):
        if child.is_folder:
            result.extend(layout(child, rx, ry, rw, rh))
        else:
            result.append(TreemapRect(rx, ry, rw, rh, child))
    return result


def _worst_ratio(row: list[float], side: float) -> float:
    total = sum(row)
    if total <= 0 or side <= 0:
        return float("inf")
    row_max, row_min = max(row), min(row)
    side_sq, total_sq = side * side, total * total
    return max((side_sq * row_max) / total_sq, total_sq / (side_sq * row_min))


def _layout_row(
    row: list[float], x: float, y: float, w: float, h: float
) -> tuple[list[tuple[float, float, float, float]], float, float, float, float]:
    """Place `row` (a list of areas) as a strip along the rectangle's shorter
    side, and return the placements plus the rectangle remaining after it."""
    total = sum(row)
    rects = []
    if w >= h:
        strip_w = total / h
        cy = y
        for area in row:
            rh = area / strip_w
            rects.append((x, cy, strip_w, rh))
            cy += rh
        return rects, x + strip_w, y, w - strip_w, h
    else:
        strip_h = total / w
        cx = x
        for area in row:
            rw = area / strip_h
            rects.append((cx, y, rw, strip_h))
            cx += rw
        return rects, x, y + strip_h, w, h - strip_h


def _squarify_areas(
    areas: list[float], x: float, y: float, w: float, h: float
) -> list[tuple[float, float, float, float]]:
    result: list[tuple[float, float, float, float]] = []
    remaining = list(areas)
    while remaining:
        if w <= 0 or h <= 0:
            # Rounding can exhaust the rect a hair before the last item; give
            # any leftovers a zero-size placement rather than crash.
            result.extend((x, y, 0.0, 0.0) for _ in remaining)
            break
        side = min(w, h)
        row = [remaining[0]]
        i = 1
        while i < len(remaining) and _worst_ratio([*row, remaining[i]], side) <= _worst_ratio(
            row, side
        ):
            row.append(remaining[i])
            i += 1
        row_rects, x, y, w, h = _layout_row(row, x, y, w, h)
        result.extend(row_rects)
        remaining = remaining[len(row) :]
    return result
