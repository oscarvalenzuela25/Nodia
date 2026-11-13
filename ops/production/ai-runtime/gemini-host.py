"""Root-only lifecycle for the private adapter. Docker never restarts it itself.

systemd owns each generation; ExecStartPost must attach its exact cgroup before
the unit becomes active. A failed post-start also stops the container. No route
or model is allowed to invoke this operator command.
"""
import argparse
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import sys
import time
import urllib.error
import urllib.request

NAME = "nodia-gemini-microservice"
CONFIG = Path("/etc/nodia/ai-runtime/gemini-image.json")
ENV = Path("/etc/nodia/ai-runtime/gemini.env")
STATE = Path("/var/lib/nodia-gemini")
CLI = "/opt/nodia/antigravity-cli/1.3.1/agy"
CLI_HASH = "f57ad0a04c93e1d13b86bd13c4f35b6577bc0557e6bfd718e9f3a2bdb4504240113f6bbcfefad9f039eb1d5e7e23e0a2623b4b7687882eca86954e485ad9f9c2"


def require(condition, code):
    if not condition:
        raise RuntimeError(code)


def run(arguments, timeout=45):
    result = subprocess.run(arguments, capture_output=True, timeout=timeout, check=False)
    require(result.returncode == 0, "container_command_failed")
    require(len(result.stdout) < 1048576, "container_response_too_large")
    return result.stdout.decode("utf-8").strip()


def private_file(path):
    for part in [path, *path.parents]:
        info = part.lstat()
        require(not stat.S_ISLNK(info.st_mode) and info.st_uid == 0 and not info.st_mode & 0o022,
                "unsafe_operator_path")
    info = path.lstat()
    require(stat.S_ISREG(info.st_mode) and stat.S_IMODE(info.st_mode) == 0o600 and info.st_nlink == 1,
            "unsafe_operator_file")
    require(info.st_size <= 8192, "operator_file_too_large")
    return path.read_bytes()


def image_id():
    value = json.loads(private_file(CONFIG))
    require(set(value) == {"schema_version", "image_id", "source_sha"} and value["schema_version"] == 1,
            "image_config_invalid")
    require(re.fullmatch(r"sha256:[a-f0-9]{64}", value["image_id"]) is not None and
            re.fullmatch(r"[a-f0-9]{40}", value["source_sha"]) is not None, "image_identity_invalid")
    return value["image_id"]


def create_arguments(image):
    require(re.fullmatch(r"sha256:[a-f0-9]{64}", image) is not None, "image_identity_invalid")
    return ["docker", "create", "--name", NAME, "--label", "sh.nodia.runtime=agentic",
            "--init", "--user", "10001:10001", "--restart=no", "--cgroupns=private",
            "--cpus=2", "--memory=2g", "--pids-limit=256", "--security-opt=no-new-privileges:true",
            "--cap-drop=ALL", "--log-driver=local", "--log-opt=max-size=10m", "--log-opt=max-file=3",
            "--publish", "127.0.0.1:8000:8000", "--env-file", str(ENV),
            "--env", "HOST=0.0.0.0", "--env", "PORT=8000",
            "--env", "ANTIGRAVITY_CLI_PATH=" + CLI, "--env", "ANTIGRAVITY_CLI_SHA512=" + CLI_HASH,
            "--env", "ANTIGRAVITY_CLI_HOME=/home/nodia/agentic_profile",
            "--env", "ANTIGRAVITY_CLI_VERSION=1.3.1", "--env", "ANTIGRAVITY_CLI_TIMEOUT_SECONDS=240",
            "--tmpfs", "/tmp:size=256m,uid=10001,gid=10001,mode=1777",
            "--tmpfs", "/app/temp_uploads:size=96m,uid=10001,gid=10001,mode=0700",
            "--shm-size=256m", "--mount", f"type=bind,source={STATE}/session_state,target=/app/session_state",
            "--mount", f"type=bind,source={STATE}/profile,target=/home/nodia/agentic_profile", image]


def inspect():
    # Inspect operational metadata only, never export Docker Config.Env.
    result = subprocess.run(["docker", "inspect", "--type", "container", "--format",
        '{"image":{{json .Image}},"label":{{json .Config.Labels}},"running":{{json .State.Running}},'
        '"pid":{{json .State.Pid}},"started":{{json .State.StartedAt}},"user":{{json .Config.User}},'
        '"privileged":{{json .HostConfig.Privileged}},"cap_add":{{json .HostConfig.CapAdd}},'
        '"cap_drop":{{json .HostConfig.CapDrop}},"ports":{{json .HostConfig.PortBindings}},'
        '"cgroupns":{{json .HostConfig.CgroupnsMode}},"restart":{{json .HostConfig.RestartPolicy.Name}},'
        '"memory":{{json .HostConfig.Memory}},"pids":{{json .HostConfig.PidsLimit}},'
        '"mounts":{{json .Mounts}}}', NAME],
        capture_output=True, timeout=15, check=False)
    if result.returncode:
        require(b"No such" in result.stderr, "container_inspect_failed")
        return None
    require(len(result.stdout) <= 16384, "container_inspect_too_large")
    return json.loads(result.stdout)


def ensure_container():
    image = image_id()
    private_file(ENV)
    for path in [STATE, STATE / "session_state", STATE / "profile"]:
        info = path.lstat()
        require(stat.S_ISDIR(info.st_mode) and not path.is_symlink() and info.st_uid == 10001
                and stat.S_IMODE(info.st_mode) == 0o700, "profile_directory_unsafe")
    existing = inspect()
    if existing is None:
        run(create_arguments(image))
    else:
        validate_existing(existing, image)


def validate_existing(existing, image):
    require(existing["image"] == image and existing["label"].get("sh.nodia.runtime") == "agentic",
            "existing_container_conflict")
    require(existing["running"] is False and existing["pid"] == 0, "container_already_running")
    validate_policy(existing)


def validate_policy(existing):
    require(existing['user'] == '10001:10001' and existing['privileged'] is False
            and not existing['cap_add'] and existing['cap_drop'] == ['ALL']
            and existing['ports'] == {'8000/tcp': [{'HostIp': '127.0.0.1', 'HostPort': '8000'}]}
            and existing['cgroupns'] == 'private' and existing['restart'] == 'no'
            and existing['memory'] == 2147483648 and existing['pids'] == 256,
            'container_security_policy_mismatch')
    binds = {item['Destination']: item['Source'] for item in existing['mounts'] if item['Type'] == 'bind'}
    require(binds == {'/app/session_state': str(STATE / 'session_state'),
                      '/home/nodia/agentic_profile': str(STATE / 'profile')}
            and all(item['Type'] in ('bind', 'tmpfs') for item in existing['mounts']),
            'container_mount_policy_mismatch')


def attach():
    expected_image = image_id()
    deadline = time.monotonic() + 40
    while True:
        existing = inspect()
        if existing is not None and existing['running'] is True and existing['pid'] > 1:
            require(existing['image'] == expected_image and existing['label'].get('sh.nodia.runtime') == 'agentic',
                    'container_identity_mismatch')
            validate_policy(existing)
            break
        require(time.monotonic() < deadline, 'container_start_timeout')
        time.sleep(0.25)
    generation = (existing['pid'], existing['started'], existing['image'])
    run(['/usr/bin/python3', '-I', '/usr/local/lib/nodia/ai-runtime/attach-login-cgroup.py',
         '--container-name', NAME, '--state-directory', '/var/lib/nodia-login-containment'])
    final = inspect()
    require(final is not None and final['running'] is True
            and (final['pid'], final['started'], final['image']) == generation,
            'container_changed_during_attachment')


def check():
    # Bootstrap must permit an unauthenticated account. Validate the local CLI,
    # containment and protected HTTP transport; session/catalog have their own
    # provider-dependent observation after human authorization.
    raw = private_file(ENV).decode("ascii")
    match = re.fullmatch(r"GEMINI_SERVICE_TOKEN=([a-fA-F0-9]{64})\n", raw)
    require(match is not None, "service_token_file_invalid")
    token = match.group(1)
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    deadline = time.monotonic() + 35
    while True:
        try:
            with opener.open("http://127.0.0.1:8000/health", timeout=2) as response:
                require(response.status == 200, "adapter_health_invalid")
            break
        except (OSError, urllib.error.URLError):
            require(time.monotonic() < deadline, "adapter_startup_timeout")
            time.sleep(0.5)
    run(["docker", "exec", "--user", "10001:10001", NAME, "python", "-I", "-c",
         "import sys;sys.path.insert(0,'/app');from login_cgroups import LoginCgroups;LoginCgroups()._root()"])
    verified = run(['docker', 'exec', '--user', '10001:10001', NAME, 'python', '-I', '-c',
        "import sys,hashlib,subprocess;sys.path.insert(0,'/app');"
        "from agentic_cli import CliConfig,cli_environment;"
        "c=CliConfig.from_environment();assert c is not None;"
        "assert hashlib.sha512(c.binary.read_bytes()).hexdigest()==c.sha512;"
        "r=subprocess.run([str(c.binary),'--version'],capture_output=True,timeout=4,env=cli_environment(c.home));"
        "assert r.returncode==0 and r.stdout.decode().strip()==c.version;print('verified-cli')"])
    require(verified == 'verified-cli', 'adapter_cli_unverified')
    for candidate in (None, "0" * 64):
        headers = {} if candidate is None else {"X-Nodia-Service-Token": candidate}
        request = urllib.request.Request("http://127.0.0.1:8000/docs", headers=headers)
        try:
            with opener.open(request, timeout=5):
                raise RuntimeError("private_route_accepted_invalid_token")
        except urllib.error.HTTPError as error:
            require(error.code == 401, "private_route_authentication_invalid")
    request = urllib.request.Request("http://127.0.0.1:8000/docs",
                                    headers={"X-Nodia-Service-Token": token})
    with opener.open(request, timeout=25) as response:
        require(response.status == 200 and response.url == request.full_url, "adapter_status_invalid")
        data = response.read(65537)
        require(len(data) <= 65536, "adapter_status_too_large")
    return {"schema_version": 1, "status": "private_login_transport_checked", "invalid_tokens_rejected": True,
            "cli_hash_and_version_verified": True, "session_observed": False, "authenticated": None,
            "inference_requested": False}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=["ensure", "attach", "check"])
    action = parser.parse_args().action
    require(sys.platform == "linux" and os.geteuid() == 0, "linux_root_required")
    if action == "ensure":
        ensure_container()
    elif action == 'attach':
        attach()
    else:
        print(json.dumps(check()))


if __name__ == "__main__":
    try:
        main()
    except Exception:
        print(json.dumps({"status": "failed", "error_code": "private_adapter_operator_failed"}), file=sys.stderr)
        raise SystemExit(1) from None
