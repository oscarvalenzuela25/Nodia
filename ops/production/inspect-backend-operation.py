#!/usr/bin/env python3
"""Read one protected CD attempt; emit bounded diagnostic codes, never raw logs."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import stat

STATE = Path('/var/lib/nodia-updates')
LIMIT = 1024 * 1024
CODE = re.compile(r'[a-z][a-z0-9_]{0,99}')
HINTS = ('ERR_MODULE_NOT_FOUND', 'MODULE_NOT_FOUND', 'ERR_DLOPEN_FAILED',
         'SyntaxError', 'ReferenceError', 'EACCES', 'ENOENT', 'ENOTFOUND',
         'ECONNREFUSED', 'CERT_HAS_EXPIRED', 'nginx', 'systemd-analyze',
         'nodia-update-action-', 'Failed to start', 'Permission denied')


def require(condition, code):
    if not condition:
        raise ValueError(code)


def protected(path, directory=False):
    info = path.lstat()
    require(path.resolve(strict=True) == path and info.st_uid == info.st_gid == 0
            and not info.st_mode & 0o022, 'unsafe_diagnostic_path')
    require(stat.S_ISDIR(info.st_mode) if directory else
            stat.S_ISREG(info.st_mode) and info.st_nlink == 1, 'invalid_diagnostic_path')
    return info


def read(path):
    info = protected(path)
    require(info.st_size <= LIMIT, 'diagnostic_file_too_large')
    descriptor = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    with os.fdopen(descriptor, 'rb') as stream:
        require(os.fstat(stream.fileno()).st_ino == info.st_ino, 'diagnostic_file_changed')
        raw = stream.read(LIMIT + 1)
    require(len(raw) <= LIMIT, 'diagnostic_file_too_large')
    return raw


def codes(value):
    if type(value) is not dict:
        return {}
    result = {}
    for key in ('status', 'phase', 'failed_phase', 'error_code', 'failed_component'):
        if type(value.get(key)) is str and CODE.fullmatch(value[key]):
            result[key] = value[key]
    for key in ('effects_started', 'migration_requested', 'read_only', 'client_tls_authorized',
                'deployment_performed', 'automatic_retry_allowed'):
        if type(value.get(key)) is bool:
            result[key] = value[key]
    if type(value.get('database_sqlstate')) is str and re.fullmatch(r'[A-Z0-9]{5}', value['database_sqlstate']):
        result['database_sqlstate'] = value['database_sqlstate']
    checks = value.get('checks')
    if type(checks) is dict:
        allowed = {'local_configuration', 'node_runtime', 'postgres', 'redis', 'r2'}
        result['checks'] = {key: item for key, item in checks.items()
                            if key in allowed and type(item) is str and CODE.fullmatch(item)}
    return result


def diagnostic(raw):
    text = raw.decode('utf-8', errors='replace')
    records = []
    for line in text.splitlines()[:200]:
        try:
            value = json.loads(line)
        except (ValueError, TypeError):
            continue
        safe = codes(value)
        if safe:
            records.append(safe)
    return {'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest(),
            'hints': [hint for hint in HINTS if hint in text], 'records': records[:20]}


def inspect(operation_id):
    require(os.geteuid() == 0, 'root_required')
    require(isinstance(operation_id, str) and re.fullmatch(r'[a-f0-9]{32}', operation_id), 'invalid_operation_id')
    attempt = STATE / 'attempts' / operation_id
    for parent in reversed((attempt, *attempt.parents)):
        protected(parent, directory=True)
    raw = read(attempt / 'state.json')
    state = json.loads(raw)
    require(type(state) is dict and state.get('operation_id') == operation_id, 'operation_identity_mismatch')
    files = sorted(attempt.iterdir())
    require(len(files) <= 128, 'diagnostic_inventory_too_large')
    selected = [file for file in files if file.name == 'last-command.log'
                or re.fullmatch(r'[a-f0-9]{32}\.(?:json|log)', file.name)]
    return {'schema_version': 1, 'status': 'inspected', 'operation_id': operation_id,
            'attempt': codes(state), 'diagnostics': {file.name: diagnostic(read(file)) for file in selected},
            'raw_logs_exposed': False, 'mutations_requested': False, 'retry_requested': False}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('operation_id')
    args = parser.parse_args()
    print(json.dumps(inspect(args.operation_id)))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        code = str(error) if isinstance(error, ValueError) and CODE.fullmatch(str(error)) else 'operation_inspection_failed'
        print(json.dumps({'schema_version': 1, 'status': 'failed', 'error_code': code,
                          'automatic_retry_allowed': False, 'mutations_requested': False}))
        raise SystemExit(1) from None
