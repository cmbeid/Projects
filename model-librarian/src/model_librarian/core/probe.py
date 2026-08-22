"""Dispatch a path to its tier-1 format probe, producing a `FileFacts`.

Every probe function is written against a file-like object rather than a
path (see `formats/threemf.py` docstring) so this is also the seam a future
zip-peeking feature (PLAN.md) hooks into: a `zipfile.ZipExtFile` can be
passed to `probe_stream` in place of a real file.
"""

from __future__ import annotations

import dataclasses
import os
from typing import BinaryIO

from model_librarian.core.formats import obj, step, stl, threemf
from model_librarian.core.models import FileFacts

_PROBES = {
    ".stl": stl.probe,
    ".obj": obj.probe,
    ".3mf": threemf.probe,
    ".step": step.probe,
    ".stp": step.probe,
}

SUPPORTED_EXTENSIONS = frozenset(_PROBES)


def probe_path(path: str) -> FileFacts:
    """Probe a file on disk, filling in size/ext/format for unsupported types."""
    ext = os.path.splitext(path)[1].lower()
    probe_fn = _PROBES.get(ext)
    try:
        st = os.stat(path)
    except OSError as exc:
        return FileFacts(path=path, ext=ext, format="unknown", size=0, mtime_ns=0, error=str(exc))
    size, mtime_ns = st.st_size, st.st_mtime_ns

    if probe_fn is None:
        return FileFacts(path=path, ext=ext, format="unknown", size=size, mtime_ns=mtime_ns)

    try:
        with open(path, "rb") as stream:
            facts = probe_stream(stream, ext=ext, size=size, path=path)
    except OSError as exc:
        return FileFacts(
            path=path, ext=ext, format="unknown", size=size, mtime_ns=mtime_ns, error=str(exc)
        )
    return dataclasses.replace(facts, mtime_ns=mtime_ns)


def probe_stream(stream: BinaryIO, *, ext: str, size: int, path: str) -> FileFacts:
    """Probe an already-open binary stream (a real file or an archive member)."""
    probe_fn = _PROBES.get(ext)
    if probe_fn is None:
        return FileFacts(path=path, ext=ext, format="unknown", size=size, mtime_ns=0)
    try:
        return probe_fn(stream, size=size, path=path)
    except Exception as exc:  # noqa: BLE001 - a bad file must not crash a bulk scan
        return FileFacts(
            path=path, ext=ext, format="unknown", size=size, mtime_ns=0, error=str(exc)
        )
