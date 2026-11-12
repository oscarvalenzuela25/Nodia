#!/usr/bin/env python3
"""Initial private configuration entry. No network, journal bootstrap or app activation."""
import argparse
import base64
import datetime
import getpass
import ipaddress
import json
import os
from pathlib import Path
import re
import secrets
import stat
import subprocess
import sys
import tempfile
from urllib.parse import urlsplit
import uuid

DEFAULT_FIELDS = {"bootstrap_email", "r2_bucket", "google_client_id", "postgres_host",
                  "postgres_port", "postgres_database", "frontend_origin"}
STATE = Path("/var/lib/nodia-backend-setup")
RUNTIME = Path("/etc/nodia/runtime.env")
RECOVERY = Path("/var/lib/nodia/config/recovery.json")


class ConfigurationError(Exception):
    def __init__(self, field, code):
        super().__init__(f"{field}:{code}")
        self.field, self.code = field, code


def text(value, field, maximum=4096):
    if not isinstance(value, str) or not value or len(value) > maximum or any(
            ord(char) < 32 or ord(char) == 127 or 0xD800 <= ord(char) <= 0xDFFF for char in value):
        raise ConfigurationError(field, "invalid_text")
    return value


def dns_name(value):
    if not isinstance(value, str) or len(value) > 253 or "." not in value:
        return False
    try:
        ipaddress.ip_address(value)
        return False
    except ValueError:
        return all(re.fullmatch(r"[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?", label)
                   for label in value.split("."))


def bucket(value, field):
    if not isinstance(value, str) or not re.fullmatch(r"[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]", value):
        raise ConfigurationError(field, "invalid_bucket")
    return value


def endpoint(value):
    text(value, "R2_ENDPOINT", 2048)
    try:
        parsed = urlsplit(value)
        if (parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password
                or parsed.query or parsed.fragment or parsed.path not in ("", "/")):
            raise ValueError()
        _ = parsed.port
    except ValueError:
        raise ConfigurationError("R2_ENDPOINT", "https_root_required") from None
    return "https://" + parsed.netloc + "/"


def validate_defaults(value):
    if not isinstance(value, dict) or set(value) != DEFAULT_FIELDS:
        raise ConfigurationError("DEFAULTS", "closed_schema_required")
    result = dict(value)
    for field in DEFAULT_FIELDS - {"postgres_port", "google_client_id"}:
        text(value[field], field)
    email = value["bootstrap_email"]
    if len(email) > 254 or email.count("@") != 1 or any(char.isspace() for char in email):
        raise ConfigurationError("bootstrap_email", "invalid_email")
    local, domain = email.split("@")
    if not local or not dns_name(domain):
        raise ConfigurationError("bootstrap_email", "invalid_email")
    bucket(value["r2_bucket"], "r2_bucket")
    if not dns_name(value["postgres_host"]):
        raise ConfigurationError("postgres_host", "dns_hostname_required")
    port = value["postgres_port"]
    if isinstance(port, bool) or not isinstance(port, (int, str)) or not re.fullmatch(r"[0-9]{1,5}", str(port)) or not 0 < int(port) <= 65535:
        raise ConfigurationError("postgres_port", "invalid_port")
    result["postgres_port"] = str(port)
    if not re.fullmatch(r"[A-Za-z0-9_][A-Za-z0-9_-]{0,62}", value["postgres_database"]):
        raise ConfigurationError("postgres_database", "invalid_database")
    google = value["google_client_id"]
    if not isinstance(google, str) or (google and not re.fullmatch(r"[A-Za-z0-9._-]+\.apps\.googleusercontent\.com", google)):
        raise ConfigurationError("google_client_id", "invalid_client_id")
    try:
        origin = urlsplit(value["frontend_origin"])
        authority = origin.hostname or ""
        if ":" in authority:
            authority = "[" + authority + "]"
        if origin.port not in (None, 443):
            authority += ":" + str(origin.port)
        if (origin.scheme != "https" or not origin.hostname or origin.username or origin.password
                or origin.path or origin.query or origin.fragment or value["frontend_origin"] != f"https://{authority}"):
            raise ValueError()
        _ = origin.port
    except ValueError:
        raise ConfigurationError("frontend_origin", "exact_https_origin_required") from None
    return result


def environment_file(values):
    """EnvironmentFile has no shell expansion. Double-quote and escape only slash/quote."""
    lines = []
    for key, value in values.items():
        if not re.fullmatch(r"[A-Z_][A-Z0-9_]*", key):
            raise ConfigurationError("ENVIRONMENT", "invalid_key")
        text(value, "ENVIRONMENT")
        lines.append(key + '=\"' + value.replace("\\", "\\\\").replace('"', '\\"') + '\"\n')
    return "".join(lines)


def build_configuration(defaults, entered):
    defaults = validate_defaults(defaults)
    username = text(entered["postgres_user"], "POSTGRES_USER", 63)
    if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_-]{0,62}", username) or username == "nodia_user":
        raise ConfigurationError("POSTGRES_USER", "explicit_normal_user_required")
    password = text(entered["postgres_password"], "POSTGRES_PASSWORD")
    if password == "nodia_password":
        raise ConfigurationError("POSTGRES_PASSWORD", "development_default_rejected")
    r2_endpoint = endpoint(entered["r2_endpoint"])
    account = text(entered["r2_account_id"], "R2_ACCOUNT_ID", 2048)
    access_key = text(entered["r2_access_key_id"], "R2_ACCESS_KEY_ID", 2048)
    access_secret = text(entered["r2_secret_access_key"], "R2_SECRET_ACCESS_KEY", 2048)
    recovery_bucket = bucket(entered["recovery_bucket"], "RECOVERY_BUCKET")
    if not defaults["google_client_id"]:
        raise ConfigurationError("google_client_id", "required")
    # Generate once, only after all entered fields have passed local validation.
    runtime = {
        "NODE_ENV": "production", "PORT": "3000", "PGSSLMODE": "verify-full",
        "POSTGRES_HOST": defaults["postgres_host"], "POSTGRES_PORT": defaults["postgres_port"],
        "POSTGRES_DB": defaults["postgres_database"], "POSTGRES_USER": username, "POSTGRES_PASSWORD": password,
        "AUTH_JWT_SECRET": secrets.token_hex(32), "AI_SECRET_MASTER_KEY": secrets.token_hex(32),
        "GEMINI_SERVICE_TOKEN": secrets.token_hex(32), "GOOGLE_CLIENT_ID": defaults["google_client_id"],
        "AUTH_ALLOWED_ORIGINS": defaults["frontend_origin"], "AUTH_COOKIE_SAME_SITE": "none",
        "AUTH_COOKIE_SECURE": "true", "TRUST_PROXY": "127.0.0.1,::1",
        "BOOTSTRAP_SUPER_ADMIN_EMAIL": defaults["bootstrap_email"],
        "R2_ACCOUNT_ID": account, "R2_ENDPOINT": r2_endpoint, "R2_ACCESS_KEY_ID": access_key,
        "R2_SECRET_ACCESS_KEY": access_secret, "R2_BUCKET_NAME": defaults["r2_bucket"],
        "NODIA_AI_OPERATION_MODE": "normal", "NODIA_AI_RECOVERY_CONFIG_FILE": str(RECOVERY),
        "HOME": "/var/lib/nodia/home", "NODIA_CODEX_PROFILE_ROOT": "/var/lib/nodia/codex",
    }
    recovery = {"schema_version": 1, "deployment_id": "nodia-" + uuid.uuid4().hex,
                "era_id": str(uuid.uuid4()), "endpoint": r2_endpoint, "bucket": recovery_bucket,
                "access_key_id": access_key, "secret_access_key": access_secret,
                "journal_encryption_key": base64.b64encode(secrets.token_bytes(32)).decode("ascii")}
    return runtime, recovery


def safe_file(path, allowed_uids, mode):
    info = path.lstat()
    if not stat.S_ISREG(info.st_mode) or info.st_uid not in allowed_uids or stat.S_IMODE(info.st_mode) != mode:
        raise ConfigurationError("PRIVATE_FILE", "unexpected_owner_type_or_mode")
    return info


def private_write(path, payload, uid=0, gid=0, mode=0o600):
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    # A partial final file is deliberately preserved. A later attempt must refuse it.
    with os.fdopen(descriptor, "wb") as stream:
        stream.write(payload)
        stream.flush()
        os.fsync(stream.fileno())
        os.fchown(stream.fileno(), uid, gid)
        os.fchmod(stream.fileno(), mode)
    parent_descriptor = os.open(path.parent, os.O_RDONLY | os.O_DIRECTORY)
    try:
        os.fsync(parent_descriptor)
    finally:
        os.close(parent_descriptor)


def status(phase, fields=(), code=None):
    payload = {"updated_at_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
               "phase": phase, "fields": list(fields), "code": code,
               "remote_validation_performed": False, "application_started": False}
    descriptor, name = tempfile.mkstemp(prefix=".config-status-", dir=STATE)
    with os.fdopen(descriptor, "w", encoding="utf-8", newline="\n") as stream:
        json.dump(payload, stream)
        stream.write("\n")
    os.chmod(name, 0o600)
    os.replace(name, STATE / "config-status.json")


def services_inactive():
    for unit in ("nodia-api.service", "nodia-ai-worker.service"):
        for verb, expected in (("is-enabled", "disabled"), ("is-active", "inactive")):
            result = subprocess.run(["systemctl", verb, unit], capture_output=True, text=True, timeout=10)
            if result.stdout.strip() != expected:
                raise ConfigurationError("SERVICES", "must_be_disabled_and_inactive")


def check_tree(uid, gid):
    for path, owner, group, mode in (
            (STATE, 0, 0, 0o755), (Path("/etc/nodia"), 0, 0, 0o700),
            (Path("/var/lib/nodia"), 0, gid, 0o750),
            (RECOVERY.parent, 0, gid, 0o750),
            (Path("/var/lib/nodia/home"), uid, gid, 0o700),
            (Path("/var/lib/nodia/codex"), uid, gid, 0o700)):
        info = path.lstat()
        if not stat.S_ISDIR(info.st_mode) or info.st_uid != owner or info.st_gid != group or stat.S_IMODE(info.st_mode) != mode:
            raise ConfigurationError("HOST_DIRECTORIES", "unexpected_owner_type_or_mode")
    if RUNTIME.exists() or RUNTIME.is_symlink() or RECOVERY.exists() or RECOVERY.is_symlink():
        raise ConfigurationError("CONFIGURATION", "existing_files_preserved_no_rotation")


def test_systemd_environment():
    fixture = {"NODIA_SYNTHETIC_FIXTURE": 'spaces ; | $HOME $(false) `false` "quote" \\path\\ end',
               "NODIA_SYNTHETIC_SECOND": "a=b 'single' # hash % percent"}
    unit = "nodia-config-envcheck-" + uuid.uuid4().hex
    with tempfile.TemporaryDirectory(prefix=".envcheck-", dir=STATE) as directory:
        path = Path(directory) / "fixture.env"
        path.write_text(environment_file(fixture), encoding="utf-8", newline="\n")
        path.chmod(0o600)
        code = "import os,sys; expected=" + repr(fixture) + ";sys.exit(0 if all(os.environ.get(k)==v for k,v in expected.items()) else 81)"
        try:
            result = subprocess.run([
                "systemd-run", "--quiet", "--collect", "--wait", "--pipe", "--expand-environment=no",
                "--unit=" + unit, "--property=Type=oneshot", "--property=User=nodia", "--property=Group=nodia",
                "--property=TimeoutStartSec=15", "--property=EnvironmentFile=" + str(path),
                "/usr/bin/python3", "-c", code], capture_output=True, text=True, timeout=30)
            if result.returncode:
                raise ConfigurationError("ENVIRONMENT_SERIALIZATION", "systemd_roundtrip_failed")
        finally:
            subprocess.run(["systemctl", "stop", unit], capture_output=True, timeout=10, check=False)


def run(defaults_file):
    import fcntl
    import pwd
    if os.geteuid() != 0 or not sys.stdin.isatty() or not sys.stdout.isatty():
        raise ConfigurationError("OPERATOR", "root_interactive_tty_required")
    user = pwd.getpwnam("nodia")
    if not (900 <= user.pw_uid < 990 and user.pw_uid == user.pw_gid and user.pw_shell == "/usr/sbin/nologin"):
        raise ConfigurationError("SERVICE_IDENTITY", "unexpected_account")
    check_tree(user.pw_uid, user.pw_gid)
    services_inactive()
    defaults_path = Path(defaults_file)
    administrator = pwd.getpwnam("nodia-admin")
    info = safe_file(defaults_path, {0, administrator.pw_uid}, 0o600)
    if info.st_size > 16_384:
        raise ConfigurationError("DEFAULTS", "file_too_large")
    try:
        defaults = validate_defaults(json.loads(defaults_path.read_text(encoding="utf-8")))
    except (ValueError, UnicodeError):
        raise ConfigurationError("DEFAULTS", "invalid_json") from None
    descriptor = os.open(STATE / "config.lock", os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
    with os.fdopen(descriptor, "r+") as lock:
        lock_info = os.fstat(lock.fileno())
        if not stat.S_ISREG(lock_info.st_mode) or lock_info.st_uid != 0 or stat.S_IMODE(lock_info.st_mode) != 0o600:
            raise ConfigurationError("CONFIGURATION_LOCK", "unexpected_owner_type_or_mode")
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        check_tree(user.pw_uid, user.pw_gid)
        status("preparing")
        try:
            test_systemd_environment()
            print("EnvironmentFile serialization: verified with synthetic values; no application started.")
            if not defaults["google_client_id"]:
                defaults["google_client_id"] = input("GOOGLE_CLIENT_ID: ").strip()
                defaults = validate_defaults(defaults)
            print("Enter the normal Northflank USERNAME, not ADMIN_USERNAME. Values stay in this terminal.")
            entered = {"postgres_user": input("PostgreSQL USERNAME: ").strip(),
                       "postgres_password": getpass.getpass("PostgreSQL PASSWORD (hidden): ")}
            entered["r2_endpoint"] = endpoint(input("R2 S3 API endpoint (HTTPS root URL): ").strip())
            entered["r2_account_id"] = input("R2 account ID: ").strip()
            entered["r2_access_key_id"] = getpass.getpass("R2 Access Key ID (hidden): ")
            entered["r2_secret_access_key"] = getpass.getpass("R2 Secret Access Key (hidden): ")
            entered["recovery_bucket"] = input("Recovery bucket (Enter = configured file bucket): ").strip() or defaults["r2_bucket"]
            runtime, recovery = build_configuration(defaults, entered)
            payload = environment_file(runtime).encode("utf-8")
            recovery_payload = (json.dumps(recovery, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
            if len(recovery_payload) > 16_384:
                raise ConfigurationError("RECOVERY_CONFIG", "file_too_large")
            services_inactive()
            check_tree(user.pw_uid, user.pw_gid)
            status("writing_recovery", recovery.keys())
            private_write(RECOVERY, recovery_payload, user.pw_uid, user.pw_gid, 0o400)
            status("writing_environment", runtime.keys())
            private_write(RUNTIME, payload)
            safe_file(RECOVERY, {user.pw_uid}, 0o400)
            safe_file(RUNTIME, {0}, 0o600)
            status("configured_locally", runtime.keys())
            print("Configuration saved privately. No remote validation, journal bootstrap, migration, backup or application activation performed.")
        except KeyboardInterrupt:
            status("interrupted", code="files_if_present_preserved")
            raise
        except Exception:
            status("failed", code="inspect_private_operator_terminal_files_preserved")
            raise


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Initial private backend configuration; does not activate services.")
    parser.add_argument("--defaults-file", required=True)
    args = parser.parse_args()
    try:
        run(args.defaults_file)
    except ConfigurationError as error:
        print(f"Configuration refused: {error.field}:{error.code}. Existing files were preserved.", file=sys.stderr)
        sys.exit(1)
    except KeyboardInterrupt:
        print("Configuration interrupted; inspect any partial files before retrying.", file=sys.stderr)
        sys.exit(130)
    except Exception:
        print("Configuration failed; inspect private files/status. No secrets or exception details are printed.", file=sys.stderr)
        sys.exit(1)
