"""Stage the reviewed Gemini SDK and its separate, operator-authorized profile."""

from contextlib import contextmanager
import ctypes
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import sys

DOCKER = '/usr/bin/docker'
ARCHIVE_SHA256 = 'a1ba5d679baf96b28c1e0755d0fef362dd4f8dc021a3ef824c9b26cd4f6bd1a6'
ARCHIVE_NAME = 'gemini-sdk-runtime.tar.gz'
IMAGE = re.compile(r'sha256:[a-f0-9]{64}')
ID = re.compile(r'[a-f0-9]{64}')
AUTH_TIMEOUT = 600


def require(condition, code):
    if not condition:
        raise ValueError(code)


def private_directory(path, uid):
    info = path.lstat()
    require(stat.S_ISDIR(info.st_mode) and info.st_uid == info.st_gid == uid
            and stat.S_IMODE(info.st_mode) == 0o700, 'gemini_cv_private_directory_unsafe')
    return info


def absent(path, code):
    try:
        path.lstat()
    except FileNotFoundError:
        return
    raise ValueError(code)


def write_once(path, value):
    with path.open('xb') as target:
        target.write((json.dumps(value, sort_keys=True) + '\n').encode())
        target.flush()
        os.fsync(target.fileno())
    descriptor = os.open(path.parent, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    try:
        os.fsync(descriptor)
    finally:
        os.close(descriptor)


@contextmanager
def lock(record):
    import fcntl
    private_directory(record, 0)
    descriptor = os.open(record / 'lock', os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
    with os.fdopen(descriptor, 'r+b') as stream:
        info = os.fstat(stream.fileno())
        require(stat.S_ISREG(info.st_mode) and info.st_uid == info.st_gid == 0
                and info.st_nlink == 1 and stat.S_IMODE(info.st_mode) == 0o600 and info.st_size == 0,
                'gemini_cv_lock_unsafe')
        fcntl.flock(stream.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        yield


def build_image(preparer, record, base, archive, proof):
    require(IMAGE.fullmatch(base) and hashlib.sha256(archive).hexdigest() == ARCHIVE_SHA256,
            'gemini_cv_public_package_unverified')
    context = record / 'sdk-context'
    context.mkdir(mode=0o700)
    archive_file = context / ARCHIVE_NAME
    with archive_file.open('xb') as target:
        target.write(archive)
    local_tag = 'nodia-gemini-cv-base:' + base.removeprefix('sha256:')
    preparer.command([DOCKER, 'image', 'tag', base, local_tag])
    dockerfile = (
        f'FROM {local_tag}\n'
        'USER 0:0\n'
        # The existing base hands /app to the service UID. The three pinned
        # SDK sources must be root-owned and app code must be immutable.
        'RUN chown -R 0:0 /app && chmod -R go-w /app\n'
        f'ADD --chown=0:0 {ARCHIVE_NAME} {proof.SDK_ROOT}/\n'
        f'ENV NODIA_TEACHER_SDK_ROOT={proof.SDK_ROOT} '
        f'NODIA_TEACHER_SDK_MANIFEST_SHA256={proof.MANIFEST_SHA256}\n'
        'USER 10001:10001\n')
    with (context / 'Dockerfile').open('xb') as target:
        target.write(dockerfile.encode())
    iid = record / 'cv-image.id'
    preparer.command([DOCKER, 'build', '--network=none', '--pull=false', '--iidfile', str(iid),
                      str(context)], 480, record / 'sdk-build.log')
    image = iid.read_text(encoding='ascii').strip()
    require(IMAGE.fullmatch(image), 'gemini_cv_built_image_invalid')
    base_layers = image_layers(preparer, base)
    layers = image_layers(preparer, image)
    require(len(layers) == len(base_layers) + 2 and layers[:len(base_layers)] == base_layers,
            'gemini_cv_base_image_unverified')
    isolated = [DOCKER, 'run', '--rm', '--network=none', '--user=10001:10001', '--read-only',
                '--cap-drop=ALL', '--security-opt=no-new-privileges', '--memory=1g', '--pids-limit=64', image]
    preparer.command([*isolated, '/usr/local/bin/python3', '-I', '-c', proof.MATERIAL,
                      proof.SDK_ROOT, proof.MANIFEST_SHA256], 90, record / 'sdk-tests.log')
    preparer.command([*isolated, proof.SDK_ROOT + '/venv/bin/python3', '-I', '-c',
                      'import google.antigravity, pydantic; assert pydantic.__version__'],
                     90, record / 'sdk-tests.log')
    return image


def image_layers(preparer, image):
    layers = json.loads(preparer.command([DOCKER, 'image', 'inspect', '--format', '{{json .RootFS.Layers}}', image]))
    require(type(layers) is list and layers and all(isinstance(layer, str) and IMAGE.fullmatch(layer) for layer in layers),
            'gemini_cv_image_layers_unverified')
    return layers


def sdk_arguments(image, name, stage, proof, action):
    require(action in ('login', 'observe'), 'gemini_cv_sdk_action_invalid')
    transport = ['--network=host'] if action == 'login' else ['--interactive', '--network=bridge']
    return [DOCKER, 'create', '--name', name, '--init', *transport,
            '--restart=no', '--cgroup-parent=system.slice', '--cgroupns=private',
            '--read-only', '--cap-drop=ALL', '--security-opt=no-new-privileges', '--user=10001:10001',
            '--workdir=/work', '--pids-limit=32', '--memory=512m', '--log-driver=none',
            '--tmpfs=/work:rw,nosuid,nodev,size=268435456,uid=10001,gid=10001,mode=0700',
            '--mount', f'type=bind,src={stage},dst=/profile', '--entrypoint=/usr/bin/env', image,
            '-i', 'HOME=/work', 'USERPROFILE=/work', 'TMPDIR=/work', 'PATH=/usr/local/bin:/usr/bin:/bin',
            'LANG=C.UTF-8', 'PYTHONDONTWRITEBYTECODE=1', proof.SDK_ROOT + '/venv/bin/python3', '-I',
            proof.SDK_ROOT + '/host/teacher_sdk_host.py', '--' + action, '--profile', '/profile',
            '--manifest', proof.SDK_ROOT + '/runtime-manifest.json', '--manifest-sha256', proof.MANIFEST_SHA256]


def closed_login(preparer, image, container):
    require(isinstance(container, str) and ID.fullmatch(container), 'gemini_cv_login_container_unverified')
    template = ('{"id":{{json .Id}},"image":{{json .Image}},"state":{{json .State}},'
                '"log":{{json .HostConfig.LogConfig.Type}},"cgroup":{{json .HostConfig.CgroupParent}}}')
    row = json.loads(preparer.command([DOCKER, 'inspect', '--type=container', '--format', template, container]))
    require(row['id'] == container and row['image'] == image and row['log'] == 'none'
            and row['cgroup'] == 'system.slice', 'gemini_cv_login_container_unverified')
    state = row['state']
    require(state['Status'] == 'exited' and state['Running'] is False and state['Pid'] == 0
            and state['Paused'] is False and state['Restarting'] is False,
            'gemini_cv_login_closure_unverified')
    require(preparer.command([DOCKER, 'wait', container], 5) == str(state['ExitCode']),
            'gemini_cv_login_closure_unverified')
    group = Path('/sys/fs/cgroup/system.slice') / ('docker-' + container + '.scope')
    if group.exists() or group.is_symlink():
        require(stat.S_ISDIR(group.lstat().st_mode), 'gemini_cv_login_cgroup_unverified')
        events = dict(line.split() for line in (group / 'cgroup.events').read_text(encoding='ascii').splitlines())
        require(events.get('populated') == '0', 'gemini_cv_login_cgroup_not_empty')
    return state['ExitCode']


def login(preparer, record, prepared, stage, proof):
    require(all(sys_stream.isatty() for sys_stream in (sys.stdin, sys.stdout, sys.stderr)),
            'gemini_cv_login_requires_private_terminal')
    require(preparer.command([DOCKER, 'info', '--format', '{{.CgroupDriver}} {{.CgroupVersion}}']) == 'systemd 2',
            'gemini_cv_login_cgroup_unverified')
    private_directory(stage.parent, 10001)
    absent(stage, 'gemini_cv_stage_not_fresh')
    absent(proof.PROFILE, 'gemini_cv_profile_already_exists')
    image = prepared['image_id']
    tree = prepared['source_tree_sha']
    write_once(record / 'login-intent.json', prepared)
    stage.mkdir(mode=0o700)
    os.chown(stage, 10001, 10001)
    private_directory(stage, 10001)
    container = preparer.command(sdk_arguments(image, 'nodia-gemini-cv-oauth-' + tree[:12], stage, proof, 'login'))
    require(ID.fullmatch(container), 'gemini_cv_login_container_unverified')
    write_once(record / 'login-container.json', {'container_id': container})
    try:
        # Inherit the operator's private terminal only. No shell, pipe, log or
        # persistent output ever receives Google's PKCE URL.
        result = subprocess.run([DOCKER, 'start', '--attach', container], timeout=AUTH_TIMEOUT, check=False)
    except BaseException:
        preparer.command([DOCKER, 'stop', '--time=5', container], 15)
        closed_login(preparer, image, container)
        raise
    require(closed_login(preparer, image, container) == 0 and result.returncode == 0,
            'gemini_cv_login_failed_requires_review')
    write_once(record / 'login-complete.json', {'container_id': container, 'epoch_sha256': proof.profile_epoch(stage)})
    return {'status': 'gemini_cv_sdk_login_complete', 'model_inference_requested': False}


def verify_profile(preparer, record, prepared, stage, proof):
    private_directory(stage.parent, 10001)
    destination = private_directory(proof.PROFILE.parent, 10001)
    require(private_directory(stage, 10001).st_dev == destination.st_dev, 'gemini_cv_profile_not_atomic')
    absent(proof.PROFILE, 'gemini_cv_profile_already_exists')
    require(proof.unique_json(proof.protected_file(record / 'login-intent.json', 8192)) == prepared,
            'gemini_cv_login_identity_changed')
    login_container = proof.unique_json(proof.protected_file(record / 'login-container.json', 8192))
    receipt = proof.unique_json(proof.protected_file(record / 'login-complete.json', 8192))
    require(type(login_container) is dict and set(login_container) == {'container_id'}
            and type(receipt) is dict and set(receipt) == {'container_id', 'epoch_sha256'}
            and receipt['container_id'] == login_container['container_id']
            and receipt['epoch_sha256'] == proof.profile_epoch(stage)
            and closed_login(preparer, prepared['image_id'], receipt['container_id']) == 0,
            'gemini_cv_login_identity_changed')
    return receipt['epoch_sha256']


def preflight_selection(preparer, prepared, record, stage, proof, model, effort, epoch):
    image = prepared['image_id']
    name = 'nodia-gemini-cv-observe-' + prepared['source_tree_sha'][:12]
    write_once(record / 'selection-intent.json', {'container_name': name, 'image_id': image,
                                                  'model_id': model, 'effort_id': effort})
    container = preparer.command(sdk_arguments(image, name, stage, proof, 'observe'))
    require(ID.fullmatch(container), 'gemini_cv_staged_observation_container_unverified')
    write_once(record / 'selection-container.json', {'container_id': container})
    request = json.dumps({'contract': 'teacher-sdk-host/1', 'model_id': model, 'effort_id': effort}).encode()
    try:
        result = subprocess.run([DOCKER, 'start', '--attach', '--interactive', container],
                                input=request, capture_output=True, timeout=30, check=False)
    except BaseException:
        preparer.command([DOCKER, 'stop', '--time=5', container], 15)
        closed_login(preparer, image, container)
        raise
    require(closed_login(preparer, image, container) == 0
            and result.returncode == 0 and 0 < len(result.stdout) <= 4096,
            'gemini_cv_staged_observation_failed')
    row = proof.unique_json(result.stdout)
    require(type(row) is dict and row.get('contract') == 'teacher-sdk-host/1'
            and row.get('event') == 'observation' and row.get('generative') is False
            and row.get('assets_hash') == proof.MANIFEST_SHA256,
            'gemini_cv_staged_observation_unverified')
    if row.get('authenticated') is False:
        raise ValueError('gemini_cv_staged_session_required')
    if row.get('effort_serializable') is False:
        raise ValueError('gemini_cv_staged_effort_unavailable')
    if row.get('model_present') is False:
        raise ValueError('gemini_cv_staged_model_unavailable')
    require(row.get('authenticated') is True and row.get('effort_serializable') is True
            and row.get('model_present') is True and row.get('reason') == 'observed'
            and proof.profile_epoch(stage) == epoch, 'gemini_cv_staged_observation_unverified')


def publish_profile(stage, proof, epoch):
    absent(proof.PROFILE, 'gemini_cv_profile_already_exists')
    # Atomically require an absent destination, including against a concurrent
    # creation of an empty SDK directory.
    rename = ctypes.CDLL(None, use_errno=True).renameat2
    rename.argtypes = (ctypes.c_int, ctypes.c_char_p, ctypes.c_int, ctypes.c_char_p, ctypes.c_uint)
    rename.restype = ctypes.c_int
    require(rename(-100, os.fsencode(stage), -100, os.fsencode(proof.PROFILE), 1) == 0,
            'gemini_cv_profile_publish_failed')
    for directory in (stage.parent, proof.PROFILE.parent):
        descriptor = os.open(directory, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
        try:
            os.fsync(descriptor)
        finally:
            os.close(descriptor)
    require(proof.profile_epoch() == epoch, 'gemini_cv_profile_publish_unverified')
