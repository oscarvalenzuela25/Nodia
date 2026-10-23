"""Stage the code-only frozen Client at a new path; never edit nginx or start it."""
from pathlib import Path, PurePosixPath
import hashlib
import json
import os
import tarfile

ARCHIVE = Path("/tmp/nodia-ai-ai38-ownerclient-r01.tar.gz")
TARGET = Path("/opt/nodia/releases/nodia-client-ai38-owner-r01")
ROOT_INPUTS = {"package.json", "package-lock.json", "vite.config.ts", "tsconfig.json", "tsconfig.app.json", "tsconfig.node.json"}


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def stage():
    expected = json.loads(input())
    assert set(expected) == {"archive_sha256", "manifest_sha256"}
    assert all(isinstance(value, str) and len(value) == 64 and all(c in "0123456789abcdef" for c in value)
               for value in expected.values())
    assert os.geteuid() == 0
    assert TARGET.parent.resolve() == TARGET.parent and TARGET.parent.is_dir()
    assert not TARGET.exists() and not TARGET.is_symlink(), "never_overwrite_release"
    assert ARCHIVE.is_file() and not ARCHIVE.is_symlink() and ARCHIVE.stat().st_size <= 100 * 1024 * 1024
    assert sha(ARCHIVE.read_bytes()) == expected["archive_sha256"]
    with tarfile.open(ARCHIVE, "r:gz") as archive:
        members = archive.getmembers()
        assert 2 <= len(members) <= 10000
        assert len({member.name for member in members}) == len(members)
        assert sum(member.size for member in members) <= 100 * 1024 * 1024
        for member in members:
            path = PurePosixPath(member.name)
            assert member.isfile() and not path.is_absolute() and ".." not in path.parts
            assert str(path) == member.name and "\\" not in member.name
            assert "node_modules" not in path.parts and not any(part.startswith(".env") for part in path.parts)
            assert 0 <= member.size <= 20 * 1024 * 1024
        raw_manifest = archive.extractfile("manifest.json").read()
        assert sha(raw_manifest) == expected["manifest_sha256"]
        manifest = json.loads(raw_manifest)
        assert manifest["schema_version"] == 1 and manifest["stage"] == "AI-38"
        assert manifest["deployment"] is False and manifest["private_environment_files_copied"] is False
        assert set(member.name for member in members) == set(manifest["files"]) | {"manifest.json"}
        assert {name for name in manifest["files"] if not name.startswith("dist/")} == ROOT_INPUTS
        assert "dist/index.html" in manifest["files"]
        assert sum(name.startswith("dist/") for name in manifest["files"]) == manifest["build_outputs"]
        payloads = {member.name: archive.extractfile(member).read() for member in members}
        assert all(sha(payloads[name]) == digest for name, digest in manifest["files"].items())
    TARGET.mkdir(mode=0o755)
    for name, raw in payloads.items():
        destination = TARGET / name
        assert destination.resolve().is_relative_to(TARGET)
        destination.parent.mkdir(parents=True, exist_ok=True, mode=0o755)
        with destination.open("xb") as output:
            output.write(raw)
        os.chmod(destination, 0o644)
    print(json.dumps({"stage": "AI-38", "status": "Client_staged_not_served",
                      "release": str(TARGET), **expected, "members": len(payloads),
                      "outputs": manifest["build_outputs"], "service_changes": 0,
                      "nginx_changes": 0, "SQL_requests": 0, "provider_requests": 0}))


if __name__ == "__main__":
    stage()
