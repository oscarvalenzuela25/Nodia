import importlib.util
import io
import json
from pathlib import Path
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import Mock, patch
import urllib.error


SOURCE = Path(__file__).resolve().parents[1] / 'ai-runtime' / 'rollout-gemini.py'
SPEC = importlib.util.spec_from_file_location('rollout_gemini', SOURCE)
rollout = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(rollout)


class BundleTrustTests(unittest.TestCase):
    def create_bundle(self, bundle):
        files = {rollout.ARCHIVE: b'fixture archive', rollout.RECEIVER: b'print("fixture receiver")\n',
                 rollout.OPERATOR: SOURCE.read_bytes()}
        for name, payload in files.items():
            (bundle / name).write_bytes(payload)
        raw = rollout.encoded({'schema_version': 1, 'source_sha': 'a' * 40, 'source_tree_sha': 'b' * 40,
                               'files': {name: rollout.sha(payload) for name, payload in files.items()}})
        (bundle / 'manifest.json').write_bytes(raw)
        return rollout.sha(raw)

    def test_rejects_drift_after_operator_reviews_bundle(self):
        with tempfile.TemporaryDirectory() as directory:
            bundle = Path(directory)
            review = self.create_bundle(bundle)
            manifest, _ = rollout.verify_bundle(bundle, review)
            self.assertEqual(manifest['source_tree_sha'], 'b' * 40)
            (bundle / rollout.ARCHIVE).write_bytes(b'modified archive')
            with self.assertRaisesRegex(ValueError, 'rollout_bundle_hash_mismatch'):
                rollout.verify_bundle(bundle, review)

    def test_rejects_manifest_that_does_not_match_the_independent_pin(self):
        with tempfile.TemporaryDirectory() as directory:
            bundle = Path(directory)
            self.create_bundle(bundle)
            with self.assertRaisesRegex(ValueError, 'reviewed_gemini_manifest_required'):
                rollout.verify_bundle(bundle, '0' * 64)


class LiveContractTests(unittest.TestCase):
    def check_schema(self, tokenless_status, paths):
        endpoint = 'http://127.0.0.1:8000/openapi.json'
        fixture_token = 'e' * 64
        gemini = Mock()
        gemini.private_file.return_value = ('GEMINI_SERVICE_TOKEN=' + fixture_token + '\n').encode()
        response = Mock()
        response.status = 200
        response.url = endpoint
        response.read = io.BytesIO(json.dumps({'paths': paths}).encode()).read
        opener = Mock()
        opener.open.side_effect = [urllib.error.HTTPError(endpoint, tokenless_status, 'fixture', {}, None),
                                   unittest.mock.MagicMock(__enter__=Mock(return_value=response))]
        with patch.object(rollout.urllib.request, 'build_opener', return_value=opener):
            rollout.verify_logout_contract(gemini)
        self.assertEqual(opener.open.call_args_list[0].args, (endpoint,))
        authenticated = opener.open.call_args_list[1].args[0]
        self.assertEqual(authenticated.get_method(), 'GET')
        self.assertEqual(authenticated.full_url, endpoint)
        self.assertEqual(authenticated.get_header('X-nodia-service-token'), fixture_token)

    def test_probes_only_the_read_only_private_schema(self):
        self.check_schema(401, {'/agentic/auth/login/logout': {'post': {}}})

    def test_rejects_a_healthy_adapter_without_logout(self):
        with self.assertRaisesRegex(ValueError, 'gemini_logout_route_missing'):
            self.check_schema(401, {})

    def test_rejects_wrong_protection_status(self):
        with self.assertRaisesRegex(ValueError, 'private_gemini_schema_authentication_unverified'):
            self.check_schema(404, {'/agentic/auth/login/logout': {'post': {}}})


class RolloutWindowTests(unittest.TestCase):
    def run_window(self, fail_contract):
        old_image, new_image = 'sha256:' + 'a' * 64, 'sha256:' + 'b' * 64
        source, tree, digest = 'c' * 40, 'd' * 40, 'e' * 64
        events = []
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory)
            state, lib, updates, runtime = (base / name for name in ('state', 'lib', 'updates', 'runtime'))
            for path in (state, lib, updates, runtime):
                path.mkdir()
            current = base / 'backend-aaaaaaaaaaaa-bbbbbbbbbbbb'
            current.mkdir()
            attestation, install_lock = state / 'gemini-rollout-current.json', base / 'install.lock'
            for path in (install_lock, updates / 'receiver.lock'):
                path.touch()
            (updates / 'settings.json').write_bytes(rollout.encoded({'service_hashes': {'nodia-api.service': 'fixture'}}))
            (updates / 'receiver-settings.json').write_bytes(rollout.encoded({'assets': {rollout.RECEIVER: 'f' * 64}}))
            (lib / rollout.RECEIVER).write_bytes(b'old receiver')
            host = Mock()
            host.maintenance.side_effect = lambda enabled: events.append('maintenance-on' if enabled else 'maintenance-off')
            host.pause_timers.side_effect = lambda: events.append('pause-timers') or {}
            host.restore_timers.side_effect = lambda _: events.append('restore-timers')
            host.node_action.return_value = {'quiescent': True, 'read_only': True, 'client_tls_authorized': True}
            host.stop_writers.side_effect = lambda: events.append('stop-writers')
            host.command.side_effect = lambda command, *_: events.append(' '.join(command[1:]))
            updater = SimpleNamespace(
                Host=Mock(return_value=host), SERVICES=('nodia-api.service', 'nodia-ai-worker.service'),
                MAINTENANCE=base / 'maintenance',
                protected=lambda *_a, **_k: SimpleNamespace(st_size=0),
                atomic_write=lambda path, data, *_: path.write_bytes(data),
            )
            gemini = Mock(NAME='nodia-gemini-microservice', CONFIG=base / 'image.json')
            gemini.inspect.return_value = {'running': False, 'image': old_image}
            gemini.image_id.return_value = old_image
            gemini.private_file.return_value = rollout.encoded({'image_id': old_image})
            ready = {'current': {'release_id': current.name}, 'blocked': False,
                     'application': {'api_active': True, 'worker_active': True}}
            receiver = SimpleNamespace(deployment_status=lambda: {
                **ready, **({'gemini_runtime': json.loads(attestation.read_bytes())} if attestation.exists() else {}),
            })
            activation = Mock()
            activation.preflight.side_effect = lambda: events.append('post-stop-preflight')
            modules = {'update-backend.py': updater, 'backend_update.py': object(), rollout.RECEIVER: receiver,
                       'gemini-host.py': gemini, 'prepare-ai-runtime.py': object(), 'activate-ai-runtime.py': activation}
            fake_fcntl = SimpleNamespace(LOCK_EX=1, LOCK_NB=2, flock=lambda *_: None)

            def check_contract(_):
                events.append('probe-contract')
                if fail_contract:
                    raise ValueError('gemini_logout_route_missing')

            with patch.multiple(rollout, LIB=lib, RUNTIME=runtime, STATE=state, UPDATES=updates,
                                CURRENT=current, ATTESTATION=attestation, INSTALL_LOCK=install_lock), \
                    patch.dict(sys.modules, {'fcntl': fake_fcntl}), patch.object(rollout.sys, 'platform', 'linux'), \
                    patch.object(rollout.os, 'geteuid', return_value=0, create=True), patch.object(rollout.os, 'umask'), \
                    patch.object(rollout, 'installed_module', side_effect=lambda path: modules[path.name]), \
                    patch.object(rollout, 'pinned_assets'), patch.object(rollout, 'verify_bundle', return_value=(
                        {'source_sha': source, 'source_tree_sha': tree},
                        {rollout.RECEIVER: b'def verify_running_gemini_image(image):\n    return image\n',
                         rollout.ARCHIVE: b'synthetic archive'})), \
                    patch.object(rollout, 'build_image', side_effect=lambda *_: events.append('build-and-test') or new_image), \
                    patch.object(rollout, 'verify_logout_contract', side_effect=check_contract):
                if fail_contract:
                    with self.assertRaisesRegex(ValueError, 'gemini_logout_route_missing'):
                        rollout.activate(base, digest, current.name)
                    self.assertFalse(attestation.exists())
                    self.assertEqual((lib / rollout.RECEIVER).read_bytes(), b'old receiver')
                    self.assertFalse(any('start nodia-api.service' in event for event in events))
                    self.assertTrue((state / ('gemini-rollout-' + tree) / 'failure.json').is_file())
                else:
                    result = rollout.activate(base, digest, current.name)
                    self.assertEqual(result['gemini_runtime']['source_tree_sha'], tree)
                    self.assertEqual(result['gemini_runtime']['image_id'], new_image)
                    self.assertFalse(result['logout_requested'])
                    self.assertLess(events.index('build-and-test'), events.index('maintenance-on'))
                    self.assertLess(events.index('stop-writers'), events.index('stop nodia-gemini.service'))
                    self.assertLess(events.index('post-stop-preflight'), events.index('stop nodia-gemini.service'))
                    self.assertLess(events.index('probe-contract'), events.index('start nodia-api.service nodia-ai-worker.service'))
                    self.assertEqual(events[-2:], ['maintenance-off', 'restore-timers'])

    def test_validates_before_switch_and_attests_after_service_restoration(self):
        self.run_window(False)

    def test_missing_route_keeps_old_container_and_blocks_publication(self):
        self.run_window(True)
