"""Read-only current Gemini controls after exact metadata repair; never claims lost historical FULL parity."""
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
COMPOSE_OBSERVED={'/opt/nodia/nodia-gemini-microservice/docker-compose.yml': {'uid': 0, 'gid': 0, 'mode': '0o644', 'bytes': 846, 'sha256': '328f17614085d997a7e4d50c8aa86bd8f58850dec529aeb3f8f6e2ac9a555c78'}, '/opt/nodia/nodia-gemini-microservice/docker-compose.agentic.yml': {'uid': 0, 'gid': 0, 'mode': '0o644', 'bytes': 725, 'sha256': 'e8b9d2669a945f7eefc1320a1505c7a67ad66fb83fb7bd318b08d554d955f54f'}, '/opt/nodia/nodia-gemini-microservice/docker-compose.lab.yml': {'uid': 0, 'gid': 0, 'mode': '0o644', 'bytes': 311, 'sha256': '510b294eaabb6fb0c1a97548081100a64e515a82d15dbcf09c854921961f1096'}, '/opt/nodia/nodia-gemini-microservice/docker-compose.web-reasoning.yml': {'uid': 0, 'gid': 0, 'mode': '0o644', 'bytes': 487, 'sha256': 'b76da4f17e29d0a524121fbec81cab3d7a568e8b4ad3c954246b62eac8438376'}, '/opt/nodia/verification/ai36-c05-role-maintenance12/docker-compose.candidate.yml': {'uid': 0, 'gid': 0, 'mode': '0o600', 'bytes': 147, 'sha256': 'b3d58ae3c866b99d966ac6d2870c785499e5e05caddac57604614f2ec5972acc'}, '/opt/nodia/verification/ai36-c05-role-maintenance13/docker-compose.candidate.yml': {'uid': 0, 'gid': 0, 'mode': '0o600', 'bytes': 147, 'sha256': '38c636eb2cb683ed30d43e3866c037a599ee6e4c5394d8f68d553edb8ca2e595'}, '/opt/nodia/verification/ai36-c05-role-rollback-r01/docker-compose.candidate.yml': {'uid': 0, 'gid': 0, 'mode': '0o600', 'bytes': 147, 'sha256': '2bc03202c269fd0cbdc3a58abbd714344641cdc1ec9e5c5d8945bf1af9259256'}, '/opt/nodia/verification/ai36-c05-r02-role-activation/docker-compose.candidate.yml': {'uid': 0, 'gid': 0, 'mode': '0o600', 'bytes': 147, 'sha256': '38c636eb2cb683ed30d43e3866c037a599ee6e4c5394d8f68d553edb8ca2e595'}, '/opt/nodia/verification/ai36-c05-r03-role-activation/docker-compose.candidate.yml': {'uid': 0, 'gid': 0, 'mode': '0o600', 'bytes': 147, 'sha256': 'fe1b4941c0fcea04a366e04b4e5f5ee020ce2b3c0745ef88ccbe31d5ab81bc9d'}, '/opt/nodia/verification/ai38-mcp-r01-activation/docker-compose.candidate.yml': {'uid': 0, 'gid': 0, 'mode': '0o600', 'bytes': 147, 'sha256': '36dd6ecfd7c4260ec964da1c8ce0d8e70521d9ff719c61974573f91a4e8e46ca'}, '/opt/nodia/verification/ai38-profile-reservation-diag-r01/docker-compose.image.yml': {'uid': 0, 'gid': 0, 'mode': '0o600', 'bytes': 147, 'sha256': 'e7ca77bdf0af4b86de7dfeb2de5e1096fb95f50d012f1b038db7b24a149851c4'}, '/opt/nodia/verification/ai38-profile-reservation-fix-r01/docker-compose.image.yml': {'uid': 0, 'gid': 0, 'mode': '0o600', 'bytes': 147, 'sha256': 'adef07ee12cdf7b46f58bbb20e9d67c828304ee2b0677feb1496332064047fcf'}, '/opt/nodia/verification/ai38-web-stream-diag-r01/docker-compose.image.yml': {'uid': 0, 'gid': 0, 'mode': '0o600', 'bytes': 147, 'sha256': '35507a18a0c2d93b746f54fec64e40eef4ed0c97ac9fd7813bb57342772f8124'}, '/opt/nodia/verification/ai38-web-stream-recovery-fix-r01/docker-compose.image.yml': {'uid': 0, 'gid': 0, 'mode': '0o600', 'bytes': 147, 'sha256': 'beea50e37d2a2449e00709bdabdbef779ad5e180989badff98537727e4e0e179'}, '/opt/nodia/verification/ai40-gemini-chat-recovery-adopt-r01/docker-compose.image.yml': {'uid': 0, 'gid': 0, 'mode': '0o600', 'bytes': 147, 'sha256': 'bc7fc0833f045d57fb6272cc47b938265caf45ae18eff2b9224b1f4d2bc6e39f'}}
MOUNTS_OBSERVED=[{'destination': '/app/.env', 'type': 'bind', 'rw': False, 'source_sha256': '054c150c9feace6b6c7836b650b42220ed9f02cd9e17c10d8769bb0bca1cd2c1'}, {'destination': '/app/browser_profile', 'type': 'bind', 'rw': True, 'source_sha256': '47352faae73dba99fa610e8a4e51072a868523d10d1e00f50919aa15d64d1001'}, {'destination': '/app/config/web_reasoning_profiles.json', 'type': 'bind', 'rw': False, 'source_sha256': '98595776ca7cbd03d888ae8f81ba2f2f120f856ade9f909989c6ddcaa71efb2c'}, {'destination': '/app/session_state', 'type': 'bind', 'rw': True, 'source_sha256': 'df92478c1c4cd518e179b7372d0428f80dea184a1fdda50c94b647908e6c8576'}, {'destination': '/home/nodia/agentic_profile', 'type': 'bind', 'rw': True, 'source_sha256': '5031cefb37fff2bb35c150fb5aa141157ac9df451ad3442af4c8a8982eeed0dd'}, {'destination': '/run/user/10001', 'type': 'bind', 'rw': False, 'source_sha256': '5a8774a40e46729d6b694ea45974d27d13e3bec032ae436934073c1eccb2645a'}]
def observe_compose_source(path):
 expected=COMPOSE_OBSERVED[str(path)];s=path.lstat()
 require(path.resolve()==path and stat.S_ISREG(s.st_mode)and s.st_nlink==1 and s.st_size<=131072,'observed_compose_identity_changed')
 fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW|os.O_NONBLOCK)
 try:
  opened=os.fstat(fd);require((s.st_dev,s.st_ino,s.st_uid,s.st_gid,s.st_mode,s.st_size)==(opened.st_dev,opened.st_ino,opened.st_uid,opened.st_gid,opened.st_mode,opened.st_size),'observed_compose_open_changed')
  with os.fdopen(fd,'rb',closefd=False)as f:raw=f.read(131073)
 finally:os.close(fd)
 actual={'uid':s.st_uid,'gid':s.st_gid,'mode':oct(stat.S_IMODE(s.st_mode)),'bytes':len(raw),'sha256':sha(raw)}
 require(actual==expected,'observed_compose_metadata_or_bytes_changed')
 return {'path':str(path),**actual,'root_owned_not_writable_by_nonroot':True,'used_as_runtime_authority':False,'executed_or_parsed':False}
def application_process(init_pid):
 queue=[init_pid];seen=set();candidates=[]
 while queue:
  pid=queue.pop()
  if pid in seen:continue
  require(len(seen)<256,'process_tree_bound_exceeded');seen.add(pid)
  try:
   proc=Path('/proc',str(pid));comm=(proc/'comm').read_text().strip();args=[a for a in (proc/'cmdline').read_bytes().split(b'\0')if a]
   if comm in ('python','python3','python3.11','python3.12','python3.13')and args[1:]==[b'run.py']:candidates.append(process_status(pid))
   queue.extend(int(x)for x in (proc/'task'/str(pid)/'children').read_text().split())
  except FileNotFoundError:continue
 require(len(candidates)==1,'single_application_process_not_verified');return candidates[0]
def process_status(pid):
 values=dict(line.split(':',1) for line in Path('/proc',str(pid),'status').read_text().splitlines() if ':'in line)
 out={'pid':pid,'comm':Path('/proc',str(pid),'comm').read_text().strip(),'uid':[int(v) for v in values['Uid'].split()],'NoNewPrivs':int(values['NoNewPrivs']),'CapEff':values['CapEff'].strip(),'CapPrm':values['CapPrm'].strip(),'CapAmb':values['CapAmb'].strip()}
 require(out['uid']==[10001]*4 and out['NoNewPrivs']==1 and all(int(out[k],16)==0 for k in ('CapEff','CapPrm','CapAmb')),'process_privilege_control_failed');return out
REPAIR_WORK=Path('/opt/nodia/verification/ai40-gemini-compose-metadata-repair-r01')
REPAIR_RECEIPT_SHA='cc12896a527f390c2e128c3320f6a55abaa8d1e9dc563799018515738b7ac6a7'
def audit_metadata_repair():
 raw=private_file(REPAIR_WORK/'receipt.json',REPAIR_RECEIPT_SHA,mode=0o600);receipt=json.loads(raw)
 require(receipt['schema']=='nodia-ai-ai40-compose-metadata-repair-v1'and receipt['operator_sha256']=='0d845c1f19bd3371dc73624a5b75197015eb560bc40460f62c9c811599e1f271'and receipt['plan_sha256']=='54151a6463b5c1c44dd42ad4d84657e74f09eaac985484048ccea75910eea5da'and receipt['status']=='metadata_repaired_verified'and receipt['changed_objects']==5 and receipt['content_changed']is False and receipt['protected_before']==receipt['protected_after']and receipt['protected_before_after_equal']is True,'metadata_repair_receipt_invalid')
 plan=json.loads(private_file(REPAIR_WORK/'plan.json','54151a6463b5c1c44dd42ad4d84657e74f09eaac985484048ccea75910eea5da',mode=0o600));parents=[]
 desired={c['path']:c['after']for c in plan['proposed_parent_changes']}
 for item in plan['ancestors']:
  path=Path(item['path']);s=path.lstat();target=desired.get(str(path),item)
  require(path.resolve()==path and stat.S_ISDIR(s.st_mode)and(s.st_dev,s.st_ino)==(item['device'],item['inode'])and s.st_uid==0 and not s.st_mode&0o022 and(s.st_uid,s.st_gid,oct(stat.S_IMODE(s.st_mode)))==(target['uid'],target['gid'],target['mode']),'postrepair_ancestor_changed')
  parents.append({'path':str(path),'uid':s.st_uid,'gid':s.st_gid,'mode':oct(stat.S_IMODE(s.st_mode)),'device':s.st_dev,'inode':s.st_ino})
 require(len(receipt['files_after'])==15 and all({k:x[k]for k in ('uid','gid','mode','bytes','sha256')}==COMPOSE_OBSERVED[x['path']]for x in receipt['files_after']),'postrepair_file_manifest_changed')
 return {'schema':'nodia-ai-ai40-compose-metadata-postaudit-v1','status':'metadata_post_audited_read_only','repair_receipt_sha256':sha(raw),'repair_operator_sha256':receipt['operator_sha256'],'repair_plan_sha256':receipt['plan_sha256'],'changed_objects':5,'files_sha_preserved':15,'ancestors_root_safe':parents,'no_contents_profiles_services_changed':True}
def snapshot():
 require(os.geteuid()==0 and sys.platform=='linux','linux_root_required');metadata_audit=audit_metadata_repair()
 current=json.loads(command(['docker','inspect',CONTAINER]))[0];require(current['Id']==CONTAINER and current['Image']==IMAGE and current['State']['Running']and current['State']['Health']['Status']=='healthy','candidate_identity_or_health_changed')
 before_failure=json.loads(private_file(WORK/'adopt.json',mode=0o600));require(before_failure['status']=='operation_failed'and before_failure['failure_code']=='complete_host_containment_changed'and before_failure['operator_sha256']=='c07081ebfa6597dcf26235d3321b84c549ae67d08e9f33c84dfaf892ca38e5b7','failed_adoption_lineage_changed')
 hc=current['HostConfig'];require(not hc['Privileged']and not hc['PublishAllPorts']and not hc['CapAdd']and not hc['Devices']and not hc['DeviceRequests']and not hc['DeviceCgroupRules'],'device_or_privilege_control_failed')
 require(hc['CgroupnsMode']=='private'and hc['IpcMode']=='private'and all(hc[k]==''for k in ('PidMode','UTSMode','UsernsMode'))and hc['NetworkMode']not in ('host','none'),'namespace_control_failed')
 require(hc['SecurityOpt']==['no-new-privileges:true'],'no_new_privileges_option_changed')
 require(hc['PortBindings']=={'8000/tcp':[{'HostIp':'127.0.0.1','HostPort':'8000'}]},'non_loopback_or_new_port')
 labels=current['Config']['Labels'];require(labels['com.docker.compose.project']=='nodia-gemini-lab'and labels['com.docker.compose.service']=='nodia-gemini-microservice','compose_owner_changed')
 files=[]
 require(labels['com.docker.compose.project.config_files'].split(',')==list(COMPOSE_OBSERVED),'compose_file_sequence_changed')
 for name in COMPOSE_OBSERVED:files.append(observe_compose_source(Path(name)))
 require(hc['Memory']==2147483648 and hc['NanoCpus']==2000000000 and hc['PidsLimit']==256 and hc['ShmSize']==268435456 and hc['Init']is True,'approved_resource_limits_changed')
 mounts=[]
 for m in current['Mounts']:
  require(m['Type']=='bind'and not stat.S_ISSOCK(Path(m['Source']).stat().st_mode)and not any(x in (m['Source']+' '+m['Destination']).lower()for x in ('docker.sock','podman.sock','/var/run/docker','/run/docker')),'control_socket_or_undeclared_mount_type')
  mounts.append({'destination':m['Destination'],'type':m['Type'],'rw':m['RW'],'source_sha256':sha(m['Source'].encode())})
 require(sorted(mounts,key=lambda x:x['destination'])==MOUNTS_OBSERVED,'approved_mounts_changed')
 pid=current['State']['Pid'];init=process_status(pid);app=application_process(pid)
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
 return {'schema':'nodia-ai-ai40-gemini-current-controls-v1','status':'current_controls_verified_read_only','gemini_after':{'container_id':CONTAINER,'image_id':IMAGE,'started_at':current['State']['StartedAt']},'static_health':'healthy','source_sha256':sha(__source_bytes__ if '__source_bytes__'in globals()else Path(__file__).read_bytes()),'source_manifest_sha256':MANIFEST_SHA,'python_sources_count':len(expected),'python_sources_exact':True,'old_HostConfig_parity_proven':False,'scope':'Current runtime controls only; not a deployment-source hardening or historical FULL-equivalence acceptance.','historical_HostConfig_unrecorded_fields':'unknown','failed_adoption_receipt_sha256':sha(private_file(WORK/'adopt.json',mode=0o600)),'prior_control_flow_verified':{'source_protocol_sha256':'5b84e576d605f608388ce4c66988f40d1daecf2934bc4b2022e31406999ceeb1','sorted_Mounts_and_Env_User_Cmd_Entrypoint_passed':True,'ten_HostConfig_resource_security_fields_passed':True,'FULL_HostConfig_passed':False},'current_HostConfig_sha256':sha(encode(hc)),'controls':{'no_privileged_devices_or_added_caps':True,'private_namespaces':True,'loopback_port_8000_only':True,'no_control_socket_mount':True,'approved_current_mounts_resources_match':True,'process_UID_NNP_capabilities_verified':True,'cgroup_view_nosuid_nodev_noexec':True},'processes':{'init':init,'application':app},'compose_file_observations_not_authority':files,'deployment_file_permissions_hardened':True,'deployment_file_permissions_debt':None,'metadata_post_audit':metadata_audit,'deployment_metadata_scope':'Exactly15Compose files and16ancestor directories; no other filesystem hardening claimed.','mounts':mounts,'declared_resources':{k:hc[k]for k in ('Memory','MemorySwap','NanoCpus','PidsLimit','ShmSize','Init')},'security_options':hc['SecurityOpt'],'delegated_cgroup_mount':delegated[0],'kernel_certificate_sha256':sha(cert_raw),'certificate_version':2,'old_root_closed':oldroot,'current_root':{'device':cert['root_device'],'parent_inode':cert['root_inode']},'binding_sha256':sha(binding_raw),'original_native_record_sha256':sha(record),'claims':claims,'codex_proof_sha256':proofs,'SQL_snapshot':sql,'external_exposure_tested':False,'generation_or_authentication_availability_claimed':False,'provider_generations':0,'Native_calls':0,'SQL_writes':0,'services_mutated':False,'secret_values_emitted':False}
if __name__=='__main__':
 try:print(json.dumps(snapshot()))
 except Exception as e:
  code=str(e);print(json.dumps({'schema':'nodia-ai-ai40-gemini-current-controls-v1','status':'failed_closed','failure_code':code if isinstance(e,ValueError)and re.fullmatch('[A-Za-z_]{1,100}',code)else type(e).__name__,'private_details_emitted':False}));sys.exit(1)
