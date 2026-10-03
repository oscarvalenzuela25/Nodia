import test_support
import asyncio
import errno
import os
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import browser_manager


class FakePlaywright:
    async def __aenter__(self):
        return SimpleNamespace()

    async def __aexit__(self, *_args):
        return None


class FakePage:
    def __init__(self, *, block_navigation=False, url="https://accounts.google.com/"):
        self.url = url
        self.navigation_started = asyncio.Event()
        self.block_navigation = block_navigation

    async def goto(self, *_args, **_kwargs):
        self.navigation_started.set()
        if self.block_navigation:
            await asyncio.Event().wait()

    def is_closed(self):
        return False


class FakeContext:
    def __init__(self, page):
        self.pages = [page]
        self.closed = False

    async def close(self):
        self.closed = True


class EnvFileTest(unittest.TestCase):
    def test_updates_cookies_without_losing_token_or_other_configuration(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / ".env"
            target.write_text(
                "HOST=127.0.0.1\nGEMINI_SERVICE_TOKEN=internal-test-token\n"
                "SECURE_1PSID=old\nGEMINI_SECURE_1PSID=duplicate\n"
                "GEMINI_SECURE_1PSIDTS=old-ts\nGEMINI_MODEL=gemini-flash\n",
                encoding="utf-8",
            )
            with patch.object(browser_manager, "ENV_FILE", target), \
                 patch.object(browser_manager, "save_session"), \
                 patch.dict(os.environ, {}, clear=False):
                browser_manager.update_env_file("new-psid", "new-ts")
                self.assertEqual(os.environ["GEMINI_SECURE_1PSID"], "new-psid")
            lines = target.read_text(encoding="utf-8").splitlines()
            self.assertIn("GEMINI_SERVICE_TOKEN=internal-test-token", lines)
            self.assertIn("GEMINI_MODEL=gemini-flash", lines)
            self.assertEqual(lines.count("GEMINI_SECURE_1PSID=new-psid"), 1)
            self.assertEqual(lines.count("GEMINI_SECURE_1PSIDTS=new-ts"), 1)
            self.assertNotIn("SECURE_1PSID=old", lines)

    def test_new_env_fails_closed_and_uses_loopback(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / ".env"
            with patch.object(browser_manager, "ENV_FILE", target), \
                 patch.object(browser_manager, "save_session"), \
                 patch.dict(os.environ, {}, clear=False):
                browser_manager.update_env_file("new-psid", "new-ts")
            content = target.read_text(encoding="utf-8")
            self.assertIn("HOST=127.0.0.1\n", content)
            self.assertIn("GEMINI_SERVICE_TOKEN=\n", content)

    def test_read_only_env_uses_session_store_without_changing_existing_file(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / ".env"
            original = "GEMINI_SERVICE_TOKEN=internal-test-token\nGEMINI_SECURE_1PSID=old\n"
            target.write_text(original, encoding="utf-8")
            with patch.object(browser_manager, "ENV_FILE", target), \
                 patch.object(browser_manager, "save_session") as saved, \
                 patch.object(browser_manager.os, "replace", side_effect=OSError(errno.EROFS, "read only")), \
                 patch.dict(os.environ, {"GEMINI_SECURE_1PSID": "old"}, clear=False):
                browser_manager.update_env_file("new-psid", "new-ts")
                self.assertEqual(os.environ["GEMINI_SECURE_1PSID"], "new-psid")
                saved.assert_called_once_with("new-psid", "new-ts")
            self.assertEqual(target.read_text(encoding="utf-8"), original)
            self.assertEqual(list(Path(directory).iterdir()), [target])


class BrowserCleanupTest(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        profile_patch = patch.object(browser_manager, "PROFILE_DIR", Path(directory.name) / "profile")
        profile_patch.start()
        self.addCleanup(profile_patch.stop)

    async def test_cancelled_interactive_login_closes_browser_context(self):
        page = FakePage(block_navigation=True)
        context = FakeContext(page)
        manager = browser_manager.BrowserCookieManager()
        with patch.object(browser_manager, "async_playwright", return_value=FakePlaywright()), \
             patch.object(manager, "_launch_context", AsyncMock(return_value=context)):
            task = asyncio.create_task(manager.login_interactive())
            await asyncio.wait_for(page.navigation_started.wait(), timeout=1)
            task.cancel()
            with self.assertRaises(asyncio.CancelledError):
                await task
        self.assertTrue(context.closed)

    async def test_failed_headless_refresh_closes_browser_context(self):
        page = FakePage()
        page.goto = AsyncMock(side_effect=RuntimeError("navigation failed"))
        context = FakeContext(page)
        manager = browser_manager.BrowserCookieManager()
        with patch.object(browser_manager, "async_playwright", return_value=FakePlaywright()), \
             patch.object(manager, "_launch_context", AsyncMock(return_value=context)):
            result = await manager.refresh_cookies_headless()
        self.assertIsNone(result)
        self.assertTrue(context.closed)

    async def test_successful_interactive_login_closes_validator_and_browser(self):
        page = FakePage(url="https://gemini.google.com/app")
        context = FakeContext(page)
        manager = browser_manager.BrowserCookieManager()
        validation_client = SimpleNamespace(
            account_status=SimpleNamespace(name="AVAILABLE"),
            init=AsyncMock(),
            close=AsyncMock(),
        )
        with patch.object(browser_manager, "async_playwright", return_value=FakePlaywright()), \
             patch.object(manager, "_launch_context", AsyncMock(return_value=context)), \
             patch.object(manager, "_extract_cookies", AsyncMock(return_value={
                 "secure_1psid": "test-psid", "secure_1psidts": "test-ts",
             })), \
             patch.object(browser_manager, "GeminiClient", return_value=validation_client), \
             patch.object(browser_manager, "update_env_file") as save_cookies:
            result = await manager.login_interactive(timeout_seconds=1)
        self.assertTrue(result["success"])
        self.assertTrue(context.closed)
        validation_client.close.assert_awaited_once()
        save_cookies.assert_called_once_with("test-psid", "test-ts")
