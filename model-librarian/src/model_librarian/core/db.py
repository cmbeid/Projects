"""SQLite index: schema, migrations, and upsert/query helpers.

Cache invalidation follows PLAN.md: a `(size, mtime_ns)` mismatch against
the stored row means re-probe; bumping `PROBE_VERSION` after a parser
change means re-probe everything, since a stale row's `probe_version`
will no longer match.
"""

from __future__ import annotations

import json
import os
import sqlite3
import time
from pathlib import Path

from model_librarian.core.models import FileFacts, FingerprintInfo

PROBE_VERSION = 1

_SCHEMA = """
CREATE TABLE IF NOT EXISTS scan_roots (
    id INTEGER PRIMARY KEY,
    path TEXT UNIQUE NOT NULL,
    last_scan_at TEXT
);

CREATE TABLE IF NOT EXISTS files (
    id INTEGER PRIMARY KEY,
    path TEXT UNIQUE NOT NULL,
    root_id INTEGER NOT NULL REFERENCES scan_roots(id),
    name TEXT NOT NULL,
    ext TEXT NOT NULL,
    format TEXT NOT NULL,
    size INTEGER NOT NULL,
    mtime_ns INTEGER NOT NULL,
    content_hash TEXT,
    container_id INTEGER REFERENCES files(id),  -- NULL now; the zip-peeking seam
    member_path TEXT,                           -- NULL now; the zip-peeking seam
    probe_version INTEGER NOT NULL,
    probed_at TEXT,
    status TEXT NOT NULL DEFAULT 'ok',           -- ok | error | missing
    error TEXT,
    unit TEXT,
    exporter TEXT,
    originating_system TEXT,
    file_schema TEXT,
    triangle_count INTEGER,
    vertex_count INTEGER,
    defined_object_count INTEGER,
    build_object_count INTEGER
);
CREATE INDEX IF NOT EXISTS idx_files_root ON files(root_id);
CREATE INDEX IF NOT EXISTS idx_files_content_hash ON files(content_hash);

CREATE TABLE IF NOT EXISTS metadata (
    file_id INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    value TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_metadata_file ON metadata(file_id);

CREATE TABLE IF NOT EXISTS objects (
    id INTEGER PRIMARY KEY,
    file_id INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    parent_id INTEGER REFERENCES objects(id),
    idx INTEGER NOT NULL,
    name TEXT NOT NULL,
    obj_type TEXT NOT NULL,
    plate TEXT,
    placed INTEGER,
    triangle_count INTEGER,
    vertex_count INTEGER,
    bbox_x REAL,
    bbox_y REAL,
    bbox_z REAL,
    volume_mm3 REAL,
    material TEXT,
    identifier_hash TEXT  -- tier-2, for the "contained-in" dupe signal (dupes.py)
);
CREATE INDEX IF NOT EXISTS idx_objects_file ON objects(file_id);
CREATE INDEX IF NOT EXISTS idx_objects_identifier_hash ON objects(identifier_hash);

CREATE TABLE IF NOT EXISTS settings (
    file_id INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    source TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_settings_file ON settings(file_id);

CREATE TABLE IF NOT EXISTS external_refs (
    file_id INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    ref TEXT NOT NULL,
    resolved INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_external_refs_file ON external_refs(file_id);

CREATE TABLE IF NOT EXISTS fingerprints (
    file_id INTEGER PRIMARY KEY REFERENCES files(id) ON DELETE CASCADE,
    identifier_hash TEXT NOT NULL,
    tri_count INTEGER NOT NULL,
    vert_count INTEGER NOT NULL,
    volume REAL NOT NULL,
    area REAL NOT NULL,
    bbox_key TEXT NOT NULL,
    watertight INTEGER NOT NULL,
    connected_components INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_fingerprints_hash ON fingerprints(identifier_hash);

CREATE TABLE IF NOT EXISTS thumbs (
    content_hash TEXT NOT NULL,
    kind TEXT NOT NULL,  -- embedded | rendered
    width INTEGER NOT NULL,
    height INTEGER NOT NULL,
    png BLOB NOT NULL,
    PRIMARY KEY (content_hash, kind)
);

CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY,
    name TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS file_tags (
    file_id INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (file_id, tag_id)
);
"""


def connect(db_path: str | Path) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.executescript(_SCHEMA)
    return conn


def upsert_scan_root(conn: sqlite3.Connection, path: str) -> int:
    conn.execute("INSERT OR IGNORE INTO scan_roots(path) VALUES (?)", (path,))
    row = conn.execute("SELECT id FROM scan_roots WHERE path = ?", (path,)).fetchone()
    return row["id"]


def touch_scan_root(conn: sqlite3.Connection, root_id: int) -> None:
    conn.execute(
        "UPDATE scan_roots SET last_scan_at = ? WHERE id = ?",
        (_now_iso(), root_id),
    )
    conn.commit()


def get_file_by_path(conn: sqlite3.Connection, path: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM files WHERE path = ?", (path,)).fetchone()


def list_scan_roots(conn: sqlite3.Connection) -> list[sqlite3.Row]:
    return conn.execute("SELECT id, path FROM scan_roots").fetchall()


def upsert_file_facts(
    conn: sqlite3.Connection,
    root_id: int,
    facts: FileFacts,
    *,
    probe_version: int = PROBE_VERSION,
) -> int:
    """Insert or replace one file's tier-1 facts and all its child rows."""
    name = os.path.basename(facts.path)
    status = "error" if facts.error else "ok"

    existing = conn.execute("SELECT id FROM files WHERE path = ?", (facts.path,)).fetchone()
    if existing:
        file_id = existing["id"]
        conn.execute(
            """
            UPDATE files SET
                root_id=?, name=?, ext=?, format=?, size=?, mtime_ns=?, content_hash=?,
                probe_version=?, probed_at=?, status=?, error=?, unit=?, exporter=?,
                originating_system=?, file_schema=?, triangle_count=?, vertex_count=?,
                defined_object_count=?, build_object_count=?
            WHERE id=?
            """,
            (
                root_id,
                name,
                facts.ext,
                facts.format,
                facts.size,
                facts.mtime_ns,
                facts.content_hash,
                probe_version,
                _now_iso(),
                status,
                facts.error,
                facts.unit,
                facts.exporter,
                facts.originating_system,
                facts.file_schema,
                facts.triangle_count,
                facts.vertex_count,
                facts.defined_object_count,
                facts.build_object_count,
                file_id,
            ),
        )
        _clear_children(conn, file_id)
    else:
        cur = conn.execute(
            """
            INSERT INTO files (
                path, root_id, name, ext, format, size, mtime_ns, content_hash,
                probe_version, probed_at, status, error, unit, exporter,
                originating_system, file_schema, triangle_count, vertex_count,
                defined_object_count, build_object_count
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            """,
            (
                facts.path,
                root_id,
                name,
                facts.ext,
                facts.format,
                facts.size,
                facts.mtime_ns,
                facts.content_hash,
                probe_version,
                _now_iso(),
                status,
                facts.error,
                facts.unit,
                facts.exporter,
                facts.originating_system,
                facts.file_schema,
                facts.triangle_count,
                facts.vertex_count,
                facts.defined_object_count,
                facts.build_object_count,
            ),
        )
        file_id = cur.lastrowid

    _insert_children(conn, file_id, facts)
    conn.commit()
    return file_id


def _clear_children(conn: sqlite3.Connection, file_id: int) -> None:
    for table in ("metadata", "objects", "settings", "external_refs", "fingerprints"):
        conn.execute(f"DELETE FROM {table} WHERE file_id = ?", (file_id,))  # noqa: S608


def _insert_children(conn: sqlite3.Connection, file_id: int, facts: FileFacts) -> None:
    for key, value in facts.metadata.items():
        conn.execute(
            "INSERT INTO metadata (file_id, key, value) VALUES (?,?,?)", (file_id, key, value)
        )

    id_by_index: dict[int, int] = {}
    for obj in facts.objects:
        parent_db_id = id_by_index.get(obj.parent_index) if obj.parent_index is not None else None
        bbox = obj.bbox_mm or (None, None, None)
        cur = conn.execute(
            """
            INSERT INTO objects (
                file_id, parent_id, idx, name, obj_type, plate, placed,
                triangle_count, vertex_count, bbox_x, bbox_y, bbox_z, volume_mm3, material
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            """,
            (
                file_id,
                parent_db_id,
                obj.index,
                obj.name,
                obj.obj_type,
                obj.plate,
                None if obj.placed is None else int(obj.placed),
                obj.triangle_count,
                obj.vertex_count,
                *bbox,
                obj.volume_mm3,
                obj.material,
            ),
        )
        id_by_index[obj.index] = cur.lastrowid

    for block in facts.settings:
        conn.execute(
            "INSERT INTO settings (file_id, source, key, value) VALUES (?,?,?,?)",
            (file_id, block.source, block.key, block.value),
        )

    for ref in facts.external_refs:
        conn.execute(
            "INSERT INTO external_refs (file_id, kind, ref, resolved) VALUES (?,?,?,?)",
            (file_id, ref.kind, ref.ref, int(ref.resolved)),
        )

    if facts.fingerprint is not None:
        _insert_fingerprint(conn, file_id, facts.fingerprint)


def _insert_fingerprint(conn: sqlite3.Connection, file_id: int, fp: FingerprintInfo) -> None:
    conn.execute(
        """
        INSERT INTO fingerprints (
            file_id, identifier_hash, tri_count, vert_count, volume, area,
            bbox_key, watertight, connected_components
        ) VALUES (?,?,?,?,?,?,?,?,?)
        """,
        (
            file_id,
            fp.identifier_hash,
            fp.triangle_count,
            fp.vertex_count,
            fp.volume_mm3,
            fp.area_mm2,
            json.dumps(fp.bbox_key),
            int(fp.watertight),
            fp.connected_components,
        ),
    )


def set_fingerprint(conn: sqlite3.Connection, file_id: int, fp: FingerprintInfo) -> None:
    """Store a tier-2 whole-file fingerprint, replacing any previous one."""
    conn.execute("DELETE FROM fingerprints WHERE file_id = ?", (file_id,))
    _insert_fingerprint(conn, file_id, fp)
    conn.commit()


def set_object_identifier_hashes(
    conn: sqlite3.Connection, file_id: int, hashes_by_name: dict[str, str]
) -> None:
    """Store tier-2 per-object geometry hashes (3MF), keyed by object name."""
    conn.executemany(
        "UPDATE objects SET identifier_hash = ? WHERE file_id = ? AND name = ?",
        [(h, file_id, name) for name, h in hashes_by_name.items()],
    )
    conn.commit()


def mark_missing(conn: sqlite3.Connection, root_id: int, seen_paths: set[str]) -> int:
    """Flag files under `root_id` that were not seen in the latest walk."""
    rows = conn.execute(
        "SELECT id, path FROM files WHERE root_id = ? AND status != 'missing'", (root_id,)
    ).fetchall()
    missing_ids = [row["id"] for row in rows if row["path"] not in seen_paths]
    conn.executemany(
        "UPDATE files SET status = 'missing' WHERE id = ?", [(i,) for i in missing_ids]
    )
    conn.commit()
    return len(missing_ids)


def list_files(conn: sqlite3.Connection, *, root_id: int | None = None) -> list[sqlite3.Row]:
    if root_id is None:
        return conn.execute("SELECT * FROM files ORDER BY path").fetchall()
    return conn.execute(
        "SELECT * FROM files WHERE root_id = ? ORDER BY path", (root_id,)
    ).fetchall()


def get_files_by_ids(conn: sqlite3.Connection, ids) -> list[sqlite3.Row]:
    ids = list(ids)
    if not ids:
        return []
    placeholders = ",".join("?" for _ in ids)
    return conn.execute(
        f"SELECT * FROM files WHERE id IN ({placeholders})",
        ids,  # noqa: S608
    ).fetchall()


def get_objects(conn: sqlite3.Connection, file_id: int) -> list[sqlite3.Row]:
    return conn.execute(
        "SELECT * FROM objects WHERE file_id = ? ORDER BY idx", (file_id,)
    ).fetchall()


def get_settings(conn: sqlite3.Connection, file_id: int) -> list[sqlite3.Row]:
    return conn.execute(
        "SELECT * FROM settings WHERE file_id = ? ORDER BY source, key", (file_id,)
    ).fetchall()


def get_thumb(conn: sqlite3.Connection, cache_key: str, kind: str) -> sqlite3.Row | None:
    return conn.execute(
        "SELECT * FROM thumbs WHERE content_hash = ? AND kind = ?", (cache_key, kind)
    ).fetchone()


def set_thumb(
    conn: sqlite3.Connection, cache_key: str, kind: str, width: int, height: int, png: bytes
) -> None:
    conn.execute(
        """
        INSERT OR REPLACE INTO thumbs (content_hash, kind, width, height, png)
        VALUES (?,?,?,?,?)
        """,
        (cache_key, kind, width, height, png),
    )
    conn.commit()


def _now_iso() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
