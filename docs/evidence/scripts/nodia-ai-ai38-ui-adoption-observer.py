"""Bounded nginx combined-log metadata observer. Never emits request/log content.

Run begin immediately before the UI window, end after it. Neither command calls
HTTP, imports Nodia, reads credentials, changes services or invokes a provider.
Only begin creates its explicitly named private cursor. Rotation/truncation is a
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
import subprocess
import sys


SCHEMA = "ai38-ui-nginx-observer-v1"
MAX_WINDOW_BYTES = 64 * 1024 * 1024  # Observer memory cap, not product policy.
CLIENT_ID_SHA256 = "92d734acd9f93db3084a903aebff28adaf5f83d9dca318c7ddf19ed7a4ab7e3a"
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


def utc():
    return datetime.now(timezone.utc).isoformat()


def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()


def label(uri, conversation_id):
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
    if re.fullmatch(r"/api/v1/nodia-ai/connections/[0-9]+/eligibility", pathname):
        return "connection_eligibility"
    return None


def project(data, conversation_id):
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
        name = label(request[2], conversation_id)
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
    record = {"schema": SCHEMA, "began_at_utc": utc(), "log_path": str(Path(args.log).resolve()),
              "device": info.st_dev, "inode": info.st_ino, "offset": info.st_size,
              "conversation_id": args.conversation_id, "anchor": prefix}
    descriptor = os.open(cursor, os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, "O_NOFOLLOW", 0), 0o600)
    with os.fdopen(descriptor, "w") as output:
        json.dump(record, output)
        output.flush()
        os.fsync(output.fileno())
    return {"schema": SCHEMA, "action": "begin", "status": "cursor_created_no_UI_acceptance",
            "began_at_utc": record["began_at_utc"], "device": record["device"], "inode": record["inode"],
            "offset": record["offset"], "acceptance_conversation_sha256": digest(args.conversation_id),
            "start_anchor_bytes": prefix["bytes"],
            "cursor_sha256": hashlib.sha256(cursor.read_bytes()).hexdigest(), "raw_log_saved": False}


def end(args):
    cursor = Path(args.cursor)
    info = cursor.lstat()
    if not stat.S_ISREG(info.st_mode) or info.st_uid != os.geteuid() or stat.S_IMODE(info.st_mode) != 0o600:
        raise ValueError("cursor_must_be_owned_private_0600")
    raw_cursor = cursor.read_bytes()
    record = json.loads(raw_cursor)
    if record["schema"] != SCHEMA or not UUID.fullmatch(record["conversation_id"]):
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
            "began_at_utc": record["began_at_utc"], "finished_at_utc": utc(),
            "device": before.st_dev, "inode": before.st_ino, "offset_begin": record["offset"],
            "offset_end": before.st_size, "bounded_bytes": len(data), "subsequent_bytes_excluded": after.st_size - before.st_size,
            "acceptance_conversation_sha256": digest(record["conversation_id"]),
            "cursor_sha256": hashlib.sha256(raw_cursor).hexdigest(), **project(data, record["conversation_id"]),
            "start_anchor_verified": True, "start_anchor_bytes": record["anchor"]["bytes"],
            "copytruncate_regrowth_with_identical_anchor_not_excluded": True,
            "raw_log_saved": False, "credentials_emitted": False, "provider_requests": 0,
            "limits": ["nginx_status_is_not_provider_or_business_acceptance", "refresh_or_login_may_write_legitimate_session_state",
                       "requests_are_not_attributed_to_a_unique_browser_without_a_separate_exclusive_UI_window",
                       "no_query_body_referer_user_agent_or_identity_is_preserved", "no_service_changes_or_rotated_log_search"]}


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
    return {"status": "passed_offline_parser_checks_only", "network_requests": 0, "provider_requests": 0}


def preflight_auth():
    """Compare public Client identity without printing private configuration.

    /proc holds launch environment. Dotenv is parsed using the installed parser,
    with normal no-override precedence, without loading application modules. A
    current .env reconstruction is expressly not an in-memory runtime reading.
    """
    def main_pid():
        value = subprocess.run(["systemctl", "show", "nodia-api", "--property=MainPID", "--value"],
                               capture_output=True, check=True, text=True).stdout.strip()
        if not value.isdigit() or int(value) < 2:
            raise ValueError("API_process_not_running")
        return int(value)

    pid = main_pid()
    proc = Path("/proc") / str(pid)
    cwd = Path(os.readlink(proc / "cwd"))
    executable = os.readlink(proc / "exe")
    config_file = cwd / "dist/auth/auth.config.js"
    config_bytes = config_file.read_bytes()
    config_text = config_bytes.decode()
    if "environment.GOOGLE_CLIENT_ID" not in config_text or "environment.GOOGLE_CLIENT_IDS" in config_text:
        raise ValueError("unreviewed_auth_configuration_contract")
    launch = {}
    for entry in (proc / "environ").read_bytes().split(b"\0"):
        key, separator, value = entry.partition(b"=")
        if separator:
            name = key.decode("ascii", errors="ignore")
            if name in {"GOOGLE_CLIENT_ID", "NODE_ENV", "AUTH_ALLOWED_ORIGINS", "AUTH_COOKIE_SECURE",
                        "DOTENV_CONFIG_PATH", "DOTENV_CONFIG_OVERRIDE", "DOTENV_CONFIG_ENCODING", "DOTENV_KEY"}:
                launch[name] = value.decode()
    # Do not guess encrypted/custom dotenv loading or override semantics.
    if any(launch.get(key) for key in {"DOTENV_CONFIG_PATH", "DOTENV_CONFIG_OVERRIDE", "DOTENV_CONFIG_ENCODING", "DOTENV_KEY"}):
        raise ValueError("unreviewed_dotenv_configuration")
    javascript = r'''
const fs=require('fs'),crypto=require('crypto'),dotenv=require('dotenv');
const launch=JSON.parse(fs.readFileSync(0,'utf8'));
const filename='.env';
const parsed=fs.existsSync(filename)?dotenv.parse(fs.readFileSync(filename)):{};
const keys=['GOOGLE_CLIENT_ID','NODE_ENV','AUTH_ALLOWED_ORIGINS','AUTH_COOKIE_SECURE'];
const selected={};const sources={};
for(const key of keys){if(Object.hasOwn(launch,key)){selected[key]=launch[key];sources[key]='process_launch';}
else if(Object.hasOwn(parsed,key)){selected[key]=parsed[key];sources[key]='current_dotenv_file';}
else sources[key]='absent';}
const production=selected.NODE_ENV==='production';
const origins=(selected.AUTH_ALLOWED_ORIGINS??(production?'':'http://localhost:5174')).split(',').map(s=>s.trim()).filter(Boolean);
const valid=origins.length>0&&origins.every(origin=>{try{const u=new URL(origin);return u.origin===origin&&['http:','https:'].includes(u.protocol)&&(!production||u.protocol==='https:');}catch{return false;}});
const id=selected.GOOGLE_CLIENT_ID;
process.stdout.write(JSON.stringify({node_env:['production','development','test'].includes(selected.NODE_ENV)?selected.NODE_ENV: selected.NODE_ENV===undefined?'unset':'other',
google_client_id_present:typeof id==='string'&&id.length>0,
google_client_id_matches_frozen_Client:typeof id==='string'&&crypto.createHash('sha256').update(id).digest('hex')===process.argv[1],
localhost_5174_allowed:origins.includes('http://localhost:5174'),
HTTPS_required:production,refresh_cookie_Secure:production||selected.AUTH_COOKIE_SECURE==='true',
allowed_origin_configuration_valid:valid,configuration_sources:sources,
configuration_scope:Object.values(sources).includes('current_dotenv_file')?'launch_environment_plus_current_dotenv_file_reconstruction':'launch_environment_and_code_defaults'}));
'''
    completed = subprocess.run([executable, "--input-type=commonjs", "-e", javascript, CLIENT_ID_SHA256],
                               cwd=cwd, input=json.dumps(launch), capture_output=True, text=True,
                               env={"PATH": "/usr/bin:/bin"}, timeout=15)
    if completed.returncode:
        raise ValueError("safe_auth_projection_failed")
    result = json.loads(completed.stdout)
    if main_pid() != pid or os.readlink(proc / "cwd") != str(cwd):
        raise ValueError("API_process_changed_during_observation")
    return {"schema": SCHEMA, "action": "preflight-auth", "status": "configuration_observed_not_login_acceptance",
            "observed_at_utc": utc(), "API_pid": pid, "auth_config_sha256": hashlib.sha256(config_bytes).hexdigest(),
            "auth_client_setting": "GOOGLE_CLIENT_ID", **result,
            "Google_console_authorized_origin_verified": False, "runtime_memory_configuration_read": False,
            "browser_storage_or_session_read": False, "private_values_emitted": False,
            "network_requests": 0, "provider_requests": 0, "data_writes": 0}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=["begin", "end", "self-test", "preflight-auth"])
    parser.add_argument("--cursor")
    parser.add_argument("--log", default="/var/log/nginx/access.log")
    parser.add_argument("--conversation-id")
    args = parser.parse_args()
    try:
        if args.action in {"begin", "end"} and not args.cursor:
            raise ValueError("cursor_required")
        if args.action == "begin" and not UUID.fullmatch(args.conversation_id or ""):
            raise ValueError("known_acceptance_conversation_UUID_required")
        result = self_test() if args.action == "self-test" else preflight_auth() if args.action == "preflight-auth" else begin(args) if args.action == "begin" else end(args)
        print(json.dumps(result, indent=2))
    except (OSError, ValueError, KeyError, TypeError, subprocess.SubprocessError) as error:
        # Deliberately omit exception strings: OS/parser errors may contain paths
        # or log-derived values. A small closed category is sufficient to fail.
        closed_errors = {"log_not_regular", "partial_log_line_at_window_boundary", "cursor_requires_absolute_path",
                         "cursor_directory_must_be_owned_private_0700", "cursor_must_be_owned_private_0600", "invalid_cursor",
                         "log_rotated_identity_changed", "log_truncated", "observer_window_too_large", "log_truncated_during_read",
                         "log_rotated_during_read", "log_prefix_changed_possible_copytruncate", "cursor_required",
                         "known_acceptance_conversation_UUID_required", "API_process_not_running", "unreviewed_auth_configuration_contract",
                         "unreviewed_dotenv_configuration", "safe_auth_projection_failed", "API_process_changed_during_observation"}
        safe_reason = str(error) if isinstance(error, ValueError) and str(error) in closed_errors else "invalid_or_unavailable_metadata"
        print(json.dumps({"schema": SCHEMA, "status": "failed_observation", "error_type": type(error).__name__, "reason": safe_reason,
                          "raw_log_or_credentials_emitted": False}))
        sys.exit(1)
