import hashlib,json,os,tarfile
from pathlib import Path
root=Path('/opt/nodia/releases/nodia-server-ai15-20261016');archive=Path('/tmp/ai15-timeout-deploy/server.tar.gz');manifest_path=Path('/tmp/ai15-timeout-deploy/server-manifest.json')
sha='dc867fc4434a6f8ef91d776ab3237e3527ca36eb5621eb5e95243b21b45ae537';assert hashlib.sha256(archive.read_bytes()).hexdigest()==sha
manifest=json.loads(manifest_path.read_text());assert manifest['kind']=='server';expected={v['path']:v['sha256'] for v in manifest['files']};assert len(expected)==len(manifest['files'])==746
payloads={}
with tarfile.open(archive) as source:
 members=source.getmembers();assert len(members)==len(expected)
 for member in members:
  p=Path(member.name);assert member.isfile() and member.name in expected and not p.is_absolute() and '..' not in p.parts and member.size<=2*1024*1024
  assert p.parts[0] in {'dist','test','scripts'} or member.name in {'package.json','package-lock.json'}
  assert not any(x in {'.env','node_modules','browser_profile','agentic_profile','session_state'} for x in p.parts)
  content=source.extractfile(member).read();assert hashlib.sha256(content).hexdigest()==expected[member.name];payloads[member.name]=content
for name in ['package.json','package-lock.json']:assert payloads[name]==(root/name).read_bytes()
pinpath='dist/nodia-ai-context/config/knowledge-pin.json';assert payloads[pinpath]==(root/pinpath).read_bytes();pin=json.loads(payloads[pinpath]);assert pin['release_id']=='5b27b4a3873037c8e850df90a801d84c561545414a8b27de415a3c8ab1f66c96'
mp='dist/nodia-ai/knowledge/manifest.json';assert payloads[mp]==(root/mp).read_bytes();knowledge=json.loads(payloads[mp]);assert len(knowledge['capability_contracts'])==67
fragments={k:v for k,v in payloads.items() if k.startswith('dist/nodia-ai/knowledge/fragments/')};assert len(fragments)==27 and all((root/k).read_bytes()==v for k,v in fragments.items())
changed={k for k,v in payloads.items() if k.startswith('dist/') and (not(root/k).exists() or (root/k).read_bytes()!=v)}
allowed={'dist/nodia-ai-runtime/types/nodia-ai-failure-diagnostic.js','dist/nodia-ai-runtime/use-case/run-nodia-ai-stage.use-case.js','dist/nodia-ai-tools/use-case/execute-nodia-ai-tool.use-case.js'};assert changed==allowed,sorted(changed)
removed={p.relative_to(root).as_posix() for p in (root/'dist').rglob('*') if p.is_file()}-{k for k in payloads if k.startswith('dist/')};assert not removed,sorted(removed)
pending=root/'.pending-dist-timeout-diagnostic';assert not pending.exists();pending.mkdir(mode=0o750)
for name,content in payloads.items():
 if not name.startswith('dist/'):continue
 target=pending/Path(name).relative_to('dist');target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(content);target.chmod(0o640);os.chown(target,0,987)
for directory,_,_ in os.walk(pending):os.chmod(directory,0o750);os.chown(directory,0,987)
report={'prepared_dist':str(pending),'archive_sha256':sha,'files':746,'changed_js':sorted(changed),'removed_files':0,'capabilities':67,'fragments':27,'pin':pin['release_id'],'pin_bytes_unchanged':True,'knowledge_manifest_bytes_unchanged':True,'fragment_bytes_unchanged':True,'dependencies_unchanged':True,'services_restarted':False,'database_modified':False}
Path('/tmp/ai15-timeout-deploy/server-preparation.json').write_text(json.dumps(report,indent=2));print(json.dumps(report))

