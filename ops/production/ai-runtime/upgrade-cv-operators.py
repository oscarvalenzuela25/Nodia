#!/usr/bin/env python3
"""Install reviewed CV deployment operators while the current backend stays active."""
import argparse
from contextlib import ExitStack
from hashlib import sha256
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import sys
from types import SimpleNamespace


LIB = Path('/usr/local/lib/nodia')
STATE = Path('/var/lib/nodia-updates')
INSTALL_LOCK = Path('/var/lib/nodia-backend-setup/installation.lock')
REGISTRY = Path('/etc/nodia/ai-runtime/consumers.json')
OPERATOR = 'ai-runtime/upgrade-cv-operators.py'
HELPER = 'ai-runtime/upgrade-teacher-operators.py'
LEGACY_SOURCE = '907407843d6c9460d80fbd2daf44665a9d6aee6c'
UPDATER = 'update-backend.py'
RECEIVER = 'deploy-backend-receiver.py'
REPLACE = {UPDATER, RECEIVER, 'ai-runtime/register-consumers.py'}
CREATE = {'ai-runtime/prepare-codex-cv-runtime.py'}
FILES = {OPERATOR, HELPER, *REPLACE, *CREATE}
SETTINGS = {'settings.json': UPDATER, 'receiver-settings.json': RECEIVER}
HEX = re.compile(r'[a-f0-9]{64}')
GIT_SHA = re.compile(r'[a-f0-9]{40}')
RELEASE = re.compile(r'backend-[a-f0-9]{12}-[a-f0-9]{12}')
LIMIT = 128 * 1024


def require(condition, code):
    if not condition:
        raise ValueError(code)


def digest(data):
    return sha256(data).hexdigest()


def encoded(value):
    return (json.dumps(value, sort_keys=True) + '\n').encode('utf-8')


def unique_json(data):
    def pairs(entries):
        result = {}
        for key, item in entries:
            require(key not in result, 'duplicate_cv_operator_key')
            result[key] = item
        return result
    return json.loads(data, object_pairs_hook=pairs,
                      parse_constant=lambda _: require(False, 'invalid_cv_operator_number'))


def package(output):
    repo = Path(__file__).resolve().parents[3]
    output = output.resolve()
    require(any(output.is_relative_to(repo / prefix) for prefix in ('output', '.tmp'))
            and not output.exists(), 'new_ignored_output_required')
    paths = ['ops/production/' + name for name in sorted(FILES)]
    def git(*args):
        return subprocess.check_output(['git', '-C', str(repo), *args])
    require(not git('status', '--porcelain', '--', *paths).strip(),
            'cv_operator_sources_must_be_committed')
    commit = git('rev-parse', 'HEAD').decode('ascii').strip()
    require(GIT_SHA.fullmatch(commit), 'cv_operator_source_invalid')
    sources = {name: git('show', commit + ':ops/production/' + name) for name in sorted(FILES)}
    previous = {name: digest(git('show', LEGACY_SOURCE + ':ops/production/' + name)) for name in sorted(REPLACE)}
    require(all(0 < len(content) <= LIMIT and b'\r' not in content for content in sources.values()),
            'cv_operator_source_invalid')
    manifest = encoded({'schema_version': 1, 'source_sha': commit,
                        'previous_sha256': previous,
                        'files': {name: digest(content) for name, content in sources.items()}})
    output.mkdir(parents=True, mode=0o700)
    for name, content in {**sources, 'manifest.json': manifest}.items():
        file = output / name
        file.parent.mkdir(parents=True, exist_ok=True)
        with file.open('xb') as stream:
            stream.write(content)
    return {'status': 'cv_operators_packaged', 'source_sha': commit,
            'manifest_sha256': digest(manifest), 'operator_sha256': digest(sources[OPERATOR])}


def read_bundle_file(path):
    require(path.is_absolute() and path.resolve(strict=True) == path, 'cv_operator_input_not_canonical')
    descriptor = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    with os.fdopen(descriptor, 'rb') as source:
        info = os.fstat(source.fileno())
        require(stat.S_ISREG(info.st_mode) and info.st_nlink == 1 and not info.st_mode & 0o022
                and 0 < info.st_size <= LIMIT, 'cv_operator_input_invalid')
        data = source.read(LIMIT + 1)
        after = os.fstat(source.fileno())
        require(len(data) == info.st_size and (after.st_ino, after.st_size, after.st_mtime_ns) ==
                (info.st_ino, info.st_size, info.st_mtime_ns), 'cv_operator_input_changed')
    return data


def verify_bundle(bundle, expected):
    raw = read_bundle_file(bundle / 'manifest.json')
    require(HEX.fullmatch(expected or '') and digest(raw) == expected, 'cv_operator_manifest_hash_mismatch')
    manifest = unique_json(raw)
    require(type(manifest) is dict and set(manifest) == {'schema_version', 'source_sha', 'files', 'previous_sha256'}
            and type(manifest['schema_version']) is int and manifest['schema_version'] == 1
            and type(manifest['source_sha']) is str and GIT_SHA.fullmatch(manifest['source_sha'])
            and type(manifest['files']) is dict and set(manifest['files']) == FILES,
            'cv_operator_manifest_schema_invalid')
    previous = manifest['previous_sha256']
    require(type(previous) is dict and set(previous) == REPLACE and
            all(type(value) is str and HEX.fullmatch(value) for value in previous.values()),
            'cv_operator_previous_schema_invalid')
    sources = {name: read_bundle_file(bundle / name) for name in FILES}
    require(all(digest(content) == manifest['files'][name] and b'\r' not in content
                for name, content in sources.items()), 'cv_operator_source_hash_mismatch')
    require(read_bundle_file(Path(__file__).resolve()) == sources[OPERATOR], 'executed_cv_operator_hash_mismatch')
    for name, content in sources.items():
        compile(content, str(LIB / name), 'exec')
    return manifest, raw, sources


def installed_snapshot(safe, expected_release, expected_previous):
    settings = {name: safe.read_source(STATE / name, installed=True, mode=0o600, bound=16384)
                for name in SETTINGS}
    registry = safe.read_source(REGISTRY, installed=True, mode=0o600, bound=16384)
    installed = {name: safe.read_source(LIB / name, installed=True) for name in REPLACE}
    require({name: digest(raw) for name, raw in installed.items()} == expected_previous,
            'cv_operator_installed_revision_changed')
    for name in CREATE:
        require(not os.path.lexists(LIB / name), 'cv_operator_initial_install_required')
    for filename, target in SETTINGS.items():
        config = unique_json(settings[filename])
        require(type(config) is dict and type(config.get('schema_version')) is int
                and config['schema_version'] == 1 and type(config.get('assets')) is dict,
                'cv_operator_installed_settings_invalid')
        require(config['assets'].get(target) == digest(installed[target]), 'cv_operator_installed_pin_changed')
        if filename == 'settings.json':
            for name, pin in config['assets'].items():
                require(re.fullmatch(r'[a-z][a-z0-9_.-]{0,95}', name) and
                        type(pin) is str and HEX.fullmatch(pin), 'cv_operator_installed_pin_invalid')
                source = safe.read_source(LIB / name, installed=True)
                require(digest(source) == pin, 'cv_operator_installed_pin_changed')
    previous = safe.load_bytes(installed[UPDATER], LIB / UPDATER, 'previous_cv_updater')
    previous.ai_runtime_registry(unique_json(registry))
    receiver = safe.load_bytes(installed[RECEIVER], LIB / RECEIVER, 'previous_cv_receiver')
    receiver.transport_assets()
    state = safe.ready(receiver)
    require(state.get('current', {}).get('release_id') == expected_release, 'cv_operator_current_release_changed')
    runtime = safe.snapshot(receiver, unique_json(settings['settings.json']))
    proof = {'current': state['current'], 'operator_sha256': {name: digest(raw) for name, raw in installed.items()},
             'metadata_sha256': {name: digest(raw) for name, raw in settings.items()},
             'registry_sha256': digest(registry), 'runtime_snapshot_sha256': digest(encoded(runtime))}
    return proof, settings, registry, installed, state


def with_locks(safe, stack):
    import fcntl
    for directory in (LIB, LIB / 'ai-runtime', STATE, INSTALL_LOCK.parent, REGISTRY.parent):
        safe.protected(directory, directory=True)
    for path in (STATE / 'receiver.lock', INSTALL_LOCK):
        require(safe.protected(path, mode=0o600).st_size == 0, 'cv_operator_lock_invalid')
        descriptor = os.open(path, os.O_RDWR | os.O_NOFOLLOW)
        handle = stack.enter_context(os.fdopen(descriptor, 'r+b'))
        fcntl.flock(handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)


def operate(action, bundle, expected, release, baseline=None):
    require(sys.platform == 'linux' and os.geteuid() == 0, 'linux_root_required')
    require(RELEASE.fullmatch(release or ''), 'cv_operator_expected_release_required')
    os.umask(0o077)
    manifest, raw, sources = verify_bundle(bundle, expected)
    namespace = {'__name__': 'reviewed_cv_operator_helper', '__file__': str(bundle / HELPER)}
    exec(compile(sources[HELPER], namespace['__file__'], 'exec'), namespace)
    safe = SimpleNamespace(**namespace)
    with ExitStack() as locks:
        with_locks(safe, locks)
        proof, settings, registry, installed, before = installed_snapshot(safe, release, manifest['previous_sha256'])
        fingerprint = digest(encoded(proof))
        if action == 'inspect':
            return {'status': 'cv_operators_preflight', 'baseline_sha256': fingerprint,
                    'manifest_sha256': expected, 'current': proof['current'], 'runtime_activated': False}
        require(HEX.fullmatch(baseline or '') and baseline == fingerprint, 'cv_operator_preflight_changed')
        reviewed = safe.load_bytes(sources[UPDATER], LIB / UPDATER, 'reviewed_cv_updater')
        reviewed.ai_runtime_registry(unique_json(registry))
        replacement_settings = {}
        for name, target in SETTINGS.items():
            config = unique_json(settings[name])
            config['assets'][target] = digest(sources[target])
            replacement_settings[name] = encoded(config)
        record = STATE / ('cv-operator-upgrade-' + expected)
        record.mkdir(mode=0o700)
        safe.sync_directory(STATE)
        originals = record / 'originals'
        phase = 'save_originals'
        try:
            originals.mkdir(mode=0o700)
            for name, content in {**settings, **installed, 'consumers.json': registry}.items():
                path = originals / name
                path.parent.mkdir(parents=True, mode=0o700, exist_ok=True)
                safe.exclusive(path, content)
            safe.exclusive(record / 'manifest.json', raw)
            safe.exclusive(record / 'preflight.json', encoded(proof))
            phase = 'install_operators'
            for name in sorted(REPLACE):
                safe.replace(LIB / name, sources[name], 0o644)
            for name in sorted(CREATE):
                safe.exclusive(LIB / name, sources[name], 0o644)
            for name, content in replacement_settings.items():
                safe.replace(STATE / name, content, 0o600)
            phase = 'verify_installation'
            for name in REPLACE | CREATE:
                require(safe.read_source(LIB / name, installed=True) == sources[name], 'cv_operator_installation_changed')
            candidate = safe.load_bytes(sources[RECEIVER], LIB / RECEIVER, 'reviewed_cv_receiver')
            candidate.transport_assets()
            require(safe.ready(candidate) == before and
                    digest(encoded(safe.snapshot(candidate, unique_json(replacement_settings['settings.json'])))) ==
                    proof['runtime_snapshot_sha256'] and
                    safe.read_source(REGISTRY, installed=True, mode=0o600) == registry,
                    'cv_operator_backend_or_runtime_changed')
            result = {'status': 'cv_operators_upgraded', 'manifest_sha256': expected,
                      'source_sha': manifest['source_sha'], 'current': before['current'],
                      'application_restarted': False, 'runtime_activated': False}
            safe.exclusive(record / 'receipt.json', encoded(result))
            return result
        except BaseException:
            safe.exclusive(record / 'failure.json', encoded({'phase': phase, 'automatic_retry_allowed': False}))
            raise


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='action', required=True)
    packaging = sub.add_parser('package')
    packaging.add_argument('--output', type=Path, required=True)
    for action in ('inspect', 'install'):
        command = sub.add_parser(action)
        command.add_argument('--bundle', type=Path, required=True)
        command.add_argument('--manifest-sha256', required=True)
        command.add_argument('--expected-backend-release', required=True)
        if action == 'install':
            command.add_argument('--execute', action='store_true')
            command.add_argument('--baseline-sha256', required=True)
    args = parser.parse_args()
    if args.action == 'package':
        result = package(args.output)
    elif args.action == 'install' and not args.execute:
        result = {'status': 'inert', 'runtime_activated': False}
    else:
        require(args.bundle.is_absolute(), 'absolute_cv_operator_bundle_required')
        result = operate(args.action, args.bundle, args.manifest_sha256,
                         args.expected_backend_release, getattr(args, 'baseline_sha256', None))
    print(json.dumps(result, sort_keys=True))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        code = str(error)
        print(json.dumps({'status': 'failed',
                          'error_code': code if re.fullmatch('[a-zA-Z0-9_]{1,100}', code) else
                          'cv_operator_installation_review_required',
                          'automatic_retry_allowed': False}))
        raise SystemExit(1) from None
