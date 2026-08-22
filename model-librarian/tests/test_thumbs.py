"""`get_or_render_thumbnail` caching (PLAN.md preview priority #2).

The actual VTK offscreen render is monkeypatched out here: whether it
succeeds depends on the machine's GPU/display, which is exactly what the
caching layer must not depend on to be testable.
"""

from __future__ import annotations

from model_librarian.core import db
from model_librarian.gui import thumbs


def test_get_or_render_thumbnail_caches_render(monkeypatch):
    conn = db.connect(":memory:")
    calls = []

    def fake_render(path, ext, *, size=512):
        calls.append(path)
        return b"rendered-png"

    monkeypatch.setattr(thumbs, "render_thumbnail_png", fake_render)

    first = thumbs.get_or_render_thumbnail(conn, 1, "/fake/model.stl", ".stl")
    second = thumbs.get_or_render_thumbnail(conn, 1, "/fake/model.stl", ".stl")

    assert first == b"rendered-png"
    assert second == b"rendered-png"
    assert calls == ["/fake/model.stl"]  # only rendered once; second call hit the cache


def test_get_or_render_thumbnail_does_not_cache_failure(monkeypatch):
    conn = db.connect(":memory:")
    calls = []

    def fake_render(path, ext, *, size=512):
        calls.append(path)
        return None

    monkeypatch.setattr(thumbs, "render_thumbnail_png", fake_render)

    assert thumbs.get_or_render_thumbnail(conn, 1, "/fake/model.stl", ".stl") is None
    assert thumbs.get_or_render_thumbnail(conn, 1, "/fake/model.stl", ".stl") is None
    assert calls == ["/fake/model.stl", "/fake/model.stl"]  # retried, nothing bad cached


def test_get_or_render_thumbnail_keys_are_per_file(monkeypatch):
    conn = db.connect(":memory:")

    monkeypatch.setattr(thumbs, "render_thumbnail_png", lambda path, ext, *, size=512: b"png-a")
    thumbs.get_or_render_thumbnail(conn, 1, "/fake/a.stl", ".stl")

    monkeypatch.setattr(thumbs, "render_thumbnail_png", lambda path, ext, *, size=512: b"png-b")
    result = thumbs.get_or_render_thumbnail(conn, 2, "/fake/b.stl", ".stl")

    assert result == b"png-b"
    assert db.get_thumb(conn, "1", "rendered")["png"] == b"png-a"
