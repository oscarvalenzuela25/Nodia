"""Bounded upload metadata via the frozen UI observer; no raw logs or secrets."""
from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import sys

BASE_SHA = "baa090cf977de918bec1d53026a192bee9a48bd810e1ae3e80f25a3cd5ada589"
BASE_NAME = "nodia-ai-ai38-ui-adoption-observer.py"
SCHEMA = "ai38-attachment-nginx-observer-v1"


def load_base():
    source = Path(__file__).with_name(BASE_NAME)
    if hashlib.sha256(source.read_bytes()).hexdigest() != BASE_SHA:
        raise ValueError("frozen_base_mismatch")
    spec = importlib.util.spec_from_file_location("ai38_frozen_ui_metadata", source)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    module.SCHEMA = SCHEMA
    return module


def configure(base, ids):
    original = base.label

    def label(uri, chat):
        path = uri.split(b"?", 1)[0]
        if path == b"/api/v1/nodia-ai/attachments":
            return "attachment_reservation"
        for identity in ids:
            prefix = ("/api/v1/nodia-ai/attachments/" + identity).encode("ascii")
            if path == prefix:
                return "owned_attachment_metadata_or_discard"
            if path == prefix + b"/content":
                return "owned_attachment_content"
            if path == prefix + b"/interpretation":
                return "owned_attachment_interpretation"
        return original(uri, chat)

    base.label = label


def self_test(base):
    known = "00000000-0000-4000-8000-000000000001"
    configure(base, [known])
    data = (b'127.0.0.1 - - [20/Oct/2026:22:00:00 +0000] "POST /api/v1/nodia-ai/attachments?secret=x HTTP/1.1" 201 20 "x" "x"\n'
            + f'127.0.0.1 - - [20/Oct/2026:22:00:01 +0000] "PUT /api/v1/nodia-ai/attachments/{known}/content HTTP/1.1" 200 20 "x" "x"\n'.encode()
            + f'127.0.0.1 - - [20/Oct/2026:22:00:02 +0000] "DELETE /api/v1/nodia-ai/attachments/{known} HTTP/1.1" 200 20 "x" "x"\n'.encode()
            + b'127.0.0.1 - - [20/Oct/2026:22:00:03 +0000] "PUT /api/v1/nodia-ai/attachments/00000000-0000-4000-8000-000000000002/content HTTP/1.1" 200 20 "x" "x"\n')
    result = base.project(data, known)
    assert result["matched_lines"] == 3 and result["ignored_lines"] == 1
    assert "secret" not in json.dumps(result) and "00000000" not in json.dumps(result)
    assert {row["method"] for row in result["counts"]} == {"POST", "PUT", "DELETE"}
    return {"schema": SCHEMA, "status": "passed_offline_metadata_checks", "provider_requests": 0, "network_requests": 0}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=["begin", "end", "self-test"])
    parser.add_argument("--cursor")
    parser.add_argument("--log", default="/var/log/nginx/access.log")
    parser.add_argument("--conversation-id")
    parser.add_argument("--attachment-id", action="append", default=[])
    args = parser.parse_args()
    base = load_base()
    if args.action == "self-test":
        result = self_test(base)
    else:
        if not args.cursor or len(args.attachment_id) > 4 or any(not base.UUID.fullmatch(item) for item in args.attachment_id):
            raise ValueError("invalid_scope")
        if args.action == "begin" and not base.UUID.fullmatch(args.conversation_id or ""):
            raise ValueError("known_chat_required")
        configure(base, args.attachment_id)
        result = base.begin(args) if args.action == "begin" else base.end(args)
        result["frozen_base_sha256"] = BASE_SHA
        result["source_sha256"] = hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
        result["known_attachment_ids"] = sorted(args.attachment_id)
        result["body_or_query_or_tokens_read"] = False
        result["limits"] = result.get("limits", []) + ["reserve_POST_cannot_be_attributed_to_chat_from_combined_log_without_exclusive_UI_window"]
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    try:
        main()
    except Exception:
        print(json.dumps({"schema": SCHEMA, "status": "failed_observation", "raw_log_or_credentials_emitted": False}))
        sys.exit(1)
