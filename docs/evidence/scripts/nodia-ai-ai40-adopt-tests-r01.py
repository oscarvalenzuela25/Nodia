"""Offline deployment admission regressions; no Linux/service/network side effects."""
from datetime import datetime, timedelta, timezone
import hashlib
import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import types
import unittest
from unittest.mock import patch

if sys.platform == 'win32':
    # Driver import only: never emulate system operation on Windows.
    sys.modules.setdefault('fcntl', types.ModuleType('fcntl'))
source = Path(__file__).with_name('nodia-ai-ai40-adopt-r01.py')
spec = importlib.util.spec_from_file_location('ai40_driver', source)
d = importlib.util.module_from_spec(spec)
spec.loader.exec_module(d)


class Admission(unittest.TestCase):
    def plan(self, change=None, bad_pin=False):
        value = dict(release='/opt/nodia/releases/nodia-server-ai40-r01', manifest_sha256='a' * 64, files=4300, dist_outputs=3100, knowledge_release='c' * 64, codex_profile_root='/var/lib/nodia/codex')
        if change:
            value.update(change)
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'plan.json'
            path.write_bytes(json.dumps(value).encode())
            return d.plan_file(path, 'b' * 64 if bad_pin else d.sha(path))

    def test_valid_pinned_plan(self):
        self.assertEqual(self.plan()['files'], 4300)

    def test_reject_changed_plan_pin(self):
        with self.assertRaisesRegex(ValueError, 'plan_pin_mismatch'):
            self.plan(bad_pin=True)

    def test_reject_legacy_destination(self):
        with self.assertRaisesRegex(ValueError, 'plan_invalid'):
            self.plan({'release': str(d.OLD)})

    def test_reject_path_traversal(self):
        with self.assertRaisesRegex(ValueError, 'plan_invalid'):
            self.plan({'release': str(Path('/opt/nodia/releases/nodia-server-ai40-r01')) + '/../legacy'})

    def test_reject_unknown_plan_fields(self):
        with self.assertRaisesRegex(ValueError, 'plan_invalid'):
            self.plan({'bootstrap': True})

    def test_reject_wrong_inventory(self):
        with self.assertRaisesRegex(ValueError, 'plan_invalid'):
            self.plan({'dist_outputs': 5000})

    def test_descriptor_roundtrip_is_byte_exact(self):
        payload = ('WorkingDirectory=' + str(d.OLD) + '\nExecStart=node ' + str(d.OLD) + '/dist/main.js\n').encode()
        new = d.descriptor_transition(payload, d.OLD, Path('/opt/nodia/releases/nodia-server-ai40-r01'))
        self.assertEqual(d.descriptor_transition(new, Path('/opt/nodia/releases/nodia-server-ai40-r01'), d.OLD), payload)

    def test_descriptor_refuses_mixed_eras(self):
        with self.assertRaisesRegex(ValueError, 'descriptor_source_mismatch'):
            d.descriptor_transition((str(d.OLD) + str(Path('/opt/nodia/releases/nodia-server-ai40-r01'))).encode(), d.OLD, Path('/opt/nodia/releases/nodia-server-ai40-r01'))

    def test_descriptor_refuses_drift(self):
        with self.assertRaisesRegex(ValueError, 'descriptor_source_mismatch'):
            d.descriptor_transition(str(d.OLD).encode(), d.OLD, Path('/opt/nodia/releases/nodia-server-ai40-r01'))

    def backup(self):
        began = datetime(2026, 10, 22, tzinfo=timezone.utc)
        value = dict(schema_version=1, operation='backup', status='ready', backup_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
                     cipher_sha256='b' * 64, cipher_bytes=1024, journal_sequence=3,
                     captured_at=(began + timedelta(seconds=1)).isoformat(),
                     expires_at=(began + timedelta(days=7, seconds=1)).isoformat())
        return value, began, began + timedelta(seconds=5)

    def test_fresh_ready_encrypted_backup(self):
        value, began, end = self.backup()
        self.assertEqual(d.validate_backup(value, began, end), value)

    def test_backup_rejects_old_capture(self):
        value, began, end = self.backup()
        with self.assertRaisesRegex(ValueError, 'fresh_backup_capture_or_retention_invalid'):
            d.validate_backup(value, began + timedelta(seconds=2), end)

    def test_backup_rejects_wrong_retention(self):
        value, began, end = self.backup()
        value['expires_at'] = (began + timedelta(days=30)).isoformat()
        with self.assertRaisesRegex(ValueError, 'fresh_backup_capture_or_retention_invalid'):
            d.validate_backup(value, began, end)

    def test_backup_rejects_uncertain_upload(self):
        value, began, end = self.backup()
        value['status'] = 'uploading'
        with self.assertRaisesRegex(ValueError, 'fresh_encrypted_backup_receipt_invalid'):
            d.validate_backup(value, began, end)

    def test_backup_rejects_missing_cipher_hash(self):
        value, began, end = self.backup()
        del value['cipher_sha256']
        with self.assertRaisesRegex(ValueError, 'fresh_encrypted_backup_receipt_invalid'):
            d.validate_backup(value, began, end)

    def test_errors_do_not_emit_arbitrary_stderr(self):
        self.assertEqual(d.safe_error(RuntimeError('credential=password')), 'operation_failed')
        self.assertEqual(d.safe_error(ValueError('credential=password')), 'operation_failed')
        self.assertEqual(d.safe_error(ValueError('journal_not_ready')), 'journal_not_ready')

    def test_manifest_rejects_changed_bytes_before_runtime(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder).resolve()
            path = root / 'release-manifest.json'
            (root / 'member').write_bytes(b'tampered')
            path.write_bytes(json.dumps(dict(knowledge_release='c' * 64,
                             files={'member': hashlib.sha256(b'expected').hexdigest()})).encode())
            with self.assertRaisesRegex(ValueError, 'manifest_member_mismatch'):
                d.manifest(root, d.sha(path), 'c' * 64)

    def test_manifest_rejects_traversal(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder).resolve()
            path = root / 'release-manifest.json'
            path.write_bytes(json.dumps(dict(knowledge_release='c' * 64,
                             files={'../escape': 'a' * 64})).encode())
            with self.assertRaisesRegex(ValueError, 'unsafe_manifest_member'):
                d.manifest(root, d.sha(path), 'c' * 64)


    def test_release_inventory_can_grow_without_fixed_count(self):
        self.assertEqual(self.plan({'files': 4501, 'dist_outputs': 3204})['files'], 4501)

    def test_plan_rejects_secret_path_and_boolean_count(self):
        for change in ({'codex_profile_root': '/var/lib/x/../escape'}, {'files': True}, {'knowledge_release': 'unknown'}):
            with self.subTest(change=change), self.assertRaisesRegex(ValueError, 'plan_invalid'):
                self.plan(change)

    def codex(self, payload=None, lock=False):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder).resolve()
            if payload is not None:
                (root / 'chat-jobs').mkdir()
                (root / 'chat-jobs' / 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.json').write_bytes(json.dumps(payload).encode())
            if lock:
                (root / 'native.lock').write_bytes(b'private fixture')
            fakepwd = types.SimpleNamespace(getpwnam=lambda _: types.SimpleNamespace(pw_uid=root.stat().st_uid))
            with patch.dict(sys.modules, {'pwd': fakepwd}), patch.object(d.stat, 'S_IMODE', side_effect=lambda _: 0o600 if _ & 0o170000 == 0o100000 else 0o700):
                result = d.codex_quiet(root)
                self.assertEqual((root / 'chat-jobs').exists(), payload is not None)
                return result

    def test_codex_acknowledged_terminal_is_read_only_and_quiet(self):
        self.assertEqual(self.codex({'version': 1, 'acknowledged': True, 'state': 'completed'})['records'], 1)

    def test_codex_pending_and_unknown_block_downgrade(self):
        for payload in ({'version': 1, 'acknowledged': False, 'state': 'completed'}, {'version': 1, 'acknowledged': False, 'state': 'submitted'}, {'version': 1, 'acknowledged': True, 'state': 'unknown'}):
            with self.subTest(payload=payload), self.assertRaisesRegex(ValueError, 'codex_pending_do_not_downgrade_or_stop'):
                self.codex(payload)

    def test_codex_lock_blocks_adoption_and_downgrade(self):
        with self.assertRaisesRegex(ValueError, 'codex_pending_do_not_downgrade_or_stop'):
            self.codex(lock=True)

    def test_codex_invalid_ack_or_version_never_counts_as_quiet(self):
        for payload in ({'version': True, 'acknowledged': True, 'state': 'completed'}, {'version': 1, 'acknowledged': 1, 'state': 'completed'}):
            with self.subTest(payload=payload), self.assertRaisesRegex(ValueError, 'codex_record_invalid'):
                self.codex(payload)



    def test_idle_observation_lock_requires_current_owner_and_live_certificates(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'nodia.lock'
            path.write_bytes(json.dumps({'serverPid': 123, 'runtimePid': 456, 'gated': False, 'serverBirth': '1', 'serverBoot': 'a' * 36, 'runtimeBirth': '2', 'runtimeBoot': 'a' * 36}).encode())
            with patch.object(d.stat, 'S_IMODE', return_value=0o600), patch.object(d, 'same_live_process', side_effect=[99, 456]) as certificate:
                d.idle_lock(path, frozenset([123]))
                self.assertEqual(certificate.call_count, 2)
            with patch.object(d.stat, 'S_IMODE', return_value=0o600), self.assertRaisesRegex(ValueError, 'codex_idle_lock_owner_unverified'):
                d.idle_lock(path, frozenset([999]))

    def test_idle_native_must_own_its_detached_group(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'nodia.lock'
            path.write_bytes(json.dumps({'serverPid': 123, 'runtimePid': 456, 'gated': False, 'serverBirth': '1', 'serverBoot': 'a' * 36, 'runtimeBirth': '2', 'runtimeBoot': 'a' * 36}).encode())
            with patch.object(d.stat, 'S_IMODE', return_value=0o600), patch.object(d, 'same_live_process', side_effect=[99, 777]), self.assertRaisesRegex(ValueError, 'codex_idle_native_group_invalid'):
                d.idle_lock(path, frozenset([123]))



    def test_quiesce_failure_after_api_stop_keeps_maintenance_without_worker_kill_or_timer_restart(self):
        calls, frozen = [], []
        def checked(argv, **_):
            calls.append(argv)
            return b'{}'
        recovery = {'recovery.json': {}, 'backup.json': {}, 'backup-public.pem': {}}
        helper = types.SimpleNamespace(RELEASE=d.OLD, WORK=None, NGINX=Path('/synthetic/nginx'), BACKUP=Path('/synthetic/backup'),
            CONSUMERS=('nodia-api', 'nodia-ai-worker'), TIMERS=('nodia-ai-backup.timer', 'nodia-ai-backup-rotate.timer'),
            checked=checked, active_new_processes=lambda: {'nodia-api': {'pid': 123}, 'nodia-ai-worker': {'pid': 124}},
            operator_configuration=lambda: recovery, journal=lambda _: {'unconfirmed': 0, 'coverage_closed_at': None, 'expired_backups': 0, 'coverage_from': 'fixture', 'first_sequence': 0, 'last_sequence': 0},
            state=lambda _: {'active': 'active'}, stopped=lambda _: True,
            freeze=lambda name, value: frozen.append((name, value)), write_new=lambda *_: None,
            wait_quiet=lambda *args, **kwargs: (_ for _ in ()).throw(ValueError('consumer_work_not_drained')))
        h = {'schema_and_selection': lambda: {}, 'quiet': lambda: self.quiet()}
        plan = {'release': '/opt/nodia/releases/nodia-server-ai40-r01', 'manifest_sha256': 'a' * 64, 'files': 1, 'dist_outputs': 1, 'knowledge_release': 'c' * 64, 'codex_profile_root': '/var/lib/nodia/codex'}
        args = types.SimpleNamespace(phase='adopt', execute=True, plan='synthetic', plan_sha256='b' * 64)
        with tempfile.TemporaryDirectory() as folder, patch.object(d, 'WORK', Path(folder).resolve()), \
             patch.object(d, 'plan_file', return_value=plan), patch.object(d, 'manifest', return_value={'files': {'dist/main.js': 'a' * 64}}), \
             patch.object(d, 'load_helper', return_value=(helper, h)), patch.object(d, 'native_epoch', return_value={}), \
             patch.object(d, 'codex_barrier', return_value={'pending': 0}), patch.object(d, 'codex_sdk_binary', return_value={}), patch.object(d, 'descriptor_bytes', return_value=[]), \
             patch.object(d, 'identity'), patch.object(d, 'sha', return_value='a' * 64), \
             patch.object(d.stat, 'S_IMODE', return_value=0o700), patch.object(d.os, 'geteuid', return_value=0, create=True), \
             patch.object(d.os, 'O_NOFOLLOW', 0, create=True), patch.object(d.fcntl, 'flock', create=True), \
             patch.object(d.fcntl, 'LOCK_EX', 2, create=True), patch.object(d.fcntl, 'LOCK_NB', 4, create=True), \
             patch.object(d, 'oneshots_idle'), patch.object(d, 'validate_backup', side_effect=lambda value, *_: value):
            result = d.run(args)
        self.assertEqual(result['status'], 'adopt_failed')
        self.assertTrue(result['admission_closed'])
        self.assertTrue(result['worker_left_draining_no_forced_kill'])
        self.assertTrue(result['timers_left_stopped_requires_operator'])
        self.assertFalse(any(argv[:2] == ['systemctl', 'start'] for argv in calls))
        self.assertFalse(any(argv[:3] == ['systemctl', 'stop', 'nodia-ai-worker'] for argv in calls))
        self.assertFalse(any(argv[:2] == ['systemctl', 'daemon-reload'] for argv in calls))



    def test_terminal_metadata_is_validated_by_exact_target_decoder_without_emitting_contents(self):
        calls = []
        helper = types.SimpleNamespace(checked=lambda argv, **kwargs: calls.append((argv, kwargs)) or b'{"valid":true,"records":1}')
        with patch.object(d, 'NEW', Path('/opt/nodia/releases/nodia-server-ai40-r01')), patch.object(d, 'codex_quiet', return_value={'records': 1, 'pending': 0}):
            self.assertEqual(d.codex_barrier(helper, Path('/var/lib/nodia/codex'))['pending'], 0)
        self.assertEqual(calls[0][0][:4], ['sudo', '-u', 'nodia', '/usr/local/bin/node'])
        self.assertIn('decoder.decode', calls[0][0][-1])
        self.assertNotIn('console.log(JSON.stringify(record', calls[0][0][-1])

    def test_decoder_count_drift_blocks_rollback(self):
        helper = types.SimpleNamespace(checked=lambda *args, **kwargs: b'{"valid":true,"records":2}')
        with patch.object(d, 'NEW', Path('/opt/nodia/releases/nodia-server-ai40-r01')), patch.object(d, 'codex_quiet', return_value={'records': 1, 'pending': 0}), self.assertRaisesRegex(ValueError, 'codex_decoded_inventory_changed'):
            d.codex_barrier(helper, Path('/var/lib/nodia/codex'))



    def quiet(self):
        return {'native': dict.fromkeys(('unknown_markers', 'armed_native_proofs', 'terminal_native_proofs', 'invalid_native_proofs', 'temporary_attachment_directories', 'temporary_cli_directories'), 0),
                'SQL': dict.fromkeys(('pending_jobs', 'open_attempts', 'retained_slots'), 0)}

    def test_explicit_quiet_requires_every_sql_and_native_counter_zero(self):
        self.assertEqual(d.validated_quiet(self.quiet()), self.quiet())
        for category, key in [('SQL', 'pending_jobs'), ('SQL', 'open_attempts'), ('SQL', 'retained_slots'), ('native', 'unknown_markers'), ('native', 'terminal_native_proofs')]:
            value = self.quiet(); value[category][key] = 1
            with self.subTest(category=category, key=key), self.assertRaisesRegex(ValueError, 'consumer_work_not_drained'):
                d.validated_quiet(value)
        with self.assertRaisesRegex(ValueError, 'quiet_observation_invalid'):
            d.validated_quiet({})

    def test_journal_file_larger_than_real_runtime_limit_is_rejected(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder).resolve(); (root / 'chat-jobs').mkdir()
            (root / 'chat-jobs' / 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.json').write_bytes(b' ' * 4097)
            fakepwd = types.SimpleNamespace(getpwnam=lambda _: types.SimpleNamespace(pw_uid=root.stat().st_uid))
            with patch.dict(sys.modules, {'pwd': fakepwd}), patch.object(d.stat, 'S_IMODE', side_effect=lambda _: 0o600 if _ & 0o170000 == 0o100000 else 0o700), self.assertRaisesRegex(ValueError, 'codex_record_invalid'):
                d.codex_quiet(root)



    def test_gemini_systemd_service_and_real_container_are_distinct_verified_identities(self):
        calls = []
        container = {'Name': '/nodia-gemini-microservice', 'Id': 'a' * 64, 'Image': 'sha256:' + 'b' * 64, 'State': {'Running': True, 'StartedAt': '2026-10-22T21:50:29.000Z'}, 'Config': {'Env': ['PRIVATE_SYNTHETIC=not_emitted']}, 'HostConfig': {}, 'Mounts': []}
        helper = types.SimpleNamespace(state=lambda unit: calls.append(('service', unit)) or {'active': 'active'}, checked=lambda argv: calls.append(('docker', argv)) or json.dumps([container]).encode())
        result = d.native_epoch(helper)
        self.assertEqual(calls, [('service', 'nodia-gemini-lab'), ('docker', ['docker', 'inspect', 'nodia-gemini-microservice'])])
        self.assertEqual(result['started_at'], container['State']['StartedAt'])
        self.assertNotIn('PRIVATE_SYNTHETIC', json.dumps(result))
        self.assertNotIn('Config', result)

    def test_gemini_inspect_rejects_another_container_even_with_running_process(self):
        container = {'Name': '/unexpected-container', 'Id': 'a' * 64, 'Image': 'sha256:' + 'b' * 64, 'State': {'Running': True, 'StartedAt': '2026-10-22T21:50:29.000Z'}, 'Config': {}, 'HostConfig': {}, 'Mounts': []}
        helper = types.SimpleNamespace(state=lambda _: {'active': 'active'}, checked=lambda _: json.dumps([container]).encode())
        with self.assertRaisesRegex(ValueError, 'gemini_container_identity_mismatch'):
            d.native_epoch(helper)



    def test_sdk_arg0_link_accepts_only_four_observed_leaf_names_and_exact_binary(self):
        import os
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder).resolve()
            binary = root / 'public-codex-binary'; binary.write_bytes(b'\x7fELFsynthetic')
            for name in d.CODEX_ARG0_NAMES:
                path = root / '1' / 'tmp' / 'arg0' / 'codex-arg0E6KpYe' / name
                info = types.SimpleNamespace(st_mode=0o120777, st_uid=10000, st_nlink=1)
                with patch.object(d, 'CODEX_SDK_BINARY', binary), patch.object(Path, 'lstat', return_value=info), patch.object(d.os, 'readlink', return_value=str(binary)), patch.object(Path, 'resolve', return_value=binary):
                    d.codex_arg0_link(path, root, 10000)

    def test_sdk_symlink_exception_never_applies_to_journals_locks_other_paths_or_names(self):
        root = Path('/var/lib/nodia/codex')
        for relative in ('chat-jobs/fixture.json', '1/nodia.lock', '1/tmp/arg0/codex-arg0E6KpYe/unknown', '1/tmp/other/codex-arg0E6KpYe/applypatch', '1/tmp/arg0/codex-arg0toolong/applypatch', '1/tmp/arg0/codex-arg0E6KpYe/auth.json'):
            with self.subTest(relative=relative), self.assertRaisesRegex(ValueError, 'codex_sdk_symlink_path_invalid'):
                d.codex_arg0_link(root / relative, root, 10000)

    def test_sdk_symlink_rejects_foreign_owner_or_target(self):
        root = Path('/var/lib/nodia/codex'); path = root / '1/tmp/arg0/codex-arg0E6KpYe/applypatch'
        for owner, target in ((10001, str(d.CODEX_SDK_BINARY)), (10000, '/tmp/untrusted-codex')):
            info = types.SimpleNamespace(st_mode=0o120777, st_uid=owner, st_nlink=1)
            with self.subTest(owner=owner, target=target), patch.object(Path, 'lstat', return_value=info), patch.object(d.os, 'readlink', return_value=target), self.assertRaisesRegex(ValueError, 'codex_sdk_symlink_target_invalid'):
                d.codex_arg0_link(path, root, 10000)

    def test_sdk_binary_requires_elf_execute_and_runtime_owner(self):
        import os
        with tempfile.TemporaryDirectory() as folder:
            binary = Path(folder).resolve() / 'codex'; binary.write_bytes(b'not-elf')
            fakepwd = types.SimpleNamespace(getpwnam=lambda _: types.SimpleNamespace(pw_uid=binary.stat().st_uid))
            with patch.dict(sys.modules, {'pwd': fakepwd}), patch.object(d, 'CODEX_SDK_BINARY', binary), patch.object(d.os, 'O_NOFOLLOW', 0, create=True), self.assertRaisesRegex(ValueError, 'codex_sdk_binary_invalid'):
                d.codex_sdk_binary()

    def test_pinned_0775_elf_binary_is_accepted_without_changing_permissions(self):
        import os
        import stat
        real_fstat = os.fstat
        def metadata(fd, mode):
            value = real_fstat(fd)
            return types.SimpleNamespace(st_mode=stat.S_IFREG | mode, st_uid=value.st_uid, st_size=value.st_size, st_dev=value.st_dev, st_ino=value.st_ino, st_mtime_ns=value.st_mtime_ns)
        with tempfile.TemporaryDirectory() as folder:
            binary = Path(folder).resolve() / 'codex'
            payload = b'\x7fELFpublic synthetic runtime fixture'; binary.write_bytes(payload)
            fakepwd = types.SimpleNamespace(getpwnam=lambda _: types.SimpleNamespace(pw_uid=binary.stat().st_uid))
            with patch.dict(sys.modules, {'pwd': fakepwd}), patch.object(d, 'CODEX_SDK_BINARY', binary), patch.object(d, 'CODEX_SDK_SHA256', hashlib.sha256(payload).hexdigest()), patch.object(d.os, 'O_NOFOLLOW', 0, create=True), patch.object(d.os, 'fstat', side_effect=lambda fd: metadata(fd, 0o775)):
                result = d.codex_sdk_binary()
                self.assertEqual(result['sha256'], hashlib.sha256(payload).hexdigest())
                self.assertEqual(result['bytes'], len(payload))
                self.assertEqual(result['uid'], binary.stat().st_uid)
            for mode, payload in ((0o444, b'\x7fELFfixture'), (0o775, b'not ELF fixture')):
                binary.write_bytes(payload)
                with self.subTest(mode=mode, payload=payload), patch.dict(sys.modules, {'pwd': fakepwd}), patch.object(d, 'CODEX_SDK_BINARY', binary), patch.object(d.os, 'O_NOFOLLOW', 0, create=True), patch.object(d.os, 'fstat', side_effect=lambda fd: metadata(fd, mode)), self.assertRaisesRegex(ValueError, 'codex_sdk_binary_invalid'):
                    d.codex_sdk_binary()

    def test_executable_elf_with_different_bytes_is_rejected_by_frozen_pin(self):
        import os
        import stat
        real_fstat = os.fstat
        def metadata(fd):
            value = real_fstat(fd)
            return types.SimpleNamespace(st_mode=stat.S_IFREG | 0o775, st_uid=value.st_uid, st_size=value.st_size, st_dev=value.st_dev, st_ino=value.st_ino, st_mtime_ns=value.st_mtime_ns)
        with tempfile.TemporaryDirectory() as folder:
            binary = Path(folder).resolve() / 'codex'; binary.write_bytes(b'\x7fELFdifferent synthetic executable')
            fakepwd = types.SimpleNamespace(getpwnam=lambda _: types.SimpleNamespace(pw_uid=binary.stat().st_uid))
            with patch.dict(sys.modules, {'pwd': fakepwd}), patch.object(d, 'CODEX_SDK_BINARY', binary), patch.object(d.os, 'O_NOFOLLOW', 0, create=True), patch.object(d.os, 'fstat', side_effect=metadata), self.assertRaisesRegex(ValueError, 'codex_sdk_binary_pin_mismatch'):
                d.codex_sdk_binary()

    def test_executable_elf_from_another_runtime_owner_is_rejected(self):
        import os
        import stat
        real_fstat = os.fstat
        def metadata(fd):
            value = real_fstat(fd)
            return types.SimpleNamespace(st_mode=stat.S_IFREG | 0o775, st_uid=value.st_uid, st_size=value.st_size, st_dev=value.st_dev, st_ino=value.st_ino, st_mtime_ns=value.st_mtime_ns)
        with tempfile.TemporaryDirectory() as folder:
            binary = Path(folder).resolve() / 'codex'; binary.write_bytes(b'\x7fELFsynthetic executable')
            fakepwd = types.SimpleNamespace(getpwnam=lambda _: types.SimpleNamespace(pw_uid=binary.stat().st_uid + 1))
            with patch.dict(sys.modules, {'pwd': fakepwd}), patch.object(d, 'CODEX_SDK_BINARY', binary), patch.object(d.os, 'O_NOFOLLOW', 0, create=True), patch.object(d.os, 'fstat', side_effect=metadata), self.assertRaisesRegex(ValueError, 'codex_sdk_binary_invalid'):
                d.codex_sdk_binary()


if __name__ == '__main__':
    unittest.main()
