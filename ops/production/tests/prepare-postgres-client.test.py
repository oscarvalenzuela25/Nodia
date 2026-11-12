"""Pure key/installation-policy fixtures. No root, network, APT operation or installation."""
from pathlib import Path
import subprocess
import tempfile
import unittest

SCRIPT = Path(__file__).resolve().parents[1] / 'prepare-postgres-client.sh'


class ClientPolicyTests(unittest.TestCase):
    def run_function(self, function, content):
        with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8') as fixture:
            fixture.write(content)
            fixture.flush()
            return subprocess.run(['bash', '-c', 'source "$1"; "$2" "$3"', 'test', str(SCRIPT), function, fixture.name],
                                  capture_output=True, text=True, timeout=10)

    def test_exact_primary_fingerprint_single_key(self):
        good = 'pub:-:4096:1:keyid:0:::::::\nfpr:::::::::B97B0AFCAA1A47F044F244A07FCC7D46ACCC4CF8:\n'
        self.assertEqual(self.run_function('valid_key_fingerprint', good).returncode, 0)
        self.assertNotEqual(self.run_function('valid_key_fingerprint', good.replace('B97B', 'A97B')).returncode, 0)
        self.assertNotEqual(self.run_function('valid_key_fingerprint', good + 'pub:-:4096:1:foreign:0::::::::\n').returncode, 0)

    def test_client_only_install_and_idempotent_noop(self):
        for plan in ('Inst postgresql-client-16 (16.15-1.pgdg26.04+2 PostgreSQL [amd64])\nConf postgresql-client-16 (16.15-1.pgdg26.04+2)\n',
                     '0 upgraded, 0 newly installed, 0 to remove and 0 not upgraded.\n'):
            self.assertEqual(self.run_function('valid_install_plan', plan).returncode, 0)

    def test_dependency_upgrade_removal_server_and_unrelated_configuration_are_rejected(self):
        for plan in ('Inst libpq5 (19.0)\n', 'Inst postgresql-client-common (300)\n', 'Inst postgresql-16 (16.15)\n',
                     'Remv postgresql-client-18\n', 'Purg something\n', 'Conf unrelated-package\n',
                     'Inst postgresql-client-16 (16.15)\nInst postgresql-client-16 (16.15)\n'):
            self.assertNotEqual(self.run_function('valid_install_plan', plan).returncode, 0)

    def test_large_policy_output_does_not_kill_producer_under_pipefail(self):
        # APT may keep writing after the Candidate line; the parser must drain the pipe.
        producer = "import sys; sys.stdout.write('  Candidate: 16.15-1.pgdg26.04+2\\n' + 'x' * 1048576 + '\\n')"
        result = subprocess.run(['bash', '-c',
                                 'source "$1"; candidate=$(python3 -c "$2" | extract_candidate); printf "%s\\n" "$candidate"',
                                 'test', str(SCRIPT), producer], capture_output=True, text=True, timeout=10)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout.strip(), '16.15-1.pgdg26.04+2')

    def test_source_and_negative_pin_remain_scoped(self):
        result = subprocess.run(['bash', '-c', 'source "$1"; source_text; preference_text', 'test', str(SCRIPT)],
                                capture_output=True, text=True, timeout=10)
        self.assertEqual(result.returncode, 0)
        self.assertIn('Suites: resolute-pgdg', result.stdout)
        self.assertIn('Signed-By: /usr/share/postgresql-common/pgdg/nodia-postgresql.asc', result.stdout)
        self.assertIn('Package: postgresql-client-16', result.stdout)
        self.assertIn('Package: *\nPin: origin apt.postgresql.org\nPin-Priority: -1', result.stdout)
        self.assertNotIn('trusted=yes', result.stdout)


if __name__ == '__main__':
    unittest.main()
