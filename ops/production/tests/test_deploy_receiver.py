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
import tempfile
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

    def application_fixture(self, runtimes):
        """Real protected files; only absolute host paths/systemctl/proc are relocated."""
        root = Path(tempfile.mkdtemp(dir=self.directory, prefix='application-')).resolve()
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
        units = root / 'units'; units.mkdir()
        registry = root / 'consumers.json'
        states, processes, hashes = {}, {}, {}
        for index, (_, unit, entry) in enumerate(receiver.WRITERS):
            base = units / unit; base.write_bytes((BASE / unit).read_bytes()); base.chmod(0o644)
            hashes[unit] = hashlib.sha256(base.read_bytes()).hexdigest()
            process = root / 'proc' / str(20000 + index); process.mkdir(parents=True)
            os.chown(process, 900, 900)
            (process / 'cwd').symlink_to(release)
            (process / 'exe').symlink_to('/usr/local/bin/node')
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
        settings_file = self.state / 'settings.json'
        settings_file.write_text(json.dumps(settings), encoding='utf-8'); settings_file.chmod(0o600)

        def relocated_guard():
            guard = self.real_service_guard()
            # Retain the executed policy/metadata validation; relocate only its host paths.
            guard.service_overrides.__func__.__globals__.update(SYSTEMD_UNITS=units, AI_CONSUMERS=registry)
            return guard

        def mapped_path(value):
            return {'/opt/nodia/current': current, '/opt/nodia/releases': releases,
                    '/proc': root / 'proc'}.get(str(value), Path(value))
        for name, value in [('LIB', library), ('application_service_guard', relocated_guard), ('Path', mapped_path),
                            ('unit_state', lambda unit: states[unit])]:
            patcher = patch.object(receiver, name, side_effect=value) if callable(value) else patch.object(receiver, name, value)
            patcher.start(); self.addCleanup(patcher.stop)
        patcher = patch.object(receiver.pwd, 'getpwnam', return_value=types.SimpleNamespace(pw_uid=900))
        patcher.start(); self.addCleanup(patcher.stop)
        return types.SimpleNamespace(root=root, release=release, units=units, registry=registry,
                                     states=states, processes=processes, library=library,
                                     installed=installed, settings=settings, settings_file=settings_file)

    def test_active_status_accepts_no_overrides_or_both_exact_registered_runtime_extensions(self):
        for runtimes in (False, True):
            with self.subTest(runtimes=runtimes):
                fixture = self.application_fixture(runtimes)
                before = {path: path.read_bytes() for path in fixture.units.rglob('*') if path.is_file()}
                result = receiver.deployment_status()
                self.assertEqual(result['status'], 'deployment_ready')
                self.assertEqual(result['application'], {'api_active': True, 'worker_active': True})
                self.assertEqual(before, {path: path.read_bytes() for path in fixture.units.rglob('*') if path.is_file()})
                self.assertEqual(list(fixture.library.iterdir()), [fixture.installed])

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
