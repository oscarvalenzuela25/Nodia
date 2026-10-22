"""Stage/build/test Gemini R03 only. Never retag/restart the active service."""
from pathlib import Path
import hashlib
import json
import shutil
import subprocess
import sys

root = Path(__file__).resolve().parents[1]
options = ['-i','C:/Users/Oscar/Documents/NodiaVMs/keys/nodia-vps-lab',
    '-o','UserKnownHostsFile=C:/Users/Oscar/Documents/NodiaVMs/keys/nodia-vps-lab-known_hosts',
    '-o','HostKeyAlias=nodia-vps-lab','-o','StrictHostKeyChecking=yes']
host = 'operador@172.31.209.214'
remote = '/tmp/nodia-ai32-r03-native-candidate'
python = root/'nodia-gemini-microservice/.venv/Scripts/python.exe'
with (root/'nodia-server/.tmp/ai32-r03-native-build.log').open('wb') as log:
    subprocess.run([str(python), str(root/'nodia-server/.tmp/ai32-r03-stage-native.py')],
                   check=True, stdout=log, stderr=subprocess.STDOUT)
copies = [
    (root/'.tmp/ai32-r03-activate-gemini.py', remote+'/ai32-r03-activate-gemini.py'),
    (root/'.tmp/ai32-r03-cleanup.py', '/tmp/ai32-r03-cleanup.py'),
    (root/'.tmp/ai32-r03-final-health.py', '/tmp/ai32-r03-final-health.py'),
    (root/'.tmp/ai15-timeout-quiet.mjs', remote+'/quiet.mjs'),
    (root/'nodia-server/.tmp/ai32-r03-native-manifest.json', '/tmp/ai32-r03-final-source-manifest.json'),
]
for source, destination in copies:
    subprocess.run(['scp',*options,str(source),host+':'+destination],check=True)
command = ['ssh', *options, host, 'sudo -n docker run --rm --network none --read-only '
    '--tmpfs /tmp:rw,size=96m,nosuid,nodev,noexec --memory 512m --cpus 1 '
    'nodia-gemini-ai32-r03-candidate:20261018 python run_tests.py']
test_log = root/'nodia-server/.tmp/ai32-r03-linux-tests.log'
with test_log.open('wb') as log:
    subprocess.run(command, check=True, stdout=log, stderr=subprocess.STDOUT)
image = subprocess.check_output(['ssh',*options,host,
    "sudo -n docker image inspect nodia-gemini-ai32-r03-candidate:20261018 --format '{{.Id}}'"],text=True).strip()
manifest_path = root/'nodia-server/.tmp/ai32-r03-native-manifest.json'
report = {'stage':'AI-32-R03', 'scope':'candidate_staging_build_and_offline_tests',
    'candidate_image':image, 'native_source_files':len(json.loads(manifest_path.read_text(encoding='utf-8'))),
    'native_manifest_sha256':hashlib.sha256(manifest_path.read_bytes()).hexdigest(),
    'linux_test_log_sha256':hashlib.sha256(test_log.read_bytes()).hexdigest(),
    'linux_test_exit_code':0, 'active_container_restarted':False,
    'active_image_retagged':False,'provider_generations':0,'credential_files_copied':False}
(root/'.tmp/ai32-r03-build-result.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
print(json.dumps(report))
