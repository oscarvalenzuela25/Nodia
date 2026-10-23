"""Freeze a reviewed Client successor using isolated Vite build output and cache."""
from pathlib import Path
import gzip
import hashlib
import io
import json
import os
import re
import shutil
import subprocess
import tarfile

ROOT = Path(__file__).resolve().parents[3]
CLIENT = ROOT / "nodia-client"
BASE = ROOT / ".tmp/ai38-client-candidate01/nodia-client"
BASE_SHA = "0c54fcafebe607a661b169288daa92fe12ca7110278d94eac9160478214ee49b"
DIST = ROOT / ".tmp/ai38-ownerclient-r01-build"
STAGE = ROOT / ".tmp/ai38-ownerclient-r01/nodia-client"
ARCHIVE = ROOT / ".tmp/ai38-ownerclient-r01.tar.gz"
REFERENCE = ROOT / "docs/evidence/nodia-ai-ai38-ownerclient-r01.json"
LOG = ROOT / ".tmp/ai38-ownerclient-r01-build.log"
EXPECTED = {
    "src/modules/nodiaAi/components/ConfigurationDrawer/ConfigurationDrawer.tsx": "93cc1fbf79d0e0075d60e8abbed93f4029eb8d5f9e21acb84defa189de6c77d9",
    "src/modules/nodiaAi/infrastructure/useServices.ts": "9d294b2649fea9ffcd1e978d98994a2cda55d7477761ba51bfb1090e853af42f",
    "src/modules/nodiaAi/pages/NodiaAI/NodiaAI.tsx": "e14cfb3552eff1db8e5808a53c6ccf22e42dd33c9e50b44a8c033eed23b8bbd9",
    "src/modules/nodiaAi/infrastructure/eligibilityPresentation.ts": "5c23edb2037bb89fa0e55027ef41b0e0be84e9b7bdd6e0db146818e2fd8217f2",
    "src/translate/es/nodiaAi.json": "45332ecf8969b6f727f72dfabfc78a9067de4f83189b795525503a6d73b6b80a",
    "src/translate/en/nodiaAi.json": "ad10f02fbccfabf87168b6ab643a100f6b520ca796eea07aee6b0f87f2c4b32d",
}
ROOT_INPUTS = ("package.json", "package-lock.json", "vite.config.ts", "tsconfig.json", "tsconfig.app.json", "tsconfig.node.json")


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def hashes(folder, suffixes=None, omit_tests=False):
    result = {}
    for path in folder.rglob("*"):
        assert not path.is_symlink(), "symlink_source"
        if not path.is_file():
            continue
        name = path.relative_to(CLIENT).as_posix()
        if omit_tests and name.startswith("src/test/"):
            continue
        if suffixes is None or path.suffix in suffixes:
            result[name] = sha(path.read_bytes())
    return dict(sorted(result.items()))


def encoded(value):
    return json.dumps(value, sort_keys=True, indent=2).encode() + b"\n"


def build():
    assert all(not path.exists() for path in (DIST, STAGE.parent, ARCHIVE, REFERENCE, LOG)), "frozen_output_exists"
    base_raw = (BASE / "manifest.json").read_bytes()
    assert sha(base_raw) == BASE_SHA
    base = json.loads(base_raw)
    for name, digest in base["files"].items():
        assert sha((BASE / name).read_bytes()) == digest
    sources = hashes(CLIENT / "src", {".ts", ".tsx", ".css", ".svg"}, True)
    json_inputs = hashes(CLIENT / "src", {".json"}, True)
    public_inputs = hashes(CLIENT / "public")
    for name, digest in EXPECTED.items():
        assert sha((CLIENT / name).read_bytes()) == digest, "reviewed_source_changed"
    delta = {name for name, digest in sources.items() if base["production_sources"].get(name) != digest}
    assert delta == {name for name in EXPECTED if not name.endswith(".json")}
    assert set(base["production_sources"]) <= set(sources)
    for name in ROOT_INPUTS:
        assert sha((CLIENT / name).read_bytes()) == base["files"][name], "unreviewed_build_config_change"
    api_names = [name for name in base["files"] if re.fullmatch(r"dist/assets/api-[^/]+\.js", name)]
    assert len(api_names) == 1
    api = (BASE / api_names[0]).read_text(encoding="utf-8")
    google = re.search(r"GOOGLE_CLIENT_ID:`([^`]+)`", api).group(1)
    assert re.search(r"API_URL:`([^`]+)`", api).group(1) == "/api/v1"
    assert google.endswith(".apps.googleusercontent.com")
    env = dict(os.environ, VITE_API_URL="/api/v1", VITE_GOOGLE_CLIENT_ID=google)
    node = shutil.which("node")
    assert node
    command = [node, str(CLIENT / "node_modules/vite/bin/vite.js"), "build", "--mode", "ai38-owner-client-r01",
               "--outDir", str(DIST), "--emptyOutDir"]
    with LOG.open("xb") as output:
        process = subprocess.run(command, cwd=CLIENT, env=env, stdout=output, stderr=subprocess.STDOUT, timeout=600)
    assert process.returncode == 0, "isolated_Vite_build_failed"
    assert hashes(CLIENT / "src", {".ts", ".tsx", ".css", ".svg"}, True) == sources, "source_changed_during_build"
    assert hashes(CLIENT / "src", {".json"}, True) == json_inputs
    assert hashes(CLIENT / "public") == public_inputs
    files = {}
    for path in sorted(DIST.rglob("*")):
        assert not path.is_symlink()
        if path.is_file():
            name = "dist/" + path.relative_to(DIST).as_posix()
            destination = STAGE / name
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(path.read_bytes())
            files[name] = sha(destination.read_bytes())
    for name in ROOT_INPUTS:
        destination = STAGE / name
        destination.write_bytes((CLIENT / name).read_bytes())
        files[name] = sha(destination.read_bytes())
    new_api_names = [name for name in files if re.fullmatch(r"dist/assets/api-[^/]+\.js", name)]
    assert len(new_api_names) == 1
    new_api = (STAGE / new_api_names[0]).read_text(encoding="utf-8")
    assert re.search(r"API_URL:`([^`]+)`", new_api).group(1) == "/api/v1"
    assert re.search(r"GOOGLE_CLIENT_ID:`([^`]+)`", new_api).group(1) == google
    manifest = dict(base, files=dict(sorted(files.items())), production_sources=sources,
                    additional_JSON_inputs=json_inputs, public_source_inputs=public_inputs,
                    build_outputs=sum(name.startswith("dist/") for name in files),
                    build_mode="ai38-owner-client-r01", baseline_manifest_sha256=BASE_SHA,
                    isolated_build_output=True, private_environment_files_copied=False)
    raw_manifest = encoded(manifest)
    (STAGE / "manifest.json").write_bytes(raw_manifest)
    with ARCHIVE.open("xb") as output:
        with gzip.GzipFile(filename="", mode="wb", fileobj=output, mtime=0) as compressed:
            with tarfile.open(fileobj=compressed, mode="w", format=tarfile.USTAR_FORMAT) as archive:
                for name in sorted(set(files) | {"manifest.json"}):
                    raw = (STAGE / name).read_bytes()
                    member = tarfile.TarInfo(name)
                    member.size = len(raw)
                    member.mode = 0o644
                    member.mtime = 0
                    archive.addfile(member, io.BytesIO(raw))
    reference = {
        "schema": "nodia-ai-ai38-ownerclient-r01-v1", "status": "frozen_local_build_not_deployed",
        "path": STAGE.relative_to(ROOT).as_posix(), "manifest_sha256": sha(raw_manifest),
        "archive_path": ARCHIVE.relative_to(ROOT).as_posix(), "archive_sha256": sha(ARCHIVE.read_bytes()),
        "release": "/opt/nodia/releases/nodia-client-ai38-owner-r01",
        "build_outputs": manifest["build_outputs"], "package_members_including_manifest": len(files) + 1,
        "production_source_count": len(sources), "baseline_manifest_sha256": BASE_SHA,
        "changed_sources": {name: {"before": base["production_sources"].get(name), "after": sources[name]} for name in sorted(delta)},
        "other_baseline_sources_preserved": len(base["production_sources"]) - len([name for name in delta if name in base["production_sources"]]),
        "reviewed_translation_hashes": {name: EXPECTED[name] for name in EXPECTED if name.endswith(".json")},
        "historical_translation_source_hashes_available": False,
        "root_build_inputs_and_lock_preserved": True, "build_exit": 0,
        "build_log_sha256": sha(LOG.read_bytes()), "builder_sha256": sha(Path(__file__).read_bytes()),
        "public_config": {"api_url": "/api/v1", "google_client_id_present": True,
                          "google_client_id_sha256": sha(google.encode()), "same_Google_client_as_candidate01": True},
        "private_environment_copied": False, "deployment": False, "VM_operations": 0,
        "source_stability_asserted_before_and_after_build": True,
        "differences_explained": {
            "ConfigurationDrawer": "Refresh status on opening and recoverable explicit retry, preserving draft configuration.",
            "useServices": "Refresh provider eligibility after a completed turn; invalidate pending stale snapshot safely.",
            "NodiaAI": "Present stale/unavailable status and retry, without replaying a message or selecting a fallback.",
            "eligibilityPresentation": "Shared pure classification of eligibility state for drawer and page.",
            "ES_EN_JSON": "Translated feedback for freshness and explicit retry; baseline manifest omitted JSON source hashes.",
            "compiled_graph": "Vite regenerates affected modules and their importers with content hashes; identical bytes remain identifiable by SHA.",
        },
    }
    with REFERENCE.open("xb") as output:
        output.write(encoded(reference))
    print(json.dumps(reference))


if __name__ == "__main__":
    build()
