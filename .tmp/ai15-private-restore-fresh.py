import json,subprocess,uuid,sys
from pathlib import Path
base=Path(sys.argv[1])
assert base.resolve()==base and not base.is_symlink() and base.parent==Path('/opt/nodia/verification-backups') and base.name.startswith('ai15-before-publication-')
name='ai15_backup_verify_'+uuid.uuid4().hex[:12]
assert name.startswith('ai15_backup_verify_') and len(name)==31
runner=['docker','exec','nodia-lab-postgres-1','sh','-c']
def sql(command):
 return subprocess.run(runner+['exec psql -U "$POSTGRES_USER" -d postgres -v ON_ERROR_STOP=1 -q -c "$1"','sh',command],check=True,stdout=subprocess.PIPE)
created=False
try:
 sql('CREATE DATABASE '+name);created=True
 with (base/'nodia_lab.dump').open('rb') as source:
  subprocess.run(['docker','exec','-i','nodia-lab-postgres-1','sh','-c','exec pg_restore -U "$POSTGRES_USER" -d "$1" --no-owner --no-acl --exit-on-error','sh',name],stdin=source,check=True)
 result=subprocess.run(runner+['exec psql -U "$POSTGRES_USER" -d "$1" -At -v ON_ERROR_STOP=1 -c "SELECT count(*) FROM public.migrations"','sh',name],stdout=subprocess.PIPE,check=True)
 assert result.stdout.strip()==b'18'
 report=json.loads((base/'backup-manifest.json').read_text());report.update(restore_executed=True,restore_disposable_database=True,restored_migration_rows=18)
finally:
 if created:sql('DROP DATABASE '+name)
report['restore_database_cleaned']=True
(base/'backup-manifest.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))

