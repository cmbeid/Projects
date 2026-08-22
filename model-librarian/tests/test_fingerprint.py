from model_librarian.core import fingerprint


def test_compute_file_fingerprint_for_stl_cube(binary_stl):
    fp = fingerprint.compute_file_fingerprint(str(binary_stl), ".stl")

    assert fp is not None
    assert fp.triangle_count == 12
    assert fp.vertex_count == 8
    assert fp.watertight is True
    assert fp.connected_components == 1
    assert fp.identifier_hash


def test_same_cube_stl_and_ascii_share_identifier_hash(binary_stl, ascii_stl):
    binary_fp = fingerprint.compute_file_fingerprint(str(binary_stl), ".stl")
    ascii_fp = fingerprint.compute_file_fingerprint(str(ascii_stl), ".stl")

    assert binary_fp.identifier_hash == ascii_fp.identifier_hash


def test_compute_3mf_object_hashes_matches_standalone_stl(bambu_3mf, binary_stl):
    object_hashes = fingerprint.compute_3mf_object_hashes(str(bambu_3mf))
    stl_fp = fingerprint.compute_file_fingerprint(str(binary_stl), ".stl")

    assert "Body" in object_hashes
    assert "Support" in object_hashes
    assert object_hashes["Body"] == stl_fp.identifier_hash


def test_unsupported_extension_returns_none(tmp_path):
    path = tmp_path / "part.step"
    path.write_text("not geometry")
    assert fingerprint.compute_file_fingerprint(str(path), ".step") is None


def test_unparseable_file_returns_none(tmp_path):
    path = tmp_path / "broken.stl"
    path.write_bytes(b"not a real stl file at all")
    assert fingerprint.compute_file_fingerprint(str(path), ".stl") is None
