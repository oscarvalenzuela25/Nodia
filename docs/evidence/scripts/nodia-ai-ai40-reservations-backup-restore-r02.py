"""Restore authenticated fresh dump from stdin only into one networkless disposable PG.
First stdin line is a public closed descriptor; remaining bytes are the dump.
"""
import hashlib,json,re,subprocess,sys,time
from datetime import datetime,timezone
name='nodia-ai40-reservations-restore-r01'
def run(args,data=None,timeout=30):
 p=subprocess.run(args,input=data,capture_output=True,timeout=timeout)
 if p.returncode:raise RuntimeError('isolated_restore_command_failed')
 return p.stdout
header=sys.stdin.buffer.readline(16385);assert len(header)<=16384 and header.endswith(b'\n')
v=json.loads(header);assert set(v)=={'schema_version','backup_id','plain_bytes','plain_sha256','expected_image_id','restore_oracle'}and v['schema_version']==1
assert re.fullmatch('[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}',v['backup_id'])and re.fullmatch('[a-f0-9]{64}',v['plain_sha256'])and re.fullmatch('sha256:[a-f0-9]{64}',v['expected_image_id'])
assert type(v['plain_bytes'])is int and 0<v['plain_bytes']<=268435456
image=json.loads(run(['docker','image','inspect','postgres:16-alpine','--format','{{json .Id}}']).decode());assert image==v['expected_image_id']
assert subprocess.run(['docker','inspect',name],capture_output=True).returncode!=0
body=sys.stdin.buffer.read(v['plain_bytes']+1);assert len(body)==v['plain_bytes']and body.startswith(b'PGDMP')and hashlib.sha256(body).hexdigest()==v['plain_sha256']
created_id=None
try:
 created_id=run(['docker','run','--pull','never','-d','--name',name,'--network','none','-e','POSTGRES_HOST_AUTH_METHOD=trust','-e','POSTGRES_USER=restoreoperator','-e','POSTGRES_DB=nodia_restore_ai40',image]).decode().strip();assert re.fullmatch('[a-f0-9]{64}',created_id)
 inspect=json.loads(run(['docker','inspect',created_id]))[0];assert inspect['Id']==created_id and inspect['Name']=='/'+name and inspect['Image']==image and inspect['HostConfig']['NetworkMode']=='none'and not inspect['HostConfig']['PortBindings']and not inspect['HostConfig']['Binds']
 for _ in range(40):
  if subprocess.run(['docker','exec',created_id,'pg_isready','-U','restoreoperator'],capture_output=True).returncode==0:break
  time.sleep(.25)
 else:raise RuntimeError('isolated_postgres_not_ready')
 run(['docker','exec','-i',created_id,'pg_restore','-U','restoreoperator','-d','nodia_restore_ai40','--no-owner','--no-acl','--exit-on-error'],data=body,timeout=80)
 query="""SELECT row_to_json(c) FROM(SELECT
 (SELECT count(*)::integer FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE') tables,
 (SELECT count(*)::integer FROM migrations) migrations,
 (SELECT count(*)::integer FROM modules) modules,
 (SELECT count(*)::integer FROM module_groups) module_groups,
 (SELECT count(*)::integer FROM modules WHERE link='/tools/reservations') reservations_modules,
 (SELECT count(*)::integer FROM nodia_ai_messages) messages,
 (SELECT count(*)::integer FROM nodia_ai_runs) runs,
 (SELECT COALESCE(sum(provider_dispatches_used),0)::integer FROM nodia_ai_runs) dispatches,
 (SELECT count(*)::integer FROM nodia_ai_attachments) attachments,
 (SELECT count(*)::integer FROM nodia_ai_executions) executions,
 (SELECT count(*)::integer FROM nodia_ai_execution_steps WHERE minimal_receipt IS NOT NULL) effect_receipts,
 (SELECT count(*)::integer FROM finance_movements WHERE id=2 AND name='AI40-UI-CODEX-R01') movement2)c;
 SELECT row_to_json(c) FROM(SELECT table_name,column_name,ordinal_position,data_type,is_nullable,column_default FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,ordinal_position)c;"""
 rows=run(['docker','exec',created_id,'psql','-U','restoreoperator','-d','nodia_restore_ai40','-At','-v','ON_ERROR_STOP=1','-c',query]).decode().splitlines()
 counts=json.loads(rows[0]);schema=[json.loads(r)for r in rows[1:]]
 raw_schema_sha=hashlib.sha256(json.dumps(schema,ensure_ascii=False,separators=(',',':')).encode()).hexdigest()
 positions={};visible=[]
 for row in schema:
  table=row['table_name'];positions[table]=positions.get(table,0)+1
  visible.append({**row,'ordinal_position':positions[table]})
 visible_schema_sha=hashlib.sha256(json.dumps(visible,ensure_ascii=False,separators=(',',':')).encode()).hexdigest()
 assert counts==v['restore_oracle']['counts']and visible_schema_sha==v['restore_oracle']['visible_schema_metadata_sha256']
 # Only the exact container created by this invocation can be removed.
 verify=json.loads(run(['docker','inspect',created_id]))[0];assert verify['Id']==created_id and verify['Name']=='/'+name and verify['Image']==image
 run(['docker','rm','-f','-v',created_id]);created_id=None
 assert subprocess.run(['docker','inspect',name],capture_output=True).returncode!=0
 print(json.dumps({'schema':'nodia-ai-ai40-reservations-backup-isolated-restore-v1','status':'restored_verified_removed','backup_id':v['backup_id'],'plain_bytes':len(body),'plain_sha256':v['plain_sha256'],'restore_oracle':{'counts':counts,'source_raw_schema_metadata_sha256':v['restore_oracle']['schema_metadata_sha256'],'restored_raw_schema_metadata_sha256':raw_schema_sha,'visible_schema_metadata_sha256':visible_schema_sha,'source_ordinal_gap_columns':v['restore_oracle']['ordinal_gap_columns'],'source_ordinal_gap_tables':v['restore_oracle']['ordinal_gap_tables'],'visible_columns':len(visible),'raw_metadata_equal':raw_schema_sha==v['restore_oracle']['schema_metadata_sha256'],'visible_metadata_equal':True},'image_id':image,'network':'none','ports_exposed':0,'disposable_container_removed':True,'private_RSA_key_on_VM':False,'plaintext_dump_file_written_to_VM_filesystem':False,'configured_database_writes':0,'provider_requests':0}))
finally:
 if created_id:
  try:
   verify=json.loads(run(['docker','inspect',created_id]))[0]
   if verify['Id']==created_id and verify['Name']=='/'+name and verify['Image']==image:run(['docker','rm','-f','-v',created_id])
  except Exception:pass
