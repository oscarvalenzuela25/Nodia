"""CD privilege boundary regressions, using pipes and temporary state only.

Run on Linux as root in an isolated container: no sudo, systemd, network or VPS.
"""
import copy
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import threading
import types
import unittest
from unittest.mock import patch

BASE = Path(__file__).resolve().parents[1]


def load(name, filename):
    spec = importlib.util.spec_from_file_location(name, BASE / filename)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


receiver = load('receiver_fixture', 'deploy-backend-receiver.py')
gateway = load('gateway_fixture', 'deploy-gateway.py')
updater = load('receiver_updater_fixture', 'update-backend.py')
reconciliation_examples = load('receiver_reconciliation_examples', 'tests/test_backend_update.py')


def upload_message(data=b'original-actions-zip'):
    return {'schema_version': 1, 'command': 'upload', 'artifact_id': '456',
            'artifact_zip_sha256': hashlib.sha256(data).hexdigest(), 'run_id': '123',
            'run_attempt': '1', 'bytes': len(data)}


def deploy_message():
    return {**{key: value for key, value in upload_message().items() if key != 'bytes'},
            'command': 'deploy', 'operation_id': 'a' * 32, 'source_sha': 'b' * 40,
            'expected_current_release': 'backend-' + 'c' * 12 + '-' + 'd' * 12,
            'expected_current_tree_sha256': 'd' * 64}


class MessagePolicyTests(unittest.TestCase):
    def test_v2_commands_match_root_schema_and_bound_ranges_independently(self):
        identity = '456 ' + 'b' * 64 + ' 123 1 42'
        for command in ('capabilities', *[name + ' ' + identity for name in
                        ('upload-status', 'upload-open', 'upload-finish')],
                        'upload-append ' + identity + ' 0 ' + hashlib.sha256(b'').hexdigest() + ' 8 ' + 'c' * 64):
            parsed = gateway.parse_command(command)
            self.assertEqual(receiver.validate_message(parsed), parsed)
        for changes in ({'offset': True}, {'offset': -1}, {'chunk_bytes': True},
                        {'offset': 40, 'chunk_bytes': 8}, {'chunk_bytes': receiver.MAX_CHUNK + 1},
                        {'prefix_sha256': 'bad'}, {'unexpected': 1}):
            message = gateway.parse_command('upload-append ' + identity + ' 0 ' + 'c' * 64 + ' 8 ' + 'd' * 64)
            with self.subTest(changes=changes), self.assertRaises(ValueError):
                receiver.validate_message({**message, **changes})
        for command in ('capabilities extra', 'upload-status ' + identity + ' extra',
                        'upload-append ' + identity + ' 40 ' + 'c' * 64 + ' 8 ' + 'd' * 64):
            with self.subTest(command=command), self.assertRaises(ValueError):
                gateway.parse_command(command)

    def test_canonical_ssh_commands_match_the_independently_validated_root_message(self):
        for original in ['status', 'status ' + 'a' * 32,
                         'upload 456 ' + 'b' * 64 + ' 123 1 42',
                         'deploy ' + 'a' * 32 + ' 456 ' + 'b' * 64 + ' 123 1 ' + 'c' * 40 +
                         ' backend-' + 'd' * 12 + '-' + 'e' * 12 + ' ' + 'e' * 64]:
            parsed = gateway.parse_command(original)
            self.assertEqual(receiver.validate_message(parsed), parsed)

    def test_ssh_has_no_shell_sftp_whitespace_or_path_escape(self):
        for original in [None, '', ' status', 'status ', 'status  ' + 'a' * 32,
                         'status\n', 'status\t', 'status; id', '$(id)', 'sftp', '/bin/sh',
                         'status ../state', 'status ' + 'A' * 32, 'status ' + 'a' * 33,
                         'upload 0456 ' + 'a' * 64 + ' 123 1 1',
                         'upload 456 ' + 'a' * 64 + ' 123 1 805306369']:
            with self.subTest(original=original), self.assertRaises(ValueError):
                gateway.parse_command(original)

    def test_root_revalidates_types_size_fields_and_identity_without_trusting_gateway(self):
        for change in [{'schema_version': True}, {'bytes': True}, {'bytes': 0},
                       {'bytes': receiver.MAX_UPLOAD + 1}, {'artifact_id': '../456'},
                       {'run_attempt': '0'}, {'run_id': 123}, {'artifact_zip_sha256': 'G' * 64},
                       {'unexpected': 'value'}]:
            with self.subTest(change=change), self.assertRaises(ValueError):
                receiver.validate_message({**upload_message(), **change})
        with self.assertRaises(ValueError):
            receiver.validate_message({**deploy_message(), 'operation_id': '../x'})
        for raw in [b'{"command":"status","command":"deploy"}', b'{"bytes":NaN}']:
            with self.assertRaises(ValueError): receiver.unique_json(raw)


class PipeFixture:
    def pipe(self, data=b'', *, close_writer=True):
        read_fd, write_fd = os.pipe()
        self.addCleanup(os.close, read_fd)
        if data: os.write(write_fd, data)
        if close_writer: os.close(write_fd)
        else: self.addCleanup(os.close, write_fd)
        return read_fd


class PipeTests(PipeFixture, unittest.TestCase):
    def test_header_consumes_only_json_and_preserves_original_zip_bytes(self):
        raw = json.dumps(upload_message()).encode() + b'\nPK\x03\x04original'
        descriptor = self.pipe(raw)
        self.assertEqual(receiver.read_header(descriptor), upload_message())
        self.assertEqual(os.read(descriptor, 4096), b'PK\x03\x04original')

    def test_incomplete_and_oversized_headers_fail_without_a_command(self):
        for data, code in [(b'{', 'incomplete_receiver_header'),
                           (b' ' * 8193, 'receiver_header_too_large')]:
            with self.subTest(code=code), self.assertRaisesRegex(ValueError, code):
                receiver.read_header(self.pipe(data))

    def test_exact_bytes_and_digest_require_eof(self):
        data = b'synthetic-original-zip'
        output = io.BytesIO()
        receiver.receive_bytes(self.pipe(data), output, len(data), hashlib.sha256(data).hexdigest())
        self.assertEqual(output.getvalue(), data)
        for body, digest, code in [(data[:-1], hashlib.sha256(data).hexdigest(), 'upload_size_or_digest_mismatch'),
                                   (data, '0' * 64, 'upload_size_or_digest_mismatch'),
                                   (data + b'x', hashlib.sha256(data).hexdigest(), 'upload_exceeds_declared_size')]:
            with self.subTest(code=code), self.assertRaisesRegex(ValueError, code):
                receiver.receive_bytes(self.pipe(body), io.BytesIO(), len(data), digest)

    def test_idle_and_total_deadlines_bound_an_unclosed_client_pipe(self):
        for total, idle in [(1, 0.01), (0, 1)]:
            with self.subTest(total=total), self.assertRaisesRegex(ValueError, 'upload_timeout'):
                receiver.receive_bytes(self.pipe(close_writer=False), io.BytesIO(), 1, '0' * 64,
                                       total_seconds=total, idle_seconds=idle)


@unittest.skipUnless(sys.platform == 'linux', 'real POSIX upload pipes required')
class GatewayUploadTests(unittest.TestCase):
    def early_response(self, body, exit_code=1):
        # The subprocess closes ZIP input immediately, reproducing a receiver
        # quota rejection while the caller is still streaming a large archive.
        payload = b'clearly-synthetic-zip-bytes' * 65536
        read_fd, write_fd = os.pipe()

        def write_input():
            try:
                offset = 0
                while offset < len(payload):
                    offset += os.write(write_fd, payload[offset:offset + 65536])
            except BrokenPipeError:
                pass
            finally:
                os.close(write_fd)

        writer = threading.Thread(target=write_input, daemon=True)
        writer.start()
        original = subprocess.Popen
        calls = []
        code = ('import os,sys;os.close(0);'
                'sys.stdout.write(' + repr(json.dumps(body)) + ');sys.stdout.flush();'
                'sys.exit(' + repr(exit_code) + ')')

        def child(*_args, **kwargs):
            calls.append(True)
            return original([sys.executable, '-I', '-c', code], **kwargs)

        output = io.StringIO()
        command = ('upload 456 ' + hashlib.sha256(payload).hexdigest() + ' 123 1 ' + str(len(payload)))
        try:
            with patch.object(gateway.pwd, 'getpwnam', return_value=types.SimpleNamespace(pw_uid=os.getuid())), \
                    patch.dict(os.environ, {'SSH_ORIGINAL_COMMAND': command}), \
                    patch.object(gateway.subprocess, 'Popen', side_effect=child), \
                    patch.object(gateway.sys, 'stdin', types.SimpleNamespace(fileno=lambda: read_fd)), \
                    patch.object(gateway.sys, 'stdout', output):
                result = gateway.main()
            self.assertEqual(len(calls), 1)
            return result, json.loads(output.getvalue())
        finally:
            os.close(read_fd)
            writer.join(timeout=5)
            self.assertFalse(writer.is_alive(), 'Caller pipe writer must terminate after rejection')

    def test_early_receiver_rejections_survive_a_real_broken_pipe_without_replay(self):
        for error in gateway.UPLOAD_REJECTIONS:
            with self.subTest(error=error):
                body = {'schema_version': 1, 'status': 'failed', 'error_code': error,
                        'automatic_retry_allowed': False}
                self.assertEqual(self.early_response(body), (1, body))

    def test_interrupted_upload_cannot_become_success_or_disclose_untrusted_fields(self):
        body = {'schema_version': 1, 'status': 'failed',
                'error_code': 'incoming_quota_reached_operator_cleanup_required',
                'automatic_retry_allowed': False}
        for invalid, code in [(body, 0), ({**body, 'private': 'never-forward'}, 1),
                              ({**body, 'error_code': 'private_secret'}, 1),
                              ({**body, 'automatic_retry_allowed': True}, 1),
                              ({**body, 'schema_version': True}, 1)]:
            with self.subTest(body=invalid, exit_code=code), self.assertRaises(ValueError):
                self.early_response(invalid, code)


@unittest.skipUnless(hasattr(os, 'geteuid') and os.geteuid() == 0, 'root metadata contract needs isolated Linux root')
class RootStateTests(PipeFixture, unittest.TestCase):
    def setUp(self):
        workspace = BASE.parents[1] / '.tmp' / 'deploy-receiver-tests'
        workspace.mkdir(parents=True, exist_ok=True)
        self.temporary = tempfile.TemporaryDirectory(dir=workspace, prefix='owned-')
        self.directory = Path(self.temporary.name).resolve()
        assert self.directory.is_relative_to(workspace.resolve())
        self.addCleanup(self.temporary.cleanup)
        self.state = self.directory / 'state'; self.state.mkdir(mode=0o700)
        self.incoming = self.state / 'incoming'; self.incoming.mkdir(mode=0o700)
        self.submissions = self.state / 'submissions'; self.submissions.mkdir(mode=0o700)
        (self.state / 'requests').mkdir(mode=0o700)
        (self.state / 'attempts').mkdir(mode=0o700)
        for name, value in [('STATE', self.state), ('INCOMING', self.incoming), ('SUBMISSIONS', self.submissions)]:
            patcher = patch.object(receiver, name, value); patcher.start(); self.addCleanup(patcher.stop)
        self.message = deploy_message()
        self.ready = {'blocked': False, 'application': {'api_active': True, 'worker_active': True},
                      'current': {'release_id': self.message['expected_current_release'],
                                  'package_tree_sha256': self.message['expected_current_tree_sha256']}}
        self.real_service_guard = receiver.application_service_guard
        self.real_samefile = os.path.samefile

    def application_fixture(self, runtimes):
        """Real protected files; only absolute host paths/systemctl/proc are relocated."""
        root = Path(tempfile.mkdtemp(dir=self.directory, prefix='application-')).resolve()
        canonical_node = root / 'synthetic-node-identity'
        canonical_node.write_bytes(b'Synthetic executable identity; never executed.\n')
        canonical_node.chmod(0o755)
        releases = root / 'releases'; releases.mkdir()
        release = releases / self.message['expected_current_release']; release.mkdir()
        current = root / 'current'; current.symlink_to(release)
        manifest = release / 'release-manifest.json'
        manifest.write_text(json.dumps({'release_id': release.name, 'source_sha': 'c' * 40,
                                       'package_tree_sha256': 'd' * 64}), encoding='utf-8')
        manifest.chmod(0o644)
        library = root / 'library'; library.mkdir()
        installed = library / 'update-backend.py'
        installed.write_bytes((BASE / 'update-backend.py').read_bytes()); installed.chmod(0o644)
        installed_policy = library / 'backend_update.py'
        installed_policy.write_bytes((BASE / 'backend_update.py').read_bytes()); installed_policy.chmod(0o644)
        units = root / 'units'; units.mkdir()
        registry = root / 'consumers.json'
        states, processes, hashes = {}, {}, {}
        for index, (_, unit, entry) in enumerate(receiver.WRITERS):
            base = units / unit; base.write_bytes((BASE / unit).read_bytes()); base.chmod(0o644)
            hashes[unit] = hashlib.sha256(base.read_bytes()).hexdigest()
            process = root / 'proc' / str(20000 + index); process.mkdir(parents=True)
            os.chown(process, 900, 900)
            (process / 'cwd').symlink_to(release)
            (process / 'exe').symlink_to(canonical_node)
            (process / 'cmdline').write_bytes(b'/usr/local/bin/node\0' + entry.encode() + b'\0')
            paths = []
            if runtimes:
                parent = units / (unit + '.d'); parent.mkdir()
                for name, content in updater.AI_RUNTIME_TEMPLATES.items():
                    target = parent / name; target.write_bytes(content); target.chmod(0o644)
                    paths.append(str(target))
            states[unit] = {'ActiveState': 'active', 'SubState': 'running', 'Result': 'success',
                            'MainPID': process.name, 'ControlGroup': '/system.slice/' + unit,
                            'DropInPaths': ' '.join(paths)}
            processes[unit] = process
        if runtimes:
            registry.write_text(json.dumps({'schema_version': 1, 'purpose': 'nodia_ai_runtime_consumers',
                'units': {unit: updater.AI_RUNTIME_HASHES for _, unit, _ in receiver.WRITERS}}), encoding='utf-8')
            registry.chmod(0o600)
        settings = {'schema_version': 1, 'assets': {'update-backend.py': hashlib.sha256(installed.read_bytes()).hexdigest()},
                    'service_hashes': hashes}
        settings['assets']['backend_update.py'] = hashlib.sha256(installed_policy.read_bytes()).hexdigest()
        settings_file = self.state / 'settings.json'
        settings_file.write_text(json.dumps(settings), encoding='utf-8'); settings_file.chmod(0o600)

        def relocated_guard():
            guard = self.real_service_guard()
            # Retain the executed policy/metadata validation; relocate only its host paths.
            guard.service_overrides.__func__.__globals__.update(SYSTEMD_UNITS=units, AI_CONSUMERS=registry, STATE=self.state)
            return guard

        def mapped_path(value):
            return {'/opt/nodia/current': current, '/opt/nodia/releases': releases,
                    '/proc': root / 'proc'}.get(str(value), Path(value))
        for name, value in [('LIB', library), ('application_service_guard', relocated_guard), ('Path', mapped_path),
                            ('unit_state', lambda unit: states.get(unit, {'ActiveState':'inactive'}))]:
            patcher = patch.object(receiver, name, side_effect=value) if callable(value) else patch.object(receiver, name, value)
            patcher.start(); self.addCleanup(patcher.stop)
        patcher = patch.object(receiver.pwd, 'getpwnam', return_value=types.SimpleNamespace(pw_uid=900))
        patcher.start(); self.addCleanup(patcher.stop)
        # This suite checks inode identity, not execution. Keep the real samefile
        # comparison and relocate only its fixed canonical reference, so a Python-
        # only CI image needs no Node binary and a different executable still fails.
        def mapped_samefile(first, second):
            return self.real_samefile(first, canonical_node if str(second) == '/usr/local/bin/node' else second)
        patcher = patch.object(receiver.os.path, 'samefile', side_effect=mapped_samefile)
        patcher.start(); self.addCleanup(patcher.stop)
        return types.SimpleNamespace(root=root, release=release, units=units, registry=registry,
                                     states=states, processes=processes, library=library,
                                     installed=installed, installed_policy=installed_policy,
                                     settings=settings, settings_file=settings_file)

    def test_active_status_accepts_no_overrides_or_both_exact_registered_runtime_extensions(self):
        for runtimes in (False, True):
            with self.subTest(runtimes=runtimes):
                fixture = self.application_fixture(runtimes)
                before = {path: path.read_bytes() for path in fixture.units.rglob('*') if path.is_file()}
                result = receiver.deployment_status()
                self.assertEqual(result['status'], 'deployment_ready')
                self.assertEqual(result['application'], {'api_active': True, 'worker_active': True})
                self.assertNotIn('gemini_runtime', result)
                self.assertEqual(before, {path: path.read_bytes() for path in fixture.units.rglob('*') if path.is_file()})
                self.assertEqual(set(fixture.library.iterdir()), {fixture.installed, fixture.installed_policy})

    def test_unverified_gemini_omits_proof_without_contaminating_the_node_baseline(self):
        self.application_fixture(True)
        proof = {'schema_version': 1, 'source_sha': 'c' * 40, 'source_tree_sha': 'd' * 40,
                 'image_id': 'sha256:' + 'e' * 64}
        with patch.object(receiver, 'gemini_runtime_attestation', return_value=proof) as observed:
            verified = receiver.deployment_status()
            self.assertEqual(verified.pop('gemini_runtime'), proof)
            observed.side_effect = ValueError('gemini_runtime_service_unverified')
            self.assertEqual(receiver.deployment_status(), verified)

    def test_cd_exposes_codex_cv_metadata_only_from_the_checked_application_guard(self):
        fixture = self.application_fixture(True)
        proof = {'schema_version': 1, 'source_sha': 'a' * 40, 'source_tree_sha': 'b' * 40,
                 'binary_sha512': 'c' * 128, 'catalog_sha512': 'd' * 128, 'manifest_sha256': 'e' * 64}

        def checked_release(release):
            self.assertEqual(release, fixture.release)
            return proof

        self.assertIsNone(receiver.codex_cv_runtime_attestation(types.SimpleNamespace(), fixture.release))
        guard = types.SimpleNamespace(codex_cv_attestation=checked_release)
        self.assertEqual(receiver.codex_cv_runtime_attestation(guard, fixture.release), proof)
        for changes in ({'schema_version': True}, {'catalog_sha512': 'a' * 127}, {'extra': 'private'}):
            with self.subTest(changes=changes), self.assertRaisesRegex(ValueError, 'codex_cv_runtime_attestation_invalid'):
                malformed = types.SimpleNamespace(codex_cv_attestation=lambda _: {**proof, **changes})
                receiver.codex_cv_runtime_attestation(malformed, fixture.release)

    def test_gemini_sdk_requires_pinned_verifier_and_same_image_and_source_as_the_live_runtime(self):
        temporary = tempfile.TemporaryDirectory(dir='/root', prefix='nodia-cv-sdk-proof-test-')
        self.addCleanup(temporary.cleanup)
        library = Path(temporary.name)
        helper = library / 'ai-runtime/gemini-sdk-proof.py'
        helper.parent.mkdir()
        image = {'schema_version': 1, 'source_sha': 'a' * 40, 'source_tree_sha': 'b' * 40,
                 'image_id': 'sha256:' + 'c' * 64}
        proof = {**image, 'manifest_sha256': 'd' * 64, 'runtime_hash': 'e' * 64, 'policy_hash': 'f' * 64}

        def verified_helper(record):
            raw = f'def cv_sdk_attestation(runtime):\n    return {record!r}\n'.encode('ascii')
            helper.write_bytes(raw)
            helper.chmod(0o644)
            return patch.object(receiver, 'GEMINI_CV_SDK_PROOF_SHA256', hashlib.sha256(raw).hexdigest())

        with patch.object(receiver, 'LIB', library):
            self.assertIsNone(receiver.gemini_cv_sdk_attestation(image))
            with verified_helper(proof):
                self.assertIsNone(receiver.gemini_cv_sdk_attestation(None))
                self.assertEqual(receiver.gemini_cv_sdk_attestation(image), proof)
                with self.assertRaisesRegex(ValueError, 'gemini_cv_sdk_attestation_image_mismatch'):
                    receiver.gemini_cv_sdk_attestation({**image, 'source_sha': 'f' * 40})
                helper.write_bytes(helper.read_bytes() + b'# changed')
                with self.assertRaisesRegex(ValueError, 'gemini_runtime_host_file_changed'):
                    receiver.gemini_cv_sdk_attestation(image)
            with verified_helper({**proof, 'extra': 'private'}):
                with self.assertRaisesRegex(ValueError, 'gemini_cv_sdk_attestation_invalid'):
                    receiver.gemini_cv_sdk_attestation(image)

    def test_runtime_attestation_requires_exact_protected_inputs_and_the_live_container_policy(self):
        temporary = tempfile.TemporaryDirectory(dir='/root', prefix='nodia-gemini-proof-test-')
        self.addCleanup(temporary.cleanup)
        root = Path(temporary.name)
        library = root / 'library'
        runtime = library / 'ai-runtime'
        runtime.mkdir(parents=True)
        helper = runtime / 'gemini-host.py'
        helper.write_bytes((BASE / 'ai-runtime/gemini-host.py').read_bytes())
        helper.chmod(0o644)
        unit = root / 'nodia-gemini.service'
        unit.write_bytes((BASE / 'ai-runtime/nodia-gemini.service').read_bytes())
        unit.chmod(0o644)
        proof = root / 'gemini-rollout-current.json'
        pin = root / 'gemini-image.json'
        image = 'sha256:' + 'a' * 64
        record = {'schema_version': 1, 'source_sha': 'b' * 40, 'source_tree_sha': 'c' * 40, 'image_id': image}
        pinned = {key: record[key] for key in ('schema_version', 'source_sha', 'image_id')}

        def private(path, value):
            path.write_text(json.dumps(value), encoding='utf-8')
            path.chmod(0o600)

        def mapped_path(value):
            return {'/var/lib/nodia-ai-runtime-setup/gemini-rollout-current.json': proof,
                    '/etc/nodia/ai-runtime/gemini-image.json': pin,
                    '/etc/systemd/system/nodia-gemini.service': unit}[str(value)]

        state = {'ActiveState': 'active', 'SubState': 'running', 'Result': 'success', 'MainPID': '10100',
                 'ControlGroup': '/system.slice/nodia-gemini.service', 'FragmentPath': str(unit),
                 'DropInPaths': '', 'NeedDaemonReload': 'no'}
        container = {'image': image, 'label': {'sh.nodia.runtime': 'agentic'}, 'running': True, 'pid': 10700,
                     'started': 'fixture', 'user': '10001:10001', 'privileged': False, 'cap_add': None,
                     'cap_drop': ['ALL'], 'ports': {'8000/tcp': [{'HostIp': '127.0.0.1', 'HostPort': '8000'}]},
                     'cgroupns': 'private', 'restart': 'no', 'memory': 2147483648, 'pids': 256,
                     'mounts': [{'Type': 'bind', 'Destination': '/app/session_state',
                                 'Source': '/var/lib/nodia-gemini/session_state'},
                                {'Type': 'bind', 'Destination': '/home/nodia/agentic_profile',
                                 'Source': '/var/lib/nodia-gemini/profile'}]}
        response = lambda body: types.SimpleNamespace(returncode=0, stdout=json.dumps(body).encode(), stderr=b'')
        with patch.object(receiver, 'LIB', library), patch.object(receiver, 'Path', side_effect=mapped_path), \
                patch.object(receiver, 'unit_state', return_value=state) as shown, \
                patch.object(receiver.subprocess, 'run', return_value=response(container)) as inspected:
            self.assertIsNone(receiver.gemini_runtime_attestation())
            inspected.assert_not_called()
            private(proof, record)
            private(pin, pinned)
            self.assertEqual(receiver.gemini_runtime_attestation(), record)
            shown.assert_called_once_with('nodia-gemini.service')
            command = inspected.call_args.args[0]
            self.assertEqual(command[:4], ['docker', 'inspect', '--type', 'container'])
            self.assertNotIn('Config.Env', command[5])
            for changes in ({'schema_version': True}, {'source_tree_sha': 'z' * 40}, {'extra': 'private'}):
                private(proof, {**record, **changes})
                with self.assertRaisesRegex(ValueError, 'gemini_runtime_attestation_invalid'):
                    receiver.gemini_runtime_attestation()
            private(proof, record)
            proof.chmod(0o644)
            with self.assertRaisesRegex(ValueError, 'invalid_receiver_file_mode'):
                receiver.gemini_runtime_attestation()
            private(proof, record)
            private(pin, {**pinned, 'source_sha': 'e' * 40})
            with self.assertRaisesRegex(ValueError, 'gemini_runtime_attestation_image_mismatch'):
                receiver.gemini_runtime_attestation()
            private(pin, pinned)
            shown.return_value = {**state, 'DropInPaths': 'unverified-override.conf'}
            with self.assertRaisesRegex(ValueError, 'gemini_runtime_service_unverified'):
                receiver.gemini_runtime_attestation()
            shown.return_value = state
            inspected.return_value = response({**container, 'image': 'sha256:' + 'f' * 64})
            with self.assertRaisesRegex(ValueError, 'gemini_runtime_container_unverified'):
                receiver.gemini_runtime_attestation()
            inspected.return_value = response({**container, 'privileged': True})
            with self.assertRaisesRegex(ValueError, 'gemini_runtime_container_policy_changed'):
                receiver.gemini_runtime_attestation()

    def reconciled_application_fixture(self):
        fixture = self.application_fixture(True)
        receipt, evidence = reconciliation_examples.reconciliation_fixture(request_change={
            'expected_current_release':fixture.release.name,'expected_current_tree_sha256':'d'*64})
        attempt = self.state / 'attempts' / receipt['operation_id']; attempt.mkdir(mode=0o700)
        files = {attempt/'state.json':evidence['state_bytes'], attempt/'request.json':evidence['request_bytes'],
                 attempt/'recovered-manifest.json':evidence['manifest_bytes'],
                 self.state/'BLOCKED.json':evidence['blocked_bytes'],
                 self.state/('same-release-recovery-'+receipt['operation_id']+'.json'):evidence['recovery_bytes']}
        for path, content in files.items(): path.write_bytes(content); path.chmod(0o600)
        acknowledgment = attempt / 'pre-migration-reconciliation.json'
        receiver.save_new(acknowledgment, receipt)
        return fixture, receipt, evidence, attempt, acknowledgment, files

    def test_exact_reconciliation_unblocks_only_a_new_operation_and_preserves_original_failure_and_block(self):
        _fixture, receipt, evidence, attempt, _ack, files = self.reconciled_application_fixture()
        self.assertFalse(receiver.deployment_status()['blocked'])
        receiver.save_new(self.submissions / (receipt['operation_id']+'.json'), {'message':self.message})
        with patch.object(receiver, 'command') as launch:
            original = receiver.submit(self.message)
            self.assertEqual(original['phase'], 'failed')
            self.assertEqual(original['error_code'], 'writer_shutdown_not_clean')
            launch.assert_not_called()
        guard = receiver.application_service_guard()
        old_request = json.loads(evidence['request_bytes'])
        with self.assertRaisesRegex(ValueError, 'operation_id_already_recorded'):
            guard.begin(old_request, {})
        next_request = {**old_request, 'operation_id':'b'*32}
        guard.begin(next_request, {'schema_version':1,'operation_id':'b'*32,'phase':'preparing',
                                 'effects_started':False,'migration_requested':False})
        self.assertTrue((self.state/'attempts'/('b'*32)/'request.json').is_file())
        self.assertTrue(attempt.is_dir())
        self.assertEqual({path:path.read_bytes() for path in files}, files)

    def test_reconciliation_never_clears_an_independent_pending_submission_or_other_failed_attempt(self):
        self.reconciled_application_fixture()
        pending = 'b'*32
        receiver.save_new(self.submissions/(pending+'.json'), {'message':{**self.message,'operation_id':pending}})
        self.assertTrue(receiver.deployment_status()['blocked'])
        (self.submissions/(pending+'.json')).unlink()
        other = self.state/'attempts'/('c'*32); other.mkdir(mode=0o700)
        receiver.save_new(other/'state.json', {'schema_version':1,'operation_id':'c'*32,'phase':'failed',
            'effects_started':True,'migration_requested':True,'failed_phase':'migration_requested'})
        self.assertTrue(receiver.deployment_status()['blocked'])
        self.assertTrue(receiver.application_service_guard().prior_updates_blocked())

    def test_reconciliation_requires_private_immutable_ack_snapshot_and_all_original_evidence(self):
        for changed in ('ack_missing','ack_mutable','ack_extra','snapshot_missing','snapshot_mutable',
                        'state_changed','request_changed','recovery_changed','block_changed','snapshot_symlink'):
            with self.subTest(changed=changed):
                fixture, receipt, _evidence, attempt, ack, _files = self.reconciled_application_fixture()
                snapshot = attempt/'recovered-manifest.json'
                if changed == 'ack_missing': ack.unlink()
                elif changed == 'ack_mutable': ack.chmod(0o644)
                elif changed == 'ack_extra': ack.write_text(json.dumps({**receipt,'extra':True}), encoding='utf-8')
                elif changed == 'snapshot_missing': snapshot.unlink()
                elif changed == 'snapshot_mutable': snapshot.chmod(0o644)
                elif changed == 'snapshot_symlink':
                    snapshot.unlink(); snapshot.symlink_to(fixture.release/'release-manifest.json')
                else:
                    target = {'state_changed':attempt/'state.json','request_changed':attempt/'request.json',
                        'recovery_changed':self.state/('same-release-recovery-'+receipt['operation_id']+'.json'),
                        'block_changed':self.state/'BLOCKED.json'}[changed]
                    target.write_bytes(target.read_bytes()+b' ')
                self.assertTrue(receiver.deployment_status()['blocked'])
                self.assertTrue(receiver.application_service_guard().prior_updates_blocked())
                # Preserve evidence within each isolated iteration; next case gets its own state directory.
                for path in self.state.iterdir():
                    if path.is_file(): path.unlink()
                import shutil
                shutil.rmtree(attempt)

    def test_reconciled_history_uses_snapshot_even_after_recovered_release_is_retired(self):
        fixture, _receipt, _evidence, _attempt, _ack, _files = self.reconciled_application_fixture()
        guard = receiver.application_service_guard()
        import shutil
        shutil.rmtree(fixture.release)
        self.assertFalse(guard.prior_updates_blocked())

    def post_migration_application_fixture(self):
        self.application_fixture(True)
        receipt, evidence = reconciliation_examples.post_migration_fixture()
        attempt = self.state / 'attempts' / receipt['operation_id']
        attempt.mkdir(mode=0o700)
        fields = reconciliation_examples.policy.POST_MIGRATION_EVIDENCE
        files = {attempt / name: evidence[field] for field, (name, _) in fields.items()}
        files.update({attempt / 'state.json': evidence['state_bytes'], attempt / 'request.json': evidence['request_bytes'],
                      attempt / 'recovered-manifest.json': evidence['manifest_bytes'],
                      self.state / 'BLOCKED.json': evidence['blocked_bytes']})
        for path, content in files.items():
            path.write_bytes(content)
            path.chmod(0o600)
        return receipt, attempt, files

    def test_post_migration_acknowledgment_releases_only_future_admissions(self):
        receipt, attempt, files = self.post_migration_application_fixture()
        acknowledgment = attempt / 'post-migration-reconciliation.json'
        self.assertTrue(receiver.deployment_status()['blocked'])
        receiver.save_new(acknowledgment, receipt)
        self.assertFalse(receiver.deployment_status()['blocked'])

        receiver.save_new(self.submissions / (receipt['operation_id'] + '.json'), {'message': self.message})
        with patch.object(receiver, 'command') as launch:
            original = receiver.submit(self.message)
            self.assertEqual(original['phase'], 'failed')
            self.assertTrue(original['migration_requested'])
            self.assertFalse(original['deployment_performed'])
            self.assertFalse(original['automatic_retry_allowed'])
            launch.assert_not_called()

        guard = receiver.application_service_guard()
        previous_request = json.loads(files[attempt / 'request.json'])
        with self.assertRaisesRegex(ValueError, 'operation_id_already_recorded'):
            guard.begin(previous_request, {})
        guard.begin({**previous_request, 'operation_id': 'b' * 32}, {
            'schema_version': 1, 'operation_id': 'b' * 32, 'phase': 'preparing',
            'effects_started': False, 'migration_requested': False,
        })
        self.assertEqual({path: path.read_bytes() for path in files}, files)

    def test_post_migration_preview_keeps_gates_closed_to_other_blockers(self):
        receipt, attempt, files = self.post_migration_application_fixture()
        preview = {'reconciliation_override': (receipt['operation_id'], json.dumps(receipt).encode())}
        self.assertFalse(receiver.deployment_status(**preview)['blocked'])
        self.assertTrue(receiver.deployment_status()['blocked'])

        pending = self.submissions / ('b' * 32 + '.json')
        receiver.save_new(pending, {'message': {**self.message, 'operation_id': 'b' * 32}})
        self.assertTrue(receiver.deployment_status(**preview)['blocked'])
        pending.unlink()

        other = self.state / 'attempts' / ('b' * 32)
        other.mkdir(mode=0o700)
        receiver.save_new(other / 'state.json', {
            'operation_id': 'b' * 32, 'phase': 'failed', 'effects_started': True, 'migration_requested': True,
        })
        self.assertTrue(receiver.deployment_status(**preview)['blocked'])
        (other / 'state.json').unlink()
        other.rmdir()

        verification = attempt / 'post-migration-verification.json'
        verification.write_bytes(files[verification] + b' ')
        self.assertTrue(receiver.deployment_status(**preview)['blocked'])
        verification.write_bytes(files[verification])
        receiver.save_new(attempt / 'post-migration-reconciliation.json', receipt)
        self.assertTrue(receiver.deployment_status(**preview)['blocked'])
        receiver.save_new(attempt / 'pre-migration-reconciliation.json', receipt)
        self.assertTrue(receiver.deployment_status()['blocked'])

    def test_backup_requested_preview_and_private_ack_use_the_same_bound_pre_migration_evidence(self):
        fixture = self.application_fixture(True)
        receipt, evidence, pins = reconciliation_examples.backup_request_fixture(request_change={
            'expected_current_release': fixture.release.name, 'expected_current_tree_sha256': 'd' * 64})
        with fixture.installed_policy.open('ab') as installed_policy:
            installed_policy.write(''.join(f'\n{key} = {value!r}\n' for key, value in pins.items()).encode())
        fixture.settings['assets']['backend_update.py'] = hashlib.sha256(fixture.installed_policy.read_bytes()).hexdigest()
        fixture.settings_file.write_text(json.dumps(fixture.settings), encoding='utf-8')
        attempt = self.state / 'attempts' / receipt['operation_id']
        attempt.mkdir(mode=0o700)
        recovery = self.state / ('same-release-recovery-' + receipt['operation_id'] + '.json')
        files = {attempt / 'state.json': evidence['state_bytes'], attempt / 'request.json': evidence['request_bytes'],
                 attempt / 'recovered-manifest.json': evidence['manifest_bytes'],
                 self.state / 'BLOCKED.json': evidence['blocked_bytes'], recovery: evidence['recovery_bytes']}
        for path, content in files.items():
            path.write_bytes(content)
            path.chmod(0o600)

        preview = {'reconciliation_override': (receipt['operation_id'], json.dumps(receipt).encode())}
        self.assertTrue(receiver.deployment_status()['blocked'])
        self.assertFalse(receiver.deployment_status(**preview)['blocked'])
        other = self.state / 'attempts' / ('b' * 32)
        other.mkdir(mode=0o700)
        receiver.save_new(other / 'state.json', {'operation_id': 'b' * 32, 'phase': 'failed', 'effects_started': True})
        self.assertTrue(receiver.deployment_status(**preview)['blocked'])
        (other / 'state.json').unlink()
        other.rmdir()

        receiver.save_new(attempt / 'pre-migration-reconciliation.json', receipt)
        self.assertFalse(receiver.deployment_status()['blocked'])
        self.assertEqual({path: path.read_bytes() for path in files}, files)
        guard = receiver.application_service_guard()
        previous_request = json.loads(evidence['request_bytes'])
        with self.assertRaisesRegex(ValueError, 'operation_id_already_recorded'):
            guard.begin(previous_request, {})
        receiver.save_new(self.submissions / (receipt['operation_id'] + '.json'), {'message': self.message})
        stored = receiver.operation_status(receipt['operation_id'])
        self.assertEqual(stored['phase'], 'failed')
        self.assertFalse(stored['migration_requested'])
        self.assertFalse(stored['automatic_retry_allowed'])
        recovery.write_bytes(evidence['recovery_bytes'] + b' ')
        self.assertTrue(receiver.deployment_status()['blocked'])

    def test_quiescence_preview_and_persisted_ack_share_the_exact_pre_migration_gate(self):
        fixture = self.application_fixture(True)
        receipt, evidence, pins = reconciliation_examples.quiescence_fixture(request_change={
            'expected_current_release': fixture.release.name, 'expected_current_tree_sha256': 'd' * 64})
        with fixture.installed_policy.open('ab') as installed_policy:
            installed_policy.write(''.join(f'\n{key} = {value!r}\n' for key, value in pins.items()).encode())
        fixture.settings['assets']['backend_update.py'] = hashlib.sha256(fixture.installed_policy.read_bytes()).hexdigest()
        fixture.settings_file.write_text(json.dumps(fixture.settings), encoding='utf-8')
        attempt = self.state / 'attempts' / receipt['operation_id']
        attempt.mkdir(mode=0o700)
        recovery = self.state / ('same-release-recovery-' + receipt['operation_id'] + '.json')
        files = {attempt / 'state.json': evidence['state_bytes'], attempt / 'request.json': evidence['request_bytes'],
                 attempt / 'recovered-manifest.json': evidence['manifest_bytes'],
                 self.state / 'BLOCKED.json': evidence['blocked_bytes'], recovery: evidence['recovery_bytes']}
        for path, content in files.items():
            path.write_bytes(content)
            path.chmod(0o600)

        preview = {'reconciliation_override': (receipt['operation_id'], json.dumps(receipt).encode())}
        self.assertTrue(receiver.deployment_status()['blocked'])
        self.assertFalse(receiver.deployment_status(**preview)['blocked'])
        other = self.state / 'attempts' / ('b' * 32)
        other.mkdir(mode=0o700)
        receiver.save_new(other / 'state.json', {'operation_id': 'b' * 32, 'phase': 'failed', 'effects_started': True})
        self.assertTrue(receiver.deployment_status(**preview)['blocked'])
        (other / 'state.json').unlink()
        other.rmdir()
        recovery.write_bytes(evidence['recovery_bytes'] + b' ')
        self.assertTrue(receiver.deployment_status(**preview)['blocked'])
        recovery.write_bytes(evidence['recovery_bytes'])

        receiver.save_new(attempt / 'pre-migration-reconciliation.json', receipt)
        self.assertFalse(receiver.deployment_status()['blocked'])
        self.assertTrue(receiver.deployment_status(**preview)['blocked'])
        self.assertEqual({path: path.read_bytes() for path in files}, files)
        original = json.loads(evidence['request_bytes'])
        guard = receiver.application_service_guard()
        with self.assertRaisesRegex(ValueError, 'operation_id_already_recorded'):
            guard.begin(original, {})
        receiver.save_new(self.submissions / (receipt['operation_id'] + '.json'), {'message': self.message})
        stored = receiver.operation_status(receipt['operation_id'])
        self.assertEqual(stored['phase'], 'failed')
        self.assertEqual(stored['error_code'], 'live_or_unconfirmed_runtime_work')
        self.assertFalse(stored['migration_requested'])
        self.assertFalse(stored['automatic_retry_allowed'])

    def test_active_status_rejects_missing_altered_extra_unregistered_or_relocated_dropins(self):
        def missing(f): (f.units / 'nodia-api.service.d/70-codex-runtime.conf').unlink()
        def altered(f): (f.units / 'nodia-api.service.d/70-codex-runtime.conf').write_bytes(b'[Service]\nUser=root\n')
        def extra(f): (f.units / 'nodia-api.service.d/99-extra.conf').write_bytes(b'[Service]\nExecStart=/bin/sh\n')
        def unregistered(f): f.registry.unlink()
        def loaded_extra(f): f.states['nodia-api.service']['DropInPaths'] += ' /run/systemd/system/99-extra.conf'
        def relocated(f): f.states['nodia-api.service']['DropInPaths'] = f.states['nodia-api.service']['DropInPaths'].replace(str(f.units), '/run/systemd/system')
        for change in (missing, altered, extra, unregistered, loaded_extra, relocated):
            with self.subTest(change=change.__name__):
                fixture = self.application_fixture(True); change(fixture)
                with self.assertRaises((ValueError, FileNotFoundError)): receiver.deployment_status()

    def test_active_status_requires_pinned_updater_base_units_and_private_exact_registry(self):
        def unpinned(f):
            del f.settings['service_hashes']['nodia-api.service']
            f.settings_file.write_text(json.dumps(f.settings), encoding='utf-8')
        def updater_changed(f): f.installed.write_bytes(f.installed.read_bytes() + b'\nraise RuntimeError("must never execute")\n')
        def base_changed(f): (f.units / 'nodia-api.service').write_bytes(b'[Service]\nUser=root\n')
        def registry_changed(f): f.registry.write_text('{"schema_version":1,"purpose":"arbitrary_root_dropins","units":{}}', encoding='utf-8')
        def registry_public(f): f.registry.chmod(0o644)
        def registry_link(f):
            target = f.root / 'registry-original.json'; f.registry.rename(target); f.registry.symlink_to(target)
        for change in (unpinned, updater_changed, base_changed, registry_changed, registry_public, registry_link):
            with self.subTest(change=change.__name__):
                fixture = self.application_fixture(True); change(fixture)
                with self.assertRaises(ValueError): receiver.deployment_status()

    def test_registered_runtime_extensions_never_bypass_process_identity(self):
        def uid(f): os.chown(f.processes['nodia-api.service'], 0, 0)
        def cwd(f):
            target = f.processes['nodia-api.service'] / 'cwd'; target.unlink(); target.symlink_to(f.root)
        def executable(f):
            target = f.processes['nodia-api.service'] / 'exe'; target.unlink(); target.symlink_to('/bin/sh')
        def arguments(f): (f.processes['nodia-api.service'] / 'cmdline').write_bytes(b'/bin/sh\0')
        def cgroup(f): f.states['nodia-api.service']['ControlGroup'] = '/other.slice/nodia-api.service'
        for change in (uid, cwd, executable, arguments, cgroup):
            with self.subTest(change=change.__name__):
                fixture = self.application_fixture(True); change(fixture)
                with self.assertRaisesRegex(ValueError, 'writer_(release_identity_mismatch|process_not_verified)'):
                    receiver.deployment_status()

    def archive(self):
        directory = self.incoming / 'server-123-1'; directory.mkdir(mode=0o700)
        filename = directory / '456.zip'; filename.write_bytes(b'original-actions-zip'); filename.chmod(0o600)
        return filename

    def status(self):
        return patch.object(receiver, 'deployment_status', return_value=copy.deepcopy(self.ready))

    def test_upload_promotes_only_a_digest_matched_complete_file(self):
        body = b'original-actions-zip'
        with self.status(), patch.object(receiver.shutil, 'disk_usage', return_value=types.SimpleNamespace(free=4 * 1024 ** 3)):
            result = receiver.upload(upload_message(body), self.pipe(body))
        filename = self.incoming / 'server-123-1/456.zip'
        self.assertEqual(result['status'], 'uploaded')
        self.assertEqual(filename.read_bytes(), body)
        self.assertEqual(filename.stat().st_mode & 0o777, 0o600)
        self.assertFalse(filename.with_suffix('.zip.part').exists())

    def test_failed_upload_preserves_partial_and_never_implicitly_replays_it(self):
        with self.status(), patch.object(receiver.shutil, 'disk_usage', return_value=types.SimpleNamespace(free=4 * 1024 ** 3)):
            with self.assertRaisesRegex(ValueError, 'upload_size_or_digest_mismatch'):
                receiver.upload(upload_message(), self.pipe(b'truncated'))
            partial = self.incoming / 'server-123-1/456.zip.part'
            self.assertEqual(partial.read_bytes(), b'truncated')
            with self.assertRaisesRegex(ValueError, 'upload_already_recorded_no_automatic_replay'):
                receiver.upload(upload_message(), self.pipe(b'original-actions-zip'))
            self.assertEqual(partial.read_bytes(), b'truncated')
            self.assertFalse(partial.with_suffix('').exists())

    def test_global_block_quota_and_disk_limits_fail_before_creating_upload_state(self):
        for status, inventory, free, code in [
                ({'blocked': True}, (0, 0), 4 * 1024 ** 3, 'prior_update_requires_reconciliation'),
                ({'blocked': False}, (0, 10), 4 * 1024 ** 3, 'incoming_quota_reached_operator_cleanup_required'),
                ({'blocked': False}, (receiver.MAX_INCOMING, 1), 4 * 1024 ** 3, 'incoming_quota_reached_operator_cleanup_required'),
                ({'blocked': False}, (0, 0), 1, 'insufficient_upload_headroom')]:
            with self.subTest(code=code), patch.object(receiver, 'deployment_status', return_value=status), \
                    patch.object(receiver, 'incoming_inventory', return_value=inventory), \
                    patch.object(receiver.shutil, 'disk_usage', return_value=types.SimpleNamespace(free=free)):
                with self.assertRaisesRegex(ValueError, code): receiver.upload(upload_message(), self.pipe())
                self.assertEqual(list(self.incoming.iterdir()), [])

    def test_submit_records_durable_intent_and_exact_request_before_detached_launch(self):
        self.archive()
        calls = []
        def launch(arguments, **_):
            calls.append(arguments)
            saved = receiver.bounded_json(self.submissions / (self.message['operation_id'] + '.json'))
            request = receiver.bounded_json(self.state / 'requests' / (self.message['operation_id'] + '.json'))
            self.assertEqual(saved['message'], self.message)
            self.assertEqual(request['artifact_directory'], 'server-123-1')
            self.assertNotIn('command', request)
            self.assertIn('--apply', arguments)
            self.assertEqual(arguments[-2:], [str(self.state / 'requests' / (self.message['operation_id'] + '.json')), '--apply'])
            return ''
        with self.status(), patch.object(receiver, 'command', side_effect=launch):
            self.assertEqual(receiver.submit(self.message)['status'], 'submitted')
        self.assertEqual(len(calls), 1)

    def test_uncertain_launch_is_query_only_on_duplicate_not_a_second_apply(self):
        self.archive()
        with self.status(), patch.object(receiver, 'command', side_effect=subprocess.TimeoutExpired('synthetic', 1)) as launch:
            with self.assertRaises(subprocess.TimeoutExpired): receiver.submit(self.message)
            with patch.object(receiver, 'unit_state', return_value={'ActiveState': 'inactive'}):
                result = receiver.submit(self.message)
            self.assertEqual(result['phase'], 'unknown')
            self.assertFalse(result['automatic_retry_allowed'])
            self.assertEqual(launch.call_count, 1)

    def test_nonce_conflict_and_old_expected_release_cannot_launch(self):
        self.archive()
        record = self.submissions / (self.message['operation_id'] + '.json')
        receiver.save_new(record, {'message': self.message})
        with patch.object(receiver, 'command') as launch:
            with self.assertRaisesRegex(ValueError, 'operation_id_request_conflict'):
                receiver.submit({**self.message, 'source_sha': 'f' * 40})
            launch.assert_not_called()
        record.unlink()
        with self.status(), patch.object(receiver, 'command') as launch:
            with self.assertRaisesRegex(ValueError, 'expected_current_version_mismatch'):
                receiver.submit({**self.message, 'expected_current_tree_sha256': 'f' * 64})
            launch.assert_not_called()
        self.assertFalse(record.exists())

    def test_status_whitelists_metadata_and_marks_dead_units_unknown(self):
        operation = self.message['operation_id']
        receiver.save_new(self.submissions / (operation + '.json'), {'message': self.message, 'secret': 'never-forward'})
        attempt = self.state / 'attempts' / operation; attempt.mkdir(mode=0o700)
        receiver.save_new(attempt / 'state.json', {'phase': 'migration_requested', 'effects_started': True,
                          'migration_requested': True, 'secret': 'never-forward'})
        with patch.object(receiver, 'unit_state', return_value={'ActiveState': 'inactive'}):
            result = receiver.operation_status(operation)
        self.assertEqual(result['phase'], 'unknown')
        self.assertTrue(result['migration_requested'])
        self.assertNotIn('never-forward', json.dumps(result))

    def test_global_status_detects_operator_intent_without_a_receiver_submission(self):
        releases = self.directory / 'releases'; releases.mkdir(mode=0o700)
        release = releases / self.message['expected_current_release']; release.mkdir(mode=0o700)
        current = self.directory / 'current'; current.symlink_to(release)
        manifest = release / 'release-manifest.json'
        receiver.save_new(manifest, {'release_id': release.name, 'source_sha': 'c' * 40,
                                    'package_tree_sha256': 'd' * 64})
        manifest.chmod(0o644)
        attempt = self.state / 'attempts' / ('b' * 32); attempt.mkdir(mode=0o700)
        receiver.save_new(attempt / 'state.json', {'phase': 'migration_requested', 'effects_started': True})
        def mapped_path(value):
            return {'/opt/nodia/current': current, '/opt/nodia/releases': releases}.get(str(value), Path(value))
        with patch.object(receiver, 'Path', side_effect=mapped_path), \
                patch.object(receiver, 'unit_state', return_value={'ActiveState': 'inactive'}):
            self.assertTrue(receiver.deployment_status()['blocked'])
            self.assertEqual(list(self.submissions.iterdir()), [])

    def test_status_rejects_an_error_message_that_could_disclose_private_data(self):
        operation = self.message['operation_id']
        receiver.save_new(self.submissions / (operation + '.json'), {'message': self.message})
        attempt = self.state / 'attempts' / operation; attempt.mkdir(mode=0o700)
        receiver.save_new(attempt / 'state.json', {'phase': 'failed', 'error_code': 'postgresql://private-details'})
        with self.assertRaisesRegex(ValueError, 'unsafe_error_code'): receiver.operation_status(operation)

    def test_private_state_rejects_symlink_hardlink_and_world_readable_files(self):
        filename = self.state / 'metadata.json'; receiver.save_new(filename, {'safe': True})
        filename.chmod(0o644)
        with self.assertRaisesRegex(ValueError, 'invalid_receiver_file_mode'): receiver.bounded_json(filename)
        filename.chmod(0o600)
        linked = self.state / 'linked.json'; linked.symlink_to(filename)
        with self.assertRaises(ValueError): receiver.bounded_json(linked)
        linked.unlink(); os.link(filename, linked)
        with self.assertRaisesRegex(ValueError, 'invalid_receiver_file_type'): receiver.bounded_json(filename)


if __name__ == '__main__': unittest.main()
