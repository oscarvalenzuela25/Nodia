"""Prepare exclusive disposable SQL/real-R2 fixture without touching runtime package."""
from pathlib import Path
import hashlib, json, os, shutil, uuid
root=Path('/opt/nodia/releases/nodia-server-ai38-journal-r01')
work=Path('/opt/nodia/verification/ai38-journal-combined')
assert os.geteuid()==0 and not work.exists()
assert hashlib.sha256((root/'release-manifest.json').read_bytes()).hexdigest()=='fb4c52fc19c82a9cdb0aa610e7b0a5d3b97641de78980cb76900381cad6bc3d0'
source=Path('/tmp/nodia-ai-ai38-journal-combined.integration.mjs')
assert hashlib.sha256(source.read_bytes()).hexdigest()=='3c0ee44ea78db744a71ac434f1c3a8519cb0c39682f45159c30448e4a49f65e0'
work.mkdir(mode=0o700); (work/'test').mkdir(mode=0o700)
shutil.copyfile(source,work/'test'/source.name)
shutil.copyfile(root/'test/nodia-ai.integration.fixture.mjs',work/'test/nodia-ai.integration.fixture.mjs')
(work/'dist').symlink_to(root/'dist',target_is_directory=True)
(work/'node_modules').symlink_to('/opt/nodia/nodia-server/node_modules',target_is_directory=True)
config=json.loads(Path('/etc/nodia-ai-recovery/recovery.json').read_bytes())
config['deployment_id']='ai38-combined-r01';config['era_id']=str(uuid.uuid4())
fd=os.open(work/'config.private.json',os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
with os.fdopen(fd,'w') as f: json.dump(config,f)
print(json.dumps({'status':'exclusive_combined_fixture_staged','runtime_package_modified':False,'secrets_emitted':False}))
