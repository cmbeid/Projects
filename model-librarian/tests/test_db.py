from model_librarian.core import db, probe


def test_upsert_and_query_roundtrip(binary_stl):
    conn = db.connect(":memory:")
    root_id = db.upsert_scan_root(conn, str(binary_stl.parent))
    facts = probe.probe_path(str(binary_stl))

    file_id = db.upsert_file_facts(conn, root_id, facts)
    row = db.get_file_by_path(conn, str(binary_stl))

    assert row["id"] == file_id
    assert row["format"] == "stl"
    assert row["triangle_count"] == 12
    assert row["status"] == "ok"


def test_upsert_is_idempotent_by_path(binary_stl):
    conn = db.connect(":memory:")
    root_id = db.upsert_scan_root(conn, str(binary_stl.parent))
    facts = probe.probe_path(str(binary_stl))

    first_id = db.upsert_file_facts(conn, root_id, facts)
    second_id = db.upsert_file_facts(conn, root_id, facts)

    assert first_id == second_id
    assert len(db.list_files(conn)) == 1


def test_objects_and_settings_are_persisted(bambu_3mf):
    conn = db.connect(":memory:")
    root_id = db.upsert_scan_root(conn, str(bambu_3mf.parent))
    facts = probe.probe_path(str(bambu_3mf))

    file_id = db.upsert_file_facts(conn, root_id, facts)

    objects = db.get_objects(conn, file_id)
    assert {o["name"] for o in objects} == {"Body", "Support"}

    settings = db.get_settings(conn, file_id)
    assert any(s["key"] == "layer_height" for s in settings)


def test_thumb_cache_roundtrip():
    conn = db.connect(":memory:")
    assert db.get_thumb(conn, "abc", "rendered") is None

    db.set_thumb(conn, "abc", "rendered", 512, 512, b"fakepng")
    row = db.get_thumb(conn, "abc", "rendered")

    assert row["png"] == b"fakepng"
    assert row["width"] == 512


def test_thumb_cache_replaces_existing_entry():
    conn = db.connect(":memory:")
    db.set_thumb(conn, "abc", "rendered", 512, 512, b"first")
    db.set_thumb(conn, "abc", "rendered", 512, 512, b"second")

    row = db.get_thumb(conn, "abc", "rendered")
    assert row["png"] == b"second"


def test_get_files_by_ids_returns_matching_rows(binary_stl, ascii_stl, tmp_path):
    conn = db.connect(":memory:")
    root_id = db.upsert_scan_root(conn, str(tmp_path))
    id_a = db.upsert_file_facts(conn, root_id, probe.probe_path(str(binary_stl)))
    id_b = db.upsert_file_facts(conn, root_id, probe.probe_path(str(ascii_stl)))

    rows = db.get_files_by_ids(conn, [id_a])
    assert {r["id"] for r in rows} == {id_a}

    rows = db.get_files_by_ids(conn, [id_a, id_b])
    assert {r["id"] for r in rows} == {id_a, id_b}


def test_get_files_by_ids_empty_input_returns_empty_list():
    conn = db.connect(":memory:")
    assert db.get_files_by_ids(conn, []) == []


def test_mark_missing_flags_deleted_files(binary_stl, tmp_path):
    conn = db.connect(":memory:")
    root_id = db.upsert_scan_root(conn, str(tmp_path))
    facts = probe.probe_path(str(binary_stl))
    db.upsert_file_facts(conn, root_id, facts)

    missing_count = db.mark_missing(conn, root_id, seen_paths=set())

    assert missing_count == 1
    row = db.get_file_by_path(conn, str(binary_stl))
    assert row["status"] == "missing"
