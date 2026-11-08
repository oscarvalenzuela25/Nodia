"""Four explicit phases for one original ARMED Gemini attempt, without replay.

Uses the reviewed PRESTOP producer, kernel host helper, immutable image overlay
and compiled Server reconciliation. No inference, profile edit or SQL shortcut.
Failures retain claims closed and all phase identities for operator inspection.
"""
import argparse
from datetime import datetime, timezone
import fcntl
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import sys
import time

WORK=Path('/opt/nodia/verification/ai40-gemini-chat-recovery-adopt-r01')
MATERIALS=WORK/'materials'
SERVER=Path('/opt/nodia/releases/nodia-server-ai40-r08')
SERVER_SHA='08145edaefff382ba2ccbbf8d51c325de630feeef5b67a1834651b1cdd6577bc'
MANIFEST=Path('/opt/nodia/verification/ai40-gemini-chat-recovery-build-r03/manifest.json')
PLAN_SHA='ed3ebaceceb90d6acd2acbbf86fc8a4b56b1b69782d210eae83a6e7b0b1e58ef'
TARGET='sha256:15e8c319011ecfc7f792938cc4177ab0943af8894b204375bd1c1200728f935a'
ORIGINAL='c4814c5a184b55cd95c751ed904d0c957c0311148f8732169928ce6c3b2d5bd3'
ATTEMPT='c6cc8739-7de7-4c13-a5c9-6b230fb3b1de'
BINDING_ID='a4e8f8f7-6706-41a1-9396-75046d96e91f'
HOST_BINDING=Path('/var/lib/nodia-login-containment/chat-bindings')/(ATTEMPT+'.json')
PRODUCER=Path('/opt/nodia/verification/ai40-gemini-chat-host-binding-r04/nodia-ai-ai40-gemini-chat-host-binding-r04.py')
PRODUCER_SHA='3cbaa27a82ece14c6315b9c4d5fe24af9537991054106f55192a73e80ca4468a'
HOST_SOURCE=PRODUCER.with_name('attach-nodia-gemini-chat-cgroup-r04.py')
HOST_SHA='438b1941808b6156b6f96390c769b65ac1fa96144b11ac73bd94c60d209a64a7'
HOST_INSTALL=Path('/usr/local/libexec/nodia/attach-gemini-chat-cgroup-r04.py')
PARSER_INSTALL=Path('/usr/local/libexec/nodia/gemini-chat-host-binding-r04.py')
IMAGE_DROPIN=Path('/etc/systemd/system/nodia-gemini-lab.service.d/zz-ai40-chat-image.conf')
HOST_DROPIN=IMAGE_DROPIN.with_name('zz-ai40-chat-host.conf')
NATIVE=MATERIALS/'nodia-ai-ai40-gemini-chat-recovery-native-r01.mjs'
NATIVE_SHA='d9dda65d32570aca5d13d34935718599f056136b9cb4aa233f813bdd75a99c75'
SCHEMA='nodia-ai-ai40-gemini-chat-recovery-operation-v1'
QUALIFICATION={
    'build-receipt.json':'74e0b8bd083f4a919767784e3f9a0cddacd7727d08704261eafa547a408c5513',
    'kernel-receipt.json':'3aafc6ab03f14f0257ca937e1ed523777ed7d71118925eab2867923c84a15143',
    'linux-qa-receipt.json':'42c36eb3f934961339f270622457732f3666382a5d231ba29369d2af1def6827',
}

def require(value, code):
    if not value:raise ValueError(code)

def digest(raw):return hashlib.sha256(raw).hexdigest()

def file_bytes(path, pin=None, mode=None, maximum=131072):
    info=path.lstat()
    require(path.resolve()==path and stat.S_ISREG(info.st_mode)and info.st_uid==0 and info.st_nlink==1 and not info.st_mode&0o022,'unsafe_operator_file')
    require((mode is None or stat.S_IMODE(info.st_mode)==mode)and info.st_size<=maximum,'operator_file_mode_or_size_changed')
    raw=path.read_bytes();require(len(raw)<=maximum and (pin is None or digest(raw)==pin),'operator_file_changed')
    return raw

def load(path,pin,name):
    raw=file_bytes(path,pin)
    module=importlib.util.module_from_spec(importlib.util.spec_from_loader(name,loader=None))
    module.__file__=str(path)
    exec(compile(raw,str(path),'exec'),module.__dict__);return module

def command(argv,timeout=30,**kwargs):
    value=subprocess.run(argv,capture_output=True,timeout=timeout,check=False,**kwargs)
    require(value.returncode==0,'operator_command_failed');return value.stdout

def encoded(value):return(json.dumps(value,sort_keys=True,separators=(',',':'))+'\n').encode()

def write_once(path,raw,mode=0o600):
    fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,mode)
    with os.fdopen(fd,'wb')as stream:
        stream.write(raw);stream.flush();os.fchmod(stream.fileno(),mode);os.fsync(stream.fileno())
    sync_directory(path.parent)

def sync_directory(path):
    fd=os.open(path,os.O_RDONLY|os.O_DIRECTORY)
    try:os.fsync(fd)
    finally:os.close(fd)

def receipt(phase,status):
    value=json.loads(file_bytes(WORK/(phase+'.json'),mode=0o600))
    require(value['schema']==SCHEMA and value['phase']==phase and value['status']==status and value['plan_sha256']==PLAN_SHA and value['operator_sha256']==digest(file_bytes(Path(__file__).resolve(),mode=0o600)),'previous_phase_not_verified')
    return value

def dependencies():
    require(isinstance(NATIVE_SHA,str)and re.fullmatch('[a-f0-9]{64}',NATIVE_SHA),'native_source_not_frozen')
    file_bytes(NATIVE,NATIVE_SHA)
    manifest=json.loads(file_bytes(MANIFEST,PLAN_SHA,maximum=16384))
    require(manifest['schema']=='nodia-ai-ai40-gemini-chat-selective-package-v2','overlay_manifest_invalid')
    qualified={name:json.loads(file_bytes(MATERIALS/name,pin))for name,pin in QUALIFICATION.items()}
    built=qualified['build-receipt.json'];require(built['status']=='passed_isolated_build'and built['candidate_image_id']==TARGET and built['manifest_sha256']==PLAN_SHA and built['SDK_requests']==0 and built['real_binding_created']is False,'image_build_not_qualified')
    require(all(qualified[name]['status']=='passed'and qualified[name]['original_before_after_equal']is True and qualified[name]['SDK_requests']==0 for name in('kernel-receipt.json','linux-qa-receipt.json')),'isolated_closure_QA_not_qualified')
    activation=load(MATERIALS/'nodia-ai-ai38-journal-activate.py','56fb7fc00dd4e741e924cef6eee69527543aab4407adeed776a5cfb08aff016b','recovery_activation')
    activation.RELEASE=SERVER
    old=load(MATERIALS/'nodia-ai-ai38-profile-reservation-adopt.py','422d2f14a2098bb6d4d96e6b937de1862188a8a549cb150762b83dfe68c54fb2','recovery_image_functions')
    kernel=load(MATERIALS/'verify-nodia-gemini-chat-cgroup-host-r02.py','05e315dd7b035af3d167b314d6fbb8b723014f417e7d305efbbc598ebe754077','recovery_kernel_guard')
    producer=load(PRODUCER,PRODUCER_SHA,'recovery_binding_parser')
    file_bytes(HOST_SOURCE,HOST_SHA)
    require(digest((SERVER/'release-manifest.json').read_bytes())==SERVER_SHA,'Server_package_changed')
    return activation,old,kernel,producer,manifest

def node(mode,descriptor=None):
    argv=['/usr/local/bin/node',str(NATIVE),mode]
    if descriptor is not None:argv.append(descriptor)
    options={'cwd':SERVER,'env':{'PATH':'/usr/local/bin:/usr/bin:/bin','HOME':'/root'}}
    if mode=='reconcile':
        fd=os.open(WORK/'native-terminal-witness.jsonl',os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
        try:
            sync_directory(WORK)  # Persist the name before any Native ACK can delete its source.
            options['env']['NODIA_AI_RECOVERY_WITNESS_FD']=str(fd)
            result=subprocess.run(argv,capture_output=True,timeout=90,check=False,pass_fds=(fd,),**options)
        finally:os.close(fd)
    else:result=subprocess.run(argv,capture_output=True,timeout=30,check=False,**options)
    raw=result.stdout;require(len(raw)<=131072,'Native_result_too_large')
    ordinal=len(list(WORK.glob('native-'+mode+'-stdout-*.json')))+1
    output=WORK/('native-'+mode+'-stdout-'+str(ordinal)+'.json')
    write_once(output,raw)  # Preserve closed JSON even on nonzero exit; never stderr.
    value=json.loads(raw);require(result.returncode==0 and value.get('status')==('ready_no_mutation'if mode=='snapshot'else'reconciled_and_ACK_verified'),'compiled_recovery_not_verified')
    return value

def binding(producer):
    raw=producer.read_file(HOST_BINDING,mode=0o444,maximum=16384)
    result=receipt('bind','bound_pre_stop')
    require(digest(raw)==result['binding_file_sha256']and json.loads(raw)['public']==result['binding'],'host_binding_changed')
    return raw,result

def original_post():
    raw=command(['systemctl','show','nodia-gemini-lab','--property=ExecStartPost','--value'])
    text=raw.decode('utf-8')
    require(text.count('{')==text.count('}')==1 and re.findall(r'\bpath=([^ ;]+)',text)==['/usr/bin/python3']and [part.strip()for part in re.findall(r'argv\[\]=([^;]+);',text)]==['/usr/bin/python3 /usr/local/libexec/nodia/attach-gemini-login-cgroup.py'],'additional_post_start_actions_require_review')
    return digest(raw)

def preflight(a,old,kernel,manifest):
    original=kernel.original_snapshot()
    require(original['Codex_proof_sha256']==kernel_proofs(),'original_Codex_proofs_changed')
    consumers=a.active_new_processes()
    derivative=old.image_derivative(manifest['base_image_id'],TARGET)
    producer=json.loads(command(['/usr/bin/python3',str(PRODUCER),'--binding-id',BINDING_ID]))
    require(producer['status']=='ready_no_mutation','binding_preflight_failed')
    current=node('snapshot')
    require(all(a.state(t)['active']=='active'for t in a.TIMERS),'timers_not_active')
    journal=a.journal('status');require(journal['unconfirmed']==journal['expired_backups']==0,'journal_not_ready')
    return {'original':original,'consumers':consumers,'derivative':derivative,'job':current,'journal':journal,'operator_configuration':a.operator_configuration(),'original_ExecStartPost_sha256':original_post()}

def adopt(a,old,kernel,producer,manifest,report):
    raw,bound=binding(producer);original=kernel.original_snapshot();current=node('snapshot')
    require(original['Codex_proof_sha256']==kernel_proofs(),'original_Codex_proofs_changed')
    a.active_new_processes()
    initial=receipt('preflight','ready_no_mutation')
    require(current['descriptor_sha256']==initial['job']['descriptor_sha256']and original_post()==initial['original_ExecStartPost_sha256'],'recovery_descriptor_or_post_start_changed')
    before=old.inspect();require(before['Id']==ORIGINAL,'original_container_changed')
    require(old.public_sources()==manifest['base_public_python_hashes'],'original_public_sources_changed')
    write_once(WORK/'container-before-metadata.json',encoded({'container_id':before['Id'],'image_id':before['Image'],'started_at':before['State']['StartedAt'],'configuration_sha256':digest(encoded(before['Config']))}))
    report['original_unit_sha256']=digest(command(['systemctl','cat','nodia-gemini-lab']))
    report.update(original=original,job=current,binding_file_sha256=digest(raw),timers={t:a.state(t)['active']for t in a.TIMERS},journal_before=a.journal('status'),operator_configuration=a.operator_configuration())
    require(all(v=='active'for v in report['timers'].values()),'timers_not_active')
    command(['systemctl','stop',*a.TIMERS]);old.wait_idle(a)
    started=datetime.now(timezone.utc)
    backup=json.loads(command(['sudo','-u','nodia','/usr/local/bin/node',str(SERVER/'scripts/nodia-ai-backups.mjs'),'backup',str(a.BACKUP)],timeout=240))
    captured=datetime.fromisoformat(backup['captured_at'].replace('Z','+00:00'));expires=datetime.fromisoformat(backup['expires_at'].replace('Z','+00:00'))
    require(backup['status']=='ready'and backup['operation']=='backup'and started<=captured<=datetime.now(timezone.utc)and(expires-captured).total_seconds()==7*86400 and backup['cipher_bytes']>0 and re.fullmatch('[a-f0-9]{64}',backup['cipher_sha256']),'fresh_backup_invalid')
    write_once(WORK/'fresh-backup.json',encoded(backup));report['fresh_backup']=backup
    require(kernel.original_snapshot()==original,'original_changed_before_stop')
    command(['systemctl','stop','nodia-api'],timeout=60);require(a.stopped('nodia-api'),'API_not_stopped')
    require(node('snapshot')==current,'job_changed_before_worker_stop')
    command(['systemctl','stop','nodia-ai-worker'],timeout=60);require(all(a.stopped(n)for n in a.CONSUMERS),'claims_not_stopped')
    labels=before['Config']['Labels'];require(labels['com.docker.compose.project']=='nodia-gemini-lab'and labels['com.docker.compose.service']=='nodia-gemini-microservice','compose_owner_changed')
    override=WORK/'docker-compose.image.yml';write_once(override,('services:\n  nodia-gemini-microservice:\n    image: "'+TARGET+'"\n    pull_policy: never\n').encode())
    argv=['/usr/bin/docker','compose','-p','nodia-gemini-lab']
    for name in labels['com.docker.compose.project.config_files'].split(','):
        path=Path(name);require(path.is_absolute()and path.resolve()==path and path.is_file(),'compose_file_unsafe');argv+=['-f',name]
    argv+=['-f',str(override),'up','-d','--wait','--wait-timeout','90','--no-build','--pull','never']
    require(all(not any(c.isspace()for c in word)for word in argv),'unsafe_ExecStart_argument')
    command(['systemctl','stop','nodia-gemini-lab'],timeout=60)
    stopped=subprocess.run(['docker','inspect',ORIGINAL],capture_output=True,timeout=15,check=False)
    require((stopped.returncode==0 and json.loads(stopped.stdout)[0]['Id']==ORIGINAL and not json.loads(stopped.stdout)[0]['State']['Running']and json.loads(stopped.stdout)[0]['State']['Pid']==0)or(stopped.returncode==1 and b'No such object' in stopped.stderr),'original_owner_not_stopped')
    write_once(PARSER_INSTALL,file_bytes(PRODUCER,PRODUCER_SHA),0o755);write_once(HOST_INSTALL,file_bytes(HOST_SOURCE,HOST_SHA),0o755)
    write_once(IMAGE_DROPIN,('[Service]\nExecStart=\nExecStart='+' '.join(argv)+'\n').encode(),0o644)
    write_once(HOST_DROPIN,('[Service]\nExecStartPost=\nExecStartPost=+/usr/bin/python3 '+str(HOST_INSTALL)+'\n').encode(),0o644)
    command(['systemctl','daemon-reload']);command(['systemctl','start','nodia-gemini-lab'],timeout=120)
    after=old.inspect();require(after['Image']==TARGET and after['Id']!=ORIGINAL and after.get('State',{}).get('Health',{}).get('Status')=='healthy','replacement_image_or_static_health_changed');old.same_configuration(before,after)
    require(after['HostConfig']==before['HostConfig'],'complete_host_containment_changed')
    expected={**manifest['base_public_python_hashes'],**manifest['target_image_source_sha256']};require(old.public_sources()==expected,'replacement_public_sources_changed')
    root=Path('/proc')/str(after['State']['Pid'])/'root'
    require(digest(producer.read_file(root/'app/session_state/runtime_admission/attempts'/ (ATTEMPT+'.json'),uid=10001,mode=0o600,maximum=4096))==producer.RECORD_SHA,'native_armed_record_changed')
    cert_raw=producer.read_file(root/'run/nodia-login-containment.json',mode=0o444,maximum=32768);cert=json.loads(cert_raw)
    generation=bound['binding']['generation'];old_root={k:generation[k]for k in('boot','device','parent_inode')}
    require(cert['version']==2 and bound['binding']in cert['chat_bindings']and old_root in cert['closed_roots']and(cert['root_device'],cert['root_inode'])!=(old_root['device'],old_root['parent_inode']),'original_kernel_closure_not_certified')
    require(all(a.stopped(n)for n in a.CONSUMERS),'claims_resumed_before_reconciliation')
    report.update(status='adopted_claims_closed',gemini_after={'container_id':after['Id'],'image_id':after['Image'],'started_at':after['State']['StartedAt']},kernel_certificate_sha256=digest(cert_raw),original_native_record_unchanged=True,claims_closed=True)

def final_snapshot(a):
    g=load(Path('/opt/nodia/verification/ai40-r07-mcp-operator-r01/nodia-ai-ai40-r07-mcp-operator-r01.py'),'753acf4f71bd4e569f8c6b9266fa572a175d234716387ebf6a944513d6898f58','recovery_release_guard')
    g.RELEASE,g.RELEASE_SHA=SERVER,SERVER_SHA
    h=load(g.HELPER,g.HELPER_SHA,'recovery_public_guard');h.ACTIVE=SERVER;h.validate_candidate(g.LEGACY_MANIFEST_SHA);g.validate_release()
    status=load(Path('/opt/nodia/verification/ai40-journal-status-read-r01/nodia-ai-ai40-journal-status-read-r01.py'),'5e5b710b0210e82228593401f0480e54970666ef4151251e930c16bb85da6c38','recovery_status_guard')
    images=load(Path('/opt/nodia/verification/ai40-r06-image-operator-r01/nodia-ai-ai40-r06-image-operator-r01.py'),'b048369c1abe3b31df801bf1e94b70462dfca4196f14d276387da737cdb38355','recovery_proof_guard')
    consumers=a.active_new_processes();services={n:h.service(n)for n in('nodia-api','nodia-ai-worker','nodia-keyring')};events=[];public=status.public_preflight(h,services,events)
    require(all(public['SQL'][k]==0 for k in('pending_jobs','open_attempts','retained_slots'))and public['codex']['pending']==public['codex']['locks_or_sockets']==0,'post_recovery_not_quiet')
    env=h.selected_environment(services['nodia-api']['pid'],{'DOTENV_CONFIG_PATH','POSTGRES_HOST','POSTGRES_PORT','POSTGRES_DB','POSTGRES_USER','POSTGRES_PASSWORD','POSTGRES_SSL'})
    source=(h.CANDIDATE.parent/'public-canary-input.mjs').read_text(encoding='utf-8')
    result=h.command(['/usr/local/bin/node','--input-type=module','-e',source],cwd=SERVER,env={'PATH':'/usr/local/bin:/usr/bin:/bin','HOME':'/root','AI40_CONNECTION_ID':'1',**env},timeout=25)
    require(result.returncode==0 and digest(result.stdout)=='506e4c436bc22152c9aa632565d470450206d5ffdb1c9b976c0d0c7b5116f8b2','public_configuration_changed')
    proofs=images.proof_snapshot(h,json.loads(result.stdout)['selection'],g.EXPECTED_RUNTIME_FINGERPRINT)
    require({k:v['sha256']for k,v in proofs.items()}==kernel_proofs(),'Codex_proofs_changed')
    return consumers,public['SQL'],proofs

def kernel_proofs():
    return {'mcp':'a1f1ee2742324a87d8f96fc4207fb7845fa5deb51eb5d772d30faa6858e1eff0','mcp-image-png':'9a1848159f6e0756db7986233516e4fe6b6d180c37acf8fe26b6b0384cfea131','mcp-image-jpeg':'2b6426566681eaa95e0fa9a0c5686061069451a84f42c80a5967bd0608510772','mcp-image-webp':'744b7224928083c5703bc01a0e6575db9e10589a85b7dd86c43f99f4222e3c38'}

def reconcile_retire(a,old,producer,report):
    adopted=receipt('adopt','adopted_claims_closed');raw,bound=binding(producer)
    require(all(a.stopped(n)for n in a.CONSUMERS),'claims_not_closed')
    actual=old.inspect();require({'container_id':actual['Id'],'image_id':actual['Image'],'started_at':actual['State']['StartedAt']}==adopted['gemini_after'],'replacement_epoch_changed')
    result=node('reconcile',adopted['job']['descriptor_sha256'])
    require(result['acknowledged']is True and result['terminal']['outcome']=='abandoned_unknown'and result['terminal']['process_closed']is True and result['job_absent']is True,'original_reconciliation_not_verified')
    write_once(WORK/'native-reconciliation.json',encoded(result));write_once(WORK/'retired-host-binding.json',raw)
    host=load(HOST_SOURCE,HOST_SHA,'recovery_retirement_lock')
    file_bytes(HOST_BINDING.parent.parent/'attach.lock',mode=0o600)
    with host.locked_state(HOST_BINDING.parent.parent):
        require(producer.read_file(HOST_BINDING,mode=0o444,maximum=16384)==raw,'binding_changed_before_retirement')
        HOST_BINDING.unlink();sync_directory(HOST_BINDING.parent)
    helper_result=json.loads(command(['/usr/bin/python3',str(HOST_INSTALL)]));require(helper_result['status']=='attached','host_retention_refresh_failed')
    require(a.operator_configuration()==adopted['operator_configuration'],'operator_configuration_changed')
    journal=a.journal('status');require(all(journal[k]==adopted['journal_before'][k]for k in('coverage_from','first_sequence','last_sequence','coverage_closed_at'))and journal['unconfirmed']==0,'journal_changed')
    report['claims_start_attempted']=True
    command(['systemctl','start',*a.CONSUMERS],timeout=45);a.wait_health()
    consumers,sql,proofs=final_snapshot(a)
    command(['systemctl','start',*a.TIMERS]);require(all(a.state(t)['active']==v for t,v in adopted['timers'].items()),'timer_restoration_failed')
    report.update(status='reconciled_retired_claims_resumed',gemini_after=adopted['gemini_after'],post_consumers=consumers,SQL_after=sql,codex_proofs=proofs,native_reconciliation=result,host_binding_retired_exact_sha256=digest(raw),host_retention_refreshed=True,timers_restored=True)

def run(args):
    require(sys.platform=='linux'and os.geteuid()==0 and not sys.flags.optimize,'unoptimized_linux_root_required');sys.dont_write_bytecode=True
    require(digest(file_bytes(Path(__file__).resolve(),mode=0o600))==args.operator_sha256,'operator_changed')
    info=WORK.lstat();require(WORK.resolve()==WORK and stat.S_ISDIR(info.st_mode)and info.st_uid==0 and stat.S_IMODE(info.st_mode)==0o700,'private_work_required')
    a,old,kernel,producer,manifest=dependencies()
    report={'schema':SCHEMA,'phase':args.phase,'status':'operation_failed','operator_sha256':args.operator_sha256,'plan_sha256':PLAN_SHA,'release':str(SERVER),'server_manifest_sha256':SERVER_SHA,'provider_generations':0,'direct_provider_observations':0,'business_SQL_writes':0,'automatic_replay_allowed':False}
    if args.phase=='preflight':
        require(not args.execute,'preflight_execute_invalid');report.update(preflight(a,old,kernel,manifest));report['status']='ready_no_mutation';write_once(WORK/'preflight.json',encoded(report));return report
    require(args.execute,'explicit_execute_required')
    fd=os.open(WORK/'operation.lock',os.O_WRONLY|os.O_CREAT|os.O_NOFOLLOW,0o600)
    try:
        fcntl.flock(fd,fcntl.LOCK_EX|fcntl.LOCK_NB)
        require(not(WORK/(args.phase+'.json')).exists(),'phase_already_recorded')
        write_once(WORK/(args.phase+'-intent.json'),encoded(report))
        try:
            if args.phase=='bind':
                receipt('preflight','ready_no_mutation');kernel.original_snapshot()
                bound=json.loads(command(['/usr/bin/python3',str(PRODUCER),'--binding-id',BINDING_ID,'--execute']))
                require(bound['status']=='bound_pre_stop','binding_not_verified');report.update(bound)
                require(digest(producer.read_file(HOST_BINDING,mode=0o444,maximum=16384))==report['binding_file_sha256'],'binding_postcheck_failed')
            elif args.phase=='adopt':adopt(a,old,kernel,producer,manifest,report)
            else:reconcile_retire(a,old,producer,report)
        except Exception as error:
            report['status']='operation_failed';code=str(error);report['failure_code']=code if re.fullmatch('[A-Za-z_]{1,100}',code)else'private_dependency_or_protocol_failure'
            if report.get('claims_start_attempted'):
                try:
                    command(['systemctl','stop','nodia-api'],timeout=60)
                    command(['systemctl','stop','nodia-ai-worker'],timeout=60)
                    require(all(a.stopped(n)for n in a.CONSUMERS),'claims_close_not_verified')
                    report['claims_reclosed_after_poststart_failure']=True
                except Exception:
                    report['claims_reclose_requires_operator_attention']=True
            report['claims_observed']={n:a.state(n)for n in a.CONSUMERS};report['no_automatic_restart_rollback_or_replay']=True
            report['recovery_hint']='Keep claims closed after native transition. Inspect exact Native stdout and terminal witness. A reconcile_ack cleanup or job-absent retirement requires a separately reviewed new intent; never rerun this consumed reconcile-retire phase.'
        finally:
            report['Native_stdout_receipts']=[{'name':p.name,'sha256':digest(file_bytes(p,mode=0o600))}for p in sorted(WORK.glob('native-*-stdout-*.json'))]
            write_once(WORK/(args.phase+'.json'),encoded(report))
        return report
    finally:os.close(fd)

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('phase',choices=('preflight','bind','adopt','reconcile-retire'));parser.add_argument('--operator-sha256',required=True);parser.add_argument('--execute',action='store_true');args=parser.parse_args()
    try:
        result=run(args);print(json.dumps(result));sys.exit(0 if result['status']in('ready_no_mutation','bound_pre_stop','adopted_claims_closed','reconciled_retired_claims_resumed')else 1)
    except Exception as error:
        value=str(error);print(json.dumps({'schema':SCHEMA,'phase':args.phase,'status':'precondition_failed','failure_code':value if re.fullmatch('[A-Za-z_]{1,100}',value)else'private_dependency_or_protocol_failure','private_details_emitted':False,'no_automatic_replay':True}));sys.exit(1)
