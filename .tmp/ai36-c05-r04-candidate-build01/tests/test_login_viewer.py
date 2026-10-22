import test_support
import asyncio
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock
from pydantic import ValidationError

from interactive_login import InteractiveLoginManager
from login_viewer import LoginViewer, LoginInput
from service_errors import ServiceError
from test_support import AppTestCase, HEADERS


def fake_page(url="https://accounts.google.com/signin"):
    return SimpleNamespace(url=url, is_closed=lambda: False, main_frame=object(),
                           on=Mock(), remove_listener=Mock(), screenshot=AsyncMock(return_value=b"\xff\xd8\xff\xd9"),
                           mouse=SimpleNamespace(click=AsyncMock(), wheel=AsyncMock()),
                           keyboard=SimpleNamespace(insert_text=AsyncMock(), press=AsyncMock()))


class ViewerTest(unittest.IsolatedAsyncioTestCase):
    async def test_command_is_consumed_once_and_navigation_invalidates_it(self):
        viewer = LoginViewer()
        page = fake_page()
        viewer.attach(page)
        frame = await viewer.frame()
        command = LoginInput(frame_id=frame.frame_id, action="text", text="synthetic-text")
        await viewer.input(command)
        page.keyboard.insert_text.assert_awaited_once_with("synthetic-text")
        with self.assertRaises(ServiceError) as rejected:
            await viewer.input(command)
        self.assertEqual(rejected.exception.code, "viewer_stale_frame")
        current = await viewer.frame()
        viewer._navigated(page.main_frame)
        with self.assertRaises(ServiceError):
            await viewer.input(LoginInput(frame_id=current.frame_id, action="key", key="Enter"))
        viewer.clear()
        self.assertFalse((await viewer.frame()).ready)

    async def test_unknown_hosts_and_local_urls_never_receive_input_or_pixels(self):
        for url in ("file:///etc/passwd", "http://127.0.0.1/", "https://accounts.google.com.evil.example/", "https://example.com"):
            viewer = LoginViewer()
            page = fake_page(url)
            viewer.attach(page)
            with self.assertRaises(ServiceError):
                await viewer.frame()
            with self.assertRaises(ServiceError):
                await viewer.input(LoginInput(frame_id="a" * 32, action="key", key="Enter"))
            page.screenshot.assert_not_awaited()
            page.keyboard.press.assert_not_awaited()

    async def test_overlapping_frames_are_rejected_and_navigation_during_capture_discards_pixels(self):
        viewer = LoginViewer()
        page = fake_page()
        viewer.attach(page)
        started, release = asyncio.Event(), asyncio.Event()
        async def capture(**kwargs):
            started.set()
            await release.wait()
            return b"\xff\xd8\xff\xd9"
        page.screenshot.side_effect = capture
        task = asyncio.create_task(viewer.frame())
        await started.wait()
        with self.assertRaises(ServiceError) as rejected:
            await viewer.frame()
        self.assertEqual(rejected.exception.code, "viewer_busy")
        viewer._navigated(page.main_frame)
        release.set()
        self.assertFalse((await task).ready)

    async def test_large_pixels_and_failed_input_are_bounded_without_replay(self):
        viewer = LoginViewer()
        page = fake_page()
        viewer.attach(page)
        page.screenshot.return_value = b"x" * 786_433
        with self.assertRaises(ServiceError):
            await viewer.frame()
        page.screenshot.return_value = b"\xff\xd8\xff\xd9"
        frame = await viewer.frame()
        page.keyboard.press.side_effect = RuntimeError("private-data-must-not-leak")
        command = LoginInput(frame_id=frame.frame_id, action="key", key="Enter")
        with self.assertRaises(ServiceError) as rejected:
            await viewer.input(command)
        self.assertNotIn("private-data", str(rejected.exception))
        with self.assertRaises(ServiceError):
            await viewer.input(command)
        page.keyboard.press.assert_awaited_once()

    async def test_owner_is_required_and_cancelled_job_cannot_be_replaced_until_cleanup(self):
        manager = InteractiveLoginManager()
        async def runner():
            await asyncio.Event().wait()
            return True
        job = manager.start(runner, "9007199254740993")
        self.assertIsNone(manager.status(job["id"], "9007199254740992"))
        self.assertIsNone(manager.cancel(job["id"], "9007199254740992"))
        manager.cancel(job["id"], "9007199254740993")
        self.assertIsNone(manager.start(runner, "7"))
        await manager.close()


class ViewerContractTest(unittest.TestCase):
    def test_strict_commands_reject_oversize_mixed_actions_and_browser_shortcuts(self):
        for fields in ({"action": "key", "key": "Control+L"}, {"action": "text", "text": "x" * 2049},
                       {"action": "click", "x": True, "y": 0}, {"action": "click", "x": 1280, "y": 0},
                       {"action": "text", "text": "x", "key": "Enter"}, {"action": "scroll", "delta": "10"}):
            with self.assertRaises(ValidationError):
                LoginInput(frame_id="a" * 32, **fields)


class ViewerHttpTest(AppTestCase):
    def test_private_auth_actor_ownership_no_store_and_terminal_denial(self):
        actor = {**HEADERS, "X-Nodia-Actor-Id": "7"}
        self.web.browser_manager.viewer = SimpleNamespace(frame=AsyncMock(return_value={
            "ready": False, "frame_id": None, "image": None, "width": 1280, "height": 850}), input=AsyncMock())
        # The real login task remains pending; no browser or real credentials are used.
        async def pending(**kwargs):
            await asyncio.Event().wait()
            return {}
        self.web.browser_manager.login_interactive.side_effect = pending
        result = self.client.post("/auth/login/start", headers=actor)
        self.assertEqual(result.status_code, 200)
        job = result.json()["id"]
        path = f"/auth/login/{job}"
        self.assertEqual(self.client.get(path + "/frame").status_code, 401)
        self.assertEqual(self.client.get(path + "/frame", headers=HEADERS).status_code, 422)
        other = {**HEADERS, "X-Nodia-Actor-Id": "8"}
        for suffix in ("", "/frame"):
            self.assertEqual(self.client.get(path + suffix, headers=other).status_code, 404)
        self.assertEqual(self.client.post(path + "/cancel", headers=other).status_code, 404)
        self.assertEqual(self.client.post(path + "/input", headers=other,
            json={"frame_id": "a" * 32, "action": "key", "key": "Enter"}).status_code, 404)
        response = self.client.get(path + "/frame", headers=actor)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers["cache-control"], "no-store")
        response = self.client.post(path + "/input", headers=actor, content=b"x" * 8193)
        self.assertEqual(response.status_code, 413)
        self.web.browser_manager.viewer.input.assert_not_awaited()
        self.client.post(path + "/cancel", headers=actor)
        self.assertEqual(self.client.get(path + "/frame", headers=actor).status_code, 409)
