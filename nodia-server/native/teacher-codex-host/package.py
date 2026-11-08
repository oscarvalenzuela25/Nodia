"""Package a locally built host and record ABI/source pins; never opens a profile."""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parent
IMAGE = "nodia-teacher-codex-build:0.161.0-bookworm"
BASE = "rust:1.95-slim-bookworm@sha256:6f9e63259f12e1e599296f5ecfed2bae46de4af0ee0525dd8b89c046e236d5c5"
COMMIT = "979011409de0a60b52f179721948e65531d26144"


def command(arguments: list[str]) -> str:
    completed = subprocess.run(arguments, capture_output=True, text=True, timeout=90, check=False)
    if completed.returncode:
        raise RuntimeError(f"Packaging command failed ({completed.returncode}): {arguments[0]}")
    return completed.stdout


def digest(path: Path) -> str:
    with path.open("rb") as source:
        return hashlib.file_digest(source, "sha256").hexdigest()


def inspect(directory: Path, *arguments: str) -> str:
    return command([
        "docker", "run", "--rm", "--network", "none",
        "--mount", f"type=bind,source={directory},target=/artifact,readonly",
        IMAGE, *arguments,
    ])


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--profile", choices=("dev", "release"), required=True)
    arguments = parser.parse_args()
    output = (ROOT / ".cache" / "artifacts" / arguments.profile).resolve()
    if not output.is_relative_to(ROOT):
        raise RuntimeError("Artifact directory escaped the host workspace")
    output.mkdir(parents=True, exist_ok=True)
    target_profile = "debug" if arguments.profile == "dev" else "release"
    command([
        "docker", "run", "--rm", "--network", "none",
        "--mount", "type=volume,source=nodia-teacher-codex-target-bookworm,target=/target,readonly",
        "--mount", f"type=bind,source={output},target=/artifact",
        IMAGE, "/bin/sh", "-c",
        f"cp /target/{target_profile}/nodia-teacher-codex-host /artifact/staging-host"
        " && strip --strip-all /artifact/staging-host && chmod 0755 /artifact/staging-host",
    ])
    staging = output / "staging-host"
    checksum = digest(staging)
    filename = "nodia-teacher-codex-host-" + checksum[:16]
    artifact = output / filename
    if artifact.exists():
        if digest(artifact) != checksum:
            raise RuntimeError("Immutable artifact filename collision")
        staging.unlink()
    else:
        staging.rename(artifact)
    capabilities = json.loads(inspect(output, "env", "-i", f"/artifact/{filename}", "--capabilities"))
    if capabilities.get("source_commit") != COMMIT or capabilities.get("compiled_native") is not True:
        raise RuntimeError("Artifact does not contain the pinned native host")
    if capabilities.get("tools") != [] or capabilities.get("attachments") != []:
        raise RuntimeError("Artifact does not impose the text-only lane")
    versions = inspect(output, "readelf", "--version-info", f"/artifact/{filename}")
    glibc_versions = {tuple(map(int, version)) for version in re.findall(r"\bGLIBC_(\d+)\.(\d+)\b", versions)}
    if not glibc_versions or max(glibc_versions) > (2, 39):
        raise RuntimeError("Artifact exceeds the target glibc2.39 baseline")
    dependencies = inspect(output, "ldd", f"/artifact/{filename}")
    if "not found" in dependencies:
        raise RuntimeError("Artifact has unresolved runtime libraries")
    libraries = sorted({line.strip().split()[0] for line in dependencies.splitlines() if line.strip()})
    header = inspect(output, "readelf", "--file-header", f"/artifact/{filename}")
    if "Advanced Micro Devices X86-64" not in header or "ELF64" not in header:
        raise RuntimeError("Artifact is not Linux x86_64 ELF64")
    source_files = {
        path.relative_to(ROOT).as_posix(): digest(path)
        for path in sorted(ROOT.rglob("*"))
        if path.is_file() and not ({".cache", "target"} & set(path.relative_to(ROOT).parts))
    }
    manifest = {
        "schema": "nodia-teacher-codex-host-artifact/1",
        "artifact": {"filename": filename, "sha256": checksum, "bytes": artifact.stat().st_size,
                     "cargo_profile": arguments.profile, "stripped": True, "architecture": "linux-x86_64",
                     "maximum_glibc_symbol": ".".join(map(str, max(glibc_versions))),
                     "runtime_libraries": libraries},
        "source": {"codex_release_tag": "rust-v0.161.0", "codex_commit": COMMIT,
                   "upstream_lock_sha256": "3206e2fdb53a3498758ce2f2972f19fae26beb261befd65cc0eb9e02efe23d52",
                   "files_sha256": source_files},
        "build": {"base_image": BASE, "rust_toolchain": "1.95.0", "jobs": 1,
                  "native_account_used": False, "vm_mutations": False},
        "capabilities": capabilities,
        "qualification": "not_qualified_for_any_real_selection",
    }
    manifest_path = output / (filename + ".manifest.json")
    manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")
    print(json.dumps({"artifact": str(artifact), "manifest": str(manifest_path),
                      "sha256": checksum, "bytes": artifact.stat().st_size,
                      "maximum_glibc_symbol": manifest["artifact"]["maximum_glibc_symbol"],
                      "runtime_libraries": libraries, "profile": arguments.profile}))


if __name__ == "__main__":
    main()
