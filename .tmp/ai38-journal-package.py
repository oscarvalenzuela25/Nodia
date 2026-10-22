from pathlib import Path
import json,hashlib,tarfile,io
root=Path('.').resolve(); server=root/'nodia-server'
files={}
for folder in ['dist','src','scripts','config']:
 for p in (server/folder).rglob('*'):
  if p.is_symlink(): raise RuntimeError('source_symlink')
  if p.is_file() and not p.name.endswith('.spec.ts'):
   files[p.relative_to(server).as_posix()]=p
for name in ['package.json','package-lock.json']:
 files[name]=server/name
for name in ['nodia-ai.integration.fixture.mjs','nodia-ai-ai38-journal.integration.mjs']:
 files['test/'+name]=server/'test'/name
for p in (root/'ops/nodia-ai-backups').iterdir():
 if p.is_file(): files['ops/nodia-ai-backups/'+p.name]=p
manifest={'schema_version':1,'stage':'AI-38','files':{name:hashlib.sha256(p.read_bytes()).hexdigest() for name,p in sorted(files.items())},'knowledge_release':'4189005373b4e6040a0e441d21c2978fe1d423ae568e53f74df1592e6f900130','deployment_performed':False,'release_authorized':False}
body=json.dumps(manifest,sort_keys=True,indent=2).encode()
man=Path('docs/evidence/nodia-ai-ai38-journal-package-r01.json')
with man.open('xb') as f:f.write(body)
archive=Path('.tmp/ai38-journal-r01.tar.gz')
with tarfile.open(archive,'x:gz') as tar:
 for name,p in sorted(files.items()):tar.add(p,arcname=name,recursive=False)
 info=tarfile.TarInfo('release-manifest.json');info.size=len(body);info.mode=0o644
 tar.addfile(info,io.BytesIO(body))
transfer={'archive_sha256':hashlib.sha256(archive.read_bytes()).hexdigest(),'manifest_sha256':hashlib.sha256(body).hexdigest()}
with Path('.tmp/ai38-journal-package-transfer.json').open('x') as f:json.dump(transfer,f)
print(json.dumps({'files':len(files),'dist_outputs':sum(n.startswith('dist/') for n in files),**transfer}))
