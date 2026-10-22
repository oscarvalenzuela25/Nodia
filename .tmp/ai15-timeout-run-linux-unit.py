import json,subprocess,uuid
name='nodia-ai15-python-unit-'+uuid.uuid4().hex[:10]
image='sha256:e1fcee82dd54afbb0d386e406169f85613085a5b1cdb8a3148962409a0b4a695'
created=False
try:
 subprocess.run(['docker','create','--name',name,'--network','none','--entrypoint','sh',image,'-c','tar -xzf /tmp/nodia-ai15-unit-tests.tar.gz -C /app && python /app/run_tests.py'],check=True,stdout=subprocess.PIPE);created=True
 subprocess.run(['docker','cp','/tmp/ai15-timeout-deploy/python-tests.tar.gz',name+':/tmp/nodia-ai15-unit-tests.tar.gz'],check=True)
 result=subprocess.run(['docker','start','--attach',name],stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
 print(result.stdout.decode('utf-8',errors='replace'))
 state=json.loads(subprocess.check_output(['docker','inspect',name]))[0]
 assert state['HostConfig']['NetworkMode']=='none' and not state['Mounts']
 print(json.dumps({'container':name,'network':'none','mounts':0,'exit_code':state['State']['ExitCode'],'image':image,'production_bridge_restarted':False}))
 if state['State']['ExitCode']!=0:raise SystemExit(state['State']['ExitCode'])
finally:
 if created:subprocess.run(['docker','rm',name],check=True,stdout=subprocess.PIPE)



