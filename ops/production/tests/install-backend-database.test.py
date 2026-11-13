"""State-machine and public-result rules only; no root, systemd, database or R2."""
import copy
import contextlib
import base64
import hashlib
import importlib.util
import io
import json
import os
import shlex
import shutil
import subprocess
import sys
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest
import uuid
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location('install_database', Path(__file__).resolve().parents[1] / 'install-backend-database.py')
install = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(install)


class InstallationStateTests(unittest.TestCase):
    def setUp(self):
        self.identity = {'source_sha': 'a' * 40, 'release_id': 'backend-' + 'a' * 12 + '-' + 'b' * 12,
                         'archive_sha256': 'c' * 64, 'action_sha256': 'd' * 64, 'stage_helper_sha256': 'e' * 64}

    def test_new_installation_and_complete_repeat_only(self):
        self.assertEqual(install.execution_mode(None, self.identity), 'install')
        self.assertEqual(install.execution_mode({**self.identity, 'phase': 'complete'}, self.identity), 'verify')

    def test_failure_started_unknown_and_changed_release_cannot_retry(self):
        for phase in ('failed', 'installation_started', 'verifying_completed_installation', 'unknown', None):
            with self.assertRaisesRegex(ValueError, 'no_automatic_retry'):
                install.execution_mode({**self.identity, 'phase': phase}, self.identity)
        with self.assertRaisesRegex(ValueError, 'identity_changed'):
            install.execution_mode({**self.identity, 'phase': 'complete', 'source_sha': 'b' * 40}, self.identity)

    def test_explicit_reconciliation_never_selects_install_or_changes_original_failure(self):
        for phase in ('failed', 'installation_started', 'verifying_completed_installation', 'reconciling_read_only', 'complete'):
            previous = {**self.identity, 'phase': phase, 'error_code': 'unsafe_probe_unit_cleanup'}
            original = copy.deepcopy(previous)
            self.assertEqual(install.execution_mode(previous, self.identity, reconcile_only=True), 'verify')
            self.assertEqual(previous, original)
        with self.assertRaisesRegex(ValueError, 'requires_existing_attempt'):
            install.execution_mode(None, self.identity, reconcile_only=True)
        with self.assertRaisesRegex(ValueError, 'identity_changed'):
            install.execution_mode({**self.identity, 'phase': 'failed', 'action_sha256': '0' * 64}, self.identity, reconcile_only=True)

    def test_pinned_helper_stays_readable_under_private_operator_umask(self):
        with tempfile.TemporaryDirectory(prefix='nodia-install-helper-') as directory:
            root = Path(directory)
            source = root / 'source.mjs'
            source.write_bytes(b'// synthetic helper bytes\n')
            sha = hashlib.sha256(source.read_bytes()).hexdigest()
            previous_umask = os.umask(0o077)
            try:
                with patch.object(install, 'LIBRARY', root):
                    target = install.install_pinned(source, sha, 'installed.mjs')
                    self.assertEqual(target.stat().st_mode & 0o777, 0o644)
                    with self.assertRaisesRegex(ValueError, 'helper_digest_mismatch'):
                        install.install_pinned(source, '0' * 64, 'bad.mjs')
                    self.assertFalse((root / 'bad.mjs').exists())
            finally:
                os.umask(previous_umask)

    def test_verify_unit_has_destination_guard_and_no_install_argument(self):
        text = install.unit_content('/candidate', '/action.mjs', 'verify', self.identity, '/output', '/error')
        self.assertIn('ExecStart=/usr/local/bin/node /action.mjs verify ' + self.identity['source_sha'], text)
        self.assertNotIn('/action.mjs install ', text)
        self.assertIn('assertProviderBaselineDestination', text)
        self.assertIn('validatePostgresEnvironment(process.env)', text)
        self.assertIn('{host:c.host,port:c.port,database:c.database}', text)
        self.assertIn(install.PREFLIGHT_SHA, text)
        self.assertIn(install.BASELINE_SHA, text)
        self.assertLess(text.index('ExecStartPre='), text.index('ExecStart='))

    @unittest.skipUnless(shutil.which('node'), 'Node is required for the actual no-SQL destination guard')
    def test_exact_destination_guard_accepts_bound_target_and_rejects_wrong_target_without_sql(self):
        directory = Path(__file__).resolve().parents[1]
        profile = (directory / 'postgres-provider-baseline.json').read_bytes()
        metadata = json.loads(profile)
        arguments = shlex.split(install.destination_guard_command().removeprefix('ExecStartPre=').strip())
        self.assertEqual(arguments[1:3], ['--input-type=module', '-e'])
        code = arguments[3].replace(
            'file:///usr/local/lib/nodia/inspect-postgres-installation-' + install.PREFLIGHT_SHA + '.mjs',
            (directory / 'inspect-postgres-installation.mjs').as_uri())
        # Only root-file admission is adapted to the local fixture bytes; execute the exact guard comparison.
        original_loader = "p.loadProviderBaselineFile('/usr/local/lib/nodia/postgres-provider-baseline-" + install.BASELINE_SHA + ".json')"
        self.assertIn(original_loader, code)
        code = code.replace(original_loader, "p.decodeProviderBaselineBytes(Buffer.from('" + base64.b64encode(profile).decode() +
                            "','base64'),'" + install.BASELINE_SHA + "')")
        environment = {'PGSSLMODE': 'verify-full', 'POSTGRES_HOST': metadata['destination']['host'],
                       'POSTGRES_PORT': str(metadata['destination']['port']), 'POSTGRES_DB': metadata['destination']['database'],
                       'POSTGRES_USER': 'synthetic', 'POSTGRES_PASSWORD': 'private-synthetic-marker'}
        command = [shutil.which('node'), '--input-type=module', '-e', code]
        passed = subprocess.run(command, env=environment, capture_output=True, text=True, timeout=10)
        self.assertEqual(passed.returncode, 0)
        failed = subprocess.run(command, env={**environment, 'POSTGRES_HOST': 'other.invalid'}, capture_output=True, text=True, timeout=10)
        self.assertNotEqual(failed.returncode, 0)
        self.assertNotIn('private-synthetic-marker', passed.stdout + passed.stderr + failed.stdout + failed.stderr)

    def test_closed_public_result_rejects_secret_fields_and_wrong_ledger_digest(self):
        names = ['Migration' + str(index).zfill(3) for index in range(45)]
        value = {'schema_version': 1, 'status': 'verified', 'mode': 'install', 'source_sha': self.identity['source_sha'],
                 'release_id': self.identity['release_id'], 'migrations_verified': 45, 'entity_tables_verified': 68,
                 'migration_ledger_sha256': hashlib.sha256(json.dumps(names, separators=(',', ':')).encode()).hexdigest(),
                 'users': 1, 'core_assignments': 4, 'provider_credentials': 0, 'migration_names': names,
                 'journal': {'first_sequence': 1, 'last_sequence': 0, 'entries': 0, 'backups': 0, 'open': True},
                 'application_started': False, 'worker_started': False, 'migrations_requested': True,
                 'postcheck_read_only': True, 'client_tls_authorized': True}
        self.assertEqual(install.safe_result(value, self.identity, 'install'), value)
        for changes in ({'email': 'private@example.com'}, {'migration_ledger_sha256': '0' * 64}, {'worker_started': True}):
            with self.assertRaises(ValueError):
                install.safe_result({**copy.deepcopy(value), **changes}, self.identity, 'install')


class InstallationCleanupTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix='nodia-install-cleanup-')
        self.root = Path(self.temporary.name)
        self.units = self.root / 'units'
        self.private = self.root / 'private'
        self.units.mkdir()
        self.private.mkdir()
        self.unit = 'nodia-first-install-' + 'a' * 32 + '.service'
        self.path = self.units / self.unit
        self.path.write_text('synthetic exact unit\n', encoding='utf-8')
        self.commands = []
        self.active = False
        self.dropins = ''
        self.patches = [patch.object(install, 'UNIT_DIRECTORY', self.units), patch.object(install, 'PRIVATE', self.private),
                        patch.object(install, 'protected_file', lambda *args, **kwargs: None)]
        for value in self.patches:
            value.start()

    def tearDown(self):
        for value in reversed(self.patches):
            value.stop()
        self.temporary.cleanup()

    def runner(self, command, **kwargs):
        self.commands.append(command)
        if command[1] == 'show':
            text = '\n'.join(['LoadState=' + ('loaded' if self.path.exists() else 'not-found'),
                              'ActiveState=' + ('active' if self.active else 'inactive'),
                              'MainPID=' + ('1234' if self.active else '0'),
                              'FragmentPath=' + (str(self.path) if self.path.exists() else ''),
                              'DropInPaths=' + self.dropins])
            return SimpleNamespace(returncode=0 if self.path.exists() else 1, stdout=text)
        if command[1] == 'stop':
            self.active = False
        return SimpleNamespace(returncode=1 if command[1] in ('stop', 'reset-failed') else 0, stdout='')

    def test_namespace_is_exact_and_cannot_remove_probe_or_other_unit(self):
        for unit in ('nodia-backend-check-' + 'a' * 32 + '.service', 'nodia-first-install-../other.service', 'nodia-api.service'):
            with self.assertRaisesRegex(ValueError, 'namespace'):
                install.cleanup_installation_unit(unit, 'synthetic exact unit\n', runner=self.runner)
        self.assertTrue(self.path.exists())
        self.assertEqual(self.commands, [])

    def test_inactive_and_unloaded_nonzero_reset_is_success_with_final_postconditions(self):
        install.cleanup_installation_unit(self.unit, 'synthetic exact unit\n', runner=self.runner)
        self.assertFalse(self.path.exists())
        self.assertFalse(any(command[1] == 'stop' for command in self.commands))
        self.assertTrue(any(command[1] == 'daemon-reload' for command in self.commands))

    def test_active_orphan_metadata_changes_and_dropins_are_rejected_before_stop(self):
        self.active = True
        with self.assertRaisesRegex(ValueError, 'must_be_inactive'):
            install.cleanup_installation_unit(self.unit, 'synthetic exact unit\n', runner=self.runner)
        self.assertTrue(self.path.exists())
        self.assertFalse(any(command[1] == 'stop' for command in self.commands))
        self.active = False
        with self.assertRaisesRegex(ValueError, 'metadata_mismatch'):
            install.cleanup_installation_unit(self.unit, 'different metadata', runner=self.runner)
        self.dropins = '/run/systemd/system/unit.d/foreign.conf'
        with self.assertRaisesRegex(ValueError, 'dropins'):
            install.cleanup_installation_unit(self.unit, 'synthetic exact unit\n', runner=self.runner)

    def test_own_action_can_stop_only_its_matching_unit(self):
        self.active = True
        install.cleanup_installation_unit(self.unit, 'synthetic exact unit\n', allow_stop=True, runner=self.runner)
        self.assertFalse(self.path.exists())
        self.assertTrue(any(command[1] == 'stop' for command in self.commands))

    def test_cleanup_failure_preserves_logs_and_primary_error(self):
        output = self.private / 'original.json'
        error = self.private / 'original.log'
        output.write_text('synthetic-output', encoding='utf-8')
        error.write_text('private-synthetic-content', encoding='utf-8')
        captured = io.StringIO()
        with patch.object(install, 'cleanup_installation_unit', side_effect=ValueError('cleanup_failed')):
            with contextlib.redirect_stderr(captured):
                with self.assertRaisesRegex(ValueError, 'primary_failure'):
                    try:
                        raise ValueError('primary_failure')
                    finally:
                        install.finish_action(self.unit, 'content', output, error, primary_error=sys.exc_info()[1])
        self.assertEqual((self.private / 'installation-action-output.json').read_text(), 'synthetic-output')
        self.assertEqual((self.private / 'installation-action-stderr.log').read_text(), 'private-synthetic-content')
        self.assertNotIn('private-synthetic-content', captured.getvalue())

    def test_cleanup_failure_without_primary_is_reported_after_logs_are_preserved(self):
        output = self.private / 'original.json'
        error = self.private / 'original.log'
        output.write_text('{}', encoding='utf-8')
        error.write_text('private', encoding='utf-8')
        with patch.object(install, 'cleanup_installation_unit', side_effect=ValueError('cleanup_failed')):
            with self.assertRaisesRegex(ValueError, 'cleanup_failed'):
                install.finish_action(self.unit, 'content', output, error)
        self.assertTrue((self.private / 'installation-action-output.json').exists())
        self.assertTrue((self.private / 'installation-action-stderr.log').exists())

    def test_legacy_orphan_adopts_only_filtered_artifact_and_preserves_original_uuid_logs(self):
        identity = {'source_sha': 'a' * 40, 'release_id': 'backend-' + 'a' * 12 + '-' + 'b' * 12}
        candidate = '/opt/nodia/candidates/' + identity['release_id']
        action = '/usr/local/lib/nodia/install-backend-database-' + 'c' * 64 + '.mjs'
        _, output, error = install.installation_unit_paths(self.unit)
        content = install.unit_content(candidate, action, 'install', identity, output, error, bind_destination=False)
        self.path.write_text(content, encoding='utf-8')
        value = {'schema_version': 1, 'status': 'verified', 'mode': 'install'}
        output.write_text(json.dumps(value), encoding='utf-8')
        error.write_text('private original log', encoding='utf-8')
        stage = SimpleNamespace(strict_json=json.loads, Rejected=ValueError)
        with patch.object(install.subprocess, 'run', self.runner), patch.object(install, 'safe_result', return_value=value) as validator:
            self.assertEqual(install.reconcile_orphan(self.unit, candidate, action, identity, stage), value)
        validator.assert_called_once_with(value, identity, 'install')
        self.assertFalse(self.path.exists())
        self.assertTrue(output.exists())
        self.assertEqual(error.read_text(), 'private original log')
        self.assertFalse(any(command[1] == 'stop' for command in self.commands))

    def test_orphan_wrong_user_source_or_uuid_output_cannot_be_removed_or_adopted(self):
        identity = {'source_sha': 'a' * 40, 'release_id': 'backend-' + 'a' * 12 + '-' + 'b' * 12}
        candidate = '/opt/nodia/candidates/' + identity['release_id']
        action = '/usr/local/lib/nodia/install-backend-database-' + 'c' * 64 + '.mjs'
        _, output, error = install.installation_unit_paths(self.unit)
        content = install.unit_content(candidate, action, 'install', identity, output, error, bind_destination=False)
        stage = SimpleNamespace(strict_json=json.loads, Rejected=ValueError)
        for changed in (content.replace('User=nodia', 'User=root'), content.replace(identity['source_sha'], 'b' * 40),
                        content.replace(str(output), str(self.private / 'foreign.json'))):
            self.path.write_text(changed, encoding='utf-8')
            with patch.object(install.subprocess, 'run', self.runner), patch.object(install, 'safe_result') as validator:
                with self.assertRaisesRegex(ValueError, 'orphan_unit_metadata_mismatch'):
                    install.reconcile_orphan(self.unit, candidate, action, identity, stage)
                validator.assert_not_called()
            self.assertTrue(self.path.exists())
        self.assertEqual(self.commands, [])


@unittest.skipUnless(os.geteuid() == 0 and os.environ.get('NODIA_INSTALLER_PID1_FIXTURE') == '1',
                     'Explicit local root/PID1 fixture opt-in required; never run against the VPS')
class InstallationPid1CleanupTests(unittest.TestCase):
    def test_actual_PID1_destination_guard_quoting_accepts_only_bound_target_without_sql(self):
        source = Path(__file__).resolve().parents[1]
        library_created = not install.LIBRARY.exists()
        install.LIBRARY.mkdir(mode=0o755, exist_ok=True)
        install.protected_directory(install.LIBRARY)
        created = []
        try:
            for filename, expected in ((f'inspect-postgres-installation-{install.PREFLIGHT_SHA}.mjs', install.PREFLIGHT_SHA),
                                       (f'postgres-provider-baseline-{install.BASELINE_SHA}.json', install.BASELINE_SHA)):
                original = source / ('inspect-postgres-installation.mjs' if filename.endswith('.mjs') else 'postgres-provider-baseline.json')
                data = original.read_bytes()
                self.assertEqual(hashlib.sha256(data).hexdigest(), expected)
                target = install.LIBRARY / filename
                if not target.exists():
                    fd = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o644)
                    with os.fdopen(fd, 'wb') as stream:
                        stream.write(data)
                        os.fchmod(stream.fileno(), 0o644)
                    created.append((target, expected))
                install.protected_file(target)
                self.assertEqual(hashlib.sha256(target.read_bytes()).hexdigest(), expected)
            profile = json.loads((source / 'postgres-provider-baseline.json').read_bytes())
            for correct in (True, False):
                unit = 'nodia-first-install-' + uuid.uuid4().hex + '.service'
                unit_path, _, _ = install.installation_unit_paths(unit)
                host = profile['destination']['host'] if correct else 'wrong-fixture.invalid'
                content = ('[Unit]\nDescription=Nodia local no-SQL destination guard regression\n[Service]\n'
                           'Type=oneshot\nUser=oscar\nGroup=oscar\nEnvironment=PGSSLMODE=verify-full\n'
                           f'Environment=POSTGRES_HOST={host}\nEnvironment=POSTGRES_PORT={profile["destination"]["port"]}\n'
                           f'Environment=POSTGRES_DB={profile["destination"]["database"]}\n'
                           'Environment=POSTGRES_USER=synthetic\nEnvironment=POSTGRES_PASSWORD=synthetic\n' +
                           install.destination_guard_command().replace('/usr/local/bin/node', shutil.which('node')) +
                           'ExecStart=/usr/bin/true\nTimeoutStartSec=5\nTimeoutStopSec=5\nStandardOutput=null\nStandardError=null\n')
                fd = os.open(unit_path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o644)
                with os.fdopen(fd, 'w', encoding='utf-8', newline='\n') as stream:
                    stream.write(content)
                    os.fchmod(stream.fileno(), 0o644)
                try:
                    subprocess.run(['systemctl', 'daemon-reload'], capture_output=True, timeout=15, check=True)
                    started = subprocess.run(['systemctl', 'start', '--wait', unit], capture_output=True, timeout=15, check=False)
                    self.assertEqual(started.returncode == 0, correct)
                finally:
                    install.cleanup_installation_unit(unit, content, allow_stop=True)
        finally:
            for target, expected in reversed(created):
                install.protected_file(target)
                self.assertEqual(hashlib.sha256(target.read_bytes()).hexdigest(), expected)
                target.unlink()
            if library_created:
                install.LIBRARY.rmdir()

    def test_actual_oneshot_first_install_namespace_is_removed_after_success(self):
        unit = 'nodia-first-install-' + uuid.uuid4().hex + '.service'
        unit_path, _, _ = install.installation_unit_paths(unit)
        content = ('[Unit]\nDescription=Nodia local installer cleanup regression\n[Service]\n'
                   'Type=oneshot\nUser=oscar\nGroup=oscar\nExecStart=/usr/bin/true\n'
                   'TimeoutStartSec=5\nTimeoutStopSec=5\nNoNewPrivileges=true\nStandardOutput=null\nStandardError=null\n')
        descriptor = os.open(unit_path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o644)
        with os.fdopen(descriptor, 'w', encoding='utf-8', newline='\n') as stream:
            stream.write(content)
            os.fchmod(stream.fileno(), 0o644)
        original_inode = unit_path.stat().st_ino
        try:
            subprocess.run(['systemd-analyze', 'verify', str(unit_path)], capture_output=True, timeout=15, check=True)
            subprocess.run(['systemctl', 'daemon-reload'], capture_output=True, timeout=15, check=True)
            subprocess.run(['systemctl', 'start', '--wait', unit], capture_output=True, timeout=15, check=True)
            install.cleanup_installation_unit(unit, content)
            self.assertFalse(unit_path.exists())
            final = install.unit_properties(unit, subprocess.run)
            self.assertEqual(final['ActiveState'], 'inactive')
            self.assertEqual(final['MainPID'], '0')
            self.assertEqual(final['FragmentPath'], '')
        finally:
            # Only this UUID, inode and unchanged root-owned synthetic unit can be removed.
            if unit_path.exists():
                info = unit_path.lstat()
                self.assertEqual(info.st_ino, original_inode)
                self.assertEqual(info.st_uid, 0)
                self.assertEqual(unit_path.read_text(encoding='utf-8'), content)
                subprocess.run(['systemctl', 'stop', unit], capture_output=True, timeout=10, check=False)
                unit_path.unlink()
                subprocess.run(['systemctl', 'daemon-reload'], capture_output=True, timeout=15, check=True)


if __name__ == '__main__':
    unittest.main()
