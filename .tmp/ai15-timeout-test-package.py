import hashlib,json,tarfile
from pathlib import Path
base=Path('nodia-gemini-microservice');out=Path('.tmp/ai15-timeout-deploy/python-tests.tar.gz')
files=[base/'run_tests.py',*sorted((base/'tests').glob('*.py')),base/'tests/fixtures/nodia-ai-ai15-mcp-tools.json']
with tarfile.open(out,'w:gz') as archive:
 for p in files:archive.add(p,arcname=p.relative_to(base).as_posix(),recursive=False)
print(json.dumps({'test_support_files':len(files),'sha256':hashlib.sha256(out.read_bytes()).hexdigest()}))
