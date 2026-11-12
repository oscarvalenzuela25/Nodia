#!/usr/bin/env python3
"""Run a non-replayed job in the operator-authenticated tmux PTY; never reads a password."""
import argparse
import base64
import hashlib
import json
import os
from pathlib import Path
import re
import shlex
import subprocess
import time
import uuid

TARGET = 'nodia-admin@166.0.112.187'
BASE = '/home/nodia-admin/nodia-setup/backend/admin-jobs'
SSH = ['ssh', '-T', '-i', str(Path.home() / '.ssh/nodia-truobox'), '-o', 'IdentitiesOnly=yes',
       '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes', '-o', 'ConnectTimeout=10', TARGET]


def remote(script):
    result = subprocess.run([*SSH, 'bash', '-s'], input=script.encode(), capture_output=True, timeout=35)
    if result.returncode:
        raise RuntimeError(result.stderr.decode(errors='replace') or 'SSH command failed')
    return result.stdout.decode()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--script', type=Path)
    parser.add_argument('--label', default='job')
    parser.add_argument('--resume')
    parser.add_argument('--wait-seconds', type=int, default=120)
    args = parser.parse_args()
    if args.resume:
        job_id = args.resume
        if not re.fullmatch(r'[a-z0-9-]+-[a-f0-9]{32}', job_id):
            raise ValueError('invalid_job_id')
    else:
        if not args.script or not re.fullmatch(r'[a-z0-9-]{1,40}', args.label):
            raise ValueError('script_and_safe_label_required')
        body = args.script.read_bytes()
        if not 0 < len(body) <= 65536 or b'\r' in body:
            raise ValueError('bounded_UTF8_LF_script_required')
        body.decode('utf-8')
        job_id = args.label + '-' + uuid.uuid4().hex
        folder = BASE + '/' + job_id
        wrapper = (f'#!/bin/bash\nset -eu\numask 077\nmkdir {shlex.quote(folder + "/started")} || exit 77\n'
                   f'exec >{shlex.quote(folder + "/stdout")} 2>{shlex.quote(folder + "/stderr")}\n'
                   f"trap 'result=$?; printf \"%s\\n\" \"$result\" > {shlex.quote(folder + '/exit-code')}' EXIT\n").encode() + body
        encoded = base64.b64encode(wrapper).decode()
        remote(f'''set -eu
test "$(id -un)" = nodia-admin
test "$(tmux -L nodia-deploy show-options -v -t setup @nodia-ready)" = yes
test "$(tmux -L nodia-deploy list-panes -t setup -F '#{{pane_current_command}}|#{{pane_dead}}|#{{pane_in_mode}}')" = 'bash|0|0'
python3 - <<'PY'
from pathlib import Path
import base64,os,stat
base=Path({BASE!r})
if not base.exists(): base.mkdir(mode=0o700)
assert base.resolve()==base and base.stat().st_uid==os.getuid() and stat.S_IMODE(base.stat().st_mode)==0o700
folder=base/{job_id!r};folder.mkdir(mode=0o700)
with (folder/'job.sh').open('xb') as f: f.write(base64.b64decode({encoded!r}))
os.chmod(folder/'job.sh',0o600)
PY
''')
        print(json.dumps({'job_id': job_id, 'script_sha256': hashlib.sha256(body).hexdigest(), 'phase': 'prepared'}), flush=True)
        # Submit once. An uncertain send/connection outcome must be resumed by ID, never resubmitted.
        remote('tmux -L nodia-deploy send-keys -t setup:0.0 -l -- ' + shlex.quote('/bin/bash ' + shlex.quote(folder + '/job.sh')) + '\n'
               'tmux -L nodia-deploy send-keys -t setup:0.0 Enter\n')
    folder = BASE + '/' + job_id
    deadline = time.monotonic() + args.wait_seconds
    while time.monotonic() < deadline:
        result = remote(f'if [ -f {shlex.quote(folder + "/exit-code")} ]; then cat {shlex.quote(folder + "/exit-code")}; fi\n').strip()
        if result:
            output = remote('cat ' + shlex.quote(folder + '/stdout') + '\n')
            error = remote('cat ' + shlex.quote(folder + '/stderr') + '\n')
            destination = Path('output/production/admin-jobs') / job_id
            destination.mkdir(parents=True, exist_ok=True)
            (destination / 'stdout.log').write_text(output, encoding='utf-8', newline='\n')
            (destination / 'stderr.log').write_text(error, encoding='utf-8', newline='\n')
            receipt = {'job_id': job_id, 'phase': 'complete', 'exit_code': int(result), 'local_output': str(destination.resolve())}
            (destination / 'receipt.json').write_text(json.dumps(receipt, indent=2) + '\n', encoding='utf-8', newline='\n')
            print(json.dumps(receipt), flush=True)
            return
        time.sleep(2)
    print(json.dumps({'job_id': job_id, 'phase': 'running_or_outcome_unknown', 'resume_required': True}), flush=True)


if __name__ == '__main__':
    main()
