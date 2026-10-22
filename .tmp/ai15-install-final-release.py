import hashlib,json,os,stat,subprocess,tarfile
from pathlib import Path
root=Path('/opt/nodia/releases/nodia-server-ai15-20261016')
assert root.resolve()==root and not root.is_symlink()
archive=Path('/tmp/server.tar.gz')
assert hashlib.sha256(archive.read_bytes()).hexdigest()=='accbf835b1cfcef16044e7eb95b01ceb08301fa0d746cc0a170cddfc0517653f'
manifest=json.loads(Path('/tmp/server-manifest.json').read_text());assert manifest['kind']=='server'
expected={x['path']:x['sha256'] for x in manifest['files']};assert len(expected)==745
credential=root/'.env';before=(hashlib.sha256(credential.read_bytes()).digest(),credential.stat().st_uid,credential.stat().st_gid,credential.stat().st_mode)
assert credential.stat().st_uid==10000 and stat.S_IMODE(credential.stat().st_mode)==0o600
active_dir=subprocess.check_output(['systemctl','show','nodia-api','--property=WorkingDirectory','--value'],text=True).strip()
active_state=subprocess.run(['systemctl','is-active','nodia-api'],stdout=subprocess.PIPE,text=True).stdout.strip()
assert not (active_dir==str(root) and active_state=='active'),'Stop active target before code replacement'
payloads={}
with tarfile.open(archive) as source:
 members=source.getmembers();assert len(members)==len(expected)
 for member in members:
  p=Path(member.name)
  assert member.isfile() and member.name in expected and not p.is_absolute() and '..' not in p.parts and member.size<=2*1024*1024
  assert p.parts[0] in {'dist','test','scripts'} or member.name in {'package.json','package-lock.json'}
  assert not any(part in {'.env','node_modules','browser_profile','session_state','agentic_profile'} for part in p.parts)
  content=source.extractfile(member).read();assert hashlib.sha256(content).hexdigest()==expected[member.name]
  payloads[member.name]=content
assert payloads['package-lock.json']==(root/'package-lock.json').read_bytes(),'Dependency lock drift'
knowledge=json.loads(payloads['dist/nodia-ai/knowledge/manifest.json']);pin=json.loads(payloads['dist/nodia-ai-context/config/knowledge-pin.json'])
assert len(knowledge['capability_contracts'])==67
assert len([name for name in payloads if name.startswith('dist/nodia-ai/knowledge/fragments/') and name.endswith('.md')])==27
assert pin['release_id']=='997234d07d7dd237fbb2d6f135c617f524c8a4fb4506bad6ea7f9c44608c4dee'
assert not (root/'dist').exists(),'Initial release must not contain an old dist tree'
installed=0
for name,content in payloads.items():
 if name.startswith('test/'):continue
 destination=root/name;destination.parent.mkdir(parents=True,exist_ok=True)
 assert not destination.is_symlink()
 destination.write_bytes(content);destination.chmod(0o644);installed+=1
for directory,dirs,files in os.walk(root,followlinks=False):
 os.chown(directory,0,987)
 for name in dirs+files:
  path=Path(directory)/name
  if path==credential:continue
  os.chown(path,0,987,follow_symlinks=False)
assert before==(hashlib.sha256(credential.read_bytes()).digest(),credential.stat().st_uid,credential.stat().st_gid,credential.stat().st_mode)
print(json.dumps({'release':str(root),'archive_sha256':hashlib.sha256(archive.read_bytes()).hexdigest(),'archive_verified_files':len(payloads),'installed_runtime_files':installed,'capabilities':67,'fragments':27,'knowledge_release':pin['release_id'],'dependencies_unchanged':True,'credential_bytes_owner_mode_preserved':True,'code_owner':'root:nodia','activated':False},indent=2))
