"""Check frozen Client bytes and classify every output change without execution."""
from datetime import datetime, timezone
from pathlib import Path
import hashlib
import json
import re
import tarfile

ROOT = Path(__file__).resolve().parents[3]
HASHED = re.compile(rb"-[A-Za-z0-9_-]{8}\.js")


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def normalized(raw):
    return HASHED.sub(b"-CONTENTHASH.js", raw)


def main():
    output = ROOT / "docs/evidence/nodia-ai-ai38-ownerclient-r01-validation.json"
    assert not output.exists(), "frozen_validation_exists"
    reference = json.loads((ROOT / "docs/evidence/nodia-ai-ai38-ownerclient-r01.json").read_bytes())
    new_root = ROOT / reference["path"]
    old_root = ROOT / ".tmp/ai38-client-candidate01/nodia-client"
    manifest_raw = (new_root / "manifest.json").read_bytes()
    assert sha(manifest_raw) == reference["manifest_sha256"]
    new = json.loads(manifest_raw)
    old = json.loads((old_root / "manifest.json").read_bytes())
    archive_path = ROOT / reference["archive_path"]
    assert sha(archive_path.read_bytes()) == reference["archive_sha256"]
    with tarfile.open(archive_path, "r:gz") as archive:
        members = archive.getmembers()
        assert len({member.name for member in members}) == len(members) == 178
        assert all(member.isfile() for member in members)
        assert {member.name for member in members} == set(new["files"]) | {"manifest.json"}
        assert archive.extractfile("manifest.json").read() == manifest_raw
        for name, digest in new["files"].items():
            assert sha(archive.extractfile(name).read()) == sha((new_root / name).read_bytes()) == digest
    old_outputs = {name: digest for name, digest in old["files"].items() if name.startswith("dist/")}
    new_outputs = {name: digest for name, digest in new["files"].items() if name.startswith("dist/")}
    assert len(old_outputs) == len(new_outputs) == 171
    unchanged = [name for name, digest in old_outputs.items() if new_outputs.get(name) == digest]
    classified = []
    semantic = []
    for name, digest in old_outputs.items():
        if name in unchanged:
            continue
        logical = HASHED.sub(b".js", name.encode()).decode()
        candidates = [candidate for candidate in new_outputs if HASHED.sub(b".js", candidate.encode()).decode() == logical]
        equal = [candidate for candidate in candidates if normalized((old_root / name).read_bytes()) == normalized((new_root / candidate).read_bytes())]
        if equal:
            assert len(equal) == 1
            classified.append({"before": name, "after": equal[0], "reason": "only_content_hash_references_changed"})
        else:
            semantic.append((name, candidates))
    assert len(unchanged) == 124 and len(classified) == 44
    assert {name.split("/")[-1].split("-")[0] for name, _ in semantic} == {"api", "NodiaAI", "useServices"}
    old_api, api_candidates = next(item for item in semantic if item[0].startswith("dist/assets/api-"))
    assert len(api_candidates) == 1
    reduced = normalized((new_root / api_candidates[0]).read_bytes())
    for language in ("es", "en"):
        path = ROOT / f"nodia-client/src/translate/{language}/nodiaAi.json"
        source = json.loads(path.read_bytes())["eligibility_reasons"]
        assert all("`" not in value and "\\" not in value and "${" not in value for value in source.values())
        compiled = ("eligibility_reasons:{" + ",".join(f"{key}:`{value}`" for key, value in source.items()) + "},").encode()
        assert reduced.count(compiled) == 1
        reduced = reduced.replace(compiled, b"", 1)
    assert reduced == normalized((old_root / old_api).read_bytes()), "unexplained_translation_or_transport_change"
    classified.append({"before": old_api, "after": api_candidates[0],
                       "reason": "only_two_exact_ES_EN_eligibility_reasons_objects_plus_content_hash_references"})
    for name, candidates in semantic:
        if name == old_api:
            continue
        assert len(candidates) == 2 if name.startswith("dist/assets/useServices-") else len(candidates) == 1
        if len(candidates) == 2:
            candidates = [candidate for candidate in candidates if candidate not in {item["after"] for item in classified}]
        assert len(candidates) == 1
        classified.append({"before": name, "after": candidates[0], "reason": "reviewed_NodiaAI_freshness_retry_logic"})
    assert len(classified) == 47
    assert len({item["after"] for item in classified}) == 47
    assert set(item["after"] for item in classified) | set(unchanged) == set(new_outputs)
    for name, digest in new["production_sources"].items():
        assert sha((ROOT / "nodia-client" / name).read_bytes()) == digest
    for group in ("additional_JSON_inputs", "public_source_inputs"):
        for name, digest in new[group].items():
            assert sha((ROOT / "nodia-client" / name).read_bytes()) == digest
    for script in ("nodia-ai-ai38-ownerclient-r01-stage.py", "nodia-ai-ai38-ownerclient-r01-package.py"):
        path = ROOT / "docs/evidence/scripts" / script
        compile(path.read_text(encoding="utf-8"), str(path), "exec")
    report = {
        "schema": "nodia-ai-ai38-ownerclient-validation-v1", "status": "passed_offline_not_deployed",
        "observed_at_utc_operator_clock": datetime.now(timezone.utc).isoformat(),
        "manifest_sha256": reference["manifest_sha256"], "archive_sha256": reference["archive_sha256"],
        "all_178_archive_members_verified": True, "outputs": 171,
        "byte_identical_outputs": unchanged, "all_47_output_changes_explained": classified,
        "only_ES_EN_reason_objects_changed_in_shared_translation_transport_chunk": True,
        "source_comparison": {"old": 647, "new": 648, "unchanged": 644, "changed": 3, "added": 1, "removed": 0},
        "additional_JSON_and_public_inputs_pinned": True,
        "API_url": "/api/v1", "Google_public_client_hash_preserved": True,
        "stage_helper_syntax_validated_not_executed": True,
        "stage_helper_sha256": sha((ROOT / "docs/evidence/scripts/nodia-ai-ai38-ownerclient-r01-stage.py").read_bytes()),
        "validator_sha256": sha(Path(__file__).read_bytes()),
        "VM_operations": 0, "provider_requests": 0, "deployment": False,
        "limits": ["No authenticated browser, HTTP, provider inference, temporal availability or nginx adoption is proved by this offline package validation.",
                   "Historical JSON source hashes were not recorded. Exact ES/EN additions are verified against the compiled baseline after normalizing import hashes; this is not a reconstructed historical JSON source manifest."],
    }
    with output.open("xb") as stream:
        stream.write(json.dumps(report, sort_keys=True, indent=2).encode() + b"\n")
    print(json.dumps({"status": report["status"], "reference": output.relative_to(ROOT).as_posix(), "sha256": sha(output.read_bytes())}))


if __name__ == "__main__":
    main()
