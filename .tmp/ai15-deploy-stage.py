import hashlib,json,os,tarfile,time
from pathlib import Path
root=Path('/home/operador/nodia-ai-verification/server')
assert root.resolve()==root and not root.is_symlink()
manifest=json.loads(Path('/tmp/server-manifest.json').read_text());assert manifest['kind']=='server'
expected={x['path']:x['sha256'] for x in manifest['files']}
assert len(expected)==718
backup=Path('/home/operador/nodia-ai-verification')/('ai15-stage-backup-'+str(int(time.time())))
backup.mkdir(mode=0o700)
with tarfile.open(backup/'stage-source.tar.gz','w:gz') as saved:
 for entry in ['dist','test','scripts','package.json','package-lock.json']:
  if (root/entry).exists():saved.add(root/entry,arcname=entry)
with tarfile.open('/tmp/server.tar.gz') as archive:
 members=archive.getmembers();assert len(members)==len(expected)
 for member in members:
  p=Path(member.name)
  assert member.isfile() and not p.is_absolute() and '..' not in p.parts and member.name in expected
  assert p.parts[0] in {'dist','test','scripts'} or member.name in {'package.json','package-lock.json'}
  assert not any(part in {'.env','node_modules','browser_profile','session_state','agentic_profile'} for part in p.parts)
  content=archive.extractfile(member).read();assert hashlib.sha256(content).hexdigest()==expected[member.name]
  target=root/p;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(content);target.chmod(0o644)
stage=root/'.tmp/ai15-publication-stage';assert stage.resolve()==stage and not stage.is_symlink();stage.mkdir(parents=True,mode=0o700,exist_ok=True)
with tarfile.open('/tmp/ai15-knowledge-stage.tar.gz') as archive:
 for member in archive.getmembers():
  p=Path(member.name);assert not p.is_absolute() and '..' not in p.parts
  assert member.isdir() or member.isfile()
  assert p.parts[0] in {'bundle','knowledge-runtime.json','knowledge-schema.json'}
  target=stage/p
  if member.isdir():target.mkdir(parents=True,exist_ok=True)
  else:target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(archive.extractfile(member).read())
print(json.dumps({'files_updated':len(expected),'backup':str(backup),'private_stage':str(stage),'env_files_written':0,'profiles_written':0}))



