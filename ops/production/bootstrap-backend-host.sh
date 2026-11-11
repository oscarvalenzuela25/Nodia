#!/usr/bin/env bash
# Prepare the service identity and inactive units only. No release or DB is activated.
set -Eeuo pipefail
umask 077
[[ $EUID -eq 0 && $# -eq 0 ]] || {
  printf 'Usage: sudo bash bootstrap-backend-host.sh\n' >&2; exit 1;
}
SOURCE=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
STATE=/var/lib/nodia-backend-setup
for tool in python3 flock systemctl systemd-analyze useradd groupadd runuser passwd install; do
  command -v "$tool" >/dev/null
done
[[ -x /usr/local/bin/node && -x /usr/sbin/nologin ]]
for path in "$STATE" /opt/nodia /opt/nodia/releases /var/lib/nodia \
  /var/lib/nodia/home /var/lib/nodia/codex /var/lib/nodia/config \
  /usr/local/lib/nodia /usr/local/lib/nodia/validate-runtime-env.mjs /etc/nodia; do
  [[ ! -L $path ]] || { printf 'Refusing symlink: %s\n' "$path" >&2; exit 1; }
done
for name in nodia-api.service nodia-ai-worker.service validate-runtime-env.mjs; do
  [[ -f $SOURCE/$name && ! -L $SOURCE/$name ]]
done
for name in nodia-api.service nodia-ai-worker.service; do
  if systemctl is-active --quiet "$name"; then
    printf 'Refusing to replace an active application service: %s\n' "$name" >&2; exit 1;
  fi
  target="/etc/systemd/system/$name"
  [[ ! -L $target ]] || { printf 'Refusing symlinked unit: %s\n' "$target" >&2; exit 1; }
  if [[ -e $target ]]; then
    cmp -s "$SOURCE/$name" "$target" || {
      printf 'Existing unit differs: %s. Review instead of overwriting.\n' "$target" >&2; exit 1;
    }
  fi
  enabled=$(systemctl is-enabled "$name" 2>/dev/null || true)
  [[ $enabled != enabled && $enabled != enabled-runtime ]] || {
    printf 'Unexpected enabled service: %s. Review before setup.\n' "$name" >&2; exit 1;
  }
done
install -d -m 0755 "$STATE"
exec 9>"$STATE/setup.lock"
flock -n 9 || { printf 'Another backend host setup is running.\n' >&2; exit 1; }
status() {
  python3 - "$STATE" "$1" "${2:-}" <<'PY'
import datetime, json, os, pathlib, sys, tempfile
directory, phase, detail = sys.argv[1:]
with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', dir=directory, delete=False) as stream:
    json.dump({'updated_at_utc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
               'phase': phase, 'detail': detail}, stream)
    stream.write('\n')
    name = stream.name
os.chmod(name, 0o644)
os.replace(name, pathlib.Path(directory) / 'status.json')
PY
  printf '\n[Nodia backend host] %s: %s\n' "$1" "${2:-}"
}
failed() {
  local code=$? line=$1
  trap - ERR
  status failed "Command failed at line $line (exit $code). Inspect the operator terminal; services were not requested to start."
  exit "$code"
}
trap 'failed "$LINENO"' ERR
trap 'status interrupted "Setup interrupted; inspect identity, directories and units before retrying."; exit 130' INT TERM HUP
status preparing 'Preparing a locked service account, writable state and inactive systemd units.'
if getent passwd nodia >/dev/null || getent group nodia >/dev/null; then
  python3 - <<'PY'
import grp, pwd
user = pwd.getpwnam('nodia')
group = grp.getgrnam('nodia')
if not (900 <= user.pw_uid < 990 and user.pw_uid == user.pw_gid == group.gr_gid
        and sum(item.pw_uid == user.pw_uid for item in pwd.getpwall()) == 1
        and sum(item.gr_gid == group.gr_gid for item in grp.getgrall()) == 1
        and user.pw_dir == '/var/lib/nodia/home' and user.pw_shell == '/usr/sbin/nologin'):
    raise SystemExit('Existing nodia account does not match the service identity; no automatic changes.')
PY
else
  # Keep a distinct host identity from Redis's container UID999/GID1000.
  SERVICE_ID=$(python3 - <<'PY'
import grp, pwd
used_users = {item.pw_uid for item in pwd.getpwall()}
used_groups = {item.gr_gid for item in grp.getgrall()}
for candidate in range(900, 990):
    if candidate not in used_users and candidate not in used_groups:
        print(candidate)
        break
else:
    raise SystemExit('No free system UID/GID in the setup range; inspect manually.')
PY
)
  groupadd --system --gid "$SERVICE_ID" nodia
  useradd --system --uid "$SERVICE_ID" --gid nodia --no-create-home \
    --home-dir /var/lib/nodia/home --shell /usr/sbin/nologin nodia
fi
[[ $(id -nG nodia) == nodia ]] || {
  status failed 'The execution account has extra groups; refusing to alter privileges automatically.'; exit 1;
}
passwd --lock nodia >/dev/null
install -d -o root -g root -m 0755 /opt/nodia /opt/nodia/releases /usr/local/lib/nodia
install -d -o root -g nodia -m 0750 /var/lib/nodia /var/lib/nodia/config
install -d -o nodia -g nodia -m 0700 /var/lib/nodia/home /var/lib/nodia/codex
install -d -o root -g root -m 0700 /etc/nodia
install -o root -g root -m 0644 "$SOURCE/validate-runtime-env.mjs" /usr/local/lib/nodia/validate-runtime-env.mjs
for name in nodia-api.service nodia-ai-worker.service; do
  install -o root -g root -m 0644 "$SOURCE/$name" "/etc/systemd/system/$name"
done
systemd-analyze verify /etc/systemd/system/nodia-api.service /etc/systemd/system/nodia-ai-worker.service
systemctl daemon-reload
runuser -u nodia -- /usr/local/bin/node --input-type=module - <<'JS'
import { accessSync, constants, openSync, closeSync, unlinkSync } from 'node:fs';
for (const path of ['/var/lib/nodia/home', '/var/lib/nodia/codex']) {
  const probe = `${path}/.setup-permission-probe-${process.pid}`;
  const handle = openSync(probe, 'wx', 0o600);
  closeSync(handle);
  unlinkSync(probe);
}
for (const path of ['/opt/nodia/releases', '/var/lib/nodia/config', '/usr/local/lib/nodia']) {
  let writable = false;
  try { accessSync(path, constants.W_OK); writable = true; } catch { /* Expected denial. */ }
  if (writable) throw new Error(`Unexpected write permission: ${path}`);
}
for (const [path, mode] of [['/etc/nodia', constants.X_OK], ['/var/run/docker.sock', constants.W_OK]]) {
  let accessible = false;
  try { accessSync(path, mode); accessible = true; } catch { /* Expected denial. */ }
  if (accessible) throw new Error(`Unexpected privileged access: ${path}`);
}
console.log(`Service UID=${process.getuid()}: state write succeeded; code/config/socket restrictions passed.`);
JS
for name in nodia-api.service nodia-ai-worker.service; do
  [[ $(systemctl is-enabled "$name" 2>/dev/null || true) == disabled ]]
  [[ $(systemctl is-active "$name" 2>/dev/null || true) == inactive ]]
done
getent passwd nodia
id nodia
passwd --status nodia
stat -c '%U:%G %a %n' /opt/nodia/releases /var/lib/nodia /var/lib/nodia/home /var/lib/nodia/codex /var/lib/nodia/config
status complete 'Service identity, directories and systemd units prepared and checked. Units remain disabled/inactive; no release, secrets, migrations or application has been activated.'
