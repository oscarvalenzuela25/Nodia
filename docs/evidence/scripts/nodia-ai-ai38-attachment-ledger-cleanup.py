"""Remove only a settled synthetic attachment's private observation ledger."""
import argparse
import hashlib
import json
import os
from datetime import datetime,timezone
from pathlib import Path
import re

p=argparse.ArgumentParser();p.add_argument('--absence-receipt',required=True);p.add_argument('--receipt-sha256',required=True);p.add_argument('--fixture-sha256',required=True);a=p.parse_args()
assert os.geteuid()==0
source=Path(a.absence_receipt)
assert source==Path('/tmp/nodia-ai-ai38-attachment-r2-absent-r01.json') and not source.is_symlink()
assert hashlib.sha256(source.read_bytes()).hexdigest()==a.receipt_sha256
receipt=json.loads(source.read_bytes())
assert receipt['status']=='passed' and receipt['phase']=='absent'
assert receipt['stage']=='AI-38-proxy-attachments'
assert receipt['objects_verified_absent']==1 and receipt['remaining_owned_cleanup_jobs']==0
assert [x['status'] for x in receipt['cloud_reads']]==[404,404]
identity=receipt['attachment_id'];chat=receipt['conversation_id']
uuid=r'[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}'
assert re.fullmatch(uuid,identity) and re.fullmatch(uuid,chat) and re.fullmatch('[a-f0-9]{64}',a.fixture_sha256)
parent=Path('/opt/nodia/verification/ai38-proxy-attachments-r01')
assert parent.resolve()==parent and parent.is_dir() and not parent.is_symlink() and parent.stat().st_mode&0o777==0o700
ledger=parent/('private-'+identity+'.json')
assert ledger.is_file() and not ledger.is_symlink() and ledger.stat().st_uid==0 and ledger.stat().st_mode&0o777==0o600
data=json.loads(ledger.read_bytes())
assert data['stage']==receipt['stage'] and data['conversation_id']==chat and data['attachment_id']==identity
assert data['expected_sha256']==a.fixture_sha256 and data['expected_file_name']=='ai38-boundary-exact20MiB.pdf'
assert data['expected_title'].startswith('AI-38') and data['expected_byte_count']==20971520
assert re.fullmatch(uuid,data['generation']) and data['key']==f'nodia-ai/{chat}/{identity}/{data["generation"]}'
target=parent/'public-ledger-cleanup.json';assert not target.exists()
ledger.unlink();assert not ledger.exists()
report={'stage':receipt['stage'],'status':'passed','source_sha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
 'observed_at_utc':datetime.now(timezone.utc).isoformat(),'absence_receipt_sha256':a.receipt_sha256,
 'private_owned_ledger_absent':True,'only_settled_owned_attachment_ledger_removed':True,
 'configured_SQL_writes':0,'R2_operations':0,'private_key_or_bucket_exported':False,
 'limits':['Live ledger absence only; not physical erasure or removal of ordinary archived chat metadata.']}
with target.open('x',encoding='utf-8') as stream:stream.write(json.dumps(report,indent=2)+'\n')
print(json.dumps(report))
