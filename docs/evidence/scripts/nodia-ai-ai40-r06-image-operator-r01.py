"""One fresh native image qualifier on frozen R06, explicitly authorized per MIME.

Reuses pinned public-config/process/SQL guards and packaged preaudio parent.
No R2/UI claim, readiness override, proof copying, inference retry or SQL release.
"""
import argparse
import datetime
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import sys

WORK=Path('/opt/nodia/verification/ai40-r06-image-operator-r01')
FIXTURES=Path('/opt/nodia/verification/ai40-r06-image-fixtures-r01')
GUARD=Path('/opt/nodia/verification/ai40-r06-mcp-operator-r01/nodia-ai-ai40-r06-mcp-operator-r01.py')
GUARD_SHA='99d5d7a3d6100c46f841e1d3938ceb72fdfc0abd1d6bdc191d83d5b9963f61b0'
INSPECTOR=WORK/'nodia-ai-ai40-r06-image-native-inspect-r01.mjs'
INSPECTOR_SHA='98f60ad2b34a5ee5bf6ad04c23ec3e73793f4796ee99f242de04f96d4a98ca29'
PRIVATE_SHA='c801c76ff3b28c24b6d4a12278bb780be7a3884bd5630edd354e2409e2fd75c0'
MIMES={'png':'image/png','jpeg':'image/jpeg','webp':'image/webp'}

def require(v,c):
    if not v:raise ValueError(c)

def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()

def private_bytes(path,uid):
    fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW)
    with os.fdopen(fd,'rb') as f:
        s=os.fstat(f.fileno());require(stat.S_ISREG(s.st_mode) and s.st_uid==uid and stat.S_IMODE(s.st_mode)==0o600 and s.st_nlink==1 and s.st_size<=20971520,'private_file_identity_invalid')
        b=f.read(20971521);require(len(b)==s.st_size,'private_file_size_changed');return b

def proof_snapshot(helper,selection,fp):
    values={}
    keys={'version','scope','verifiedAt','terminalProofId','nonceSha256'}
    for suffix in ('mcp','mcp-image-png','mcp-image-jpeg','mcp-image-webp'):
        path=helper.PROFILE/'1'/('nodia-chat-'+suffix)
        try:b=private_bytes(path,10000)
        except FileNotFoundError:values[suffix]={'present':False};continue
        p=json.loads(b);expected=keys if suffix=='mcp' else keys|{'mediaType'}
        require(type(p) is dict and set(p)==expected and p['version']==1,'proof_contract_invalid')
        require(type(p['nonceSha256']) is str and re.fullmatch('[a-f0-9]{64}',p['nonceSha256']) and type(p['terminalProofId']) is str and re.fullmatch('[a-f0-9-]{36}',p['terminalProofId']),'proof_identity_invalid')
        require(type(p['verifiedAt']) is str and datetime.datetime.fromisoformat(p['verifiedAt'].replace('Z','+00:00')).timestamp()<=datetime.datetime.now(datetime.timezone.utc).timestamp()+5,'proof_time_invalid')
        s=p['scope'];require(type(s) is dict and set(s)=={'connectionId','resourceKey','sessionGeneration','configurationGeneration','modelId','effortId','runtimeFingerprint'} and s['connectionId']==selection['connection_id'] and s['modelId']==selection['model_id'] and s['effortId']==selection['effort_id'] and s['runtimeFingerprint']==fp and re.fullmatch('codex-profile:[a-f0-9]{64}',s['resourceKey']) and re.fullmatch('[a-f0-9]{32}',s['sessionGeneration']) and re.fullmatch('[a-f0-9]{64}',s['configurationGeneration']),'proof_scope_invalid')
        if suffix!='mcp':require(p['mediaType']==MIMES[suffix.removeprefix('mcp-image-')],'proof_mime_invalid')
        values[suffix]={'present':True,'sha256':hashlib.sha256(b).hexdigest(),'scope':s,'terminal_proof_id':p['terminalProofId'],'verified_at':p['verifiedAt'],'nonce_sha256':p['nonceSha256']}
    require(values['mcp']['present'],'verified_MCP_required_before_image_qualifier')
    for p in values.values():
        if p['present']:require(p['scope']==values['mcp']['scope'],'proofs_require_common_current_scope')
    return values

def validate_parent(parent,code,selection,probe):
    require(type(parent) is dict and parent.get('schema')=='nodia-ai-ai40-real-canary-parent-v1' and type(parent.get('child')) is dict,'parent_receipt_invalid')
    c=parent['child'];require(c.get('schema')=='nodia-ai-ai40-real-canary-v1','child_receipt_contract_invalid');success=code==0 and parent.get('status')=='passed' and c.get('status')=='passed'
    if success:
        require(parent.get('fixture_resources_removed') is True and parent.get('retained_disposable_container') is None and parent.get('child_exit_code')==0 and parent.get('child_exit_signal') is None and parent.get('child_timed_out') is False,'parent_cleanup_invalid')
        require(c.get('selection')==selection and c.get('acceptance_kind')=='image_original' and c.get('image_media_type')==probe['media_type'] and c.get('image_source_sha256')==probe['sha256'] and c.get('provider_dispatches_armed')==1 and c.get('gateway_callbacks')==0 and c.get('run_state')=='completed' and c.get('assistant_message_sealed') is False and c.get('initial_mcp_accepted') is True and c.get('final_mcp_accepted') is True and probe['media_type'] in c.get('final_verified_image_media_types',[]),'image_semantics_invalid')
        require(all(c.get(k) is False for k in ('readiness_overridden','executable_overridden','publication_overridden','operational_database_accessed','operational_profile_removed')) and parent.get('operational_database_accessed') is False and parent.get('operational_profile_removed') is False,'image_authority_invalid')
        require(isinstance(c.get('terminal_proof_id'),str) and re.fullmatch('[a-f0-9-]{36}',c['terminal_proof_id']) and isinstance(c.get('response_sha256'),str) and re.fullmatch('[a-f0-9]{64}',c['response_sha256']),'image_terminal_invalid')
    return success

def run(a):
    require(sys.platform=='linux' and os.getuid()==0 and not sys.flags.optimize,'unoptimized_linux_root_required');sys.dont_write_bytecode=True
    require(sha(Path(__file__).resolve())==a.operator_sha256,'operator_changed')
    require(sha(GUARD)==GUARD_SHA and sha(INSPECTOR)==INSPECTOR_SHA,'guard_or_inspector_changed')
    spec=importlib.util.spec_from_file_location('pinned_R06_MCP_guard',GUARD);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
    m.private_file(GUARD);m.WORK=WORK;m.private_work();m.private_file(Path(__file__).resolve());m.private_file(INSPECTOR)
    spec=importlib.util.spec_from_file_location('pinned_profile_guard',m.HELPER);helper=importlib.util.module_from_spec(spec)
    require(sha(m.HELPER)==m.HELPER_SHA,'historical_guard_changed');spec.loader.exec_module(helper)
    legacy=helper.validate_candidate(m.LEGACY_MANIFEST_SHA);release=m.validate_release();helper.ACTIVE=m.RELEASE
    services={n:helper.service(n) for n in ('nodia-api','nodia-ai-worker','nodia-keyring')}
    before=helper.public_preflight(services)
    api=helper.selected_environment(services['nodia-api']['pid'],{'DOTENV_CONFIG_PATH','TZ','POSTGRES_HOST','POSTGRES_PORT','POSTGRES_DB','POSTGRES_USER','POSTGRES_PASSWORD','POSTGRES_SSL'})
    require(api.get('TZ') in (None,'UTC','Etc/UTC'),'timezone_requires_review')
    read_env={'PATH':'/usr/local/bin:/usr/bin:/bin','HOME':'/root','AI40_CONNECTION_ID':'1',**{k:v for k,v in api.items() if k!='TZ'}}
    source=(helper.CANDIDATE.parent/'public-canary-input.mjs').read_text()
    observed=helper.command(['/usr/local/bin/node','--input-type=module','-e',source],cwd=m.RELEASE,env=read_env,timeout=25)
    require(observed.returncode==0 and len(observed.stdout)<1048576,'public_config_read_failed')
    config=json.loads(observed.stdout);require(type(config) is dict and set(config)=={'schema_version','authorize_one_real_generation','selection','provider','expected_binary_sha256'} and config['schema_version']==1 and config['authorize_one_real_generation'] is True and config['expected_binary_sha256']==helper.BINARY_SHA,'public_config_contract_invalid')
    selection=config['selection'];require(type(selection) is dict and set(selection)=={'connection_id','mode','model_id','effort_id'} and selection['connection_id']=='1' and selection['mode']=='token_plan_agentic' and isinstance(selection['model_id'],str) and selection['model_id'].strip() and (selection['effort_id'] is None or isinstance(selection['effort_id'],str)),'public_selection_invalid')
    proofs=proof_snapshot(helper,selection,m.EXPECTED_RUNTIME_FINGERPRINT)
    raw=private_bytes(FIXTURES/'private-probes.json',10000);require(hashlib.sha256(raw).hexdigest()==PRIVATE_SHA,'private_probe_metadata_changed')
    probes=json.loads(raw);require(set(probes)==set(MIMES),'private_probe_set_invalid')
    probe=probes[a.mime];require(set(probe)=={'path','media_type','sha256','expected_code'} and probe['media_type']==MIMES[a.mime] and re.fullmatch('[A-Z0-9]{20}',probe['expected_code']),'private_probe_invalid')
    image=Path(probe['path']);require(image.parent==FIXTURES and image.resolve()==image,'fixture_path_invalid')
    image_bytes=private_bytes(image,10000);require(hashlib.sha256(image_bytes).hexdigest()==probe['sha256'] and probe['expected_code'].encode() not in image_bytes,'fixture_hash_or_metadata_invalid')
    target='mcp-image-'+a.mime;require(proofs[target]=={'present':False},'fresh_image_proof_already_present')
    intent=WORK/('intent-'+a.mime+'.json');require(not intent.exists(),'generation_intention_already_consumed')
    report={'schema':'nodia-ai-ai40-r06-image-operator-v1','phase':a.phase,'mime':probe['media_type'],'operator_sha256':a.operator_sha256,'release':release,'services':services,'before':before,'selection':selection,'public_configuration_sha256':hashlib.sha256(observed.stdout).hexdigest(),'acceptance_before':proofs,'image_sha256':probe['sha256'],'image_bytes':len(image_bytes),'oracle_sha256':hashlib.sha256(probe['expected_code'].encode()).hexdigest(),'provider_requests':0,'settings_or_services_changed':False,'profile_copied_or_restored':False,'credentials_or_oracle_emitted':False,'legacy_guard_provenance':legacy}
    if a.phase=='preflight':
        require(not a.authorize_one_real_generation,'preflight_cannot_authorize_generation');return {**report,'status':'preflight_passed'},0
    require(a.authorize_one_real_generation,'explicit_one_generation_required')
    before_entries=sorted(p.name for p in (helper.PROFILE/'chat-jobs').glob('*.json'))
    broker=helper.selected_environment(services['nodia-keyring']['pid'],{'DBUS_SESSION_BUS_ADDRESS','XDG_RUNTIME_DIR'})
    require(set(broker)=={'DBUS_SESSION_BUS_ADDRESS','XDG_RUNTIME_DIR'} and broker['DBUS_SESSION_BUS_ADDRESS']=='unix:path='+broker['XDG_RUNTIME_DIR']+'/bus','broker_transport_invalid')
    env={'PATH':'/usr/local/bin:/usr/bin:/bin','HOME':'/root','NODIA_CODEX_ENABLED':'true','NODIA_CODEX_PROFILE_ROOT':str(helper.PROFILE),**broker}
    m.write_once(intent,{'schema':'nodia-ai-ai40-r06-image-intent-v1','mime':probe['media_type'],'release_manifest_sha256':m.RELEASE_SHA,'image_sha256':probe['sha256'],'selection':selection,'MCP_sha256':proofs['mcp']['sha256'],'operator_sha256':a.operator_sha256,'generation_may_have_started':True})
    config['image_probe']=probe
    result=helper.command(['/usr/local/bin/node',str(m.RELEASE/'test/nodia-ai-ai40-real-canary-parent.mjs')],cwd=m.RELEASE,env=env,source=json.dumps(config).encode(),timeout=380)
    require(len(result.stdout)<4194304,'parent_output_exceeded');parent=json.loads(result.stdout)
    m.write_once(WORK/('receipt-'+a.mime+'.json'),parent)
    success=validate_parent(parent,result.returncode,selection,probe)
    inspection=helper.command(['/usr/local/bin/node',str(INSPECTOR)],cwd=m.RELEASE,env={'PATH':'/usr/local/bin:/usr/bin:/bin','HOME':'/root'},source=json.dumps({'before_entries':before_entries,'scope':proofs['mcp']['scope'],'success':success,'terminal_proof_id':parent['child'].get('terminal_proof_id')}).encode(),timeout=30)
    require(inspection.returncode==0 and len(inspection.stdout)<65536,'native_inspection_failed')
    native=json.loads(inspection.stdout);m.write_once(WORK/('native-'+a.mime+'.json'),native)
    after=helper.public_preflight(services);after_services={n:helper.service(n) for n in services}
    require(services==after_services and before['SQL']==after['SQL'],'operational_state_changed')
    observed_after=helper.command(['/usr/local/bin/node','--input-type=module','-e',source],cwd=m.RELEASE,env=read_env,timeout=25)
    require(observed_after.returncode==0 and hashlib.sha256(observed_after.stdout).digest()==hashlib.sha256(observed.stdout).digest(),'active_public_configuration_changed')
    require(m.validate_release()==release,'release_changed')
    after_proofs=proof_snapshot(helper,selection,m.EXPECTED_RUNTIME_FINGERPRINT)
    require(all(after_proofs[k]==v for k,v in proofs.items() if k!=target),'unrelated_acceptance_changed')
    if success:
        accepted=after_proofs[target];require(accepted['present'] and accepted['scope']==proofs['mcp']['scope'] and accepted['terminal_proof_id']==parent['child']['terminal_proof_id'] and accepted['nonce_sha256']==report['oracle_sha256'],'new_image_acceptance_mismatch')
    else:accepted=None
    return {**report,'status':'passed' if success else 'failed','parent':parent,'native':native,'after':after,'acceptance_after':after_proofs,'new_exact_image_acceptance':accepted,'provider_requests':parent['child']['provider_dispatches_armed'],'active_public_configuration_unchanged':True,'public_configuration_sha256_after':hashlib.sha256(observed_after.stdout).hexdigest(),'operational_SQL_unchanged':True,'MCP_preserved_byte_exact':True,'generation_not_replayed':True,'limits':['Native exact-MIME qualification only; packaged diagnostic handler, not UI/R2/autonomous image-worker acceptance.','No PDF/audio, business effect or other provider/model is qualified.']},0 if success else 1

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('phase',choices=['preflight','probe']);p.add_argument('--mime',choices=sorted(MIMES),required=True);p.add_argument('--operator-sha256',required=True);p.add_argument('--authorize-one-real-generation',action='store_true');a=p.parse_args()
    try:
        result,code=run(a);print(json.dumps(result));sys.exit(code)
    except Exception as e:
        text=str(e);print(json.dumps({'schema':'nodia-ai-ai40-r06-image-operator-v1','status':'operator_failed','mime':MIMES[a.mime],'error_class':type(e).__name__,'error_code':text if isinstance(e,ValueError) and re.fullmatch('[a-z][a-z0-9_]{1,95}',text) else 'operator_dependency_timeout_or_protocol_error','generation_may_have_started':(WORK/('intent-'+a.mime+'.json')).exists(),'operator_retry_allowed':False,'required_next_action':'inspect_exact_attempt_and_reconcile_without_replay','private_details_emitted':False}));sys.exit(1)
