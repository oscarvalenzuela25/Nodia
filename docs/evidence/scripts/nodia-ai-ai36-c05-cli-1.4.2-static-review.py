"""Read public pinned ELF as data only. Never imports the app or executes the CLI."""
from datetime import datetime, timezone
import hashlib
import json
import mmap
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
PIN = ROOT / "docs/evidence/nodia-ai-ai36-c05-cli-1.4.2-package-pin.json"
OUTPUT = ROOT / "docs/evidence/nodia-ai-ai36-c05-cli-1.4.2-static-review.json"


def digest(path, algorithm="sha256"):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, algorithm).hexdigest()


def main():
    assert not OUTPUT.exists(), "Preserve historical research artifacts."
    pin = json.loads(PIN.read_text(encoding="utf-8"))
    binary = ROOT / pin["binary_path_relative"]
    assert binary.stat().st_size == pin["binary_bytes"]
    assert digest(binary, "sha512") == pin["binary_sha512"]
    flags = ["--input-format", "--output-format", "--json-schema", "--disable-slash-commands",
        "--sandbox", "--print-timeout", "--log-file", "--agent", "--model", "--effort"]
    tags = ['yaml:"mainAgent,omitempty"', 'yaml:"subagent,omitempty"', 'yaml:"inheritMcp,omitempty"',
        'yaml:"tools,omitempty"', 'yaml:"hooks,omitempty"', 'yaml:"commandExecutionPolicy,omitempty"',
        'yaml:"excludeDefaultComponents,omitempty"', 'yaml:"inheritCustomizations,omitempty"']
    with binary.open("rb") as stream, mmap.mmap(stream.fileno(), 0, access=mmap.ACCESS_READ) as data:
        flag_inventory = [{"literal": value, "first_offset": data.find(value.encode())} for value in flags]
        tag_inventory = [{"literal": value, "first_offset": data.find(value.encode())} for value in tags]
        sections = []
        for version in ("1.4.2", "1.4.1", "1.4.0", "1.3.6", "1.3.5", "1.3.4", "1.3.3", "1.3.2", "1.3.1"):
            marker = ("## " + version).encode()
            start = data.find(marker)
            end = data.find(b"\n## ", start + len(marker)) if start >= 0 else -1
            section = data[start:end] if 0 <= start < end and end - start <= 65536 else None
            sections.append({"version": version, "heading_offset": start if start >= 0 else None,
                "section_bytes": len(section) if section is not None else None,
                "section_sha256": hashlib.sha256(section).hexdigest() if section is not None else None})
        type_literal = b'Arguments encoding/json/jsontext.Value "jsonschema:'
        type_offset = data.find(type_literal)
        assert type_offset >= 0
        # The nearby public linker symbol identifies this generic type; no runtime values are read.
        converter_offset = data.find(b"(*CallMcpToolConverter).ToolCallToCortexStep", type_offset)
        assert 0 < converter_offset - type_offset < 1024
    result = {"schema_version": 1, "scope": "public_pinned_ELF_static_data_only_no_execution",
        "observed_at_utc": datetime.now(timezone.utc).isoformat(),
        "pin_path": PIN.relative_to(ROOT).as_posix(), "pin_sha256": digest(PIN),
        "manifest_version": pin["manifest"]["version"], "binary_sha512": pin["binary_sha512"],
        "source_script_sha256": digest(Path(__file__)),
        "flags_literal_inventory": flag_inventory, "agent_yaml_tag_inventory": tag_inventory,
        "static_scope_limit": "Presence of flags/tags/types does not establish accepted syntax, effective permissions, wire representation, schema compatibility or inference availability.",
        "embedded_release_sections": sections,
        "release_heading_limit": "No ## 1.4.2 heading found; latest embedded heading is 1.4.1. The HTTPS manifest advertises 1.4.2. Actual --version is a separate offline control.",
        "dispatcher_type_clue": {"arguments_type_literal": "Arguments encoding/json/jsontext.Value",
            "type_offset": type_offset, "converter_symbol_offset": converter_offset,
            "interpretation": "Public Go type metadata near CallMcpToolConverter. Actual hook/MCP JSON representation remains unverified, so no wire conversion is inferred."},
        "release_findings_paraphrased": [
            {"version": "1.3.3", "finding": "Introduces antigravity/alwaysLoad tool metadata for direct availability. Current Nodia tools do not add that vendor extension; do not change publication as part of this candidate."},
            {"version": "1.3.4", "finding": "Caps waits between internal retries at 30s instead of up to four minutes; unknown headless agents now fail; base models without effort obtain defaults. Keep explicit exact model/effort and unknown-agent rejection."},
            {"version": "1.3.6", "finding": "Stalled model requests retry after five minutes without data; this threshold exceeds the unchanged Nodia 120s deadline. Markdown description parsing and headless subagent questions also change."},
            {"version": "1.4.1", "finding": "Adds automatic retries for socket disconnects, marks exited MCP servers as errors and removes closed sessions, and corrects structured tool output token accounting. Plugin frontmatter validation is expanded."}
        ],
        "official_references": ["https://www.antigravity.google/docs/changelog/",
            "https://www.antigravity.google/docs/cli/headless/", "https://www.antigravity.google/docs/cli/reference/"],
        "runtime_retry_disable_flag_verified": False,
        "causal_limit": "No observed 119s failure is attributed to retries. Nodia/harness resend count zero does not count unknown internal vendor requests. A candidate success alone cannot establish causality.",
        "candidate_gates": [
            "Exact SHA512 and isolated Linux --version/help before any profile use.",
            "Explicit versioned transport gates; preserve 1.3.1 historical default, exact hash/version checks, High selection, deadlines, hooks and budgets.",
            "Candidate attachments and OCR remain fail-closed; old attachment proofs cannot certify a new CLI.",
            "One owner, new process/session and fresh frozen MCP canary; validate init.agent/model, actual tool wire, completed process-closed proof and exact ACK.",
            "No concurrent profile copies; persistent profile/cache migration and image rollback compatibility are unknown and require controlled preservation under the sole operator."
        ],
        "actions": {"binary_executions": 0, "network_requests": 0, "VM_operations": 0,
            "profile_access": 0, "configuration_changes": 0}}
    OUTPUT.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"output": OUTPUT.relative_to(ROOT).as_posix(), "sha256": digest(OUTPUT),
        "flags_found": sum(item["first_offset"] >= 0 for item in flag_inventory),
        "agent_yaml_tags_found": sum(item["first_offset"] >= 0 for item in tag_inventory)}))


if __name__ == "__main__":
    main()
