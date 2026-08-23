from model_librarian.core import db, dupes, fingerprint, probe


def _index_with_fingerprint(conn, root_id, path):
    facts = probe.probe_path(str(path))
    file_id = db.upsert_file_facts(conn, root_id, facts)
    fp = fingerprint.compute_file_fingerprint(str(path), facts.ext)
    if fp is not None:
        db.set_fingerprint(conn, file_id, fp)
    if facts.format == "3mf":
        hashes = fingerprint.compute_3mf_object_hashes(str(path))
        db.set_object_identifier_hashes(conn, file_id, hashes)
    return file_id


def test_find_byte_duplicates(tmp_path, binary_stl):
    duplicate_path = tmp_path / "copy_of_cube.stl"
    duplicate_path.write_bytes(binary_stl.read_bytes())

    conn = db.connect(":memory:")
    root_id = db.upsert_scan_root(conn, str(tmp_path))
    id_a = _index_with_fingerprint(conn, root_id, binary_stl)
    id_b = _index_with_fingerprint(conn, root_id, duplicate_path)

    groups = dupes.find_byte_duplicates(conn)

    assert len(groups) == 1
    assert set(groups[0].file_ids) == {id_a, id_b}


def test_find_geometry_duplicates_across_formats(binary_stl, ascii_stl, tmp_path):
    conn = db.connect(":memory:")
    root_id = db.upsert_scan_root(conn, str(tmp_path))
    id_binary = _index_with_fingerprint(conn, root_id, binary_stl)
    id_ascii = _index_with_fingerprint(conn, root_id, ascii_stl)

    groups = dupes.find_geometry_duplicates(conn)

    assert len(groups) == 1
    assert set(groups[0].file_ids) == {id_binary, id_ascii}


def test_find_contained_in_matches_loose_stl_against_3mf_object(binary_stl, bambu_3mf, tmp_path):
    conn = db.connect(":memory:")
    root_id = db.upsert_scan_root(conn, str(tmp_path))
    stl_id = _index_with_fingerprint(conn, root_id, binary_stl)
    threemf_id = _index_with_fingerprint(conn, root_id, bambu_3mf)

    matches = dupes.find_contained_in(conn)

    assert any(
        m.loose_file_id == stl_id and m.container_file_id == threemf_id and m.object_name == "Body"
        for m in matches
    )


def test_clutter_flags_unresolved_reference(obj_missing_mtl, tmp_path):
    conn = db.connect(":memory:")
    root_id = db.upsert_scan_root(conn, str(tmp_path))
    file_id = _index_with_fingerprint(conn, root_id, obj_missing_mtl)

    flags = dupes.find_clutter(conn)

    assert any(f.file_id == file_id and "unresolved" in f.reason for f in flags)


def test_clutter_flags_filename_family(tmp_path, binary_stl):
    variant_path = tmp_path / "cube_binary (1).stl"
    variant_path.write_bytes(binary_stl.read_bytes())

    conn = db.connect(":memory:")
    root_id = db.upsert_scan_root(conn, str(tmp_path))
    id_a = _index_with_fingerprint(conn, root_id, binary_stl)
    id_b = _index_with_fingerprint(conn, root_id, variant_path)

    flags = dupes.find_clutter(conn)
    family_flags = {f.file_id for f in flags if "filename family" in f.reason}

    assert family_flags == {id_a, id_b}
