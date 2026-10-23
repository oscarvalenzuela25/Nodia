"""Pure guards for the fresh epoch MCP wrapper; no SDK or runtime imports."""
import importlib.util
from pathlib import Path
import unittest

source = Path(__file__).with_name('nodia-ai-ai38-web-stream-recovery-mcp-r04.py')
spec = importlib.util.spec_from_file_location('ai38_MCP_control_tests', source)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class Guards(unittest.TestCase):
    def fixture(self):
        return dict(status='adopt_completed', phase='fix', plan_sha256=module.PLAN_SHA,
            new_epoch_requires_explicit_inference_MCP_acceptance=True,
            public_sources_after={str(i): 'SYNTHETIC' for i in range(49)},
            quiet_after=dict(SQL=dict(pending_jobs=0, open_attempts=0, retained_slots=0),
                native={key: 0 for key in ('unknown_markers', 'armed_native_proofs', 'terminal_native_proofs',
                    'invalid_native_proofs', 'temporary_attachment_directories', 'temporary_cli_directories')}),
            epoch_after=dict(container_id='SYNTHETIC', image_id=module.IMAGE, started_at_utc='SYNTHETIC'))

    def test_current_completed_adoption(self):
        self.assertEqual(module.adopted_epoch(self.fixture())['image'], module.IMAGE)

    def test_failed_transition_rejected(self):
        value = self.fixture()
        value['status'] = 'adopt_failed'
        with self.assertRaisesRegex(ValueError, 'fresh_exact_adoption_required'):
            module.adopted_epoch(value)

    def test_old_image_rejected(self):
        value = self.fixture()
        value['epoch_after']['image_id'] = 'sha256:' + 'a' * 64
        with self.assertRaisesRegex(ValueError, 'unexpected_adopted_image'):
            module.adopted_epoch(value)

    def test_pending_SQL_rejected(self):
        value = self.fixture()
        value['quiet_after']['SQL']['retained_slots'] = 1
        with self.assertRaisesRegex(ValueError, 'adoption_inventory_or_SQL_not_quiet'):
            module.adopted_epoch(value)

    def test_pending_native_rejected(self):
        value = self.fixture()
        value['quiet_after']['native']['unknown_markers'] = 1
        with self.assertRaisesRegex(ValueError, 'adoption_native_not_quiet'):
            module.adopted_epoch(value)


if __name__ == '__main__':
    unittest.main()
