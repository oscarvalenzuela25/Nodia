#!/usr/bin/env bash
# Install only the reviewed PostgreSQL16 client alongside Ubuntu's PostgreSQL18 client.
set -Eeuo pipefail
umask 077
PGDG_CLIENT_VERSION=16.15-1.pgdg26.04+2
PGDG_FINGERPRINT=B97B0AFCAA1A47F044F244A07FCC7D46ACCC4CF8
PGDG_KEY=/usr/share/postgresql-common/pgdg/nodia-postgresql.asc
PGDG_SOURCE=/etc/apt/sources.list.d/nodia-pgdg-client16.sources
PGDG_PREFERENCE=/etc/apt/preferences.d/nodia-pgdg-client16

fail() { printf '[Nodia PostgreSQL16 client] failed: %s\n' "$1" >&2; exit 1; }
valid_key_fingerprint() {
  awk -F: -v wanted="$PGDG_FINGERPRINT" '
    $1=="pub" { count++ } $1=="fpr" && !first { first=$10 }
    END { exit !(count==1 && first==wanted) }' "$1"
}
extract_candidate() {
  # Consume all policy output: exiting on the first match causes apt-cache SIGPIPE under pipefail.
  awk '/Candidate:/ && !found { print $2; found=1 }'
}
valid_install_plan() {
  awk '
    /^(Remv|Purg) / { bad=1 }
    /^(Inst|Conf) / { package=$2; sub(/:amd64$/, "", package); if(package!="postgresql-client-16") bad=1 }
    /^Inst / { installs++ }
    END { exit (bad || installs>1) }' "$1"
}
source_text() {
  printf 'Types: deb\nURIs: https://apt.postgresql.org/pub/repos/apt\nSuites: resolute-pgdg\nArchitectures: amd64\nComponents: main\nSigned-By: %s\n' "$PGDG_KEY"
}
preference_text() {
  printf 'Package: postgresql-client-16\nPin: release o=apt.postgresql.org,n=resolute-pgdg\nPin-Priority: 500\n\nPackage: *\nPin: origin apt.postgresql.org\nPin-Priority: -1\n'
}
protected_directory() {
  local current=$1 mode
  [[ $(realpath -e -- "$current") == "$current" ]] || fail unsafe_directory
  while :; do
    [[ -d $current && ! -L $current && $(stat -c '%u:%g' -- "$current") == 0:0 ]] || fail unsafe_directory
    mode=$(stat -c '%a' -- "$current")
    [[ $((8#$mode & 0022)) -eq 0 ]] || fail writable_directory
    [[ $current == / ]] && break
    current=$(dirname -- "$current")
  done
}
install_unchanged_or_new() {
  local source=$1 destination=$2
  protected_directory "$(dirname -- "$destination")"
  if [[ -e $destination || -L $destination ]]; then
    [[ -f $destination && ! -L $destination && $(realpath -e -- "$destination") == "$destination" &&
       $(stat -c '%u:%g:%h:%a' -- "$destination") == 0:0:1:644 ]] || fail unsafe_existing_file
    cmp --silent -- "$source" "$destination" || fail existing_repository_configuration_differs
  else
    install -o root -g root -m 0644 -T -- "$source" "$destination"
  fi
}
main() {
  [[ $# -eq 0 && $EUID -eq 0 && $(uname -s) == Linux ]] || fail root_linux_no_arguments_required
  export LC_ALL=C
  # This is the root-owned OS identity, never an application or secret environment file.
  . /etc/os-release
  [[ $ID == ubuntu && $VERSION_CODENAME == resolute && $(dpkg --print-architecture) == amd64 ]] || fail ubuntu_resolute_amd64_required
  for tool in curl gpg apt-get apt-cache dpkg-query awk cmp install realpath stat; do
    command -v "$tool" >/dev/null || fail prerequisite_command_missing
  done
  protected_directory /etc/apt/sources.list.d
  protected_directory /etc/apt/preferences.d
  protected_directory /usr/share/postgresql-common
  if [[ ! -e /usr/share/postgresql-common/pgdg && ! -L /usr/share/postgresql-common/pgdg ]]; then
    install -d -o root -g root -m 0755 /usr/share/postgresql-common/pgdg
  fi
  protected_directory /usr/share/postgresql-common/pgdg
  PGDG_TASK_TMP=$(mktemp -d /var/tmp/nodia-pgdg-client-XXXXXXXX)
  cleanup() {
    local result=$?
    trap - EXIT
    rm -f -- "$PGDG_TASK_TMP/key.asc" "$PGDG_TASK_TMP/key-colons" "$PGDG_TASK_TMP/pubring.kbx" \
      "$PGDG_TASK_TMP/trustdb.gpg" "$PGDG_TASK_TMP/source" "$PGDG_TASK_TMP/preference" "$PGDG_TASK_TMP/plan"
    rmdir -- "$PGDG_TASK_TMP" || true
    exit "$result"
  }
  trap cleanup EXIT
  curl --fail --silent --show-error --proto '=https' --tlsv1.2 --connect-timeout 10 --max-time 30 --max-filesize 65536 \
    https://www.postgresql.org/media/keys/ACCC4CF8.asc --output "$PGDG_TASK_TMP/key.asc"
  gpg --no-options --batch --homedir "$PGDG_TASK_TMP" --with-colons --show-keys "$PGDG_TASK_TMP/key.asc" > "$PGDG_TASK_TMP/key-colons"
  valid_key_fingerprint "$PGDG_TASK_TMP/key-colons" || fail repository_key_fingerprint_mismatch
  source_text > "$PGDG_TASK_TMP/source"
  preference_text > "$PGDG_TASK_TMP/preference"
  install_unchanged_or_new "$PGDG_TASK_TMP/key.asc" "$PGDG_KEY"
  install_unchanged_or_new "$PGDG_TASK_TMP/source" "$PGDG_SOURCE"
  install_unchanged_or_new "$PGDG_TASK_TMP/preference" "$PGDG_PREFERENCE"
  apt-get update --error-on=any
  local candidate before18 after18
  candidate=$(apt-cache policy postgresql-client-16 | extract_candidate)
  [[ $candidate == "$PGDG_CLIENT_VERSION" ]] || fail reviewed_client16_candidate_changed_or_unavailable
  before18=$(dpkg-query -W -f='${Version}' postgresql-client-18)
  LC_ALL=C apt-get --simulate --no-install-recommends --no-upgrade --no-remove install "postgresql-client-16=$candidate" > "$PGDG_TASK_TMP/plan"
  cat "$PGDG_TASK_TMP/plan"
  valid_install_plan "$PGDG_TASK_TMP/plan" || fail apt_plan_changes_packages_other_than_client16
  NEEDRESTART_MODE=l DEBIAN_FRONTEND=noninteractive apt-get --yes --no-install-recommends --no-upgrade --no-remove install "postgresql-client-16=$candidate"
  [[ $(dpkg-query -W -f='${db:Status-Status} ${Version}' postgresql-client-16) == "installed $candidate" ]] || fail installed_client16_version_mismatch
  after18=$(dpkg-query -W -f='${Version}' postgresql-client-18)
  [[ $before18 == "$after18" ]] || fail existing_client18_changed
  local binary version
  for binary in pg_dump pg_restore psql; do
    local executable=/usr/lib/postgresql/16/bin/$binary
    [[ -f $executable && ! -L $executable && $(realpath -e -- "$executable") == "$executable" &&
       $(stat -c '%u:%g' -- "$executable") == 0:0 ]] || fail unsafe_client_binary
    local mode
    mode=$(stat -c '%a' -- "$executable")
    [[ $((8#$mode & 0022)) -eq 0 ]] || fail writable_client_binary
    version=$("$executable" --version)
    [[ $version =~ ^$binary\ \(PostgreSQL\)\ 16\.[0-9]+ ]] || fail client_binary_major_mismatch
    printf '%s\n' "$version"
  done
  printf '[Nodia PostgreSQL16 client] complete: client16 installed; client18 preserved. No server, database, migration or backup operation requested.\n'
}
if [[ ${BASH_SOURCE[0]} == "$0" ]]; then main "$@"; fi
