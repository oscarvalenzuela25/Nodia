#!/usr/bin/env python3
"""Account-free Linux integration. Run only in the disposable codex-tests image.

docker build -f codex-tests.Dockerfile -t nodia-codex-keyring-qa .
docker run --rm --network none nodia-codex-keyring-qa
"""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import shutil
import signal
import subprocess
import tempfile
import time
import unittest

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('codex_provision', HERE / 'codex-provision.py')
provision = importlib.util.module_from_spec(spec)
spec.loader.exec_module(provision)


class CodexProvisionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if os.environ.get('NODIA_ISOLATED_CODEX_KEYRING_TEST') != '1' or os.geteuid() != 0:
            raise RuntimeError('isolated_disposable_container_required')

    def test_01_rejects_symlink_and_mutable_ancestor_and_hardlink(self):
        root = Path(tempfile.mkdtemp(prefix='codex-', dir='/opt'))
        try:
            path = root / 'file'
            path.write_bytes(b'public-fixture')
            path.chmod(0o600)
            link = root / 'link'
            link.symlink_to(path)
            with self.assertRaisesRegex(RuntimeError, 'symlink_rejected'):
                provision.read_regular(link)
            nested = root / 'nested'
            nested.mkdir(mode=0o777)
            nested.chmod(0o777)
            child = nested / 'file'
            child.write_bytes(b'fixture')
            with self.assertRaisesRegex(RuntimeError, 'parent_directory_unsafe'):
                provision.read_regular(child)
            os.link(path, root / 'hardlink')
            with self.assertRaisesRegex(RuntimeError, 'file_hardlink_rejected'):
                provision.read_regular(path)
        finally:
            shutil.rmtree(root)

    def test_02_private_persistent_nonce_and_fail_closed_preparation(self):
        first = provision.prepare()
        self.assertEqual(first['status'], 'prepared')
        self.assertFalse(first['services_started'])
        self.assertFalse(Path('/etc/systemd/system/nodia-api.service.d').exists())
        self.assertFalse(Path('/etc/systemd/system/nodia-ai-worker.service.d').exists())
        credential = Path('/etc/nodia/codex-keyring.password')
        credential_hash = hashlib.sha256(credential.read_bytes()).hexdigest()
        second = provision.prepare()
        self.assertTrue(second['credential_reused'])
        self.assertEqual(hashlib.sha256(credential.read_bytes()).hexdigest(), credential_hash)
        self.assertEqual(credential.stat().st_mode & 0o777, 0o600)
        self.assertEqual(Path('/var/lib/nodia/codex-keyring').stat().st_mode & 0o777, 0o700)
        # A changed descriptor must not get silently replaced on a subsequent setup.
        installed = Path('/etc/systemd/system/nodia-codex-keyring.service')
        original = installed.read_bytes()
        installed.write_bytes(original + b'# unsafe unmanaged delta\n')
        with self.assertRaisesRegex(RuntimeError, 'existing_descriptor_conflict'):
            provision.prepare()
        self.assertTrue(installed.read_bytes().endswith(b'# unsafe unmanaged delta\n'))
        installed.write_bytes(original)
        # Manual credential delivery here mimics systemd LoadCredential; it is synthetic.
        credentials = Path('/run/codex-test-credentials')
        credentials.mkdir(mode=0o750)
        os.chown(credentials, 0, 900)
        credentials.chmod(0o750)
        delivered = credentials / 'password'
        delivered.write_bytes(credential.read_bytes())
        os.chown(delivered, 0, 900)
        delivered.chmod(0o440)
        for path in ['/run/nodia-codex', '/run/nodia-codex-keyring', '/var/lib/nodia/home']:
            Path(path).mkdir(mode=0o700)
            os.chown(path, 900, 900)
        environment = {'PATH': '/usr/bin:/bin', 'HOME': '/var/lib/nodia/home',
            'XDG_DATA_HOME': '/var/lib/nodia/codex-keyring',
            'XDG_RUNTIME_DIR': '/run/nodia-codex-keyring',
            'DBUS_SESSION_BUS_ADDRESS': 'unix:path=/run/nodia-codex/bus',
            'CREDENTIALS_DIRECTORY': str(credentials)}
        def as_nodia():
            os.setgroups([])
            os.setgid(900)
            os.setuid(900)
        helper = '/usr/local/lib/nodia/ai-runtime/codex-keyring.py'
        def call(*args, success=True):
            result = subprocess.run(['/usr/bin/python3', '-I', helper, *map(str, args)],
                env=environment, preexec_fn=as_nodia, capture_output=True, text=True, timeout=18)
            if success:
                self.assertEqual(result.returncode, 0, result.stderr)
            else:
                self.assertNotEqual(result.returncode, 0)
            return result
        bus = subprocess.Popen(['/usr/bin/dbus-daemon', '--config-file=/usr/local/lib/nodia/ai-runtime/codex-bus.conf',
            '--nofork', '--nopidfile'], env=environment, preexec_fn=as_nodia,
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        keyring = None
        def start():
            daemon = subprocess.Popen(['/usr/bin/python3', '-I', helper, 'run'], env=environment,
                preexec_fn=as_nodia, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            try:
                call('initialize', daemon.pid)
            except Exception:
                if daemon.poll() is None:
                    daemon.terminate()
                daemon.wait(timeout=8)
                raise
            return daemon
        def stop(process):
            if process and process.poll() is None:
                process.send_signal(signal.SIGTERM)
                process.wait(timeout=8)
        try:
            call('bus-ready')
            keyring = start()
            token = '1' * 32
            self.assertEqual(json.loads(call('nonce', 'create', token, keyring.pid).stdout)['real_entries_read'], 0)
            for path in Path('/var/lib/nodia/codex-keyring').rglob('*'):
                if path.is_file():
                    self.assertNotIn(('NODIA-OWNED-' + token).encode(), path.read_bytes())
            call('nonce', 'read-delete', token, keyring.pid + 1, success=False)
            call('nonce', 'create', token, keyring.pid, success=False)
            stop(keyring)
            keyring = start()
            receipt = json.loads(call('nonce', 'read-delete', token, keyring.pid).stdout)
            self.assertTrue(receipt['nonce_deleted'])
            self.assertEqual(receipt['real_entries_read'], 0)
            call('nonce', 'read-delete', token, keyring.pid, success=False)
            # Encrypted store must not contain our synthetic secret plaintext.
            for path in Path('/var/lib/nodia/codex-keyring').rglob('*'):
                if path.is_file():
                    self.assertNotIn(('NODIA-OWNED-' + token).encode(), path.read_bytes())
            # Missing password with existing encrypted state never creates a replacement.
            credential.unlink()
            with self.assertRaisesRegex(RuntimeError, 'managed_credential_missing'):
                provision.prepare()
            self.assertFalse(credential.exists())
            print(json.dumps({'status': 'persistent_keyring_verified',
                'private_bus': True, 'same_bus_across_keyring_restart': True,
                'nonce_persisted_across_restart': True, 'nonce_deleted': True,
                'wrong_owner_rejected': True, 'missing_credential_preserves_store': True,
                'real_entries_read': 0, 'provider_login_requested': False}))
        finally:
            stop(keyring)
            stop(bus)

    def test_03_unmanaged_credentials_and_store_are_never_adopted_or_reset(self):
        root = Path(tempfile.mkdtemp(prefix='codex-conflicts-', dir='/opt'))
        names = ['MANIFEST', 'PASSWORD', 'STORE', 'FILES', 'WORKER_DROPIN']
        originals = {name: getattr(provision, name) for name in names}
        try:
            for name in ['MANIFEST', 'PASSWORD', 'STORE', 'WORKER_DROPIN']:
                setattr(provision, name, root / str(originals[name]).lstrip('/'))
            provision.FILES = {name: (root / str(target).lstrip('/'), mode)
                for name, (target, mode) in originals['FILES'].items()}
            provision.make_directory(provision.PASSWORD.parent, 0o700)
            provision.PASSWORD.write_bytes(b'do-not-replace-this-synthetic-password')
            with self.assertRaisesRegex(RuntimeError, 'unmanaged_password_present'):
                provision.prepare()
            self.assertEqual(provision.PASSWORD.read_bytes(), b'do-not-replace-this-synthetic-password')
            self.assertFalse(provision.MANIFEST.exists())
            provision.PASSWORD.unlink()
            provision.make_directory(provision.STORE, 0o700, 900, 900)
            marker = provision.STORE / 'existing-state'
            marker.write_bytes(b'do-not-reset-this-synthetic-store')
            with self.assertRaisesRegex(RuntimeError, 'unmanaged_store_present'):
                provision.prepare()
            self.assertEqual(marker.read_bytes(), b'do-not-reset-this-synthetic-store')
            self.assertFalse(provision.MANIFEST.exists())
        finally:
            for name, value in originals.items():
                setattr(provision, name, value)
            shutil.rmtree(root)


if __name__ == '__main__':
    unittest.main(verbosity=2)
