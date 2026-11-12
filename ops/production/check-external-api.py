#!/usr/bin/env python3
"""Unauthenticated transport checks using curl's standard TLS validation (no config or insecure flag)."""
import datetime
import json
from pathlib import Path
import socket
import subprocess
import tempfile

IP = '166.0.112.187'
ORIGIN = 'https://nodia-1ge.pages.dev'


def request(method, path, headers=None):
    with tempfile.TemporaryDirectory(prefix='nodia-public-transport-') as directory:
        body = Path(directory) / 'body'
        metadata = Path(directory) / 'headers'
        args = ['curl.exe', '--disable', '--silent', '--show-error', '--noproxy', '*', '--connect-timeout', '5',
                '--max-time', '15', '--max-redirs', '0', '--request', method,
                '--output', str(body), '--dump-header', str(metadata), '--write-out', '%{http_code}|%{ssl_verify_result}']
        for key, value in (headers or {}).items():
            args.extend(['--header', key + ': ' + value])
        args.append('https://' + IP + path)
        result = subprocess.run(args, capture_output=True, text=True, timeout=20)
        if result.returncode:
            raise RuntimeError('Standard curl TLS/request check failed with exit ' + str(result.returncode))
        status, verification = result.stdout.strip().split('|')
        if verification != '0':
            raise RuntimeError('TLS verification was not successful')
        fields = {}
        for line in metadata.read_text(encoding='iso8859-1').splitlines():
            if ':' in line:
                key, value = line.split(':', 1)
                fields[key.lower()] = value.strip()
        return int(status), fields, body.read_bytes()


def main():
    status, headers, body = request('GET', '/api/v1', {'Origin': ORIGIN})
    assert status == 200 and body == b'Hello World!'
    assert headers.get('access-control-allow-origin') == ORIGIN
    assert headers.get('access-control-allow-credentials') == 'true'
    protected, _, _ = request('GET', '/api/v1/auth/me')
    assert protected == 401
    options, headers, _ = request('OPTIONS', '/api/v1/auth/login', {
        'Origin': ORIGIN, 'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'authorization,content-type'})
    assert options == 204 and headers.get('access-control-allow-origin') == ORIGIN
    assert headers.get('access-control-allow-credentials') == 'true'
    boundary, _, _ = request('GET', '/api/v10')
    assert boundary == 404
    ports = {}
    for port in (443, 3000, 6379):
        try:
            with socket.create_connection((IP, port), timeout=3):
                ports[str(port)] = True
        except OSError:
            ports[str(port)] = False
    assert ports == {'443': True, '3000': False, '6379': False}
    result = {'schema_version': 1, 'status': 'verified_external_https_transport',
              'checked_at_utc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
              'api_url': 'https://' + IP + '/api/v1', 'root_http': 200, 'expected_body': True,
              'curl_default_configuration_disabled': True, 'insecure_TLS_flags_used': False,
              'standard_curl_TLS_verification': True, 'frontend_cors_exact': True, 'credentialed_cors': True,
              'login_preflight_http': 204, 'unauthenticated_me_http': 401, 'prefix_boundary_http': 404,
              'ports_reachable_from_pc': ports, 'google_login_performed': False, 'business_mutations_requested': False}
    output = Path('output/production/external-api-20261112-r01.json')
    output.write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8', newline='\n')
    print(json.dumps(result))


if __name__ == '__main__':
    main()
