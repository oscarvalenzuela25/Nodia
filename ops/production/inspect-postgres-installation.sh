#!/usr/bin/env bash
# Read-only catalog inspection using PID1's private environment; never source secrets.
set -Eeuo pipefail
umask 077
fail() { printf '[Nodia PostgreSQL preflight] %s\n' "$1" >&2; exit 1; }
[[ $EUID -eq 0 && $(uname -s) == Linux && $# -ge 2 ]] || fail 'root_linux_and_release_path_helper_sha_required'
RELEASE_PATH=$1
HELPER_SHA=$2
shift 2
MODE=()
DETAILS_ENABLED=false
BASELINE_SHA=
while [[ $# -gt 0 ]]; do
  case "$1" in
    --catalog-details)
      [[ $DETAILS_ENABLED == false ]] || fail 'duplicate_preflight_mode'
      DETAILS_ENABLED=true
      MODE+=(--catalog-details)
      shift ;;
    --provider-baseline-sha256)
      [[ $# -ge 2 && -z $BASELINE_SHA && $2 =~ ^[a-f0-9]{64}$ ]] || fail 'invalid_provider_baseline_sha256'
      BASELINE_SHA=$2
      shift 2 ;;
    *) fail 'invalid_preflight_mode' ;;
  esac
done
[[ -z $BASELINE_SHA || $DETAILS_ENABLED == true ]] || fail 'provider_baseline_requires_catalog_details'
[[ $RELEASE_PATH =~ ^/opt/nodia/candidates/backend-[a-f0-9]{12}-[a-f0-9]{12}$ && $HELPER_SHA =~ ^[a-f0-9]{64}$ ]] || fail 'invalid_release_path_or_helper_sha'
SOURCE_DIRECTORY=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
HELPER_SOURCE=$SOURCE_DIRECTORY/inspect-postgres-installation.mjs
BASELINE_SOURCE=$SOURCE_DIRECTORY/postgres-provider-baseline.json
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
  rm -f -- "$STAGING/helper.mjs" "$STAGING/baseline.json"
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
if [[ -n $BASELINE_SHA ]]; then
  [[ -f $BASELINE_SOURCE && ! -L $BASELINE_SOURCE ]] || fail 'provider_baseline_regular_file_required'
  cp --no-dereference --reflink=never -- "$BASELINE_SOURCE" "$STAGING/baseline.json"
  [[ -f $STAGING/baseline.json && ! -L $STAGING/baseline.json &&
     $(stat -c '%s' -- "$STAGING/baseline.json") -le 65536 ]] || fail 'provider_baseline_copy_invalid'
  actual=$(sha256sum -- "$STAGING/baseline.json")
  [[ ${actual%% *} == "$BASELINE_SHA" ]] || fail 'provider_baseline_sha256_mismatch'
  INSTALLED_BASELINE=$LIBRARY/postgres-provider-baseline-$BASELINE_SHA.json
  if [[ -e $INSTALLED_BASELINE || -L $INSTALLED_BASELINE ]]; then
    [[ -f $INSTALLED_BASELINE && ! -L $INSTALLED_BASELINE &&
       $(stat -c '%u:%h:%a' -- "$INSTALLED_BASELINE") == 0:1:644 ]] || fail 'unsafe_installed_provider_baseline'
    actual=$(sha256sum -- "$INSTALLED_BASELINE")
    [[ ${actual%% *} == "$BASELINE_SHA" ]] || fail 'installed_provider_baseline_sha256_mismatch'
  else
    install -o root -g root -m 0644 -T -- "$STAGING/baseline.json" "$INSTALLED_BASELINE"
  fi
  MODE+=(--provider-baseline-file "$INSTALLED_BASELINE")
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
  /usr/local/bin/node "$INSTALLED_HELPER" "${MODE[@]}"
result=$?
set -e
exit "$result"
