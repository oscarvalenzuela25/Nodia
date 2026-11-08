"""Pinned Client/nginx adoption and prepared reversal; R07 backend untouched."""
import argparse,hashlib,importlib.util,json,os,re,stat,subprocess,sys,time,urllib.error,urllib.parse,urllib.request
from pathlib import Path,PurePosixPath
CLIENT=Path('/opt/nodia/releases/nodia-client-ai40-nginx-r01')
MANIFEST='5e30dc8ee9879eab0aed715ea76226efc6da0cb910eee2b254ce260a5bf194e0'
SITE=Path('/etc/nginx/sites-available/nodia-lab')
ORIGINAL='2f96d9f04d2bc2eba6e1d8bc126ec7d4a5c5b5202bfa3238d87d23e94c52a857'
WORK=Path('/opt/nodia/verification/ai40-client-nginx-operator-r01/work')
PROOFS={'mcp':'970510a8b38137e3168c74c8322bd33b90994659523977d492339cba6501cf0a','mcp-image-png':'6f72f27340f46a397954b6a6e2b024fd117a617cfbe7cddd64ab429c6f030cc7','mcp-image-jpeg':'7f196301cd8cc616f090d478622e59f4a0eb60d86b5400f2bb1e4e4decaefff5','mcp-image-webp':'b33981d06c07e487c841a088c938446fb8920b00a646509e401fbe8beb08a35c'}
HASHED=re.compile(r'^assets/[^/]+-[A-Za-z0-9_-]{8,}\.[A-Za-z0-9]+$')
PATCH=('root '+str(CLIENT/'dist')+r''';
    index index.html;
    location = /index.html {
        add_header Cache-Control "no-cache" always;
        add_header Cross-Origin-Opener-Policy same-origin-allow-popups always;
    }
    location ~ "^/assets/[^/]+-[A-Za-z0-9_-]{8,}\.[A-Za-z0-9]+$" {
        try_files $uri =404;
        add_header Cache-Control "public, max-age=31536000, immutable";
        add_header Cross-Origin-Opener-Policy same-origin-allow-popups always;
    }
    location /assets/ {
        try_files $uri =404;
        add_header Cache-Control "no-cache" always;
        add_header Cross-Origin-Opener-Policy same-origin-allow-popups always;
    }
    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-cache" always;
        add_header Cross-Origin-Opener-Policy same-origin-allow-popups always;
    }''').encode()
def require(ok,code):
 if not ok:raise ValueError(code)
def sha(b):return hashlib.sha256(b).hexdigest()
def load(path,pin,name):
 p=Path(path);require(p.is_file()and not p.is_symlink()and sha(p.read_bytes())==pin,'dependency_changed')
 spec=importlib.util.spec_from_file_location(name,p);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
def command(argv):
 p=subprocess.run(argv,capture_output=True,timeout=20);require(p.returncode==0,'nginx_command_failed');return p.stdout
def package():
 require(CLIENT.resolve()==CLIENT and CLIENT.stat().st_uid==0 and sha((CLIENT/'manifest.json').read_bytes())==MANIFEST,'client_manifest_changed')
 m=json.loads((CLIENT/'manifest.json').read_bytes());require(m['schema']=='nodia-ai-ai40-client-nginx-package-v1'and len(m['files'])==172 and m['build']['api_url']=='/api/v1'and m['build']['base']=='/'and m['build']['expected_browser_origin']=='http://localhost:5174','client_contract_changed')
 actual=set()
 for p in CLIENT.rglob('*'):
  info=p.lstat();require(not p.is_symlink()and info.st_uid==0 and info.st_mode&0o022==0,'client_file_identity_changed')
  if p.is_file():actual.add(p.relative_to(CLIENT).as_posix())
 require(actual=={'manifest.json'}|{'dist/'+n for n in m['files']},'client_inventory_changed')
 for name,v in m['files'].items():
  p=PurePosixPath(name);require(not p.is_absolute()and '..'not in p.parts and str(p)==name and '\\'not in name,'client_path_invalid')
  b=(CLIENT/'dist'/name).read_bytes();require(len(b)==v['bytes']and sha(b)==v['sha256'],'client_file_changed')
 return m
def snapshot():
 g=load('/opt/nodia/verification/ai40-r07-mcp-operator-r01/nodia-ai-ai40-r07-mcp-operator-r01.py','753acf4f71bd4e569f8c6b9266fa572a175d234716387ebf6a944513d6898f58','client_R07_guard')
 h=load(g.HELPER,g.HELPER_SHA,'client_public_guard');h.ACTIVE=g.RELEASE;h.validate_candidate(g.LEGACY_MANIFEST_SHA);g.validate_release()
 status=load('/opt/nodia/verification/ai40-journal-status-read-r01/nodia-ai-ai40-journal-status-read-r01.py','5e5b710b0210e82228593401f0480e54970666ef4151251e930c16bb85da6c38','client_status_guard')
 images=load('/opt/nodia/verification/ai40-r06-image-operator-r01/nodia-ai-ai40-r06-image-operator-r01.py','b048369c1abe3b31df801bf1e94b70462dfca4196f14d276387da737cdb38355','client_proof_guard')
 services={n:h.service(n)for n in('nodia-api','nodia-ai-worker','nodia-keyring')};require([services[n]['pid']for n in services]==[3630848,3630849,3630841],'services_changed')
 events=[];public=status.public_preflight(h,services,events);sql=public['SQL']
 require(all(sql[k]==v for k,v in {'messages':30,'runs':16,'dispatches':20,'executions':1,'effect_receipts':1,'financial_effects':1}.items()),'operational_chat_changed')
 env=h.selected_environment(services['nodia-api']['pid'],{'DOTENV_CONFIG_PATH','POSTGRES_HOST','POSTGRES_PORT','POSTGRES_DB','POSTGRES_USER','POSTGRES_PASSWORD','POSTGRES_SSL'})
 r=h.command(['/usr/local/bin/node','--input-type=module','-e',(h.CANDIDATE.parent/'public-canary-input.mjs').read_text()],cwd=g.RELEASE,env={'PATH':'/usr/local/bin:/usr/bin:/bin','HOME':'/root','AI40_CONNECTION_ID':'1',**env},timeout=25)
 require(r.returncode==0 and sha(r.stdout)=='506e4c436bc22152c9aa632565d470450206d5ffdb1c9b976c0d0c7b5116f8b2','public_configuration_changed')
 proofs=images.proof_snapshot(h,json.loads(r.stdout)['selection'],g.EXPECTED_RUNTIME_FINGERPRINT);require({k:v.get('sha256')for k,v in proofs.items()}==PROOFS,'current_proofs_changed')
 protected={}
 for n in('nginx','nodia-gemini-lab'):
  v=dict(line.split('=',1)for line in command(['systemctl','show',n,'--property=MainPID,ActiveState,Type,RemainAfterExit','--no-pager']).decode().splitlines()if'='in line);require(v['ActiveState']=='active','protected_service_not_active');protected[n]=v
 epoch=sha(command(['docker','inspect','--format','{{json .Id}} {{json .Image}} {{json .State.StartedAt}} {{json .State.Running}}','c4814c5a184b55cd95c751ed904d0c957c0311148f8732169928ce6c3b2d5bd3']))
 return {'services':services,'protected':protected,'Gemini_epoch_sha256':epoch,'SQL':sql,'physical_Codex':public['codex'],'public_configuration_sha256':sha(r.stdout),'proof_sha256':PROOFS,'scope':proofs['mcp']['scope'],'status_read_attempts':events}
def exclusive(path,b):
 fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
 with os.fdopen(fd,'wb')as f:f.write(b);f.flush();os.fsync(f.fileno())
 d=os.open(path.parent,os.O_RDONLY|os.O_DIRECTORY)
 try:os.fsync(d)
 finally:os.close(d)
def replace_site(b):
 temp=SITE.with_name('nodia-lab.ai40-client-new');require(not temp.exists(),'temporary_config_exists')
 fd=os.open(temp,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o644)
 with os.fdopen(fd,'wb')as f:f.write(b);f.flush();os.fsync(f.fileno())
 os.replace(temp,SITE)
 d=os.open(SITE.parent,os.O_RDONLY|os.O_DIRECTORY)
 try:os.fsync(d)
 finally:os.close(d)
def http(path):
 request=urllib.request.Request('http://127.0.0.1:8080'+path,headers={'Host':'localhost:5174','Connection':'close'})
 try:
  with urllib.request.urlopen(request,timeout=5)as r:return r.status,r.read(20*1024*1024+1),r.headers
 except urllib.error.HTTPError as r:return r.code,r.read(65537),r.headers
def verify_http(m,adopted):
 target=m['files']['index.html']['sha256'];deadline=time.monotonic()+20;settled=0
 while time.monotonic()<deadline:
  code,b,headers=http('/');settled=settled+1 if(code==200 and sha(b)==target if adopted else code==404)else 0
  if settled==2:break
  time.sleep(.25)
 require(settled==2,'nginx_http_not_settled');require(http('/api/v1/')[0]==200,'API_proxy_failed')
 if not adopted:return {'root_status':404,'API_status':200,'compiled_files_served':0}
 require(headers.get('Cache-Control')=='no-cache'and headers.get('Cross-Origin-Opener-Policy')=='same-origin-allow-popups','HTML_headers_invalid')
 require(http('/tools/nodia-ai?chat=ec626b72-1f32-4486-9f3a-8263cffce267')[0:2]==(200,(CLIENT/'dist/index.html').read_bytes()),'SPA_deep_link_invalid')
 require(http('/assets/ai40-missing-AAAAAAAA.js')[0]==404,'missing_asset_was_SPA')
 for name,v in m['files'].items():
  code,b,headers=http('/'+urllib.parse.quote(name,safe='/'));require(code==200 and len(b)==v['bytes']and sha(b)==v['sha256'],'served_client_file_changed')
  require(headers.get('Cache-Control')==('public, max-age=31536000, immutable'if HASHED.fullmatch(name)else'no-cache'),'cache_policy_invalid')
  types={'.js':{'application/javascript','text/javascript'},'.css':{'text/css'},'.svg':{'image/svg+xml'},'.woff':{'font/woff'},'.woff2':{'font/woff2'}}
  suffix=PurePosixPath(name).suffix.lower()
  if suffix in types:require(headers.get('Content-Type','').split(';',1)[0].strip().lower()in types[suffix],'served_client_MIME_invalid')
 return {'root_status':200,'API_status':200,'deep_link_SHA_matches':True,'missing_asset_status':404,'compiled_files_served':len(m['files']),'JS_CSS_SVG_font_MIME_verified':True,'public_origin_to_verify_in_browser':'http://localhost:5174'}
def run(a):
 require(os.getuid()==0 and not sys.flags.optimize,'unoptimized_root_required');sys.dont_write_bytecode=True
 require(sha(Path(__file__).resolve().read_bytes())==a.operator_sha256,'operator_changed')
 require(WORK.resolve()==WORK and WORK.is_dir()and WORK.stat().st_uid==0 and stat.S_IMODE(WORK.stat().st_mode)==0o700,'private_work_required')
 m=package();before=snapshot();current=SITE.read_bytes();require(not SITE.is_symlink()and SITE.stat().st_uid==0 and stat.S_IMODE(SITE.stat().st_mode)==0o644,'site_identity_changed')
 if a.phase in('preflight','adopt'):
  require(sha(current)==ORIGINAL and current.count(b'location / { return 404; }')==1,'original_site_changed');desired=current.replace(b'location / { return 404; }',PATCH)
 else:
  original=(WORK/'original-site.conf').read_bytes();require(sha(original)==ORIGINAL and current==original.replace(b'location / { return 404; }',PATCH),'adopted_site_changed');desired=original
 require(current.count(b'client_max_body_size 20m;')==1 and desired.count(b'client_max_body_size 20m;')==1,'upload_limit_changed')
 report={'schema':'nodia-ai-ai40-client-nginx-operator-v1','phase':a.phase,'status':'preflight_passed','operator_sha256':a.operator_sha256,'manifest_sha256':MANIFEST,'site_before_sha256':sha(current),'site_target_sha256':sha(desired),'before':before,'SDK_requests':0,'SQL_writes':0,'API_worker_restarted':False,'automatic_retry_allowed':False}
 if a.phase=='preflight':require(not a.execute,'preflight_execute_invalid');return report
 require(a.execute and not(WORK/(a.phase+'-intent.json')).exists()and not(WORK/(a.phase+'-receipt.json')).exists(),'execute_or_fresh_intent_required')
 if a.phase=='adopt':exclusive(WORK/'original-site.conf',current)
 exclusive(WORK/(a.phase+'-intent.json'),json.dumps(report).encode());report['status']='operation_failed'
 try:
  replace_site(desired)
  try:command(['nginx','-t'])
  except Exception:
   replace_site(current);command(['nginx','-t']);report['invalid_config_restored_before_reload']=True;raise
  command(['systemctl','reload','nginx']);report['HTTP']=verify_http(m,a.phase=='adopt');after=snapshot()
  require({k:v for k,v in after.items()if k!='status_read_attempts'}=={k:v for k,v in before.items()if k!='status_read_attempts'},'backend_or_profile_changed')
  require(SITE.read_bytes()==desired,'site_changed_after_reload');report.update(status='adopted_verified'if a.phase=='adopt'else'reverted_verified',after=after)
 finally:exclusive(WORK/(a.phase+'-receipt.json'),json.dumps(report,sort_keys=True).encode()+b'\n')
 return report
if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--operator-sha256',required=True);p.add_argument('--phase',choices=('preflight','adopt','revert'),required=True);p.add_argument('--execute',action='store_true');a=p.parse_args()
 try:print(json.dumps(run(a)))
 except Exception as e:
  code=str(e);print(json.dumps({'schema':'nodia-ai-ai40-client-nginx-operator-v1','status':'operation_failed','phase':a.phase,'code':code if isinstance(e,ValueError)and re.fullmatch('[A-Za-z_]{1,100}',code)else'private_dependency_or_protocol_failure','no_automatic_retry':True,'private_details_emitted':False}));sys.exit(1)
