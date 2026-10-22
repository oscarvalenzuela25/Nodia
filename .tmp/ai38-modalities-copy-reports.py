"""Copy only frozen public cohort reports through a byte-preserving pipe."""
import base64
import hashlib
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]
SSH = [
    'ssh', '-i', 'C:/Users/Oscar/Documents/NodiaVMs/keys/nodia-vps-lab',
    '-o', 'UserKnownHostsFile=C:/Users/Oscar/Documents/NodiaVMs/keys/nodia-vps-lab-known_hosts',
    '-o', 'HostKeyAlias=nodia-vps-lab', '-o', 'StrictHostKeyChecking=yes',
    'operador@172.31.209.214', 'sudo', '-n', 'python3', '-',
]
CODE = r'''
import base64,hashlib,json
from pathlib import Path
names=['ai38-modalities-agentic-cohort-01','ai38-modalities-agentic-cohort-02']
names += ['ai38-modalities-agentic-'+kind+'-01' for kind in ('png','pdf','wav','webm')]
out={}
for name in names:
    path=Path('/opt/nodia/verification')/name/'public-report.json'
    if not path.is_file():
        continue
    raw=path.read_bytes()
    assert len(raw)<=262144
    value=json.loads(raw)
    assert value['status']!='running', 'Do not freeze in-flight evidence'
    out[name]={'sha256':hashlib.sha256(raw).hexdigest(),'bytes':base64.b64encode(raw).decode()}
print(json.dumps(out))
'''
result = subprocess.run(SSH, input=CODE.encode(), capture_output=True, check=True, timeout=30)
reports = json.loads(result.stdout)
copied = {}
for name, entry in reports.items():
    raw = base64.b64decode(entry['bytes'], validate=True)
    digest = hashlib.sha256(raw).hexdigest()
    assert digest == entry['sha256']
    target = ROOT / 'docs' / 'evidence' / ('nodia-ai-' + name + '.json')
    if target.exists():
        assert target.read_bytes() == raw, 'Never replace frozen evidence'
    else:
        target.write_bytes(raw)
    copied[target.name] = digest
print(json.dumps(copied, indent=2))
