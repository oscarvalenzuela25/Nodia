#!/usr/bin/env python3
"""Isolated Docker/systemd integration; no host cgroup bind or production secrets."""
import json
from pathlib import Path
import subprocess
import time
import uuid

ROOT = Path(__file__).resolve().parents[3]
TOKEN = uuid.uuid4().hex[:12]
NAME = 'nodia-updater-systemd-' + TOKEN
IMAGE = 'nodia-updater-systemd-fixture:20261112-r01'


def command(args, *, stdin=None, timeout=240, check=True):
    result = subprocess.run(args, input=stdin.encode('utf-8') if stdin is not None else None,
                            capture_output=True, timeout=timeout)
    result.stdout = result.stdout.decode('utf-8', errors='replace')
    result.stderr = result.stderr.decode('utf-8', errors='replace')
    if check and result.returncode:
        raise RuntimeError(json.dumps({'command': args[:3], 'exit_code': result.returncode,
                                       'stdout': result.stdout[-16000:], 'stderr': result.stderr[-16000:]}))
    return result


def docker(*args, **kwargs):
    return command(['docker', *args], **kwargs)


def main():
    folder = Path(__file__).parent
    created = False
    try:
        docker('build', '-t', IMAGE, '-f', str(folder / 'updater-systemd.integration.Dockerfile'), str(folder), timeout=420)
        print(json.dumps({'phase': 'systemd_image_ready'}), flush=True)
        docker('run', '-d', '--name', NAME, '--privileged', '--cgroupns=private', '--network', 'none',
               '--tmpfs', '/run', '--tmpfs', '/run/lock', '--tmpfs', '/tmp',
               '--mount', f'type=bind,source={ROOT / "ops/production/update-backend.py"},target=/input/update-backend.py,readonly',
               '--mount', f'type=bind,source={ROOT / "ops/production/backend_update.py"},target=/input/backend_update.py,readonly',
               '--mount', f'type=bind,source={ROOT / "ops/production/stage-backend-candidate.py"},target=/input/stage.py,readonly',
               '--mount', f'type=bind,source={folder / "updater-systemd.integration.fixture.py"},target=/input/test.py,readonly',
               IMAGE)
        created = True
        ready = False
        for _ in range(40):
            running = docker('inspect', NAME, '--format', '{{.State.Running}}').stdout.strip()
            if running != 'true':
                break
            state = docker('exec', NAME, 'systemctl', 'is-system-running', check=False)
            if state.stdout.strip() in ('running', 'degraded'):
                ready = True
                break
            time.sleep(0.5)
        if not ready:
            logs = docker('logs', NAME, '--tail', '120', check=False)
            result = {'schema_version': 1, 'status': 'systemd_container_unavailable',
                      'privileged': True, 'cgroup_namespace': 'private', 'host_cgroup_bind': False,
                      'network': 'none', 'host_secrets_mounted': False,
                      'boot_stdout': logs.stdout[-16000:], 'boot_stderr': logs.stderr[-16000:]}
        else:
            print(json.dumps({'phase': 'systemd_pid1_ready'}), flush=True)
            result = docker('exec', NAME, 'python3', '-I', '/input/test.py', timeout=300)
            result = json.loads(result.stdout.strip().splitlines()[-1])
        output = ROOT / 'output/production' / f'updater-systemd-{TOKEN}.json'
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8', newline='\n')
        print(json.dumps({'result': result, 'local_receipt': str(output)}))
    finally:
        if created:
            docker('rm', '-f', '-v', NAME, check=False)


if __name__ == '__main__':
    main()
