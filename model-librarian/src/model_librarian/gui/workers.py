"""Bridges the Qt-free scanner core onto a `QThread` so scanning hundreds of
files never blocks the GUI event loop.

The worker opens its own SQLite connection inside `run()` rather than
sharing the main thread's, since a `sqlite3.Connection` must not cross
threads. All values crossing back over Qt signals are plain
picklable/POD types (str, bool, the `ScanStats` dataclass) — never Qt
objects — matching the Windows `spawn` constraints PLAN.md calls out for
the (future) process-pool tiers.
"""

from __future__ import annotations

from PySide6.QtCore import QThread, Signal

from model_librarian.core import db, scanner


class _Cancelled(Exception):
    pass


class ScanWorker(QThread):
    file_done = Signal(str, bool)  # path, was_cached
    finished_scan = Signal(object)  # scanner.ScanStats
    failed = Signal(str)

    def __init__(self, db_path: str, root_path: str, parent=None):
        super().__init__(parent)
        self.db_path = db_path
        self.root_path = root_path
        self._cancelled = False

    def cancel(self) -> None:
        self._cancelled = True

    def run(self) -> None:
        try:
            conn = db.connect(self.db_path)

            def on_progress(path: str, cached: bool) -> None:
                if self._cancelled:
                    raise _Cancelled
                self.file_done.emit(path, cached)

            stats = scanner.scan(conn, self.root_path, on_progress=on_progress)
        except _Cancelled:
            return
        except Exception as exc:  # noqa: BLE001 - report to the GUI, don't crash the thread
            self.failed.emit(str(exc))
        else:
            self.finished_scan.emit(stats)
