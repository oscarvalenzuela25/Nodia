"""Explicit isolated Teacher SDK child. Importing it reads no runtime state."""
import argparse
import asyncio
import contextlib
from hashlib import sha256
import importlib.metadata
import io
import json
import logging
import os
from pathlib import Path
import re
import stat
import sys
import tempfile
from urllib.parse import parse_qs, urlsplit
from uuid import uuid4


class SilentAuthRequired(ValueError):
    pass


class SilentFlow:
    """Official manager's public injectable flow factory; never starts login."""
    @classmethod
    def from_client_config(cls, *_args, **_kwargs):
        raise SilentAuthRequired("session_required")


class DiscardOutput(io.TextIOBase):
    def write(self, value: str) -> int:
        return len(value)


def safe_file(path: Path, limit: int) -> bytes:
    if not path.is_absolute() or path.is_symlink() or path.resolve() != path:
        raise ValueError("runtime_unavailable")
    descriptor = os.open(path, os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0))
    with os.fdopen(descriptor, "rb") as stream:
        info = os.fstat(stream.fileno())
        if not stat.S_ISREG(info.st_mode) or info.st_size > limit or info.st_uid != 0 or info.st_mode & 0o022:
            raise ValueError("runtime_unavailable")
        return stream.read(limit + 1)


def safe_digest(path: Path, limit: int) -> tuple[str, int]:
    """No large executable allocation; reject mutable or aliased assets."""
    if not path.is_absolute() or path.is_symlink() or path.resolve() != path:
        raise ValueError("runtime_unavailable")
    for directory in path.parents:
        info = directory.stat()
        if directory.is_symlink() or not stat.S_ISDIR(info.st_mode) or info.st_uid != 0 or info.st_mode & 0o022:
            raise ValueError("runtime_unavailable")
    descriptor = os.open(path, os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0))
    with os.fdopen(descriptor, "rb") as stream:
        before = os.fstat(stream.fileno())
        if not stat.S_ISREG(before.st_mode) or before.st_uid != 0 or before.st_mode & 0o022 or before.st_size > limit:
            raise ValueError("runtime_unavailable")
        digest, total = sha256(), 0
        while chunk := stream.read(65536):
            total += len(chunk)
            if total > limit:
                raise ValueError("runtime_unavailable")
            digest.update(chunk)
        after = os.fstat(stream.fileno())
    observed = path.stat()
    identity = lambda value: (value.st_dev, value.st_ino, value.st_size, value.st_mtime_ns, value.st_ctime_ns)
    if identity(before) != identity(after) or identity(after) != identity(observed) or total != after.st_size:
        raise ValueError("runtime_unavailable")
    return digest.hexdigest(), total


def assets(manifest_path: Path, expected_hash: str) -> tuple[dict, Path, str]:
    """Root supplies both path and expected digest; stdin cannot choose them."""
    from teacher_sdk_policy import strict_json
    if not re.fullmatch(r"[0-9a-f]{64}", expected_hash or "") or sys.version_info[:2] != (3, 12) or sys.platform != "linux":
        raise ValueError("runtime_unavailable")
    if safe_digest(manifest_path, 65536)[0] != expected_hash:
        raise ValueError("runtime_unavailable")
    raw = safe_file(manifest_path, 65536)
    if sha256(raw).hexdigest() != expected_hash:
        raise ValueError("runtime_unavailable")
    data = strict_json(raw)
    if (not isinstance(data, dict) or set(data) != {"schema", "sdk_version", "sdk_wheel_sha256", "requirements_lock_sha256",
                "host_source_pins", "harness_relative_to_prefix", "harness_sha256", "vendor_files"}
            or data["schema"] != "teacher-sdk-runtime/1" or not isinstance(data["sdk_version"], str)
            or importlib.metadata.version("google-antigravity") != data["sdk_version"]):
        raise ValueError("runtime_unavailable")
    relative = data["harness_relative_to_prefix"]
    if not isinstance(relative, str) or relative.startswith("/") or ".." in Path(relative).parts:
        raise ValueError("runtime_unavailable")
    binary = Path(sys.prefix) / relative
    if safe_digest(binary, 160000000)[0] != data["harness_sha256"]:
        raise ValueError("runtime_unavailable")
    for key in ("sdk_wheel_sha256", "requirements_lock_sha256", "harness_sha256"):
        if not isinstance(data[key], str) or not re.fullmatch(r"[0-9a-f]{64}", data[key]):
            raise ValueError("runtime_unavailable")
    if safe_digest(manifest_path.parent / "requirements.lock", 65536)[0] != data["requirements_lock_sha256"]:
        raise ValueError("runtime_unavailable")
    source_pins = data["host_source_pins"]
    if not isinstance(source_pins, dict) or set(source_pins) != {"teacher_sdk_host.py", "teacher_sdk_policy.py", "teacher_sdk_guard.py"}:
        raise ValueError("runtime_unavailable")
    for name, expected in source_pins.items():
        if safe_digest(Path(__file__).resolve().parent / name, 131072)[0] != expected:
            raise ValueError("runtime_unavailable")
    rows = data["vendor_files"]
    if not isinstance(rows, list) or len(rows) != 15:
        raise ValueError("runtime_unavailable")
    names = set()
    for row in rows:
        if not isinstance(row, dict) or set(row) != {"path", "bytes", "sha256"}:
            raise ValueError("runtime_unavailable")
        name = row["path"]
        if (not isinstance(name, str) or not name.startswith("vendor/google3/") or ".." in Path(name).parts
                or name in names or type(row["bytes"]) is not int or not 0 <= row["bytes"] <= 262144):
            raise ValueError("runtime_unavailable")
        names.add(name)
        digest, size = safe_digest(manifest_path.parent / name, 262144)
        if size != row["bytes"] or digest != row["sha256"]:
            raise ValueError("runtime_unavailable")
    vendor = manifest_path.parent / "vendor"
    if (vendor / "google3/__init__.py").exists():
        raise ValueError("runtime_unavailable")
    sys.path.insert(0, str(vendor))
    return data, binary, expected_hash


def private_profile(profile: Path, create: bool = False) -> Path:
    if not profile.is_absolute() or profile.resolve() != profile or profile.is_symlink():
        raise ValueError("session_required")
    if create:
        profile.mkdir(mode=0o700, parents=False, exist_ok=True)
    info = profile.stat()
    if not stat.S_ISDIR(info.st_mode) or info.st_uid != os.getuid() or stat.S_IMODE(info.st_mode) != 0o700:
        raise ValueError("session_required")
    token_dir = profile / "antigravity-acp"
    token = token_dir / "acp_token.json"
    if token_dir.is_symlink() or token.is_symlink():
        raise ValueError("session_required")
    if token_dir.exists() and (token_dir.is_symlink() or token_dir.resolve() != token_dir):
        raise ValueError("session_required")
    if token_dir.exists():
        info = token_dir.stat()
        if not stat.S_ISDIR(info.st_mode) or info.st_uid != os.getuid() or stat.S_IMODE(info.st_mode) != 0o700:
            raise ValueError("session_required")
    if token.exists():
        info = token.stat()
        if token.is_symlink() or not stat.S_ISREG(info.st_mode) or info.st_uid != os.getuid() or stat.S_IMODE(info.st_mode) != 0o600 or info.st_size > 65536:
            raise ValueError("session_required")
    return token


def oauth_manager(token_path: Path, interactive: bool = False):
    from google3.cloud.developer_experience.antigravity_extensions.acp_server.ccpa_connection.oauth_manager import OAuthManager
    if interactive:
        return OAuthManager(token_path=token_path)
    return OAuthManager(token_path=token_path, flow_class=SilentFlow)


def epoch_state(profile: Path) -> tuple[int, int, int, int, int] | None:
    private_profile(profile)
    target = profile / "session_epoch"
    if target.is_symlink():
        raise ValueError("epoch_unavailable")
    if not target.exists():
        return None
    descriptor = os.open(target, os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0))
    with os.fdopen(descriptor, "rb") as source:
        info = os.fstat(source.fileno())
        if not stat.S_ISREG(info.st_mode) or info.st_uid != os.getuid() or stat.S_IMODE(info.st_mode) != 0o600 or info.st_size > 64:
            raise ValueError("epoch_unavailable")
        if not re.fullmatch(rb"[0-9a-f]{32}", source.read(65).strip()):
            raise ValueError("epoch_unavailable")
    return (info.st_dev, info.st_ino, info.st_size, info.st_mtime_ns, info.st_ctime_ns)


def login_and_rotate(manager, profile: Path) -> None:
    """Explicit login only. Publish a new durable epoch after successful OAuth."""
    previous = epoch_state(profile)
    token = manager.get_access_token()
    if not isinstance(token, str) or not token:
        raise ValueError("session_required")
    if epoch_state(profile) != previous:
        raise ValueError("epoch_unavailable")
    target = profile / "session_epoch"
    temporary = profile / (".session_epoch-" + uuid4().hex + ".tmp")
    try:
        descriptor = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, "O_NOFOLLOW", 0), 0o600)
        with os.fdopen(descriptor, "wb") as destination:
            destination.write(uuid4().hex.encode("ascii"))
            destination.flush()
            os.fsync(destination.fileno())
        os.replace(temporary, target)
        descriptor = os.open(profile, os.O_RDONLY | getattr(os, "O_DIRECTORY", 0) | getattr(os, "O_NOFOLLOW", 0))
        try:
            os.fsync(descriptor)
        finally:
            os.close(descriptor)
    finally:
        temporary.unlink(missing_ok=True)


def workspace_root() -> Path:
    """The supervisor supplies a private canonical cwd and matching environment."""
    cwd = Path.cwd()
    info = cwd.lstat()
    if (not cwd.is_absolute() or cwd.is_symlink() or cwd.resolve() != cwd or not stat.S_ISDIR(info.st_mode)
            or info.st_uid != os.getuid() or stat.S_IMODE(info.st_mode) != 0o700):
        raise ValueError("workspace_unavailable")
    for name in ("HOME", "USERPROFILE", "TMPDIR"):
        value = os.environ.get(name)
        if not value or Path(value) != cwd or Path(value).resolve() != cwd:
            raise ValueError("workspace_unavailable")
    return cwd


@contextlib.contextmanager
def owned_temporary_directory(prefix: str):
    root = workspace_root()
    with tempfile.TemporaryDirectory(prefix=prefix, dir=root) as temporary:
        yield Path(temporary)


def clean_environment(home: Path, binary: Path) -> None:
    temporary = home / "tmp"
    temporary.mkdir(mode=0o700)
    allowed = {key: value for key, value in os.environ.items() if key in ("PATH", "LANG", "LC_ALL")}
    os.environ.clear()
    os.environ.update(allowed, HOME=str(home), USERPROFILE=str(home), TMPDIR=str(temporary), GEMINI_HOME=str(home / ".gemini"),
        ANTIGRAVITY_HARNESS_PATH=str(binary), PYTHONDONTWRITEBYTECODE="1")
    # Clear stdlib's earlier cached default too; SDK temp APIs must stay owned.
    tempfile.tempdir = str(temporary)
    logging.disable(logging.CRITICAL)


def emit(value: dict) -> None:
    raw = json.dumps(value, ensure_ascii=False, separators=(",", ":"), allow_nan=False).encode("utf-8")
    if len(raw) > 262144:
        raise ValueError("output_limit")
    sys.stdout.buffer.write(raw + b"\n")
    sys.stdout.buffer.flush()


def selection_matches(raw: object, model_id: str) -> bool:
    """Exact CCPA catalog membership, never its replacement/default behavior."""
    if not isinstance(raw, dict) or not isinstance(raw.get("models"), dict) or not isinstance(raw.get("agentModelSorts"), list):
        raise ValueError("catalog_unavailable")
    models = raw["models"]
    if len(models) > 4096 or len(raw["agentModelSorts"]) > 256:
        raise ValueError("catalog_unavailable")
    def exact_id(value) -> bool:
        return (isinstance(value, str) and 0 < len(value.encode("utf-8")) <= 1024
            and value == value.strip() and not any(ord(char) < 32 for char in value))
    if any(not exact_id(name) or not isinstance(info, dict) or ("disabled" in info and type(info["disabled"]) is not bool)
            for name, info in models.items()):
        raise ValueError("catalog_unavailable")
    offered = set()
    entries = 0
    for order in raw["agentModelSorts"]:
        if not isinstance(order, dict) or not isinstance(order.get("groups"), list) or len(order["groups"]) > 256:
            raise ValueError("catalog_unavailable")
        for group in order["groups"]:
            if not isinstance(group, dict) or not isinstance(group.get("modelIds"), list) or len(group["modelIds"]) > 4096:
                raise ValueError("catalog_unavailable")
            for name in group["modelIds"]:
                entries += 1
                if not exact_id(name) or entries > 4096:
                    raise ValueError("catalog_unavailable")
                offered.add(name)
    selected = models.get(model_id)
    return model_id in offered and isinstance(selected, dict) and not selected.get("disabled", False)


def fetch_catalog(manager, token: str, user_agent: str) -> object:
    """Bounded equivalent of official consumer fetch_available_models wire."""
    import requests
    from requests.adapters import HTTPAdapter
    from teacher_sdk_policy import strict_json
    project, endpoint = manager.project_id, manager.endpoint_url
    parsed = urlsplit(endpoint)
    if (not isinstance(project, str) or not project or len(project.encode("utf-8")) > 1024
            or parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password
            or parsed.query or parsed.fragment or parsed.path not in ("", "/")):
        raise ValueError("catalog_unavailable")
    with requests.Session() as session:
        session.trust_env = False
        session.mount("https://", HTTPAdapter(max_retries=0))
        with session.post(endpoint.rstrip("/") + "/v1internal:fetchAvailableModels",
                data=json.dumps({"project": project}).encode("utf-8"),
                headers={"Authorization": "Bearer " + token, "Content-Type": "application/json", "User-Agent": user_agent},
                allow_redirects=False, stream=True, timeout=(5, 15)) as response:
            if response.status_code != 200:
                raise ValueError("catalog_unavailable")
            raw = bytearray()
            for chunk in response.iter_content(chunk_size=16384):
                raw.extend(chunk)
                if len(raw) > 1048576:
                    raise ValueError("catalog_unavailable")
    return strict_json(bytes(raw))


def step_projection(history, conversation_id: str) -> list[dict[str, object]]:
    from teacher_sdk_policy import canonical_hash
    if len(history) > 4096:
        raise ValueError("output_limit")
    return [{"index": s.step_index, "type": s.type.value, "status": s.status.value,
        "source": s.source.value, "target": s.target.value, "error_present": bool(s.error),
        "root_trajectory_matches": s.trajectory_id == conversation_id, "depth": s.depth,
        "complete_response": s.is_complete_response,
        "structured_hash": canonical_hash(s.structured_output) if s.structured_output is not None else None} for s in history]


async def execute(command, profile: Path, binary: Path, assets_hash: str, policy_hash: str,
                  publish=emit, manager_factory=oauth_manager) -> dict:
    from teacher_sdk_policy import SDKPolicyError, make_sdk_config, source_finish
    from teacher_sdk_guard import TeacherSDKGuard

    bound = {**command.binding(), "assets_hash": assets_hash, "policy_hash": policy_hash}
    terminal = {**bound, "event": "terminal", "status": "not_dispatched", "text": None,
        "response_hash": None, "code": "runtime_unavailable", "provider_dispatches": 0,
        "sdk_stop_reason": None, "finish_done": False, "known_child_closed": False,
        "source_proof": None}
    guard = None
    process = None
    known_path = None
    answer = None
    completed_turn = False
    original_cwd = Path.cwd()
    with owned_temporary_directory("nodia-teacher-sdk-") as directory:
        temporary = str(directory)
        home = directory / "HOME"
        home.mkdir(mode=0o700)
        clean_environment(home, binary)
        os.chdir(directory)
        try:
            from google.antigravity import Agent
            from google3.cloud.developer_experience.antigravity_extensions.acp_server import useragent
            command.remaining()
            # Validate SDK effort/model before credential refresh or provider IO.
            conversation_id = str(uuid4())
            config = make_sdk_config(command, "http://127.0.0.1:1", "unused", "unused", temporary, conversation_id)
            try:
                token_path = private_profile(profile)
            except (OSError, ValueError):
                raise SilentAuthRequired("session_required") from None
            manager = manager_factory(token_path)
            await asyncio.to_thread(manager.get_access_token)
            guard = TeacherSDKGuard(command, manager, useragent.default_user_agent())
            url = guard.start()
            config = make_sdk_config(command, url, guard.incoming_token, guard.binding, temporary, conversation_id)
            publish({**bound, "event": "started"})
            async with Agent(config) as agent:
                # Pinned SDK lifecycle handle, used only for child wait/absence.
                # Native's outer supervisor still owns group/terminal proof.
                process = agent.conversation.connection._process
                known_path = Path("/proc") / str(process.pid) / "stat"
                history_before = len(agent.conversation.history)
                response = await agent.chat(command.prompt)
                async def consume():
                    count = 0
                    async for _chunk in response.chunks:
                        count += 1
                        if count > 4096:
                            raise SDKPolicyError("output_limit")
                    return await response.structured_output()
                result = await asyncio.wait_for(consume(), command.remaining())
                terminal["sdk_stop_reason"] = response.stop_reason.value
                if guard.failure_code or guard.provider_dispatches != 1 or guard.local_attempts != 1:
                    raise SDKPolicyError(guard.failure_code or "finish_unverified")
                answer = source_finish(result, step_projection(agent.conversation.history, agent.conversation.conversation_id),
                    guard.reply_hash, response.stop_reason.value, history_before, 1)
            completed_turn = True
        except (Exception, asyncio.CancelledError) as error:
            allowed = {"deadline_expired", "unsupported_effort", "model_mismatch", "finish_unverified", "output_limit",
                "session_required", "second_request", "request_invalid", "request_limit", "prompt_mismatch",
                "effort_mismatch", "context_mismatch", "tools_rejected", "billing_rejected", "reply_invalid",
                "reply_framing", "reply_json", "reply_envelope", "reply_candidates", "reply_parts",
                "reply_finish_missing", "reply_finish_multiple", "reply_reason", "reply_answer_invalid",
                "reply_parts_text", "reply_parts_metadata", "reply_parts_unsupported", "reply_parts_limit", "upstream_rejected",
                "provider_quota", "provider_unavailable", "transport_failed"}
            terminal["code"] = ("cancelled" if isinstance(error, asyncio.CancelledError) else
                guard.failure_code if guard is not None and guard.failure_code in allowed else
                str(error) if isinstance(error, (SDKPolicyError, SilentAuthRequired)) and str(error) in allowed
                else "runtime_failed")
        finally:
            try:
                if guard is not None:
                    guard.close()
                    terminal["provider_dispatches"] = guard.provider_dispatches
                    terminal["source_proof"] = {"local_attempts": guard.local_attempts,
                        "upstream_status": guard.upstream_status, "first_reply_sha256": guard.first_reply_sha256,
                        "finish_structured_hash": guard.reply_hash, "prompt_sha256": sha256(command.prompt.encode("utf-8")).hexdigest()}
                terminal["known_child_closed"] = process is not None and process.poll() is not None and known_path is not None and not known_path.exists()
            finally:
                os.chdir(original_cwd)
    if (completed_turn and answer is not None and terminal["known_child_closed"] and guard is not None
            and guard.local_attempts == 1 and guard.provider_dispatches == 1 and not guard.failure_code):
        terminal.update(status="completed", text=answer.text, response_hash=sha256(answer.text.encode("utf-8")).hexdigest(), code="completed", finish_done=True)
    elif terminal["provider_dispatches"]:
        terminal["status"] = "unknown"
    return terminal


def observe(selection: dict, profile: Path, manager_factory=oauth_manager) -> dict:
    from teacher_sdk_policy import TeacherSDKObserveRequest
    from google.antigravity import types
    from google3.cloud.developer_experience.antigravity_extensions.acp_server import useragent
    command = TeacherSDKObserveRequest.model_validate(selection)
    effort = command.effort_id
    try:
        if effort is not None:
            types.ThinkingLevel(effort)
    except (ValueError, TypeError):
        return {"event": "observation", "authenticated": None, "model_present": None, "effort_serializable": False,
            "reason": "unsupported_effort", "generative": False}
    try:
        manager = manager_factory(private_profile(profile))
        token = manager.get_access_token()
    except (SilentAuthRequired, OSError):
        return {"event": "observation", "authenticated": False, "model_present": None,
            "effort_serializable": True, "reason": "session_required", "generative": False}
    except Exception:
        return {"event": "observation", "authenticated": None, "model_present": None,
            "effort_serializable": True, "reason": "auth_unavailable", "generative": False}
    try:
        catalog = fetch_catalog(manager, token, useragent.default_user_agent())
        present = selection_matches(catalog, command.model_id)
    except Exception:
        return {"event": "observation", "authenticated": True, "model_present": None,
            "effort_serializable": True, "reason": "catalog_unavailable", "generative": False}
    return {"event": "observation", "authenticated": True, "model_present": present,
        "effort_serializable": True, "reason": "observed", "generative": False}


class LoginURLWriter(io.TextIOBase):
    """Only the official private PKCE URL may leave on stderr during login."""
    def __init__(self, destination):
        self.destination, self.pending = destination, ""
        self.emitted = False

    def write(self, value: str) -> int:
        self.pending += value
        if len(self.pending) > 16384:
            raise ValueError("login_output_rejected")
        while "\n" in self.pending:
            line, self.pending = self.pending.split("\n", 1)
            prefix = "Open the following link to authenticate the ACP server: "
            if not line.startswith(prefix):
                continue
            url = line[len(prefix):]
            parsed = urlsplit(url)
            query = parse_qs(parsed.query)
            callback = urlsplit(query.get("redirect_uri", [""])[0])
            if (self.emitted or parsed.scheme != "https" or parsed.hostname != "accounts.google.com"
                    or parsed.username or parsed.password or parsed.fragment
                    or callback.scheme != "http" or callback.hostname != "127.0.0.1" or not callback.port
                    or not query.get("state") or query.get("code_challenge_method") != ["S256"]
                    or not query.get("code_challenge") or {"access_token", "refresh_token", "client_secret", "code"} & set(query)):
                raise ValueError("login_output_rejected")
            self.destination.write("NODIA_TEACHER_SDK_LOGIN_URL=" + url + "\n")
            self.destination.flush()
            self.emitted = True
        return len(value)


def main() -> int:
    # -I intentionally omits the script directory; add only this owned source
    # directory after explicit CLI entry, never arbitrary cwd/PYTHONPATH.
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from teacher_sdk_policy import CONTRACT, INPUT_LIMIT, TeacherSDKHostRequest, TeacherSDKObserveRequest, canonical_hash, strict_json
    parser = argparse.ArgumentParser()
    action = parser.add_mutually_exclusive_group()
    action.add_argument("--execute", action="store_true")
    action.add_argument("--observe", action="store_true")
    action.add_argument("--login", action="store_true")
    parser.add_argument("--profile", type=Path)
    parser.add_argument("--manifest", type=Path)
    parser.add_argument("--manifest-sha256")
    args = parser.parse_args()
    if not (args.execute or args.observe or args.login):
        emit({"contract": CONTRACT, "event": "inert", "generative": False})
        return 0
    stage = "prepare"
    try:
        _data, binary, digest = assets(args.manifest, args.manifest_sha256)
        logging.disable(logging.CRITICAL)
        if args.execute:
            stage = "input"
            raw = sys.stdin.buffer.read(INPUT_LIMIT + 1)
            if len(raw) > INPUT_LIMIT:
                raise ValueError("invalid_input")
            command = TeacherSDKHostRequest.model_validate(strict_json(raw))
            stage = "execute"
            original_output = sys.stdout.buffer
            def publish(value: dict) -> None:
                encoded = json.dumps(value, ensure_ascii=False, separators=(",", ":"), allow_nan=False).encode("utf-8")
                if len(encoded) > 262144:
                    raise ValueError("output_limit")
                original_output.write(encoded + b"\n")
                original_output.flush()
            with contextlib.redirect_stdout(DiscardOutput()), contextlib.redirect_stderr(DiscardOutput()):
                terminal = asyncio.run(execute(command, args.profile, binary, digest, canonical_hash(_data["host_source_pins"]), publish=publish))
            emit(terminal)
            return 0
        with owned_temporary_directory("nodia-teacher-sdk-meta-") as temporary:
            clean_environment(temporary, binary)
            if args.observe:
                stage = "input"
                raw = sys.stdin.buffer.read(16385)
                if len(raw) > 16384:
                    raise ValueError("invalid_input")
                selection = TeacherSDKObserveRequest.model_validate(strict_json(raw))
                stage = "observe"
                emit({"contract": CONTRACT, "assets_hash": digest, "policy_hash": canonical_hash(_data["host_source_pins"]),
                    **observe(selection.model_dump(), args.profile)})
            else:
                import webbrowser
                class NoBrowser:
                    def open(self, *_args, **_kwargs):
                        return False
                webbrowser.register("nodia-teacher-no-browser", None, NoBrowser(), preferred=True)
                os.environ["BROWSER"] = "nodia-teacher-no-browser"
                manager = oauth_manager(private_profile(args.profile, create=True), interactive=True)
                emit({"contract": CONTRACT, "event": "login_started", "generative": False})
                with contextlib.redirect_stderr(LoginURLWriter(sys.stderr)), contextlib.redirect_stdout(DiscardOutput()):
                    login_and_rotate(manager, args.profile)
                emit({"contract": CONTRACT, "event": "login_completed", "authenticated": True, "generative": False})
        return 0
    except Exception as error:
        emit({"contract": CONTRACT, "event": "error", "code": "invalid_input" if stage == "input" else
            "session_required" if isinstance(error, SilentAuthRequired) else "runtime_unavailable", "generative": False})
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
