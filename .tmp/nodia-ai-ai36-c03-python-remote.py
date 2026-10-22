
import hashlib,json,pathlib,re,subprocess,sys,tarfile,time
stage=pathlib.Path(sys.argv[1]).resolve()
assert str(stage).startswith('/tmp/nodia-ai36-c03-python-') and stage.parent==pathlib.Path('/tmp')
archive=stage/'candidate.tar.gz'
manifest=json.loads((stage/'manifest.json').read_text())
with tarfile.open(archive,'r:gz') as source:
    expected=set(manifest['files'])|{'candidate-source-manifest.json','candidate-linux-runner.py'}
    assert set(source.getnames())==expected
    assert all(member.isfile() and not member.issym() and not member.islnk() for member in source.getmembers())
    source.extractall(stage/'source',filter='data')
for relative,expected in manifest['files'].items():
    path=stage/'source'/relative
    assert hashlib.sha256(path.read_bytes()).hexdigest()==expected,relative
def inspect():
    raw=subprocess.check_output(['sudo','-n','docker','inspect','--format',
      '{"image":{{json .Image}},"started_at":{{json .State.StartedAt}},"running":{{json .State.Running}},"container_id":{{json .Id}}}',
      'nodia-gemini-microservice'],text=True)
    return json.loads(raw)
before=inspect();assert before['running'] and re.fullmatch(r'sha256:[0-9a-f]{64}',before['image'])
name='template_ai36_c03_python_'+str(int(time.time()))
command=['sudo','-n','docker','run','--rm','--name',name,'--network','none','--read-only',
    '--tmpfs','/tmp:rw,size=256m,nosuid,nodev','--memory','1g','--cpus','2','--pids-limit','256',
    '--cap-drop','ALL','--security-opt','no-new-privileges','--user','10001:10001',
    '--env','PYTHONDONTWRITEBYTECODE=1','--env','HOME=/tmp/nodia-home',
    '--env','XDG_CACHE_HOME=/tmp/nodia-cache','--env','ANTIGRAVITY_CLI_PATH=',
    '--mount','type=bind,source='+str(stage/'source')+',target=/app,readonly',
    before['image'],'python','/app/candidate-linux-runner.py']
process=subprocess.run(command,capture_output=True,text=True,timeout=180)
(stage/'stdout.log').write_text(process.stdout)
(stage/'stderr.log').write_text(process.stderr)
after=inspect();assert before==after,'Live service changed'
left=subprocess.check_output(['sudo','-n','docker','ps','-a','--filter','name=^/'+name+'$',
    '--format','{{.ID}}'],text=True).strip()
assert not left,'Disposable container remains'
lines=[line for line in process.stdout.splitlines() if line.startswith('NODIA_C03_REPORT=')]
report=json.loads(lines[-1].split('=',1)[1]) if lines else {'successful':False}
report.update({'exit_code':process.returncode,'live_service_before':before,'live_service_after':after,
    'active_container_restarted':False,'active_image_retagged':False,'activated':False,
    'disposable_container_name':name,'disposable_container_remaining':False,
    'archive_sha256':hashlib.sha256(archive.read_bytes()).hexdigest(),
    'stdout_sha256':hashlib.sha256(process.stdout.encode()).hexdigest(),
    'stderr_sha256':hashlib.sha256(process.stderr.encode()).hexdigest(),
    'isolation':{'network':'none','root_read_only':True,'candidate_source_mount_read_only':True,
      'temporary_bytes':268435456,'memory_bytes':1073741824,'cpus':2,'pids_limit':256,
      'capabilities':'all_dropped','no_new_privileges':True,'service_user':'10001:10001'},
    'observed_at_utc':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())})
(stage/'result.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report))
sys.exit(0 if process.returncode==0 and report['successful'] else 1)
