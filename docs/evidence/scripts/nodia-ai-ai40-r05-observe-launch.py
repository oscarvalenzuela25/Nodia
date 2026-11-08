import hashlib,json,pathlib,pwd,subprocess,sys
release=pathlib.Path('/opt/nodia/releases/nodia-server-ai40-r05');script=pathlib.Path('/opt/nodia/verification/ai40-r05-operator-r01/nodia-ai-ai40-r05-observe.mjs')
assert hashlib.sha256(script.read_bytes()).hexdigest()==sys.argv[1]
def pid(unit):
 r=subprocess.run(['systemctl','show',unit,'--property=MainPID','--value'],capture_output=True,check=True,timeout=10)
 return r.stdout.decode().strip()
def selected(pid,keys):
 result={}
 for p in pathlib.Path('/proc',pid,'environ').read_bytes().split(b'\0'):
  k,s,v=p.partition(b'=')
  if s and k.decode('ascii',errors='ignore') in keys:result[k.decode()]=v.decode()
 return result
api=pid('nodia-api');worker=pid('nodia-ai-worker');assert pathlib.Path('/proc',api,'cwd').resolve()==release==pathlib.Path('/proc',worker,'cwd').resolve()
keys={'DOTENV_CONFIG_PATH','POSTGRES_HOST','POSTGRES_PORT','POSTGRES_DB','POSTGRES_USER','POSTGRES_PASSWORD','POSTGRES_SSL','NODIA_CODEX_ENABLED','NODIA_CODEX_PROFILE_ROOT'}
env={'PATH':'/usr/local/bin:/usr/bin:/bin','HOME':pwd.getpwnam('nodia').pw_dir,**selected(api,keys),**selected(pid('nodia-keyring'),{'DBUS_SESSION_BUS_ADDRESS','XDG_RUNTIME_DIR'})}
r=subprocess.run(['/usr/sbin/runuser','--preserve-environment','-u','nodia','--','/usr/local/bin/node',str(script)],cwd=release,env=env,capture_output=True,check=False,timeout=75)
assert len(r.stdout)<16384
receipt=json.loads(r.stdout);assert receipt['schema']=='nodia-ai-ai40-r05-active-observation-v1'
print(json.dumps(receipt));sys.exit(r.returncode)
