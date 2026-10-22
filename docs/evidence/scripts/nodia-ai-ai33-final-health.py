"""Read-only current 923-output/27-migration health; legacy probes retain provenance."""
import hashlib,json,subprocess,time
from pathlib import Path
def run(args):return subprocess.run(args,check=True,capture_output=True,text=True,timeout=30).stdout
runtime=Path('/opt/nodia/releases/nodia-server-ai15-20261016')
report={'stage':'AI-33','scope':'post_activation_health_parity_and_quiet','observed_at_utc':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'status':'running','provider_generations':0,'provider_metadata_requests':0,'r2_object_operations':0,'services_restarted_by_this_probe':False}
phase='service_health'
try:
    legacy=json.loads(run(['python3','/tmp/ai32-r05-r2-vm-health.py']));assert all(v=='active' for v in legacy['units'].values()) and all(v==200 for v in legacy['http'].values())
    report.update(units=legacy['units'],http=legacy['http'],gemini_image=legacy['gemini_image'],service_probe_origin='AI-32-R05')
    phase='quiet';quiet=json.loads(run(['/usr/local/bin/node','/tmp/nodia-ai32-r04-native-candidate/quiet.mjs']));assert all(quiet[k]==0 for k in ['pending_jobs','open_attempts','held_or_unknown_slots']);assert quiet['migrations']==27;report['sql_quiet']=quiet
    native=json.loads(run(['python3','/tmp/ai32-r04-cleanup.py']));keys=['unknown_markers','armed_native_proofs','terminal_native_proofs','invalid_native_proofs','temporary_attachment_directories','temporary_cli_directories'];report['native_runtime_artifact_counts']={k:native[k] for k in keys};assert all(v==0 for v in report['native_runtime_artifact_counts'].values())
    phase='compiled_parity';manifest_path=Path('/tmp/nodia-ai33-runtime-candidate/.tmp/ai33-runtime-candidate-manifest.json');data=manifest_path.read_bytes();assert hashlib.sha256(data).hexdigest()=='ba5ad634dd748267d52d004cd0d1c415f861547324a155d5ad9f86ecf4deb6ed';manifest=json.loads(data)
    actual={p.relative_to(runtime).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in (runtime/'dist').rglob('*') if p.is_file()};assert actual==manifest and len(actual)==923;report.update(compiled_files_verified=923,compiled_drift_files=[],compiled_manifest_sha256=hashlib.sha256(data).hexdigest())
    phase='native_source_parity';data=Path('/tmp/ai32-r04-final-source-manifest.json').read_bytes();native_manifest=json.loads(data)
    code="""import hashlib,json,sys
from pathlib import Path
m=json.load(sys.stdin)
assert all(not Path(p).is_absolute() and '..' not in Path(p).parts for p in m)
print(json.dumps({'files':len(m),'drift_count':sum(not (Path('/app')/p).is_file() or (Path('/app')/p).is_symlink() or hashlib.sha256((Path('/app')/p).read_bytes()).hexdigest()!=h for p,h in m.items())}))"""
    value=json.loads(subprocess.run(['docker','exec','-i','--user','10001:10001','nodia-gemini-microservice','python','-c',code],input=json.dumps(native_manifest),check=True,capture_output=True,text=True,timeout=20).stdout);assert value=={'files':92,'drift_count':0};report.update(native_source_files_verified=92,native_source_drift_count=0,native_manifest_sha256=hashlib.sha256(data).hexdigest());assert report['gemini_image']=='sha256:212cffaeefdd5e93f1abae290c4f387a891ddbd65357c223c6f0a3c0224488f3'
    phase='schema';report['schema_and_jobs']=json.loads(run(['/usr/local/bin/node','/tmp/ai33-state.mjs']));report['status']='passed'
except Exception:report.update(status='failed',safe_failure_phase=phase)
report['completed_at_utc']=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime());print(json.dumps(report,indent=2))
if report['status']!='passed':raise SystemExit(1)
