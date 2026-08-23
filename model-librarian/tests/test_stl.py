from model_librarian.core.formats import stl


def test_binary_stl_triangle_count_and_exporter(binary_stl):
    size = binary_stl.stat().st_size
    with open(binary_stl, "rb") as f:
        facts = stl.probe(f, size=size, path=str(binary_stl))

    assert facts.format == "stl"
    assert facts.triangle_count == 12
    assert facts.vertex_count == 36
    assert facts.exporter == "Exported from Blender-4.0"
    assert any("no object" in w.lower() for w in facts.warnings)


def test_ascii_stl_triangle_count(ascii_stl):
    size = ascii_stl.stat().st_size
    with open(ascii_stl, "rb") as f:
        facts = stl.probe(f, size=size, path=str(ascii_stl))

    assert facts.format == "stl"
    assert facts.triangle_count == 12
    assert facts.exporter is None


def test_binary_detection_is_by_size_not_leading_word(tmp_path):
    """A binary STL whose 80-byte header happens to start with 'solid' must
    still be detected as binary via the size identity, not the leading word."""
    import struct

    path = tmp_path / "tricky.stl"
    header = b"solid_exported_from_a_tool" + b"\x00" * (80 - len(b"solid_exported_from_a_tool"))
    with open(path, "wb") as f:
        f.write(header)
        f.write(struct.pack("<I", 1))
        f.write(b"\x00" * 50)  # one triangle record

    size = path.stat().st_size
    with open(path, "rb") as f:
        facts = stl.probe(f, size=size, path=str(path))

    assert facts.triangle_count == 1
    assert facts.exporter.startswith("solid_exported")
