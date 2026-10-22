"""Execute only public version/help in an account-free, network-free container."""
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess

ROOT = Path('/opt/nodia/verification/ai36-c05-r04-cli-offline02')
SOURCE = Path('/tmp/nodia-ai-ai36-c05-agy-1.4.2-linux.bin')
IMAGE = 'sha256:0615520cd6d6682eddc08dd886d79952c80265fcf2e7814caa940b92ee8f27aa'
DIGEST = 'f63dd18d9aee3742055452c6eefbc22740ac4cb7bd7ad4c6b5cac2cccbd69d0548058ef5a3f7105d57146f7ce0a3ae07ef9dd89cde84dcac2cba64edc6f8dbdc'
assert not ROOT.exists()
ROOT.mkdir(mode=0o700)
assert SOURCE.stat().st_size == 221286656
assert hashlib.sha512(SOURCE.read_bytes()).hexdigest() == DIGEST
binary = ROOT / 'agy-1.4.2-linux.bin'
shutil.copyfile(SOURCE, binary)
binary.chmod(0o555)
assert hashlib.sha512(binary.read_bytes()).hexdigest() == DIGEST

INNER = r'''
import hashlib,json,os,re,selectors,signal,subprocess,time
from pathlib import Path
binary='/opt/public-cli/agy'
os.mkdir('/tmp/empty-home',0o700)
env={'HOME':'/tmp/empty-home','PATH':'/usr/local/bin:/usr/bin:/bin','LANG':'C.UTF-8','TERM':'dumb'}
results=[]
for label,args,limit in [('version',['--version'],4),('help',['--help'],15)]:
 start=time.monotonic(); p=subprocess.Popen([binary,*args],stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.PIPE,env=env,cwd='/tmp/empty-home',start_new_session=True)
 selector=selectors.DefaultSelector(); buffers={'stdout':bytearray(),'stderr':bytearray()}
 for name,fd in [('stdout',p.stdout),('stderr',p.stderr)]:
  os.set_blocking(fd.fileno(),False);selector.register(fd,selectors.EVENT_READ,name)
 reason=None
 try:
  while selector.get_map():
   if time.monotonic()-start>=limit:reason='timeout';break
   for key,_ in selector.select(.02):
    chunk=os.read(key.fd,16384)
    if not chunk:selector.unregister(key.fileobj);continue
    buffers[key.data].extend(chunk)
    if len(buffers[key.data])>131072:reason='output_bound';break
   if reason:break
 finally:
  if p.poll() is None:
   try:os.killpg(p.pid,signal.SIGKILL)
   except ProcessLookupError:pass
  p.wait(timeout=2);selector.close();p.stdout.close();p.stderr.close()
 elapsed=round((time.monotonic()-start)*1000,3)
 stdout=bytes(buffers['stdout']);stderr=bytes(buffers['stderr']);text=(stdout+b'\\n'+stderr).decode('utf-8',errors='replace')
 result={'command_class':label,'limit_seconds':limit,'elapsed_ms':elapsed,'exit_code':p.returncode,'bounded_failure':reason,
  'stdout_bytes':len(stdout),'stderr_bytes':len(stderr),'stdout_sha256':hashlib.sha256(stdout).hexdigest(),'stderr_sha256':hashlib.sha256(stderr).hexdigest()}
 if label=='version':
  versions=re.findall(r'(?<![0-9])1\.4\.2(?![0-9])',text)
  result['exact_pinned_version_reported']=len(versions)>0
  result['reported_version']='1.4.2' if versions else None
 else:
  required=['--agent','--model','--effort','--input-format','--output-format','--json-schema','--disable-slash-commands','--sandbox','--print-timeout','--log-file']
  result['required_runtime_options']={flag:re.search(r'(?<![\w-])'+re.escape(flag)+r'(?![\w-])',text) is not None for flag in required}
  result['all_required_runtime_options_documented']=all(result['required_runtime_options'].values())
  commands=['models','agents','mcp','auth','login','logout','update','version','help','config','settings','completion']
  result['public_command_tokens']=[name for name in commands if re.search(r'(?m)^\s{0,8}'+re.escape(name)+r'(?:\s|$)',text)]
 results.append(result)
data=Path(binary).read_bytes()
markers=['inheritMcp','disableDefaultMcps','mcpServers','call_mcp_tool','jsonSchema','stream-json','print-timeout']
print(json.dumps({'commands':results,'binary_sha512':hashlib.sha512(data).hexdigest(),'static_marker_presence':{m:m.encode() in data for m in markers},
 'static_marker_interpretation':'byte_presence_only_not_runtime_parser_or_provider_compatibility','environment_keys':sorted(env),'network_requests_possible':False,
 'provider_inferences':0,'credential_or_operational_profile_access':False,'role_inheritance_gate_runtime_parse':'pending_requires_a_separate_non_generative_parse_path_not_demonstrated_by_help',
 'empty_HOME_entries_after_commands':len(list(Path('/tmp/empty-home').iterdir()))}))
'''

def run(args, timeout=30, data=None):
    return subprocess.run(args, input=data, capture_output=True, check=False, timeout=timeout)

def current():
    info = json.loads(run(['docker', 'inspect', 'nodia-gemini-microservice']).stdout)[0]
    return {'id': info['Id'], 'image': info['Image'], 'started_at': info['State']['StartedAt'],
            'units': {name: run(['systemctl', 'is-active', name]).stdout.decode().strip()
                      for name in ('nodia-api', 'nodia-ai-worker', 'nodia-gemini-lab', 'nginx')}}

before = current()
assert before['image'] == IMAGE and all(v == 'active' for v in before['units'].values())
report = {'stage': 'AI-36-C05-R04', 'scope': 'isolated_public_CLI_1_4_2_version_help_and_static_metadata_only',
          'started_at_utc': datetime.now(timezone.utc).isoformat(), 'status': 'running',
          'source_sha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(), 'binary_sha512': DIGEST,
          'base_image_id': IMAGE, 'network': 'none', 'root_filesystem_read_only': True,
          'user': '10001:10001', 'capabilities_dropped': 'ALL', 'no_new_privileges': True,
          'public_binary_readonly_mount_only': True, 'operational_mounts_or_env': False,
          'provider_inferences': 0, 'service_restarts': 0, 'runtime_operational_before': before}
name = 'nodia-c05-r04-cli-offline02'
args = ['docker', 'run', '--rm', '-i', '--name', name, '--network=none', '--read-only', '--cap-drop=ALL',
        '--security-opt=no-new-privileges', '--user=10001:10001', '--memory=1g', '--cpus=1', '--pids-limit=64',
        '--tmpfs=/tmp:rw,nosuid,nodev,size=128m,mode=1777',
        '--mount', f'type=bind,src={binary},dst=/opt/public-cli/agy,readonly',
        '--entrypoint=/usr/bin/python', IMAGE, '-I', '-B', '-']
try:
    result = run(args, 30, INNER.encode())
    (ROOT / 'control-stderr.log').write_bytes(result.stderr)
    assert result.returncode == 0, 'isolated_CLI_control_failed'
    control = json.loads(result.stdout)
    assert control['binary_sha512'] == DIGEST
    report['control'] = control
    report['control_stderr_bytes'] = len(result.stderr)
    report['status'] = 'passed' if (control['commands'][0]['exact_pinned_version_reported']
        and all(c['exit_code'] == 0 and c['bounded_failure'] is None for c in control['commands'])
        and control['commands'][1]['all_required_runtime_options_documented']) else 'failed_compatibility_or_deadline'
except BaseException:
    report['status'] = 'failed_control'
    raise
finally:
    # This exact, uniquely named account-free container is the only cleanup target.
    run(['docker', 'rm', '-f', name])
    report['disposable_container_remaining'] = bool(run(['docker', 'ps', '-a', '--filter', 'name=^/' + name + '$', '--format', '{{.ID}}']).stdout.strip())
    report['runtime_operational_after'] = current()
    report['runtime_operational_unchanged'] = before == report['runtime_operational_after']
    report['finished_at_utc'] = datetime.now(timezone.utc).isoformat()
    (ROOT / 'report.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report))
