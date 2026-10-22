import concurrent.futures,json,os,subprocess,sys,time
from datetime import datetime,timezone
from urllib.parse import urlsplit
hosts=['gemini.google.com','accounts.google.com','cloudcode-pa.googleapis.com','daily-cloudcode-pa.googleapis.com']
contexts=[('host',dict(os.environ))]
if len(sys.argv)>1 and sys.argv[1]=='container':
 sys.path.insert(0,'/app')
 from agentic_cli import cli_environment
 from pathlib import Path
 contexts=[('container',dict(os.environ)),('cli_environment',cli_environment(Path('/home/nodia/agentic_profile'),os.environ))]
keys=['HTTP_PROXY','HTTPS_PROXY','ALL_PROXY','NO_PROXY','http_proxy','https_proxy','all_proxy','no_proxy','SSL_CERT_FILE','SSL_CERT_DIR','REQUESTS_CA_BUNDLE','CURL_CA_BUNDLE']
fields=['http_code','time_namelookup','time_connect','time_appconnect','time_starttransfer','time_total','ssl_verify_result','num_connects']
def probe(pair):
 label,env,host=pair
 cmd=['curl','--head','--silent','--output','/dev/null','--connect-timeout','3','--max-time','8','--write-out','%{json}','https://'+host+'/']
 try:
  p=subprocess.run(cmd,env=env,capture_output=True,timeout=10,check=False)
  d=json.loads(p.stdout)
  return dict(context=label,host=host,exit_code=p.returncode,**{k:d.get(k) for k in fields})
 except subprocess.TimeoutExpired:return dict(context=label,host=host,exit_code=None,error_category='process_timeout')
 except (ValueError,OSError):return dict(context=label,host=host,exit_code=None,error_category='probe_failed')
print(json.dumps({'checked_at':datetime.now(timezone.utc).isoformat(),'env_presence':{label:{k:bool(env.get(k)) for k in keys} for label,env in contexts},'probes':list(concurrent.futures.ThreadPoolExecutor(max_workers=3).map(probe,[(label,env,host) for label,env in contexts for host in hosts]))}))
