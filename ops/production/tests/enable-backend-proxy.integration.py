"""Exact Nginx site with a synthetic loopback upstream; no real API, VPS or provider."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import uuid

IMAGE = 'sha256:dc73b49f5124cf2ee538dfbdfbd121f0b4ccdcb20fea30f3a81bd477c02e2bb5'
SOURCE = Path(__file__).resolve().parents[1] / 'nodia-api.nginx.conf'
LABEL = 'nodia.production.nginx-proxy'
SESSION = uuid.uuid4().hex
container = None


def docker(*args):
    result = subprocess.run(['docker', *args], capture_output=True, text=True, timeout=30)
    result.check_returncode()
    return result.stdout


def http(target, status, *, secure=False, headers=()):
    result = docker('exec', container, 'curl', '--silent', '--show-error', '--max-time', '5', '--insecure',
                    *[part for name, value in headers for part in ('--header', name + ': ' + value)],
                    '--write-out', '\n%{http_code}', ('https' if secure else 'http') + '://127.0.0.1' + target)
    body, code = result.rsplit('\n', 1)
    assert int(code) == status, (target, code)
    return body


try:
    assert docker('image', 'inspect', IMAGE, '--format', '{{.Id}}').strip() == IMAGE
    with tempfile.TemporaryDirectory(prefix='nodia-nginx-fixture-') as directory:
        root = Path(directory)
        openssl = os.environ.get('NODIA_TEST_OPENSSL') or shutil.which('openssl')
        if not openssl and os.name == 'nt':
            openssl = 'C:/Program Files/Git/usr/bin/openssl.exe'
        subprocess.run([openssl, 'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1', '-subj', '/CN=synthetic-fixture',
                        '-addext', 'subjectAltName=IP:166.0.112.187', '-keyout', str(root / 'key.pem'), '-out', str(root / 'cert.pem')],
                       capture_output=True, timeout=20, check=True)
        config = SOURCE.read_bytes()
        extra = b'''\nserver { listen 127.0.0.1:3000; server_name synthetic_upstream;
location / { default_type text/plain;
return 200 "$uri|$args|$http_host|$http_x_real_ip|$http_x_forwarded_for|$http_x_forwarded_proto"; }
}\n'''
        (root / 'site.conf').write_bytes(config + extra)
        container = docker('create', '--network', 'none', '--label', LABEL + '=' + SESSION,
                           '--entrypoint', '/bin/sleep', IMAGE, '120').strip()
        docker('start', container)
        docker('exec', container, 'mkdir', '-p', '/etc/letsencrypt/live/nodia-api-ip', '/var/www/letsencrypt/.well-known/acme-challenge')
        for local, remote in (('site.conf', '/etc/nginx/conf.d/default.conf'), ('cert.pem', '/etc/letsencrypt/live/nodia-api-ip/fullchain.pem'),
                              ('key.pem', '/etc/letsencrypt/live/nodia-api-ip/privkey.pem')):
            docker('cp', str(root / local), container + ':' + remote)
        docker('exec', container, '/bin/sh', '-c', "printf fixture-acme-ok > /var/www/letsencrypt/.well-known/acme-challenge/fixture")
        docker('exec', container, 'nginx', '-t')
        docker('exec', container, 'nginx')
        assert http('/.well-known/acme-challenge/fixture', 200) == 'fixture-acme-ok'
        assert http('/tls-check', 200, secure=True) == 'nodia-https-ok\n'
        http('/', 308)
        http('/', 404, secure=True)
        http('/api/v10', 404, secure=True)
        http('/api/v1evil', 404, secure=True)
        sent = [('Host', '166.0.112.187'), ('X-Forwarded-For', '203.0.113.99'), ('X-Real-IP', 'foreign'), ('X-Forwarded-Proto', 'http')]
        assert http('/api/v1?fixture=1', 200, secure=True, headers=sent) == '/api/v1|fixture=1|166.0.112.187|127.0.0.1|127.0.0.1|https'
        assert http('/api/v1/users?fixture=2', 200, secure=True, headers=sent) == '/api/v1/users|fixture=2|166.0.112.187|127.0.0.1|127.0.0.1|https'
        large = docker('exec', container, 'curl', '--silent', '--show-error', '--max-time', '5', '--insecure', '--request', 'POST',
                       '--header', 'Content-Length: 34603008', '--write-out', '\n%{http_code}', 'https://127.0.0.1/api/v1')
        assert large.rsplit('\n', 1)[1] == '413'
        print(json.dumps({'schema_version': 1, 'status': 'passed', 'scope': 'local_nginx_with_synthetic_upstream_and_certificate',
                          'nginx_image': IMAGE, 'nginx_version': '1.28.3', 'candidate_sha256': hashlib.sha256(config).hexdigest(),
                          'checks': ['exact_site_syntax', 'ACME_plain_http', 'HTTP_308', 'TLS_check_preserved', 'root_and_prefix_boundary_404',
                                     'API_path_and_query_preserved', 'forwarded_headers_overwritten', '32MiB_transport_envelope_enforced'],
                          'VPS_access': False, 'real_API_access': False, 'TLS_public_trust_verified': False, 'published_ports': 0}))
finally:
    if container:
        observed = json.loads(docker('inspect', container))[0]
        assert observed['Config']['Labels'][LABEL] == SESSION
        docker('rm', '--force', '--volumes', container)
