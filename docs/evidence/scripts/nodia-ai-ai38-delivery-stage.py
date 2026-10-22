"""Stage the frozen public candidate for isolated checks; never adopt or start it.

Explicit single packet/target. The existing laboratory dependency directory is
linked only after exact packet verification; this does not prove npm ci parity.
"""
from pathlib import Path, PurePosixPath
import hashlib
import json
import os
import tarfile

os.umask(0o077)
archive = Path("/tmp/ai38-node-candidate01.tar.gz")
target = Path("/opt/nodia/verification/ai38-node-candidate01")
dependency_directory = Path("/opt/nodia/nodia-server/node_modules")
expected_archive = "b7492afeeb31b9bb65fb0ec3a41ea1caf016d65b3f09af3ac3f487727782fabb"
expected_manifest = "0751160bb8cb146acec9dda21daa0226875a2c40f1c898a9c649e69a9583b8e3"


def digest(bytes_value):
    return hashlib.sha256(bytes_value).hexdigest()


assert digest(archive.read_bytes()) == expected_archive
assert not target.exists() and not target.is_symlink(), "preserve previous stage"
assert dependency_directory.is_dir() and not dependency_directory.is_symlink()
with tarfile.open(archive, "r:gz") as packet:
    members = packet.getmembers()
    names = set()
    for item in members:
        member_path = PurePosixPath(item.name)
        assert not member_path.is_absolute() and ".." not in member_path.parts and "\\" not in item.name
        assert member_path.parts[0] == "nodia-server" and item.name not in names
        assert item.isfile() or item.isdir(), "symlinks, hardlinks and devices forbidden"
        assert not any(part in {".env", "node_modules"} for part in member_path.parts)
        names.add(item.name)
    manifest_bytes = packet.extractfile("nodia-server/manifest.json").read()
    assert digest(manifest_bytes) == expected_manifest
    manifest = json.loads(manifest_bytes)
    assert manifest["stage"] == "AI-38" and manifest["environment_or_profile_included"] is False
    expected_files = {"nodia-server/" + member: sha for member, sha in manifest["files"].items()}
    expected_files["nodia-server/manifest.json"] = expected_manifest
    assert {m.name for m in members if m.isfile()} == set(expected_files)
    target.mkdir(mode=0o700)
    for member in members:
        if not member.isfile():
            continue
        contents = packet.extractfile(member).read()
        assert digest(contents) == expected_files[member.name], "archive member digest mismatch"
        destination = target / member.name
        destination.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        with destination.open("xb") as output:
            output.write(contents)
        assert digest(destination.read_bytes()) == expected_files[member.name]

runtime = target / "nodia-server"
(runtime / "node_modules").symlink_to(dependency_directory, target_is_directory=True)
print(json.dumps({
    "schema_version": 1, "stage": "AI-38", "scope": "isolated_packet_stage_not_deployment",
    "context": {"environment_id": "linux_lab", "package_manifest_sha256": expected_manifest},
    "root": str(runtime), "archive_sha256": expected_archive,
    "verified_packet_files": len(expected_files), "compiled_outputs": manifest["compiled_outputs"],
    "dependency_directory": str(dependency_directory), "dependencies_present": True,
    "dependency_lock_installation_verified": False, "environment_included": False,
    "provider_requests": 0, "database_operations": 0, "services_restarted": False,
    "release_authorized": False,
}, indent=2))
