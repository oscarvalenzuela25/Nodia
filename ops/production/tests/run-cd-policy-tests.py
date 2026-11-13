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
                           ('test_backend_update*.py', 'test_deploy_receiver.py'))
result = unittest.TextTestRunner(verbosity=1).run(suite)
if result.skipped:
    raise SystemExit('cd_policy_regressions_must_not_be_skipped')
raise SystemExit(0 if result.wasSuccessful() else 1)
