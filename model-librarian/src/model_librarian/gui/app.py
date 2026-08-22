"""GUI entry point: `python -m model_librarian` -> the desktop app.

Windows note (PLAN.md): `spawn` is the multiprocessing start method, so any
future `ProcessPoolExecutor` use here must be created under this module's
`if __name__ == "__main__"` guard, and every task argument must be a plain
picklable value — never a Qt object.
"""

from __future__ import annotations

import sys

from PySide6.QtWidgets import QApplication

from model_librarian.gui.main_window import MainWindow


def run(argv: list[str] | None = None) -> int:
    app = QApplication(argv if argv is not None else sys.argv)
    window = MainWindow()
    window.show()
    return app.exec()
