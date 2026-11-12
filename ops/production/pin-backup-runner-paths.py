#!/usr/bin/env python3
"""Adopt canonical f01 CLI paths; only a known non-secret runner EnvironmentFile changes."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import stat
import subprocess
import tempfile

ROOT = Path('/opt/nodia/releases/backend-f01b49333688-ff33b6fdbbbc')
TARGET = Path('/etc/nodia/backup-runner.env')
BEFORE_SHA = 'b9f427f2f81afa484b6a647bd2a792fabdade0782166730eb06a7b41d8543111'
STATE = Path('/var/lib/nodia-backend-setup/private')
SOURCE = 'f01b493336883403a84b1c80759ce4fc43cbd370'


def require(ok, code):
    if not ok:
        raise ValueError(code)


def canonical_environment(original):
    require(hashlib.sha256(original).hexdigest() == BEFORE_SHA, 'unexpected_legacy_environment')
    old = b'/opt/nodia/current/scripts/'
    require(original.count(old) == 2, 'unexpected_legacy_script_count')
    return original.replace(old, str(ROOT).encode() + b'/scripts/')


def protected(path, mode=None):
    require(path.resolve(strict=True) == path, 'noncanonical_path')
    info = path.lstat()
    require(info.st_uid == info.st_gid == 0 and not info.st_mode & 0o022 and
            (mode is None or stat.S_IMODE(info.st_mode) == mode), 'unsafe_path_metadata')
    return info


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--self-sha256', required=True)
    args = parser.parse_args()
    require(os.geteuid() == 0 and hashlib.sha256(Path(__file__).read_bytes()).hexdigest() == args.self_sha256,
            'root_and_exact_helper_required')
    for directory in (TARGET.parent, STATE, ROOT):
        for ancestor in (directory, *directory.parents):
            require(stat.S_ISDIR(protected(ancestor).st_mode), 'directory_required')
    require(Path('/opt/nodia/current').is_symlink() and Path('/opt/nodia/current').resolve(strict=True) == ROOT,
            'current_release_mismatch')
    manifest = json.loads((ROOT / 'release-manifest.json').read_text())
    require(manifest.get('source_sha') == SOURCE and manifest.get('release_id') == ROOT.name and
            manifest.get('package_tree_sha256') == 'ff33b6fdbbbc05167745da9c2fde5f3d19355baf51d51214bbc7121cb6ea1e6f',
            'release_identity_mismatch')
    for unit in ('nodia-ai-backup.service', 'nodia-ai-backup-rotate.service', 'nodia-ai-journal-reconcile.service',
                 'nodia-ai-backup.timer', 'nodia-ai-backup-rotate.timer'):
        value = subprocess.run(['systemctl', 'show', unit, '--property=ActiveState', '--value'],
                               capture_output=True, text=True, timeout=10, check=True)
        require(value.stdout.strip() == 'inactive', 'backup_units_must_be_inactive')
    metadata = protected(TARGET, 0o600)
    require(stat.S_ISREG(metadata.st_mode) and metadata.st_nlink == 1, 'regular_environment_required')
    original = TARGET.read_bytes()
    changed = canonical_environment(original)
    backup = STATE / 'backup-runner-before-canonical.env'
    with backup.open('xb') as destination:
        os.fchmod(destination.fileno(), 0o600)
        destination.write(original); destination.flush(); os.fsync(destination.fileno())
    descriptor, temporary = tempfile.mkstemp(prefix='.backup-runner-', dir=TARGET.parent)
    try:
        with os.fdopen(descriptor, 'wb') as destination:
            destination.write(changed); destination.flush(); os.fsync(destination.fileno())
        os.replace(temporary, TARGET)
        directory = os.open(TARGET.parent, os.O_RDONLY | os.O_DIRECTORY)
        try:
            os.fsync(directory)
        finally:
            os.close(directory)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)
    require(TARGET.read_bytes() == changed and stat.S_IMODE(TARGET.stat().st_mode) == 0o600, 'environment_postcheck_failed')
    print(json.dumps({'status': 'canonical_paths_pinned', 'source_sha': SOURCE,
                      'before_sha256': BEFORE_SHA, 'after_sha256': hashlib.sha256(changed).hexdigest(),
                      'backup_requested': False, 'database_mutations_requested': False,
                      'application_files_modified': False}))


if __name__ == '__main__':
    main()
