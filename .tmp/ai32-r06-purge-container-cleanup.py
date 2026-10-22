"""Destroy only verified-empty R06 disposable DBs after their private ownership ledgers settle."""
import json,re,subprocess,time
from pathlib import Path

def run(args,check=True):
    return subprocess.run(args,check=check,capture_output=True,text=True,timeout=30)

report={'stage':'AI-32-R06','scope':'owned_disposable_sandbox_teardown','status':'running',
        'provider_generations':0,'storage_operations':0,'configured_database_used':False,
        'production_services_restarted':False,'credential_values_exported':False,'sandboxes':[]}
phase='ownership_and_absence_preflight'
try:
    descriptors=[]
    import sys
    assert len(sys.argv)==3
    for argument in sys.argv[1:]:
        path=Path(argument)
        assert re.fullmatch(r'/opt/nodia/verification-backups/ai32-r06-(purge|invoice)-[0-9a-f]{16}/sandbox.json',str(path))
        assert not path.is_symlink()
        value=json.loads(path.read_text())
        purpose=value['purpose'];nonce=value['owner_nonce'];name=value['container']
        assert purpose in ['purge','invoice'] and re.fullmatch('[a-f0-9]{16}',nonce)
        assert name==f'nodia_ai32_r06_{purpose}_{nonce}'
        assert value['sandbox']['database']==value['sandbox']['username']==f'ai32_r06_{purpose}'
        assert value['sandbox']['host']=='127.0.0.1'
        labels=json.loads(run(['docker','inspect','--format','{{json .Config.Labels}}',name]).stdout)
        assert labels['nodia.validation']=='ai32-r06' and labels['nodia.validation.owner']==nonce
        ledger_path=Path(value['ledger_path'])
        assert ledger_path.parent==path.parent and not ledger_path.is_symlink()
        ledger=json.loads(ledger_path.read_text())
        assert ledger['stage']=='AI-32-R06' and ledger['purpose']==purpose
        records=ledger['objects'] if purpose=='purge' else ledger['records']
        allowed=['verified_absent'] if purpose=='purge' else ['no_write_attempted','preexisting_do_not_delete','deleted_and_get_404']
        assert records and all(item['state'] in allowed for item in records)
        if purpose=='invoice':assert ledger['cleanup_complete'] is True
        database=value['sandbox']['database']
        sql="SELECT json_build_object('chats',(SELECT count(*) FROM nodia_ai_conversations),'attachments',(SELECT count(*) FROM nodia_ai_attachments),'jobs',(SELECT count(*) FROM nodia_ai_jobs),'invoice_upload_intents',(SELECT count(*) FROM invoice_uploads),'invoices',(SELECT count(*) FROM invoices))"
        counts=json.loads(run(['docker','exec',name,'psql','--no-psqlrc','--username',database,'--dbname',database,'--tuples-only','--no-align','--command',sql]).stdout)
        assert all(item==0 for item in counts.values())
        descriptors.append((path,value,ledger_path))
        report['sandboxes'].append({'purpose':purpose,'ledger_record_count':len(records),
            'ledger_records_settled':True,'private_ledger_mode_0600':ledger_path.stat().st_mode&0o777==0o600,
            'database_final_counts':counts,'owned_container_removed':False})
    phase='owned_container_removal'
    for (path,value,ledger_path),result in zip(descriptors,report['sandboxes']):
        name=value['container']
        run(['docker','rm','-f',name])
        assert run(['docker','inspect',name],check=False).returncode!=0
        result['owned_container_removed']=True
        # No recursive deletion. Remove only named private resources created by R06.
        allowed={path,ledger_path,path.parent/'invoice-stdout.log',path.parent/'invoice-stderr.log',
                 path.parent/'invoice-cleanup-stdout.log',path.parent/'invoice-cleanup-stderr.log',
                 path.parent/'ai32-r06-invoice-legacy.png'}
        for owned in allowed:
            if owned.exists():
                assert owned.parent==path.parent and owned.is_file() and not owned.is_symlink()
                owned.unlink()
        result['private_descriptor_and_ledger_removed']=not path.exists() and not ledger_path.exists()
        if not any(path.parent.iterdir()):path.parent.rmdir();result['private_directory_removed']=True
        else:result['private_directory_removed']=False
    report['status']='passed'
except Exception:
    report.update(status='failed',safe_failure_phase=phase)
report['observed_at_utc']=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())
print(json.dumps(report,indent=2))
if report['status']!='passed':raise SystemExit(1)
