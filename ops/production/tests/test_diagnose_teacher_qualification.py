import importlib.util
from pathlib import Path
import subprocess
import unittest

SPEC = importlib.util.spec_from_file_location('teacher_diagnostic', Path(__file__).parents[1] / 'diagnose-teacher-qualification.py')
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class DiagnosticWrapperTests(unittest.TestCase):
    def helper(self):
        return MODULE.LIBRARY / ('diagnose-teacher-qualification-' + 'a' * 64 + '.mjs')

    def test_oneshot_uses_private_environment_as_nodia_with_readonly_sandbox_and_fixed_release(self):
        cmd = MODULE.diagnostic_command(self.helper(), 'nodia-teacher-diagnostic-' + 'b' * 32 + '.service')
        for item in ['--property=User=nodia', '--property=Group=nodia', '--property=EnvironmentFile=/etc/nodia/runtime.env',
                     '--setenv=PGSSLMODE=verify-full', '--property=ProtectSystem=strict', '--property=NoNewPrivileges=yes',
                     '--property=RuntimeMaxSec=60s', '--collect', '--pipe', '--wait', f'--working-directory={MODULE.RELEASE}']:
            self.assertIn(item, cmd)
        self.assertEqual(cmd[-2:], ['/usr/local/bin/node', str(self.helper())])
        self.assertFalse(any(item in cmd for item in ['restart', 'enable', 'start', 'nodia-api.service', 'nodia-ai-worker.service']))

    def test_runner_cleans_only_its_unique_transient_unit_even_after_timeout(self):
        for fail in [False, True]:
            calls = []
            def run(args, **kwargs):
                calls.append((args, kwargs))
                if len(calls) == 1 and fail:
                    raise subprocess.TimeoutExpired('synthetic', 75)
                return subprocess.CompletedProcess(args, 0)
            if fail:
                with self.assertRaises(subprocess.TimeoutExpired):
                    MODULE.run_helper(self.helper(), run)
            else:
                self.assertEqual(MODULE.run_helper(self.helper(), run), 0)
            self.assertEqual(len(calls), 2)
            unit = next(arg.removeprefix('--unit=') for arg in calls[0][0] if arg.startswith('--unit='))
            self.assertEqual(calls[1][0], ['/usr/bin/systemctl', 'stop', unit])
            self.assertEqual(calls[0][1]['env'], MODULE.SAFE_ENV)

    def test_rejects_arbitrary_unit_and_helper_path(self):
        with self.assertRaises(ValueError):
            MODULE.diagnostic_command(self.helper(), 'nodia-api.service')
        with self.assertRaises(ValueError):
            MODULE.diagnostic_command(Path('/home/nodia-admin/untrusted.mjs'), 'nodia-teacher-diagnostic-' + 'b' * 32 + '.service')


if __name__ == '__main__':
    unittest.main()
