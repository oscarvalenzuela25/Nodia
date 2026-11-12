#!/usr/bin/env bash
# Interactive connectivity probe only: no migrations, seeds or persisted credentials.
set -Eeuo pipefail
umask 077
if [[ $# -ne 3 || $EUID -eq 0 || ! -t 0 ]]; then
  printf 'Run interactively as nodia-admin: bash check-postgres.sh HOST EXTERNAL_PORT DATABASE\n' >&2
  exit 1
fi
HOST=$1 PORT=$2 DATABASE=$3
python3 - "$HOST" "$PORT" "$DATABASE" <<'PY'
import re, sys
host, port, database = sys.argv[1:]
if not (len(host) <= 253 and re.fullmatch(r'[a-zA-Z0-9](?:[a-zA-Z0-9.-]*[a-zA-Z0-9])?', host)):
    raise SystemExit('Supply a DNS hostname, never a URI')
if '.' not in host or re.fullmatch(r'[0-9.]+', host):
    raise SystemExit('Supply the external DNS hostname')
if not (port.isascii() and port.isdigit() and 0 < int(port) <= 65535):
    raise SystemExit('Invalid port')
if not re.fullmatch(r'[a-zA-Z0-9_][a-zA-Z0-9_-]{0,62}', database):
    raise SystemExit('Invalid database name')
PY
SOURCE=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
STATE="$HOME/nodia-setup/postgres"
[[ ! -L $STATE ]] || { printf 'Refusing symlinked state directory.\n' >&2; exit 1; }
install -d -m 0700 "$STATE"
exec 9>"$STATE/probe.lock"
flock -n 9 || { printf 'Another PostgreSQL probe is running.\n' >&2; exit 1; }
[[ -f $SOURCE/check-postgres.sql && ! -L $SOURCE/check-postgres.sql ]]
status() {
  python3 - "$STATE" "$HOST" "$PORT" "$DATABASE" "$1" "${2:-}" <<'PY'
import datetime, json, os, pathlib, sys, tempfile
directory, host, port, database, phase, detail = sys.argv[1:]
with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', dir=directory, delete=False) as stream:
    json.dump({'updated_at_utc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
               'host': host, 'port': int(port), 'database': database,
               'phase': phase, 'detail': detail}, stream)
    stream.write('\n')
    name = stream.name
os.chmod(name, 0o600)
os.replace(name, pathlib.Path(directory) / 'status.json')
PY
  printf '\n[Nodia PostgreSQL] %s: %s\n' "$1" "${2:-}"
}
failed() {
  local code=$? line=$1
  trap - ERR
  status failed "Command failed at line $line (exit $code). Inspect the terminal; no automatic retry or migration."
  exit "$code"
}
trap 'failed "$LINENO"' ERR
trap 'status interrupted "Probe interrupted; no migration was requested."; exit 130' INT TERM HUP
status preparing 'Preparing a read-only PostgreSQL client probe; no API/Worker is started.'
if ! command -v psql >/dev/null; then
  printf 'Installing only PostgreSQL client tools. Sudo requests the Linux administrative password.\n'
  sudo apt-get install --yes --no-install-recommends postgresql-client
fi
[[ -r /etc/ssl/certs/ca-certificates.crt ]]
psql --version
status resolving 'Checking DNS and TLS before requesting database credentials.'
# Retry only credential-free DNS lookups, never authentication or SQL.
DB_ADDRESS=$(timeout 15 python3 - "$HOST" "$PORT" <<'PY'
import socket, sys, time
for attempt in range(3):
    try:
        addresses = socket.getaddrinfo(sys.argv[1], int(sys.argv[2]), socket.AF_INET, socket.SOCK_STREAM)
        print(addresses[0][4][0])
        break
    except socket.gaierror:
        if attempt == 2:
            raise SystemExit('DNS resolution failed before requesting credentials; no database connection attempted.')
        time.sleep(1)
PY
)
timeout 12 openssl s_client -starttls postgres -connect "$DB_ADDRESS:$PORT" \
  -servername "$HOST" -verify_hostname "$HOST" -verify_return_error -brief </dev/null
printf '\nUse USERNAME from Northflank, not ADMIN_USERNAME. The next database password prompt is separate from sudo.\n'
read -r -p 'Northflank USERNAME: ' DB_USER
[[ $DB_USER =~ ^[a-zA-Z_][a-zA-Z0-9_-]{0,62}$ ]] || {
  status failed 'Invalid or empty username; no connection attempted.'
  exit 1
}
status connecting 'Using verify-full and the system CA bundle; password is requested privately by psql.'
# -W obtains the password from the terminal, never from shell history or argv.
# -X disables psqlrc; fixed environment prevents service/password-file defaults.
# PGHOSTADDR is resolved for this run only. PGHOST still verifies the DNS identity.
RESULT=$(env -u PGSERVICE -u PGSERVICEFILE -u PGPASSWORD -u PGPASSFILE -u PGHOSTADDR \
  -u PGSSLCERT -u PGSSLKEY -u PGSSLPASSWORD \
  PGHOST="$HOST" PGHOSTADDR="$DB_ADDRESS" PGPORT="$PORT" PGDATABASE="$DATABASE" PGUSER="$DB_USER" \
  PGSSLMODE=verify-full PGSSLROOTCERT=/etc/ssl/certs/ca-certificates.crt \
  PGGSSENCMODE=disable PGSSLNEGOTIATION=postgres \
  PGCONNECT_TIMEOUT=10 PGAPPNAME=nodia-deployment-readonly-probe \
  PGOPTIONS='-c default_transaction_read_only=on -c statement_timeout=10000 -c lock_timeout=3000' \
  psql -X -W --quiet --tuples-only --no-align --set=ON_ERROR_STOP=1 \
  --file="$SOURCE/check-postgres.sql")
printf '%s' "$RESULT" | python3 -c '
import datetime, json, os, pathlib, sys, tempfile
directory, host, port, expected_database = sys.argv[1:]
result = json.load(sys.stdin)
if result["database"] != expected_database:
    raise SystemExit("Unexpected database")
if result["transaction_read_only"] != "on":
    raise SystemExit("Read-only transaction not confirmed")
payload = {"updated_at_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
           "host": host, "port": int(port), "phase": "complete",
           "client_tls_mode": "verify-full", "client_ca": "/etc/ssl/certs/ca-certificates.crt",
           "metadata": result,
           "limitations": "psql probe only; Node API/Worker, migrations, backup/restore and rotation remain pending. Table count does not establish a migration baseline."}
with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=directory, delete=False) as stream:
    json.dump(payload, stream, ensure_ascii=False, indent=2)
    stream.write("\n")
    name = stream.name
os.chmod(name, 0o600)
os.replace(name, pathlib.Path(directory) / "status.json")
print(json.dumps(result, ensure_ascii=False, indent=2))
' "$STATE" "$HOST" "$PORT" "$DATABASE"
printf '\n[Nodia PostgreSQL] complete: Authentication and read-only metadata queries succeeded with verify-full. No migrations or seeds were requested.\n'
