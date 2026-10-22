"""Freeze a finished local Node build as public artifacts; never deploy or read operational data."""
import hashlib
import json
from pathlib import Path
import shutil
import tarfile

ROOT = Path(__file__).resolve().parents[3]
DIST = ROOT / "nodia-server/dist"
STAGE = ROOT / ".tmp/ai36-c05-r05-node-candidate01"
ARCHIVE = ROOT / ".tmp/ai36-c05-r05-node-candidate01.tar"
OUTPUT = ROOT / "docs/evidence/nodia-ai-ai36-c05-r05-node-compiled-delta.json"
SOURCE_HASHES = {
    "src/nodia-ai-context/use-case/process-nodia-ai-stage.use-case.ts": "c93b8edb1e86fb6513e8bcc20b3d86ead3f8ad7d4ce3091648ceb1e4f07cd34f",
    "src/nodia-ai-runtime/types/nodia-ai-failure-diagnostic.ts": "aa5d157f5d9392e42130372f1b9e475b33a650796a64f9841ebaf5933706dcdd",
}
EXPECTED_DELTA = {
    "nodia-ai-context/use-case/process-nodia-ai-stage.use-case.js",
    "nodia-ai-context/use-case/process-nodia-ai-stage.use-case.js.map",
    "nodia-ai-context/use-case/process-nodia-ai-stage.use-case.d.ts",
    "nodia-ai-runtime/types/nodia-ai-failure-diagnostic.js",
    "nodia-ai-runtime/types/nodia-ai-failure-diagnostic.js.map",
}


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def ref(path):
    return {"path": path.relative_to(ROOT).as_posix(), "sha256": sha(path)}


def main():
    assert not any(path.exists() for path in (STAGE, ARCHIVE, OUTPUT)), "Preserve each immutable candidate."
    for path, expected in SOURCE_HASHES.items():
        assert sha(ROOT / "nodia-server" / path) == expected
    baseline_path = ROOT / ".tmp/ai36-c05-r05-node-dist-before.json"
    baseline = json.loads(baseline_path.read_text())
    historical_path = ROOT / "docs/evidence/nodia-ai-ai36-c05-r01-compiled-delta.json"
    historical = json.loads(historical_path.read_text())
    assert len(baseline) == 2803
    assert all(baseline[path.removeprefix("dist/")] == digest for path, digest in historical["current_files"].items())
    compiler_cache = DIST / "tsconfig.tsbuildinfo"
    current = {path.relative_to(DIST).as_posix(): sha(path) for path in sorted(DIST.rglob("*"))
        if path.is_file() and path != compiler_cache}
    assert set(current) == set(baseline)
    delta = {path: {"old_sha256": baseline[path], "new_sha256": digest}
        for path, digest in current.items() if baseline[path] != digest}
    assert set(delta) == EXPECTED_DELTA
    executable = {"dist/" + path: digest for path, digest in current.items() if Path(path).suffix in (".js", ".json", ".md")}
    assert len(executable) == 971
    knowledge_path = DIST / "nodia-ai/knowledge/manifest.json"
    knowledge = json.loads(knowledge_path.read_text())
    assert sha(knowledge_path) == historical["compiled_knowledge_manifest"]["sha256"]
    assert knowledge["release_id"] == historical["release_id"]
    assert knowledge["capability_contracts"] == historical["capability_contracts"]
    assert len(knowledge["capability_contracts"]) == 74 and len(knowledge["fragments"]) == len(knowledge["documents"]) == 31
    final_tests_path = ROOT / ".tmp/ai36-c05-r05-observation-node-full-final.json"
    final_tests = json.loads(final_tests_path.read_text())
    assert final_tests["success"] and final_tests["numFailedTests"] == 0
    build_log = ROOT / ".tmp/ai36-c05-r05-node-build02.log"
    checks = []
    for line in build_log.read_text(encoding="utf-8-sig").splitlines():
        if line.startswith('{"task":"AI-06"'):
            checks.append(json.loads(line))
    assert any(row.get("sources") == 59 and row.get("excluded") == 28 and row.get("releaseId") == knowledge["release_id"] for row in checks)
    STAGE.mkdir(parents=True)
    for relative in current:
        target = STAGE / "dist" / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(DIST / relative, target)
    shutil.copyfile(baseline_path, STAGE / "baseline-dist-manifest.json")
    packages = []
    for name in ("package.json", "package-lock.json"):
        path = ROOT / "nodia-server" / name
        shutil.copyfile(path, STAGE / name)
        packages.append(ref(path))
    source_files = []
    for path in [*SOURCE_HASHES,
        "src/nodia-ai-context/use-case/process-nodia-ai-stage.use-case.spec.ts",
        "src/nodia-ai-runtime/use-case/run-nodia-ai-stage.use-case.spec.ts",
        "src/nodia-ai-runtime/use-case/retry-nodia-ai-job.use-case.spec.ts"]:
        source = ROOT / "nodia-server" / path
        target = STAGE / "public-source" / path
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, target)
        source_files.append(ref(source))
    manifest = {"schema_version": 1, "stage": "AI-36-C05-R05", "scope": "public_Node_candidate_not_deployed",
        "baseline": ref(baseline_path), "historical_compiled_snapshot": ref(historical_path),
        "production_sources": source_files[:2], "test_sources": source_files[2:], "package_metadata": packages,
        "files": {"dist/" + path: digest for path, digest in current.items()}, "changed_files": delta,
        "release_id": knowledge["release_id"], "source_script": ref(Path(__file__)),
        "full_unit_suite": ref(final_tests_path), "build_log": ref(build_log),
        "non_runtime_compiler_cache_excluded": ref(compiler_cache) if compiler_cache.exists() else None,
        "operational_env_or_profile_included": False, "provider_generations": 0, "services_restarted": False}
    manifest_path = STAGE / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")
    with tarfile.open(ARCHIVE, "x") as archive:
        for path in sorted(STAGE.rglob("*")):
            if path.is_file():
                archive.add(path, arcname=path.relative_to(STAGE).as_posix(), recursive=False)
    result = {"schema_version": 1, "stage": "AI-36-C05-R05", "scope": "offline_Node_observation_retry_candidate_not_deployed",
        "release_id": knowledge["release_id"], "capability_contract_count": 74,
        "capability_contracts": knowledge["capability_contracts"], "compiled_executable_file_count": 971,
        "current_files": executable, "all_compiled_assets": len(current), "changed_files": delta,
        "historical_compiled_snapshot": ref(historical_path), "before_snapshot": ref(baseline_path),
        "compiled_knowledge_manifest": ref(knowledge_path), "unchanged_published_documents": 31,
        "unchanged_published_fragments": 31, "unchanged_publication_sources": 59, "unchanged_excluded_sources": 28,
        "candidate_manifest": ref(manifest_path), "candidate_archive": ref(ARCHIVE),
        "production_sources": source_files[:2], "test_sources": source_files[2:],
        "full_unit_tests": {"total": final_tests["numTotalTests"], "passed": final_tests["numPassedTests"],
            "failed": final_tests["numFailedTests"], "report": ref(final_tests_path)},
        "build_log": ref(build_log), "source": ref(Path(__file__)),
        "transient_pin_explanation": "Nest copied the older src knowledge pin during build; final context:build restored the unchanged historical dist pin. Both before/after snapshots use the final pin.",
        "non_runtime_compiler_cache_excluded": ref(compiler_cache) if compiler_cache.exists() else None,
        "initial_packaging_guard": "The first inventory rejected the extra tsconfig.tsbuildinfo emitted by the full noEmit typecheck; no packet was emitted. Only that explicit non-runtime compiler cache is excluded; all baseline runtime outputs remain required.",
        "provider_generations": 0, "SQL_operations": 0, "services_restarted": False,
        "configuration_changed": False, "historical_artifacts_changed": False,
        "current_provider_acceptance_claimed": False}
    OUTPUT.write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps({"output": ref(OUTPUT), "candidate_archive": ref(ARCHIVE),
        "candidate_manifest": ref(manifest_path), "compiled_files": len(current), "changed_assets": len(delta)}))


if __name__ == "__main__":
    main()
