"""Own R07 sandbox only; object absence must already be proven by the reconstructed janitor."""
import json,re,subprocess,time
from pathlib import Path

def run(args,check=True):
    return subprocess.run(args,check=check,capture_output=True,text=True,timeout=30)

report={'stage':'AI-32-R07','scope':'owned_disposable_sandbox_teardown','status':'running',
        'provider_generations':0,'cloud_operations':0,'configured_database_used':False,
        'production_services_restarted':False,'credential_values_exported':False}
phase='ownership_and_absence_preflight'
try:
    import sys
    assert len(sys.argv)==2
    path=Path(sys.argv[1])
    assert re.fullmatch(r'/opt/nodia/verification-backups/ai32-r07-purge-[0-9a-f]{16}/sandbox.json',str(path))
    assert path.is_file() and not path.is_symlink()
    descriptor=json.loads(path.read_text())
    assert descriptor['stage']=='AI-32-R07' and descriptor['purpose']=='expiry_during_put'
    nonce=descriptor['owner_nonce'];name=descriptor['container']
    assert re.fullmatch('[a-f0-9]{16}',nonce) and name==f'nodia_ai32_r07_purge_{nonce}'
    assert descriptor['sandbox']['database']==descriptor['sandbox']['username']=='ai32_r07_purge'
    assert descriptor['sandbox']['host']=='127.0.0.1'
    labels=json.loads(run(['docker','inspect','--format','{{json .Config.Labels}}',name]).stdout)
    assert labels['nodia.validation']=='ai32-r07' and labels['nodia.validation.owner']==nonce
    ledger_path=Path(descriptor['ledger_path'])
    assert ledger_path.parent==path.parent and not ledger_path.is_symlink()
    ledger=json.loads(ledger_path.read_text())
    assert ledger['stage']=='AI-32-R07' and ledger['purpose']=='expiry_during_put'
    assert ledger['object']['state']=='deleted_and_get_404' and ledger['cleanup_complete'] is True
    query="SELECT json_build_object('chats',(SELECT count(*) FROM nodia_ai_conversations),'attachments',(SELECT count(*) FROM nodia_ai_attachments),'messages',(SELECT count(*) FROM nodia_ai_messages),'parts',(SELECT count(*) FROM nodia_ai_message_parts),'jobs',(SELECT count(*) FROM nodia_ai_jobs),'invoice_upload_intents',(SELECT count(*) FROM invoice_uploads),'invoices',(SELECT count(*) FROM invoices))"
    counts=json.loads(run(['docker','exec',name,'psql','--no-psqlrc','--username','ai32_r07_purge',
        '--dbname','ai32_r07_purge','--tuples-only','--no-align','--command',query]).stdout)
    assert all(value==0 for value in counts.values())
    report.update(ledger_objects=1,ledger_objects_settled=True,database_final_counts=counts,
                  private_ledger_mode_0600=ledger_path.stat().st_mode&0o777==0o600)
    phase='owned_container_removal'
    run(['docker','rm','-f',name])
    assert run(['docker','inspect',name],check=False).returncode!=0
    report['owned_container_removed']=True
    allowed={path,ledger_path,path.parent/'r07-upload-stdout.log',path.parent/'r07-upload-stderr.log',
             path.parent/'r07-attempt02-upload-stdout.log',path.parent/'r07-attempt02-upload-stderr.log',
             path.parent/'r07-attempt02-cleanup-stdout.log',path.parent/'r07-attempt02-cleanup-stderr.log'}
    removed=0
    for owned in allowed:
        if owned.exists():
            assert owned.parent==path.parent and owned.is_file() and not owned.is_symlink()
            owned.unlink();removed+=1
    report['private_files_removed']=removed
    report['private_descriptor_and_ledger_removed']=not path.exists() and not ledger_path.exists()
    assert not any(path.parent.iterdir())
    path.parent.rmdir();report['private_directory_removed']=True
    report['inspector_temporary_container_removed']=run(['docker','inspect','nodia_ai32_r07_inspector_20261018'],check=False).returncode!=0
    assert report['inspector_temporary_container_removed']
    report['status']='passed'
except Exception:
    report.update(status='failed',safe_failure_phase=phase)
report['observed_at_utc']=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())
print(json.dumps(report,indent=2))
if report['status']!='passed':raise SystemExit(1)
