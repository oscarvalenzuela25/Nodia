"""Offline Linux decoder/isolation acceptance with disposable synthetic files."""
import asyncio
import json
import subprocess
import sys
import tempfile
import wave
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from attachment_inspector import AttachmentInspector
from service_errors import ServiceError


async def main():
    from PIL import Image
    from pypdf import PdfWriter
    checks = 0
    with tempfile.TemporaryDirectory() as directory:
        root = Path(directory)
        inspector = AttachmentInspector(root)
        for format, media in (("PNG", "image/png"), ("JPEG", "image/jpeg"), ("WEBP", "image/webp")):
            path = root / format
            Image.new("RGB", (32, 32), "green").save(path, format=format)
            result = await inspector.decode(path, "image")
            assert result.media_type == media
            checks += 1
        writer = PdfWriter()
        writer.add_blank_page(width=72, height=72)
        path = root / "pdf"
        writer.write(path)
        result = await inspector.decode(path, "pdf")
        assert result.page_count == 1 and result.extracted_text is None
        checks += 1
        writer.encrypt("synthetic")
        writer.write(path)
        try:
            await inspector.decode(path, "pdf")
            raise AssertionError("encrypted PDF accepted")
        except ServiceError as error:
            assert error.code == "attachment_invalid"
            checks += 1
        path = root / "audio"
        with wave.open(str(path), "wb") as output:
            output.setparams((1, 2, 16000, 0, "NONE", "not compressed"))
            output.writeframes(b"\x00\x00" * 16000)
        result = await inspector.decode(path, "audio")
        assert result.media_type == "audio/wav" and result.duration_seconds == 1.0
        checks += 1
        path.write_bytes(b"RIFF\x00\x00\x00\x00WAVEgarbage")
        try:
            await inspector.decode(path, "audio")
            raise AssertionError("fake audio accepted")
        except ServiceError as error:
            assert error.code == "attachment_invalid"
            checks += 1
    module = str(Path(__file__).resolve().parents[1])
    code = """
import sys, resource, socket, subprocess
sys.path.insert(0, sys.argv[1])
from attachment_inspector_worker import confine
confine()
assert resource.getrlimit(resource.RLIMIT_AS) == (268435456,268435456)
try: socket.socket()
except PermissionError: pass
else: raise AssertionError('network available')
try: subprocess.run(['/bin/true'])
except PermissionError: pass
else: raise AssertionError('exec available')
try: bytearray(300*1024*1024)
except MemoryError: pass
else: raise AssertionError('memory limit absent')
print('isolated')
"""
    result = subprocess.run([sys.executable, "-I", "-c", code, module], capture_output=True, timeout=15)
    assert result.returncode == 0 and result.stdout.strip() == b"isolated", (result.returncode, result.stdout, result.stderr)
    checks += 4
    print(json.dumps({"status": "passed", "checks": checks, "synthetic": True, "native_inference": False, "parser_seconds": 15, "address_space_bytes": 268435456, "slots": 2}))


if __name__ == "__main__":
    asyncio.run(main())
