#!/usr/bin/env bash
# Explicit administrator maintenance only; does not run application migrations.
set -Eeuo pipefail
umask 077

fail() { printf '\n[Nodia PostgreSQL extensions] failed: %s\n' "$1" >&2; exit 1; }
[[ $# -eq 3 ]] || fail 'Usage: prepare-postgres-extensions.sh HOST EXTERNAL_PORT DATABASE'
PG_HOST=$1
PG_PORT=$2
PG_DATABASE=$3
[[ ${#PG_HOST} -le 253 && $PG_HOST != *..* && $PG_HOST =~ ^[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?$ ]] || fail 'Invalid PostgreSQL hostname.'
IFS='.' read -r -a HOST_LABELS <<< "$PG_HOST"
for HOST_LABEL in "${HOST_LABELS[@]}"; do
  [[ ${#HOST_LABEL} -le 63 && $HOST_LABEL =~ ^[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?$ ]] || fail 'Invalid PostgreSQL hostname label.'
done
[[ $PG_PORT =~ ^[0-9]{1,5}$ ]] || fail 'Invalid PostgreSQL port.'
((10#$PG_PORT >= 1 && 10#$PG_PORT <= 65535)) || fail 'Invalid PostgreSQL port.'
[[ $PG_DATABASE =~ ^[A-Za-z_][A-Za-z0-9_]{0,62}$ ]] || fail 'Invalid PostgreSQL database name.'
[[ -t 0 && -t 1 ]] || fail 'Run interactively in the operator terminal; do not pipe credentials.'
PSQL_BINARY=$(type -P psql) || fail 'psql is required; this helper does not install packages.'
[[ $PSQL_BINARY = /* && -x $PSQL_BINARY ]] || fail 'An absolute psql executable is required.'
CA_BUNDLE=/etc/ssl/certs/ca-certificates.crt
[[ -r $CA_BUNDLE ]] || fail 'The system CA bundle is unavailable.'
SCRIPT_DIRECTORY=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
SQL_FILE=$SCRIPT_DIRECTORY/prepare-postgres-extensions.sql
[[ -f $SQL_FILE && ! -L $SQL_FILE ]] || fail 'The adjacent regular SQL file is required.'

ADMIN_USERNAME=''
trap 'unset ADMIN_USERNAME' EXIT
printf 'Use ADMIN_USERNAME from Northflank. No password or username is saved.\n'
IFS= read -r -s -p 'Northflank ADMIN_USERNAME: ' ADMIN_USERNAME || fail 'Administrator username was not entered.'
printf '\n'
[[ $ADMIN_USERNAME =~ ^[A-Za-z_][A-Za-z0-9_.-]{0,62}$ ]] || fail 'Invalid administrator username.'
printf '\n[Nodia PostgreSQL extensions] preparing: psql will request the PostgreSQL administrator password privately.\n'
if ! env -i PATH=/usr/bin:/bin LANG=C.UTF-8 LC_ALL=C.UTF-8 \
  PGHOST="$PG_HOST" PGPORT="$PG_PORT" PGDATABASE="$PG_DATABASE" PGUSER="$ADMIN_USERNAME" \
  PGSSLMODE=verify-full PGSSLROOTCERT="$CA_BUNDLE" PGGSSENCMODE=disable PGCONNECT_TIMEOUT=10 \
  PGTARGETSESSIONATTRS=read-write PGAPPNAME=nodia-extension-maintenance \
  PGPASSFILE=/dev/null PGSERVICEFILE=/dev/null PSQL_HISTORY=/dev/null \
  "$PSQL_BINARY" --no-psqlrc --password --set=ON_ERROR_STOP=1 --file="$SQL_FILE"; then
  fail 'Extension preparation did not commit successfully. Inspect the terminal; do not reset the addon or change grants.'
fi
unset ADMIN_USERNAME
printf '\n[Nodia PostgreSQL extensions] complete: uuid-ossp and pg_trgm are installed in public. No application migration, seed or permission grant was requested.\n'
