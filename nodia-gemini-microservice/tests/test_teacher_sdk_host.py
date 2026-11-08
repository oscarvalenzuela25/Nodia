import test_support
import asyncio
import importlib.util
import io
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch
from urllib.parse import urlencode

from teacher_sdk_host import (LoginURLWriter, clean_environment, execute, login_and_rotate,
    owned_temporary_directory, selection_matches)


class TeacherSDKHostTests(unittest.TestCase):
    @unittest.skipUnless(os.name == "posix", "Owned workspace permissions require POSIX")
    def test_temp_home_env_and_stdlib_cache_stay_inside_owner_cwd(self):
        previous = Path.cwd()
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            root.chmod(0o700)
            try:
                os.chdir(root)
                with patch.dict(os.environ, {name: str(root) for name in ("HOME", "USERPROFILE", "TMPDIR")}), \
                     patch.object(tempfile, "tempdir", "/tmp"):
                    with owned_temporary_directory("sdk-test-") as owned:
                        self.assertTrue(owned.is_relative_to(root))
                        home = owned / "HOME"
                        home.mkdir(mode=0o700)
                        clean_environment(home, Path("/synthetic-unused-harness"))
                        for name in ("HOME", "USERPROFILE", "TMPDIR", "GEMINI_HOME"):
                            self.assertTrue(Path(os.environ[name]).is_relative_to(root), name)
                        self.assertEqual(tempfile.gettempdir(), os.environ["TMPDIR"])
                        self.assertEqual(Path(os.environ["TMPDIR"]).stat().st_mode & 0o777, 0o700)
                    self.assertFalse(owned.exists())
            finally:
                os.chdir(previous)

    @unittest.skipUnless(os.name == "posix", "Owned workspace permissions require POSIX")
    def test_bad_cwd_or_environment_rejects_before_auth_or_sdk(self):
        previous = Path.cwd()
        calls = []
        command = SimpleNamespace(binding=lambda: {})
        def forbidden(_path):
            calls.append("auth")
            raise AssertionError("Authentication must not run")
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            try:
                os.chdir(root)
                for mode, wrong_env in ((0o750, False), (0o700, True)):
                    root.chmod(mode)
                    values = {name: str(root) for name in ("HOME", "USERPROFILE", "TMPDIR")}
                    if wrong_env:
                        values["TMPDIR"] = "/tmp"
                    with patch.dict(os.environ, values), self.assertRaisesRegex(ValueError, "workspace_unavailable"):
                        asyncio.run(execute(command, root / "profile", Path("/synthetic-unused"), "a" * 64,
                            "b" * 64, manager_factory=forbidden))
                self.assertEqual(calls, [])
            finally:
                os.chdir(previous)

    @unittest.skipUnless(os.name == "posix", "Private epoch permissions require POSIX; exercised by isolated Linux fixture")
    def test_epoch_rotates_only_after_success_and_rejects_symlinks(self):
        with tempfile.TemporaryDirectory() as directory:
            profile = Path(directory)
            profile.chmod(0o700)
            manager = SimpleNamespace(get_access_token=lambda: "synthetic-not-account")
            login_and_rotate(manager, profile)
            target = profile / "session_epoch"
            first = target.read_bytes()
            self.assertRegex(first.decode(), r"^[0-9a-f]{32}$")
            self.assertEqual(target.stat().st_mode & 0o777, 0o600)
            login_and_rotate(manager, profile)
            second = target.read_bytes()
            self.assertNotEqual(first, second)
            def fail():
                raise ValueError("synthetic_failed_auth")
            with self.assertRaises(ValueError):
                login_and_rotate(SimpleNamespace(get_access_token=fail), profile)
            self.assertEqual(target.read_bytes(), second)
            target.unlink()
            outside = profile / "other-file"
            outside.write_bytes(b"unchanged")
            target.symlink_to(outside)
            with self.assertRaises(ValueError):
                login_and_rotate(SimpleNamespace(get_access_token=lambda: self.fail("Unsafe epoch must reject before OAuth")), profile)
            self.assertEqual(outside.read_bytes(), b"unchanged")
    def test_import_has_no_sdk_profile_manifest_or_network_effect(self):
        root = Path(__file__).resolve().parents[1]
        for name in ("teacher_sdk_policy", "teacher_sdk_guard", "teacher_sdk_host"):
            spec = importlib.util.spec_from_file_location(name + "_import_probe", root / (name + ".py"))
            module = importlib.util.module_from_spec(spec)
            with patch.object(Path, "open", side_effect=AssertionError("runtime file IO forbidden")), \
                 patch("os.open", side_effect=AssertionError("runtime fd IO forbidden")), \
                 patch.object(socket, "create_connection", side_effect=AssertionError("network forbidden")):
                spec.loader.exec_module(module)
        result = subprocess.run([sys.executable, "-I", str(root / "teacher_sdk_host.py")], capture_output=True, timeout=5, check=True)
        self.assertEqual(json.loads(result.stdout)["event"], "inert")
        self.assertEqual(result.stderr, b"")

    def test_catalog_does_not_select_default_alias_or_disabled_model(self):
        raw = {"models": {"exact": {}}, "agentModelSorts": [{"groups": [{"modelIds": ["exact"]}]}], "defaultAgentModelId": "other"}
        self.assertTrue(selection_matches(raw, "exact"))
        self.assertFalse(selection_matches(raw, "missing"))
        raw["models"]["exact"]["disabled"] = True
        self.assertFalse(selection_matches(raw, "exact"))
        with self.assertRaisesRegex(ValueError, "catalog_unavailable"):
            selection_matches({"models": {"exact": {}}}, "exact")

    def test_login_outputs_only_official_private_pkce_url(self):
        target = io.StringIO()
        writer = LoginURLWriter(target)
        url = "https://accounts.google.com/o/oauth2/auth?" + urlencode(dict(redirect_uri="http://127.0.0.1:43210/callback",
            state="synthetic-state", code_challenge="synthetic-challenge", code_challenge_method="S256"))
        writer.write("untrusted diagnostic suppressed\n")
        writer.write("Open the following link to authenticate the ACP server: " + url + "\n")
        self.assertEqual(target.getvalue(), "NODIA_TEACHER_SDK_LOGIN_URL=" + url + "\n")
        for bad in (url.replace("accounts.google.com", "example.invalid"), url + "&access_token=synthetic"):
            with self.assertRaises(ValueError):
                LoginURLWriter(io.StringIO()).write("Open the following link to authenticate the ACP server: " + bad + "\n")
