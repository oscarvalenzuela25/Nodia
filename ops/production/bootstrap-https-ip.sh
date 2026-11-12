#!/usr/bin/env bash
# Initial HTTPS bootstrap only. Run explicitly with sudo after reviewing this file.
set -Eeuo pipefail
umask 077

if [[ $EUID -ne 0 ]]; then
  printf 'Run this initial setup with sudo. No files were changed.\n' >&2
  exit 1
fi
if [[ $# -ne 1 ]]; then
  printf 'Usage: sudo bash bootstrap-https-ip.sh PUBLIC_IPV4\n' >&2
  exit 1
fi
IP=$(python3 - "$1" <<'PY'
import ipaddress, sys
address = ipaddress.IPv4Address(sys.argv[1])
if not address.is_global:
    raise SystemExit('A public IPv4 address is required')
print(address)
PY
)

STATE=/var/lib/nodia-https
SITE=/etc/nginx/sites-available/nodia-api.conf
ENABLED=/etc/nginx/sites-enabled/nodia-api.conf
DEFAULT=/etc/nginx/sites-enabled/default
WEBROOT=/var/www/letsencrypt
LINEAGE=/etc/letsencrypt/live/nodia-api-ip
STAGING=https://acme-staging-v02.api.letsencrypt.org/directory
PRODUCTION=https://acme-v02.api.letsencrypt.org/directory
PROBE_FILE=

for binary in nginx certbot ufw openssl python3 curl flock systemctl; do
  command -v "$binary" >/dev/null || { printf 'Missing command: %s\n' "$binary" >&2; exit 1; }
done
help=$(certbot --help all)
grep -q -- '--required-profile' <<<"$help" || { printf 'Certbot lacks required profile support\n' >&2; exit 1; }
if [[ -L $SITE ]] || { [[ -f $SITE ]] && grep -q 'proxy_pass' "$SITE"; }; then
  printf 'Refusing to replace a symlink or an application proxy. This is initial setup only.\n' >&2
  exit 1
fi
for enabled in /etc/nginx/sites-enabled/*; do
  [[ -e $enabled || -L $enabled ]] || continue
  case "$enabled" in
    "$ENABLED"|"$DEFAULT") ;;
    *) printf 'Unexpected enabled site: %s; review before bootstrap.\n' "$enabled" >&2; exit 1 ;;
  esac
done
if [[ -e $ENABLED || -L $ENABLED ]]; then
  [[ -L $ENABLED && $(readlink "$ENABLED") == "$SITE" ]] || exit 1
fi
if [[ -e $DEFAULT || -L $DEFAULT ]]; then
  [[ -L $DEFAULT && $(readlink "$DEFAULT") == /etc/nginx/sites-available/default ]] || exit 1
fi

install -d -m 0755 "$STATE"
exec 9>"$STATE/setup.lock"
flock -n 9 || { printf 'Another HTTPS bootstrap is running.\n' >&2; exit 1; }
install -d -m 0700 "$STATE/before"
if [[ ! -f $STATE/before/saved ]]; then
  if [[ -f $SITE ]]; then cp -p "$SITE" "$STATE/before/nodia-api.conf"; fi
  if [[ -L $DEFAULT ]]; then readlink "$DEFAULT" >"$STATE/before/default-target"; fi
  touch "$STATE/before/saved"
fi

status() {
  python3 - "$STATE" "$IP" "$1" "${2:-}" <<'PY'
import datetime, json, os, pathlib, sys, tempfile
directory, address, phase, detail = sys.argv[1:]
payload = {'updated_at': datetime.datetime.now(datetime.timezone.utc).isoformat(),
           'ip': address, 'phase': phase, 'detail': detail}
with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', dir=directory, delete=False) as stream:
    json.dump(payload, stream)
    stream.write('\n')
    name = stream.name
os.chmod(name, 0o644)
os.replace(name, pathlib.Path(directory) / 'status.json')
PY
  printf '\n[Nodia HTTPS] %s: %s\n' "$1" "${2:-}"
}
on_error() {
  local code=$? line=$1
  trap - ERR
  status failed "Command failed at line $line (exit $code); inspect the operator terminal."
  exit "$code"
}
cleanup() {
  if [[ -n $PROBE_FILE && $PROBE_FILE == "$WEBROOT/.well-known/acme-challenge/nodia-bootstrap-"* ]]; then
    rm -f -- "$PROBE_FILE"
  fi
}
on_interrupt() {
  trap - ERR HUP INT TERM
  status interrupted "Signal $1 received; inspect Certbot state before resuming an issuance."
  exit 130
}
trap 'on_error "$LINENO"' ERR
trap cleanup EXIT
trap 'on_interrupt HUP' HUP
trap 'on_interrupt INT' INT
trap 'on_interrupt TERM' TERM

apply_site() {
  local candidate=$1 previous had_site=0 had_enabled=0 had_default=0
  previous=$(mktemp "$STATE/site-before.XXXXXX")
  if [[ -f $SITE ]]; then cp -p "$SITE" "$previous"; had_site=1; fi
  if [[ -L $ENABLED ]]; then had_enabled=1; fi
  if [[ -L $DEFAULT ]]; then had_default=1; fi
  install -m 0644 "$candidate" "$SITE"
  if [[ $had_enabled == 0 ]]; then ln -s "$SITE" "$ENABLED"; fi
  if [[ $had_default == 1 ]]; then unlink "$DEFAULT"; fi
  if ! nginx -t; then
    if [[ $had_site == 1 ]]; then cp -p "$previous" "$SITE"; else rm -f -- "$SITE"; fi
    if [[ $had_enabled == 0 ]]; then unlink "$ENABLED"; fi
    if [[ $had_default == 1 ]]; then ln -s /etc/nginx/sites-available/default "$DEFAULT"; fi
    rm -f -- "$previous"
    printf 'Invalid Nginx candidate; previous on-disk site restored without reloading.\n' >&2
    return 1
  fi
  systemctl reload nginx
  rm -f -- "$previous"
}

status preparing_http 'Preparing the HTTP-01 webroot; API proxy is not deployed.'
# With umask 077, install -d sets only the final directory's explicit mode.
# Enumerate every public parent; never relax /etc/letsencrypt (private keys).
install -d -m 0755 "$WEBROOT" "$WEBROOT/.well-known" "$WEBROOT/.well-known/acme-challenge"
cat >"$STATE/http.template" <<'NGINX'
# Nodia initial HTTPS bootstrap. Replace through a reviewed deployment before adding an API proxy.
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name __NODIA_IP__;
    server_tokens off;
    location ^~ /.well-known/acme-challenge/ {
        root /var/www/letsencrypt;
        default_type text/plain;
        try_files $uri =404;
    }
    location / { return 404; }
}
NGINX
sed "s/__NODIA_IP__/$IP/g" "$STATE/http.template" >"$STATE/http.conf"
if [[ ! -f $LINEAGE/fullchain.pem ]]; then apply_site "$STATE/http.conf"; fi
ufw allow 80/tcp comment 'ACME HTTP validation'
PROBE_FILE="$WEBROOT/.well-known/acme-challenge/nodia-bootstrap-$(date +%s)-$$"
printf 'nodia-acme-ok\n' >"$PROBE_FILE"
chmod 0644 "$PROBE_FILE"
probe_ready=0
for attempt in {1..12}; do
  if probe_body=$(curl --fail --silent --show-error --max-time 2 -H "Host: $IP" \
    "http://127.0.0.1/.well-known/acme-challenge/$(basename "$PROBE_FILE")" 2>"$STATE/probe-error.log"); then
    if [[ $probe_body == nodia-acme-ok ]]; then probe_ready=1; break; fi
  fi
  sleep 0.5
done
if [[ $probe_ready != 1 ]]; then
  printf 'HTTP-01 probe did not become readable after the bounded reload wait.\n' >&2
  cat "$STATE/probe-error.log" >&2
  false
fi
printf '%s\n' "$probe_body"

status staging 'Certbot may ask for registration email and terms in this terminal.'
certbot certonly --dry-run --server "$STAGING" --required-profile shortlived \
  --webroot --webroot-path "$WEBROOT" --ip-address "$IP" --cert-name nodia-api-ip

status issuing_public 'Requesting or preserving the production IP certificate.'
certbot certonly --server "$PRODUCTION" --required-profile shortlived \
  --webroot --webroot-path "$WEBROOT" --ip-address "$IP" --cert-name nodia-api-ip \
  --keep-until-expiring
openssl x509 -in "$LINEAGE/fullchain.pem" -noout -checkip "$IP"
openssl x509 -in "$LINEAGE/fullchain.pem" -noout -checkend 86400

status configuring_tls 'Configuring Nginx TLS; the API itself remains undeployed.'
cat >"$STATE/tls.template" <<'NGINX'
# Nodia initial HTTPS bootstrap. Replace through a reviewed deployment before adding an API proxy.
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name __NODIA_IP__;
    server_tokens off;
    location ^~ /.well-known/acme-challenge/ {
        root /var/www/letsencrypt;
        default_type text/plain;
        try_files $uri =404;
    }
    location / { return 308 https://__NODIA_IP__$request_uri; }
}
server {
    listen 443 ssl default_server;
    listen [::]:443 ssl default_server;
    server_name __NODIA_IP__;
    server_tokens off;
    ssl_certificate /etc/letsencrypt/live/nodia-api-ip/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/nodia-api-ip/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_session_cache shared:NodiaTLS:10m;
    location = /tls-check {
        default_type text/plain;
        add_header Cache-Control no-store;
        return 200 "nodia-https-ok\n";
    }
    location / { return 404; }
}
NGINX
sed "s/__NODIA_IP__/$IP/g" "$STATE/tls.template" >"$STATE/tls.conf"
apply_site "$STATE/tls.conf"
ufw allow 443/tcp comment 'Nodia HTTPS'
curl --fail --silent --show-error --max-time 20 "https://$IP/tls-check"

status configuring_renewal 'Installing the Nginx deploy hook and checking the existing Snap timer.'
install -d -m 0755 /etc/letsencrypt/renewal-hooks/deploy
cat >/etc/letsencrypt/renewal-hooks/deploy/nodia-nginx-reload <<'HOOK'
#!/bin/sh
set -eu
/usr/sbin/nginx -t
/usr/bin/systemctl reload nginx
HOOK
chmod 0755 /etc/letsencrypt/renewal-hooks/deploy/nodia-nginx-reload
chown root:root /etc/letsencrypt/renewal-hooks/deploy/nodia-nginx-reload
systemctl start snap.certbot.renew.timer
systemctl is-enabled snap.certbot.renew.timer
systemctl is-active snap.certbot.renew.timer

status testing_renewal 'Testing renewal against staging and executing the deploy hook.'
certbot renew --cert-name nodia-api-ip --dry-run --run-deploy-hooks --server "$STAGING"
curl --fail --silent --show-error --max-time 20 "https://$IP/tls-check"
openssl x509 -in "$LINEAGE/fullchain.pem" -noout -issuer -dates -ext subjectAltName
ufw status verbose
systemctl list-timers --all --no-pager snap.certbot.renew.timer
status complete 'HTTPS and renewal rehearsal succeeded. External TLS verification is still required; API is not deployed.'
