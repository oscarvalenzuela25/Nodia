"""Run only an explicit disposable fixture; never load the activated environment."""
import datetime,hashlib,json,os,pathlib,re,subprocess,sys
attempt=sys.argv[1]
assert re.fullmatch(r'attempt[0-9]{2}',attempt)
root=pathlib.Path('/opt/nodia/verification/ai33-compiled-'+attempt)
os.umask(0o077)
stdout=root/f'.tmp/ai33-sql-{attempt}.stdout'
stderr=root/f'.tmp/ai33-sql-{attempt}.stderr'
assert not stdout.exists() and not stderr.exists()
started=datetime.datetime.now(datetime.timezone.utc).isoformat()
with stdout.open('x') as out,stderr.open('x') as err:
    result=subprocess.run(['/usr/local/bin/node','test/nodia-ai-ai33.integration.mjs'],cwd=root,stdout=out,stderr=err,env={'PATH':'/usr/local/bin:/usr/bin:/bin','HOME':'/root','NODE_ENV':'test','DOTENV_CONFIG_PATH':'/dev/null'},timeout=180)
rawout=stdout.read_text();rawerr=stderr.read_text()
report={'stage':'AI-33','scope':'compiled_preferences_disposable_postgresql','attempt':attempt,'started_at_utc':started,'completed_at_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'exit_code':result.returncode,'status':'passed' if result.returncode==0 else 'failed','stdout_sha256':hashlib.sha256(stdout.read_bytes()).hexdigest(),'stderr_sha256':hashlib.sha256(stderr.read_bytes()).hexdigest(),'configured_database_used':False,'provider_generations':0,'storage_operations':0,'production_services_restarted':False}
for candidate in [rawout[rawout.rfind('\n{')+1:] if '\n{' in rawout else rawout,rawerr.splitlines()[0] if rawerr else '{}']:
    try:
        value=json.loads(candidate)
        if value.get('stage')=='AI-33':report['assertion_result']=value
    except ValueError:pass
if result.returncode!=0:
    report['error_category']=next((code for code in ['nodia_ai:invalid_persisted_state','AssertionError','UnknownDependenciesException','QueryFailedError'] if code in rawerr),'unclassified_test_failure')
remaining=subprocess.check_output(['docker','ps','-a','--filter','name=template_ai33_','--format','{{.Names}}'],text=True).splitlines()
report['disposable_containers_remaining']=len(remaining)
report['manifest_sha256']=hashlib.sha256((root/'.tmp/ai33-stage-manifest.json').read_bytes()).hexdigest()
destination=root/f'.tmp/ai33-sql-{attempt}.json'
destination.write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2));sys.exit(result.returncode)
