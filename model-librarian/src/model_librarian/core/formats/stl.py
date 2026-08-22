"""Tier-1 probe for `.stl` — binary vs ASCII, triangle count, exporter string.

STL has no object concept: a binary file is one flat triangle soup with no
names, and even a leading `solid` line doesn't mean ASCII (binary files
commonly start with that word too). The size identity `84 + 50*n ==
filesize` is the only reliable discriminator.
"""

from __future__ import annotations

from typing import BinaryIO

from model_librarian.core.models import FileFacts

_HEADER_SIZE = 84
_TRIANGLE_SIZE = 50
_NO_OBJECT_WARNING = (
    "STL has no object names or object concept. Triangle count is for the "
    "whole file; loose-body (connected component) count requires tier 2."
)


def probe(stream: BinaryIO, *, size: int, path: str) -> FileFacts:
    header = stream.read(_HEADER_SIZE)
    if len(header) == _HEADER_SIZE:
        (declared_triangles,) = _read_uint32_le(header, 80)
        if _HEADER_SIZE + _TRIANGLE_SIZE * declared_triangles == size:
            return _probe_binary(header, declared_triangles, path, size)
    return _probe_ascii(stream, header, path, size)


def _read_uint32_le(buf: bytes, offset: int) -> tuple[int]:
    return (int.from_bytes(buf[offset : offset + 4], "little", signed=False),)


def _probe_binary(header: bytes, triangle_count: int, path: str, size: int) -> FileFacts:
    exporter = _clean_header_text(header[:80])
    return FileFacts(
        path=path,
        ext=".stl",
        format="stl",
        size=size,
        mtime_ns=0,
        triangle_count=triangle_count,
        vertex_count=triangle_count * 3,
        exporter=exporter or None,
        warnings=(_NO_OBJECT_WARNING,),
    )


def _clean_header_text(raw: bytes) -> str:
    text = raw.split(b"\x00", 1)[0]
    return text.decode("ascii", errors="replace").strip()


def _probe_ascii(stream: BinaryIO, header: bytes, path: str, size: int) -> FileFacts:
    stream.seek(0)
    facet_count = 0
    carry = b""
    chunk_size = 1 << 20
    while True:
        chunk = stream.read(chunk_size)
        if not chunk:
            break
        buf = carry + chunk
        facet_count += buf.count(b"facet normal")
        # Keep a small tail in case "facet normal" straddles a chunk boundary.
        carry = buf[-16:]
    return FileFacts(
        path=path,
        ext=".stl",
        format="stl",
        size=size,
        mtime_ns=0,
        triangle_count=facet_count,
        vertex_count=facet_count * 3,
        warnings=(_NO_OBJECT_WARNING,),
    )
