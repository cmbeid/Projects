"""Info tab: path, hashes, format-specific header, external references,
and (once dupes.py has run) duplicate group membership."""

from __future__ import annotations

from PySide6.QtWidgets import QPlainTextEdit


class InfoPanel(QPlainTextEdit):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setReadOnly(True)

    def show_file(self, row, metadata_rows, external_ref_rows) -> None:
        lines = [
            f"Path: {row['path']}",
            f"Format: {row['format']}   Ext: {row['ext']}",
            f"Size: {row['size']:,} bytes",
            f"Status: {row['status']}" + (f"  ({row['error']})" if row["error"] else ""),
        ]
        if row["content_hash"]:
            lines.append(f"Content hash: {row['content_hash']}")
        if row["unit"]:
            lines.append(f"Unit: {row['unit']}")
        if row["exporter"]:
            lines.append(f"Exporter: {row['exporter']}")
        if row["originating_system"]:
            lines.append(f"Originating system: {row['originating_system']}")
        if row["file_schema"]:
            lines.append(f"Schema: {row['file_schema']}")

        if metadata_rows:
            lines.append("")
            lines.append("Metadata:")
            lines.extend(f"  {m['key']}: {m['value']}" for m in metadata_rows)

        if external_ref_rows:
            lines.append("")
            lines.append("External references:")
            for ref in external_ref_rows:
                status = "ok" if ref["resolved"] else "MISSING"
                lines.append(f"  [{status}] {ref['kind']}: {ref['ref']}")

        self.setPlainText("\n".join(lines))
