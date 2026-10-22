import hashlib,json,os,subprocess,tarfile
from pathlib import Path
stage=Path('/tmp/ai29-r01-native-offline-diagnostics'); source=stage/'source';source.mkdir(exist_ok=True)
archive=stage/'sources.tar.gz'
with tarfile.open(archive) as tf:
 for item in tf.getmembers():
  if not item.isfile() or Path(item.name).is_absolute() or '..' in Path(item.name).parts: raise RuntimeError('archive scope invalid')
 tf.extractall(source,filter='data')
for path in [source,*source.rglob('*')]:
 if path.is_symlink(): raise RuntimeError('unexpected symlink')
 os.chown(path,10001,10001);path.chmod(0o755 if path.is_dir() else 0o644)
image='sha256:16830964869e9827d1b320c8ae6f913dce1ead37474bce279f53897845dc8c7a'
command=['docker','run','--rm','--name','ai29-r01-native-offline-diagnostics','--network','none','--read-only','--memory','805306368','--pids-limit','256','--user','10001:10001','--tmpfs','/tmp:rw,nosuid,nodev,size=268435456','--env','HOME=/tmp/test-home','--env','GEMINI_SECURE_1PSID=','--env','GEMINI_SECURE_1PSIDTS=','--env','GEMINI_SERVICE_TOKEN=','--env','ANTIGRAVITY_CLI_PATH=','--volume',str(source)+':/verification:rw','--workdir','/verification','--entrypoint','python',image,'run_tests.py']
print(json.dumps({'verification':'isolated Linux unit suite','image':image,'network':'none','uid':10001,'real_profile_mounts':False,'archive_sha256':hashlib.sha256(archive.read_bytes()).hexdigest()}),flush=True)
result=subprocess.run(command,check=False)
print(json.dumps({'unit_test_exit_code':result.returncode}),flush=True)
raise SystemExit(result.returncode)
