"""Read-only acceptance of current Gemini controls; never claims lost historical FULL parity."""
import hashlib,json,os,re,stat,subprocess,sys
from pathlib import Path
WORK=Path('/opt/nodia/verification/ai40-gemini-chat-recovery-adopt-r01')
CONTAINER='678d4f10274cf557590311af0bee81a7cb71be7015ec282a4154d48b71d6d38b'
IMAGE='sha256:15e8c319011ecfc7f792938cc4177ab0943af8894b204375bd1c1200728f935a'
MANIFEST=Path('/opt/nodia/verification/ai40-gemini-chat-recovery-build-r03/manifest.json')
MANIFEST_SHA='ed3ebaceceb90d6acd2acbbf86fc8a4b56b1b69782d210eae83a6e7b0b1e58ef'
BINDING=Path('/var/lib/nodia-login-containment/chat-bindings/c6cc8739-7de7-4c13-a5c9-6b230fb3b1de.json')
BINDING_SHA='fe2492548f2455d769e965070dea013ee89ccaaff25fc48ca6ba276e88403484'
RECORD_SHA='eec6a5f80405b2ba2a1510d7d5a3fd3bfe413a1dfee55256741d49da0865cf90'
PROOFS={'mcp':'a1f1ee2742324a87d8f96fc4207fb7845fa5deb51eb5d772d30faa6858e1eff0','mcp-image-png':'9a1848159f6e0756db7986233516e4fe6b6d180c37acf8fe26b6b0384cfea131','mcp-image-jpeg':'2b6426566681eaa95e0fa9a0c5686061069451a84f42c80a5967bd0608510772','mcp-image-webp':'744b7224928083c5703bc01a0e6575db9e10589a85b7dd86c43f99f4222e3c38'}
def require(value,code):
 if not value:raise ValueError(code)
def sha(raw):return hashlib.sha256(raw).hexdigest()
def encode(v):return json.dumps(v,sort_keys=True,separators=(',',':')).encode()
def command(argv):
 r=subprocess.run(argv,capture_output=True,timeout=35,check=False)
 require(r.returncode==0,'readonly_command_failed');return r.stdout
def private_file(path,pin=None,uid=0,mode=None,maximum=262144,trusted_proc_root=None):
 if trusted_proc_root is None:require(path.resolve()==path,'file_path_not_canonical')
 else:
  require(path.is_relative_to(trusted_proc_root),'proc_root_path_outside_candidate')
  for parent in path.parents:
   if parent==trusted_proc_root:break
   require(not parent.is_symlink(),'proc_parent_symlink')
 initial=path.lstat();require(stat.S_ISREG(initial.st_mode)and initial.st_uid==uid and initial.st_nlink==1 and not initial.st_mode&0o022 and initial.st_size<=maximum,'file_identity_changed')
 if mode is not None:require(stat.S_IMODE(initial.st_mode)==mode,'file_mode_changed')
 fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW|os.O_NONBLOCK)
 try:
  now=os.fstat(fd);require((now.st_dev,now.st_ino,now.st_uid,now.st_mode,now.st_nlink,now.st_size)==(initial.st_dev,initial.st_ino,initial.st_uid,initial.st_mode,initial.st_nlink,initial.st_size),'opened_file_identity_changed')
  with os.fdopen(fd,'rb',closefd=False)as stream:raw=stream.read(maximum+1)
 finally:os.close(fd)
 require(len(raw)<=maximum and(pin is None or sha(raw)==pin),'file_hash_or_size_changed');return raw
def process_status(pid):
 values=dict(line.split(':',1) for line in Path('/proc',str(pid),'status').read_text().splitlines() if ':'in line)
 out={'pid':pid,'comm':Path('/proc',str(pid),'comm').read_text().strip(),'uid':[int(v) for v in values['Uid'].split()],'NoNewPrivs':int(values['NoNewPrivs']),'CapEff':values['CapEff'].strip(),'CapPrm':values['CapPrm'].strip(),'CapAmb':values['CapAmb'].strip()}
 require(out['uid']==[10001]*4 and out['NoNewPrivs']==1 and all(int(out[k],16)==0 for k in ('CapEff','CapPrm','CapAmb')),'process_privilege_control_failed');return out
def snapshot():
 require(os.geteuid()==0 and sys.platform=='linux','linux_root_required')
 current=json.loads(command(['docker','inspect',CONTAINER]))[0];require(current['Id']==CONTAINER and current['Image']==IMAGE and current['State']['Running']and current['State']['Health']['Status']=='healthy','candidate_identity_or_health_changed')
 before_failure=json.loads(private_file(WORK/'adopt.json',mode=0o600));require(before_failure['status']=='operation_failed'and before_failure['failure_code']=='complete_host_containment_changed'and before_failure['operator_sha256']=='c07081ebfa6597dcf26235d3321b84c549ae67d08e9f33c84dfaf892ca38e5b7','failed_adoption_lineage_changed')
 hc=current['HostConfig'];require(not hc['Privileged']and not hc['PublishAllPorts']and not hc['CapAdd']and not hc['Devices']and not hc['DeviceRequests']and not hc['DeviceCgroupRules'],'device_or_privilege_control_failed')
 require(hc['CgroupnsMode']=='private'and hc['IpcMode']=='private'and all(hc[k]==''for k in ('PidMode','UTSMode','UsernsMode'))and hc['NetworkMode']not in ('host','none'),'namespace_control_failed')
 require(hc['SecurityOpt']==['no-new-privileges:true'],'no_new_privileges_option_changed')
 require(hc['PortBindings']=={'8000/tcp':[{'HostIp':'127.0.0.1','HostPort':'8000'}]},'non_loopback_or_new_port')
 labels=current['Config']['Labels'];require(labels['com.docker.compose.project']=='nodia-gemini-lab'and labels['com.docker.compose.service']=='nodia-gemini-microservice','compose_owner_changed')
 argv=['docker','compose','-p','nodia-gemini-lab'];files=[]
 for name in labels['com.docker.compose.project.config_files'].split(','):
  path=Path(name);raw=private_file(path,maximum=131072);files.append({'path':name,'sha256':sha(raw)});argv+=['-f',name]
 composed=json.loads(command([*argv,'config','--format','json']));service=composed['services']['nodia-gemini-microservice']
 require(service['image']==IMAGE and service['security_opt']==hc['SecurityOpt']and service['init']is hc['Init']and float(service['cpus'])*1e9==hc['NanoCpus']and service['mem_limit']==hc['Memory']and service['pids_limit']==hc['PidsLimit']and service['shm_size']==hc['ShmSize'],'declared_resource_control_failed')
 require(hc['Memory']==2147483648 and hc['NanoCpus']==2000000000 and hc['PidsLimit']==256 and hc['ShmSize']==268435456 and hc['Init']is True,'approved_resource_limits_changed')
 declared={x['target']:x for x in service['volumes']};mounts=[]
 require(len(current['Mounts'])==len(declared),'undeclared_mount_count')
 for m in current['Mounts']:
  d=declared[m['Destination']];require(m['Type']==d['type']=='bind'and m['Source']==d['source']and m['RW']==(not d.get('read_only',False)),'undeclared_mount_changed')
  require(not stat.S_ISSOCK(Path(m['Source']).stat().st_mode) and not any(x in (m['Source']+' '+m['Destination']).lower()for x in ('docker.sock','podman.sock','/var/run/docker','/run/docker')),'control_socket_mounted')
  mounts.append({'destination':m['Destination'],'type':m['Type'],'rw':m['RW'],'source_sha256':sha(m['Source'].encode())})
 pid=current['State']['Pid'];init=process_status(pid);children=[int(x)for x in Path('/proc',str(pid),'task',str(pid),'children').read_text().split()]
 app=[]
 for child in children:
  proc=process_status(child)
  if proc['comm']in ('uvicorn','python','python3','python3.13','python3.12','python3.11'):app.append(proc)
 require(len(app)==1,'single_application_process_not_verified')
 for ns in ('pid','net','ipc','uts','cgroup'):require(os.readlink('/proc/'+str(pid)+'/ns/'+ns)!=os.readlink('/proc/1/ns/'+ns),'host_namespace_shared')
 root=Path('/proc')/str(pid)/'root';cert_raw=private_file(root/'run/nodia-login-containment.json',mode=0o444,maximum=32768,trusted_proc_root=root);cert=json.loads(cert_raw)
 binding_raw=private_file(BINDING,BINDING_SHA,mode=0o444,maximum=16384);bound=json.loads(binding_raw)['public'];oldroot={k:bound['generation'][k]for k in ('boot','device','parent_inode')}
 require(cert['version']==2 and bound in cert['chat_bindings']and oldroot in cert['closed_roots']and(cert['root_device'],cert['root_inode'])!=(oldroot['device'],oldroot['parent_inode']),'host_old_root_closure_not_certified')
 record=private_file(root/'app/session_state/runtime_admission/attempts/c6cc8739-7de7-4c13-a5c9-6b230fb3b1de.json',RECORD_SHA,uid=10001,mode=0o600,maximum=4096,trusted_proc_root=root)
 require(json.loads(record)['state']=='dispatch_armed','native_record_state_changed')
 delegated=[]
 for line in Path('/proc',str(pid),'mountinfo').read_text().splitlines():
  front,separator,after=line.partition(' - ');fields=front.split()
  if fields[4]=='/run/nodia-login-cgroups':delegated.append({'filesystem':after.split()[0],'flags':fields[5].split(',')})
 require(len(delegated)==1 and delegated[0]['filesystem']=='cgroup2'and {'nosuid','nodev','noexec'}<=set(delegated[0]['flags']),'cgroup_view_mount_flags_changed')
 manifest=json.loads(private_file(MANIFEST,MANIFEST_SHA,maximum=16384));expected={**manifest['base_public_python_hashes'],**manifest['target_image_source_sha256']}
 program="import pathlib,hashlib,json;print(json.dumps({p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in pathlib.Path('/app').glob('*.py') if p.is_file() and not p.is_symlink()}))"
 require(json.loads(command(['docker','exec','--user','10001:10001',CONTAINER,'python','-B','-c',program]))==expected,'candidate_python_sources_changed')
 claims={}
 for unit in ('nodia-api','nodia-ai-worker'):
  s=dict(x.split('=',1)for x in command(['systemctl','show',unit,'--property=ActiveState,MainPID','--no-pager']).decode().strip().splitlines());require(s=={'MainPID':'0','ActiveState':'inactive'},'claims_not_closed');claims[unit]=s
 proofs={k:sha(private_file(Path('/var/lib/nodia/codex/1')/('nodia-chat-'+k),pin,uid=10000,mode=0o600))for k,pin in PROOFS.items()}
 native=WORK/'materials/nodia-ai-ai40-gemini-chat-recovery-native-r02.mjs';private_file(native,'659ebd09c97009a17088db4e5b18cc1a14b463551a5d57e514d66f4f07f28d1a',mode=0o600)
 sql=json.loads(command(['/usr/local/bin/node',str(native),'snapshot']));require(sql['status']=='ready_no_mutation','original_SQL_scope_changed')
 return {'schema':'nodia-ai-ai40-gemini-current-controls-v1','status':'current_controls_verified_read_only','gemini_after':{'container_id':CONTAINER,'image_id':IMAGE,'started_at':current['State']['StartedAt']},'static_health':'healthy','source_sha256':sha(__source_bytes__ if '__source_bytes__'in globals()else Path(__file__).read_bytes()),'source_manifest_sha256':MANIFEST_SHA,'python_sources_count':len(expected),'python_sources_exact':True,'old_HostConfig_parity_proven':False,'historical_HostConfig_unrecorded_fields':'unknown','failed_adoption_receipt_sha256':sha(private_file(WORK/'adopt.json',mode=0o600)),'prior_control_flow_verified':{'source_protocol_sha256':'5b84e576d605f608388ce4c66988f40d1daecf2934bc4b2022e31406999ceeb1','sorted_Mounts_and_Env_User_Cmd_Entrypoint_passed':True,'ten_HostConfig_resource_security_fields_passed':True,'FULL_HostConfig_passed':False},'current_HostConfig_sha256':sha(encode(hc)),'controls':{'no_privileged_devices_or_added_caps':True,'private_namespaces':True,'loopback_port_8000_only':True,'no_control_socket_mount':True,'declared_mounts_resources_match':True,'process_UID_NNP_capabilities_verified':True,'cgroup_view_nosuid_nodev_noexec':True},'processes':{'init':init,'application':app[0]},'compose_files':files,'mounts':mounts,'declared_resources':{k:hc[k]for k in ('Memory','MemorySwap','NanoCpus','PidsLimit','ShmSize','Init')},'security_options':hc['SecurityOpt'],'delegated_cgroup_mount':delegated[0],'kernel_certificate_sha256':sha(cert_raw),'certificate_version':2,'old_root_closed':oldroot,'current_root':{'device':cert['root_device'],'parent_inode':cert['root_inode']},'binding_sha256':sha(binding_raw),'original_native_record_sha256':sha(record),'claims':claims,'codex_proof_sha256':proofs,'SQL_snapshot':sql,'external_exposure_tested':False,'generation_or_authentication_availability_claimed':False,'provider_generations':0,'Native_calls':0,'SQL_writes':0,'services_mutated':False,'secret_values_emitted':False}
if __name__=='__main__':
 try:print(json.dumps(snapshot()))
 except Exception as e:
  code=str(e);print(json.dumps({'schema':'nodia-ai-ai40-gemini-current-controls-v1','status':'failed_closed','failure_code':code if isinstance(e,ValueError)and re.fullmatch('[A-Za-z_]{1,100}',code)else type(e).__name__,'private_details_emitted':False}));sys.exit(1)
