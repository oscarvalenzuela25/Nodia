"""One account-free version command for the binary mounted by the current epoch."""
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import subprocess

ROOT = Path('/opt/nodia/verification/ai36-c05-r05-binary-observation01')
assert not ROOT.exists()
ROOT.mkdir(mode=0o700)
EXPECTED_IMAGE = 'sha256:1a483f3f72de21374e9ba2546dba2df5e07e5a5e7bd4a159a5ee6ca7a444a3fb'
EXPECTED_SHA = 'f57ad0a04c93e1d13b86bd13c4f35b6577bc0557e6bfd718e9f3a2bdb4504240113f6bbcfefad9f039eb1d5e7e23e0a2623b4b7687882eca86954e485ad9f9c2'

def run(args, timeout=15, data=None):
    return subprocess.run(args, capture_output=True, check=False, timeout=timeout, input=data)

before = json.loads(run(['docker', 'inspect', 'nodia-gemini-microservice']).stdout)[0]
assert before['Image'] == EXPECTED_IMAGE and before['State']['Running']
env = dict(value.split('=', 1) for value in before['Config']['Env'])
assert len(env) == len(before['Config']['Env'])
assert env['ANTIGRAVITY_CLI_SHA512'] == EXPECTED_SHA
assert env.get('ANTIGRAVITY_CLI_VERSION', '1.3.1') == '1.3.1'
target = env['ANTIGRAVITY_CLI_PATH']
assert Path(target).is_absolute() and len(before['Mounts']) == 6
assert all(not Path(target).is_relative_to(m['Destination']) for m in before['Mounts'])
inner = r'''
import hashlib,json,os,signal,subprocess,sys,tempfile,time
from pathlib import Path
binary,expected=sys.argv[1:3]
assert Path(binary).is_absolute()
actual=hashlib.file_digest(Path(binary).open('rb'),'sha512').hexdigest()
assert actual==expected
with tempfile.TemporaryDirectory(prefix='version-only-',dir='/tmp') as home:
 env={'HOME':home,'PATH':'/usr/local/bin:/usr/bin:/bin','LANG':'C.UTF-8','TERM':'dumb','AGY_CLI_DISABLE_AUTO_UPDATE':'1'}
 start=time.monotonic();p=subprocess.Popen([binary,'--version'],stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.PIPE,env=env,cwd=home,start_new_session=True)
 try:out,err=p.communicate(timeout=4)
 except subprocess.TimeoutExpired:
  os.killpg(p.pid,signal.SIGKILL);p.communicate();raise RuntimeError('version_timeout') from None
 assert p.returncode==0 and out.strip()==b'1.3.1' and len(err)<=512
 print(json.dumps({'binary_version':'1.3.1','binary_sha512':actual,'version_command_exit_code':p.returncode,'version_command_elapsed_ms':round((time.monotonic()-start)*1000,3),'stdout_bytes':len(out),'stderr_bytes':len(err),'inferences':0,'operational_profile_access':False}))
'''
name = 'nodia-c05-r05-binary-observation01'
args = ['docker', 'run', '--rm', '-i', '--name', name, '--network=none', '--read-only', '--cap-drop=ALL',
        '--security-opt=no-new-privileges', '--user=10001:10001', '--memory=1g', '--cpus=1', '--pids-limit=64',
        '--tmpfs=/tmp:rw,nosuid,nodev,size=32m,mode=1777',
        '--entrypoint=/usr/bin/python', EXPECTED_IMAGE, '-I', '-B', '-', target, EXPECTED_SHA]
report = {'stage': 'AI-36-C05-R05', 'scope': 'effective_epoch_binary_digest_and_one_same_image_account_free_version_command',
          'status': 'running', 'image_id': before['Image'], 'container_id': before['Id'],
          'container_started_at': before['State']['StartedAt'], 'binary_sha512': EXPECTED_SHA,
          'source_sha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
          'binary_inside_exact_readonly_image_no_binary_or_operational_mounts': True,
          'effective_environment_exact_baseline_pin': True,
          'version_command_network': 'none', 'version_command_HOME': 'new_empty_temporary_directory',
          'version_command_environment': 'closed_allowlist_no_XDG_or_credentials', 'provider_inferences': 0}
try:
    result = run(args, 12, inner.encode())
    assert result.returncode == 0, 'account_free_version_observation_failed'
    observed = json.loads(result.stdout)
    report.update(observed)
    report['status'] = 'passed'
finally:
    run(['docker', 'rm', '-f', name])
    after = json.loads(run(['docker', 'inspect', 'nodia-gemini-microservice']).stdout)[0]
    report['same_epoch_after_observation'] = (after['Id'], after['Image'], after['State']['StartedAt']) == (before['Id'], before['Image'], before['State']['StartedAt'])
    report['observed_at_utc'] = datetime.now(timezone.utc).isoformat()
    (ROOT / 'report.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report))
