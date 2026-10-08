"""Install exactly the reviewed official artifact; never run a remote installer."""
import argparse
import hashlib
import json
import os
import platform
import shutil
import tarfile
import tempfile
import urllib.request
from pathlib import Path


def install(destination: Path, target: str) -> dict[str, str]:
    lock = json.loads(Path(__file__).resolve().parents[1].joinpath("antigravity-cli.lock.json").read_text())
    artifact = lock["platforms"][target]
    destination = destination.resolve()
    destination.mkdir(parents=True, exist_ok=True)
    binary = destination / ("agy.exe" if target.startswith("windows") else "agy")
    with tempfile.TemporaryDirectory(prefix="install-", dir=destination) as directory:
        archive = Path(directory) / "artifact"
        with urllib.request.urlopen(artifact["url"], timeout=60) as response, archive.open("wb") as output:
            size = 0
            while chunk := response.read(1_048_576):
                size += len(chunk)
                if size > 512 * 1_048_576:
                    raise ValueError("CLI artifact exceeds download limit")
                output.write(chunk)
        with archive.open("rb") as output:
            if hashlib.file_digest(output, "sha512").hexdigest() != artifact["sha512"]:
                raise ValueError("Official CLI artifact checksum mismatch")
        candidate = Path(directory) / binary.name
        if target.startswith("linux"):
            with tarfile.open(archive, "r:gz") as package:
                entries = [item for item in package.getmembers() if item.isfile()]
                if len(entries) != 1 or entries[0].size > 512 * 1_048_576:
                    raise ValueError("Unexpected CLI archive contents")
                with package.extractfile(entries[0]) as source, candidate.open("wb") as output:
                    shutil.copyfileobj(source, output)
        else:
            shutil.copyfile(archive, candidate)
        candidate.chmod(0o755)
        with candidate.open("rb") as output:
            digest = hashlib.file_digest(output, "sha512").hexdigest()
        if digest != artifact.get("binary_sha512", artifact["sha512"]):
            raise ValueError("Pinned CLI binary checksum mismatch")
        if binary.exists():
            with binary.open("rb") as output:
                if hashlib.file_digest(output, "sha512").hexdigest() != digest:
                    raise ValueError("Destination contains another binary; choose a new version directory")
        else:
            os.replace(candidate, binary)
        metadata = {"version": lock["version"], "path": str(binary), "sha512": digest}
        (destination / "verified.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")
        return metadata


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--destination", type=Path, required=True)
    parser.add_argument("--platform", choices=["windows_amd64", "linux_amd64"],
                        default="windows_amd64" if os.name == "nt" else "linux_amd64")
    options = parser.parse_args()
    if platform.machine().lower() not in ("amd64", "x86_64"):
        parser.error("Only x86-64 is verified by this lock file")
    print(json.dumps(install(options.destination, options.platform), indent=2))
