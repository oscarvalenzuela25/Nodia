"""Root VM launcher: read-only operational metadata; actual canary on disposable SQL.
No credential values emitted, copied or passed as command arguments.
"""
import sys,os,json,subprocess,pathlib
release=pathlib.Path('/opt/nodia/releases/nodia-server-ai40-r01')
source=sys.stdin.read()
def run():
 pid=subprocess.check_output(['systemctl','show','nodia-api','--property=MainPID','--value'],text=True).strip()
 assert pathlib.Path('/proc/'+pid+'/cwd').resolve()==release
 raw=pathlib.Path('/proc/'+pid+'/environ').read_bytes().split(b'\0')
 actual={p.split(b'=',1)[0].decode():p.split(b'=',1)[1].decode() for p in raw if b'=' in p}
 assert actual.get('TZ') in (None,'UTC','Etc/UTC'), 'service_timezone_requires_review'
 config_env={'PATH':'/usr/local/bin:/usr/bin:/bin','HOME':'/root','DOTENV_CONFIG_PATH':actual['DOTENV_CONFIG_PATH'],'AI40_CONNECTION_ID':'1'}
 config_env.update({k:v for k,v in actual.items() if k.startswith('POSTGRES_')})
 read=subprocess.run(['/usr/local/bin/node','--input-type=module','-e',source],cwd=release,env=config_env,capture_output=True,timeout=20)
 assert read.returncode==0,'public_metadata_read_failed'
 config=json.loads(read.stdout)
 assert config['selection']['connection_id']=='1'
 env={'PATH':'/usr/local/bin:/usr/bin:/bin','HOME':'/root','NODIA_CODEX_ENABLED':'true',
 'NODIA_CODEX_PROFILE_ROOT':'/var/lib/nodia/codex','DBUS_SESSION_BUS_ADDRESS':actual['DBUS_SESSION_BUS_ADDRESS'],
 'XDG_RUNTIME_DIR':actual['XDG_RUNTIME_DIR']}
 result=subprocess.run(['/usr/local/bin/node',str(release/'test/nodia-ai-ai40-real-canary-parent.mjs')],
 cwd=release,env=env,input=read.stdout,capture_output=True,timeout=370)
 # The parent is a strict safe receipt. Never forward raw native stderr.
 receipt=json.loads(result.stdout)
 assert receipt['schema']=='nodia-ai-ai40-real-canary-parent-v1'
 print(json.dumps(receipt))
 return result.returncode
try: sys.exit(run())
except Exception as e:
 print(json.dumps({'stage':'AI40','status':'launcher_failed','error_class':type(e).__name__,'private_details_emitted':False,'generation_not_replayed':True}))
 sys.exit(1)
