"""Recursive folder walk with change detection.

Qt-free: a plain generator plus a `scan()` entry point that the CLI calls
directly and a GUI `QThread` can wrap without any core-level dependency on
Qt. A rescan of an unchanged library is pure `stat` work — the tier-1
probe only runs when `(size, mtime_ns)` or `PROBE_VERSION` has changed.
"""

from __future__ import annotations

import os
from collections.abc import Callable, Iterator
from dataclasses import dataclass

from model_librarian.core import db
from model_librarian.core.probe import SUPPORTED_EXTENSIONS, probe_path


@dataclass
class ScanStats:
    scanned: int = 0
    probed: int = 0
    cached: int = 0
    errors: int = 0
    missing: int = 0


ProgressCallback = Callable[[str, bool], None]  # (path, was_cached)


def iter_candidate_paths(root: str) -> Iterator[str]:
    """Recursively yield paths under `root` with a supported extension."""
    stack = [root]
    while stack:
        current = stack.pop()
        try:
            entries = list(os.scandir(current))
        except OSError:
            continue
        for entry in entries:
            try:
                if entry.is_dir(follow_symlinks=False):
                    stack.append(entry.path)
                elif entry.is_file(follow_symlinks=False):
                    ext = os.path.splitext(entry.name)[1].lower()
                    if ext in SUPPORTED_EXTENSIONS:
                        yield entry.path
            except OSError:
                continue


def scan(
    conn,
    root_path: str,
    *,
    probe_version: int = db.PROBE_VERSION,
    on_progress: ProgressCallback | None = None,
) -> ScanStats:
    """Walk `root_path`, probing only files that are new or changed."""
    root_path = os.path.abspath(root_path)
    root_id = db.upsert_scan_root(conn, root_path)
    stats = ScanStats()
    seen_paths: set[str] = set()

    for path in iter_candidate_paths(root_path):
        seen_paths.add(path)
        stats.scanned += 1
        try:
            st = os.stat(path)
        except OSError:
            stats.errors += 1
            continue

        cached = db.get_file_by_path(conn, path)
        unchanged = (
            cached is not None
            and cached["size"] == st.st_size
            and cached["mtime_ns"] == st.st_mtime_ns
            and cached["probe_version"] == probe_version
        )
        if unchanged:
            stats.cached += 1
            if on_progress:
                on_progress(path, True)
            continue

        facts = probe_path(path)
        if facts.error:
            stats.errors += 1
        db.upsert_file_facts(conn, root_id, facts, probe_version=probe_version)
        stats.probed += 1
        if on_progress:
            on_progress(path, False)

    stats.missing = db.mark_missing(conn, root_id, seen_paths)
    db.touch_scan_root(conn, root_id)
    return stats
