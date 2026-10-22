"""Cleanup restricted to the adapter's owned Web profile and SDK cookie cache."""

import shutil
from pathlib import Path


def validate_web_roots(profile: Path, session_dir: Path) -> None:
    for root in (profile, session_dir):
        if root.is_symlink() or root.resolve() != root.absolute() or (root.exists() and not root.is_dir()):
            raise OSError("Unsafe Web session directory")


def clear_web_files(profile: Path, session_dir: Path) -> None:
    # Keep the volume roots; never follow a profile/cache directory symlink.
    validate_web_roots(profile, session_dir)
    for child in profile.iterdir():
        if child.is_symlink() or not child.is_dir():
            child.unlink()
        else:
            shutil.rmtree(child)
    # The SDK's installed cache pattern; do not delete unrelated session state.
    for child in session_dir.glob(".cached_cookies_*.json"):
        if child.is_dir() and not child.is_symlink():
            raise OSError("Unexpected Web cookie cache directory")
        child.unlink()
