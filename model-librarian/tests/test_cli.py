import json

from model_librarian import cli


def test_cli_scan_json_output(tmp_path, binary_stl, capsys):
    db_path = tmp_path / "index.sqlite3"
    exit_code = cli.main(["scan", str(binary_stl.parent), "--json", "--db", str(db_path)])

    assert exit_code == 0
    out = capsys.readouterr().out
    payload = json.loads(out)
    assert len(payload) == 1
    assert payload[0]["format"] == "stl"
    assert payload[0]["triangle_count"] == 12


def test_cli_scan_plain_output(tmp_path, binary_stl, capsys):
    db_path = tmp_path / "index.sqlite3"
    exit_code = cli.main(["scan", str(binary_stl.parent), "--db", str(db_path)])

    assert exit_code == 0
    out = capsys.readouterr().out
    assert "Scanned 1 files" in out
