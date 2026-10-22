"""Synthetic bounded files for the AI-38 proxy boundary drill; no app or network."""
from __future__ import annotations

import hashlib
import io
import json
from pathlib import Path
import struct
import wave
import zlib

ROOT = Path(__file__).resolve().parents[3]
DEST = ROOT / ".tmp/ai38-attachment-fixtures-r01"
LIMIT = 20 * 1024 * 1024
TEXT = "Nodia AI-38 synthetic attachment. No personal or commercial data."


def pdf(total: int) -> bytes:
    """One ordinary page plus an unreferenced uncompressed padding stream.

    Padding is inside a PDF object with a real xref, not garbage after EOF.
    There are no images, compression, links, actions or embedded files.
    """
    content = f"BT /F1 14 Tf 40 750 Td ({TEXT}) Tj ET\n".encode("ascii")
    base = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
        b"/Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        f"<< /Length {len(content)} >>\nstream\n".encode() + content + b"endstream",
    ]

    def build(padding: int) -> bytes:
        result = bytearray(b"%PDF-1.4\n%AI38 synthetic\n")
        offsets = [0]
        objects = base + [f"<< /Length {padding} >>\nstream\n".encode() + b" " * padding + b"\nendstream"]
        for number, obj in enumerate(objects, 1):
            offsets.append(len(result))
            result.extend(f"{number} 0 obj\n".encode() + obj + b"\nendobj\n")
        start = len(result)
        result.extend(f"xref\n0 {len(offsets)}\n0000000000 65535 f \n".encode())
        for offset in offsets[1:]:
            result.extend(f"{offset:010d} 00000 n \n".encode())
        result.extend(f"trailer\n<< /Size {len(offsets)} /Root 1 0 R >>\nstartxref\n{start}\n%%EOF\n".encode())
        return bytes(result)

    count = total - len(build(0))
    for _ in range(8):
        result = build(count)
        if len(result) == total:
            assert result.endswith(b"%%EOF\n")
            return result
        count += total - len(result)
    raise AssertionError("Exact PDF size was not reached")


def png() -> bytes:
    def chunk(kind: bytes, data: bytes) -> bytes:
        return struct.pack("!I", len(data)) + kind + data + struct.pack("!I", zlib.crc32(kind + data) & 0xFFFFFFFF)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack("!2I5B", 1, 1, 8, 2, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(b"\0\x10\x80\x40")) + chunk(b"IEND", b"")


def main() -> None:
    DEST.mkdir(parents=True, exist_ok=True)
    samples = [
        ("ai38-boundary-exact20MiB.pdf", pdf(LIMIT), "pdf", "application/pdf"),
        ("ai38-boundary-over20MiB.pdf", pdf(LIMIT + 1), "pdf", "application/pdf"),
        ("ai38-small-synthetic.png", png(), "image", "image/png"),
    ]
    audio = io.BytesIO()
    with wave.open(audio, "wb") as item:
        item.setnchannels(1)
        item.setsampwidth(2)
        item.setframerate(8000)
        item.writeframes(b"\0\0" * 8000)
    samples.append(("ai38-synthetic-silence.wav", audio.getvalue(), "audio", "audio/wav"))
    entries = []
    for name, data, kind, mime in samples:
        target = DEST / name
        if target.exists():
            assert target.read_bytes() == data, "Refusing to overwrite a different fixture"
        else:
            with target.open("xb") as handle:
                handle.write(data)
        entries.append({"file_name": name, "relative_path": target.relative_to(ROOT).as_posix(), "byte_count": len(data),
                        "sha256": hashlib.sha256(data).hexdigest(), "kind": kind, "media_type": mime,
                        "within_file_limit": len(data) <= LIMIT})
    report = {"stage": "AI-38-proxy-attachments", "status": "fixtures_generated", "synthetic_only": True,
              "provider_generations": 0, "network_requests": 0, "file_limit_bytes": LIMIT,
              "pdf_structure": "one_page_no_compression_no_actions_unreferenced_padding_stream_inside_xref",
              "pdf_expected_text": TEXT, "audio_expected_duration_seconds": 1, "audio_contains_speech": False,
              "files": entries, "parser_acceptance": "pending_actual_isolated_inspector"}
    output = ROOT / "docs/evidence/nodia-ai-ai38-attachment-fixtures-r01.json"
    output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
