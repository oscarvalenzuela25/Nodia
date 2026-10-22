"""Execute the real rollback program against private synthetic files/transports."""
import ast
import builtins
import contextlib
import copy
import hashlib
import io
import json
from pathlib import Path
import tempfile
from types import SimpleNamespace

source = Path(__file__).with_name('nodia-ai-ai36-c05-r04-role-rollback.py')
body = source.read_text()
fake_dropin = b'[Service]\n# synthetic recovery control only\n'
fixture_digest = hashlib.sha256(fake_dropin).hexdigest()
tree = ast.parse(body)

class FixturePin(ast.NodeTransformer):
    def visit_Constant(self, node):
        if node.value == '4d322139517dbcf55a0750af722ed9b54719bcc49ea60f52545225ace8054a87':
            return ast.copy_location(ast.Constant(fixture_digest), node)
        return node

tree = ast.fix_missing_locations(FixturePin().visit(tree))
results = []
for case in ('pre_quiet_failure', 'native_start_failure', 'descriptor_failure', 'post_quiet_failure', 'success'):
    with tempfile.TemporaryDirectory(prefix='nodia-r04-recovery-control-') as folder:
        base = Path(folder)
        backup, output, dropin = base / 'backup', base / 'output', base / 'dropin.conf'
        backup.mkdir()
        before = {'Image': 'sha256:0615520cd6d6682eddc08dd886d79952c80265fcf2e7814caa940b92ee8f27aa',
                  'Config': {'Env': ['SYNTHETIC_FIXTURE_ONLY=1'], 'User': 'nodia'},
                  'Mounts': [{'Destination': '/fixture/' + str(n), 'Source': '/synthetic/' + str(n)} for n in range(6)],
                  'HostConfig': {'PortBindings': {}, 'Memory': 1, 'NanoCpus': 1, 'Tmpfs': {}},
                  'State': {'Running': True, 'StartedAt': 'synthetic'}, 'Id': 'synthetic-baseline'}
        (backup / 'private-original-container.json').write_text(json.dumps(before))
        (backup / 'private-original-role-override.conf').write_bytes(fake_dropin)
        dropin.write_bytes(b'synthetic candidate override')
        commands, quiet_calls = [], [0]
        units = {name: 'active' for name in ('nodia-api', 'nodia-ai-worker', 'nodia-gemini-lab', 'nginx')}

        def mapped_path(value):
            mapping = {
                '/opt/nodia/verification/ai36-c05-r04-role-activation': backup,
                '/opt/nodia/verification/ai36-c05-r04-role-restoration01': output,
                '/etc/systemd/system/nodia-gemini-lab.service.d/ai36-c05-role.conf': dropin,
            }
            return mapping.get(str(value), Path(value))

        def fake_run(args, **kwargs):
            commands.append(args)
            code, out = 0, b''
            if args[:2] == ['systemctl', 'stop']:
                for name in args[2:]: units[name] = 'inactive'
            elif args[:2] == ['systemctl', 'start']:
                if args[2:] == ['nodia-gemini-lab'] and case == 'native_start_failure': code = 1
                else:
                    for name in args[2:]: units[name] = 'active'
            elif args[:2] == ['systemctl', 'is-active']:
                out = units[args[2]].encode()
            elif args == ['systemctl', 'daemon-reload']:
                pass
            elif args[:2] == ['docker', 'inspect']:
                after = copy.deepcopy(before)
                if case == 'descriptor_failure': after['Config']['Env'].append('UNEXPECTED=1')
                out = json.dumps([after]).encode()
            elif args == ['python3', '/tmp/ai32-r04-cleanup.py']:
                quiet_calls[0] += 1
                counts = {key: 0 for key in ('unknown_markers', 'armed_native_proofs', 'terminal_native_proofs', 'invalid_native_proofs', 'temporary_attachment_directories', 'temporary_cli_directories')}
                if (case == 'pre_quiet_failure' and quiet_calls[0] == 1) or (case == 'post_quiet_failure' and quiet_calls[0] == 2): counts['unknown_markers'] = 1
                out = json.dumps(counts).encode()
            elif args[:2] == ['/usr/local/bin/node', '/tmp/nodia-ai-ai36-c05-live-health.mjs']:
                out = json.dumps({'pending_jobs': 0, 'open_attempts': 0, 'retained_slots': 0, 'preserved_r05_chat': 1}).encode()
            else:
                raise AssertionError('Unapproved synthetic command')
            return SimpleNamespace(returncode=code, stdout=out, stderr=b'')

        original_import = builtins.__import__
        def fixture_import(name, globals=None, locals=None, fromlist=(), level=0):
            if name == 'subprocess': return SimpleNamespace(run=fake_run)
            if name == 'pathlib': return SimpleNamespace(Path=mapped_path)
            return original_import(name, globals, locals, fromlist, level)

        namespace = {'__file__': str(source.resolve()), '__name__': '__main__',
                     '__builtins__': {**vars(builtins), '__import__': fixture_import}}
        failed = False
        with contextlib.redirect_stdout(io.StringIO()):
            try: exec(compile(tree, str(source), 'exec'), namespace)
            except AssertionError: failed = True
        api_starts = [cmd for cmd in commands if cmd == ['systemctl', 'start', 'nodia-api', 'nodia-ai-worker']]
        assert failed is (case != 'success')
        assert len(api_starts) == (1 if case == 'success' else 0)
        assert units['nodia-api'] == units['nodia-ai-worker'] == ('active' if case == 'success' else 'inactive')
        if case == 'pre_quiet_failure': assert ['systemctl', 'start', 'nodia-gemini-lab'] not in commands
        results.append({'case': case, 'passed': True, 'consumer_resume_calls': len(api_starts),
                        'provider_or_VM_commands': 0, 'synthetic_transport_only': True})
print(json.dumps({'stage': 'AI-36-C05-R04', 'scope': 'real_rollback_program_with_synthetic_transport_and_private_fixture_files',
                  'status': 'passed', 'results': results,
                  'source_sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
                  'control_sha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
                  'only_fixture_pin_substitution': 'dropin_digest_synthetic_bytes_never_operational_data',
                  'provider_inferences': 0, 'VM_operations': 0, 'operational_profile_access': False}, indent=2))
