"""Read-only check that the rejected DI attempt never created a chat, intent or object witness."""
import json,subprocess
from pathlib import Path
path=Path('/opt/nodia/verification-backups/ai32-r07-purge-d8af1a8e9ba50b26/sandbox.json')
descriptor=json.loads(path.read_text())
assert descriptor['stage']=='AI-32-R07' and descriptor['sandbox']['database']=='ai32_r07_purge'
query="SELECT json_build_object('chats',(SELECT count(*) FROM nodia_ai_conversations),'attachments',(SELECT count(*) FROM nodia_ai_attachments),'jobs',(SELECT count(*) FROM nodia_ai_jobs),'invoices',(SELECT count(*) FROM invoices))"
process=subprocess.run(['docker','exec',descriptor['container'],'psql','--no-psqlrc',
 '--username','ai32_r07_purge','--dbname','ai32_r07_purge','--tuples-only','--no-align','--command',query],
 check=True,capture_output=True,text=True,timeout=10)
counts=json.loads(process.stdout)
assert all(value==0 for value in counts.values())
absent=not Path(descriptor['ledger_path']).exists()
assert absent
print(json.dumps({'stage':'AI-32-R07','scope':'failed_DI_attempt_state_verification',
 'status':'passed','sandbox_counts':counts,'ledger_absent':absent,'cloud_operations':0},indent=2))
