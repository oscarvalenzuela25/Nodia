import hashlib,json,subprocess,tarfile
from pathlib import Path
root=Path.cwd(); micro=root/'nodia-gemini-microservice'; archive=root/'.tmp/ai29-r01-web-diagnostics-offline.tar.gz'
manifest=json.loads((root/'nodia-server/.tmp/ai11-ai12-release/microservice-manifest.json').read_text())
paths=[Path(item['path']) for item in manifest['files']]
paths += [p.relative_to(micro) for p in (micro/'tests').rglob('*') if p.is_file() and p.suffix in ('.py','.json')]
paths=sorted(set(paths)); hashes=[]
with tarfile.open(archive,'w:gz') as tf:
 for relative in paths:
  source=micro/relative
  if source.is_symlink() or not source.is_file() or not source.resolve().is_relative_to(micro.resolve()): raise RuntimeError('invalid source path')
  tf.add(source,arcname=relative.as_posix(),recursive=False)
  hashes.append({'path':relative.as_posix(),'sha256':hashlib.sha256(source.read_bytes()).hexdigest()})
(root/'.tmp/ai29-r01-web-diagnostics-offline-manifest.json').write_text(json.dumps({'files':hashes},indent=2)+'\n')
opts=['-i','C:/Users/Oscar/Documents/NodiaVMs/keys/nodia-vps-lab','-o','UserKnownHostsFile=C:/Users/Oscar/Documents/NodiaVMs/keys/nodia-vps-lab-known_hosts','-o','HostKeyAlias=nodia-vps-lab','-o','StrictHostKeyChecking=yes'];host='operador@172.31.209.214'
subprocess.run(['ssh',*opts,host,'mkdir -p /tmp/ai29-r01-native-offline-diagnostics'],check=True)
subprocess.run(['scp',*opts,str(archive),host+':/tmp/ai29-r01-native-offline-diagnostics/sources.tar.gz'],check=True)
print(json.dumps({'files':len(paths),'archive_sha256':hashlib.sha256(archive.read_bytes()).hexdigest()}))
