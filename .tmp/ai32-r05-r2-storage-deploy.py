"""Scoped six-output deployment while API/worker are stopped; Gemini unchanged."""
import hashlib,json,os,shutil,subprocess,time,urllib.request
from pathlib import Path

runtime=Path('/opt/nodia/releases/nodia-server-ai15-20261016')
stage=Path('/tmp/nodia-ai32-r05-storage-candidate')
manifest=json.loads((stage/'dist-manifest.json').read_text(encoding='utf-8'))
baseline_manifest=json.loads((stage/'base-dist-manifest.json').read_text(encoding='utf-8'))
allowed={str(Path('dist')/base/('storage.service'+suffix)) for base in ['common/storage'] for suffix in ['.js','.js.map','.d.ts']}
allowed|={str(Path('dist/nodia-ai-attachment/adapters')/('storage-nodia-ai-attachment'+suffix)) for suffix in ['.js','.js.map','.d.ts']}
def run(args,timeout=30):return subprocess.run(args,check=True,capture_output=True,text=True,timeout=timeout).stdout.strip()
def digest(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def current():return {p.relative_to(runtime).as_posix():digest(p) for p in sorted((runtime/'dist').rglob('*')) if p.is_file()}
def quiet():
    value=json.loads(run(['/usr/local/bin/node','/tmp/nodia-ai32-r04-native-candidate/quiet.mjs']))
    assert all(value[k]==0 for k in ['pending_jobs','open_attempts','held_or_unknown_slots'])
    return value
def native_quiet():
    value=json.loads(run(['python3','/tmp/ai32-r04-cleanup.py']))
    assert all(value[k]==0 for k in ['unknown_markers','armed_native_proofs','terminal_native_proofs','invalid_native_proofs','temporary_attachment_directories','temporary_cli_directories'])
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
    old=target.stat() if target.exists() else (runtime/'dist/common/storage/storage.service.js').stat()
    temporary=target.with_name(target.name+'.ai32-r05')
    descriptor=os.open(temporary,os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o600)
    try:
        with os.fdopen(descriptor,'wb') as output:
            output.write(source.read_bytes());output.flush();os.fsync(output.fileno());os.fchown(output.fileno(),old.st_uid,old.st_gid);os.fchmod(output.fileno(),old.st_mode&0o777)
        os.replace(temporary,target)
    finally:
        if temporary.exists():temporary.unlink()

report={'stage':'AI-32-R05','scope':'scoped_compiled_storage_single_attempt_activation','status':'running',
    'observed_at_utc':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'provider_generations':0,'r2_object_operations':0,
    'configuration_modified':False,'schema_modified':False,'gemini_restarted':False}
stopped=False;changed=False;backup=None;phase='preflight'
try:
    assert all(not Path(p).is_absolute() and '..' not in Path(p).parts and p.startswith('dist/') for p in manifest)
    before=current();assert before==baseline_manifest
    differences=sorted(p for p in before if before[p]!=manifest[p]);added=sorted(set(manifest)-set(before))
    assert differences and set(differences)<=allowed and set(added)<=allowed
    assert set(manifest)==set(before)|allowed and all(digest(stage/p)==manifest[p] for p in allowed)
    baseline=quiet();native_quiet()
    gemini=run(['docker','inspect','--format','{{.Id}} {{.State.StartedAt}} {{.Image}}','nodia-gemini-microservice'])
    nginx=run(['systemctl','show','nginx','--property=MainPID','--property=ActiveEnterTimestampMonotonic','--value'])
    environment=(runtime/'.env').read_bytes()
    backup=Path('/opt/nodia/verification-backups')/('ai32-r05-storage-'+str(int(time.time()*1000)));backup.mkdir(mode=0o700)
    (backup/'dist-manifest-before.json').write_text(json.dumps(before,indent=2),encoding='utf-8')
    for p in allowed:
        if p in before:
            (backup/p).parent.mkdir(parents=True,exist_ok=True);shutil.copy2(runtime/p,backup/p)
    phase='stop_api_worker';stopped=True;run(['systemctl','stop','nodia-api','nodia-ai-worker'],60);quiet();assert current()==before
    phase='install_scoped_outputs';changed=True
    for p in sorted(allowed):install(stage/p,runtime/p)
    assert current()==manifest
    phase='start_api_worker';run(['systemctl','start','nodia-api','nodia-ai-worker'],60);ready();stopped=False
    phase='postflight';final=quiet();native_quiet()
    assert current()==manifest and (runtime/'.env').read_bytes()==environment
    assert run(['docker','inspect','--format','{{.Id}} {{.State.StartedAt}} {{.Image}}','nodia-gemini-microservice'])==gemini
    assert run(['systemctl','show','nginx','--property=MainPID','--property=ActiveEnterTimestampMonotonic','--value'])==nginx
    report.update(status='passed',compiled_files_verified=len(manifest),scoped_outputs_installed=len(allowed),
        changed_paths=differences,added_output_paths=added,previous_compiled_files_verified=len(before),
        unchanged_existing_compiled_files=len(before)-len(differences),all_other_compiled_hashes_preserved=True,
        final_dist_manifest_sha256=digest(stage/'dist-manifest.json'),backup_directory=str(backup),
        api_and_worker_restarted=True,gemini_container_identity_preserved=True,nginx_identity_preserved=True,
        server_environment_unchanged=True,quiet_before=baseline,quiet_after=final)
except Exception:
    report.update(status='failed',safe_failure_phase=phase)
    if changed:
        try:
            for p in sorted(allowed):
                if p in baseline_manifest:install(backup/p,runtime/p)
                elif (runtime/p).exists():(runtime/p).unlink()
            report['scoped_code_rolled_back']=True
        except Exception:report['scoped_code_rolled_back']=False
    if stopped or changed:
        try:run(['systemctl','start','nodia-api','nodia-ai-worker'],60);ready();report['services_recovered']=True
        except Exception:report['services_recovered']=False
report['completed_at_utc']=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())
print(json.dumps(report,indent=2))
if report['status']!='passed':raise SystemExit(1)
