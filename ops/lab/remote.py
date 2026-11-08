"""Root orchestration: exact stdout capture, no private stderr emission."""
import argparse
from pathlib import Path
import hashlib
import json
import ipaddress
import subprocess

p = argparse.ArgumentParser()
p.add_argument('--command', required=True)
p.add_argument('--output')
p.add_argument('--input')
p.add_argument('--timeout', type=int, default=180)
p.add_argument('--host', default='172.31.209.214')
a = p.parse_args()
host = ipaddress.IPv4Address(a.host)
if not host.is_private or host.is_loopback or host.is_link_local or host.is_multicast or host.is_unspecified:
    p.error('--host must be the observed private VM IPv4 address')
ssh = ['ssh', '-i', 'C:/Users/Oscar/Documents/NodiaVMs/keys/nodia-vps-lab',
       '-o', 'UserKnownHostsFile=C:/Users/Oscar/Documents/NodiaVMs/keys/nodia-vps-lab-known_hosts',
       '-o', 'HostKeyAlias=nodia-vps-lab', '-o', 'BatchMode=yes',
       '-o', 'StrictHostKeyChecking=yes', 'operador@' + str(host)]
r = subprocess.run([*ssh, a.command], input=Path(a.input).read_bytes() if a.input else None,
                   capture_output=True, timeout=a.timeout)
if a.output:
    output = Path(a.output)
    with output.open('xb') as stream:
        stream.write(r.stdout)
    print(json.dumps({'exit': r.returncode, 'path': str(output),
                      'sha256': hashlib.sha256(r.stdout).hexdigest(),
                      'stdout_bytes': len(r.stdout), 'private_stderr_emitted': False}))
else:
    print(r.stdout.decode('utf-8'), end='')
    print(json.dumps({'exit': r.returncode, 'private_stderr_emitted': False}))
raise SystemExit(r.returncode)
