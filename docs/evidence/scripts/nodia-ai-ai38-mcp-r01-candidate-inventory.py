"""Hash public /app/*.py only; no inference, profile inspection or service changes."""
from datetime import datetime, timezone
import hashlib
import json
import subprocess

def checked(argv):
    result = subprocess.run(argv, capture_output=True, check=True, timeout=45)
    return result.stdout

container = json.loads(checked(['docker', 'inspect', 'nodia-gemini-microservice']))[0]
assert container['Image'] == 'sha256:0615520cd6d6682eddc08dd886d79952c80265fcf2e7814caa940b92ee8f27aa'
projection = "import hashlib,json,pathlib;print(json.dumps({p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in pathlib.Path('/app').glob('*.py') if p.is_file()},sort_keys=True))"
sources = json.loads(checked(['docker', 'exec', 'nodia-gemini-microservice', 'python', '-B', '-c', projection]))
assert sources and all(name.endswith('.py') and '/' not in name for name in sources)
print(json.dumps({'stage': 'AI-38-MCP-R01', 'scope': 'read_only_candidate_public_source_inventory',
                  'observed_at_utc': datetime.now(timezone.utc).isoformat(),
                  'container_id': container['Id'], 'base_image_id': container['Image'],
                  'container_started_at': container['State']['StartedAt'],
                  'public_source_hashes': sources, 'public_source_count': len(sources),
                  'provider_requests': 0, 'services_restarted': False,
                  'remote_files_written': False, 'operational_profile_contents_read': False}, indent=2))
