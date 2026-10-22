"""Read-only phase-specific AI-38 runtime and static-proxy inspection.

No application imports, service changes, provider observations/generation or
authentication reads. Selected pinned R03 helpers are loaded via AST, never its
entry point or mutation helpers. Run only on the reviewed VM as root.
"""
import argparse
import ast
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request


ORIGINAL = Path('/opt/nodia/releases/nodia-server-ai15-20261016')
SERVER = Path('/opt/nodia/releases/nodia-server-ai38-candidate01')
CLIENT = Path('/opt/nodia/releases/nodia-client-ai38-candidate01')
R03_SHA256 = '703a068c6dcd1089b12c0961646d4768bc916d7b56c908ba389d902f2c4e2bee'
SERVER_MANIFEST_SHA = '0751160bb8cb146acec9dda21daa0226875a2c40f1c898a9c649e69a9583b8e3'
CLIENT_MANIFEST_SHA = '0c54fcafebe607a661b169288daa92fe12ca7110278d94eac9160478214ee49b'
ORIGINAL_MANIFEST_SHA = 'bd07328b490756cb63a3054e44161d7e9c36d14e38b5acfe841cdb963024e792'
NATIVE_KEYS = ('unknown_markers', 'armed_native_proofs', 'terminal_native_proofs', 'invalid_native_proofs',
               'temporary_attachment_directories', 'temporary_cli_directories')
SQL_KEYS = ('pending_jobs', 'open_attempts', 'retained_slots')
FENCE_TAG = 'nodia-ai38-adoption-r01-only'
UNITS = ('nodia-api', 'nodia-ai-worker', 'nodia-gemini-lab', 'nginx')
HELPERS = {'sha', 'digest', 'checked', 'fence_arguments', 'fence_present', 'native_epoch',
           'quiet', 'schema_and_selection', 'original_files', 'validate_manifest'}


def pinned_readonly_helpers(filename):
    payload = Path(filename).read_bytes()
    if hashlib.sha256(payload).hexdigest() != R03_SHA256:
        raise ValueError('adoption_R03_source_pin_mismatch')
    tree = ast.parse(payload)
    selected = [node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name in HELPERS]
    if {node.name for node in selected} != HELPERS or len(selected) != len(HELPERS):
        raise ValueError('readonly_helper_set_mismatch')
    namespace = {'Path': Path, 'PurePosixPath': PurePosixPath, 'hashlib': hashlib, 'json': json,
                 'subprocess': subprocess, 'ORIGINAL': ORIGINAL, 'ORIGINAL_MANIFEST_SHA': ORIGINAL_MANIFEST_SHA,
                 'NATIVE_KEYS': NATIVE_KEYS, 'SQL_KEYS': SQL_KEYS, 'FENCE_TAG': FENCE_TAG}
    exec(compile(ast.Module(body=selected, type_ignores=[]), 'pinned-readonly-R03-helpers', 'exec'), namespace)
    return namespace


def unit_processes(helpers, phase):
    selected = {}
    for name in UNITS:
        raw = helpers['checked'](['systemctl', 'show', name, '--no-pager',
                                  '--property=ActiveState,SubState,MainPID,WorkingDirectory'])
        info = dict(line.split('=', 1) for line in raw.decode().splitlines() if '=' in line)
        if info['ActiveState'] != 'active':
            raise ValueError('required_unit_not_active')
        pid = int(info['MainPID'])
        value = {'active_state': info['ActiveState'], 'sub_state': info['SubState'], 'MainPID': pid,
                 'systemd_WorkingDirectory': info['WorkingDirectory']}
        if name in UNITS[:2]:
            expected_root = SERVER if phase == 'candidate' else ORIGINAL
            entry = 'main.js' if name == 'nodia-api' else 'nodia-ai-worker.js'
            expected_entry = str(SERVER / 'dist' / entry) if phase == 'candidate' else 'dist/' + entry
            if pid <= 0:
                raise ValueError('required_consumer_PID_missing')
            proc = Path('/proc') / str(pid)
            cwd = Path(os.readlink(proc / 'cwd'))
            argv = (proc / 'cmdline').read_bytes().rstrip(b'\0').split(b'\0')
            exact = argv == [b'/usr/local/bin/node', expected_entry.encode()]
            if not exact or cwd != expected_root or Path(info['WorkingDirectory']) != expected_root:
                raise ValueError('effective_consumer_identity_mismatch')
            # Never emit arbitrary argv: expected values below are fixed constants.
            value.update({'cwd': str(cwd), 'expected_node_command': '/usr/local/bin/node',
                          'expected_entrypoint': expected_entry, 'argv_exact_match': exact,
                          'expectedentrypointmatch': True,
                          'process_executable': os.readlink(proc / 'exe'),
                          'entrypoint_sha256': helpers['sha'](expected_root / 'dist' / entry)})
        selected[name] = value
    return selected


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise ValueError('unexpected_static_HTTP_redirect')


def static_http(opener, pathname, max_bytes):
    if not pathname.startswith('/') or '?' in pathname or '#' in pathname or '..' in PurePosixPath(pathname).parts:
        raise ValueError('unsafe_static_probe_path')
    url = 'http://127.0.0.1:8080' + urllib.parse.quote(pathname, safe='/.-_')
    try:
        with opener.open(urllib.request.Request(url, headers={'Cache-Control': 'no-cache'}), timeout=5) as response:
            body = response.read(max_bytes + 1)
            if len(body) > max_bytes:
                raise ValueError('static_response_larger_than_expected')
            return {'status': response.status, 'sha256': hashlib.sha256(body).hexdigest(),
                    'bytes': len(body), 'COOP': response.headers.get('Cross-Origin-Opener-Policy')}
    except urllib.error.HTTPError as error:
        return {'status': error.code, 'sha256': None, 'bytes': None, 'COOP': None}


def inspect_proxy(helpers, phase):
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())
    root = static_http(opener, '/', 1024 * 1024)
    api = static_http(opener, '/api/v1', 64 * 1024)
    if api['status'] != 200:
        raise ValueError('API_root_not_200')
    if phase == 'original':
        if root['status'] != 404:
            raise ValueError('original_root_not_404')
        return {'root': root, 'API_root': api, 'HTTP_requests': 2,
                'served_Client_acceptance': False, 'authenticated_API_acceptance': False}
    manifest = helpers['validate_manifest'](CLIENT, CLIENT_MANIFEST_SHA)
    members = [(name, pin) for name, pin in manifest['files'].items() if name.startswith('dist/')]
    if len(members) != 171:
        raise ValueError('Client_output_count_changed')
    expected_index = manifest['files']['dist/index.html']
    if root['status'] != 200 or root['sha256'] != expected_index or root['COOP'] != 'same-origin-allow-popups':
        raise ValueError('candidate_root_or_COOP_mismatch')
    deep = static_http(opener, '/tools/nodia-ai', 1024 * 1024)
    if deep['status'] != 200 or deep['sha256'] != expected_index or deep['COOP'] != 'same-origin-allow-popups':
        raise ValueError('candidate_SPA_deep_link_mismatch')
    served = []
    for name, pin in sorted(members):
        pathname = '/' + str(PurePosixPath(name).relative_to('dist'))
        local_size = (CLIENT / name).stat().st_size
        observation = static_http(opener, pathname, local_size)
        if observation['status'] != 200 or observation['sha256'] != pin or observation['bytes'] != local_size:
            raise ValueError('served_Client_member_mismatch')
        if observation['COOP'] != 'same-origin-allow-popups':
            raise ValueError('served_Client_COOP_mismatch')
        served.append({'path': pathname, **observation})
    return {'root': root, 'API_root': api, 'SPA_deep_link': deep, 'HTTP_requests': 174,
            'served_outputs': len(served), 'all_served_bytes_match_frozen_Client': True, 'members': served,
            'authenticated_UI_or_API_acceptance': False}


def inspect(args):
    if os.geteuid() != 0:
        raise ValueError('root_readonly_inspection_required')
    helpers = pinned_readonly_helpers(args.adoption_script)
    started = datetime.now(timezone.utc).isoformat()
    units = unit_processes(helpers, args.phase)
    original_sha = helpers['original_files']()  # Frozen original path, even while candidate is active.
    fences = {name: helpers['fence_present']('/usr/sbin/' + name) for name in ('iptables', 'ip6tables')}
    if any(value != (args.phase == 'candidate') for value in fences.values()):
        raise ValueError('phase_fence_expectation_mismatch')
    epoch = helpers['native_epoch']()
    quiet_before = helpers['quiet']()
    SQL = helpers['schema_and_selection']()
    candidate = None
    if args.phase == 'candidate':
        manifest = helpers['validate_manifest'](SERVER, SERVER_MANIFEST_SHA)
        candidate = {'root': str(SERVER), 'manifest_sha256': SERVER_MANIFEST_SHA,
                     'manifest_members': len(manifest['files']),
                     'dist_outputs': len([name for name in manifest['files'] if name.startswith('dist/')])}
        if candidate['dist_outputs'] != 2827:
            raise ValueError('candidate_Server_output_count_changed')
    proxy = inspect_proxy(helpers, args.phase)
    quiet_after = helpers['quiet']()
    if unit_processes(helpers, args.phase) != units or helpers['native_epoch']() != epoch:
        raise ValueError('runtime_changed_during_inspection')
    if any(helpers['fence_present']('/usr/sbin/' + name) != expected for name, expected in fences.items()):
        raise ValueError('fence_changed_during_inspection')
    return {'stage': 'AI-38', 'scope': 'read_only_phase_runtime_identity_static_proxy_and_quiescence',
            'phase': args.phase, 'status': 'passed_read_only_runtime_snapshot_not_full_release_acceptance',
            'started_at_utc': started, 'finished_at_utc': datetime.now(timezone.utc).isoformat(),
            'inspector_sha256': helpers['sha'](Path(__file__)), 'R03_helpers_source_sha256': R03_SHA256,
            'units': units, 'active_Node_role': args.phase,
            'frozen_original_Node': {'root': str(ORIGINAL), 'outputs': 932, 'manifest_sha256': original_sha,
                                     'active': args.phase == 'original'},
            'active_candidate': candidate, 'Client_manifest_sha256': CLIENT_MANIFEST_SHA if args.phase == 'candidate' else None,
            'Gemini': epoch, 'owned_fences': fences, 'SQL_schema_and_selection': SQL,
            'quiet_before': quiet_before, 'quiet_after': quiet_after, 'proxy': proxy,
            'effects': {'provider_requests': 0, 'configured_SQL_writes': 0, 'storage_operations': 0,
                        'service_changes': 0, 'remote_file_writes': 0, 'authentication_or_profile_reads': False},
            'limits': ['static_HTTP_requests_are_infrastructure_checks_not_browser_acceptance',
                       'active_job_drain_not_exercised', 'no_external_exposure_TLS_or_backups_acceptance',
                       'no_login_generation_or_business_effect_proven_by_this_snapshot']}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--phase', required=True, choices=('candidate', 'original'))
    parser.add_argument('--adoption-script', default='/tmp/nodia-ai-ai38-adoption-r03.py')
    args = parser.parse_args()
    try:
        print(json.dumps(inspect(args), indent=2))
    except (AssertionError, OSError, ValueError, KeyError, TypeError, subprocess.SubprocessError) as error:
        # Do not emit subprocess stderr, configuration, HTTP bodies or arbitrary argv.
        print(json.dumps({'stage': 'AI-38', 'phase': args.phase, 'status': 'failed_read_only_runtime_inspection',
                          'failure_class': type(error).__name__, 'raw_details_emitted': False}))
        sys.exit(1)
