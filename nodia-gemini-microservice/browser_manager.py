import asyncio
import errno
import os
import platform
import stat
import tempfile
import time
from pathlib import Path
from typing import Any, Dict, Optional
from loguru import logger
from playwright.async_api import BrowserContext, Playwright, async_playwright
from gemini_webapi import GeminiClient
from session_store import save_session

BASE_DIR = Path(__file__).resolve().parent
PROFILE_DIR = BASE_DIR / "browser_profile"
ENV_FILE = BASE_DIR / ".env"

def has_system_chrome() -> bool:
    """Checks if official Google Chrome is installed on the machine."""
    system = platform.system()
    if system == "Windows":
        candidates = [
            r"C:\Program Files\Google\Chrome\Application\chrome.exe",
            r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
            os.path.expandvars(r"%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"),
        ]
        return any(Path(p).exists() for p in candidates)
    elif system == "Darwin":  # macOS
        return Path("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome").exists()
    elif system == "Linux":
        return Path("/usr/bin/google-chrome").exists()
    return False

def update_env_file(secure_1psid: str, secure_1psidts: str) -> None:
    """Atomically update login cookies without discarding service configuration."""
    if not secure_1psid or not secure_1psidts or any(
        character in value for value in (secure_1psid, secure_1psidts) for character in "\r\n"
    ):
        raise ValueError("Invalid Gemini cookies")
    # The mounted session directory is writable even when Docker binds .env read-only.
    save_session(secure_1psid, secure_1psidts)

    if not ENV_FILE.exists():
        content = (
            "PORT=8000\nHOST=127.0.0.1\nGEMINI_SERVICE_TOKEN=\n"
            f"GEMINI_SECURE_1PSID={secure_1psid}\n"
            f"GEMINI_SECURE_1PSIDTS={secure_1psidts}\n"
        )
    else:
        new_lines = []
        seen = set()
        replacements = {
            "GEMINI_SECURE_1PSID": secure_1psid,
            "SECURE_1PSID": secure_1psid,
            "GEMINI_SECURE_1PSIDTS": secure_1psidts,
            "SECURE_1PSIDTS": secure_1psidts,
        }
        for line in ENV_FILE.read_text(encoding="utf-8-sig").splitlines():
            key = line.split("=", 1)[0].strip()
            if key not in replacements:
                new_lines.append(line)
                continue
            canonical_key = "GEMINI_SECURE_1PSIDTS" if key.endswith("1PSIDTS") else "GEMINI_SECURE_1PSID"
            if canonical_key not in seen:
                new_lines.append(f"{canonical_key}={replacements[key]}")
                seen.add(canonical_key)
        for key, value in (
            ("GEMINI_SECURE_1PSID", secure_1psid),
            ("GEMINI_SECURE_1PSIDTS", secure_1psidts),
        ):
            if key not in seen:
                new_lines.append(f"{key}={value}")
        content = "\n".join(new_lines) + "\n"

    temporary_path = None
    env_updated = False
    try:
        with tempfile.NamedTemporaryFile(
            mode="w", encoding="utf-8", newline="\n", prefix=".env-", dir=ENV_FILE.parent, delete=False
        ) as temporary:
            temporary_path = Path(temporary.name)
            temporary.write(content)
            temporary.flush()
            os.fsync(temporary.fileno())
        if os.name != "nt":
            previous_mode = stat.S_IMODE(ENV_FILE.stat().st_mode) if ENV_FILE.exists() else 0o600
            temporary_path.chmod(previous_mode & 0o600)
        os.replace(temporary_path, ENV_FILE)
        env_updated = True
    except OSError as error:
        if error.errno not in {errno.EACCES, errno.EBUSY, errno.EPERM, errno.EROFS}:
            raise
        logger.warning(".env is read-only or bind-mounted; refreshed cookies remain in session_state/.")
    finally:
        if temporary_path is not None:
            temporary_path.unlink(missing_ok=True)

    os.environ["GEMINI_SECURE_1PSID"] = secure_1psid
    os.environ["GEMINI_SECURE_1PSIDTS"] = secure_1psidts
    logger.info("Gemini session cookies saved in {}.", ".env and session_state/" if env_updated else "session_state/")


class BrowserCookieManager:
    """
    Manages Playwright browser automation with a persistent user data directory (browser_profile).
    Allows interactive login (visible window) and silent headless refresh of Google Gemini cookies.
    """

    def __init__(self) -> None:
        self.lock = asyncio.Lock()
        self.profile_dir = PROFILE_DIR
        self.profile_dir.mkdir(parents=True, exist_ok=True)
        self.last_refresh_time: Optional[float] = None

    async def _extract_cookies(self, context: BrowserContext) -> Dict[str, str]:
        """Extracts __Secure-1PSID and __Secure-1PSIDTS from the browser context."""
        cookies = await context.cookies(["https://gemini.google.com", "https://google.com"])
        extracted: Dict[str, str] = {}
        for cookie in cookies:
            name = cookie.get("name")
            value = cookie.get("value")
            if name and value:
                if name == "__Secure-1PSID":
                    extracted["secure_1psid"] = value
                elif name == "__Secure-1PSIDTS":
                    extracted["secure_1psidts"] = value
        return extracted

    async def _launch_context(self, playwright: Playwright, *, headless: bool) -> BrowserContext:
        launch_kwargs: Dict[str, Any] = {
            "user_data_dir": str(self.profile_dir),
            "headless": headless,
            "args": [
                "--disable-blink-features=AutomationControlled",
                "--no-first-run",
                "--no-default-browser-check",
            ],
        }
        if not headless:
            launch_kwargs["viewport"] = {"width": 1280, "height": 850}
        if has_system_chrome():
            launch_kwargs["channel"] = "chrome"
        try:
            return await playwright.chromium.launch_persistent_context(**launch_kwargs)
        except Exception as error:
            if "channel" not in launch_kwargs:
                raise
            logger.warning("Chrome channel unavailable ({}); trying bundled Chromium.", type(error).__name__)
            launch_kwargs.pop("channel")
            return await playwright.chromium.launch_persistent_context(**launch_kwargs)

    async def login_interactive(self, timeout_seconds: int = 300) -> Dict[str, Any]:
        """Wait for a verified Google session in a visible, disposable browser context."""
        async with self.lock:
            logger.info("Starting interactive browser login window for Google Gemini...")
            extracted_cookies: Dict[str, str] = {}
            async with async_playwright() as playwright:
                context = await self._launch_context(playwright, headless=False)
                try:
                    page = context.pages[0] if context.pages else await context.new_page()
                    try:
                        await page.goto("https://gemini.google.com/app", timeout=60000)
                    except Exception as error:
                        logger.warning("Initial Gemini navigation failed: {}", type(error).__name__)

                    deadline = time.monotonic() + timeout_seconds
                    logger.info("Waiting for user to complete Google sign-in...")
                    while time.monotonic() < deadline:
                        try:
                            if not context.pages or page.is_closed():
                                logger.info("Browser window closed by the user.")
                                break
                            url = page.url.lower()
                            is_auth_page = any(
                                marker in url
                                for marker in ("accounts.google.com", "servicelogin", "signin")
                            )
                            if not is_auth_page and "gemini.google.com" in url:
                                cookies = await self._extract_cookies(context)
                                psid = cookies.get("secure_1psid")
                                psidts = cookies.get("secure_1psidts")
                                if psid and psidts:
                                    test_client = None
                                    try:
                                        test_client = GeminiClient(psid, psidts)
                                        await test_client.init(timeout=10, auto_refresh=False)
                                        if test_client.account_status.name != "UNAUTHENTICATED":
                                            extracted_cookies = cookies
                                            break
                                    except Exception as error:
                                        logger.debug("Gemini cookies are not ready: {}", type(error).__name__)
                                    finally:
                                        if test_client is not None:
                                            await test_client.close()
                        except Exception as error:
                            logger.debug("Login polling failed: {}", type(error).__name__)
                        await asyncio.sleep(2)
                finally:
                    await context.close()

            if not extracted_cookies:
                return {"success": False, "message": "No se completó el inicio de sesión o se cerró la ventana."}
            update_env_file(extracted_cookies["secure_1psid"], extracted_cookies["secure_1psidts"])
            self.last_refresh_time = time.time()
            return {
                "success": True,
                "message": "Sesión de Gemini Pro iniciada correctamente.",
                "cookies": extracted_cookies,
            }

    async def refresh_cookies_headless(self, timeout_seconds: int = 60) -> Optional[Dict[str, str]]:
        """
        Silently launches a headless browser with the persistent profile to renew cookies natively with Google.
        Returns the new cookies dictionary if successful, or None if the session expired completely.
        """
        async with self.lock:
            logger.info("Starting silent headless browser cookie refresh...")
            async with async_playwright() as playwright:
                context = await self._launch_context(playwright, headless=True)
                try:
                    page = context.pages[0] if context.pages else await context.new_page()
                    await page.goto("https://gemini.google.com/app", timeout=timeout_seconds * 1000)
                    await page.wait_for_load_state("domcontentloaded", timeout=20000)
                    await asyncio.sleep(3)
                    if "accounts.google.com" in page.url.lower():
                        logger.warning("Session requires interactive re-authentication.")
                        return None
                    cookies = await self._extract_cookies(context)
                    if not cookies.get("secure_1psid") or not cookies.get("secure_1psidts"):
                        logger.warning("Headless refresh did not obtain both Gemini cookies.")
                        return None
                    update_env_file(cookies["secure_1psid"], cookies["secure_1psidts"])
                    self.last_refresh_time = time.time()
                    return cookies
                except Exception as error:
                    logger.error("Headless cookie refresh failed: {}", type(error).__name__)
                    return None
                finally:
                    await context.close()

    def has_profile(self) -> bool:
        """Checks if a browser profile directory exists with stored data."""
        return self.profile_dir.exists() and any(self.profile_dir.iterdir())
