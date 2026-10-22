import hashlib,json,os,subprocess
from pathlib import Path
root=Path('/opt/nodia/releases/nodia-server-ai15-20261016');current=root/'dist';pending=root/'.pending-dist-5b27'
assert root.resolve()==root and current.resolve()==current and pending.resolve()==pending
for unit in ('nodia-api','nodia-ai-worker'):
 state=subprocess.run(['systemctl','is-active',unit],stdout=subprocess.PIPE,text=True).stdout.strip();assert state=='inactive'
credential=root/'.env';before=(hashlib.sha256(credential.read_bytes()).digest(),credential.stat().st_uid,credential.stat().st_gid,credential.stat().st_mode)
pin=json.loads((pending/'nodia-ai-context/config/knowledge-pin.json').read_text());assert pin['release_id']=='5b27b4a3873037c8e850df90a801d84c561545414a8b27de415a3c8ab1f66c96'
old=json.loads((current/'nodia-ai/knowledge/manifest.json').read_text());new=json.loads((pending/'nodia-ai/knowledge/manifest.json').read_text());assert old['capability_contracts']==new['capability_contracts'] and len(new['capability_contracts'])==67
backup=Path('/opt/nodia/verification-backups/ai15-metadata-5b27');backup.mkdir(mode=0o700);saved=backup/'dist-997234';assert not saved.exists()
os.rename(current,saved)
try:os.rename(pending,current)
except BaseException:os.rename(saved,current);raise
assert before==(hashlib.sha256(credential.read_bytes()).digest(),credential.stat().st_uid,credential.stat().st_gid,credential.stat().st_mode)
print(json.dumps({'metadata_release':pin['release_id'],'previous_dist_backup':str(saved),'capabilities':67,'fragments':len(list((current/'nodia-ai/knowledge/fragments').glob('*.md'))),'environment_bytes_owner_mode_preserved':True,'database_modified_by_swap':False,'bridge_restarted':False,'dependencies_modified':False},indent=2))
