"""Reserve part of a serialized NodiaAI Web turn for the SDK's read-only recovery.

This changes no caller deadline, model, transport or retry policy. The SDK may
read the fresh conversation CID after a stalled stream; it must never resend the
generation. OCR callers omit the budget and keep their exact client settings.
"""
from contextlib import contextmanager
import math
from typing import Protocol


class RecoveryClient(Protocol):
    timeout: float
    watchdog_timeout: float


@contextmanager
def chat_recovery_budget(client: RecoveryClient, seconds: float | None):
    """Caller must already own the physical Web profile exclusively.

    The pinned SDK adds five seconds to its idle-reader watchdog. Reserving half
    the supplied turn budget permits history recovery before the caller's outer
    deadline. Late headers/heartbeats can still exhaust that unchanged deadline;
    this is an opportunity to recover, never a guarantee or a second generation.
    Queueing/thinking branches use the unchanged SDK timeout, not this watchdog.
    """
    if seconds is None:
        yield
        return
    saved_timeout, saved_watchdog = client.timeout, client.watchdog_timeout
    if any(type(value) not in (int, float) or not math.isfinite(value) or value <= 0
           for value in (seconds, saved_timeout, saved_watchdog)):
        raise ValueError("Invalid NodiaAI Web recovery budget")
    client.watchdog_timeout = min(saved_watchdog, max(1.0, seconds / 2 - 5.0))
    try:
        yield
    finally:
        client.timeout = saved_timeout
        client.watchdog_timeout = saved_watchdog
