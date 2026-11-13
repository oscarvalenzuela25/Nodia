"""Operator invariants, synthetic only: no Docker, network or account used."""
import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch
import urllib.error

SPEC = importlib.util.spec_from_file_location("gemini_host", Path(__file__).with_name("gemini-host.py"))
HOST = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(HOST)


class ContainerPolicy(unittest.TestCase):
    def policy(self):
        return {'user': '10001:10001', 'privileged': False, 'cap_add': None, 'cap_drop': ['ALL'],
                'ports': {'8000/tcp': [{'HostIp': '127.0.0.1', 'HostPort': '8000'}]},
                'cgroupns': 'private', 'restart': 'no', 'memory': 2147483648, 'pids': 256,
                'mounts': [{'Type': 'bind', 'Source': str(HOST.STATE / 'session_state'), 'Destination': '/app/session_state'},
                           {'Type': 'bind', 'Source': str(HOST.STATE / 'profile'), 'Destination': '/home/nodia/agentic_profile'}]}

    def test_only_loopback_and_private_scoped_cgroups(self):
        arguments = HOST.create_arguments("sha256:" + "a" * 64)
        self.assertIn("127.0.0.1:8000:8000", arguments)
        self.assertIn("--cgroupns=private", arguments)
        self.assertIn("--restart=no", arguments)
        self.assertIn("--cap-drop=ALL", arguments)
        self.assertNotIn("--privileged", arguments)
        self.assertNotIn("/var/run/docker.sock", " ".join(arguments))
        self.assertNotIn("/sys/fs/cgroup", " ".join(arguments))
        self.assertIn("10001:10001", arguments)

    def test_persistent_state_and_credentials_are_not_in_the_image_or_argv(self):
        arguments = HOST.create_arguments("sha256:" + "a" * 64)
        self.assertIn("--env-file", arguments)
        self.assertIn(str(HOST.ENV), arguments)
        self.assertNotIn("GEMINI_SERVICE_TOKEN=", " ".join(arguments))
        self.assertIn("--log-driver=local", arguments)
        self.assertEqual(sum("type=bind" in value for value in arguments), 2)

    def test_no_mutable_image_tags(self):
        for value in ["latest", "nodia:latest", "sha256:" + "a" * 63, "sha256:" + "g" * 64]:
            with self.subTest(value=value), self.assertRaisesRegex(RuntimeError, "image_identity_invalid"):
                HOST.create_arguments(value)

    def test_no_replace_or_start_for_existing_conflicting_container(self):
        image = "sha256:" + "a" * 64
        with self.assertRaisesRegex(RuntimeError, "existing_container_conflict"):
            HOST.validate_existing({"image": "sha256:" + "b" * 64, "label": {}}, image)
        with self.assertRaisesRegex(RuntimeError, "container_already_running"):
            HOST.validate_existing({"image": image, "label": {"sh.nodia.runtime": "agentic"},
                                    "running": True, "pid": 123}, image)
        HOST.validate_existing({**self.policy(), "image": image, "label": {"sh.nodia.runtime": "agentic"},
                                "running": False, "pid": 0}, image)

    def test_rejects_public_port_or_unbounded_existing_container(self):
        for changes in [{'ports': {'8000/tcp': [{'HostIp': '0.0.0.0', 'HostPort': '8000'}]}},
                        {'privileged': True}, {'restart': 'always'}, {'cgroupns': 'host'},
                        {'cap_add': ['SYS_ADMIN']}, {'pids': 0}]:
            with self.subTest(changes=changes), self.assertRaisesRegex(RuntimeError, 'container_security_policy_mismatch'):
                HOST.validate_policy({**self.policy(), **changes})

    def test_systemd_rechecks_containment_every_start_and_stops_failed_start(self):
        unit = Path(__file__).with_name("nodia-gemini.service").read_text()
        self.assertIn("ExecStartPost=/usr/bin/python3 -I /usr/local/lib/nodia/ai-runtime/gemini-host.py attach", unit)
        self.assertIn("ExecStopPost=-/usr/bin/docker stop", unit)
        self.assertIn("Restart=on-failure", unit)

    def test_bootstrap_checks_protected_transport_without_requiring_a_logged_in_account(self):
        urls = []
        class Response:
            status = 200
            def __init__(self, url): self.url = url
            def __enter__(self): return self
            def __exit__(self, *_): return False
            def read(self, _): return b'<html>synthetic docs</html>'
        class Opener:
            def open(self, request, timeout):
                url = request if isinstance(request, str) else request.full_url
                urls.append(url)
                if url.endswith('/docs') and request.get_header('X-nodia-service-token') != 'a' * 64:
                    raise urllib.error.HTTPError(url, 401, 'synthetic', None, None)
                return Response(url)
        with patch.object(HOST, 'private_file', return_value=('GEMINI_SERVICE_TOKEN=' + 'a' * 64 + '\n').encode()), \
             patch.object(HOST.urllib.request, 'build_opener', return_value=Opener()), \
             patch.object(HOST, 'run', side_effect=['', 'verified-cli']):
            result = HOST.check()
        self.assertIsNone(result['authenticated'])
        self.assertFalse(result['session_observed'])
        self.assertTrue(result['invalid_tokens_rejected'])
        self.assertFalse(any('/agentic/status' in url for url in urls))

    def test_attachment_waits_for_actual_container_generation(self):
        image = 'sha256:' + 'a' * 64
        stopped = {**self.policy(), 'running': False, 'pid': 0, 'image': image,
                   'started': 'before', 'label': {'sh.nodia.runtime': 'agentic'}}
        running = {**stopped, 'running': True, 'pid': 123, 'started': 'after'}
        with patch.object(HOST, 'image_id', return_value=image), \
             patch.object(HOST, 'inspect', side_effect=[stopped, running, running]), \
             patch.object(HOST.time, 'sleep'), patch.object(HOST, 'run') as run:
            HOST.attach()
        self.assertEqual(run.call_count, 1)
        self.assertIn('attach-login-cgroup.py', run.call_args.args[0][2])

    def test_attachment_rejects_a_restart_during_attestation(self):
        image = 'sha256:' + 'a' * 64
        running = {**self.policy(), 'running': True, 'pid': 123, 'image': image,
                   'started': 'before', 'label': {'sh.nodia.runtime': 'agentic'}}
        with patch.object(HOST, 'image_id', return_value=image), \
             patch.object(HOST, 'inspect', side_effect=[running, {**running, 'started': 'after'}]), \
             patch.object(HOST, 'run'), self.assertRaisesRegex(RuntimeError, 'container_changed_during_attachment'):
            HOST.attach()


if __name__ == "__main__":
    unittest.main()
