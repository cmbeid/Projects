"""Where the SQLite index lives, per-OS (PLAN.md: "OS app-data dir")."""

from __future__ import annotations

import os
import sys

_APP_NAME = "model-librarian"


def app_data_dir() -> str:
    if sys.platform == "win32":
        base = os.environ.get("LOCALAPPDATA") or os.path.expanduser("~")
    elif sys.platform == "darwin":
        base = os.path.expanduser("~/Library/Application Support")
    else:
        base = os.environ.get("XDG_DATA_HOME") or os.path.expanduser("~/.local/share")
    path = os.path.join(base, _APP_NAME)
    os.makedirs(path, exist_ok=True)
    return path


def default_db_path() -> str:
    return os.path.join(app_data_dir(), "index.sqlite3")
