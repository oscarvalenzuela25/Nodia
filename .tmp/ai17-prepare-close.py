import hashlib,json,os,sys,tarfile
from pathlib import Path
base=Path('/tmp/nodia-ai17-20261016'); archive=base/'server.tar.gz'
expected=sys.argv[1]
assert len(expected)==64 and hashlib.sha256(archive.read_bytes()).hexdigest()==expected
manifest=json.loads((base/'server-manifest.json').read_text()); files={x['path']:x['sha256'] for x in manifest['files']}
assert manifest['kind']=='server' and len(files)==len(manifest['files'])
target=Path('/opt/nodia/verification/ai17-20261016-close'); target.mkdir(parents=True,exist_ok=False)
with tarfile.open(archive) as bundle:
 members=bundle.getmembers(); assert len(members)==len(files)
 for member in members:
  p=Path(member.name)
  assert member.isfile() and member.name in files and not p.is_absolute() and '..' not in p.parts and member.size<2*1024*1024
  assert p.parts[0] in {'dist','test','scripts'} or member.name in {'package.json','package-lock.json'}
  assert not any(part in {'.env','node_modules','browser_profile','agentic_profile','session_state'} for part in p.parts)
  data=bundle.extractfile(member).read(); assert hashlib.sha256(data).hexdigest()==files[member.name]
  dest=target/p;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(data);dest.chmod(0o640)
runtime=Path('/opt/nodia/releases/nodia-server-ai15-20261016')
old=json.loads((runtime/'package.json').read_text());new=json.loads((target/'package.json').read_text())
assert old['dependencies']==new['dependencies'] and old['devDependencies']==new['devDependencies']
testing_dependencies=Path('/opt/nodia/nodia-server/node_modules')
for name in ['@nestjs/common','@nestjs/core','@nestjs/typeorm','typeorm']:
 assert json.loads((testing_dependencies/name/'package.json').read_text())['version']==json.loads((runtime/'node_modules'/name/'package.json').read_text())['version']
(target/'node_modules').symlink_to(testing_dependencies,target_is_directory=True)
pin=json.loads((target/'dist/nodia-ai-context/config/knowledge-pin.json').read_text())
assert pin['release_id']=='5b27b4a3873037c8e850df90a801d84c561545414a8b27de415a3c8ab1f66c96'
knowledge=json.loads((target/'dist/nodia-ai/knowledge/manifest.json').read_text())
assert len(knowledge['capability_contracts'])==67 and len(knowledge['fragments'])==27
print(json.dumps({'prepared':str(target),'archive_sha256':expected,'files':len(files),'dependencies_unchanged':True,'knowledge_pin':pin['release_id'],'configured_services_unchanged':True,'configured_database_used':False}))



