#!/usr/bin/env python3
"""Real localhost SSH/sudo/systemd transport, isolated inside one disposable container."""
import json
from pathlib import Path
import subprocess
import time
import uuid

ROOT = Path(__file__).resolve().parents[3]
TOKEN = uuid.uuid4().hex[:12]
NAME = 'nodia-deploy-transport-' + TOKEN
IMAGE = 'nodia-deploy-transport-fixture:20261112-r01'
ASSETS = ('install-production-cd.py', 'bootstrap-deploy-identity.py', 'deploy-gateway.py',
          'deploy-backend-receiver.py', 'install-backend-updater.py', 'update-backend.py',
          'backend_update.py', 'update-backend-action.mjs', 'stage-backend-candidate.py',
          'probe-backend-dependencies.mjs', 'nodia-api.nginx.conf', 'nodia-api.service',
          'nodia-ai-worker.service', 'nodia-ai-backup.service', 'nodia-ai-backup-rotate.service',
          'nodia-ai-journal-reconcile.service', 'nodia-ai-backup.timer', 'nodia-ai-backup-rotate.timer')


def docker(*args, timeout=240, check=True):
    result = subprocess.run(['docker', *args], capture_output=True, timeout=timeout)
    result.stdout = result.stdout.decode('utf-8', errors='replace')
    result.stderr = result.stderr.decode('utf-8', errors='replace')
    if check and result.returncode:
        raise RuntimeError(json.dumps({'exit_code': result.returncode, 'stdout': result.stdout[-20000:],
                                       'stderr': result.stderr[-20000:]}))
    return result


def main():
    folder = Path(__file__).parent
    created = False
    try:
        docker('build', '-t', IMAGE, '-f', str(folder / 'deploy-transport.integration.Dockerfile'),
               str(folder), timeout=480)
        print(json.dumps({'phase': 'transport_image_ready'}), flush=True)
        mounts = []
        for asset in ASSETS:
            mounts += ['--mount', f'type=bind,source={ROOT / "ops/production" / asset},target=/input/{asset},readonly']
        mounts += ['--mount', f'type=bind,source={folder / "deploy-transport.integration.fixture.py"},target=/input/test.py,readonly']
        docker('run', '-d', '--name', NAME, '--privileged', '--cgroupns=private', '--network', 'none',
               '--tmpfs', '/run', '--tmpfs', '/run/lock', '--tmpfs', '/tmp', *mounts, IMAGE)
        created = True
        for _ in range(40):
            state = docker('exec', NAME, 'systemctl', 'is-system-running', check=False)
            if state.stdout.strip() in ('running', 'degraded'):
                break
            time.sleep(0.5)
        print(json.dumps({'phase': 'ssh_sudo_systemd_fixture_starting'}), flush=True)
        result = docker('exec', NAME, 'python3', '-I', '/input/test.py', timeout=360)
        body = json.loads(result.stdout.strip().splitlines()[-1])
        output = ROOT / 'output/production' / f'deploy-transport-{TOKEN}.json'
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(json.dumps(body, ensure_ascii=False, indent=2) + '\n', encoding='utf-8', newline='\n')
        print(json.dumps({'result': body, 'local_receipt': str(output)}))
    finally:
        if created:
            docker('rm', '-f', '-v', NAME, check=False)


if __name__ == '__main__':
    main()
