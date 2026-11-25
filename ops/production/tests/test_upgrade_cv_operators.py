import importlib.util
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace
import unittest
from unittest.mock import Mock, patch


OPERATORS = Path(__file__).resolve().parents[1] / 'ai-runtime'
spec = importlib.util.spec_from_file_location('upgrade_cv_operators', OPERATORS / 'upgrade-cv-operators.py')
operator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(operator)
SHA = '1' * 40


class TestUpgradeCvOperators(unittest.TestCase):
    def bundle(self):
        bundle = Path(__file__).resolve().parent / 'fixture'
        sources = {name: b'value = 1\n' for name in operator.FILES}
        own = Path(operator.__file__).resolve()
        sources[operator.OPERATOR] = own.read_bytes().replace(b'\r\n', b'\n')
        manifest = operator.encoded({'schema_version': 1, 'source_sha': SHA,
                                     'previous_sha256': {name: '1' * 64 for name in operator.REPLACE},
                                     'files': {name: operator.digest(data) for name, data in sources.items()}})
        files = {bundle / name: data for name, data in sources.items()}
        files[bundle / 'manifest.json'] = manifest
        files[own] = sources[operator.OPERATOR]
        return bundle, files, manifest

    def test_manifest_fixes_scripts_and_executable_itself(self):
        bundle, files, raw = self.bundle()
        with patch.object(operator, 'read_bundle_file', side_effect=files.__getitem__):
            manifest, actual, sources = operator.verify_bundle(bundle, operator.digest(raw))
            self.assertEqual(manifest['source_sha'], SHA)
            self.assertEqual(actual, raw)
            self.assertEqual(set(sources), operator.FILES)
            files[bundle / operator.RECEIVER] = b'value = 2\n'
            with self.assertRaisesRegex(ValueError, 'cv_operator_source_hash_mismatch'):
                operator.verify_bundle(bundle, operator.digest(raw))
            files[bundle / operator.RECEIVER] = b'value = 1\n'
            files[Path(operator.__file__).resolve()] = b'value = 3\n'
            with self.assertRaisesRegex(ValueError, 'executed_cv_operator_hash_mismatch'):
                operator.verify_bundle(bundle, operator.digest(raw))

    def test_missing_file_and_extra_operator_are_rejected_even_with_known_digest(self):
        bundle, files, raw = self.bundle()
        manifest = operator.unique_json(raw)
        manifest['files']['ai-runtime/other.py'] = manifest['files'].pop(operator.OPERATOR)
        changed = operator.encoded(manifest)
        files[bundle / 'manifest.json'] = changed
        with patch.object(operator, 'read_bundle_file', side_effect=files.__getitem__):
            with self.assertRaisesRegex(ValueError, 'cv_operator_manifest_schema_invalid'):
                operator.verify_bundle(bundle, operator.digest(changed))
            with self.assertRaisesRegex(ValueError, 'cv_operator_manifest_hash_mismatch'):
                operator.verify_bundle(bundle, operator.digest(raw))

    def test_installed_asset_drift_blocks_before_executing_any_operator(self):
        expected = 'backend-' + 'a' * 12 + '-' + 'b' * 12
        installed = {operator.LIB / name: b'pass\n' for name in operator.REPLACE}
        parents = {
            operator.STATE / 'settings.json': operator.encoded({
                'schema_version': 1,
                'assets': {operator.UPDATER: operator.digest(b'pass\n'), 'backend_update.py': '7' * 64}}),
            operator.STATE / 'receiver-settings.json': operator.encoded({
                'schema_version': 1,
                'assets': {operator.RECEIVER: operator.digest(b'pass\n')}}),
            operator.REGISTRY: b'{}'
        }
        installed[operator.LIB / 'backend_update.py'] = b'drift'
        files = {**installed, **parents}
        helper = SimpleNamespace(read_source=lambda path, **_: files[path], load_bytes=Mock())
        with patch.object(operator.os.path, 'lexists', return_value=False):
            with self.assertRaisesRegex(ValueError, 'cv_operator_installed_pin_changed'):
                operator.installed_snapshot(helper, expected, {name: operator.digest(b'pass\n') for name in operator.REPLACE})
        helper.load_bytes.assert_not_called()

    def test_readonly_preflight_changes_block_the_first_install_write(self):
        release = 'backend-' + 'a' * 12 + '-' + 'b' * 12
        manifest = {'source_sha': SHA, 'previous_sha256': {}}
        helper = (OPERATORS / 'upgrade-teacher-operators.py').read_bytes()
        current = {'current': {'release_id': release}, 'registry_sha256': '3' * 64}
        state_read = Mock(return_value=(current, {}, b'', {}, {}))
        with (
            TemporaryDirectory() as scratch,
            patch.object(operator, 'STATE', Path(scratch)),
            patch.object(operator.sys, 'platform', 'linux'),
            patch.object(operator.os, 'geteuid', return_value=0, create=True),
            patch.object(operator.os, 'umask'),
            patch.object(operator, 'with_locks'),
            patch.object(operator, 'installed_snapshot', state_read),
            patch.object(operator, 'verify_bundle', return_value=(manifest, b'{}', {operator.HELPER: helper})),
        ):
            bundle = Path(scratch)
            before = operator.operate('inspect', bundle, '2' * 64, release)
            self.assertEqual(before['status'], 'cv_operators_preflight')
            self.assertEqual(before['current']['release_id'], release)
            current['registry_sha256'] = '4' * 64
            with self.assertRaisesRegex(ValueError, 'cv_operator_preflight_changed'):
                operator.operate('install', bundle, '2' * 64, release, before['baseline_sha256'])
            self.assertEqual(list(bundle.iterdir()), [])


if __name__ == '__main__':
    unittest.main()
