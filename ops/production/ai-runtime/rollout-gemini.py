"""Package and activate a reviewed Gemini adapter and its optional CV SDK."""
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
SDK_ARCHIVE = 'gemini-sdk-runtime.tar.gz'
SDK_PROOF = 'gemini-sdk-proof.py'
SDK_STAGER = 'gemini-sdk-rollout.py'
SDK_ARCHIVE_SHA256 = 'a1ba5d679baf96b28c1e0755d0fef362dd4f8dc021a3ef824c9b26cd4f6bd1a6'
SDK_FILES = {SDK_ARCHIVE, SDK_PROOF, SDK_STAGER}
SDK_ARCHIVE_LIMIT = 60 * 1024 ** 2
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


def package(output, cv_sdk_archive=None):
    repo = Path(__file__).resolve().parents[3]
    output = output.resolve()
    require(any(output.is_relative_to(repo / name) for name in ('.tmp', 'output'))
            and not output.exists(), 'new_ignored_output_required')
    git = lambda *args: subprocess.check_output(['git', '-C', str(repo), *args])
    tracked = ('nodia-gemini-microservice', 'ops/production/' + RECEIVER,
               'ops/production/ai-runtime/' + OPERATOR)
    if cv_sdk_archive is not None:
        tracked += tuple('ops/production/ai-runtime/' + name for name in (SDK_PROOF, SDK_STAGER))
    require(not git('status', '--porcelain', '--', *tracked).strip(), 'rollout_sources_must_be_committed')
    source = git('rev-parse', 'HEAD').decode().strip()
    tree = git('rev-parse', source + ':nodia-gemini-microservice').decode().strip()
    native_source(source, tree)
    files = {ARCHIVE: git('archive', '--format=tar.gz', source + ':nodia-gemini-microservice'),
             RECEIVER: git('show', source + ':' + tracked[1]),
             OPERATOR: git('show', source + ':' + tracked[2])}
    if cv_sdk_archive is not None:
        files[SDK_ARCHIVE] = read_input(cv_sdk_archive, SDK_ARCHIVE_LIMIT)
        require(sha(files[SDK_ARCHIVE]) == SDK_ARCHIVE_SHA256, 'gemini_cv_public_package_unverified')
        for name, path in zip((SDK_PROOF, SDK_STAGER), tracked[3:], strict=True):
            files[name] = git('show', source + ':' + path)
    manifest = encoded({'schema_version': 2 if cv_sdk_archive is not None else 1, 'source_sha': source, 'source_tree_sha': tree,
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
            and type(data['schema_version']) is int and data['schema_version'] in (1, 2)
            and type(data['files']) is dict,
            'rollout_manifest_invalid')
    expected_names = {RECEIVER, ARCHIVE, OPERATOR}
    if data['schema_version'] == 2:
        expected_names |= SDK_FILES
    require(set(data['files']) == expected_names, 'rollout_manifest_invalid')
    native_source(data['source_sha'], data['source_tree_sha'])
    limits = {ARCHIVE: 12 * 1024 ** 2, SDK_ARCHIVE: SDK_ARCHIVE_LIMIT}
    files = {name: read_input(bundle / name, limits.get(name, 128 * 1024))
             for name in data['files']}
    require(all(sha(content) == data['files'][name] for name, content in files.items()), 'rollout_bundle_hash_mismatch')
    require(read_input(Path(__file__), 128 * 1024) == files[OPERATOR], 'executed_operator_differs_from_bundle')
    compile(files[RECEIVER], str(LIB / RECEIVER), 'exec')
    if data['schema_version'] == 2:
        require(sha(files[SDK_ARCHIVE]) == SDK_ARCHIVE_SHA256, 'gemini_cv_public_package_unverified')
        proof_pins = re.findall(rb"^GEMINI_CV_SDK_PROOF_SHA256 = '([a-f0-9]{64})'$",
                                files[RECEIVER], re.MULTILINE)
        require(proof_pins == [sha(files[SDK_PROOF]).encode()], 'gemini_cv_receiver_proof_pin_mismatch')
        for name in (SDK_PROOF, SDK_STAGER):
            compile(files[name], str(RUNTIME / name), 'exec')
    return data, files


def reviewed_module(name, raw):
    from types import ModuleType
    module = ModuleType(name.removesuffix('.py').replace('-', '_'))
    module.__file__ = str(RUNTIME / name)
    exec(compile(raw, module.__file__, 'exec'), vars(module))
    return module


def sdk_staging(manifest, files, gemini):
    require(manifest.get('schema_version') == 2, 'gemini_cv_sdk_bundle_required')
    tree = manifest['source_tree_sha']
    return (reviewed_module(SDK_STAGER, files[SDK_STAGER]), reviewed_module(SDK_PROOF, files[SDK_PROOF]),
            STATE / ('gemini-cv-prepared-' + tree), gemini.STATE / ('cv-sdk-auth-' + tree))


def sdk_preparation(manifest, proof, record, digest):
    value = proof.unique_json(proof.protected_file(record / 'prepared.json', 8192))
    require(type(value) is dict and set(value) == {'schema_version', 'manifest_sha256', 'source_tree_sha',
            'source_sha', 'image_id', 'base_image_id', 'current', 'previous_image'}
            and value['schema_version'] == 1 and value['manifest_sha256'] == digest
            and value['source_tree_sha'] == manifest['source_tree_sha'] and value['source_sha'] == manifest['source_sha']
            and type(value['current']) is dict and RELEASE.fullmatch(value['current'].get('release_id', ''))
            and all(isinstance(value[key], str) and IMAGE.fullmatch(value[key])
                    for key in ('image_id', 'base_image_id', 'previous_image'))
            and value['image_id'] not in (value['base_image_id'], value['previous_image']),
            'gemini_cv_preparation_changed')
    return value


def stage_cv(bundle, digest, expected_release=None):
    require(sys.platform == 'linux' and os.geteuid() == 0, 'linux_root_required')
    os.umask(0o077)
    manifest, files = verify_bundle(bundle, digest)
    updater = installed_module(LIB / 'update-backend.py')
    for directory in (STATE, UPDATES, LIB, RUNTIME):
        updater.protected(directory, directory=True)
    gemini = installed_module(RUNTIME / 'gemini-host.py')
    preparer = installed_module(RUNTIME / 'prepare-ai-runtime.py')
    stager, proof, record, stage = sdk_staging(manifest, files, gemini)
    if expected_release is None:
        with stager.lock(record):
            prepared = sdk_preparation(manifest, proof, record, digest)
            require(CURRENT.resolve(strict=True).name == prepared['current']['release_id']
                    and gemini.image_id() == prepared['previous_image'],
                    'current_runtime_changed_before_gemini_cv_login')
            return stager.login(preparer, record, prepared, stage, proof)
    require(RELEASE.fullmatch(expected_release), 'expected_backend_release_required')
    stager.absent(proof.PROFILE, 'gemini_cv_profile_already_exists')
    stager.absent(proof.RECORD, 'gemini_cv_proof_already_exists')
    stager.absent(RUNTIME / SDK_PROOF, 'gemini_cv_proof_helper_already_exists')
    stager.absent(stage, 'gemini_cv_stage_not_fresh')
    receiver = installed_module(LIB / RECEIVER)
    initial = receiver.deployment_status()
    require(CURRENT.resolve(strict=True).name == expected_release
            and initial.get('current', {}).get('release_id') == expected_release
            and initial.get('blocked') is False
            and initial.get('application') == {'api_active': True, 'worker_active': True},
            'unexpected_current_backend_release')
    old_image = gemini.image_id()
    policy = installed_module(LIB / 'backend_update.py')
    host = updater.Host(policy, None, {})
    record.mkdir(mode=0o700)
    with stager.lock(record):
        base_image = build_image(preparer, host, record, files[ARCHIVE], manifest['source_sha'])
        image = stager.build_image(preparer, record, base_image, files[SDK_ARCHIVE], proof)
        require(receiver.deployment_status() == initial and gemini.image_id() == old_image,
                'current_runtime_changed_during_gemini_cv_preparation')
        binding = {'schema_version': 1, 'manifest_sha256': digest, 'source_sha': manifest['source_sha'],
                   'source_tree_sha': manifest['source_tree_sha'], 'image_id': image, 'base_image_id': base_image,
                   'current': initial['current'], 'previous_image': old_image}
        stager.write_once(record / 'prepared.json', binding)
    return {'status': 'gemini_cv_sdk_prepared', 'current': initial['current'], 'image_id': image,
            'login_requested': False, 'model_inference_requested': False}


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


def activate(bundle, digest, expected_release, model_id=None, effort_id=None):
    import fcntl
    require(sys.platform == 'linux' and os.geteuid() == 0, 'linux_root_required')
    require(RELEASE.fullmatch(expected_release or ''), 'expected_backend_release_required')
    os.umask(0o077)
    manifest, files = verify_bundle(bundle, digest)
    cv_sdk = manifest.get('schema_version') == 2
    if cv_sdk:
        require(re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9._:/-]{0,255}', model_id or '')
                and re.fullmatch(r'[a-z][a-z0-9_-]{0,31}', effort_id or ''), 'gemini_cv_exact_selection_required')
    else:
        require(model_id is None and effort_id is None, 'gemini_cv_sdk_bundle_required')
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
    if cv_sdk:
        stager, proof, prepared_record, stage = sdk_staging(manifest, files, gemini)
        stager.absent(proof.RECORD, 'gemini_cv_proof_already_exists')
        stager.absent(RUNTIME / SDK_PROOF, 'gemini_cv_proof_helper_already_exists')
    else:
        sdk_record = STATE / 'gemini-cv-sdk-current.json'
        require(not sdk_record.exists() and not sdk_record.is_symlink(), 'existing_gemini_cv_requires_sdk_rollout')
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
        if not cv_sdk:
            image = build_image(preparer, host, record, files[ARCHIVE], manifest['source_sha'])
        phase = 'preflight'
        with ExitStack() as locks:
            if cv_sdk:
                locks.enter_context(stager.lock(prepared_record))
                prepared = sdk_preparation(manifest, proof, prepared_record, digest)
                require(prepared['current'] == initial['current'], 'backend_changed_since_gemini_cv_preparation')
                image = prepared['image_id']
                epoch = stager.verify_profile(preparer, prepared_record, prepared, stage, proof)
                stager.absent(proof.RECORD, 'gemini_cv_proof_already_exists')
                stager.absent(RUNTIME / SDK_PROOF, 'gemini_cv_proof_helper_already_exists')
                phase = 'observe_staged_sdk'
                stager.preflight_selection(preparer, prepared, record, stage, proof, model_id, effort_id, epoch)
                phase = 'preflight'
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
            if cv_sdk:
                require(old_image == prepared['previous_image'], 'gemini_changed_since_cv_preparation')
                stager.image_layers(preparer, image)
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
            if cv_sdk:
                phase = 'publish_sdk_profile'
                stager.publish_profile(stage, proof, epoch)
            phase = 'switch_image'
            host.command(['/usr/bin/docker', 'rename', gemini.NAME, retained])
            updater.atomic_write(gemini.CONFIG, encoded({'schema_version': 1, 'source_sha': manifest['source_sha'],
                                                        'image_id': image}))
            host.command(['/usr/bin/systemctl', 'start', 'nodia-gemini.service'], 150)
            gemini.check()
            verify_running_image(image)
            verify_logout_contract(gemini)
            require(CURRENT.resolve(strict=True) == current, 'backend_changed_during_gemini_rollout')
            attestation = {'schema_version': 1, 'image_id': image, 'source_sha': manifest['source_sha'],
                           'source_tree_sha': manifest['source_tree_sha']}
            if cv_sdk:
                phase = 'observe_sdk'
                sdk_attestation = proof.capture_attestation(attestation, model_id, effort_id)
                require(sdk_attestation['epoch_sha256'] == epoch, 'gemini_cv_published_session_changed')
                updater.atomic_write(record / 'gemini-cv-sdk-observation.json', encoded(sdk_attestation))
            phase = 'restore_consumers'
            host.command(['/usr/bin/systemctl', 'start', *updater.SERVICES], 220)
            activation.http_smoke()
            host.verify_writers(current)
            host.maintenance(False)
            host.restore_timers(timers)
            phase = 'attest'
            if cv_sdk:
                updater.atomic_write(RUNTIME / SDK_PROOF, files[SDK_PROOF], 0o644)
                updater.atomic_write(proof.RECORD, encoded(sdk_attestation))
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
            if cv_sdk:
                require(after.get('gemini_cv_sdk') == sdk_attestation['receipt'], 'active_gemini_cv_receipt_unverified')
                receipt['gemini_cv_sdk'] = sdk_attestation['receipt']
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
    staging.add_argument('--cv-sdk-archive', type=Path)
    prepare = sub.add_parser('prepare-cv')
    login = sub.add_parser('login-cv')
    apply = sub.add_parser('activate')
    for action in (prepare, login, apply):
        action.add_argument('--execute', action='store_true')
        action.add_argument('--bundle', type=Path, required=True)
        action.add_argument('--manifest-sha256', required=True)
    for action in (prepare, apply):
        action.add_argument('--expected-backend-release', required=True)
    apply.add_argument('--model-id')
    apply.add_argument('--effort-id')
    args = parser.parse_args()
    if args.action == 'package':
        print(json.dumps(package(args.output, args.cv_sdk_archive)))
    elif args.execute:
        if args.action == 'activate':
            result = activate(args.bundle, args.manifest_sha256, args.expected_backend_release, args.model_id, args.effort_id)
        else:
            result = stage_cv(args.bundle, args.manifest_sha256, getattr(args, 'expected_backend_release', None))
        print(json.dumps(result))
    else:
        print('{"status":"inert","production_writes":0}')


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        code = str(error) if type(error) is ValueError and re.fullmatch(r'[a-z_]{1,100}', str(error)) else 'gemini_rollout_review_required'
        print(json.dumps({'status': 'failed', 'error_code': code, 'automatic_retry_allowed': False}))
        raise SystemExit(1) from None
