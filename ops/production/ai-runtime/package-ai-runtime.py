"""Package public reviewed inputs only; never include private working-tree files."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import subprocess


def package(output):
    root = Path(__file__).resolve().parents[3]
    source = Path(__file__).resolve().parent
    output = output.resolve()
    if not any(output.is_relative_to(root / name) for name in ('.tmp', 'output')) or output.exists():
        raise ValueError('new_ignored_output_directory_required')
    status = subprocess.check_output(['git', 'status', '--porcelain', '--', 'nodia-gemini-microservice'], cwd=root)
    if status.strip():
        raise ValueError('native_source_must_be_committed')
    sha = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root, text=True).strip()
    output.mkdir(parents=True, mode=0o700)
    names = ['prepare-ai-runtime.py', 'activate-ai-runtime.py', 'gemini-host.py', 'runtime-preflight.mjs',
             'nodia-gemini.service', 'codex-provision.py', 'codex-keyring.py', 'codex-bus.conf',
             'codex-bus.service', 'codex-keyring.service', 'codex-runtime.conf', 'codex-native-probe.mjs',
             'verify-gemini-host.py', 'register-consumers.py']
    for name in names:
        shutil.copyfile(source / name, output / name)
    shutil.copyfile(root / 'docs/evidence/scripts/attach-nodia-gemini-login-cgroup.py', output / 'attach-login-cgroup.py')
    shutil.copyfile(root / 'docs/evidence/scripts/verify-nodia-gemini-login-cgroup-host.py', output / 'verify-login-cgroup-host.py')
    shutil.copyfile(source.parent / 'update-backend-action.mjs', output / 'update-backend-action.mjs')
    subprocess.run(['git', 'archive', '--format=tar.gz', '--output=' + str(output / 'native-context.tar.gz'),
                    sha + ':nodia-gemini-microservice'], cwd=root, check=True)
    manifest = {'schema_version': 1, 'source_sha': sha,
                'files': {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(output.iterdir())}}
    raw = (json.dumps(manifest, sort_keys=True, indent=2) + '\n').encode()
    (output / 'manifest.json').write_bytes(raw)
    return {'status': 'packaged', 'source_sha': sha, 'manifest_sha256': hashlib.sha256(raw).hexdigest(),
            'files': len(manifest['files']), 'private_configuration_included': False}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    print(json.dumps(package(parser.parse_args().output)))
