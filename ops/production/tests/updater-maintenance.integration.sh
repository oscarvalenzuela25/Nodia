#!/usr/bin/env bash
# Disposable Ubuntu container only; never run this system fixture on the VPS.
set -Eeuo pipefail
[[ -f /.dockerenv && $(id -u) == 0 && -f /input/install-backend-updater.py ]]
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq --no-install-recommends python3 nginx openssl curl >/tmp/install.log 2>&1
mkdir -p /etc/letsencrypt/live/nodia-api-ip /var/www/letsencrypt/.well-known/acme-challenge
openssl req -x509 -newkey rsa:2048 -nodes -days 1 -subj /CN=synthetic-fixture \
  -keyout /etc/letsencrypt/live/nodia-api-ip/privkey.pem \
  -out /etc/letsencrypt/live/nodia-api-ip/fullchain.pem >/tmp/tls.log 2>&1
chmod 0600 /etc/letsencrypt/live/nodia-api-ip/privkey.pem
for file in nodia-api.service nodia-ai-worker.service nodia-ai-backup.service nodia-ai-backup-rotate.service \
  nodia-ai-journal-reconcile.service nodia-ai-backup.timer nodia-ai-backup-rotate.timer; do
  install -m 0644 "/input/$file" "/etc/systemd/system/$file"
done
install -m 0644 /input/nodia-api.nginx.conf /etc/nginx/sites-available/nodia-api.conf
[[ ! -e /etc/nginx/sites-enabled/default ]] || unlink /etc/nginx/sites-enabled/default
ln -s /etc/nginx/sites-available/nodia-api.conf /etc/nginx/sites-enabled/nodia-api.conf
printf 'synthetic-acme\n' >/var/www/letsencrypt/.well-known/acme-challenge/fixture
cat >/tmp/upstream.py <<'PY'
from http.server import BaseHTTPRequestHandler,HTTPServer
class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200);self.end_headers();self.wfile.write(b'synthetic-upstream')
    def log_message(self,*_):pass
HTTPServer(('127.0.0.1',3000),Handler).serve_forever()
PY
python3 /tmp/upstream.py &
nginx -t
nginx
# This container has no systemd PID1. Stub only reload; Nginx itself/config/HTTP are real.
cat >/usr/bin/systemctl <<'EOF'
#!/bin/sh
[ "$#" = 2 ] && [ "$1" = reload ] && [ "$2" = nginx ] || exit 99
exec /usr/sbin/nginx -s reload
EOF
chmod 0755 /usr/bin/systemctl
python3 -I /input/install-backend-updater.py --prepare /tmp/reviewed-bundle >/tmp/prepare.json
digest=$(sha256sum /tmp/reviewed-bundle/updater-bundle.json | cut -d' ' -f1)
python3 -I /input/install-backend-updater.py --install /tmp/reviewed-bundle --manifest-sha256 "$digest" >/tmp/installed.json
sleep 1
# -k is restricted to this synthetic self-signed fixture, not production updater HTTP checks.
[[ $(curl -ks -o /dev/null -w '%{http_code}' https://127.0.0.1/api/v1) == 200 ]]
printf 'synthetic-operation\n' >/var/lib/nodia-maintenance/backend
chmod 0644 /var/lib/nodia-maintenance/backend
[[ $(curl -ks -o /dev/null -w '%{http_code}' https://127.0.0.1/api/v1) == 503 ]]
[[ $(curl -ks -o /dev/null -w '%{http_code}' https://127.0.0.1/tls-check) == 200 ]]
[[ $(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1/.well-known/acme-challenge/fixture) == 200 ]]
unlink /var/lib/nodia-maintenance/backend
[[ $(curl -ks -o /dev/null -w '%{http_code}' https://127.0.0.1/api/v1) == 200 ]]
python3 -I /input/install-backend-updater.py --install /tmp/reviewed-bundle --manifest-sha256 "$digest" >/tmp/repeated.json
python3 -I - <<'PY'
import json,os,pathlib,stat
first=json.load(open('/tmp/installed.json'));again=json.load(open('/tmp/repeated.json'))
assert first==again and first['deployment_performed'] is False and first['sudo_grant_created'] is False
settings=pathlib.Path('/var/lib/nodia-updates/settings.json')
assert settings.stat().st_uid==0 and stat.S_IMODE(settings.stat().st_mode)==0o600
for name in ['update-backend.py','backend_update.py','update-backend-action.mjs','stage-backend-candidate.py','probe-backend-dependencies.mjs']:
    p=pathlib.Path('/usr/local/lib/nodia')/name
    assert p.stat().st_uid==0 and stat.S_IMODE(p.stat().st_mode)==0o644
print(json.dumps({'status':'passed','real_nginx_http_sequence':[200,503,200],
    'tls_and_acme_exceptions_preserved':True,'installer_repeat_verified':True,
    'protected_asset_modes_verified':True,'systemctl_reload_only_stubbed':True,
    'application_update_performed':False,'host_ports_published':False,'production_accessed':False}))
PY
