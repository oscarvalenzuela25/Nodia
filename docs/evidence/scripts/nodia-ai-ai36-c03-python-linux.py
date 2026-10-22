"""Run the C03 candidate in a disposable Linux container, never the live service."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
import shlex
import subprocess
import tarfile
import time

ROOT = Path(__file__).resolve().parents[3]
NATIVE = ROOT / "nodia-gemini-microservice"
PREFIX = "nodia-ai-ai36-c03-python"
OPTIONS = ["-i", "C:/Users/Oscar/Documents/NodiaVMs/keys/nodia-vps-lab", "-o", "BatchMode=yes",
           "-o", "UserKnownHostsFile=C:/Users/Oscar/Documents/NodiaVMs/keys/nodia-vps-lab-known_hosts",
           "-o", "HostKeyAlias=nodia-vps-lab", "-o", "StrictHostKeyChecking=yes"]
HOST = "operador@172.31.209.214"

CONTAINER_RUNNER = r'''
import hashlib,importlib.metadata,json,os,pathlib,platform,re,sys,time,unittest
root=pathlib.Path('/app')
manifest=json.loads((root/'candidate-source-manifest.json').read_text())
for relative,expected in manifest['files'].items():
    path=root/relative
    assert path.is_file() and not path.is_symlink(),relative
    assert hashlib.sha256(path.read_bytes()).hexdigest()==expected,relative
assert not any((root/name).exists() for name in ('.env','browser_profile','session_state','temp_uploads','.venv'))
dependencies={}
for line in (root/'requirements.txt').read_text().splitlines():
    if not line.strip() or line.lstrip().startswith('#') or 'sys_platform == "win32"' in line:continue
    match=re.fullmatch(r'([A-Za-z0-9_.-]+)==([^;\s]+)',line.strip())
    assert match,line
    name,expected=match.groups();actual=importlib.metadata.version(name)
    assert actual==expected,(name,actual,expected)
    dependencies[name]=actual
sys.path.insert(0,str(root/'tests'))
import test_support
suite=unittest.defaultTestLoader.discover(str(root/'tests'),pattern='test_*.py')
started=time.monotonic()
result=unittest.TextTestRunner(verbosity=1).run(suite)
report={'stage':'AI36-C03','scope':'isolated_linux_candidate_python_unit_suite',
    'platform':platform.system(),'python':platform.python_version(),
    'tests_run':result.testsRun,'failures':len(result.failures),'errors':len(result.errors),
    'skipped':len(result.skipped),'successful':result.wasSuccessful(),
    'duration_seconds':round(time.monotonic()-started,3),
    'source_files_verified':len(manifest['files']),'source_manifest_sha256':hashlib.sha256((root/'candidate-source-manifest.json').read_bytes()).hexdigest(),
    'installed_dependencies_match_requirements':True,'installed_dependencies':dependencies,
    'unit_test_external_network_guard':'tests/test_support.py',
    'provider_generations':0,'business_writes':0,'r2_operations':0,
    'profile_or_credential_mounts':False,'configured_database_used':False}
print('NODIA_C03_REPORT='+json.dumps(report,sort_keys=True),flush=True)
sys.exit(0 if result.wasSuccessful() else 1)
'''

REMOTE_RUNNER = r'''
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
'''


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> None:
    files = []
    for path in NATIVE.rglob("*"):
        relative = path.relative_to(NATIVE)
        if any(part in {".venv", "browser_profile", "session_state", "temp_uploads", "__pycache__"} for part in relative.parts):
            continue
        if relative.parts[0] == "experiments" and relative.name not in {
            "nodia_ai_mcp_fixture.py", "nodia_ai_agentic_diagnostics.py", "nodia_ai_web_protocol.py",
        }:
            continue
        if path.is_file() and not path.is_symlink() and (path.suffix == ".py" or relative.as_posix() in {
            "requirements.txt", "antigravity-cli.lock.json", "Dockerfile", ".dockerignore",
        } or relative.parts[0] == "tests" and path.suffix == ".json"):
            files.append(path)
    files.sort()
    manifest = {"stage": "AI36-C03", "selection": "same explicit native candidate whitelist as AI34; no credentials/profiles",
                "files": {path.relative_to(NATIVE).as_posix(): digest(path) for path in files}}
    manifest_path = ROOT / "docs/evidence" / (PREFIX + "-source-manifest.json")
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    runner = ROOT / ".tmp" / (PREFIX + "-runner.py")
    runner.write_text(CONTAINER_RUNNER, encoding="utf-8")
    remote = ROOT / ".tmp" / (PREFIX + "-remote.py")
    remote.write_text(REMOTE_RUNNER, encoding="utf-8")
    archive = ROOT / ".tmp" / (PREFIX + "-candidate.tar.gz")
    with tarfile.open(archive, "w:gz") as target:
        for path in files:
            target.add(path, arcname=path.relative_to(NATIVE).as_posix(), recursive=False)
        target.add(manifest_path, arcname="candidate-source-manifest.json", recursive=False)
        target.add(runner, arcname="candidate-linux-runner.py", recursive=False)
    stage = "/tmp/nodia-ai36-c03-python-" + digest(archive)[:12] + "-" + str(int(time.time()))
    subprocess.run(["ssh", *OPTIONS, HOST, "mkdir " + shlex.quote(stage)], check=True)
    for path, name in ((archive, "candidate.tar.gz"), (manifest_path, "manifest.json"), (remote, "remote.py")):
        subprocess.run(["scp", *OPTIONS, str(path), HOST + ":" + stage + "/" + name], check=True)
    process = subprocess.run(["ssh", *OPTIONS, HOST, "python3 " + shlex.quote(stage + "/remote.py") + " " + shlex.quote(stage)],
                             capture_output=True, text=True, timeout=200)
    (ROOT / ".tmp" / (PREFIX + "-ssh.log")).write_text(process.stdout + process.stderr, encoding="utf-8")
    for remote_name, local in (("stdout.log", ROOT / ".tmp" / (PREFIX + "-linux-stdout.log")),
                               ("stderr.log", ROOT / ".tmp" / (PREFIX + "-linux-stderr.log")),
                               ("result.json", ROOT / "docs/evidence" / (PREFIX + "-linux-validation.json"))):
        subprocess.run(["scp", *OPTIONS, HOST + ":" + stage + "/" + remote_name, str(local)], check=True)
    report_path = ROOT / "docs/evidence" / (PREFIX + "-linux-validation.json")
    report = json.loads(report_path.read_text())
    report.update({"script_sha256": digest(Path(__file__)), "source_manifest_path": manifest_path.relative_to(ROOT).as_posix(),
                   "source_manifest_sha256": digest(manifest_path), "source_files": len(files),
                   "source_python_files": sum(path.suffix == ".py" for path in files),
                   "source_test_python_files": sum(path.suffix == ".py" and path.relative_to(NATIVE).parts[0] == "tests" for path in files),
                   "host_staging_directory": stage})
    report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))
    if process.returncode:
        raise SystemExit(process.returncode)


if __name__ == "__main__":
    main()
