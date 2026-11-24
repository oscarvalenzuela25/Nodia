"""Private admission and scoped logout with synthetic credentials only."""

import test_support
import os
from pathlib import Path
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import AsyncMock, patch

from agentic_cli import CLI_ACCOUNT_TOKEN_NAME, CliConfig, CliRunner
from agentic_profile_logout import _FILE_BACKEND_SHA512, sign_out_cli_profile
from agentic_service import AntigravityAgentService
from service_errors import ServiceError
from test_support import AppTestCase, HEADERS


LOGOUT = "/agentic/auth/login/logout"
ACTOR = {"X-Nodia-Actor-Id": "9007199254740993"}
SIGNED_OUT = (b"Fetching available models...\n"
              b"Error: Please sign in to view available models. Launch the CLI without arguments to sign in.\n")


class LogoutHttpTests(AppTestCase):
    def test_logout_requires_internal_token_actor_and_no_body(self):
        self.agentic.logout = AsyncMock()
        for headers, status in [
            ({}, 401),
            ({**ACTOR, "X-Nodia-Service-Token": "cd" * 32}, 401),
            (HEADERS, 422),
            ({**HEADERS, "X-Nodia-Actor-Id": "09007199254740993"}, 422),
        ]:
            with self.subTest(status=status):
                self.assertEqual(self.client.post(LOGOUT, headers=headers).status_code, status)
        supplied = self.client.post(LOGOUT, headers={**HEADERS, **ACTOR}, json={"home": "/untrusted"})
        self.assertEqual(supplied.status_code, 422)
        self.agentic.logout.assert_not_called()

        response = self.client.post(LOGOUT, headers={**HEADERS, **ACTOR})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json(), {"authenticated": False})
        self.assertEqual(response.headers["cache-control"], "no-store")
        self.agentic.logout.assert_awaited_once_with(self.app.state.agentic.runner.config.home.resolve())

    def test_busy_or_quarantined_profile_cannot_be_signed_out(self):
        self.agentic.logout = AsyncMock()
        profiles = self.app.state.profiles
        for purpose in ("login", "execution"):
            with self.subTest(purpose=purpose):
                with_reservation = profiles.reserve("agentic", purpose=purpose)
                self.addCleanup(with_reservation.release)
                response = self.client.post(LOGOUT, headers={**HEADERS, **ACTOR})
                self.assertEqual(response.status_code, 409)
                self.assertEqual(response.headers["x-nodia-error-code"], "runtime_busy")
                self.assertFalse(with_reservation.released)
                with_reservation.release()

        reservation = profiles.reserve("agentic", purpose="execution")
        self.addCleanup(reservation.release)
        profiles.arm_dispatch("agentic")
        profiles.quarantine("agentic")
        response = self.client.post(LOGOUT, headers={**HEADERS, **ACTOR})
        self.assertEqual(response.status_code, 409)
        marker = profiles._state_dir / (profiles.identity("agentic").split(":")[1] + ".unknown")
        self.assertEqual(marker.read_text(encoding="utf-8"), "unknown\n")
        self.agentic.logout.assert_not_called()

    def test_unconfirmed_logout_returns_safe_error_and_releases_admission(self):
        self.agentic.logout = AsyncMock(side_effect=ServiceError(
            "agentic_logout_outcome_unknown", "No se pudo confirmar.", 503))
        response = self.client.post(LOGOUT, headers={**HEADERS, **ACTOR})
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.headers["x-nodia-error-code"], "agentic_logout_outcome_unknown")
        self.assertNotIn("authenticated", response.json())
        self.app.state.profiles.reserve("agentic", purpose="login").release()


class LogoutCliEvidenceTests(unittest.IsolatedAsyncioTestCase):
    async def test_exact_noninteractive_response_and_closed_transport_required(self):
        runner = CliRunner(CliConfig(Path(sys.executable), _FILE_BACKEND_SHA512, Path.cwd()))
        self.enterContext(patch.object(runner, "has_idle_verified_transport", return_value=True))

        async def observed(args, *, timeout, stderr_observer):
            self.assertEqual(args, ["models"])
            stderr_observer(SIGNED_OUT)
            return "", 1

        self.enterContext(patch.object(runner, "run", observed))
        self.assertTrue(await runner.confirms_signed_out())
        runner.has_idle_verified_transport.return_value = False
        self.assertFalse(await runner.confirms_signed_out())
        runner.has_idle_verified_transport.return_value = True

        async def ambiguous(_args, *, timeout, stderr_observer):
            stderr_observer(SIGNED_OUT + b"Unexpected failure\n")
            return "", 1

        with patch.object(runner, "run", ambiguous):
            self.assertFalse(await runner.confirms_signed_out())

    async def test_logout_invalidates_previous_session_evidence(self):
        runner = SimpleNamespace()
        service = AntigravityAgentService(runner)
        service._available = True
        service._usage_evidence = (0, {"synthetic": True})
        service._models_evidence = (0, [{"id": "synthetic"}])
        before = service.session_generation

        with patch("agentic_service.sign_out_cli_profile", AsyncMock()):
            await service.logout(Path.cwd())

        self.assertNotEqual(service.session_generation, before)
        self.assertIsNone(service._usage_evidence)
        self.assertIsNone(service._models_evidence)
        self.assertFalse(service._analysis_lock.locked())


@unittest.skipUnless(sys.platform == "linux", "Native filesystem-backed logout requires Linux")
class LogoutProfileTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.root = Path(self.enterContext(tempfile.TemporaryDirectory())).resolve()
        self.home = self.root / "account"
        self.store = self.home / ".gemini" / "antigravity-cli"
        self.store.mkdir(parents=True)
        self.credential = self.store / CLI_ACCOUNT_TOKEN_NAME
        self.credential.write_bytes(b"synthetic-credential")
        self.credential.chmod(0o600)
        self.installation = self.store / "installation_id"
        self.installation.write_bytes(b"synthetic-installation")
        self.other_credential = self.root / "other-profile-credential"
        self.other_credential.write_bytes(b"another-session")
        self.runner = SimpleNamespace(
            config=CliConfig(Path(sys.executable), _FILE_BACKEND_SHA512, self.home),
            confirms_signed_out=AsyncMock(return_value=True), has_idle_verified_transport=lambda: True,
            verifies_binary_checksum=AsyncMock(return_value=True))
        # Simulate the private service topology irrespective of the test user's bus.
        self.enterContext(patch.dict(os.environ, {"DBUS_SESSION_BUS_ADDRESS": "", "XDG_RUNTIME_DIR": ""}))
        real_lstat = Path.lstat
        default_bus = Path("/run/user") / str(os.getuid()) / "bus"

        def lstat_without_desktop(path):
            if path == default_bus:
                raise FileNotFoundError(default_bus)
            return real_lstat(path)

        self.enterContext(patch.object(Path, "lstat", lstat_without_desktop))

    async def test_only_private_credential_is_removed_before_cli_confirmation(self):
        async def confirm():
            self.assertFalse(self.credential.exists())
            return True

        self.runner.confirms_signed_out.side_effect = confirm
        await sign_out_cli_profile(self.runner, self.home)
        self.assertFalse(self.credential.exists())
        self.assertEqual(self.installation.read_bytes(), b"synthetic-installation")
        self.assertEqual(self.other_credential.read_bytes(), b"another-session")
        await sign_out_cli_profile(self.runner, self.home)  # already signed out

    async def test_shared_keyring_and_linked_credential_fail_before_mutation(self):
        with patch.dict(os.environ, {"DBUS_SESSION_BUS_ADDRESS": "unix:path=/private-test-bus"}):
            with self.assertRaises(ServiceError) as denied:
                await sign_out_cli_profile(self.runner, self.home)
        self.assertEqual(denied.exception.code, "agentic_logout_unavailable")
        self.assertTrue(self.credential.exists())
        self.credential.unlink()
        self.credential.symlink_to(self.other_credential)
        with self.assertRaises(ServiceError) as denied:
            await sign_out_cli_profile(self.runner, self.home)
        self.assertEqual(denied.exception.code, "agentic_logout_unavailable")
        self.assertTrue(self.credential.is_symlink())
        self.assertEqual(self.other_credential.read_bytes(), b"another-session")
        self.runner.confirms_signed_out.assert_not_called()

    async def test_uncertain_native_verification_never_claims_sign_out(self):
        self.runner.confirms_signed_out.return_value = False
        with self.assertRaises(ServiceError) as error:
            await sign_out_cli_profile(self.runner, self.home)
        self.assertEqual(error.exception.code, "agentic_logout_outcome_unknown")
        self.assertFalse(self.credential.exists())

    async def test_wrong_binary_is_rejected_before_credential_mutation(self):
        binary = self.root / "binary"
        binary.write_bytes(b"wrong-binary")
        runner = CliRunner(CliConfig(binary, _FILE_BACKEND_SHA512, self.home))
        info = binary.stat()
        runner._verified_stat = (info.st_mtime_ns, info.st_size)
        with self.assertRaises(ServiceError) as error:
            await sign_out_cli_profile(runner, self.home)
        self.assertEqual(error.exception.code, "agentic_logout_unavailable")
        self.assertEqual(self.credential.read_bytes(), b"synthetic-credential")
