"""Read-only lab inventory. Emits selected metadata, never environment/profile bytes.

Run over SSH with python3 -; no remote file or service is modified. This is a
snapshot, not provider readiness, acceptance, firewall or release authorization.
"""
from datetime import datetime, timezone
from pathlib import Path
import hashlib
import json
import shutil
import subprocess


def checked(argv):
    result = subprocess.run(argv, capture_output=True, check=False, timeout=45)
    if result.returncode != 0:
        raise RuntimeError("readonly_inventory_command_failed")
    return result.stdout


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


units = {}
for name in ("nodia-api", "nodia-ai-worker", "nodia-gemini-lab", "nginx"):
    fields = checked(["systemctl", "show", name, "--no-pager", "--property=ActiveState,SubState,MainPID,WorkingDirectory,FragmentPath"]).decode()
    values = dict(line.split("=", 1) for line in fields.splitlines() if "=" in line)
    pid = int(values["MainPID"])
    units[name] = {
        "active_state": values["ActiveState"], "sub_state": values["SubState"],
        "pid": pid, "working_directory": values["WorkingDirectory"],
        "unit_file": values["FragmentPath"],
        "process_executable": str(Path(f"/proc/{pid}/exe").resolve()) if pid else None,
    }

runtime = Path("/opt/nodia/releases/nodia-server-ai15-20261016")
files = {p.relative_to(runtime).as_posix(): sha(p) for p in sorted((runtime / "dist").rglob("*")) if p.is_file()}
container = json.loads(checked(["docker", "inspect", "nodia-gemini-microservice"]))[0]
baseline = json.loads(Path("/opt/nodia/verification/ai36-c05-r05-role-activation/private-original-container.json").read_text(encoding="utf-8"))
current_environment = dict(value.split("=", 1) for value in container["Config"]["Env"])
baseline_environment = dict(value.split("=", 1) for value in baseline["Config"]["Env"])
assert len(current_environment) == len(container["Config"]["Env"])
assert len(baseline_environment) == len(baseline["Config"]["Env"])
safe_container = {
    "id": container["Id"], "image": container["Image"],
    "running": container["State"]["Running"], "started_at": container["State"]["StartedAt"],
    "uid_configuration": container["Config"]["User"],
    "port_bindings": container["HostConfig"]["PortBindings"],
    "mounts": [{"destination": m["Destination"], "type": m["Type"], "read_write": m["RW"]} for m in container["Mounts"]],
    "environment_matches_private_baseline": current_environment == baseline_environment,
    "environment_list_order_matches_private_baseline": container["Config"]["Env"] == baseline["Config"]["Env"],
    "mounts_match_private_baseline": sorted(container["Mounts"], key=lambda m: m["Destination"]) == sorted(baseline["Mounts"], key=lambda m: m["Destination"]),
}
listeners = []
for row in checked(["ss", "-H", "-ltn"]).decode().splitlines():
    fields = row.split()
    local = fields[3]
    if local.rsplit(":", 1)[-1] in {"80", "443", "3000", "3100", "5432", "6379", "8000"}:
        listeners.append(local)

browser_binaries = {name: shutil.which(name) for name in ("chromium", "chromium-browser", "google-chrome", "google-chrome-stable", "firefox")}
browser_caches = []
for folder in (Path("/root/.cache/ms-playwright"), Path("/home/operador/.cache/ms-playwright"), Path("/opt/nodia/verification/ai32-r02-20261018/node_modules/playwright"), Path("/opt/nodia/verification/ai32-r02-20261018/node_modules/@playwright/test")):
    browser_caches.append({"path": str(folder), "exists": folder.exists()})

health_script = Path("/tmp/nodia-ai-ai36-c05-live-health.mjs")
assert sha(health_script) == "e4f32a756acbd2ab1ae15056352eca4429a59cb780a2ab8dfe861f9d2287f395", "readonly_SQL_helper_changed"
sql = json.loads(checked(["/usr/local/bin/node", str(health_script), str(runtime)]))
assert sql["configured_SQL_writes"] == sql["provider_requests"] == sql["storage_operations"] == 0

print(json.dumps({
    "schema_version": 1, "stage": "AI-38", "environment": "linux_lab",
    "scope": "read_only_delivery_inventory_not_acceptance", "observed_at_utc": datetime.now(timezone.utc).isoformat(),
    "units": units, "operational_node": {"root": str(runtime), "compiled_files": len(files), "manifest_sha256": hashlib.sha256(json.dumps(files, sort_keys=True).encode()).hexdigest()},
    "gemini_container": safe_container, "listening_addresses": sorted(listeners),
    "browser_inventory": {"binaries": browser_binaries, "known_cache_or_package_paths": browser_caches, "browser_execution_verified": False},
    "SQL_read_only": sql,
    "limits": {"firewall_external_probe": False, "provider_session_or_inference_checked": False, "R2_checked": False, "profile_contents_read": False, "environment_values_emitted": False, "services_restarted": False, "remote_files_written": False, "release_authorized": False},
}, indent=2))
