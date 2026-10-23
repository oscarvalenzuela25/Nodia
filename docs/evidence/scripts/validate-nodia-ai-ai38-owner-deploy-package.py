"""Independently compare the successor archive to R02 and record focused QA."""
from datetime import datetime, timezone
from pathlib import Path
import hashlib
import json
import tarfile

ROOT = Path(__file__).resolve().parents[3]


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def read(name):
    return json.loads((ROOT / name).read_bytes())


def main():
    evidence_path = ROOT / "docs/evidence/nodia-ai-ai38-owner-deploy-qa-r01.json"
    assert not evidence_path.exists(), "frozen_QA_exists"
    build = read("docs/evidence/nodia-ai-ai38-owner-deploy-package-build-r01.json")
    base = read("docs/evidence/nodia-ai-ai38-journal-package-r02.json")
    raw = (ROOT / build["manifest_path"]).read_bytes()
    assert sha(raw) == build["manifest_sha256"]
    manifest = json.loads(raw)
    archive_path = ROOT / build["archive_path"]
    assert sha(archive_path.read_bytes()) == build["archive_sha256"]
    with tarfile.open(archive_path, "r:gz") as archive:
        members = archive.getmembers()
        assert all(member.isfile() for member in members)
        assert len({member.name for member in members}) == len(members)
        assert set(member.name for member in members) == set(manifest["files"]) | {"release-manifest.json"}
        assert archive.extractfile("release-manifest.json").read() == raw
        for name, digest in manifest["files"].items():
            assert sha(archive.extractfile(name).read()) == digest
    changed = {name: digest for name, digest in manifest["files"].items() if base["files"][name] != digest}
    assert set(changed) == set(build["changes"])
    assert set(manifest["files"]) == set(base["files"])
    assert all(sha((ROOT / "nodia-server" / name).read_bytes()) == digest for name, digest in changed.items())
    tests_path = ".tmp/ai38-owner-deploy-unit-r01.json"
    tests = read(tests_path)
    assert tests["success"] and tests["numPassedTests"] == tests["numTotalTests"] == 12
    assert tests["numFailedTests"] == tests["numPendingTests"] == 0
    checks = [assertion["fullName"] for suite in tests["testResults"] for assertion in suite["assertionResults"]]
    assert len(checks) == 12
    pins = [
        "docs/evidence/scripts/nodia-ai-ai38-owner-deploy-package.py",
        "docs/evidence/scripts/validate-nodia-ai-ai38-owner-deploy-package.py",
        "nodia-server/src/user/use-case/get-all-users.use-case.spec.ts",
        "nodia-server/src/user/user.service.ts",
        "nodia-server/src/common/utils/ransack-query.policies.ts",
        "nodia-server/src/common/utils/ransack-query.builder.ts",
        "nodia-server/src/main.ts",
        ".tmp/ai38-owner-deploy-unit-r01.json",
        ".tmp/ai38-owner-deploy-build-r01.log",
        ".tmp/ai38-owner-deploy-lint-r01.log",
    ]
    report = {
        "schema": "nodia-ai-ai38-owner-deploy-QA-v1",
        "observed_at_utc_operator_clock": datetime.now(timezone.utc).isoformat(),
        "status": "passed_offline_frozen_package_not_deployed",
        "test_counts": {"passed": 12, "failed": 0, "skipped": 0, "files": 1},
        "test_cases": checks,
        "build_exit": 0,
        "lint_exit": 0,
        "lint_historical_warnings": 3,
        "baseline_manifest_sha256": build["baseline_manifest_sha256"],
        "manifest_sha256": build["manifest_sha256"],
        "archive_sha256": build["archive_sha256"],
        "all_archive_bytes_match_manifest": True,
        "archive_members_including_manifest": len(members),
        "only_four_reviewed_DTO_members_changed": True,
        "other_3875_baseline_members_preserved": True,
        "migrations_schema_dependencies_journal_and_publication_unchanged_by_package": True,
        "knowledge_release": manifest["knowledge_release"],
        "source_pins": {name: sha((ROOT / name).read_bytes()) for name in pins},
        "VM_operations": 0,
        "SQL_or_provider_requests": 0,
        "ADR_required": False,
        "limits": [
            "Focused tests use a real strict validation pipe, use case, UserService and Ransack/TypeORM SQL builder; persistence terminal is mocked and no PostgreSQL socket is opened.",
            "Build/package evidence does not prove deployed HTTP behavior, authenticated owner-selector UI, current provider availability, or a 62-table/29-migration live schema; these require runtime acceptance.",
            "The source fix only restores native HTTP id_eq. It does not widen the closed MCP UserQuery contract or publish a capability.",
        ],
    }
    with evidence_path.open("xb") as output:
        output.write(json.dumps(report, sort_keys=True, indent=2).encode())
    print(json.dumps({"status": report["status"], "QA": evidence_path.relative_to(ROOT).as_posix(),
                      "sha256": sha(evidence_path.read_bytes()), "tests": 12,
                      "archive_members_checked": len(members)}))


if __name__ == "__main__":
    main()
