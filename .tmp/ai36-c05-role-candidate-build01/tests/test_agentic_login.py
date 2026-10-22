import test_support
import asyncio
import json
import os
import signal
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch
from urllib.parse import urlencode

from agentic_cli import CliConfig
from agentic_login import AgenticLoginManager
from agentic_login_terminal import LoginTerminalProtocol, valid_authorization_url
from agentic_service import AntigravityAgentService
from service_errors import ServiceError
from test_agentic_cli import QUOTA, report
from test_support import HEADERS, TOKEN, fake_web

# Synthetic OAuth metadata, never real codes, clients or credentials.
URL = "https://accounts.google.com/o/oauth2/auth?" + urlencode({
    "client_id": "synthetic-client", "redirect_uri": "https://antigravity.google/oauth-callback",
    "response_type": "code", "code_challenge_method": "S256", "code_challenge": "synthetic-challenge",
    "state": "synthetic-state", "scope": "openid",
})
# users.id is PostgreSQL BIGINT serialized as a decimal string by Nodia Server.
# Adjacent IDs above JavaScript's safe integer range must remain distinct.
OWNER = "9007199254740993"
OTHER = "9007199254740994"


class TerminalProtocolTest(unittest.TestCase):
    def test_split_queries_and_wrapped_url_use_complete_hyperlink(self):
        protocol = LoginTerminalProtocol()
        self.assertEqual(protocol.feed("\x1b[")[0], [])
        self.assertEqual(protocol.feed(">c")[0], ["\x1b[>0;1;0c"])
        writes, _ = protocol.feed("Select login method:\n > 1. Google OAuth")
        self.assertEqual(writes, ["\r"])
        self.assertEqual(protocol.feed("Select login method:")[0], [])
        protocol.feed("\x1b]8;;" + URL + "\x1b\\Wrapped\r\nlink\x1b]8;;\x1b\\")
        _, challenge = protocol.feed("After authenticating, copy the code displayed in the browser")
        self.assertEqual(challenge, URL)
        self.assertIsNone(protocol.feed("copy the code displayed in the browser")[1])

    def test_non_google_menu_is_not_automatically_selected(self):
        self.assertEqual(LoginTerminalProtocol().feed("Select login method:\n > 1. Google Cloud project"), ([], None))

    def test_real_cli_hyperlink_with_id_and_bell_terminator(self):
        protocol = LoginTerminalProtocol()
        protocol.feed("\x1b]8;id=synthetic-link;" + URL + "\x07Wrapped\r\nlink\x1b]8;;\x07")
        _, challenge = protocol.feed("copy the code displayed in the browser")
        self.assertEqual(challenge, URL)

    def test_redraws_while_waiting_for_google_do_not_accumulate_terminal_history(self):
        protocol = LoginTerminalProtocol()
        protocol.feed("\x1b]8;id=synthetic;" + URL + "\x07copy the code displayed in the browser")
        for _ in range(100):
            self.assertEqual(protocol.feed("x" * 1024), ([], None))
        self.assertLessEqual(len(protocol.buffer), 32)

    def test_uses_the_latest_challenge_when_the_cli_redraws_its_link(self):
        protocol = LoginTerminalProtocol()
        replacement = URL.replace("synthetic-state", "replacement-state")
        protocol.feed("\x1b]8;id=first;" + URL + "\x07older link\x1b]8;;\x07")
        protocol.feed("\x1b]8;id=current;" + replacement + "\x07current link\x1b]8;;\x07")
        self.assertEqual(protocol.feed("copy the code displayed in the browser")[1], replacement)

    def test_rejects_urls_that_can_leak_credentials_or_redirect_elsewhere(self):
        for value in (URL.replace("accounts.google.com", "accounts.google.com.evil.test"),
                      URL.replace("https:", "http:"), URL + "&code=synthetic-secret",
                      URL + "&access_token=synthetic-secret", URL + "#fragment",
                      URL + "&state=duplicate", URL.replace("antigravity.google", "evil.test"), "javascript:alert(1)"):
            self.assertFalse(valid_authorization_url(value))
        self.assertTrue(valid_authorization_url(URL))

    def test_bounds_terminal_output(self):
        with self.assertRaises(ValueError):
            LoginTerminalProtocol().feed("x" * 65_537)

    def test_real_pty_only_emits_safe_events_and_accepts_one_code(self):
        with tempfile.TemporaryDirectory() as directory:
            home = Path(directory)
            script = home / "synthetic_cli.py"
            script.write_text("import sys,time\n"
                "print('Select login method:\\n > 1. Google OAuth',flush=True)\n"
                "sys.stdin.readline()\n"
                f"print({repr(chr(27) + ']8;;' + URL + chr(27) + chr(92))},flush=True)\n"
                "print('After authenticating, copy the code displayed in the browser',flush=True)\n"
                "code=sys.stdin.readline()\nprint('SECRET ECHO '+code,flush=True)\n"
                "time.sleep(20)\n", encoding="utf-8")
            bridge = ("from agentic_login_terminal import run_terminal;"
                      f"run_terminal({sys.executable!r},{directory!r},{str(home / 'log')!r},"
                      f"command=[{sys.executable!r},{str(script)!r}])")
            process = subprocess.Popen([sys.executable, "-u", "-c", bridge], stdin=subprocess.PIPE,
                stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True,
                **({"start_new_session": True} if os.name != "nt" else {}))
            try:
                # Run pipe reads in a worker with a deadline so regressions cannot hang CI.
                import concurrent.futures
                executor = concurrent.futures.ThreadPoolExecutor(max_workers=1)
                try:
                    first = executor.submit(process.stdout.readline).result(timeout=15)
                    self.assertEqual(json.loads(first), {"event": "challenge", "authorization_url": URL})
                    process.stdin.write(json.dumps({"code": "4/synthetic-code"}) + "\n")
                    process.stdin.flush()
                    second = executor.submit(process.stdout.readline).result(timeout=10)
                    self.assertEqual(json.loads(second), {"event": "code_sent"})
                    process.stdin.close()
                    process.wait(timeout=5)
                    self.assertNotIn("SECRET", process.stdout.read())
                finally:
                    if process.poll() is None:
                        process.kill()
                    executor.shutdown(wait=True)
            finally:
                if process.poll() is None:
                    if os.name != "nt": os.killpg(process.pid, signal.SIGKILL)
                    else: process.kill()
                process.wait(timeout=5)
                if process.stdin and not process.stdin.closed: process.stdin.close()
                process.stdout.close()


class AgenticLoginTest(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.directory = self.enterContext(tempfile.TemporaryDirectory())
        self.authenticated = False
        self.stopped = asyncio.Event()
        self.runner = AsyncMock()
        self.runner.config = CliConfig(Path(sys.executable), "", Path(self.directory))
        async def run(args, **kwargs):
            if not self.authenticated: return "", 1
            return ("fixture-model\tFixture model\n", 0) if args == ["models"] else (report("usage", QUOTA), 0)
        async def login(codes, on_event):
            try:
                on_event({"event": "challenge", "authorization_url": URL})
                await codes.get()
                self.authenticated = True
                on_event({"event": "code_sent"})
                await asyncio.Event().wait()
            finally:
                self.stopped.set()
        self.runner.run.side_effect = run
        self.runner.remote_login.side_effect = login
        self.service = AntigravityAgentService(self.runner)
        await self.service.initialize()
        self.manager = AgenticLoginManager(self.service, timeout=2)

    async def asyncTearDown(self):
        await self.manager.close()
        await self.service.close()

    async def wait_state(self, state):
        async with asyncio.timeout(1):
            while self.manager.status(None, OWNER)["state"] != state:
                await asyncio.sleep(0)

    async def test_login_and_fresh_non_generative_verification(self):
        job = await self.manager.start(OWNER)
        await self.wait_state("waiting_code")
        self.assertEqual(self.manager.status(job["id"], OWNER)["authorization_url"], URL)
        self.manager.submit(job["id"], OWNER, "4/synthetic-code")
        await self.wait_state("succeeded")
        await self.manager._task
        self.assertTrue(self.stopped.is_set())
        self.assertIsNone(self.manager.status(job["id"], OWNER)["authorization_url"])
        self.assertTrue((await self.service.get_status())["has_active_session"])
        self.assertTrue(all(call.args[0] == ["models"] or "/usage" in call.args[0] for call in self.runner.run.call_args_list))

    async def test_jobs_are_owned_and_start_is_recoverable(self):
        job = await self.manager.start(OWNER)
        self.assertEqual((await self.manager.start(OWNER))["id"], job["id"])
        self.assertIsNone(self.manager.status(job["id"], OTHER))
        with self.assertRaises(ServiceError) as error: await self.manager.start(OTHER)
        self.assertEqual(error.exception.status, 409)
        with self.assertRaises(ServiceError) as error: self.manager.submit(job["id"], OTHER, "4/synthetic-code")
        self.assertEqual(error.exception.status, 404)
        with self.assertRaises(ServiceError): await self.manager.cancel(job["id"], OTHER)

    async def test_cancel_before_task_starts_releases_admission(self):
        job = await self.manager.start(OWNER)
        self.assertEqual((await self.manager.cancel(job["id"], OWNER))["state"], "cancelled")
        self.assertFalse(self.service._analysis_lock.locked())
        self.assertFalse(self.service._authenticating)
        self.service.finish_authentication()  # Cleanup is safe to repeat.
        await self.manager.start(OWNER)

    async def test_close_before_task_starts_releases_admission(self):
        await self.manager.start(OWNER)
        await self.manager.close()
        self.assertFalse(self.service._analysis_lock.locked())
        self.assertEqual(self.manager.status(None, OWNER)["state"], "cancelled")

    async def test_cancel_waits_for_process_cleanup_before_releasing_admission(self):
        job = await self.manager.start(OWNER)
        await self.wait_state("waiting_code")
        self.assertEqual((await self.service.get_status())["reason"], "agentic_login_in_progress")
        with self.assertRaises(ServiceError) as error:
            await self.service.analyze_invoice(Path(self.directory) / "unused.pdf", model="fixture-model")
        self.assertEqual(error.exception.code, "agentic_busy")
        result = await self.manager.cancel(job["id"], OWNER)
        self.assertEqual(result["state"], "cancelled")
        self.assertTrue(self.stopped.is_set())
        self.assertFalse(self.service._analysis_lock.locked())
        self.assertIsNone(result["authorization_url"])

    async def test_already_authenticated_does_not_launch_login_or_change_account(self):
        self.authenticated = True
        await self.manager.start(OWNER)
        await self.wait_state("succeeded")
        self.runner.remote_login.assert_not_called()

    async def test_login_invalidates_an_inflight_health_read_without_cancelling_its_http_caller(self):
        started = asyncio.Event()
        async def blocked(*args, **kwargs):
            started.set()
            await asyncio.Event().wait()
        self.runner.run.side_effect = blocked
        reader = asyncio.create_task(self.service.get_status())
        await started.wait()
        await self.manager.start(OWNER)
        status = await reader
        self.assertEqual(status["reason"], "agentic_login_in_progress")
        self.assertFalse(status["has_active_session"])
        await self.manager.close()
        self.assertFalse(self.service._analysis_lock.locked())

    async def test_invalid_code_and_double_submission_are_rejected(self):
        job = await self.manager.start(OWNER)
        await self.wait_state("waiting_code")
        with self.assertRaises(ServiceError): self.manager.submit(job["id"], OWNER, "4/synthetic\n/logout")
        self.assertEqual(self.manager.status(None, OWNER)["state"], "waiting_code")
        self.manager.submit(job["id"], OWNER, "4/synthetic-code")
        with self.assertRaises(ServiceError): self.manager.submit(job["id"], OWNER, "4/synthetic-code")

    async def test_timeout_and_shutdown_clean_up_without_leaking_errors(self):
        self.manager.timeout = 0.02
        await self.manager.start(OWNER)
        await self.manager._task
        self.assertEqual(self.manager.status(None, OWNER)["reason"], "agentic_login_timeout")
        self.assertTrue(self.stopped.is_set())
        self.assertFalse(self.service._analysis_lock.locked())

    async def test_busy_or_missing_runtime_does_not_start_login(self):
        await self.service._analysis_lock.acquire()
        with self.assertRaises(ServiceError): await self.manager.start(OWNER)
        self.service._analysis_lock.release()
        self.service._available = False
        with self.assertRaises(ServiceError): await self.manager.start(OWNER)
        self.runner.remote_login.assert_not_called()


class AgenticLoginHttpTest(unittest.TestCase):
    def setUp(self):
        from fastapi.testclient import TestClient
        from main import create_app
        self.enterContext(patch.dict(os.environ, {"GEMINI_SERVICE_TOKEN": TOKEN}))
        self.client = self.enterContext(TestClient(create_app(web_service=fake_web(), load_environment=False)))
        self.headers = {**HEADERS, "X-Nodia-Actor-Id": OWNER}

    def test_private_routes_require_service_identity_and_actor(self):
        for path in ("/agentic/auth/login/start", "/agentic/auth/login/current"):
            method = self.client.post if path.endswith("start") else self.client.get
            self.assertEqual(method(path).status_code, 401)
            self.assertEqual(method(path, headers=HEADERS).status_code, 422)
        self.assertEqual(self.client.get("/agentic/auth/login/current", headers=self.headers).json(), None)
        self.assertEqual(self.client.post("/agentic/auth/login/start", headers=self.headers).status_code, 503)

    def test_codes_are_validated_and_not_reflected_in_errors(self):
        response = self.client.post("/agentic/auth/login/" + "ab" * 16 + "/code", headers=self.headers,
                                    json={"code": "4/synthetic\n/logout"})
        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.headers["x-nodia-error-code"], "login_invalid_code")
        self.assertNotIn("synthetic", response.text)
        self.assertEqual(response.headers["cache-control"], "no-store")

    def test_current_accepts_canonical_user_bigints_and_rejects_invalid_actors(self):
        for actor in ("1", "42", OWNER, OTHER, "9223372036854775807"):
            with self.subTest(actor=actor):
                response = self.client.get("/agentic/auth/login/current",
                    headers={**HEADERS, "X-Nodia-Actor-Id": actor})
                self.assertEqual(response.status_code, 200)
                self.assertIsNone(response.json())
        for actor in ("", "0", "-1", "+1", "01", "1.0", " 1", "1 ",
                      "9223372036854775808", "1" * 20,
                      "9601aa95-dd70-4af3-a5cf-50dd553a4ae9"):
            with self.subTest(actor=actor):
                response = self.client.get("/agentic/auth/login/current",
                    headers={**HEADERS, "X-Nodia-Actor-Id": actor})
                self.assertEqual(response.status_code, 422)
                self.assertEqual(response.json()["code"], "invalid_request")

    def test_all_login_routes_preserve_exact_actor_and_reject_missing_actor(self):
        manager = self.client.app.state.agentic_login
        job = {"id": "ab" * 16, "state": "waiting_code", "authorization_url": URL, "reason": None}
        with patch.object(manager, "start", new=AsyncMock(return_value=job)) as start, \
             patch.object(manager, "status", return_value=job) as status, \
             patch.object(manager, "submit", return_value=job) as submit, \
             patch.object(manager, "cancel", new=AsyncMock(return_value=job)) as cancel:
            for actor in (OWNER, OTHER):
                headers = {**HEADERS, "X-Nodia-Actor-Id": actor}
                routes = (("POST", "/start", None), ("GET", "/current", None),
                          ("GET", "/" + job["id"], None),
                          ("POST", "/" + job["id"] + "/code", {"code": "4/synthetic-code"}),
                          ("POST", "/" + job["id"] + "/cancel", None))
                for method, suffix, payload in routes:
                    path = "/agentic/auth/login" + suffix
                    self.assertEqual(self.client.request(method, path, headers=HEADERS, json=payload).status_code, 422)
                    self.assertEqual(self.client.request(method, path, headers=headers, json=payload).status_code, 200)
                start.assert_awaited_with(actor)
                status.assert_any_call(None, actor)
                status.assert_any_call(job["id"], actor)
                submit.assert_called_with(job["id"], actor, "4/synthetic-code")
                cancel.assert_awaited_with(job["id"], actor)

    def test_invalid_actor_is_never_classified_as_an_invalid_authorization_code(self):
        response = self.client.post("/agentic/auth/login/" + "ab" * 16 + "/code",
            headers={**HEADERS, "X-Nodia-Actor-Id": "invalid"}, json={"code": "short"})
        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.json()["code"], "invalid_request")
        self.assertNotIn("x-nodia-error-code", response.headers)

    def test_fragmented_oversized_login_body_is_rejected_before_json_parsing(self):
        response = self.client.post("/agentic/auth/login/start", headers=self.headers,
                                    content=iter([b"x" * 4096, b"x" * 4097]))
        self.assertEqual(response.status_code, 413)
        self.assertEqual(response.json()["code"], "body_too_large")
        self.assertEqual(response.headers["cache-control"], "no-store")
