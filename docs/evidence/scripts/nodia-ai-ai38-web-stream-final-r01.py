"""Read-only final runtime/package/quiet inventory, never calls provider endpoints.

Run only after all live UI/MCP/modality trials are complete. Public Python and
installed distribution metadata are hashed without importing application code.
No session/profile/login bytes, process memory or raw environment are emitted.
"""
from datetime import datetime, timezone
import hashlib
import importlib.util
import json
import os
from pathlib import Path, PurePosixPath
import subprocess

HELPER = Path('/tmp/nodia-ai-ai38-journal-activate.py')
HELPER_SHA = '56fb7fc00dd4e741e924cef6eee69527543aab4407adeed776a5cfb08aff016b'
SERVER = Path('/opt/nodia/releases/nodia-server-ai38-owner-r01')
SERVER_SHA = '4c3fe6d600adab362a71c5f76357383e98aa7acda7c93aa73e61bfb29c626f92'
PLAN = Path('/tmp/nodia-ai-ai38-web-stream-adopt-plan-r01.json')
PLAN_SHA = 'c96136a04543d8ec799f381e2604f239660c9f1339d0338755979b0a4f1df416'
BUILD = Path('/opt/nodia/verification/ai38-web-stream-diag-build-r01/report.json')
BUILD_SHA = 'ca901c51a784d0680065aa1fb16a7ca8d2ff87ed8bcaefa656cf75a3ca8a09a6'
EXPECTED_EPOCH = dict(id='b20db84410938175ca00002b56ec3fef9b894af1399413b2fabbbbd36bcfab96',
    image='sha256:985ba983fec5789671ceaa53c98103fbbf5b81c07938e6d10b2099034e2c0306',
    started_at='2026-10-22T21:25:38.245485678Z')


def require(ok, code):
    if not ok:
        raise ValueError(code)


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True).encode()).hexdigest()


def command(argv):
    result = subprocess.run(argv, capture_output=True, timeout=35, check=False)
    require(result.returncode == 0, 'readonly_command_failed')
    return result.stdout


def inspect():
    value = json.loads(command(['docker', 'inspect', 'nodia-gemini-microservice']))[0]
    require(value['State']['Running'], 'container_not_running')
    observed = dict(id=value['Id'], image=value['Image'], started_at=value['State']['StartedAt'])
    require(observed == EXPECTED_EPOCH, 'unexpected_final_native_epoch')
    return value


def main():
    require(os.geteuid() == 0 and not os.sys.flags.optimize, 'root_unoptimized_python_required')
    for path, pin in ((HELPER, HELPER_SHA), (PLAN, PLAN_SHA), (BUILD, BUILD_SHA),
                      (SERVER / 'release-manifest.json', SERVER_SHA)):
        require(sha(path) == pin, 'pinned_source_or_receipt_changed')
    plan, build = json.loads(PLAN.read_bytes()), json.loads(BUILD.read_bytes())
    require(plan['phase'] == 'diag' and build['status'] == 'passed' and
            plan['target_image_id'] == EXPECTED_EPOCH['image'] and
            plan['target_python_hashes'] == build['target_public_python_hashes'] and
            set(plan['changed_python_files']) == {'web_generation_diagnostics.py', 'web_stream_frame_diagnostics.py'}, 'Web_diagnostic_plan_or_build_mismatch')
    manifest = json.loads((SERVER / 'release-manifest.json').read_bytes())
    require(manifest['knowledge_release'] == '4189005373b4e6040a0e441d21c2978fe1d423ae568e53f74df1592e6f900130',
            'knowledge_release_changed')
    for name, pin in manifest['files'].items():
        relative = PurePosixPath(name)
        require(not relative.is_absolute() and '..' not in relative.parts and '\\' not in name, 'unsafe_manifest_member')
        target = SERVER / relative
        require(target.is_file() and not target.is_symlink() and target.resolve().is_relative_to(SERVER) and
                sha(target) == pin, 'Server_member_changed')
    actual = set()
    for current, folders, files in os.walk(SERVER, followlinks=False):
        folder = Path(current)
        for name in tuple(folders):
            child = folder / name
            if child == SERVER / 'node_modules':
                folders.remove(name)
                require(child.is_symlink() and child.resolve() == Path('/opt/nodia/nodia-server/node_modules').resolve(),
                        'Server_dependency_link_changed')
            else:
                require(not child.is_symlink(), 'Server_unlisted_directory_link')
        for name in files:
            child = folder / name
            require(child.is_file() and not child.is_symlink(), 'Server_unlisted_special_file')
            actual.add(child.relative_to(SERVER).as_posix())
    require(actual == set(manifest['files']) | {'release-manifest.json'}, 'Server_full_inventory_changed')
    before = inspect()
    program = """import hashlib,json,pathlib,importlib.metadata
r=pathlib.Path('/app');packages=sorted((d.metadata['Name'],d.version) for d in importlib.metadata.distributions())
print(json.dumps({'public_python_hashes':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in r.glob('*.py') if p.is_file() and not p.is_symlink()},'requirements_sha256':hashlib.sha256((r/'requirements.txt').read_bytes()).hexdigest(),'distribution_inventory':packages,'distribution_count':len(packages),'application_modules_imported':False,'profile_or_session_bytes_opened':False}))
"""
    native = json.loads(command(['docker', 'exec', '--user', '10001:10001', 'nodia-gemini-microservice', 'python', '-B', '-c', program]))
    require(native['public_python_hashes'] == plan['target_python_hashes'] and len(native['public_python_hashes']) == 48 and
            native['requirements_sha256'] == build['baseline_requirements_sha256'] and
            native['distribution_inventory'] == build['baseline_distribution_inventory'] and
            native['distribution_count'] == build['baseline_distribution_count'], 'final_native_sources_or_dependencies_changed')
    spec = importlib.util.spec_from_file_location('pinned_final_activation', HELPER)
    a = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(a)
    a.RELEASE = SERVER
    _, h = a.load_helpers()
    consumers = a.active_new_processes()
    quiet = h['quiet']()
    schema = h['schema_and_selection']()
    operator = a.operator_configuration()
    journal = a.journal('status')
    require(journal['coverage_from'] == '2026-10-20T23:52:27.154Z' and journal['coverage_closed_at'] is None and
            journal['unconfirmed'] == journal['expired_backups'] == 0, 'external_journal_not_ready')
    timers = {u: a.state(u) for u in a.TIMERS}
    require(all(value['active'] == 'active' for value in timers.values()), 'backup_timer_not_active')
    oneshots = {u: a.state(u) for u in ('nodia-ai-backup', 'nodia-ai-backup-rotate')}
    require(sha(a.NGINX) == a.NGINX_SHA, 'base_nginx_descriptor_not_restored')
    after = inspect()
    require((before['Id'], before['Image'], before['State']['StartedAt']) ==
            (after['Id'], after['Image'], after['State']['StartedAt']), 'native_epoch_changed_during_inventory')
    return dict(schema='ai38-web-stream-final-v1', status='observed_read_only',
        observed_at_VM_utc=datetime.now(timezone.utc).isoformat(), source_sha256=sha(Path(__file__)),
        server_manifest_sha256=SERVER_SHA, server_members=len(manifest['files']),
        dist_outputs=sum(name.startswith('dist/') for name in manifest['files']),
        knowledge_release=manifest['knowledge_release'], consumers=consumers,
        Gemini=dict(**EXPECTED_EPOCH, configured_user=before['Config']['User'], mounts_count=len(before['Mounts']),
            mounts_sha256=digest(before['Mounts']), environment_sha256=digest(sorted(before['Config']['Env'])),
            same_epoch_after_inventory=True), native_public_source_hashes=native['public_python_hashes'],
        native_public_source_count=len(native['public_python_hashes']), requirements_sha256=native['requirements_sha256'],
        distribution_inventory=native['distribution_inventory'], distribution_count=native['distribution_count'],
        Web_diagnostic_plan_sha256=PLAN_SHA, Web_diagnostic_build_receipt_sha256=BUILD_SHA, quiet=quiet,
        SQL_schema_and_selection=schema, operator_configuration=operator, external_status=journal,
        timers=timers, oneshots=oneshots, nginx_sha256=sha(a.NGINX),
        configured_SQL_writes=0, native_HTTP_requests=0, provider_generation_requests=0,
        external_journal_read_calls_not_counted=True, storage_mutations=0, service_changes=0,
        operational_profile_or_login_bytes_opened=False)


if __name__ == '__main__':
    try:
        print(json.dumps(main(), indent=2))
    except Exception:
        print(json.dumps(dict(schema='ai38-web-stream-final-v1', status='failed_observation',
                              raw_secrets_or_details_emitted=False)))
        raise SystemExit(1)
