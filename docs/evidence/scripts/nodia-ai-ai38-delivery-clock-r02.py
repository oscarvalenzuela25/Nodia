"""Read-only clock diagnosis and authorized private preservation of closed canary logs.

No clock/service/network configuration changes and no provider requests. Public
output contains selected clock fields and hashes/counts, never raw service logs.
"""
from datetime import datetime, timezone
from pathlib import Path
import hashlib
import json
import os
import subprocess

os.umask(0o077)


def command(argv):
    result = subprocess.run(argv, capture_output=True, check=False, timeout=30)
    return result.returncode, result.stdout, result.stderr


def keyvalues(argv):
    code, out, _ = command(argv)
    return code, dict(line.split("=", 1) for line in out.decode(errors="replace").splitlines() if "=" in line)


clock_code, clock = keyvalues(["timedatectl", "show", "--all"])
sync_code, sync = keyvalues(["timedatectl", "show-timesync", "--all"])
clock_allow = ("Timezone", "LocalRTC", "CanNTP", "NTP", "NTPSynchronized", "TimeUSec", "RTCTimeUSec")
sync_allow = ("ServerName", "ServerAddress", "RootDistanceMaxUSec", "PollIntervalMinUSec", "PollIntervalMaxUSec", "PollIntervalUSec", "Frequency", "PacketCount", "Leap", "Version", "Stratum", "Precision", "RootDelay", "RootDispersion", "Reference", "Origin", "Recv", "Transmit", "Dest", "Ignored", "NTPMessage")
services = {}
for name in ("systemd-timesyncd", "chrony", "chronyd", "hv-kvp-daemon", "hv-vss-daemon"):
    code, out, _ = command(["systemctl", "show", name, "--no-pager", "--property=LoadState,ActiveState,SubState,UnitFileState"])
    services[name] = {"exit_code": code, "fields": dict(line.split("=", 1) for line in out.decode().splitlines() if "=" in line)}
journal_code, journal, _ = command(["journalctl", "-u", "systemd-timesyncd", "-n", "80", "--no-pager", "-o", "cat"])
categories = {
    "network_configuration_changed": journal.count(b"Network configuration changed"),
    "timeout_waiting_reply": journal.lower().count(b"timed out waiting for reply"),
    "initial_synchronization": journal.lower().count(b"initial synchronization"),
    "synchronized_to_time_server": journal.lower().count(b"synchronized to time server"),
}
marker = Path("/run/systemd/timesync/synchronized")
root = Path("/opt/nodia/verification/ai38-mcp-canary-r01")
assert root.is_dir() and not root.is_symlink(), "authorized canary directory required"
assert root.stat().st_uid == 0, "private root ownership required"
assert (root.stat().st_mode & 0o077) == 0, "private canary directory required"
private_log = root / "private-docker-window-ai38-delivery-r01.log"
created = not private_log.exists()
if created:
    code, logs, errors = command(["docker", "logs", "--timestamps", "--since", "2026-10-20T16:51:40Z", "--until", "2026-10-20T16:54:10Z", "nodia-gemini-microservice"])
    assert code == 0, "docker log preservation failed"
    raw = logs + errors
    descriptor = os.open(private_log, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, "wb") as target:
        target.write(raw)
else:
    assert not private_log.is_symlink() and private_log.stat().st_uid == 0
    raw = private_log.read_bytes()
assert (private_log.stat().st_mode & 0o777) == 0o600
tokens = ("mcp_result_unknown", "invalid_json", "timeout", "cancelled", "terminal", "acknowledged")
lower = raw.lower()
print(json.dumps({
    "schema_version": 1, "stage": "AI-38", "environment": "linux_lab", "scope": "read_only_clock_diagnosis_and_private_closed_canary_logs",
    "guest_utc": datetime.now(timezone.utc).isoformat(), "clock": {"exit_code": clock_code, "fields": {key: clock[key] for key in clock_allow if key in clock}},
    "timesync": {"exit_code": sync_code, "fields": {key: sync[key] for key in sync_allow if key in sync}},
    "services": services, "clocksource": Path("/sys/devices/system/clocksource/clocksource0/current_clocksource").read_text().strip(),
    "virtualization": command(["systemd-detect-virt"])[1].decode().strip(),
    "synchronized_marker": {"exists": marker.exists(), "mtime_utc": datetime.fromtimestamp(marker.stat().st_mtime, timezone.utc).isoformat() if marker.exists() else None},
    "timesync_journal": {"exit_code": journal_code, "lines_observed": len(journal.splitlines()), "allowlisted_categories": categories, "raw_text_emitted": False},
    "canary_log_preservation": {"path": str(private_log), "sha256": hashlib.sha256(raw).hexdigest(), "bytes": len(raw), "lines": len(raw.splitlines()), "mode": "0600", "owner_uid": private_log.stat().st_uid, "new_capture_created": created, "since_guest_utc": "2026-10-20T16:51:40Z", "until_guest_utc": "2026-10-20T16:54:10Z", "allowlisted_token_occurrences": {token: lower.count(token.encode()) for token in tokens}, "raw_text_emitted": False, "personal_codex_origin": False},
    "clock_adjusted": False, "services_restarted": False, "provider_requests": 0, "database_operations": 0,
    "causality_for_canary_established": False, "release_authorized": False,
}, indent=2))
