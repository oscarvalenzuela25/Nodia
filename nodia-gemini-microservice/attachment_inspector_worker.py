"""Single-file decoder. Run only as an isolated child; never imports application state."""
from __future__ import annotations

import json
import sys
from pathlib import Path

MAX_BYTES = 20 * 1024 * 1024
MAX_PIXELS = 12_000_000


class InvalidAttachment(Exception):
    pass


def confine() -> None:
    """Fail closed without a hard address-space limit; no network/process creation."""
    if sys.platform != "linux":
        raise RuntimeError("parser_isolation_unavailable")
    import resource
    resource.setrlimit(resource.RLIMIT_AS, (256 * 1024 * 1024,) * 2)
    resource.setrlimit(resource.RLIMIT_CPU, (15, 15))
    resource.setrlimit(resource.RLIMIT_FSIZE, (0, 0))
    resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
    resource.setrlimit(resource.RLIMIT_NOFILE, (32, 32))
    # The supported runtime is Linux x86-64. An unrecognized ABI cannot silently
    # skip syscall isolation. Libraries are imported after restrictions apply.
    import ctypes
    import platform
    if platform.machine() != "x86_64":
        raise RuntimeError("parser_isolation_unavailable")
    class Filter(ctypes.Structure):
        _fields_ = [("code", ctypes.c_ushort), ("jt", ctypes.c_ubyte), ("jf", ctypes.c_ubyte), ("k", ctypes.c_uint)]
    class Program(ctypes.Structure):
        _fields_ = [("length", ctypes.c_ushort), ("filter", ctypes.POINTER(Filter))]
    instructions = [Filter(0x20, 0, 0, 4), Filter(0x15, 1, 0, 0xC000003E), Filter(0x06, 0, 0, 0x80000000), Filter(0x20, 0, 0, 0)]
    # Reject socket/connect, exec, process/thread creation and ptrace, including
    # x32 ABI syscall numbers. Decoder threads are explicitly disabled below.
    instructions += [Filter(0x35, 0, 1, 0x40000000), Filter(0x06, 0, 0, 0x00050001)]
    for number in (41, 42, 53, 56, 57, 58, 59, 101, 322, 435):
        instructions.extend((Filter(0x15, 0, 1, number), Filter(0x06, 0, 0, 0x00050001)))
    instructions.append(Filter(0x06, 0, 0, 0x7FFF0000))
    array = (Filter * len(instructions))(*instructions)
    program = Program(len(instructions), array)
    libc = ctypes.CDLL(None, use_errno=True)
    if libc.prctl(38, 1, 0, 0, 0) or libc.prctl(22, 2, ctypes.byref(program), 0, 0):
        raise RuntimeError("parser_isolation_unavailable")


def image(path: Path) -> dict[str, object]:
    from PIL import Image
    Image.MAX_IMAGE_PIXELS = MAX_PIXELS
    with Image.open(path) as item:
        if item.format not in {"PNG", "JPEG", "WEBP"} or item.width * item.height > MAX_PIXELS or getattr(item, "n_frames", 1) != 1:
            raise InvalidAttachment()
        media = {"PNG": "image/png", "JPEG": "image/jpeg", "WEBP": "image/webp"}[item.format]
        item.verify()
    with Image.open(path) as item:
        item.load()  # verify() alone does not decode all pixels.
    return {"media_type": media, "page_count": None, "duration_seconds": None, "extracted_text": None}


def pdf(path: Path) -> dict[str, object]:
    from pypdf import PdfReader
    from pypdf.generic import ContentStream
    with path.open("rb") as source:
        if not source.read(8).startswith(b"%PDF-"):
            raise InvalidAttachment()
    reader = PdfReader(path, strict=True)
    if reader.is_encrypted or not 1 <= len(reader.pages) <= 100:
        raise InvalidAttachment()
    root = reader.root_object
    if any(key in root for key in ("/OpenAction", "/AA")):
        raise InvalidAttachment()
    names = root.get("/Names")
    if names is not None and any(key in names.get_object() for key in ("/JavaScript", "/EmbeddedFiles")):
        raise InvalidAttachment()
    texts: list[str] = []
    text_bytes = 0
    extraction_available = True
    for page in reader.pages:
        if "/AA" in page:
            raise InvalidAttachment()
        # Resolve page dictionaries and parse/decompress all page content. No
        # rendering, JS, URI fetching, attachments or external actions are run.
        tuple(page.mediabox)
        content = page.get_contents()
        if content is not None:
            _ = ContentStream(content, reader).operations
        if extraction_available:
            text = page.extract_text()
            text_bytes += len(text.encode("utf-8")) + (1 if texts else 0)
            if text_bytes > 32768:
                # The original remains valid; never truncate an interpretation
                # and present it as the complete extracted document.
                extraction_available = False
                texts.clear()
            else:
                texts.append(text)
    extracted = "\n".join(texts).strip() if extraction_available else None
    return {"media_type": "application/pdf", "page_count": len(reader.pages), "duration_seconds": None, "extracted_text": extracted or None}


def audio(path: Path) -> dict[str, object]:
    import av
    from fractions import Fraction
    with path.open("rb") as source:
        magic = source.read(32)
        source.seek(0)
        if magic.startswith(b"RIFF") and magic[8:12] == b"WAVE":
            fmt, media = "wav", "audio/wav"
        elif magic.startswith(b"OggS"):
            fmt, media = "ogg", "audio/ogg"
        elif magic.startswith(b"\x1aE\xdf\xa3"):
            fmt, media = "matroska,webm", "audio/webm"
        elif magic.startswith(b"ID3") or magic[:2] in (b"\xff\xfb", b"\xff\xf3", b"\xff\xf2"):
            fmt, media = "mp3", "audio/mpeg"
        elif magic[4:8] == b"ftyp":
            fmt, media = "mov,mp4,m4a,3gp,3g2,mj2", "audio/mp4"
        else:
            raise InvalidAttachment()
        # A Python file object plus a fixed demuxer prevents nested URL/playlist
        # protocols. seccomp independently denies networking in the child.
        with av.open(source, mode="r", format=fmt, options={"protocol_whitelist": "file", "threads": "1"}) as container:
            if len(container.streams.audio) != 1 or len(container.streams) != 1:
                raise InvalidAttachment()
            stream = container.streams.audio[0]
            stream.codec_context.thread_count = 1
            duration = Fraction(0)
            count = 0
            for frame in container.decode(stream):
                if not frame.sample_rate or not frame.samples:
                    raise InvalidAttachment()
                duration += Fraction(frame.samples, frame.sample_rate)
                count += 1
                if duration > 300:
                    raise InvalidAttachment()
            if not count or duration <= 0:
                raise InvalidAttachment()
    return {"media_type": media, "page_count": None, "duration_seconds": float(duration), "extracted_text": None}


def inspect(path: Path, kind: str) -> dict[str, object]:
    if path.is_symlink() or not path.is_file() or not 0 < path.stat().st_size <= MAX_BYTES:
        raise InvalidAttachment()
    return {"image": image, "pdf": pdf, "audio": audio}[kind](path)


def main() -> None:
    try:
        confine()
        result = inspect(Path(sys.argv[1]), sys.argv[2])
        print(json.dumps(result, allow_nan=False))
    except RuntimeError as error:
        print(json.dumps({"error": "parser_isolation_unavailable" if str(error) == "parser_isolation_unavailable" else "attachment_invalid"}))
        sys.exit(2)
    except Exception:
        print('{"error":"attachment_invalid"}')
        sys.exit(1)


if __name__ == "__main__":
    main()
