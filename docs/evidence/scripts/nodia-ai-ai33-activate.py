"""Approved additive M4 lab rollout; API/worker only, no inference or R2 calls."""
import hashlib,json,os,shutil,subprocess,sys,tarfile,time,urllib.request
from pathlib import Path,PurePosixPath
runtime=Path('/opt/nodia/releases/nodia-server-ai15-20261016')
stage=Path('/tmp/nodia-ai33-runtime-candidate')
packet=Path('/tmp/ai33-runtime-packet.tar')
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def run(args,timeout=30):return subprocess.run(args,check=True,capture_output=True,text=True,timeout=timeout).stdout.strip()
def current():return {p.relative_to(runtime).as_posix():digest(p) for p in sorted((runtime/'dist').rglob('*')) if p.is_file()}
def quiet():
    value=json.loads(run(['/usr/local/bin/node','/tmp/nodia-ai32-r04-native-candidate/quiet.mjs']))
    assert all(value[k]==0 for k in ['pending_jobs','open_attempts','held_or_unknown_slots'])
    return value
def native_quiet():
    value=json.loads(run(['python3','/tmp/ai32-r04-cleanup.py']))
    keys=['unknown_markers','armed_native_proofs','terminal_native_proofs','invalid_native_proofs','temporary_attachment_directories','temporary_cli_directories']
    assert all(value[k]==0 for k in keys)
    return {k:value[k] for k in keys}
def chat():
    value=json.loads(run(['/usr/local/bin/node','/tmp/ai32-r05-r2-chat-final-projection.mjs']))
    assert value['status']=='passed' and 'cloud_reads' not in value
    return {k:value[k] for k in ['total_attachment_rows','messages','message_parts','conversation','attachment_parts','runs','jobs','attempts','attachments','expected_synthetic_fixture_matches']}
def ready():
    for _ in range(45):
        try:
            assert run(['systemctl','is-active','nodia-api'])=='active'
            assert run(['systemctl','is-active','nodia-ai-worker'])=='active'
            with urllib.request.urlopen('http://127.0.0.1:3000/api/v1/',timeout=2) as response:assert response.status==200
            return
        except Exception:time.sleep(1)
    raise RuntimeError('readiness_failed')
def install(source,target):
    target.parent.mkdir(parents=True,exist_ok=True)
    old=target.stat() if target.exists() else (runtime/'dist/main.js').stat()
    temporary=target.with_name(target.name+'.ai33')
    descriptor=os.open(temporary,os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o600)
    try:
        with os.fdopen(descriptor,'wb') as output:
            output.write(source.read_bytes());output.flush();os.fsync(output.fileno());os.fchown(output.fileno(),old.st_uid,old.st_gid);os.fchmod(output.fileno(),old.st_mode&0o777)
        os.replace(temporary,target)
    finally:
        if temporary.exists():temporary.unlink()
report={'stage':'AI-33','scope':'additive_compiled_preferences_M4_lab_activation','status':'running','observed_at_utc':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'provider_generations':0,'provider_metadata_requests':0,'r2_object_operations':0,'configuration_modified':False,'gemini_restarted':False}
phase='packet_preflight';stopped=False;changed=False;backup=None;migrated=False
try:
    assert digest(packet)==sys.argv[1]
    stage.mkdir(mode=0o700,exist_ok=False)
    with tarfile.open(packet) as tar:
        for member in tar.getmembers():
            p=PurePosixPath(member.name);assert not p.is_absolute() and '..' not in p.parts and not member.issym() and not member.islnk() and p.parts[0] in ['dist','.tmp']
        tar.extractall(stage,filter='data')
    manifest_path=stage/'.tmp/ai33-runtime-candidate-manifest.json';assert digest(manifest_path)==sys.argv[2]
    manifest=json.loads(manifest_path.read_text());before=json.loads((stage/'.tmp/ai33-runtime-before-manifest.json').read_text())
    assert len(before)==909 and len(manifest)==923 and current()==before
    differences=sorted(p for p in before if before[p]!=manifest[p]);added=sorted(set(manifest)-set(before));assert len(differences)==16 and len(added)==14
    assert set(before)<=set(manifest)
    for p in differences+added:assert digest(stage/p)==manifest[p]
    assert not any('.fixture' in p or p.endswith('.map') or p.endswith('.d.ts') for p in added)
    baseline=quiet();assert baseline['migrations']==26;native_before=native_quiet();chat_before=chat()
    gemini=run(['docker','inspect','--format','{{.Id}} {{.State.StartedAt}} {{.Image}}','nodia-gemini-microservice'])
    nginx=run(['systemctl','show','nginx','--property=MainPID','--property=ActiveEnterTimestampMonotonic','--value'])
    environment=(runtime/'.env').read_bytes()
    backup=Path('/opt/nodia/verification-backups')/('ai33-'+str(int(time.time()*1000)));backup.mkdir(mode=0o700)
    (backup/'dist-manifest-before.json').write_text(json.dumps(before,indent=2));(backup/'configured-chat-before.json').write_text(json.dumps(chat_before,indent=2))
    for p in differences:(backup/p).parent.mkdir(parents=True,exist_ok=True);shutil.copy2(runtime/p,backup/p)
    phase='stop_api_worker';stopped=True;run(['systemctl','stop','nodia-api','nodia-ai-worker'],60);quiet();assert current()==before and chat()==chat_before
    phase='private_backup_and_M4';migration=json.loads(run(['/usr/local/bin/node','/tmp/ai33-migrate.mjs',str(backup)],100));assert migration['status']=='passed';migrated=True
    (backup/'migration.json').write_text(json.dumps(migration,indent=2));report['migration']=migration
    phase='install_additive_outputs';changed=True
    for p in differences+added:install(stage/p,runtime/p)
    assert current()==manifest
    phase='start_api_worker';run(['systemctl','start','nodia-api','nodia-ai-worker'],60);ready();stopped=False
    phase='postflight';final=quiet();assert final['migrations']==27;native_after=native_quiet();chat_after=chat()
    assert current()==manifest and (runtime/'.env').read_bytes()==environment and chat_after==chat_before
    assert run(['docker','inspect','--format','{{.Id}} {{.State.StartedAt}} {{.Image}}','nodia-gemini-microservice'])==gemini
    assert run(['systemctl','show','nginx','--property=MainPID','--property=ActiveEnterTimestampMonotonic','--value'])==nginx
    report.update(status='passed',compiled_files_verified=923,previous_compiled_files_verified=909,changed_paths=differences,added_output_paths=added,unchanged_existing_compiled_files=909-len(differences),compiled_manifest_sha256=digest(manifest_path),backup_directory=str(backup),api_and_worker_restarted=True,gemini_container_identity_preserved=True,nginx_identity_preserved=True,server_environment_unchanged=True,quiet_before=baseline,quiet_after=final,native_runtime_artifact_counts=native_after,configured_chat_preserved=True,configured_chat_metadata_sha256=hashlib.sha256(json.dumps(chat_after,sort_keys=True,separators=(',',':')).encode()).hexdigest())
except Exception:
    report.update(status='failed',safe_failure_phase=phase,migration_applied=migrated)
    if changed:
        try:
            run(['systemctl','stop','nodia-api','nodia-ai-worker'],60)
            for p in differences:install(backup/p,runtime/p)
            for p in added:
                if (runtime/p).exists():(runtime/p).unlink()
            assert current()==before;report['compiled_code_rolled_back']=True
        except Exception:report['compiled_code_rolled_back']=False
    if stopped or changed:
        try:run(['systemctl','start','nodia-api','nodia-ai-worker'],60);ready();report['services_recovered']=True
        except Exception:report['services_recovered']=False
    report['additive_schema_retained_if_applied']=True
report['completed_at_utc']=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())
print(json.dumps(report,indent=2))
Path('/tmp/ai33-activation-result.json').write_text(json.dumps(report,indent=2)+'\n')
if report['status']!='passed':raise SystemExit(1)
