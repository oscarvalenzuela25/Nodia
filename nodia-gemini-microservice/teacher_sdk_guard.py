"""Authenticated one-shot CCPA bridge. No SDK, profiles or sockets on import."""
from datetime import datetime
from hashlib import sha256
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import re
import secrets
import threading
from urllib.parse import unquote, urlsplit

from teacher_sdk_policy import (PROMPT_LIMIT, REPLY_LIMIT, SCHEMA, SDKPolicyError, TeacherSDKAnswer,
    TeacherSDKHostRequest, canonical_hash, finish_tool_configuration, strict_json)

REQUEST_LIMIT = 2000000


def effective_tools(value: object) -> list[str]:
    if not isinstance(value, dict) or not isinstance(value.get("contents"), list):
        raise SDKPolicyError("request_invalid")
    names: list[str] = []
    groups = value.get("tools", [])
    if not isinstance(groups, list) or len(groups) > 1:
        raise SDKPolicyError("tools_rejected")
    for group in groups:
        if not isinstance(group, dict) or set(group) not in ({"functionDeclarations"}, {"function_declarations"}):
            raise SDKPolicyError("tools_rejected")
        declarations = next(iter(group.values()))
        if not isinstance(declarations, list) or len(declarations) > 1:
            raise SDKPolicyError("tools_rejected")
        for item in declarations:
            if (not isinstance(item, dict) or item.get("name") != "finish"
                    or set(item) - {"name", "description", "parametersJsonSchema"}
                    or canonical_hash(item.get("parametersJsonSchema")) != canonical_hash(SCHEMA)):
                raise SDKPolicyError("tools_rejected")
            names.append(item["name"])
    if names != ["finish"]:
        raise SDKPolicyError("tools_rejected")
    return names


def validate_request(command: TeacherSDKHostRequest, target: str, raw: bytes) -> dict[str, object]:
    if len(raw) > REQUEST_LIMIT:
        raise SDKPolicyError("request_limit")
    parsed = urlsplit(target)
    match = re.fullmatch(r"/v1(?:beta)?/models/([^/:]+):(streamGenerateContent|generateContent)", parsed.path)
    if (parsed.scheme or parsed.netloc or parsed.fragment or not match or match[1] != command.model_id
            or unquote(match[1]) != command.model_id or parsed.query not in ("", "alt=sse")):
        raise SDKPolicyError("model_mismatch")
    value = strict_json(raw)
    effective_tools(value)
    if value.get("toolConfig") != finish_tool_configuration():
        raise SDKPolicyError("tools_rejected")
    if set(value) - {"contents", "sessionId", "systemInstruction", "tools", "toolConfig", "generationConfig", "safetySettings"}:
        raise SDKPolicyError("request_invalid")
    session_id = value.get("sessionId")
    # SDK provider metadata is not Nodia authority or a conversation identity.
    if session_id is not None and (not isinstance(session_id, str) or not 0 < len(session_id.encode("utf-8")) <= 256
            or any(ord(char) < 32 for char in session_id)):
        raise SDKPolicyError("context_mismatch")
    if set(value) & {"enabled_credit_types", "enabledCreditTypes", "allowUsingCredits", "useG1Credits"}:
        raise SDKPolicyError("billing_rejected")
    generation = value.get("generationConfig", {})
    if not isinstance(generation, dict) or not isinstance(generation.get("thinkingConfig", {}), dict):
        raise SDKPolicyError("effort_mismatch")
    if generation.get("thinkingConfig", {}).get("thinkingLevel") != command.effort_id:
        raise SDKPolicyError("effort_mismatch")
    if len(value["contents"]) != 1 or not isinstance(value["contents"][0], dict) or value["contents"][0].get("role") != "user":
        raise SDKPolicyError("prompt_mismatch")
    text = []
    for content in value["contents"]:
        if isinstance(content, dict) and content.get("role") == "user":
            parts = content.get("parts")
            if not isinstance(parts, list):
                raise SDKPolicyError("prompt_mismatch")
            for part in parts:
                if not isinstance(part, dict) or set(part) != {"text"} or not isinstance(part["text"], str):
                    raise SDKPolicyError("prompt_mismatch")
                text.append(part["text"])
    if len(text) != 1:
        raise SDKPolicyError("prompt_mismatch")
    wrapped, original = text[0].encode("utf-8"), command.prompt.encode("utf-8")
    prefix = b"<USER_REQUEST>\n"
    end = len(prefix) + len(original)
    clock = re.fullmatch(rb"\n</USER_REQUEST>\n<ADDITIONAL_METADATA>\nThe current local time is: (\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:Z|[+-]\d\d:\d\d))\.\n</ADDITIONAL_METADATA>", wrapped[end:])
    if not (0 < len(original) <= PROMPT_LIMIT and wrapped.startswith(prefix) and clock
            and secrets.compare_digest(wrapped[len(prefix):end], original)):
        raise SDKPolicyError("prompt_mismatch")
    try:
        datetime.fromisoformat(clock[1].decode().replace("Z", "+00:00"))
    except ValueError:
        raise SDKPolicyError("prompt_mismatch") from None
    return value


def compose_teacher_request(command: TeacherSDKHostRequest, target: str, raw: bytes) -> dict[str, object]:
    """Translate the exact pinned SDK default into Teacher's owned request.

    NONE is recognized only here as SDK serialization, never forwarded. AUTO,
    extra names/fields and unknown modes fail closed. The final request is
    revalidated in full, including the exact ANY/finish provider configuration.
    """
    if len(raw) > REQUEST_LIMIT:
        raise SDKPolicyError("request_limit")
    value = strict_json(raw)
    if not isinstance(value, dict) or value.get("toolConfig") not in (
            {"functionCallingConfig": {"mode": "NONE"}}, finish_tool_configuration()):
        raise SDKPolicyError("tools_rejected")
    composed = {**value, "toolConfig": finish_tool_configuration()}
    return validate_request(command, target,
        json.dumps(composed, ensure_ascii=False, allow_nan=False).encode("utf-8"))


def _reply_json(raw: bytes) -> object:
    try:
        return strict_json(raw)
    except (ValueError, UnicodeError, RecursionError, TypeError):
        raise SDKPolicyError("reply_json") from None


def reply_finish(raw: bytes, streaming: bool) -> tuple[bytes, str]:
    """Bound and validate the actual first upstream reply before SDK sees it."""
    if not raw or len(raw) > REPLY_LIMIT:
        raise SDKPolicyError("reply_framing")
    packets = []
    if streaming:
        normalized = raw.replace(b"\r\n", b"\n")
        # Match the pinned GenAI stream decoder: join data lines in one event,
        # and flush a complete JSON event at EOF without requiring a blank line.
        for event in normalized.split(b"\n\n"):
            if not event.strip():
                continue
            lines = event.splitlines()
            data = [line[5:].strip() for line in lines if line.startswith(b"data:")]
            if not data or any(line and not line.startswith((b"data:", b":")) for line in lines):
                raise SDKPolicyError("reply_framing")
            packet = _reply_json(b"\n".join(data))
            if not isinstance(packet, dict):
                raise SDKPolicyError("reply_envelope")
            packets.append(packet.get("response", packet))
    else:
        packet = _reply_json(raw)
        if not isinstance(packet, dict):
            raise SDKPolicyError("reply_envelope")
        packets.append(packet.get("response", packet))
    finish = []
    stopped = False
    for packet in packets:
        if not isinstance(packet, dict):
            raise SDKPolicyError("reply_envelope")
        candidates = packet.get("candidates", [])
        if not isinstance(candidates, list) or len(candidates) > 1:
            raise SDKPolicyError("reply_candidates")
        for candidate in candidates:
            if stopped or not isinstance(candidate, dict):
                raise SDKPolicyError("reply_candidates")
            content = candidate.get("content", {})
            if not isinstance(content, dict) or content.get("role", "model") != "model":
                raise SDKPolicyError("reply_parts")
            if set(content) - {"role", "parts"}:
                raise SDKPolicyError("reply_parts_unsupported")
            parts = content.get("parts", [])
            if not isinstance(parts, list):
                raise SDKPolicyError("reply_parts")
            if len(parts) > 64:
                raise SDKPolicyError("reply_parts_limit")
            for part in parts:
                if not isinstance(part, dict):
                    raise SDKPolicyError("reply_parts")
                if "functionCall" in part:
                    call = part["functionCall"]
                    if (set(part) - {"functionCall", "thoughtSignature"} or not isinstance(call, dict)
                            or call.get("name") != "finish" or set(call) - {"name", "args", "id"}):
                        raise SDKPolicyError("tools_rejected")
                    if "thoughtSignature" in part and not isinstance(part["thoughtSignature"], str):
                        raise SDKPolicyError("reply_parts_metadata")
                    try:
                        answer = TeacherSDKAnswer.model_validate(call.get("args"))
                    except ValueError:
                        raise SDKPolicyError("reply_answer_invalid") from None
                    finish.append(canonical_hash(answer.model_dump()))
                else:
                    if set(part) - {"text", "thought", "thoughtSignature"}:
                        raise SDKPolicyError("reply_parts_unsupported")
                    if "text" in part and not isinstance(part["text"], str):
                        raise SDKPolicyError("reply_parts_text")
                    if (("thought" in part and type(part["thought"]) is not bool)
                            or ("thoughtSignature" in part and not isinstance(part["thoughtSignature"], str))
                            or not set(part) & {"text", "thoughtSignature"}):
                        raise SDKPolicyError("reply_parts_metadata")
                    # Text and typed signature metadata are non-executable SDK
                    # data. Only the separately validated finish can be an answer.
                    # Signature-only metadata is an explicit bounded tolerance;
                    # no claim is made that it caused a historical live failure.
            reason = candidate.get("finishReason")
            if reason is not None:
                if reason != "STOP":
                    raise SDKPolicyError("reply_reason")
                stopped = True
    if not stopped:
        raise SDKPolicyError("reply_reason")
    if not finish:
        raise SDKPolicyError("reply_finish_missing")
    if len(finish) != 1:
        raise SDKPolicyError("reply_finish_multiple")
    body = (b"".join(b"data: " + json.dumps(p, ensure_ascii=False, allow_nan=False).encode("utf-8") + b"\n\n" for p in packets)
        if streaming else json.dumps(packets[0], ensure_ascii=False, allow_nan=False).encode("utf-8"))
    return body, finish[0]


class TeacherSDKGuard:
    """One process/job. Counts upstream attempts before the HTTP client call."""
    def __init__(self, command: TeacherSDKHostRequest, oauth_manager, user_agent: str, session_factory=None):
        self.command, self.oauth, self.user_agent = command, oauth_manager, user_agent
        self.incoming_token, self.binding = secrets.token_hex(32), command.binding()["binding_hash"]
        self.local_attempts = 0
        self.provider_dispatches = 0
        self.reply_hash: str | None = None
        self.first_reply_sha256: str | None = None
        self.failure_code: str | None = None
        self.upstream_status: int | None = None
        self.lock = threading.Lock()
        self.server = None
        self.thread = None
        if session_factory is None:
            import requests
            from requests.adapters import HTTPAdapter
            self.session = requests.Session()
            self.session.trust_env = False
            self.session.mount("https://", HTTPAdapter(max_retries=0))
        else:
            self.session = session_factory()

    def reserve_local(self) -> None:
        with self.lock:
            self.local_attempts += 1
            if self.local_attempts != 1:
                self.failure_code = "second_request"
                raise SDKPolicyError("second_request")

    def forward(self, target: str, raw: bytes) -> tuple[bytes, str]:
        value = compose_teacher_request(self.command, target, raw)
        token = self.oauth.get_access_token()
        project, base = self.oauth.project_id, self.oauth.endpoint_url
        endpoint = urlsplit(base)
        if (endpoint.scheme != "https" or not endpoint.hostname or endpoint.username or endpoint.password
                or endpoint.query or endpoint.fragment or endpoint.path not in ("", "/")):
            raise SDKPolicyError("runtime_unavailable")
        if not isinstance(project, str) or not project or len(project.encode()) > 1024:
            raise SDKPolicyError("session_required")
        if not isinstance(token, str) or not token or not token.isascii() or any(ord(c) < 32 for c in token):
            raise SDKPolicyError("session_required")
        streaming = ":streamGenerateContent" in target
        route = "/v1internal:streamGenerateContent?alt=sse" if streaming else "/v1internal:generateContent"
        payload = json.dumps({"project": project, "model": self.command.model_id, "request": value}, allow_nan=False).encode("utf-8")
        timeout = (5, min(60, self.command.remaining()))
        with self.lock:
            if self.provider_dispatches or self.failure_code:
                raise SDKPolicyError("second_request")
            self.command.remaining()
            self.provider_dispatches = 1
        # Exact official CCPA envelope. No billing opt-in field or external key.
        response = self.session.post(base.rstrip("/") + route,
            data=payload,
            headers={"Authorization": "Bearer " + token, "Content-Type": "application/json", "User-Agent": self.user_agent},
            allow_redirects=False, stream=True, timeout=timeout)
        with response:
            self.upstream_status = response.status_code
            if response.status_code != 200:
                raise SDKPolicyError({401: "session_required", 429: "provider_quota", 502: "provider_unavailable",
                    503: "provider_unavailable", 504: "provider_unavailable"}.get(response.status_code, "upstream_rejected"))
            raw_reply = bytearray()
            for chunk in response.iter_content(chunk_size=16384):
                self.command.remaining()
                raw_reply.extend(chunk)
                if len(raw_reply) > REPLY_LIMIT:
                    raise SDKPolicyError("reply_framing")
        self.first_reply_sha256 = sha256(raw_reply).hexdigest()
        body, proof = reply_finish(bytes(raw_reply), streaming)
        self.reply_hash = proof
        return body, "text/event-stream" if streaming else "application/json"

    def start(self) -> str:
        owner = self

        class Handler(BaseHTTPRequestHandler):
            def setup(self):
                super().setup()
                self.connection.settimeout(min(5, owner.command.remaining()))

            def log_message(self, *_args):
                pass

            def do_POST(self):
                token, binding = self.headers.get("X-Nodia-Teacher-Token", ""), self.headers.get("X-Nodia-Teacher-Binding", "")
                if (not token.isascii() or not binding.isascii() or not secrets.compare_digest(token, owner.incoming_token)
                        or not secrets.compare_digest(binding, owner.binding)):
                    self.send_response(401)
                    self.send_header("Content-Length", "0")
                    self.end_headers()
                    self.close_connection = True
                    return
                try:
                    owner.reserve_local()
                    self.connection.settimeout(min(5, owner.command.remaining()))
                    length = int(self.headers.get("Content-Length", "-1"))
                    if not 0 <= length <= REQUEST_LIMIT or self.headers.get("Transfer-Encoding") is not None:
                        raise SDKPolicyError("request_limit")
                    raw = self.rfile.read(length)
                    if len(raw) != length:
                        raise SDKPolicyError("request_invalid")
                    body, content_type = owner.forward(self.path, raw)
                    self.send_response(200)
                    self.send_header("Content-Type", content_type)
                    self.send_header("Content-Length", str(len(body)))
                    self.end_headers()
                    self.wfile.write(body)
                except Exception as error:
                    with owner.lock:
                        owner.failure_code = str(error) if isinstance(error, SDKPolicyError) else "transport_failed"
                    try:
                        self.send_response(409)
                        self.send_header("Content-Length", "0")
                        self.end_headers()
                    except OSError:
                        pass

        self.server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        # Drain accepted requests before deciding the turn succeeded. A late
        # second request must set failure_code before terminal publication.
        self.server.daemon_threads = False
        self.thread = threading.Thread(target=self.server.serve_forever, kwargs={"poll_interval": 0.05}, daemon=True)
        self.thread.start()
        return "http://127.0.0.1:" + str(self.server.server_port)

    def close(self) -> None:
        if self.server is not None:
            self.server.shutdown()
            self.server.server_close()
        if self.thread is not None:
            self.thread.join(2)
        self.session.close()
