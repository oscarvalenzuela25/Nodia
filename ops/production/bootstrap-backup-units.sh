#!/usr/bin/env bash
# Install reviewed production units only; never start/enable jobs or writers.
set -Eeuo pipefail
umask 077
fail() { printf '[Nodia backup units] failed: %s\n' "$1" >&2; exit 1; }
[[ $EUID -eq 0 && $(uname -s) == Linux && $# -eq 0 ]] || fail root_linux_no_arguments_required
[[ $(id -u nodia) == 900 && $(id -g nodia) == 900 && $(id -G nodia) == 900 ]] || fail runtime_identity_mismatch
BUNDLE=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
PRIVATE=/var/lib/nodia-backend-setup/private
UNITS=(nodia-ai-journal-reconcile.service nodia-ai-backup.service nodia-ai-backup-rotate.service nodia-ai-backup.timer nodia-ai-backup-rotate.timer)
protected_directory() {
  local current=$1 mode
  [[ $(realpath -e -- "$current") == "$current" ]] || fail unsafe_directory
  while :; do
    [[ -d $current && ! -L $current && $(stat -c '%u' -- "$current") == 0 ]] || fail unsafe_directory
    mode=$(stat -c '%a' -- "$current")
    [[ $((8#$mode & 0022)) -eq 0 ]] || fail writable_directory
    [[ $current == / ]] && break
    current=$(dirname -- "$current")
  done
}
for directory in "$PRIVATE" /etc/systemd/system /etc/nodia; do protected_directory "$directory"; done
[[ $(stat -c '%a' -- "$PRIVATE") == 700 && $(stat -c '%a' -- /etc/nodia) == 700 ]] || fail private_directory_mode_mismatch
for specification in 'backup.json:600' 'recovery.json:400'; do
  filename=/var/lib/nodia/config/${specification%:*}
  [[ -f $filename && ! -L $filename && $(realpath -e -- "$filename") == "$filename" &&
     $(stat -c '%u:%g:%h:%a' -- "$filename") == 900:900:1:${specification#*:} ]] || fail private_configuration_metadata_mismatch
done
[[ -d /var/lib/nodia/backups/spool && ! -L /var/lib/nodia/backups/spool &&
   $(realpath -e -- /var/lib/nodia/backups/spool) == /var/lib/nodia/backups/spool &&
   $(stat -c '%u:%g:%a' -- /var/lib/nodia/backups/spool) == 900:900:700 ]] || fail private_spool_metadata_mismatch
STAGING=$(mktemp -d "$PRIVATE/backup-units-XXXXXXXX")
cleanup() {
  local result=$?
  trap - EXIT
  for name in "${UNITS[@]}" backup-runner.env; do rm -f -- "$STAGING/$name"; done
  rmdir -- "$STAGING" || true
  exit "$result"
}
trap cleanup EXIT
for name in "${UNITS[@]}"; do
  cp --no-dereference -- "$BUNDLE/$name" "$STAGING/$name"
  [[ -f $STAGING/$name && ! -L $STAGING/$name ]] || fail regular_source_file_required
done
cp --no-dereference -- "$BUNDLE/backup-runner.env.template" "$STAGING/backup-runner.env"
[[ -f $STAGING/backup-runner.env && ! -L $STAGING/backup-runner.env ]] || fail regular_environment_template_required
compatible_target() {
  local source=$1 target=$2 expected_mode=$3
  if [[ -e $target || -L $target ]]; then
    [[ -f $target && ! -L $target && $(realpath -e -- "$target") == "$target" &&
       $(stat -c '%u:%g:%h:%a' -- "$target") == 0:0:1:$expected_mode ]] || fail unsafe_existing_target
    cmp --silent -- "$source" "$target" || fail existing_configuration_differs
  fi
}
# Validate every destination before writing any persistent file.
compatible_target "$STAGING/backup-runner.env" /etc/nodia/backup-runner.env 600
for name in "${UNITS[@]}"; do
  compatible_target "$STAGING/$name" "/etc/systemd/system/$name" 644
  observed=$(systemctl show "$name" --property=LoadState,ActiveState,MainPID,UnitFileState,FragmentPath --no-pager 2>/dev/null || true)
  state=$(awk -F= '$1=="ActiveState" {print $2}' <<< "$observed")
  pid=$(awk -F= '$1=="MainPID" {print $2}' <<< "$observed")
  enabled=$(awk -F= '$1=="UnitFileState" {print $2}' <<< "$observed")
  fragment=$(awk -F= '$1=="FragmentPath" {print $2}' <<< "$observed")
  [[ $state == inactive && ( $name == *.timer || $pid == 0 ) && ( -z $enabled || $enabled == static || $enabled == disabled ) &&
     ( -z $fragment || $fragment == /etc/systemd/system/$name ) ]] || fail existing_unit_must_be_inactive_disabled_and_local
done
SYSTEMD_UNIT_PATH="$STAGING:/etc/systemd/system:/run/systemd/system:/usr/lib/systemd/system" \
  systemd-analyze verify "${UNITS[@]/#/$STAGING/}"
for name in "${UNITS[@]}"; do
  [[ -e /etc/systemd/system/$name ]] || install -o root -g root -m 0644 -T -- "$STAGING/$name" "/etc/systemd/system/$name"
done
[[ -e /etc/nodia/backup-runner.env ]] || install -o root -g root -m 0600 -T -- "$STAGING/backup-runner.env" /etc/nodia/backup-runner.env
systemctl daemon-reload
systemd-analyze verify "${UNITS[@]/#//etc/systemd/system/}"
for name in "${UNITS[@]}"; do
  [[ $(systemctl show "$name" --property=ActiveState --value) == inactive ]] || fail unit_started_unexpectedly
  if [[ $name == *.service ]]; then
    [[ $(systemctl show "$name" --property=MainPID --value) == 0 ]] || fail unit_started_unexpectedly
  fi
done
for name in nodia-ai-backup.timer nodia-ai-backup-rotate.timer; do
  [[ $(systemctl is-enabled "$name" || true) == disabled ]] || fail timer_must_remain_disabled
done
printf '[Nodia backup units] complete: units installed/verified inactive; timers disabled. No backup, journal operation, writer start or schedule activation requested.\n'
