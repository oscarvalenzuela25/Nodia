import hashlib,json,os,subprocess,time
from pathlib import Path
api_env={line.split('=',1)[0]:line.split('=',1)[1].strip().strip(chr(34)).strip(chr(39)) for line in Path('/opt/nodia/nodia-server/.env').read_text().splitlines() if line and not line.startswith('#') and '=' in line}
stamp=time.strftime('%Y%m%dT%H%M%SZ',time.gmtime())
base=Path('/opt/nodia/verification-backups')/('ai15-before-publication-'+stamp)
base.mkdir(mode=0o700,parents=True)
target=base/'nodia_lab.dump'
fd=os.open(target,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
with os.fdopen(fd,'wb') as output:
 subprocess.run(['docker','exec','nodia-lab-postgres-1','sh','-c','exec pg_dump -U "$POSTGRES_USER" -d "$1" -Fc --no-owner --no-acl','sh',api_env['POSTGRES_DB']],stdout=output,check=True)
listing=subprocess.run(['docker','exec','-i','nodia-lab-postgres-1','pg_restore','--list'],stdin=target.open('rb'),stdout=subprocess.PIPE,check=True)
checksum=hashlib.sha256(target.read_bytes()).hexdigest()
report={'checked_at':stamp,'backup_path':str(target),'format':'pg_dump_custom','bytes':target.stat().st_size,'mode':oct(target.stat().st_mode&0o777),'sha256':checksum,'catalog_list_verified':b'TABLE DATA' in listing.stdout,'outside_repo':True,'restore_executed':False}
(base/'backup-manifest.json').write_text(json.dumps(report,indent=2)+'\n')
os.chmod(base/'backup-manifest.json',0o600)
print(json.dumps(report,indent=2))

