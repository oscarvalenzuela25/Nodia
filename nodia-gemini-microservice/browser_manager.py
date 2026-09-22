import asyncio
import os
import platform
import time
from pathlib import Path
from typing import Any, Dict, Optional
from loguru import logger
from playwright.async_api import BrowserContext, async_playwright

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
    """Safely updates or appends GEMINI_SECURE_1PSID and GEMINI_SECURE_1PSIDTS in .env file."""
    os.environ["GEMINI_SECURE_1PSID"] = secure_1psid
    os.environ["GEMINI_SECURE_1PSIDTS"] = secure_1psidts

    if not ENV_FILE.exists():
        content = (
            f"PORT=8000\nHOST=0.0.0.0\n"
            f"GEMINI_SECURE_1PSID={secure_1psid}\n"
            f"GEMINI_SECURE_1PSIDTS={secure_1psidts}\n"
        )
        ENV_FILE.write_text(content, encoding="utf-8")
        logger.info(".env created with new Gemini session cookies.")
        return

    lines = ENV_FILE.read_text(encoding="utf-8").splitlines()
    found_psid = False
    found_psidts = False
    new_lines = []

    for line in lines:
        stripped = line.strip()
        if stripped.startswith("GEMINI_SECURE_1PSID=") or stripped.startswith("SECURE_1PSID="):
            new_lines.append(f"GEMINI_SECURE_1PSID={secure_1psid}")
            found_psid = True
        elif stripped.startswith("GEMINI_SECURE_1PSIDTS=") or stripped.startswith("SECURE_1PSIDTS="):
            new_lines.append(f"GEMINI_SECURE_1PSIDTS={secure_1psidts}")
            found_psidts = True
        else:
            new_lines.append(line)

    if not found_psid:
        new_lines.append(f"GEMINI_SECURE_1PSID={secure_1psid}")
    if not found_psidts:
        new_lines.append(f"GEMINI_SECURE_1PSIDTS={secure_1psidts}")

    ENV_FILE.write_text("\n".join(new_lines) + "\n", encoding="utf-8")
    logger.info("Updated .env file with fresh Gemini cookies.")


class BrowserCookieManager:
    """
    Manages Playwright browser automation with a persistent user data directory (browser_profile).
    Allows interactive login (visible window) and silent headless refresh of Google Gemini cookies.
    """

    def __init__(self):
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

    async def login_interactive(self, timeout_seconds: int = 300) -> Dict[str, Any]:
        """
        Launches a visible Chrome window for the user to sign in to Google/Gemini.
        Polls until the session cookies are detected or timeout is reached.
        """
        async with self.lock:
            logger.info("Starting interactive browser login window for Google Gemini...")
            channel = "chrome" if has_system_chrome() else None
            logger.info(f"Using browser channel: {channel or 'chromium (playwright default)'}")

            async with async_playwright() as p:
                launch_kwargs: Dict[str, Any] = {
                    "user_data_dir": str(self.profile_dir),
                    "headless": False,
                    "viewport": {"width": 1280, "height": 850},
                    "args": [
                        "--disable-blink-features=AutomationControlled",
                        "--no-first-run",
                        "--no-default-browser-check",
                    ],
                }
                if channel:
                    launch_kwargs["channel"] = channel

                try:
                    context = await p.chromium.launch_persistent_context(**launch_kwargs)
                except Exception as e:
                    logger.error(f"Failed to launch Chrome channel ({e}). Retrying with bundled Chromium...")
                    launch_kwargs.pop("channel", None)
                    context = await p.chromium.launch_persistent_context(**launch_kwargs)

                page = context.pages[0] if context.pages else await context.new_page()

                logger.info("Navigating to https://gemini.google.com ...")
                try:
                    await page.goto("https://gemini.google.com", timeout=60000)
                except Exception as e:
                    logger.warning(f"Initial navigation issue: {e}")

                start_time = time.time()
                extracted_cookies: Dict[str, str] = {}

                logger.info("Waiting for user to complete Google sign-in...")
                while time.time() - start_time < timeout_seconds:
                    try:
                        # Check if browser was closed by user
                        if not context.pages:
                            break

                        cookies = await self._extract_cookies(context)
                        url = page.url.lower()

                        if cookies.get("secure_1psid") and cookies.get("secure_1psidts"):
                            if "accounts.google.com" not in url:
                                logger.success("Active Gemini session detected!")
                                # Give Google a moment to finalize session sync
                                await asyncio.sleep(2)
                                extracted_cookies = await self._extract_cookies(context)
                                break
                    except Exception as e:
                        logger.debug(f"Polling loop: {e}")

                    await asyncio.sleep(2)

                await context.close()

                if extracted_cookies.get("secure_1psid") and extracted_cookies.get("secure_1psidts"):
                    update_env_file(
                        extracted_cookies["secure_1psid"],
                        extracted_cookies["secure_1psidts"],
                    )
                    self.last_refresh_time = time.time()
                    return {
                        "success": True,
                        "message": "Sesión de Gemini Pro iniciada correctamente.",
                        "cookies": extracted_cookies,
                    }
                else:
                    return {
                        "success": False,
                        "message": "No se completó el inicio de sesión o se cerró la ventana.",
                    }

    async def refresh_cookies_headless(self, timeout_seconds: int = 60) -> Optional[Dict[str, str]]:
        """
        Silently launches a headless browser with the persistent profile to renew cookies natively with Google.
        Returns the new cookies dictionary if successful, or None if the session expired completely.
        """
        async with self.lock:
            logger.info("Starting silent headless browser cookie refresh...")
            channel = "chrome" if has_system_chrome() else None

            async with async_playwright() as p:
                launch_kwargs: Dict[str, Any] = {
                    "user_data_dir": str(self.profile_dir),
                    "headless": True,
                    "args": [
                        "--disable-blink-features=AutomationControlled",
                        "--no-first-run",
                        "--no-default-browser-check",
                    ],
                }
                if channel:
                    launch_kwargs["channel"] = channel

                try:
                    context = await p.chromium.launch_persistent_context(**launch_kwargs)
                except Exception as e:
                    logger.warning(f"Headless Chrome channel launch failed: {e}. Falling back to default chromium...")
                    launch_kwargs.pop("channel", None)
                    context = await p.chromium.launch_persistent_context(**launch_kwargs)

                page = context.pages[0] if context.pages else await context.new_page()

                try:
                    logger.debug("Headless navigation to https://gemini.google.com...")
                    await page.goto("https://gemini.google.com", timeout=timeout_seconds * 1000)
                    await page.wait_for_load_state("domcontentloaded", timeout=20000)
                    await asyncio.sleep(3)

                    url = page.url.lower()
                    if "accounts.google.com" in url:
                        logger.warning("Session requires re-authentication (redirected to accounts.google.com).")
                        await context.close()
                        return None

                    cookies = await self._extract_cookies(context)
                    await context.close()

                    if cookies.get("secure_1psid") and cookies.get("secure_1psidts"):
                        logger.success("Headless browser refresh obtained fresh cookies successfully.")
                        update_env_file(cookies["secure_1psid"], cookies["secure_1psidts"])
                        self.last_refresh_time = time.time()
                        return cookies
                    else:
                        logger.warning("Headless navigation succeeded but cookies were not fully populated.")
                        return None

                except Exception as e:
                    logger.error(f"Error during headless cookie refresh: {e}")
                    try:
                        await context.close()
                    except Exception:
                        pass
                    return None

    def has_profile(self) -> bool:
        """Checks if a browser profile directory exists with stored data."""
        return self.profile_dir.exists() and any(self.profile_dir.iterdir())
