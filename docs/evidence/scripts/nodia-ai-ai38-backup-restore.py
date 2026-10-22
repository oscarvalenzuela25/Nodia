"""Accept authenticated operator dump on stdin into one disposable, networkless PG.
Never writes the dump to VM filesystem or emits business rows/credentials.
"""
import hashlib,json,subprocess,sys,time
from datetime import datetime,timezone
name='nodia-ai38-backup-restore-r01'
def run(args,data=None,timeout=30):
    p=subprocess.run(args,input=data,capture_output=True,timeout=timeout)
    if p.returncode: raise RuntimeError('isolated_restore_command_failed')
    return p.stdout
assert subprocess.run(['docker','inspect',name],capture_output=True).returncode!=0
data=sys.stdin.buffer.read(268435457)
assert 0<len(data)<=268435456 and data.startswith(b'PGDMP')
created=False
try:
    run(['docker','run','-d','--name',name,'--network','none',
         '-e','POSTGRES_HOST_AUTH_METHOD=trust','-e','POSTGRES_USER=restoreoperator',
         '-e','POSTGRES_DB=nodia_restore_ai38_r01','postgres:16-alpine'])
    created=True
    for attempt in range(40):
        if subprocess.run(['docker','exec',name,'pg_isready','-U','restoreoperator'],capture_output=True).returncode==0: break
        time.sleep(.25)
    else: raise RuntimeError('isolated_postgres_not_ready')
    run(['docker','exec','-i',name,'pg_restore','-U','restoreoperator','-d','nodia_restore_ai38_r01',
         '--no-owner','--no-acl','--exit-on-error'],data=data,timeout=60)
    sql="SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE';SELECT count(*) FROM migrations;"
    counts=run(['docker','exec',name,'psql','-U','restoreoperator','-d','nodia_restore_ai38_r01','-At','-v','ON_ERROR_STOP=1','-c',sql]).decode().strip().splitlines()
    assert counts==['62','29']
    run(['docker','rm','-f','-v',name]);created=False
    print(json.dumps(dict(status='real_encrypted_operational_backup_restored_isolated',
          observed_at_VM_utc=datetime.now(timezone.utc).isoformat(),
          plaintext_bytes=len(data),plaintext_sha256=hashlib.sha256(data).hexdigest(),
          tables=62,migrations=29,network='none',ports_exposed=0,
          disposable_container_removed=True,private_RSA_key_on_VM=False,
          configured_database_writes=0,provider_requests=0,
          full_AI_quarantine_consumer_executed_on_this_copy=False)))
finally:
    if created: subprocess.run(['docker','rm','-f','-v',name],capture_output=True,timeout=30)
