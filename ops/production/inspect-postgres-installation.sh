#!/usr/bin/env bash
# Read-only catalog inspection using PID1's private environment; never source secrets.
set -Eeuo pipefail
umask 077
fail() { printf '[Nodia PostgreSQL preflight] %s\n' "$1" >&2; exit 1; }
[[ $EUID -eq 0 && $(uname -s) == Linux && $# -eq 2 ]] || fail 'root_linux_and_release_path_helper_sha_required'
RELEASE_PATH=$1
HELPER_SHA=$2
[[ $RELEASE_PATH =~ ^/opt/nodia/candidates/backend-[a-f0-9]{12}-[a-f0-9]{12}$ && $HELPER_SHA =~ ^[a-f0-9]{64}$ ]] || fail 'invalid_release_path_or_helper_sha'
HELPER_SOURCE=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)/inspect-postgres-installation.mjs
PRIVATE=/var/lib/nodia-backend-setup/private
LIBRARY=/usr/local/lib/nodia
INSTALLED_HELPER=$LIBRARY/inspect-postgres-installation-$HELPER_SHA.mjs

# Refuse symlinked or writable ancestors; both roots must already exist.
protected_directory() {
  local target=$1 current=$1 owner mode
  [[ $(realpath -e -- "$target") == "$target" && -d $target && ! -L $target ]] || fail 'unsafe_directory'
  while :; do
    owner=$(stat -c '%u' -- "$current")
    mode=$(stat -c '%a' -- "$current")
    [[ $owner == 0 && $((8#$mode & 0022)) -eq 0 ]] || fail 'unsafe_directory_owner_or_mode'
    [[ $current == / ]] && break
    current=$(dirname -- "$current")
  done
}
protected_directory "$RELEASE_PATH"
protected_directory "$PRIVATE"
protected_directory "$LIBRARY"

# Check metadata only; do not import application code before the private oneshot.
/usr/bin/python3 - "$RELEASE_PATH" <<'PY'
import json,os,re,stat,sys
from pathlib import Path
def require(condition):
    if not condition:
        raise ValueError('invalid_staged_release')
try:
    root=Path(sys.argv[1])
    for name in ('package.json','release-manifest.json'):
        p=root/name;i=p.lstat()
        require(stat.S_ISREG(i.st_mode) and i.st_uid==0 and i.st_nlink==1 and not i.st_mode & 0o022)
        require(i.st_size <= 8*1024*1024)
    m=json.loads((root/'release-manifest.json').read_text(encoding='utf-8'))
    require(m['release_id']==root.name and m['source_provenance']=='git_archive' and m['deployment_eligible'] is True)
    require(re.fullmatch('[a-f0-9]{40}',m['source_sha']) and re.fullmatch('[a-f0-9]{64}',m['package_tree_sha256']))
    require(root.name==f"backend-{m['source_sha'][:12]}-{m['package_tree_sha256'][:12]}")
except Exception:
    print('[Nodia PostgreSQL preflight] invalid_staged_release',file=sys.stderr)
    sys.exit(1)
PY
for writer in nodia-api.service nodia-ai-worker.service; do
  state=$(/usr/bin/systemctl show "$writer" --property=ActiveState --value)
  pid=$(/usr/bin/systemctl show "$writer" --property=MainPID --value)
  [[ $state == inactive && $pid == 0 ]] || fail 'application_writers_must_be_inactive'
done

[[ -f $HELPER_SOURCE && ! -L $HELPER_SOURCE ]] || fail 'helper_regular_file_required'
STAGING=$(mktemp -d "$PRIVATE/postgres-preflight-XXXXXXXX")
UNIT=
cleanup() {
  local result=$? observed state= pid= key value
  trap - EXIT
  if [[ -n $UNIT ]]; then
    /usr/bin/timeout 10s /usr/bin/systemctl stop "$UNIT" >/dev/null 2>&1 || true
    /usr/bin/timeout 5s /usr/bin/systemctl reset-failed "$UNIT" >/dev/null 2>&1 || true
    observed=$(/usr/bin/timeout 5s /usr/bin/systemctl show "$UNIT" --property=ActiveState,MainPID --no-pager 2>/dev/null) || true
    while IFS='=' read -r key value; do
      case "$key" in ActiveState) state=$value ;; MainPID) pid=$value ;; esac
    done <<< "$observed"
    if [[ ! ( $state == inactive || $state == failed ) || $pid != 0 ]]; then
      printf '[Nodia PostgreSQL preflight] temporary_unit_cleanup_failed\n' >&2
      result=1
    fi
  fi
  rm -f -- "$STAGING/helper.mjs"
  rmdir -- "$STAGING"
  exit "$result"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
# Copy without dereferencing a raced source link; validate the copied immutable bytes.
cp --no-dereference --reflink=never -- "$HELPER_SOURCE" "$STAGING/helper.mjs"
[[ -f $STAGING/helper.mjs && ! -L $STAGING/helper.mjs ]] || fail 'helper_copy_not_regular'
actual=$(sha256sum -- "$STAGING/helper.mjs")
[[ ${actual%% *} == "$HELPER_SHA" ]] || fail 'helper_sha256_mismatch'
if [[ -e $INSTALLED_HELPER || -L $INSTALLED_HELPER ]]; then
  [[ -f $INSTALLED_HELPER && ! -L $INSTALLED_HELPER &&
     $(stat -c '%u:%h:%a' -- "$INSTALLED_HELPER") == 0:1:644 ]] || fail 'unsafe_installed_helper'
  actual=$(sha256sum -- "$INSTALLED_HELPER")
  [[ ${actual%% *} == "$HELPER_SHA" ]] || fail 'installed_helper_sha256_mismatch'
else
  install -o root -g root -m 0644 -T -- "$STAGING/helper.mjs" "$INSTALLED_HELPER"
fi
UNIT=nodia-postgres-installation-check-$(cat /proc/sys/kernel/random/uuid).service
set +e
/usr/bin/systemd-run --quiet --unit="$UNIT" --wait --pipe --collect --service-type=exec \
  --working-directory="$RELEASE_PATH" \
  --property=User=nodia --property=Group=nodia \
  --property=EnvironmentFile=/etc/nodia/runtime.env \
  --setenv=NODE_ENV=production --setenv=PGSSLMODE=verify-full --setenv=HOME=/var/lib/nodia/home \
  --property=UMask=0077 --property=NoNewPrivileges=yes --property=CapabilityBoundingSet= \
  --property=ProtectSystem=strict --property=ProtectHome=yes --property=PrivateTmp=yes \
  --property=ReadOnlyPaths=/var/lib/nodia --property=RuntimeMaxSec=45s \
  --property=TimeoutStopSec=5s --property=KillMode=control-group \
  /usr/local/bin/node "$INSTALLED_HELPER"
result=$?
set -e
exit "$result"
