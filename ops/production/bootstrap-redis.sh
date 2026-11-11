#!/usr/bin/env bash
# Initial local Redis installation. No PostgreSQL, API or Worker is started.
set -Eeuo pipefail
umask 077
[[ $EUID -eq 0 ]] || { printf 'Run with sudo. No files were changed.\n' >&2; exit 1; }
ACTION=${1:-install}
[[ $# -le 1 && ( $ACTION == install || $ACTION == verify || $ACTION == resume-network ) ]] || {
  printf 'Usage: sudo bash bootstrap-redis.sh [install|verify|resume-network]\n' >&2; exit 1;
}
SOURCE=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
STATE=/var/lib/nodia-redis
DEST=/opt/nodia/redis
CONF=/etc/nodia/redis
CONTAINER=template_redis
IMAGE=redis:7.4.12-alpine@sha256:7b1753b4c5ad8458906c272a8132b8c15f5557b000379eb115fb239706a384b7
for tool in docker python3 flock systemctl ss sysctl; do command -v "$tool" >/dev/null; done
systemctl is-active --quiet docker
for path in "$STATE" /opt/nodia "$DEST" /etc/nodia "$CONF"; do
  [[ ! -L $path ]] || { printf 'Refusing symlink: %s\n' "$path" >&2; exit 1; }
done
install -d -m 0755 "$STATE"
exec 9>"$STATE/setup.lock"
flock -n 9 || { printf 'Another Redis setup is running.\n' >&2; exit 1; }
status() {
  python3 - "$STATE" "$1" "${2:-}" <<'PY'
import datetime, json, os, pathlib, sys, tempfile
directory, phase, detail = sys.argv[1:]
with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', dir=directory, delete=False) as stream:
    json.dump({'updated_at': datetime.datetime.now(datetime.timezone.utc).isoformat(),
               'phase': phase, 'detail': detail}, stream)
    stream.write('\n')
    name = stream.name
os.chmod(name, 0o644)
os.replace(name, pathlib.Path(directory) / 'status.json')
PY
  printf '\n[Nodia Redis] %s: %s\n' "$1" "${2:-}"
}
failed() {
  local code=$? line=$1
  trap - ERR
  status failed "Command failed at line $line (exit $code). Inspect the operator terminal; preserve the volume and credentials."
  exit "$code"
}
trap 'failed "$LINENO"' ERR
trap 'status interrupted "Operator interrupted setup; inspect before retrying."; exit 130' INT TERM HUP
compose() { docker compose -f "$DEST/redis.compose.yml" "$@"; }
redis() { docker exec "$CONTAINER" /usr/local/bin/nodia-redis-cli "$@"; }
verify() {
  [[ $(docker inspect -f '{{.State.Health.Status}}' "$CONTAINER") == healthy ]]
  [[ $(redis ping) == PONG ]]
  [[ $(docker exec "$CONTAINER" redis-cli ping) == *NOAUTH* ]]
  [[ $(docker port "$CONTAINER" 6379/tcp) == 127.0.0.1:6379 ]]
  [[ $(redis --raw CONFIG GET maxmemory-policy) == $'maxmemory-policy\nnoeviction' ]]
  [[ $(redis --raw CONFIG GET maxmemory) == $'maxmemory\n268435456' ]]
  [[ $(redis --raw CONFIG GET appendonly) == $'appendonly\nyes' ]]
  [[ $(redis --raw CONFIG GET appendfsync) == $'appendfsync\neverysec' ]]
  [[ $(docker inspect -f '{{.HostConfig.Memory}}' "$CONTAINER") == 1073741824 ]]
  [[ $(redis --raw EVAL "return redis.call('PING')" 0) == PONG ]]
  python3 - <<'PY'
import pathlib, socket
values = dict(line.split('=', 1) for line in pathlib.Path('/etc/nodia/redis.env').read_text().splitlines())
with socket.create_connection(('127.0.0.1', 6379), timeout=3) as connection:
    stream = connection.makefile('rb')
    connection.sendall(b'*1\r\n$4\r\nPING\r\n')
    assert stream.readline().startswith(b'-NOAUTH'), 'Host unauthenticated PING was not rejected'
    password = values['REDIS_PASSWORD'].encode()
    connection.sendall(b'*2\r\n$4\r\nAUTH\r\n$' + str(len(password)).encode() + b'\r\n' + password + b'\r\n')
    assert stream.readline() == b'+OK\r\n', 'Host Redis authentication failed'
    connection.sendall(b'*1\r\n$4\r\nPING\r\n')
    assert stream.readline() == b'+PONG\r\n', 'Host authenticated PING failed'
print('Host loopback connection: authenticated PONG; anonymous PING rejected.')
PY
  redis INFO server | sed -n '/^redis_version:/p'
  docker inspect -f 'health={{.State.Health.Status}} restart={{.HostConfig.RestartPolicy.Name}} image={{.Config.Image}}' "$CONTAINER"
  docker port "$CONTAINER"
}
test_persistence() {
  status testing_persistence 'Testing a temporary key across container recreation, preserving the named volume.'
  local probe result
  probe="nodia:ops:bootstrap:$(python3 -c 'import secrets; print(secrets.token_hex(12))')"
  # SET and WAITAOF share one connection, so the acknowledgement covers this write.
  result=$(printf 'SET %s nodia-persistence-ok EX 300\nWAITAOF 1 0 5000\n' "$probe" |
    docker exec -i "$CONTAINER" /usr/local/bin/nodia-redis-cli --raw)
  [[ $result == $'OK\n1\n0' ]]
  compose up -d --force-recreate --wait --wait-timeout 90
  verify
  [[ $(redis --raw GET "$probe") == nodia-persistence-ok ]]
  [[ $(redis DEL "$probe") == 1 ]]
  status complete 'Private Redis authenticated, configuration checked, temporary key preserved across container recreation. API/Worker integration, external port check, backups and alerting remain pending.'
}
if [[ $ACTION == verify ]]; then
  verify
  printf 'Redis checks passed. No restart or credential change was performed.\n'
  exit 0
fi
if [[ $ACTION == resume-network ]]; then
  # Narrow recovery for the first bootstrap's internal-network publication failure.
  # Never use this path as a general upgrade or against an application data set.
  python3 - "$STATE/status.json" "$IMAGE" <<'PY'
import json, pathlib, stat, subprocess, sys
state = json.loads(pathlib.Path(sys.argv[1]).read_text())
assert state['phase'] == 'failed' and 'line 52 (exit 1)' in state['detail'], 'Unexpected bootstrap state; inspect before resuming'
container = json.loads(subprocess.check_output(['docker', 'inspect', 'template_redis']))[0]
assert container['Config']['Image'] == sys.argv[2], 'Unexpected Redis image'
assert container['Config']['Labels']['com.docker.compose.project'] == 'template_nodia_redis', 'Unexpected Compose owner'
assert any(m['Type'] == 'volume' and m.get('Name') == 'template_redis_data' and m['Destination'] == '/data' for m in container['Mounts']), 'Unexpected data mount'
assert set(container['NetworkSettings']['Networks']) == {'template_redis_internal'}, 'Unexpected network; inspect before resuming'
for filename, uid, mode in [('/etc/nodia/redis.env', 0, 0o600), ('/etc/nodia/redis/redis.conf', 999, 0o400)]:
    path = pathlib.Path(filename)
    assert not path.is_symlink() and path.is_file(), 'Missing or symlinked Redis configuration'
    metadata = path.stat()
    assert metadata.st_uid == uid and stat.S_IMODE(metadata.st_mode) == mode, 'Unexpected Redis configuration permissions'
PY
  [[ $(redis DBSIZE) == 0 ]] || { printf 'Redis contains data; refusing initial bootstrap recovery.\n' >&2; exit 1; }
  [[ -f $SOURCE/redis.compose.yml && ! -L $SOURCE/redis.compose.yml ]]
  BEFORE=$(sha256sum /etc/nodia/redis.env "$CONF/redis.conf")
  status repairing_network 'Replacing only the initial network configuration; preserving the data volume and credentials.'
  install -m 0644 "$SOURCE/redis.compose.yml" "$DEST/redis.compose.yml"
  compose config --quiet
  compose up -d --force-recreate --wait --wait-timeout 90
  [[ $(sha256sum /etc/nodia/redis.env "$CONF/redis.conf") == "$BEFORE" ]]
  verify
  # Remove only our detached, empty obsolete network, never a volume or used network.
  python3 - <<'PY'
import json, subprocess
network = json.loads(subprocess.check_output(['docker', 'network', 'inspect', 'template_redis_internal']))[0]
if network['Internal'] and not network['Containers'] and network.get('Labels', {}).get('com.docker.compose.project') == 'template_nodia_redis':
    subprocess.run(['docker', 'network', 'rm', 'template_redis_internal'], check=True)
PY
  test_persistence
  exit 0
fi
if docker container inspect "$CONTAINER" >/dev/null 2>&1; then
  printf 'Container already exists. Use verify; this helper is not an upgrade tool.\n' >&2
  exit 1
fi
if ss -H -lnt 'sport = :6379' | read -r _; then
  printf 'Port 6379 is occupied; inspect before proceeding.\n' >&2; exit 1
fi
if docker volume inspect template_redis_data >/dev/null 2>&1; then
  printf 'Existing Redis data volume found. Refusing initial-install persistence test.\n' >&2; exit 1
fi
for file in redis.compose.yml redis.conf.template redis-cli-auth.sh; do
  [[ -f $SOURCE/$file && ! -L $SOURCE/$file ]]
done
status preparing 'Pulling pinned Redis image and checking its runtime identity.'
docker pull "$IMAGE"
[[ $(docker run --rm --network none --read-only --name template_redis_uid_check --entrypoint id "$IMAGE" -u redis) == 999 ]]
[[ $(docker run --rm --network none --read-only --name template_redis_gid_check --entrypoint id "$IMAGE" -g redis) == 1000 ]]
install -d -m 0755 /opt/nodia "$DEST"
install -d -m 0700 /etc/nodia "$CONF"
install -m 0644 "$SOURCE/redis.compose.yml" "$DEST/redis.compose.yml"
install -m 0755 "$SOURCE/redis-cli-auth.sh" "$DEST/redis-cli-auth.sh"
SYSCTL=/etc/sysctl.d/60-nodia-redis.conf
[[ ! -e $SYSCTL && ! -L $SYSCTL ]] || {
  printf 'Existing Redis sysctl override found; inspect before retrying.\n' >&2; exit 1;
}
printf '# Redis background AOF rewrite needs fork under memory pressure.\nvm.overcommit_memory = 1\n' >"$SYSCTL"
chmod 0644 "$SYSCTL"
sysctl -p "$SYSCTL"
python3 - "$SOURCE/redis.conf.template" "$CONF/redis.conf" /etc/nodia/redis.env <<'PY'
import os, pathlib, secrets, sys
template, config, environment = map(pathlib.Path, sys.argv[1:])
if config.exists() or environment.exists() or config.is_symlink() or environment.is_symlink():
    raise SystemExit('Existing Redis secrets found. Inspect before retrying; never overwrite them blindly.')
password = secrets.token_hex(32)
with environment.open('x', encoding='utf-8', newline='\n') as stream:
    stream.write(f'REDIS_HOST=127.0.0.1\nREDIS_PORT=6379\nREDIS_PASSWORD={password}\nRATE_LIMIT_STORAGE=redis\n')
os.chmod(environment, 0o600)
with config.open('x', encoding='utf-8', newline='\n') as stream:
    stream.write(template.read_text(encoding='utf-8').rstrip() + f'\nrequirepass {password}\n')
os.chown(config, 999, 1000)
os.chmod(config, 0o400)
PY
compose config --quiet
status starting 'Starting private Redis; credentials remain in protected files on the VPS.'
compose up -d --wait --wait-timeout 90
verify
test_persistence
