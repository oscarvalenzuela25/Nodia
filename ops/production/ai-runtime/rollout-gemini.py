"""Package and activate a reviewed Gemini adapter without changing its private profile."""
import argparse
from contextlib import ExitStack
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import sys
import tarfile
import time
import urllib.error
import urllib.request

LIB = Path('/usr/local/lib/nodia')
RUNTIME = LIB / 'ai-runtime'
STATE = Path('/var/lib/nodia-ai-runtime-setup')
UPDATES = Path('/var/lib/nodia-updates')
RECEIVER = 'deploy-backend-receiver.py'
OPERATOR = 'rollout-gemini.py'
ARCHIVE = 'native-context.tar.gz'
ATTESTATION = STATE / 'gemini-rollout-current.json'
CURRENT = Path('/opt/nodia/current')
INSTALL_LOCK = Path('/var/lib/nodia-backend-setup/installation.lock')
HEX = re.compile(r'[a-f0-9]{64}')
GIT_SHA = re.compile(r'[a-f0-9]{40}')
IMAGE = re.compile(r'sha256:[a-f0-9]{64}')
RELEASE = re.compile(r'backend-[a-f0-9]{12}-[a-f0-9]{12}')


def require(condition, code):
    if not condition:
        raise ValueError(code)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def encoded(value):
    return (json.dumps(value, sort_keys=True) + '\n').encode()


def unique_json(raw):
    def pairs(items):
        value = dict(items)
        require(len(value) == len(items), 'duplicate_rollout_key')
        return value
    return json.loads(raw, object_pairs_hook=pairs)


def native_source(source, tree):
    require(type(source) is str and GIT_SHA.fullmatch(source) and
            type(tree) is str and GIT_SHA.fullmatch(tree), 'rollout_source_invalid')


def read_input(path, maximum):
    fd = os.open(path, os.O_RDONLY | getattr(os, 'O_NOFOLLOW', 0) | getattr(os, 'O_NONBLOCK', 0))
    with os.fdopen(fd, 'rb') as stream:
        info = os.fstat(stream.fileno())
        require(stat.S_ISREG(info.st_mode) and info.st_nlink == 1 and 0 < info.st_size <= maximum,
                'rollout_input_invalid')
        data = stream.read(maximum + 1)
    require(0 < len(data) <= maximum, 'rollout_input_too_large')
    return data


def package(output):
    repo = Path(__file__).resolve().parents[3]
    output = output.resolve()
    require(any(output.is_relative_to(repo / name) for name in ('.tmp', 'output'))
            and not output.exists(), 'new_ignored_output_required')
    git = lambda *args: subprocess.check_output(['git', '-C', str(repo), *args])
    tracked = ('nodia-gemini-microservice', 'ops/production/' + RECEIVER,
               'ops/production/ai-runtime/' + OPERATOR)
    require(not git('status', '--porcelain', '--', *tracked).strip(), 'rollout_sources_must_be_committed')
    source = git('rev-parse', 'HEAD').decode().strip()
    tree = git('rev-parse', source + ':nodia-gemini-microservice').decode().strip()
    native_source(source, tree)
    files = {ARCHIVE: git('archive', '--format=tar.gz', source + ':nodia-gemini-microservice'),
             RECEIVER: git('show', source + ':' + tracked[1]),
             OPERATOR: git('show', source + ':' + tracked[2])}
    manifest = encoded({'schema_version': 1, 'source_sha': source, 'source_tree_sha': tree,
                        'files': {name: sha(raw) for name, raw in files.items()}})
    output.mkdir(mode=0o700, parents=True)
    for name, raw in {**files, 'manifest.json': manifest}.items():
        with (output / name).open('xb') as stream:
            stream.write(raw)
    return {'status': 'packaged', 'source_sha': source, 'source_tree_sha': tree,
            'manifest_sha256': sha(manifest), 'operator_sha256': sha(files[OPERATOR])}


def verify_bundle(bundle, expected):
    raw = read_input(bundle / 'manifest.json', 16384)
    require(HEX.fullmatch(expected or '') and sha(raw) == expected, 'reviewed_gemini_manifest_required')
    data = unique_json(raw)
    require(type(data) is dict and set(data) == {'schema_version', 'source_sha', 'source_tree_sha', 'files'}
            and type(data['schema_version']) is int and data['schema_version'] == 1
            and type(data['files']) is dict and set(data['files']) == {RECEIVER, ARCHIVE, OPERATOR},
            'rollout_manifest_invalid')
    native_source(data['source_sha'], data['source_tree_sha'])
    files = {name: read_input(bundle / name, 12 * 1024 ** 2 if name == ARCHIVE else 128 * 1024)
             for name in data['files']}
    require(all(sha(content) == data['files'][name] for name, content in files.items()), 'rollout_bundle_hash_mismatch')
    require(read_input(Path(__file__), 128 * 1024) == files[OPERATOR], 'executed_operator_differs_from_bundle')
    compile(files[RECEIVER], str(LIB / RECEIVER), 'exec')
    return data, files


def installed_module(path):
    for parent in (path, *path.parents):
        meta = parent.lstat()
        require(parent.resolve(strict=True) == parent and meta.st_uid == meta.st_gid == 0
                and not meta.st_mode & 0o022, 'unsafe_installed_rollout_operator')
    require(stat.S_ISREG(path.lstat().st_mode), 'installed_rollout_operator_not_regular')
    spec = importlib.util.spec_from_file_location(path.stem.replace('-', '_'), path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def pinned_assets(updater, settings):
    files = settings.get('assets')
    require(type(files) is dict and files, 'missing_installed_rollout_assets')
    for name, digest in files.items():
        require(re.fullmatch(r'[a-z][a-z0-9_.-]{0,95}', name) and type(digest) is str and HEX.fullmatch(digest),
                'invalid_installed_rollout_asset')
        path = LIB / name
        updater.protected(path, mode=0o755 if name == 'deploy-gateway.py' else 0o644)
        require(sha(read_input(path, 1024 * 1024)) == digest, 'installed_rollout_asset_changed')


def build_image(preparer, host, record, archive, source):
    host.reserve(Path('/var/lib/docker'), 1024 ** 3)
    context = record / 'context'
    context.mkdir(mode=0o700)
    with tarfile.open(fileobj=io.BytesIO(archive), mode='r:gz') as package_file:
        for member in preparer.archive_members(package_file):
            target = context / member.name
            if member.isdir():
                target.mkdir(parents=True, exist_ok=True, mode=0o755)
            else:
                target.parent.mkdir(parents=True, exist_ok=True, mode=0o755)
                with package_file.extractfile(member) as original, target.open('xb') as output:
                    output.write(original.read())
                    os.fchmod(output.fileno(), 0o755 if member.mode & 0o111 else 0o644)
    image_file = record / 'image.id'
    preparer.command(['/usr/bin/docker', 'build', '--iidfile', str(image_file),
                      '--tag', 'nodia-antigravity:' + source[:12], str(context)], 950, record / 'build.log')
    image = read_input(image_file, 128).decode().strip()
    require(IMAGE.fullmatch(image), 'built_gemini_image_invalid')
    isolated = ['/usr/bin/docker', 'run', '--rm', '--network=none', '--user=10001:10001',
                '--cap-drop=ALL', '--security-opt=no-new-privileges:true', '--memory=1g', '--pids-limit=256', image]
    preparer.command([*isolated, 'python', '-m', 'pip', 'check'], 60, record / 'tests.log')
    preparer.command([*isolated, 'python', '-m', 'unittest', 'discover', '-s', 'tests', '-q'],
                     480, record / 'tests.log')
    return image


def verify_logout_contract(gemini):
    private = gemini.private_file(gemini.ENV).decode('ascii')
    match = re.fullmatch(r'GEMINI_SERVICE_TOKEN=([a-fA-F0-9]{64})\n', private)
    require(match is not None, 'gemini_service_token_unverified')
    endpoint = 'http://127.0.0.1:8000/openapi.json'
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, *_):
            return None
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())
    try:
        with opener.open(endpoint, timeout=5):
            raise ValueError('private_gemini_schema_accepted_anonymous')
    except urllib.error.HTTPError as error:
        require(error.code == 401, 'private_gemini_schema_authentication_unverified')
    request = urllib.request.Request(endpoint, headers={'X-Nodia-Service-Token': match.group(1)})
    with opener.open(request, timeout=15) as response:
        require(response.status == 200 and response.url == endpoint, 'private_gemini_schema_unverified')
        body = response.read(524289)
    require(len(body) <= 524288 and type(unique_json(body).get('paths', {}).get(
        '/agentic/auth/login/logout', {}).get('post')) is dict, 'gemini_logout_route_missing')


def drain(host):
    deadline = time.monotonic() + 120
    while True:
        snapshot = host.node_action('inspect')
        require(snapshot.get('read_only') is True and snapshot.get('client_tls_authorized') is True
                and type(snapshot.get('quiescent')) is bool, 'gemini_rollout_drain_unverified')
        if snapshot['quiescent']:
            return
        require(time.monotonic() < deadline, 'gemini_rollout_drain_timed_out')
        time.sleep(1)


def activate(bundle, digest, expected_release):
    import fcntl
    require(sys.platform == 'linux' and os.geteuid() == 0, 'linux_root_required')
    require(RELEASE.fullmatch(expected_release or ''), 'expected_backend_release_required')
    os.umask(0o077)
    manifest, files = verify_bundle(bundle, digest)
    updater = installed_module(LIB / 'update-backend.py')
    for path in (STATE, UPDATES, LIB, RUNTIME):
        updater.protected(path, directory=True)
    settings_path = UPDATES / 'settings.json'
    receiver_settings_path = UPDATES / 'receiver-settings.json'
    updater.protected(settings_path, mode=0o600)
    updater.protected(receiver_settings_path, mode=0o600)
    settings_raw = read_input(settings_path, 16384)
    receiver_raw = read_input(receiver_settings_path, 16384)
    settings = unique_json(settings_raw)
    receiver_settings = unique_json(receiver_raw)
    pinned_assets(updater, settings)
    pinned_assets(updater, receiver_settings)
    require(RECEIVER in receiver_settings['assets'], 'installed_receiver_pin_missing')
    policy = installed_module(LIB / 'backend_update.py')
    receiver = installed_module(LIB / RECEIVER)
    reviewed_receiver = {'__file__': str(LIB / RECEIVER), '__name__': 'reviewed_gemini_receiver'}
    exec(compile(files[RECEIVER], str(LIB / RECEIVER), 'exec'), reviewed_receiver)
    verify_running_image = reviewed_receiver.get('verify_running_gemini_image')
    require(callable(verify_running_image), 'reviewed_gemini_image_verifier_required')
    gemini = installed_module(RUNTIME / 'gemini-host.py')
    preparer = installed_module(RUNTIME / 'prepare-ai-runtime.py')
    activation = installed_module(RUNTIME / 'activate-ai-runtime.py')
    current = CURRENT.resolve(strict=True)
    initial = receiver.deployment_status()
    require(current.name == expected_release and
            initial.get('current', {}).get('release_id') == expected_release and initial.get('blocked') is False
            and initial.get('application') == {'api_active': True, 'worker_active': True},
            'unexpected_current_backend_release')
    previous_attestation = None
    if ATTESTATION.exists() or ATTESTATION.is_symlink():
        updater.protected(ATTESTATION, mode=0o600)
        previous_attestation = read_input(ATTESTATION, 16384)
        require(initial.get('gemini_runtime') == unique_json(previous_attestation), 'previous_gemini_receipt_unverified')
    tree = manifest['source_tree_sha']
    record = STATE / ('gemini-rollout-' + tree)
    record.mkdir(mode=0o700)
    host = updater.Host(policy, None, settings)
    host.attempt = record
    host.current = current
    host.candidate = current
    host.request = {'operation_id': tree[:32]}
    phase = 'build'
    try:
        image = build_image(preparer, host, record, files[ARCHIVE], manifest['source_sha'])
        with ExitStack() as locks:
            for path in (UPDATES / 'receiver.lock', INSTALL_LOCK):
                require(updater.protected(path, mode=0o600).st_size == 0, 'invalid_gemini_rollout_lock')
                stream = locks.enter_context(path.open('r+b'))
                fcntl.flock(stream.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
            require(receiver.deployment_status() == initial and read_input(settings_path, 16384) == settings_raw
                    and read_input(receiver_settings_path, 16384) == receiver_raw
                    and not updater.MAINTENANCE.exists() and not updater.MAINTENANCE.is_symlink(),
                    'backend_or_maintenance_changed_before_gemini_rollout')
            pinned_assets(updater, receiver_settings)
            old_image = gemini.image_id()
            require(image != old_image, 'gemini_candidate_already_active')
            verify_running_image(old_image)
            for unit in settings['service_hashes']:
                host.service_overrides(unit, host.show(unit))
            host.groups = host.verify_writers(current)
            for name, content in [('before-image.json', gemini.private_file(gemini.CONFIG)),
                                  ('before-receiver.py', read_input(LIB / RECEIVER, 128 * 1024)),
                                  ('before-receiver-settings.json', receiver_raw),
                                  ('intent.json', encoded({'current': initial['current'], 'manifest_sha256': digest,
                                                           'previous_image': old_image, 'candidate_image': image}))]:
                updater.atomic_write(record / name, content)
            if previous_attestation is not None:
                updater.atomic_write(record / 'before-gemini-receipt.json', previous_attestation)
            phase = 'maintenance'
            host.maintenance(True)
            timers = host.pause_timers()
            drain(host)
            phase = 'stop_requested'
            host.stop_writers()
            activation.preflight()
            host.command(['/usr/bin/systemctl', 'stop', 'nodia-gemini.service'], 90)
            stopped = gemini.inspect()
            require(stopped is not None, 'gemini_container_missing_after_stop')
            gemini.validate_existing(stopped, old_image)
            retained = 'nodia-gemini-before-' + tree[:12]
            phase = 'switch_image'
            host.command(['/usr/bin/docker', 'rename', gemini.NAME, retained])
            updater.atomic_write(gemini.CONFIG, encoded({'schema_version': 1, 'source_sha': manifest['source_sha'],
                                                        'image_id': image}))
            host.command(['/usr/bin/systemctl', 'start', 'nodia-gemini.service'], 150)
            gemini.check()
            verify_running_image(image)
            verify_logout_contract(gemini)
            require(CURRENT.resolve(strict=True) == current, 'backend_changed_during_gemini_rollout')
            phase = 'restore_consumers'
            host.command(['/usr/bin/systemctl', 'start', *updater.SERVICES], 220)
            activation.http_smoke()
            host.verify_writers(current)
            host.maintenance(False)
            host.restore_timers(timers)
            phase = 'attest'
            attestation = {'schema_version': 1, 'image_id': image, 'source_sha': manifest['source_sha'],
                           'source_tree_sha': manifest['source_tree_sha']}
            updater.atomic_write(ATTESTATION, encoded(attestation))
            receiver_settings['assets'][RECEIVER] = sha(files[RECEIVER])
            updater.atomic_write(LIB / RECEIVER, files[RECEIVER], 0o644)
            updater.atomic_write(receiver_settings_path, encoded(receiver_settings))
            new_receiver = installed_module(LIB / RECEIVER)
            after = new_receiver.deployment_status()
            require(after.get('current') == initial['current'] and after.get('blocked') is False
                    and after.get('gemini_runtime') == attestation, 'active_gemini_receipt_unverified')
            receipt = {'status': 'gemini_runtime_ready_for_cd', 'gemini_runtime': attestation,
                       'current': after['current'], 'previous_container_retained': retained,
                       'logout_requested': False, 'model_inference_requested': False}
            updater.atomic_write(record / 'complete.json', encoded(receipt))
            return receipt
    except BaseException:
        updater.atomic_write(record / 'failure.json', encoded({'phase': phase, 'preserve_state': True,
                                                              'automatic_retry_allowed': False}))
        raise


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='action', required=True)
    staging = sub.add_parser('package')
    staging.add_argument('--output', type=Path, required=True)
    apply = sub.add_parser('activate')
    apply.add_argument('--execute', action='store_true')
    apply.add_argument('--bundle', type=Path, required=True)
    apply.add_argument('--manifest-sha256', required=True)
    apply.add_argument('--expected-backend-release', required=True)
    args = parser.parse_args()
    if args.action == 'package':
        print(json.dumps(package(args.output)))
    elif args.execute:
        print(json.dumps(activate(args.bundle, args.manifest_sha256, args.expected_backend_release)))
    else:
        print('{"status":"inert","production_writes":0}')


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        code = str(error) if type(error) is ValueError and re.fullmatch(r'[a-z_]{1,100}', str(error)) else 'gemini_rollout_review_required'
        print(json.dumps({'status': 'failed', 'error_code': code, 'automatic_retry_allowed': False}))
        raise SystemExit(1) from None
