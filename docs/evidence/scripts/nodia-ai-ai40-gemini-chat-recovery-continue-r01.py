"""Independently verify current containment, then reconcile one original attempt.

Historical complete HostConfig parity is unknown. The failed adoption stays
unchanged. No image restart, backup, inference, receipt restoration or replay.
"""
import argparse,fcntl,hashlib,importlib.util,json,os,re,stat,sys
from pathlib import Path

WORK=Path('/opt/nodia/verification/ai40-gemini-chat-recovery-adopt-r01')
BASE=WORK/'nodia-ai-ai40-gemini-chat-recovery-operator-r01.py'
BASE_SHA='5b84e576d605f608388ce4c66988f40d1daecf2934bc4b2022e31406999ceeb1'
HISTORICAL_OPERATOR=WORK/'nodia-ai-ai40-gemini-chat-recovery-operator-r02.py'
HISTORICAL_SHA='c07081ebfa6597dcf26235d3321b84c549ae67d08e9f33c84dfaf892ca38e5b7'
FAILED=WORK/'materials/failed-adopt-receipt.json'
FAILED_SHA='04c29353e56b371340304d3ed6dd7937268664d89c6e74ae0ae6f1a6ea48e60d'
CONTROLS=WORK/'materials/nodia-ai-ai40-gemini-chat-current-containment-r03.py'
CONTROLS_SHA='bb90d77070fe67210c851bab4e07d4acc157a9e14fd8ac57fbead0876f01ea05'
BASELINE=WORK/'materials/current-controls-baseline.json'
BASELINE_SHA='29c57d2d5fef28e7d3fb2c8edc782fb9d56029fc93200c782f9e8e5a65575e33'

def require(ok,code):
    if not ok:raise ValueError(code)

def sha(raw):return hashlib.sha256(raw).hexdigest()

def load():
    require(all(isinstance(p,str)and re.fullmatch('[a-f0-9]{64}',p)for p in(CONTROLS_SHA,BASELINE_SHA)),'current_controls_not_frozen')
    info=BASE.lstat();require(BASE.resolve()==BASE and stat.S_ISREG(info.st_mode)and info.st_uid==0 and info.st_nlink==1 and stat.S_IMODE(info.st_mode)==0o600,'predecessor_identity_changed')
    require(sha(BASE.read_bytes())==BASE_SHA,'predecessor_changed')
    spec=importlib.util.spec_from_file_location('immutable_recovery_helpers',BASE)
    protocol=importlib.util.module_from_spec(spec);spec.loader.exec_module(protocol)
    protocol.file_bytes(HISTORICAL_OPERATOR,HISTORICAL_SHA,mode=0o600)
    # Only receipt validation of the original successful bind uses its genuine
    # R02 identity. This operator checks its own identity separately; never run
    # the predecessor mutation dispatcher or manufacture a successful adoption.
    protocol.NATIVE=WORK/'materials/nodia-ai-ai40-gemini-chat-recovery-native-r02.mjs'
    protocol.NATIVE_SHA='659ebd09c97009a17088db4e5b18cc1a14b463551a5d57e514d66f4f07f28d1a'
    protocol.__file__=str(HISTORICAL_OPERATOR)
    return protocol

def verify(protocol):
    failed=json.loads(protocol.file_bytes(FAILED,FAILED_SHA))
    require(failed['status']=='operation_failed'and failed['phase']=='adopt'and failed['failure_code']=='complete_host_containment_changed'and failed['operator_sha256']==HISTORICAL_SHA,'failed_adoption_lineage_changed')
    original={k:v for k,v in failed.items()if k not in('predecessor_operator_sha256','native_observer_successor_sha256','historical_failed_preflights_preserved')}
    require(protocol.file_bytes(WORK/'adopt.json',mode=0o600)==protocol.encoded(original),'original_failed_receipt_changed')
    expected=json.loads(protocol.file_bytes(BASELINE,BASELINE_SHA))
    protocol.file_bytes(CONTROLS,CONTROLS_SHA)
    output=protocol.command(['/usr/bin/python3','-B',str(CONTROLS)],timeout=60)
    require(len(output)<=131072,'current_controls_output_too_large');current=json.loads(output)
    require(current==expected and current.get('schema')=='nodia-ai-ai40-gemini-current-controls-v1'and current.get('status')=='current_controls_verified_read_only'and current.get('old_HostConfig_parity_proven')is False,'current_controls_not_verified')
    require(type(current.get('controls'))is dict and bool(current['controls'])and all(v is True for v in current['controls'].values()),'current_containment_check_failed')
    require(current['SQL_snapshot']==failed['job'],'original_SQL_or_descriptor_changed')
    a,old,kernel,producer,manifest=protocol.dependencies()
    require(all(a.stopped(n)for n in a.CONSUMERS),'claims_not_closed')
    raw,bound=protocol.binding(producer)
    require(sha(raw)==failed['binding_file_sha256'],'original_binding_changed')
    return current,failed,a,old,producer,raw

def close_claims(protocol,a,report):
    try:
        protocol.command(['systemctl','stop','nodia-api'],timeout=60)
        protocol.command(['systemctl','stop','nodia-ai-worker'],timeout=60)
        require(all(a.stopped(n)for n in a.CONSUMERS),'claims_close_not_verified')
        report['claims_reclosed_after_poststart_failure']=True
    except Exception:report['claims_reclose_requires_operator_attention']=True

def reconcile(protocol,current,failed,a,old,producer,raw,report):
    result=protocol.node('reconcile',current['SQL_snapshot']['descriptor_sha256'])
    require(result['acknowledged']is True and result['terminal']['outcome']=='abandoned_unknown'and result['terminal']['process_closed']is True and result['job_absent']is True,'original_reconciliation_not_verified')
    protocol.write_once(WORK/'native-reconciliation.json',protocol.encoded(result))
    protocol.write_once(WORK/'retired-host-binding.json',raw)
    host=protocol.load(protocol.HOST_SOURCE,protocol.HOST_SHA,'current_verified_retirement_lock')
    protocol.file_bytes(protocol.HOST_BINDING.parent.parent/'attach.lock',mode=0o600)
    with host.locked_state(protocol.HOST_BINDING.parent.parent):
        require(producer.read_file(protocol.HOST_BINDING,mode=0o444,maximum=16384)==raw,'binding_changed_before_retirement')
        protocol.HOST_BINDING.unlink();protocol.sync_directory(protocol.HOST_BINDING.parent)
    refreshed=json.loads(protocol.command(['/usr/bin/python3',str(protocol.HOST_INSTALL)]))
    require(refreshed['status']=='attached','host_retention_refresh_failed')
    require(a.operator_configuration()==failed['operator_configuration'],'operator_configuration_changed')
    journal=a.journal('status')
    require(all(journal[k]==failed['journal_before'][k]for k in('coverage_from','first_sequence','last_sequence','coverage_closed_at'))and journal['unconfirmed']==0,'journal_changed')
    report['claims_start_attempted']=True
    protocol.command(['systemctl','start',*a.CONSUMERS],timeout=45);a.wait_health()
    consumers,sql,proofs=protocol.final_snapshot(a)
    actual=old.inspect();epoch={'container_id':actual['Id'],'image_id':actual['Image'],'started_at':actual['State']['StartedAt']}
    require(epoch==current['gemini_after']and actual['State']['Running']is True,'verified_replacement_epoch_changed')
    protocol.command(['systemctl','start',*a.TIMERS])
    require(all(a.state(t)['active']==v for t,v in failed['timers'].items()),'timer_restoration_failed')
    report.update(status='reconciled_retired_claims_resumed',gemini_after=epoch,post_consumers=consumers,SQL_after=sql,codex_proofs=proofs,native_reconciliation=result,host_binding_retired_exact_sha256=sha(raw),host_retention_refreshed=True,timers_restored=True)

def run(args):
    require(sys.platform=='linux'and os.geteuid()==0 and not sys.flags.optimize,'unoptimized_linux_root_required');sys.dont_write_bytecode=True
    protocol=load()
    require(sha(protocol.file_bytes(Path(__file__).resolve(),mode=0o600))==args.operator_sha256,'operator_changed')
    info=WORK.lstat();require(WORK.resolve()==WORK and stat.S_ISDIR(info.st_mode)and info.st_uid==0 and stat.S_IMODE(info.st_mode)==0o700,'private_work_required')
    protocol.file_bytes(WORK/'operation.lock',mode=0o600)
    fd=os.open(WORK/'operation.lock',os.O_WRONLY|os.O_NOFOLLOW)
    try:
        fcntl.flock(fd,fcntl.LOCK_EX|fcntl.LOCK_NB)
        current,failed,a,old,producer,raw=verify(protocol)
        report={'schema':protocol.SCHEMA,'phase':args.phase,'status':'current_containment_verified_read_only','operator_sha256':args.operator_sha256,'plan_sha256':protocol.PLAN_SHA,'release':str(protocol.SERVER),'server_manifest_sha256':protocol.SERVER_SHA,'failed_adopt_receipt_sha256':FAILED_SHA,'current_controls_validator_sha256':CONTROLS_SHA,'current_controls_baseline_sha256':BASELINE_SHA,'old_HostConfig_parity_proven':False,'current_containment_verified':True,'provider_generations':0,'direct_provider_observations':0,'business_SQL_writes':0,'image_restarted':False,'new_backup_taken':False,'old_adopt_receipt_unchanged':True,'automatic_replay_allowed':False}
        if args.phase=='verify-current':
            require(not args.execute,'read_only_execute_invalid')
            protocol.write_once(WORK/'continue-verify-current.json',protocol.encoded(report));return report
        require(args.execute,'explicit_execute_required')
        verified=json.loads(protocol.file_bytes(WORK/'continue-verify-current.json',mode=0o600))
        require(verified['operator_sha256']==args.operator_sha256 and verified['status']=='current_containment_verified_read_only'and verified['current_controls_baseline_sha256']==BASELINE_SHA,'current_verification_lineage_changed')
        require(not(WORK/'reconcile-retire.json').exists(),'final_receipt_already_recorded')
        protocol.write_once(WORK/'continue-reconcile-retire-intent.json',protocol.encoded(report));report['status']='operation_failed'
        try:reconcile(protocol,current,failed,a,old,producer,raw,report)
        except Exception as error:
            code=str(error);report['status']='operation_failed';report['failure_code']=code if re.fullmatch('[A-Za-z_]{1,100}',code)else'private_dependency_or_protocol_failure'
            if report.get('claims_start_attempted'):close_claims(protocol,a,report)
            report['claims_observed']={n:a.state(n)for n in a.CONSUMERS}
            report['recovery_hint']='Keep claims closed. Inspect exact Native stdout/terminal witness; any cleanup or job-absent retirement needs a separately reviewed new intent. Never replay this consumed continuation.'
        report['Native_stdout_receipts']=[{'name':p.name,'sha256':sha(protocol.file_bytes(p,mode=0o600))}for p in sorted(WORK.glob('native-*-stdout-*.json'))]
        try:protocol.write_once(WORK/'reconcile-retire.json',protocol.encoded(report))
        except Exception:
            if report.get('claims_start_attempted'):close_claims(protocol,a,report)
            raise
        return report
    finally:os.close(fd)

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('phase',choices=('verify-current','reconcile-retire'));parser.add_argument('--operator-sha256',required=True);parser.add_argument('--execute',action='store_true');args=parser.parse_args()
    try:
        result=run(args);print(json.dumps(result));sys.exit(0 if result['status']in('current_containment_verified_read_only','reconciled_retired_claims_resumed')else 1)
    except Exception as error:
        code=str(error);print(json.dumps({'phase':args.phase,'status':'precondition_failed','failure_code':code if re.fullmatch('[A-Za-z_]{1,100}',code)else'private_dependency_or_protocol_failure','private_details_emitted':False,'no_automatic_replay':True}));sys.exit(1)
