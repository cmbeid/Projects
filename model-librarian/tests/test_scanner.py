import struct

from model_librarian.core import db, scanner


def test_scan_finds_supported_files(tmp_path, binary_stl):
    (tmp_path / "notes.txt").write_text("ignore me")
    conn = db.connect(":memory:")

    stats = scanner.scan(conn, str(tmp_path))

    assert stats.scanned == 1  # only the .stl, not the .txt
    assert stats.probed == 1
    files = db.list_files(conn)
    assert len(files) == 1
    assert files[0]["ext"] == ".stl"


def test_rescan_of_unchanged_tree_is_all_cached(tmp_path, binary_stl):
    conn = db.connect(":memory:")
    scanner.scan(conn, str(tmp_path))

    stats = scanner.scan(conn, str(tmp_path))

    assert stats.probed == 0
    assert stats.cached == 1


def test_modified_file_is_reprobed(tmp_path, binary_stl):
    conn = db.connect(":memory:")
    scanner.scan(conn, str(tmp_path))

    # Rewrite with a different triangle count -> different size -> must reprobe.
    with open(binary_stl, "wb") as f:
        f.write(b"\x00" * 80)
        f.write(struct.pack("<I", 1))
        f.write(b"\x00" * 50)

    stats = scanner.scan(conn, str(tmp_path))

    assert stats.probed == 1
    assert stats.cached == 0
    row = db.get_file_by_path(conn, str(binary_stl))
    assert row["triangle_count"] == 1


def test_deleted_file_is_marked_missing(tmp_path, binary_stl):
    conn = db.connect(":memory:")
    scanner.scan(conn, str(tmp_path))

    binary_stl.unlink()
    stats = scanner.scan(conn, str(tmp_path))

    assert stats.missing == 1
    row = db.get_file_by_path(conn, str(binary_stl))
    assert row["status"] == "missing"


def test_nested_directories_are_walked(tmp_path):
    nested = tmp_path / "a" / "b" / "c"
    nested.mkdir(parents=True)
    with open(nested / "deep.stl", "wb") as f:
        f.write(b"\x00" * 80)
        f.write(struct.pack("<I", 0))

    conn = db.connect(":memory:")
    stats = scanner.scan(conn, str(tmp_path))

    assert stats.scanned == 1
    assert db.list_files(conn)[0]["path"].endswith("deep.stl")
