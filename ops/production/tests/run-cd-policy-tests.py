#!/usr/bin/env python3
"""Run the ownership regressions in disposable Linux root, without skipping them."""
import os
from pathlib import Path
import sys
import unittest


if sys.platform != 'linux' or os.geteuid() != 0 or not Path('/.dockerenv').exists():
    raise SystemExit('isolated_linux_root_container_required')

directory = str(Path(__file__).resolve().parent)
loader = unittest.TestLoader()
suite = unittest.TestSuite(loader.discover(directory, pattern=pattern) for pattern in
                           ('test_backend_update*.py', 'test_deploy_receiver.py', 'test_archive_completed_backend_upload.py',
                            'test_refresh_deploy_gateway.py', 'test_backend_upload.py', 'test_refresh_upload_transport.py',
                            'test_ai_runtime_updater.py', 'test_teacher_runtime.py',
                            'test_teacher_operator_upgrade.py', 'test_activate_teacher_window.py',
                            'test_capture_teacher_backup.py', 'test_refresh_post_migration_cd.py',
                            'test_post_migration_reconciliation_helper.py'))
result = unittest.TextTestRunner(verbosity=1).run(suite)
if result.skipped:
    raise SystemExit('cd_policy_regressions_must_not_be_skipped')
raise SystemExit(0 if result.wasSuccessful() else 1)
