"""Offline CLI option control. Host runner: no provider profile or service imports."""
import hashlib
import json
import subprocess
import sys
from uuid import uuid4

IMAGE = 'sha256:b110dbdc78b0f6ec80c98d7ca5c0afe8e8e7fab3a9c46dc60b7eeee0f6855532'
BINARY_SHA512 = 'f57ad0a04c93e1d13b86bd13c4f35b6577bc0557e6bfd718e9f3a2bdb4504240113f6bbcfefad9f039eb1d5e7e23e0a2623b4b7687882eca86954e485ad9f9c2'
INNER = r'''import hashlib,json,os,re,signal,subprocess,sys,tempfile,time
from pathlib import Path
binary,model,expected = sys.argv[1:4]
p=Path(binary)
assert hashlib.file_digest(p.open('rb'),'sha512').hexdigest()==expected
results=[]
for effort in ('high','low'):
 with tempfile.TemporaryDirectory(prefix='empty-cli-home-') as home:
  env={'PATH':'/usr/bin:/bin','HOME':home,'USERPROFILE':home,'AGY_CLI_DISABLE_AUTO_UPDATE':'1','LANG':'C.UTF-8'}
  argv=[binary,'-p','/model','--model',model,'--effort',effort,'--output-format','json','--print-timeout','10s']
  started=time.monotonic()
  proc=subprocess.Popen(argv,cwd=home,env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True)
  timed_out=False
  try: out,err=proc.communicate(timeout=10)
  except subprocess.TimeoutExpired:
   timed_out=True
   os.killpg(proc.pid,signal.SIGKILL)
   out,err=proc.communicate()
  text=(out+err).decode('utf-8',errors='replace')
  categories=[]
  if re.search(r'--model [^\r\n]{0,256} conflicts with --effort=',text):categories.append('model_effort_conflict')
  if re.search(r'--effort(?:=[^\r\n ]+)? is not supported for model',text):categories.append('effort_unsupported')
  if 'invalid --effort ' in text:categories.append('invalid_effort')
  if re.search(r'(?i)(not authenticated|authentication required|login required|please (?:log|sign) in|not logged in|no credentials|not signed in)',text):categories.append('authentication_required_indicator')
  if timed_out:categories.append('deadline_exceeded')
  observed=None
  try:
   value=json.loads(out)
   if value.get('status')=='SUCCESS' and value.get('num_turns')==0 and value.get('usage',{}).get('total_tokens')==0 and value.get('command',{}).get('name')=='model':
    identity=value['command']['data'].get('id')
    if isinstance(identity,str) and 0<len(identity)<=1024:observed=identity
  except (ValueError,AttributeError,KeyError,TypeError):pass
  results.append({'requested_effort':effort,'elapsed_ms':round((time.monotonic()-started)*1000),'exit_code':proc.returncode,'timed_out':timed_out,'stdout_bytes':len(out),'stderr_bytes':len(err),'closed_text_indicators':categories,'valid_zero_token_model_report':observed is not None,'reported_model_id':observed,'reported_model_matches_exact_request':observed==model if observed else None})
  if 'authentication_required_indicator' in categories:break
print(json.dumps({'binary_sha512':expected,'runs':results,'text_indicators_are_not_verified_causes':True,'provider_generations':0,'network_mode':'none','profile_mounts':0,'service_environment_forwarded':False,'application_imports':0,'raw_text_persisted':False}))
'''

if __name__ == '__main__':
    config=json.load(sys.stdin)
    assert set(config)=={'model_id'} and isinstance(config['model_id'],str) and 0<len(config['model_id'])<=1024
    inspect=subprocess.run(['sudo','-n','docker','inspect','--format','{{.Image}}','nodia-gemini-microservice'],capture_output=True,text=True,check=True)
    assert inspect.stdout.strip()==IMAGE
    metadata="import os,json; print(json.dumps({'binary':os.environ['ANTIGRAVITY_CLI_PATH']}))"
    meta=subprocess.run(['sudo','-n','docker','exec','nodia-gemini-microservice','/usr/bin/python','-I','-B','-c',metadata],capture_output=True,text=True,check=True)
    binary=json.loads(meta.stdout)['binary']
    assert binary.startswith('/') and '\n' not in binary
    name='nodia-c05-offline-effort-'+uuid4().hex
    args=['sudo','-n','docker','run','--rm','--name',name,'--network','none','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges','--pids-limit','32','--memory','512m','--cpus','1','--tmpfs','/tmp:rw,nosuid,nodev,size=64m','--entrypoint','/usr/bin/env',IMAGE,'-i','PATH=/usr/bin:/bin','/usr/bin/python','-I','-B','-c',INNER,binary,config['model_id'],BINARY_SHA512]
    try:
        result=subprocess.run(args,capture_output=True,text=True,timeout=28)
        assert result.returncode==0, 'isolated_control_bootstrap_failed'
        report=json.loads(result.stdout)
        report.update({'stage':'AI-36-C05','scope':'offline_same_image_empty_home_no_network_CLI_option_control','image_id':IMAGE,'source_sha256':hashlib.sha256(__import__('pathlib').Path(__file__).read_bytes()).hexdigest(),'runtime_services_restarted':False,'stored_configuration_changed':False})
        print(json.dumps(report,indent=2))
    finally:
        subprocess.run(['sudo','-n','docker','rm','-f',name],capture_output=True,text=True,timeout=8)
