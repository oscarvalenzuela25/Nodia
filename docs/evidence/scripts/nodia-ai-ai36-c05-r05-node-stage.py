"""Extract the frozen public R05 Node packet and byte-identical live fixtures; no execution."""
import hashlib,json,os,tarfile
from pathlib import Path,PurePosixPath
os.umask(0o077)
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
archive=Path('/tmp/ai36-c05-r05-node-candidate01.tar')
assert sha(archive)=='569556945e8e65e71ea0ce0514f84c613dd5f256e55dbfb8d3536352980d68ce'
root=Path('/opt/nodia/verification/ai36-c05-r05-node-candidate01')
root.mkdir(mode=0o700,exist_ok=False)
with tarfile.open(archive) as packet:
 for m in packet.getmembers():
  n=PurePosixPath(m.name)
  assert not n.is_absolute() and '..' not in n.parts and not m.issym() and not m.islnk()
  assert m.isfile() and n.parts[0] in ('dist','public-source','manifest.json','baseline-dist-manifest.json','package.json','package-lock.json')
 packet.extractall(root,filter='data')
manifest_path=root/'manifest.json'
assert sha(manifest_path)=='662ec8ad7076b8b7cf41c16b52c9d8e32b617076fefeaba7bb8c2b85b1796ea7'
m=json.loads(manifest_path.read_text())
assert len(m['files'])==2803 and all(n.startswith('dist/') and sha(root/n)==h for n,h in m['files'].items())
assert len(list((root/'dist').rglob('*.*')))==2803
for item in m['package_metadata']:
 assert sha(root/Path(item['path']).name)==item['sha256']
for item in m['production_sources']+m['test_sources']:
 assert sha(root/'public-source'/item['path'].removeprefix('nodia-server/'))==item['sha256']
fixtures=Path('/tmp/ai36-c05-cases-live-stage.tar')
assert sha(fixtures)=='aeacdfd1041dea130dc9213a71f30686f9b24165f603c48b1a6f4412a5bb75f3'
with tarfile.open(fixtures) as packet:
 old=json.load(packet.extractfile('.tmp/ai36-c05-cases-live-stage-manifest.json'))
 files={n:h for n,h in old['files'].items() if n.startswith('test/')}
 for n,h in files.items():
  member=packet.getmember(n)
  assert member.isfile() and not member.issym() and not member.islnk() and '..' not in PurePosixPath(n).parts
  target=root/n;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(packet.extractfile(member).read())
  assert sha(target)==h
assert files['test/nodia-ai-ai36-c05-live.integration.mjs']=='7cc5b68b634047fc35cf953ebfd7ad55c7d62f33b01995c93dd58b56fcd42539'
assert files['test/nodia-ai-ai36-c05-independent-cases.fixture.mjs']=='01e9d5a003e84af302700c7ff3f81011a7ab3424feefc35ce4c7e7c3c5606b2a'
(root/'frozen-test-manifest.json').write_text(json.dumps(files,indent=2)+'\n')
assert not(root/'.env').exists()
print(json.dumps({'stage':'AI-36-C05-R05','status':'passed','compiled_root':str(root),'dist_files':2803,'test_files':len(files),'manifest_sha256':sha(manifest_path),'archive_sha256':sha(archive),'provider_generations':0,'services_restarted':False}))
