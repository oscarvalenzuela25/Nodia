"""Offline controls for adoption guards, using synthetic temporary files only."""
import ast
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import sys
import tempfile


root = Path(__file__).resolve().parents[3]
source = root / 'docs/evidence/scripts/nodia-ai-ai38-adoption.py'
destination = root / 'docs/evidence/nodia-ai-ai38-adoption-offline-r01.json'
mode = sys.argv[1]
assert mode in ('--write', '--check')
tree = ast.parse(source.read_text(encoding='utf-8'))
names = {'sha', 'validate_manifest', 'nginx_bytes', 'dropin', 'fence_arguments', 'write_nginx'}
selected = ast.Module(body=[node for node in tree.body if isinstance(node, ast.FunctionDef)
                           and node.name in names], type_ignores=[])
namespace = {'hashlib': hashlib, 'json': json, 'PurePosixPath': PurePosixPath, 'os': os,
             'SERVER': Path('/opt/nodia/releases/nodia-server-ai38-candidate01'),
             'CLIENT': Path('/opt/nodia/releases/nodia-client-ai38-candidate01'),
             'ORIGINAL': Path('/opt/nodia/releases/nodia-server-ai15-20261016'),
             'FENCE_TAG': 'nodia-ai38-adoption-r01-only'}
exec(compile(selected, 'offline-selected-pure-helpers', 'exec'), namespace)
checks = []


def rejects(function, title):
    try:
        function()
    except AssertionError:
        checks.append(title)
        return
    raise AssertionError('negative_control_unexpectedly_accepted')


with tempfile.TemporaryDirectory(prefix='nodia-ai38-offline-') as directory:
    fixture = Path(directory)
    (fixture / 'dist').mkdir()
    (fixture / 'dist/main.js').write_bytes(b'fixture')
    manifest = {'files': {'dist/main.js': hashlib.sha256(b'fixture').hexdigest()}}
    (fixture / 'manifest.json').write_text(json.dumps(manifest), encoding='utf-8')
    pin = namespace['sha'](fixture / 'manifest.json')
    assert namespace['validate_manifest'](fixture, pin) == manifest
    checks.append('accepts frozen member bytes')
    (fixture / 'dist/main.js').write_bytes(b'changed')
    rejects(lambda: namespace['validate_manifest'](fixture, pin), 'rejects tampered member')
    for bad in ('../escape', '/escape', 'dist\\escape'):
        (fixture / 'manifest.json').write_text(json.dumps({'files': {bad: '0' * 64}}), encoding='utf-8')
        rejects(lambda: namespace['validate_manifest'](fixture, namespace['sha'](fixture / 'manifest.json')),
                'rejects unsafe member ' + repr(bad))
    original = (b'server { listen 127.0.0.1:8080; client_max_body_size 11m; '
                b'location /api/v1 { proxy_pass http://127.0.0.1:3000; } location / { return 404; } }')
    (fixture / 'descriptor-3').write_bytes(original)
    maintenance = namespace['nginx_bytes'](fixture, True)
    live = namespace['nginx_bytes'](fixture, False)
    assert maintenance.count(b'return 503;') == 2
    checks.append('maintenance closes API and SPA admission')
    assert b'client_max_body_size 11m;' in live and b'proxy_pass http://127.0.0.1:3000;' in live
    checks.append('existing proxy and body limit preserved')
    assert b'try_files $uri $uri/ /index.html;' in live
    checks.append('static SPA preserves deep links')
    assert b'Cross-Origin-Opener-Policy same-origin-allow-popups always;' in live
    checks.append('static SPA retains GIS opener policy')
    assert (fixture / 'descriptor-3').read_bytes() == original
    checks.append('original descriptor snapshot unchanged')
    (fixture / 'descriptor-3').write_bytes(b'invalid')
    rejects(lambda: namespace['nginx_bytes'](fixture, True), 'rejects unknown nginx descriptor shape')
    for unit, entry in (('nodia-api', 'main.js'), ('nodia-ai-worker', 'nodia-ai-worker.js')):
        value = namespace['dropin'](unit)
        assert b'ExecStart=\nExecStart=' in value and entry.encode() in value and b'DOTENV_CONFIG_PATH=' in value
        checks.append(unit + ' absolute entrypoint and original dotenv path')
    fence = namespace['fence_arguments']()
    assert fence[:4] == ['INPUT', '!', '-i', 'lo'] and fence[fence.index('--dport') + 1] == '3000'
    assert fence[-2:] == ['-j', 'REJECT']
    checks.append('exclusive fence targets only non-loopback API TCP3000')
    nginx = fixture / 'nodia-lab'
    nginx.write_bytes(original)
    namespace['NGINX'] = nginx
    commands = []

    def fail_test(argv):
        commands.append(argv)
        if len(commands) == 1:
            raise RuntimeError('synthetic_nginx_test_failure')

    namespace['checked'] = fail_test
    try:
        namespace['write_nginx'](live)
        raise AssertionError('expected_nginx_test_failure')
    except RuntimeError:
        pass
    assert nginx.read_bytes() == original and commands == [['nginx', '-t'], ['nginx', '-t']]
    assert not (fixture / 'nodia-lab.ai38-building').exists()
    checks.append('failed nginx validation restores exact disk bytes without reload')
    commands.clear()
    namespace['checked'] = lambda argv: commands.append(argv)
    namespace['write_nginx'](live)
    assert nginx.read_bytes() == live and commands == [['nginx', '-t'], ['systemctl', 'reload', 'nginx']]
    checks.append('valid nginx descriptor reloads once')

report = {'stage': 'AI-38', 'status': 'passed', 'scope': 'synthetic_offline_adoption_guard_controls_not_VM_acceptance',
          'source_sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
          'validator_sha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
          'checks': checks, 'checks_passed': len(checks), 'VM_changes': False, 'provider_requests': 0,
          'services_or_firewall_exercised': False, 'backup_or_restore_exercised': False}
serialized = json.dumps(report, indent=2) + '\n'
if mode == '--write':
    with destination.open('x', encoding='utf-8', newline='\n') as output:
        output.write(serialized)
else:
    assert destination.read_text(encoding='utf-8') == serialized, 'offline_receipt_drift'
print(json.dumps({'status': 'passed', 'checks_passed': len(checks), 'mode': mode,
                  'source_sha256': report['source_sha256']}))
