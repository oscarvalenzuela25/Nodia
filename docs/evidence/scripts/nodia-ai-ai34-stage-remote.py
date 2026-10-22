"""Check and stage an immutable SQL fixture; never loads the activated environment."""
from __future__ import annotations
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import sys
import tarfile

expected, attempt = sys.argv[1:3]
assert re.fullmatch(r"[a-f0-9]{64}", expected)
assert re.fullmatch(r"attempt[0-9]{2}", attempt)
archive = Path("/tmp/ai34-sql-stage.tar")
assert hashlib.sha256(archive.read_bytes()).hexdigest() == expected
os.umask(0o077)
target = Path("/opt/nodia/verification/ai34-compiled-" + attempt)
target.mkdir(mode=0o700, exist_ok=False)
with tarfile.open(archive) as bundle:
    for member in bundle.getmembers():
        relative = PurePosixPath(member.name)
        assert not relative.is_absolute() and ".." not in relative.parts
        assert not member.issym() and not member.islnk()
        assert relative.parts[0] in ("dist", "package.json", "package-lock.json", "test", "scripts", ".tmp")
    bundle.extractall(target, filter="data")
manifest = json.loads((target / ".tmp/ai34-stage-manifest.json").read_text())
for name, digest in manifest["files"].items():
    relative = PurePosixPath(name)
    assert not relative.is_absolute() and ".." not in relative.parts
    assert hashlib.sha256((target / relative).read_bytes()).hexdigest() == digest
assert not (target / ".env").exists()
os.symlink("/opt/nodia/verification/ai32-r02-20261018/node_modules", target / "node_modules")
versions = {}
runtime = Path("/opt/nodia/releases/nodia-server-ai15-20261016")
for package in ("@nestjs/common", "@nestjs/core", "@nestjs/testing", "@nestjs/typeorm", "typeorm", "pg", "@aws-sdk/client-s3"):
    values = {}
    for label, directory in (("staging", target), ("activated_runtime", runtime)):
        file = directory / "node_modules" / package / "package.json"
        values[label] = json.loads(file.read_text())["version"] if file.exists() else None
    assert values["activated_runtime"] is None or values["staging"] == values["activated_runtime"]
    versions[package] = values
print(json.dumps({"stage": "AI-34", "scope": "disposable_sql_stage_setup", "status": "passed", "attempt": attempt, "compiled_files_verified": manifest["compiled_files"], "manifest_sha256": hashlib.sha256((target / ".tmp/ai34-stage-manifest.json").read_bytes()).hexdigest(), "archive_sha256": expected, "test_sha256": manifest["files"]["test/nodia-ai-ai34.integration.mjs"], "dependency_versions": versions, "configured_database_used": False, "production_deployed": False, "services_restarted": False}, indent=2))
