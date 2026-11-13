"""Account-free host kernel gate before activating the configured adapter.

Uses only uniquely named ephemeral network-none containers. Never touches the
configured container/profile, application, database or a provider account.
"""
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import uuid

ROOT = Path('/usr/local/lib/nodia/ai-runtime')
VERIFIER = ROOT / 'verify-login-cgroup-host.py'


def run(arguments, timeout=90):
    result = subprocess.run(arguments, capture_output=True, stdin=subprocess.DEVNULL, timeout=timeout, check=False)
    if result.returncode != 0 or len(result.stdout) > 1048576:
        raise RuntimeError('isolated_host_verification_failed')
    return result.stdout.decode().strip()


def main():
    if sys.platform != 'linux' or os.geteuid() != 0 or sys.argv[1:]:
        raise RuntimeError('linux_root_no_arguments_required')
    spec = importlib.util.spec_from_file_location('gemini_host', ROOT / 'gemini-host.py')
    host = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(host)
    image = host.image_id()
    name = 'nodia-login-host-qa-' + uuid.uuid4().hex[:12]
    with tempfile.TemporaryDirectory(prefix='kernel-qa-', dir='/var/lib/nodia-ai-runtime-setup') as directory:
        state = Path(directory) / 'containment'
        try:
            run(['docker', 'run', '--detach', '--init', '--name', name, '--network=none',
                 '--user=10001:10001', '--cgroupns=private', '--cap-drop=ALL',
                 '--security-opt=no-new-privileges:true', '--pids-limit=256', '--memory=1g',
                 image, 'python', '-c', 'import time;time.sleep(600)'])
            host_result = json.loads(run(['/usr/bin/python3', '-I', str(VERIFIER), '--helper',
                str(ROOT / 'attach-login-cgroup.py'), '--image-container', name], 180))
            run(['/usr/bin/python3', '-I', str(ROOT / 'attach-login-cgroup.py'),
                 '--container-name', name, '--state-directory', str(state)])
            durable = run(['docker', 'exec', '--user=10001:10001',
                '--env=NODIA_ISOLATED_NATIVE_TEST=1', name, 'python', 'scripts/verify_durable_login.py'], 180)
            print(json.dumps({'schema_version': 1, 'status': 'verified', 'host': host_result,
                              'durable_login_fixture': json.loads(durable), 'network': 'none',
                              'real_credentials_used': False, 'configured_profile_changed': False}))
        finally:
            subprocess.run(['docker', 'rm', '--force', name], capture_output=True, stdin=subprocess.DEVNULL, timeout=30, check=False)


if __name__ == '__main__':
    try:
        main()
    except Exception:
        print(json.dumps({'status': 'failed', 'error_code': 'isolated_host_verification_failed',
                          'production_activation_requested': False}))
        raise SystemExit(1) from None
