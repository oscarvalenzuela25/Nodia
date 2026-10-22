"""Export only the listed public R05 receipts; never private descriptors, env or profiles."""
import os,tarfile,json,hashlib
from pathlib import Path
base=Path('/opt/nodia/verification')
items={
 'role-canary01':('runner-report.json',),
 'role-canary02':('runner-report.json','binding.json','selection.json','canary-report.json','original-ai15-report.json','canary-stdout.log','canary-stderr.log','activation-stdout.log','activation-stderr.log','restoration-stdout.log','restoration-stderr.log','restoration-modalities.json','restoration-modalities-stderr.log'),
 'role-activation':('report.json',),
 'binary-observation01':('report.json',),
 'role-restoration01':('report.json',),
 'cases-attempt01-finance/nodia-server/.tmp':('receipt.json','case-report.json','stdout.log','stderr.log'),
 'final01':('report.json','current-modalities.json','current-modalities-stderr.log')}
archive=Path('/tmp/nodia-ai-ai36-c05-r05-public-receipts01.tar')
assert not archive.exists()
manifest={}
with tarfile.open(archive,'x')as out:
 for directory,names in items.items():
  for name in names:
   file=base/('ai36-c05-r05-'+directory)/name
   if file.is_file():
    public='nodia-ai-ai36-c05-r05-'+directory.replace('/','-')+'-'+name
    out.add(file,arcname=public,recursive=False)
    manifest[public]=hashlib.sha256(file.read_bytes()).hexdigest()
os.chown(archive,1000,1000);os.chmod(archive,0o600)
print(json.dumps({'archive_sha256':hashlib.sha256(archive.read_bytes()).hexdigest(),'files':manifest,'private_descriptor_or_credentials_exported':False}))
