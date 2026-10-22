import hashlib,json,os,tarfile
from pathlib import Path
root=Path('/opt/nodia/releases/nodia-server-ai15-20261016');archive=Path('/tmp/server-final-metadata.tar.gz')
expected_sha='74c2d65b8f4a7d89e71dd7bd2265143cc466af5cf2f6b622e019bffe27ae1f59'
assert hashlib.sha256(archive.read_bytes()).hexdigest()==expected_sha
manifest=json.loads(Path('/tmp/server-final-metadata-manifest.json').read_text());assert manifest['kind']=='server'
expected={x['path']:x['sha256'] for x in manifest['files']};assert len(expected)==745
payloads={}
with tarfile.open(archive) as source:
 members=source.getmembers();assert len(members)==len(expected)
 for member in members:
  p=Path(member.name);assert member.isfile() and member.name in expected and not p.is_absolute() and '..' not in p.parts and member.size<=2*1024*1024
  content=source.extractfile(member).read();assert hashlib.sha256(content).hexdigest()==expected[member.name];payloads[member.name]=content
assert payloads['package-lock.json']==(root/'package-lock.json').read_bytes()
old=json.loads((root/'dist/nodia-ai/knowledge/manifest.json').read_text());new=json.loads(payloads['dist/nodia-ai/knowledge/manifest.json'])
assert old['capability_contracts']==new['capability_contracts'] and len(new['capability_contracts'])==67
pin=json.loads(payloads['dist/nodia-ai-context/config/knowledge-pin.json']);assert pin['release_id']=='5b27b4a3873037c8e850df90a801d84c561545414a8b27de415a3c8ab1f66c96'
fragments={k:v for k,v in payloads.items() if k.startswith('dist/nodia-ai/knowledge/fragments/')}
assert len(fragments)==27 and all((root/k).read_bytes()==v for k,v in fragments.items())
changed=[k for k,v in payloads.items() if k.startswith('dist/') and (not(root/k).exists() or (root/k).read_bytes()!=v)]
assert not any(k.endswith('.js') for k in changed),'Compiled executable code drift'
pending=root/'.pending-dist-5b27';assert not pending.exists();pending.mkdir(mode=0o750)
for name,content in payloads.items():
 if not name.startswith('dist/'):continue
 target=pending/Path(name).relative_to('dist');target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(content);target.chmod(0o640);os.chown(target,0,987)
for directory,_,_ in os.walk(pending):os.chmod(directory,0o750);os.chown(directory,0,987)
print(json.dumps({'prepared_pending_dist':str(pending),'archive_sha256':expected_sha,'archive_files':745,'capabilities':67,'fragments':27,'fragment_bytes_unchanged':True,'capability_contracts_unchanged':True,'compiled_js_unchanged':True,'changed_metadata_paths':changed,'knowledge_release':pin['release_id'],'services_restarted':False,'database_modified':False,'credentials_touched':False},indent=2))
