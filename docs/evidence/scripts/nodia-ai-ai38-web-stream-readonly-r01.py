"""Read-only public SDK inventory and bounded runtime status, no inference."""
from datetime import datetime, timezone
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import subprocess


def run(argv):
    result = subprocess.run(argv, check=True, capture_output=True, timeout=40)
    return result.stdout


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def epoch():
    info = json.loads(run(['docker', 'inspect', 'nodia-gemini-microservice']))[0]
    return dict(id=info['Id'], image=info['Image'], started_at=info['State']['StartedAt'],
                running=info['State']['Running'], configured_user=info['Config']['User'])


def main():
    assert os.geteuid() == 0 and not os.sys.flags.optimize
    before = epoch()
    public_program = r'''
import hashlib, importlib.metadata, json
from pathlib import Path
dist = importlib.metadata.distribution('gemini-webapi')
root = Path(dist.locate_file('gemini_webapi'))
hashes = {p.relative_to(root).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest()
          for p in root.rglob('*.py') if p.is_file() and not p.is_symlink()}
sections = {'client.py': [(1815,1888),(1377,1388)],
            'utils/parsing.py': [(134,245)], 'utils/__init__.py': [(1,40)]}
excerpts = {}
for name, ranges in sections.items():
    lines = (root / name).read_text().splitlines()
    excerpts[name] = [{'line': n, 'source': lines[n-1]} for start,end in ranges
                      for n in range(start,min(end,len(lines))+1)]
print(json.dumps(dict(version=dist.version, package_python_hashes=hashes,
    package_python_count=len(hashes), curl_cffi_version=importlib.metadata.version('curl-cffi'),
    public_source_excerpts=excerpts, application_modules_imported=False,
    operational_session_bytes_opened=False)))
'''
    public = json.loads(run(['docker', 'exec', '--user', '10001:10001',
        'nodia-gemini-microservice', 'python', '-B', '-c', public_program]))
    helper = Path('/tmp/nodia-ai-ai38-journal-activate.py')
    assert sha(helper) == '56fb7fc00dd4e741e924cef6eee69527543aab4407adeed776a5cfb08aff016b'
    spec = importlib.util.spec_from_file_location('pinned_web_readonly', helper)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    module.RELEASE = Path('/opt/nodia/releases/nodia-server-ai38-owner-r01')
    _, helpers = module.load_helpers()
    quiet = helpers['quiet']()
    consumers = module.active_new_processes()
    after = epoch()
    assert before == after
    return dict(schema='ai38-web-stream-readonly-v1', status='observed_read_only',
        observed_at_VM_utc=datetime.now(timezone.utc).isoformat(), Gemini=before,
        same_epoch_after_inventory=True, SDK=public, quiet=quiet, consumers=consumers,
        provider_generation_requests=0, service_changes=0, configured_SQL_writes=0,
        operational_profile_or_login_bytes_opened=False, raw_provider_responses_opened=False)


if __name__ == '__main__':
    try:
        print(json.dumps(main(), indent=2))
    except Exception:
        print(json.dumps({'schema': 'ai38-web-stream-readonly-v1',
                          'status': 'failed_observation', 'raw_details_emitted': False}))
        raise SystemExit(1)
