"""`model-librarian scan DIR --json` — headless indexing, no display required.

This is also the CI-friendly verification path (PLAN.md step 2): it exercises
the same scanner/db/probe core the GUI uses, and its JSON output is diffable.
"""

from __future__ import annotations

import argparse
import json
import sqlite3
import sys

from model_librarian.core import appdirs, db, scanner


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="model-librarian")
    subparsers = parser.add_subparsers(dest="command", required=True)

    scan_parser = subparsers.add_parser("scan", help="Recursively index a folder")
    scan_parser.add_argument("directory")
    scan_parser.add_argument(
        "--json", action="store_true", help="print the resulting index as JSON"
    )
    scan_parser.add_argument(
        "--db", default=None, help="path to the SQLite index (default: OS app-data dir)"
    )

    args = parser.parse_args(argv)
    if args.command == "scan":
        return _cmd_scan(args)
    return 1


def _cmd_scan(args: argparse.Namespace) -> int:
    db_path = args.db or appdirs.default_db_path()
    conn = db.connect(db_path)
    stats = scanner.scan(conn, args.directory)

    if args.json:
        rows = db.list_files(conn)
        payload = [_file_row_to_dict(conn, row) for row in rows]
        json.dump(payload, sys.stdout, indent=2)
        sys.stdout.write("\n")
    else:
        print(
            f"Scanned {stats.scanned} files: {stats.probed} probed, {stats.cached} cached, "
            f"{stats.errors} errors, {stats.missing} newly missing."
        )
    return 0


def _file_row_to_dict(conn: sqlite3.Connection, row: sqlite3.Row) -> dict:
    file_id = row["id"]
    metadata_rows = conn.execute(
        "SELECT key, value FROM metadata WHERE file_id = ?", (file_id,)
    ).fetchall()
    external_ref_rows = conn.execute(
        "SELECT kind, ref, resolved FROM external_refs WHERE file_id = ?", (file_id,)
    ).fetchall()

    payload = dict(row)
    payload["metadata"] = {r["key"]: r["value"] for r in metadata_rows}
    payload["objects"] = [dict(r) for r in db.get_objects(conn, file_id)]
    payload["settings"] = [dict(r) for r in db.get_settings(conn, file_id)]
    payload["external_refs"] = [dict(r) for r in external_ref_rows]
    return payload


if __name__ == "__main__":
    sys.exit(main())
