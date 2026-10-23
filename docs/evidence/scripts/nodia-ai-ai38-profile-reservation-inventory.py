"""Read-only live runtime/public-source inventory for profile reservation diagnosis.

Does not call an endpoint, import application modules, inspect process memory,
open profile/login/session/token files, dispatch inference or change services.
"""
from datetime import datetime, timezone
import hashlib
import importlib.util
import json
from pathlib import Path
import subprocess

EXPECTED_IMAGE = 'sha256:b8efad6217a4f04cb135db027fd899c1826b39c3a16154cca79f1b4f0deb977e'
HELPER = Path('/tmp/nodia-ai-ai38-journal-activate.py')
HELPER_SHA = '56fb7fc00dd4e741e924cef6eee69527543aab4407adeed776a5cfb08aff016b'
CONTAINER = 'nodia-gemini-microservice'


def checked(argv, timeout=30):
    result = subprocess.run(argv, capture_output=True, timeout=timeout, check=False)
    if result.returncode:
        raise ValueError('readonly_command_failed')
    return result.stdout


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True).encode()).hexdigest()


def inspect():
    return json.loads(checked(['docker', 'inspect', CONTAINER]))[0]


before = inspect()
if not before['State']['Running'] or before['Image'] != EXPECTED_IMAGE:
    raise ValueError('unexpected_runtime_image_or_state')
source_program = """import hashlib,json,pathlib
root=pathlib.Path('/app')
files={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(root.glob('*.py')) if p.is_file() and not p.is_symlink()}
print(json.dumps({'public_python_hashes':files,'count':len(files),'application_modules_imported':False,'profile_session_login_bytes_opened':False}))
"""
sources = json.loads(checked(['docker', 'exec', '--user', '10001:10001', CONTAINER,
                             'python', '-B', '-c', source_program]))
if not sources['public_python_hashes'] or any('/' in name or not name.endswith('.py') for name in sources['public_python_hashes']):
    raise ValueError('unexpected_public_source_inventory')
if hashlib.sha256(HELPER.read_bytes()).hexdigest() != HELPER_SHA:
    raise ValueError('helper_pin_mismatch')
spec = importlib.util.spec_from_file_location('pinned_journal_activation', HELPER)
a = importlib.util.module_from_spec(spec)
spec.loader.exec_module(a)
_, h = a.load_helpers()
a.RELEASE = Path('/opt/nodia/releases/nodia-server-ai38-owner-r01')
consumers = a.active_new_processes()
quiet = h['quiet']()
journal = a.journal('status')
after = inspect()
if any(before[key] != after[key] for key in ('Id', 'Image')) or before['State']['StartedAt'] != after['State']['StartedAt']:
    raise ValueError('runtime_epoch_changed_while_observing')
operational_descriptors = {key: before['HostConfig'][key] for key in (
    'PortBindings', 'Memory', 'NanoCpus', 'Tmpfs', 'RestartPolicy', 'NetworkMode', 'PidsLimit', 'SecurityOpt')}
print(json.dumps(dict(scope='read_only_profile_reservation_runtime_inventory_not_holder_attribution',
    status='observed', observed_at_VM_utc=datetime.now(timezone.utc).isoformat(),
    source_sha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
    runtime=dict(container_id=before['Id'], image_id=before['Image'],
                 started_at_utc=before['State']['StartedAt'], running=True,
                 configured_user=before['Config']['User'], mounts_count=len(before['Mounts']),
                 mounts_sha256=digest(before['Mounts']),
                 environment_sha256=digest(sorted(before['Config']['Env'])),
                 resource_and_network_descriptor_sha256=digest(operational_descriptors),
                 source_bind_mount_present=any(m['Destination'] == '/app' for m in before['Mounts']),
                 same_epoch_after_observation=True),
    public_sources=sources, consumers=consumers, quiet=quiet, external_journal_status=journal,
    live_ProfileAdmission_holder='unknown_not_exposed_by_current_runtime_contract',
    current_holder_reconstructed_from_logs=False, HTTP_requests=0, provider_requests=0,
    configured_SQL_writes=0, profile_session_login_bytes_opened=False, process_memory_accessed=False,
    services_restarted=False, VM_configuration_changes=0), indent=2))
