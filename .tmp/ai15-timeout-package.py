import hashlib,json,tarfile
from pathlib import Path
base=Path('nodia-gemini-microservice'); out=Path('.tmp/ai15-timeout-deploy');out.mkdir(exist_ok=True)
previous=json.loads(Path('nodia-server/.tmp/ai11-ai12-release/microservice-manifest.json').read_text())
names=sorted(set(x['path'] for x in previous['files'])|{'web_generation_diagnostics.py'})
assert len(names)==46
for name in names:
 p=Path(name); assert not p.is_absolute() and '..' not in p.parts and (base/p).is_file()
 assert not any(x in {'.env','agentic_profile','browser_profile','session_state'} for x in p.parts)
manifest={'kind':'microservice','files':[{'path':n,'sha256':hashlib.sha256((base/n).read_bytes()).hexdigest()} for n in names]}
(out/'microservice-manifest.json').write_text(json.dumps(manifest,indent=2))
with tarfile.open(out/'microservice.tar.gz','w:gz') as archive:
 for name in names:archive.add(base/name,arcname=name,recursive=False)
tests=sorted(base.joinpath('tests').glob('*.py'))
with tarfile.open(out/'python-tests.tar.gz','w:gz') as archive:
 archive.add(base/'run_tests.py',arcname='run_tests.py',recursive=False)
 for p in tests:archive.add(p,arcname='tests/'+p.name,recursive=False)
print(json.dumps({'source_files':len(names),'test_files':len(tests),'source_sha256':hashlib.sha256((out/'microservice.tar.gz').read_bytes()).hexdigest(),'tests_sha256':hashlib.sha256((out/'python-tests.tar.gz').read_bytes()).hexdigest(),'output':str(out)}))
