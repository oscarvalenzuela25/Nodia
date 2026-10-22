"""One account-free version command for the binary mounted by the current epoch."""
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import subprocess

ROOT = Path('/opt/nodia/verification/ai36-c05-r04-binary-observation01')
assert not ROOT.exists()
ROOT.mkdir(mode=0o700)
EXPECTED_IMAGE = 'sha256:9482df4c8ad2db5d591e3f1ac76e2c7cdc2a8fe7b296fa76374dc139c234a47e'
EXPECTED_SHA = 'f63dd18d9aee3742055452c6eefbc22740ac4cb7bd7ad4c6b5cac2cccbd69d0548058ef5a3f7105d57146f7ce0a3ae07ef9dd89cde84dcac2cba64edc6f8dbdc'
TARGET = '/opt/nodia-cli/agy-1.4.2'

def run(args, timeout=15, data=None):
    return subprocess.run(args, capture_output=True, check=False, timeout=timeout, input=data)

before = json.loads(run(['docker', 'inspect', 'nodia-gemini-microservice']).stdout)[0]
assert before['Image'] == EXPECTED_IMAGE and before['State']['Running']
env = dict(value.split('=', 1) for value in before['Config']['Env'])
assert len(env) == len(before['Config']['Env'])
assert (env['ANTIGRAVITY_CLI_PATH'], env['ANTIGRAVITY_CLI_SHA512'], env['ANTIGRAVITY_CLI_VERSION']) == (TARGET, EXPECTED_SHA, '1.4.2')
mounts = [m for m in before['Mounts'] if m['Destination'] == TARGET]
assert len(mounts) == 1 and mounts[0]['Type'] == 'bind' and mounts[0]['RW'] is False
binary = Path(mounts[0]['Source'])
assert binary == Path('/opt/nodia/verification/ai36-c05-r04-cli-offline02/agy-1.4.2-linux.bin')
assert hashlib.sha512(binary.read_bytes()).hexdigest() == EXPECTED_SHA
inner = r'''
import json,os,signal,subprocess,tempfile,time
with tempfile.TemporaryDirectory(prefix='version-only-',dir='/tmp') as home:
 env={'HOME':home,'PATH':'/usr/local/bin:/usr/bin:/bin','LANG':'C.UTF-8','TERM':'dumb','AGY_CLI_DISABLE_AUTO_UPDATE':'1'}
 start=time.monotonic();p=subprocess.Popen(['/opt/public-cli/agy','--version'],stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.PIPE,env=env,cwd=home,start_new_session=True)
 try:out,err=p.communicate(timeout=4)
 except subprocess.TimeoutExpired:
  os.killpg(p.pid,signal.SIGKILL);p.communicate();raise RuntimeError('version_timeout') from None
 assert p.returncode==0 and out.strip()==b'1.4.2' and len(err)<=512
 print(json.dumps({'binary_version':'1.4.2','version_command_exit_code':p.returncode,'version_command_elapsed_ms':round((time.monotonic()-start)*1000,3),'stdout_bytes':len(out),'stderr_bytes':len(err),'inferences':0,'operational_profile_access':False}))
'''
name = 'nodia-c05-r04-binary-observation01'
args = ['docker', 'run', '--rm', '-i', '--name', name, '--network=none', '--read-only', '--cap-drop=ALL',
        '--security-opt=no-new-privileges', '--user=10001:10001', '--memory=1g', '--cpus=1', '--pids-limit=64',
        '--tmpfs=/tmp:rw,nosuid,nodev,size=32m,mode=1777', '--mount', f'type=bind,src={binary},dst=/opt/public-cli/agy,readonly',
        '--entrypoint=/usr/bin/python', EXPECTED_IMAGE, '-I', '-B', '-']
report = {'stage': 'AI-36-C05-R04', 'scope': 'effective_epoch_binary_digest_and_one_same_image_account_free_version_command',
          'status': 'running', 'image_id': before['Image'], 'container_id': before['Id'],
          'container_started_at': before['State']['StartedAt'], 'binary_sha512': EXPECTED_SHA,
          'source_sha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
          'mounted_binary_observed_readonly': True, 'effective_environment_exact_pin': True,
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
