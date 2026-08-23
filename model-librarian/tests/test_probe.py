from model_librarian.core import probe


def test_probe_path_dispatches_by_extension(binary_stl):
    facts = probe.probe_path(str(binary_stl))
    assert facts.format == "stl"
    assert facts.triangle_count == 12
    assert facts.mtime_ns > 0


def test_probe_path_unknown_extension(tmp_path):
    path = tmp_path / "notes.txt"
    path.write_text("hello")
    facts = probe.probe_path(str(path))
    assert facts.format == "unknown"
    assert facts.size == 5


def test_probe_path_missing_file(tmp_path):
    facts = probe.probe_path(str(tmp_path / "does_not_exist.stl"))
    assert facts.format == "unknown"
    assert facts.error is not None
