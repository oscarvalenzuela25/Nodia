"""Read-only bounded process/socket metadata observer; no argv/env/payload reads."""
import argparse
import collections
import json
import os
from pathlib import Path
import subprocess
import time

CONTAINER = "nodia-gemini-microservice"
TCP_STATES = {"01": "established", "02": "syn_sent", "03": "syn_received",
              "04": "fin_wait_1", "05": "fin_wait_2", "06": "time_wait",
              "07": "closed", "08": "close_wait", "09": "last_ack",
              "0A": "listen", "0B": "closing", "0C": "new_syn_received"}


def process_tree():
    result = subprocess.run(["docker", "top", CONTAINER, "-eo", "pid,ppid,comm"],
                            capture_output=True, text=True, timeout=3, check=True)
    rows = {}
    for line in result.stdout.splitlines()[1:]:
        parts = line.split()
        if len(parts) == 3 and parts[0].isdigit() and parts[1].isdigit():
            pid, parent = int(parts[0]), int(parts[1])
            rows[pid] = (parent, parts[2])
    # Read executable links solely to identify this release's pinned CLI.
    selected = set()
    for pid in rows:
        try:
            if Path(os.readlink(f"/proc/{pid}/exe")).name == "agy":
                selected.add(pid)
        except OSError:
            continue
    while True:
        children = {pid for pid, (parent, _) in rows.items() if parent in selected}
        if children <= selected:
            break
        selected.update(children)
    return {pid: rows[pid] for pid in selected}


def socket_states(pid):
    sockets = set()
    try:
        for descriptor in Path(f"/proc/{pid}/fd").iterdir():
            try:
                target = os.readlink(descriptor)
                if target.startswith("socket:[") and target.endswith("]"):
                    sockets.add(target[8:-1])
            except OSError:
                continue
    except OSError:
        return {"unavailable": 1}
    counts = collections.Counter()
    for kind in ("tcp", "tcp6"):
        try:
            lines = Path(f"/proc/{pid}/net/{kind}").read_text().splitlines()[1:]
        except OSError:
            continue
        for line in lines:
            parts = line.split()
            if len(parts) >= 10 and parts[9] in sockets:
                # No peer/local addresses, ports or inode identifiers leave memory.
                counts[TCP_STATES.get(parts[3], "other")] += 1
    return dict(counts)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--seconds", type=int, default=140)
    args = parser.parse_args()
    if not 1 <= args.seconds <= 140:
        parser.error("duration must be within 1..140 seconds")
    start = time.monotonic()
    prior = None
    print(json.dumps({"event": "ready", "pid": os.getpid(),
                      "max_seconds": args.seconds}), flush=True)
    while time.monotonic() - start < args.seconds:
        try:
            tree = process_tree()
            rows = [{"pid": pid, "ppid": parent, "kind": "cli" if name == "agy"
                     else "descendant", "tcp_states": socket_states(pid)}
                    for pid, (parent, name) in sorted(tree.items())]
            snapshot = {"processes": rows}
        except (subprocess.SubprocessError, OSError):
            snapshot = {"error_category": "process_inventory_unavailable"}
        if snapshot != prior:
            print(json.dumps({"event": "snapshot", "elapsed_ms":
                              round((time.monotonic() - start) * 1000),
                              **snapshot}), flush=True)
            prior = snapshot
        time.sleep(min(0.5, max(0, args.seconds - (time.monotonic() - start))))
    print(json.dumps({"event": "terminal", "reason": "bounded_duration"}), flush=True)


if __name__ == "__main__":
    main()
