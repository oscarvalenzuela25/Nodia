"""Uses the production durable supervisor, PTY runner and login state machine."""
import asyncio
import hashlib
import os
from pathlib import Path
import shutil
import sys
import tempfile

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from agentic_cli import CliConfig, CliRunner
from agentic_login import AgenticLoginManager
import login_supervisor


class FixtureService:
    def __init__(self, home: Path):
        self.home = home
        binary = home / "fixture-cli"
        shutil.copyfile(Path(__file__).with_name("login_cli_fixture.py"), binary)
        binary.chmod(0o700)
        self.runner = CliRunner(CliConfig(binary, hashlib.sha512(binary.read_bytes()).hexdigest(), home, version="fixture"))
        info = binary.stat()
        self.runner._verified_stat = (info.st_mtime_ns, info.st_size)

    async def begin_authentication(self):
        pass

    async def observe_authentication(self):
        return {"has_active_session": (self.home / "fixture-auth-completed").exists()}

    def finish_authentication(self):
        pass

    async def close(self):
        await self.runner.close()


async def fixture_login(self):
    if os.environ.get("NODIA_ISOLATED_NATIVE_TEST") != "1":
        raise RuntimeError("fixture_runtime_required")
    if self.record["engine"] == "web":
        return await fixture_web_login(self)
    with tempfile.TemporaryDirectory(prefix="n29-cli-") as directory:
        self.service = FixtureService(Path(directory))
        self.manager = AgenticLoginManager(self.service, timeout=60)
        await self.manager.start(self.record["actor"], job_id=self.key)
        while not self.done.is_set():
            result = self.manager.status(self.key, self.record["actor"])
            if result["state"] in {"succeeded", "failed", "cancelled"}:
                await self.finish(result["state"])
                return
            await asyncio.sleep(0.03)


async def fixture_web_login(self):
    import browser_manager
    from interactive_login import InteractiveLoginManager
    from types import SimpleNamespace
    with tempfile.TemporaryDirectory(prefix="n29-web-") as directory:
        browser_manager.PROFILE_DIR = Path(directory)
        browser_manager.ENV_FILE = Path(directory) / "unused.env"
        browser = browser_manager.BrowserCookieManager()
        original_launch = browser._launch_context
        async def isolated_launch(playwright, *, headless):
            context = await original_launch(playwright, headless=headless)
            await context.route("**/*", lambda route: route.fulfill(
                status=200, content_type="text/html",
                body="<title>Nodia isolated login fixture</title><p>fixture</p>"))
            return context
        browser._launch_context = isolated_launch
        async def close():
            pass
        self.service = SimpleNamespace(browser_manager=browser, close=close)
        self.manager = InteractiveLoginManager()
        async def runner():
            result = await browser.login_interactive(timeout_seconds=60)
            return result["success"]
        self.manager.start(runner, self.record["actor"], job_id=self.key)
        while not self.done.is_set():
            result = self.manager.status(self.key, self.record["actor"])
            if result["state"] in {"succeeded", "failed", "cancelled"}:
                await self.finish(result["state"])
                return
            await asyncio.sleep(0.03)


if __name__ == "__main__":
    login_supervisor.LoginSupervisor.login = fixture_login
    login_supervisor.main()
