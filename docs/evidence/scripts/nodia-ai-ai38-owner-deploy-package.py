"""Build one code-only successor from the immutable R02 archive, offline only.

Preserve every baseline member except the four outputs/source of the reviewed
UserFilterDto fix. No source-tree glob, runtime import, VM call, or secret read.
"""
from pathlib import Path, PurePosixPath
import gzip
import hashlib
import io
import json
import tarfile

ROOT = Path(__file__).resolve().parents[3]
BASE = ROOT / "docs/evidence/nodia-ai-ai38-journal-package-r02.json"
BASE_SHA = "c8f49aa3adb21f63da4d75f84a811ab3b758e90ce57fe8aff2e8d2fc498256ae"
ARCHIVE = ROOT / ".tmp/ai38-journal-r02.tar.gz"
TRANSFER = ROOT / ".tmp/ai38-journal-package-transfer-r02.json"
FIX = ROOT / "docs/evidence/nodia-ai-ai38-users-scope-fix-r01.json"
NAMES = (
    "src/user/dto/filter-user.dto.ts",
    "dist/user/dto/filter-user.dto.js",
    "dist/user/dto/filter-user.dto.d.ts",
    "dist/user/dto/filter-user.dto.js.map",
)
OUTPUT = ROOT / ".tmp/ai38-owner-deploy-r01.tar.gz"
MANIFEST = ROOT / "docs/evidence/nodia-ai-ai38-owner-deploy-package-r01.json"
RECEIPT = ROOT / "docs/evidence/nodia-ai-ai38-owner-deploy-package-build-r01.json"


def sha(value):
    return hashlib.sha256(value).hexdigest()


def encoded(value):
    return json.dumps(value, sort_keys=True, indent=2).encode()


def build():
    assert all(not path.exists() for path in (OUTPUT, MANIFEST, RECEIPT)), "frozen_output_exists"
    base_raw = BASE.read_bytes()
    assert sha(base_raw) == BASE_SHA, "baseline_manifest_changed"
    base = json.loads(base_raw)
    transfer = json.loads(TRANSFER.read_bytes())
    assert transfer["manifest_sha256"] == BASE_SHA
    assert sha(ARCHIVE.read_bytes()) == transfer["archive_sha256"], "baseline_archive_changed"
    assert len(base["files"]) == 3879
    assert sum(name.startswith("dist/") for name in base["files"]) == 2851
    assert base["knowledge_release"] == "4189005373b4e6040a0e441d21c2978fe1d423ae568e53f74df1592e6f900130"
    payloads = {}
    with tarfile.open(ARCHIVE, "r:gz") as archive:
        members = archive.getmembers()
        assert len({member.name for member in members}) == len(members)
        assert {member.name for member in members} == set(base["files"]) | {"release-manifest.json"}
        for member in members:
            name = member.name
            parts = PurePosixPath(name)
            assert member.isfile() and not parts.is_absolute() and ".." not in parts.parts
            assert "node_modules" not in parts.parts and not any(part.startswith(".env") for part in parts.parts)
            raw = archive.extractfile(member).read()
            if name == "release-manifest.json":
                assert raw == base_raw
            else:
                assert sha(raw) == base["files"][name], "baseline_member_changed"
                payloads[name] = raw
    fix = json.loads(FIX.read_bytes())
    assert fix["validation"]["passed"] == 12 and fix["validation"]["failed"] == 0
    for name in NAMES:
        path = ROOT / "nodia-server" / name
        assert path.is_file() and not path.is_symlink()
        raw = path.read_bytes()
        assert sha(raw) != base["files"][name], "expected_fix_missing"
        if "nodia-server/" + name in fix["source_pins"]:
            assert sha(raw) == fix["source_pins"]["nodia-server/" + name], "reviewed_fix_changed"
        payloads[name] = raw
    for name, digest in fix["source_pins"].items():
        assert sha((ROOT / name).read_bytes()) == digest, "fix_review_pin_changed"
    manifest = dict(base, files={name: sha(raw) for name, raw in sorted(payloads.items())})
    changed = [name for name, digest in manifest["files"].items() if digest != base["files"][name]]
    assert sorted(changed) == sorted(NAMES)
    assert manifest["files"]["ops/nodia-ai-backups/journal.md"] == base["files"]["ops/nodia-ai-backups/journal.md"]
    raw_manifest = encoded(manifest)
    with OUTPUT.open("xb") as output:
        with gzip.GzipFile(filename="", mode="wb", fileobj=output, mtime=0) as compressed:
            with tarfile.open(fileobj=compressed, mode="w", format=tarfile.USTAR_FORMAT) as archive:
                for name, raw in sorted({**payloads, "release-manifest.json": raw_manifest}.items()):
                    member = tarfile.TarInfo(name)
                    member.size = len(raw)
                    member.mode = 0o644
                    member.mtime = 0
                    archive.addfile(member, io.BytesIO(raw))
    with MANIFEST.open("xb") as output:
        output.write(raw_manifest)
    receipt = {
        "schema": "nodia-ai-ai38-owner-deploy-package-build-v1",
        "status": "frozen_offline_successor_not_deployed",
        "release": "/opt/nodia/releases/nodia-server-ai38-owner-r01",
        "baseline_manifest_sha256": BASE_SHA,
        "baseline_archive_sha256": transfer["archive_sha256"],
        "manifest_path": MANIFEST.relative_to(ROOT).as_posix(),
        "manifest_sha256": sha(raw_manifest),
        "archive_path": OUTPUT.relative_to(ROOT).as_posix(),
        "archive_sha256": sha(OUTPUT.read_bytes()),
        "members": len(payloads),
        "dist_outputs": sum(name.startswith("dist/") for name in payloads),
        "changes": {name: {"before": base["files"][name], "after": manifest["files"][name]} for name in changed},
        "baseline_other_members_preserved": len(payloads) - len(changed),
        "knowledge_release": manifest["knowledge_release"],
        "journal_sources_and_ops_preserved": True,
        "dependency_lock_preserved": True,
        "migrations_preserved": True,
        "env_or_dependencies_embedded": False,
        "runtime_imports_or_VM_operations": 0,
        "provider_requests": 0,
        "deployment_performed": False,
        "release_authorized": False,
    }
    with RECEIPT.open("xb") as output:
        output.write(encoded(receipt))
    print(json.dumps(receipt))


if __name__ == "__main__":
    build()
