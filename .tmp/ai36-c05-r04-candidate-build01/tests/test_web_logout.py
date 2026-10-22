import test_support
import asyncio
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch

import browser_manager
import gemini_service
import session_store
from service_errors import ServiceError
from test_session_lifecycle import FakeClient
from test_support import AppTestCase, HEADERS
from web_session_cleanup import clear_web_files


class WebLogoutTest(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        root = Path(self.enterContext(tempfile.TemporaryDirectory())).resolve()
        self.profile = root / "profile"
        self.store = root / "session" / "cookies.json"
        self.enterContext(patch.object(browser_manager, "PROFILE_DIR", self.profile))
        self.enterContext(patch.object(gemini_service, "SESSION_FILE", self.store))
        self.enterContext(patch.object(session_store, "SESSION_FILE", self.store))
        self.enterContext(patch.object(gemini_service, "GeminiClient", FakeClient))
        self.enterContext(patch.object(gemini_service.GeminiWebService, "supported_options", return_value={"extended_thinking": True}))
        self.service = gemini_service.GeminiWebService()
        self.service._read_env = lambda: ("old-account", "old-ts", "")
        await self.service.init_client()
        self.addAsyncCleanup(self.service.close)

    async def test_clears_profile_cache_and_client_and_blocks_seed_after_restart(self):
        nested = self.profile / "Default"
        nested.mkdir()
        (nested / "Cookies").write_text("synthetic Google profile")
        cache = self.store.parent / ".cached_cookies_synthetic.json"
        cache.write_text("synthetic SDK cache")
        other = self.store.parent / "unrelated-state.json"
        other.write_text("preserved")
        old = self.service.client
        await self.service.disconnect()
        self.assertTrue(old.closed)
        self.assertIsNone(self.service._persist_task)
        self.assertIsNone(self.service.client)
        self.assertEqual(list(self.profile.iterdir()), [])
        self.assertFalse(cache.exists())
        self.assertTrue(other.exists())
        self.assertEqual(session_store.disconnected_state(), "complete")
        session_store.save_session("late-old-account", "late-ts")
        self.assertIsNone(session_store.read_session())
        restarted = gemini_service.GeminiWebService()
        restarted._read_env = self.service._read_env
        restarted.browser_manager.refresh_cookies_headless = AsyncMock()
        await restarted.init_client(force_refresh=True)
        self.assertFalse(restarted.is_initialized)
        restarted.browser_manager.refresh_cookies_headless.assert_not_awaited()
        self.assertFalse((await restarted.get_status())["has_cookies"])
        # Only a new, explicit login replaces the durable logout marker.
        session_store.save_session("new-account", "new-ts", explicit_login=True)
        await restarted.init_client()
        self.assertEqual(restarted.client.cookies["__Secure-1PSID"], "new-account")
        await restarted.close()

    async def test_busy_operations_leave_account_untouched(self):
        for lock in (self.service._analysis_lock, self.service._quota_lock,
                     self.service._client_lock, self.service.browser_manager.lock):
            async with lock:
                with self.assertRaises(ServiceError) as error:
                    await self.service.disconnect()
                self.assertEqual(error.exception.status, 409)
                self.assertTrue(self.service.is_initialized)
                self.assertIsNone(session_store.disconnected_state())

    async def test_logout_also_works_without_a_previous_persisted_session(self):
        await self.service.close()
        self.store.unlink()
        self.store.parent.rmdir()
        await self.service.disconnect()
        self.assertEqual(session_store.disconnected_state(), "complete")
        self.assertEqual(list(self.profile.iterdir()), [])

    async def test_explicit_login_does_not_restore_read_only_old_seed_on_health_or_restart(self):
        await self.service.disconnect()
        session_store.save_session("second-account", "second-ts", explicit_login=True)
        # Same path as the interactive login runner; .env still contains the old account.
        await self.service.reload_cookies("second-account", "second-ts")
        new = self.service.client
        await self.service.init_client()
        self.assertIs(self.service.client, new)
        self.assertEqual(new.cookies["__Secure-1PSID"], "second-account")
        await self.service.close()
        restarted = gemini_service.GeminiWebService()
        restarted._read_env = self.service._read_env
        seed = self.profile.parent / "seed.env"
        seed.write_text("GEMINI_SECURE_1PSID=old-account\nGEMINI_SECURE_1PSIDTS=old-ts\n")
        future = self.store.stat().st_mtime + 100
        os.utime(seed, (future, future))
        with patch.object(gemini_service, "ENV_FILE", seed):
            await restarted.init_client()
        self.assertEqual(restarted.client.cookies["__Secure-1PSID"], "second-account")
        await restarted.close()

    async def test_failed_cleanup_stays_disconnected_and_requires_retry(self):
        with patch.object(gemini_service, "clear_web_files", side_effect=OSError("synthetic failure")):
            with self.assertRaises(ServiceError) as error:
                await self.service.disconnect()
        self.assertEqual(error.exception.status, 503)
        self.assertEqual(session_store.disconnected_state(), "pending")
        with self.assertRaises(ServiceError):
            self.service.assert_login_allowed()
        with self.assertRaises(RuntimeError):
            session_store.save_session("new-account", "new-ts", explicit_login=True)
        await self.service.init_client()
        self.assertFalse(self.service.is_initialized)
        await self.service.disconnect()
        self.service.assert_login_allowed()

    async def test_sdk_close_failure_blocks_login_and_retry_removes_close_time_cache(self):
        old = self.service.client
        async def close():
            (self.store.parent / ".cached_cookies_late.json").write_text("synthetic late cache")
            old.closed = True
        with patch.object(old, "close", new=AsyncMock(side_effect=RuntimeError("synthetic SDK error"))):
            with self.assertRaises(ServiceError) as error:
                await self.service.disconnect()
        self.assertEqual(error.exception.status, 503)
        with self.assertRaises(ServiceError):
            self.service.assert_login_allowed()
        old.close = close
        await self.service.disconnect()
        self.assertTrue(old.closed)
        self.assertEqual(list(self.store.parent.iterdir()), [self.store])

    async def test_symlink_root_is_rejected_before_external_files_are_touched(self):
        outside = self.profile.parent / "outside-root"
        outside.mkdir()
        target = outside / "keep.txt"
        target.write_text("preserved")
        self.profile.rmdir()
        try:
            self.profile.symlink_to(outside, target_is_directory=True)
        except OSError:
            self.profile.mkdir()
            self.skipTest("Creating symlinks requires Windows privileges; exercised in Linux")
        with self.assertRaises(ServiceError):
            await self.service.disconnect()
        self.assertTrue(target.exists())
        self.assertIsNone(session_store.disconnected_state())
        self.assertTrue(self.service.is_initialized)

    async def test_cancelled_cleanup_retains_locks_until_thread_finishes(self):
        import threading
        entered, release = threading.Event(), threading.Event()
        def cleanup(*args):
            entered.set()
            release.wait(3)
            clear_web_files(*args)
        with patch.object(gemini_service, "clear_web_files", side_effect=cleanup):
            task = asyncio.create_task(self.service.disconnect())
            await asyncio.to_thread(entered.wait, 2)
            task.cancel()
            await asyncio.sleep(0)
            self.assertTrue(self.service._analysis_lock.locked())
            with self.assertRaises(ServiceError):
                self.service.assert_login_allowed()
            release.set()
            with self.assertRaises(asyncio.CancelledError):
                await task
        self.assertFalse(self.service._analysis_lock.locked())
        self.assertEqual(session_store.disconnected_state(), "pending")

    async def test_profile_symlink_does_not_remove_external_directory(self):
        outside = self.profile.parent / "outside"
        outside.mkdir()
        target = outside / "keep.txt"
        target.write_text("preserved")
        link = self.profile / "external"
        try:
            link.symlink_to(outside, target_is_directory=True)
        except OSError:
            self.skipTest("Creating symlinks requires Windows privileges; exercised in Linux")
        await self.service.disconnect()
        self.assertTrue(target.exists())
        self.assertFalse(link.exists())


class LogoutRouteTest(AppTestCase):
    def test_private_auth_actor_and_contract(self):
        for headers in ({}, {"X-Nodia-Service-Token": "incorrect"}):
            self.assertEqual(self.client.post("/auth/logout", headers=headers).status_code, 401)
        self.assertEqual(self.client.post("/auth/logout", headers=HEADERS).status_code, 422)
        self.assertEqual(self.client.post("/auth/logout", headers={**HEADERS, "X-Nodia-Actor-Id": "07"}).status_code, 422)
        self.web.disconnect.assert_not_awaited()
        response = self.client.post("/auth/logout", headers={**HEADERS, "X-Nodia-Actor-Id": "7"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "disconnected"})
        self.assertEqual(response.headers["cache-control"], "no-store")
        self.web.disconnect.assert_awaited_once()

    def test_active_login_cannot_be_cleared_by_another_admin(self):
        with patch.object(type(self.app.state.login), "is_active", new=property(lambda _: True)):
            response = self.client.post("/auth/logout", headers={**HEADERS, "X-Nodia-Actor-Id": "9"})
        self.assertEqual(response.status_code, 409)
        self.web.disconnect.assert_not_awaited()
