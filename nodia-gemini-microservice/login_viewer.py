"""Bounded pixel viewer for the Google login page; no DOM or session export."""

import asyncio
import base64
from urllib.parse import urlsplit
from uuid import uuid4

from playwright.async_api import Page
from pydantic import BaseModel, ConfigDict, Field, model_validator
from typing import Literal, Self

from service_errors import ServiceError

LOGIN_KEYS = ("Tab", "Shift+Tab", "Enter", "Backspace", "Delete", "Escape",
              "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End", "Control+A")
LOGIN_HOSTS = frozenset({"gemini.google.com", "accounts.google.com", "consent.google.com",
                         "google.com", "www.google.com", "myaccount.google.com"})


class LoginInput(BaseModel):
    model_config = ConfigDict(strict=True, extra="forbid")
    frame_id: str = Field(pattern=r"^[0-9a-f]{32}$", max_length=32)
    action: Literal["click", "text", "key", "scroll"]
    x: int | None = Field(default=None, ge=0, lt=1280)
    y: int | None = Field(default=None, ge=0, lt=850)
    text: str | None = Field(default=None, min_length=1, max_length=2048, repr=False)
    key: str | None = None
    delta: int | None = Field(default=None, ge=-600, le=600)

    @model_validator(mode="after")
    def validate_action(self) -> Self:
        required = {"click": {"x", "y"}, "text": {"text"}, "key": {"key"}, "scroll": {"delta"}}[self.action]
        supplied = {name for name in ("x", "y", "text", "key", "delta") if getattr(self, name) is not None}
        if supplied != required or (self.action == "key" and self.key not in LOGIN_KEYS):
            raise ValueError("Invalid login input")
        return self


class LoginFrame(BaseModel):
    model_config = ConfigDict(strict=True, extra="forbid")
    ready: bool
    frame_id: str | None = None
    image: str | None = Field(default=None, max_length=1_048_576, repr=False)
    width: Literal[1280] = 1280
    height: Literal[850] = 850


class LoginViewer:
    def __init__(self) -> None:
        self._page: Page | None = None
        self._frame_id: str | None = None
        self._lock = asyncio.Lock()

    def attach(self, page: Page) -> None:
        self.clear()
        self._page = page
        self._frame_id = uuid4().hex
        page.on("framenavigated", self._navigated)
        page.on("close", self.clear)

    def _navigated(self, frame) -> None:
        if self._page and frame == self._page.main_frame:
            self._frame_id = uuid4().hex

    def clear(self, *args) -> None:
        if self._page:
            self._page.remove_listener("framenavigated", self._navigated)
            self._page.remove_listener("close", self.clear)
        self._page = None
        self._frame_id = None

    def _allowed_page(self) -> Page:
        page = self._page
        if page is None or page.is_closed():
            raise ServiceError("viewer_not_ready", "El navegador aún no está disponible.", 409)
        url = urlsplit(page.url)
        if url.scheme != "https" or url.hostname not in LOGIN_HOSTS or url.port not in (None, 443):
            raise ServiceError("viewer_site_blocked", "El visor solo admite el inicio de sesión de Google y Gemini.", 409)
        return page

    async def frame(self) -> LoginFrame:
        if self._page is None or self._page.url == "about:blank":
            return LoginFrame(ready=False)
        if self._lock.locked():
            raise ServiceError("viewer_busy", "El visor está ocupado. Vuelve a intentarlo.", 409)
        async with self._lock:
            try:
                async with asyncio.timeout(3):
                    page = self._allowed_page()
                    identifier = self._frame_id
                    pixels = await page.screenshot(type="jpeg", quality=70, timeout=2500)
                    if self._page is not page or identifier != self._frame_id:
                        return LoginFrame(ready=False)
                    self._allowed_page()
                    if len(pixels) > 786_432:
                        raise ServiceError("viewer_frame_limit", "La pantalla supera el límite del visor.", 502)
                    return LoginFrame(ready=True, frame_id=identifier,
                                      image=base64.b64encode(pixels).decode("ascii"))
            except ServiceError:
                raise
            except Exception:
                raise ServiceError("viewer_unavailable", "No se pudo obtener la pantalla. Reintenta el visor.", 503) from None

    async def input(self, command: LoginInput) -> None:
        if self._lock.locked():
            raise ServiceError("viewer_busy", "El visor está ocupado. Vuelve a intentarlo.", 409)
        async with self._lock:
            page = self._allowed_page()
            if self._frame_id is None or command.frame_id != self._frame_id:
                raise ServiceError("viewer_stale_frame", "La pantalla cambió. Actualiza el visor antes de continuar.", 409)
            # Consume the command once, even when a transport failure leaves its result uncertain.
            self._frame_id = uuid4().hex
            try:
                async with asyncio.timeout(3):
                    if command.action == "click":
                        await page.mouse.click(command.x, command.y)
                    elif command.action == "text":
                        await page.keyboard.insert_text(command.text)
                    elif command.action == "key":
                        await page.keyboard.press(command.key)
                    else:
                        await page.mouse.wheel(0, command.delta)
            except Exception:
                raise ServiceError("viewer_input_uncertain", "No se pudo confirmar la acción. Revisa la pantalla antes de reintentar.", 503) from None
