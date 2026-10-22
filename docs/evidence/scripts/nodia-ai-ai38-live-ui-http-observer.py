"""Bounded nginx combined-log metadata observer. Never emits request/log content.

Run start immediately before the UI window, end after it. Neither command calls
HTTP, imports Nodia, reads credentials, changes services or invokes a provider.
Only start creates its explicitly named private cursor outside /tmp.
Optional end identifiers must be independently linked to the chat by SQL/UI;
nginx metadata alone does not prove that relationship. Rotation/truncation is a
failed observation rather than guessed continuity. Default nginx combined only.
"""

import argparse
from collections import Counter
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import sys


SCHEMA = "ai38-live-ui-http-observer-v1"
MAX_WINDOW_BYTES = 64 * 1024 * 1024  # Observer memory cap, not product policy.
UUID = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")
# Nginx combined: discard address/user, extract only timestamp, method, URI and
# status, and never serialize the URI. Escaped quotes do not become delimiters.
LINE = re.compile(rb'^\S+ \S+ \S+ \[([^\]\r\n]+)\] "((?:[^"\\\r\n]|\\.)*)" ([0-9]{3}) (?:[0-9]+|-)(?: |$)')
REQUEST = re.compile(rb"^([A-Z]+) ([^ ]+) HTTP/[0-9.]+$")
STATIC_PATHS = {
    "/api/v1/auth/me": "auth_me",
    "/api/v1/auth/refresh": "auth_refresh",
    "/api/v1/auth/login": "auth_login",
    "/api/v1/authorization/context": "authorization_context",
    "/api/v1/nodia-ai/conversations": "conversation_list",
    "/api/v1/nodia-ai/connections": "connection_catalog",
    "/api/v1/nodia-ai/preferences": "preference_list",
    "/api/v1/nodia-ai/preferences/catalog": "preference_catalog",
    "/api/v1/nodia-ai/attachments/capabilities": "attachment_capabilities",
}


def source_sha():
    return hashlib.sha256(Path(__file__).read_bytes()).hexdigest()


def utc():
    return datetime.now(timezone.utc).isoformat()


def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()


def label(uri, conversation_id, proposal_id=None, execution_id=None, movement_id=None):
    # Discard query bytes before decoding; no unquoting or URL-driven requests.
    raw_path = uri.split(b"?", 1)[0]
    try:
        pathname = raw_path.decode("ascii")
    except UnicodeDecodeError:
        return None
    if pathname in STATIC_PATHS:
        return STATIC_PATHS[pathname]
    base = "/api/v1/nodia-ai/conversations/" + conversation_id
    if pathname == base:
        return "acceptance_conversation_detail"
    if pathname == base + "/messages":
        return "acceptance_conversation_messages"
    for suffix, name in {"/selection": "acceptance_selection", "/routing": "acceptance_routing", "/events": "acceptance_events"}.items():
        if pathname == base + suffix:
            return name
    if proposal_id:
        proposal = "/api/v1/nodia-ai/proposals/" + proposal_id
        for suffix, name in {"": "acceptance_proposal", "/review-metadata": "acceptance_review_metadata", "/confirmation-challenge": "acceptance_confirmation_challenge", "/confirm": "acceptance_confirmation", "/cancel": "acceptance_proposal_cancel"}.items():
            if pathname == proposal + suffix:
                return name
    if execution_id and pathname == "/api/v1/nodia-ai/operations/" + execution_id:
        return "acceptance_execution"
    if movement_id and pathname == "/api/v1/finance/movements/" + movement_id:
        return "acceptance_finance_movement"
    if re.fullmatch(r"/api/v1/nodia-ai/connections/[0-9]+/eligibility", pathname):
        return "connection_eligibility"
    return None


def project(data, conversation_id, proposal_id=None, execution_id=None, movement_id=None):
    totals = Counter()
    matched = 0
    invalid = 0
    ignored = 0
    first = None
    last = None
    for line in data.splitlines():
        match = LINE.match(line)
        request = REQUEST.fullmatch(match[2]) if match else None
        if not request:
            invalid += 1
            continue
        name = label(request[2], conversation_id, proposal_id, execution_id, movement_id)
        if name is None:
            ignored += 1
            continue
        method = request[1].decode("ascii")
        status = match[3].decode("ascii")
        # Known labels and verbs/status are safe; no unknown token is returned.
        if method not in {"GET", "POST", "PATCH", "PUT", "DELETE", "HEAD", "OPTIONS"}:
            ignored += 1
            continue
        stamp = datetime.strptime(match[1].decode("ascii"), "%d/%b/%Y:%H:%M:%S %z").astimezone(timezone.utc).isoformat()
        first = stamp if first is None else min(first, stamp)
        last = stamp if last is None else max(last, stamp)
        totals[(name, method, status)] += 1
        matched += 1
    counts = [{"endpoint": key[0], "method": key[1], "status": int(key[2]), "count": count}
              for key, count in sorted(totals.items())]
    return {"matched_lines": matched, "ignored_lines": ignored, "unparseable_lines": invalid,
            "first_matched_request_utc": first, "last_matched_request_utc": last, "counts": counts}


def open_log(filename):
    # Refuse symlinks and nonregular streams; never follow a rotated-path guess.
    descriptor = os.open(filename, os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0))
    handle = os.fdopen(descriptor, "rb")
    info = os.fstat(handle.fileno())
    if not stat.S_ISREG(info.st_mode):
        handle.close()
        raise ValueError("log_not_regular")
    return handle, info


def boundary(handle, size):
    if size:
        handle.seek(size - 1)
        if handle.read(1) != b"\n":
            raise ValueError("partial_log_line_at_window_boundary")


def anchor(handle, offset):
    start = max(0, offset - 4096)
    handle.seek(start)
    data = handle.read(offset - start)
    if len(data) != offset - start:
        raise ValueError("log_truncated_during_read")
    return {"start": start, "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}


def begin(args):
    cursor = Path(args.cursor)
    if str(cursor).startswith("/tmp/"):
        raise ValueError("private_ledger_must_not_use_tmp")
    if not cursor.is_absolute() or cursor.name in {"", ".", ".."}:
        raise ValueError("cursor_requires_absolute_path")
    parent = cursor.parent
    if not parent.exists():
        parent.mkdir(mode=0o700)  # Only this explicit leaf; parent must exist.
    info = parent.lstat()
    if not stat.S_ISDIR(info.st_mode) or info.st_uid != os.geteuid() or stat.S_IMODE(info.st_mode) != 0o700:
        raise ValueError("cursor_directory_must_be_owned_private_0700")
    with open_log(args.log)[0] as handle:
        info = os.fstat(handle.fileno())
        boundary(handle, info.st_size)
        prefix = anchor(handle, info.st_size)
    record = {"schema": SCHEMA, "source_sha256": source_sha(), "began_at_utc": utc(), "log_path": str(Path(args.log).resolve()),
              "device": info.st_dev, "inode": info.st_ino, "offset": info.st_size,
              "conversation_id": args.conversation_id, "anchor": prefix}
    descriptor = os.open(cursor, os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, "O_NOFOLLOW", 0), 0o600)
    with os.fdopen(descriptor, "w") as output:
        json.dump(record, output)
        output.flush()
        os.fsync(output.fileno())
    directory = os.open(parent, os.O_RDONLY | getattr(os, "O_DIRECTORY", 0))
    try:
        os.fsync(directory)
    finally:
        os.close(directory)
    return {"schema": SCHEMA, "action": "start", "status": "cursor_created_no_UI_acceptance",
            "source_sha256": source_sha(), "began_at_utc": record["began_at_utc"], "device": record["device"], "inode": record["inode"],
            "offset": record["offset"], "acceptance_conversation_sha256": digest(args.conversation_id),
            "start_anchor_bytes": prefix["bytes"],
            "cursor_sha256": hashlib.sha256(cursor.read_bytes()).hexdigest(), "raw_log_saved": False}


def end(args):
    cursor = Path(args.cursor)
    info = cursor.lstat()
    if not stat.S_ISREG(info.st_mode) or info.st_uid != os.geteuid() or stat.S_IMODE(info.st_mode) != 0o600:
        raise ValueError("cursor_must_be_owned_private_0600")
    if info.st_size > 16384 or info.st_nlink != 1:
        raise ValueError("invalid_cursor")
    raw_cursor = cursor.read_bytes()
    record = json.loads(raw_cursor)
    if record["schema"] != SCHEMA or record.get("source_sha256") != source_sha() or not UUID.fullmatch(record["conversation_id"]):
        raise ValueError("invalid_cursor")
    with open_log(record["log_path"])[0] as handle:
        before = os.fstat(handle.fileno())
        if (before.st_dev, before.st_ino) != (record["device"], record["inode"]):
            raise ValueError("log_rotated_identity_changed")
        if before.st_size < record["offset"]:
            raise ValueError("log_truncated")
        if anchor(handle, record["offset"]) != record["anchor"]:
            raise ValueError("log_prefix_changed_possible_copytruncate")
        if before.st_size - record["offset"] > MAX_WINDOW_BYTES:
            raise ValueError("observer_window_too_large")
        boundary(handle, before.st_size)
        handle.seek(record["offset"])
        data = handle.read(before.st_size - record["offset"])
        after = os.fstat(handle.fileno())
        path_info = os.stat(record["log_path"], follow_symlinks=False)
        if len(data) != before.st_size - record["offset"] or after.st_size < before.st_size:
            raise ValueError("log_truncated_during_read")
        if (path_info.st_dev, path_info.st_ino) != (before.st_dev, before.st_ino):
            raise ValueError("log_rotated_during_read")
        if anchor(handle, record["offset"]) != record["anchor"]:
            raise ValueError("log_prefix_changed_possible_copytruncate")
    return {"schema": SCHEMA, "action": "end", "status": "bounded_metadata_observed_not_Google_or_UI_acceptance",
            "source_sha256": source_sha(), "began_at_utc": record["began_at_utc"], "finished_at_utc": utc(),
            "device": before.st_dev, "inode": before.st_ino, "offset_begin": record["offset"],
            "offset_end": before.st_size, "bounded_bytes": len(data), "subsequent_bytes_excluded": after.st_size - before.st_size,
            "acceptance_conversation_sha256": digest(record["conversation_id"]),
            "cursor_sha256": hashlib.sha256(raw_cursor).hexdigest(), **project(data, record["conversation_id"], args.proposal_id, args.execution_id, args.movement_id),
            "acceptance_proposal_sha256": digest(args.proposal_id) if args.proposal_id else None,
            "acceptance_execution_sha256": digest(args.execution_id) if args.execution_id else None,
            "acceptance_movement_sha256": digest(args.movement_id) if args.movement_id else None,
            "start_anchor_verified": True, "start_anchor_bytes": record["anchor"]["bytes"],
            "copytruncate_regrowth_with_identical_anchor_not_excluded": True,
            "raw_log_saved": False, "credentials_emitted": False, "provider_requests": 0,
            "limits": ["nginx_status_is_not_provider_or_business_acceptance", "refresh_or_login_may_write_legitimate_session_state",
                       "requests_are_not_attributed_to_a_unique_browser_without_a_separate_exclusive_UI_window",
                       "no_query_body_referer_user_agent_or_identity_is_preserved", "no_service_changes_or_rotated_log_search", "proposal_execution_relationship_to_chat_requires_separate_SQL_or_UI_evidence", "no_HTTP_body_or_confirmation_nonce_is_read_or_stored"]}


def self_test():
    known = "00000000-0000-4000-8000-000000000001"
    synthetic = (b'127.0.0.1 - - [20/Oct/2026:22:00:00 +0000] "GET /api/v1/auth/me?secret=synthetic HTTP/1.1" 200 2 "synthetic" "synthetic"\n'
                 b'127.0.0.1 - - [20/Oct/2026:22:00:01 +0000] "POST /api/v1/auth/login HTTP/1.1" 403 2 "-" "-"\n'
                 b'127.0.0.1 - - [20/Oct/2026:22:00:02 +0000] "GET /personal HTTP/1.1" 200 2 "-" "-"\n')
    result = project(synthetic, known)
    assert result["matched_lines"] == 2 and result["ignored_lines"] == 1
    assert "secret" not in json.dumps(result) and "synthetic" not in json.dumps(result)
    assert label(("/api/v1/nodia-ai/conversations/" + known + "/messages?cursor=private").encode(), known) == "acceptance_conversation_messages"
    assert label(b"/api/v1/nodia-ai/conversations/00000000-0000-4000-8000-000000000002", known) is None
    assert label(b"/api/v1/nodia-ai/connections/2/eligibility?model_id=private", known) == "connection_eligibility"
    proposal = "00000000-0000-4000-8000-000000000003"
    execution = "00000000-0000-4000-8000-000000000004"
    assert label(("/api/v1/nodia-ai/proposals/" + proposal + "/confirm?token=private").encode(), known, proposal) == "acceptance_confirmation"
    assert label(("/api/v1/nodia-ai/proposals/" + proposal + "/confirmation-challenge").encode(), known, proposal) == "acceptance_confirmation_challenge"
    assert label(("/api/v1/nodia-ai/proposals/" + known + "/confirm").encode(), known, proposal) is None
    assert label(("/api/v1/nodia-ai/operations/" + execution).encode(), known, proposal, execution) == "acceptance_execution"
    assert label(b"/api/v1/finance/movements/123", known, proposal, execution, "123") == "acceptance_finance_movement"
    assert label(b"/api/v1/finance/movements/124", known, proposal, execution, "123") is None
    confirm_line = ('127.0.0.1 - - [20/Oct/2026:22:00:03 +0000] "POST /api/v1/nodia-ai/proposals/' + proposal + '/confirm?secret=NEVER_OUTPUT HTTP/1.1" 202 2 "PRIVATE_REFERER" "PRIVATE_AGENT"\n').encode()
    projected = project(confirm_line, known, proposal)
    assert projected["counts"] == [{"endpoint": "acceptance_confirmation", "method": "POST", "status": 202, "count": 1}]
    assert all(value not in json.dumps(projected) for value in [proposal, "NEVER_OUTPUT", "PRIVATE_REFERER", "PRIVATE_AGENT"])
    return {"schema": SCHEMA, "source_sha256": source_sha(), "status": "passed_offline_parser_checks_only", "network_requests": 0, "provider_requests": 0}



if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=["start", "end", "self-test"])
    parser.add_argument("--cursor")
    parser.add_argument("--log", default="/var/log/nginx/access.log")
    parser.add_argument("--conversation-id")
    parser.add_argument("--proposal-id", help="Explicit known proposal; metadata cannot establish its chat ownership")
    parser.add_argument("--execution-id")
    parser.add_argument("--movement-id")
    args = parser.parse_args()
    try:
        if args.action in {"start", "end"} and not args.cursor:
            raise ValueError("cursor_required")
        if args.action == "start" and not UUID.fullmatch(args.conversation_id or ""):
            raise ValueError("known_acceptance_conversation_UUID_required")
        for value in (args.proposal_id, args.execution_id):
            if value is not None and not UUID.fullmatch(value):
                raise ValueError("explicit_resource_identifier_invalid")
        if args.movement_id is not None and not re.fullmatch(r"[1-9][0-9]{0,18}", args.movement_id):
            raise ValueError("explicit_resource_identifier_invalid")
        result = self_test() if args.action == "self-test" else begin(args) if args.action == "start" else end(args)
        print(json.dumps(result, indent=2))
    except (OSError, ValueError, KeyError, TypeError, OverflowError):
        print(json.dumps({"schema": SCHEMA, "status": "failed_observation", "source_sha256": source_sha(),
                          "raw_log_or_credentials_emitted": False}))
        sys.exit(1)
