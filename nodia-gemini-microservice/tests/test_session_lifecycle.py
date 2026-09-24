import asyncio
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import gemini_service
import session_store


class FakeClient:
    instances = []

    def __init__(self, psid, psidts):
        self.cookies = {"__Secure-1PSID": psid, "__Secure-1PSIDTS": psidts}
        self.account_status = SimpleNamespace(name="AVAILABLE")
        self.closed = False
        FakeClient.instances.append(self)

    async def init(self, **kwargs):
        return None

    async def close(self):
        self.closed = True


class SessionLifecycleTest(unittest.IsolatedAsyncioTestCase):
    async def test_rotated_cookie_survives_repeated_calls_and_restart(self):
        FakeClient.instances.clear()
        with tempfile.TemporaryDirectory() as directory:
            store = Path(directory) / "cookies.json"
            with patch.object(gemini_service, "GeminiClient", FakeClient), \
                 patch.object(gemini_service, "SESSION_FILE", store), \
                 patch.object(session_store, "SESSION_FILE", store):
                service = gemini_service.GeminiWebService()
                service._read_env = lambda: ("login-psid", "login-ts", "gemini-flash")
                service.browser_manager.has_profile = lambda: False
                await service.init_client()

                FakeClient.instances[-1].cookies["__Secure-1PSIDTS"] = "rotated-ts"
                service._persist_live_cookies()
                await service.init_client()
                self.assertEqual(len(FakeClient.instances), 1)
                self.assertEqual(session_store.read_session(), ("login-psid", "rotated-ts"))
                await service.close()

                restarted = gemini_service.GeminiWebService()
                restarted._read_env = lambda: ("login-psid", "login-ts", "gemini-flash")
                restarted.browser_manager.has_profile = lambda: False
                await restarted.init_client()
                self.assertEqual(FakeClient.instances[-1].cookies["__Secure-1PSIDTS"], "rotated-ts")
                await restarted.close()

    async def test_new_login_and_auth_recovery_replace_failed_client(self):
        FakeClient.instances.clear()
        with tempfile.TemporaryDirectory() as directory:
            store = Path(directory) / "cookies.json"
            credentials = ["first-psid", "first-ts"]
            with patch.object(gemini_service, "GeminiClient", FakeClient), \
                 patch.object(gemini_service, "SESSION_FILE", store), \
                 patch.object(session_store, "SESSION_FILE", store):
                service = gemini_service.GeminiWebService()
                service._read_env = lambda: (*credentials, "gemini-flash")
                service.browser_manager.has_profile = lambda: True
                await service.init_client()
                first_client = service.client

                credentials[:] = ["new-login", "new-ts"]
                await service.init_client()
                self.assertTrue(first_client.closed)
                self.assertEqual(service.client.cookies["__Secure-1PSID"], "new-login")

                failed_client = service.client

                async def refresh():
                    credentials[:] = ["recovered", "recovered-ts"]
                    return {"secure_1psid": "recovered", "secure_1psidts": "recovered-ts"}

                service.browser_manager.refresh_cookies_headless = refresh
                await service.recover_auth(failed_client)
                self.assertTrue(failed_client.closed)
                self.assertEqual(session_store.read_session(), ("recovered", "recovered-ts"))
                await service.close()


if __name__ == "__main__":
    unittest.main()
