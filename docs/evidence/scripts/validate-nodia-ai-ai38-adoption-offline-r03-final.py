"""Offline controls for adoption guards, using synthetic temporary files only."""
import ast
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import sys
import tempfile


root = Path(__file__).resolve().parents[3]
source = root / 'docs/evidence/scripts/nodia-ai-ai38-adoption-r03.py'
destination = root / 'docs/evidence/nodia-ai-ai38-adoption-offline-r03-final.json'
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
    class FakeClock:
        value = 0
        def monotonic(self): return self.value
        def sleep(self, seconds): self.value += seconds
    namespace['time'] = FakeClock()
    namespace['http_status'] = lambda url, timeout=10: (200, b'', None)
    namespace['write_nginx'](live)
    assert nginx.read_bytes() == live and commands == [['nginx', '-t'], ['systemctl', 'reload', 'nginx']]
    checks.append('valid nginx descriptor reloads once')
    statuses = iter([200, 404, 503, 503, 503, 503])
    observed = []
    def transient(url, timeout=10):
        value = next(statuses)
        observed.append(value)
        return value, b'', None
    namespace['http_status'] = transient
    namespace['write_nginx'](maintenance)
    assert observed == [200, 404, 503, 503, 503, 503]
    checks.append('stale reload responses do not stop consumers before two maintenance observations')
    namespace['http_status'] = lambda url, timeout=10: (200 if url.endswith('/api/v1') else 404, b'', None)
    namespace['write_nginx'](original)
    checks.append('rollback waits for restored API200 and root404')
    namespace['time'] = FakeClock()
    namespace['http_status'] = lambda url, timeout=10: (200, b'', None)
    try:
        namespace['write_nginx'](maintenance)
        raise AssertionError('expected unsettled proxy failure')
    except RuntimeError:
        pass
    assert namespace['time'].value <= 20
    checks.append('unsettled maintenance refuses success within polling budget')
    namespace['time'] = FakeClock()
    timeout_calls = []
    def slow_timeout(url, timeout=10):
        assert 0 < timeout <= 2
        timeout_calls.append(timeout)
        namespace['time'].value += timeout
        raise TimeoutError('synthetic slow response')
    namespace['http_status'] = slow_timeout
    try:
        namespace['write_nginx'](maintenance)
        raise AssertionError('expected bounded slow response failure')
    except RuntimeError:
        pass
    assert namespace['time'].value <= 20.25 and len(timeout_calls) <= 10
    checks.append('HTTP observation timeout is capped by two seconds and remaining total budget')
    text = source.read_text(encoding='utf-8')
    assert "prior / 'quiesce.json'" in text and 'prior_failed_quiesce_sha256' in text
    assert 'prepare_and_private_descriptors_copied_byte_exact' in text and 'prepare_reexecuted' in text
    checks.append('explicit continuation preserves and pins prior prepare and failed quiesce')

# Inherited reload/guard behavior must remain byte-for-byte equivalent as AST.
r02 = ast.parse((root / 'docs/evidence/scripts/nodia-ai-ai38-adoption-r02.py').read_text(encoding='utf-8'))
for name in ('write_nginx', 'http_status', 'stop_quiet', 'quiet', 'require_processes'):
    before = next(node for node in r02.body if isinstance(node, ast.FunctionDef) and node.name == name)
    after = next(node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name == name)
    assert ast.dump(before, include_attributes=False) == ast.dump(after, include_attributes=False)
checks.append('R03 preserves all reviewed R02 reload shutdown quiescence and process guards')
text = source.read_text(encoding='utf-8')
assert "choices=('adopt', 'rollback')" in text
assert "quiesced['script_sha256'] == '5ba19dc" in text
assert "continuation['continuation_source_sha256'] == '5ba19dc" in text
checks.append('R03 cannot repeat staging or quiesce and requires frozen R02 antecedents')
main = next(node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name == 'main')
receipt = next(node for node in ast.walk(main) if isinstance(node, ast.Assign) and
               any(isinstance(target, ast.Name) and target.id == 'receipt_path' for target in node.targets))
# Validate the actual adjacent public receipt allowlist assertions using pure POSIX paths.
parent_block = next(node.body for node in ast.walk(main) if isinstance(node, ast.If) and receipt in node.body)
start = parent_block.index(receipt)
assertions = parent_block[start:start + 4]
assert len(assertions) == 4 and all(isinstance(node, ast.Assert) for node in assertions[1:])
import posixpath
from types import SimpleNamespace
class FakePath(PurePosixPath):
    linked = False
    def is_symlink(self): return self.linked
    def resolve(self): return FakePath(posixpath.normpath(str(self)))
code = compile(ast.Module(body=assertions, type_ignores=[]), 'actual-receipt-allowlist', 'exec')
for candidate, accepted in [('/opt/nodia/verification/ai38-adoption-backup-r02/public-report.json', True),
                            ('/opt/nodia/verification/ai38-adoption-backup-r99/public-report.json', True),
                            ('/opt/nodia/verification/ai38-adoption-backup-r02/private-passphrase', False),
                            ('/etc/ai38-adoption-backup-r02/public-report.json', False),
                            ('/opt/nodia/verification/unrelated/public-report.json', False),
                            ('/opt/nodia/verification/ai38-adoption-backup-r02/../public-report.json', False),
                            ('relative/ai38-adoption-backup-r02/public-report.json', False)]:
    scope = {'Path': FakePath, 'args': SimpleNamespace(backup_receipt_path=candidate)}
    rejected = False
    try:
        exec(code, scope)
    except AssertionError:
        rejected = True
    assert rejected is not accepted, 'receipt allowlist result disagrees with independent expected outcome'
checks.append('explicit backup receipt path permits new frozen cuts and rejects private or escaping paths')
FakePath.linked = True
try:
    exec(code, {'Path': FakePath, 'args': SimpleNamespace(backup_receipt_path='/opt/nodia/verification/ai38-adoption-backup-r02/public-report.json')})
    raise RuntimeError('symlink unexpectedly accepted')
except AssertionError:
    checks.append('backup receipt symlink rejected')

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
