"""Offline checks of the exact live UI/SQL/MCP evidence chain; no network or writes to runtime."""
import argparse
from copy import deepcopy
from datetime import datetime
import hashlib
import json
from pathlib import Path
import re

ROOT=Path(__file__).resolve().parents[3]
EVIDENCE=ROOT/'docs/evidence'
CHAT='a160f615-ea41-4a05-831d-acdbb413ec4d'
PROPOSAL='e73f0a17-62d5-41e9-97dd-20d9b30dcc58'
EXECUTION='57c70fda-56e5-4456-82b2-2d6aa5794079'
HASH='712609fcccc5ce21b043ee3af9eee0d64cb23e50fa50bd6d278e0f6729df845e'
RUN='ad1d1c79-5658-4649-8261-9f4dc6984fff'
MARKER='AI38-UI-R01-20261020'
TOOL='nodia_finance_movements_prepare_create'
SQL_SHA='9591b6ca6ba75d03758782e24cfc9ce12945ccad235666c0bfac731ae9d9f1fe'

def sha(data):return hashlib.sha256(data).hexdigest()
def canonical(value):return json.dumps(value,ensure_ascii=False,separators=(',',':')).encode()
def stamp(value):return datetime.fromisoformat(value.replace('Z','+00:00'))
def one(values):
    assert len(values)==1,'exactly_one_required'
    return values[0]

def validate(documents):
    checks=[]
    def check(name,condition):
        assert condition,name
        checks.append(name)
    snapshots={}
    for phase in ('before','ready','prepared','first_human','completed','reopened'):
        record=documents[phase]
        check(phase+'_SQL_read_only',record['transaction']=={'read_only':True,'isolation':'repeatable read'})
        check(phase+'_source_pin',record['source_sha256']==SQL_SHA)
        snapshot=record['snapshot'];snapshots[phase]=snapshot
        check(phase+'_projected_snapshot_hash',sha(canonical(snapshot))==record['snapshot_sha256'])
        check(phase+'_known_owner_chat',snapshot['conversation']['id']==CHAT and snapshot['conversation']['owner_id']=='1')
        check(phase+'_no_observer_effect',record['configured_SQL_writes']==record['provider_requests']==0)
    times=[stamp(documents[phase]['observed_at_VM_utc']) for phase in snapshots]
    check('chronological_SQL_observations',times==sorted(times))
    for phase in ('before','ready'):
        snapshot=snapshots[phase]
        check(phase+'_no_prompt_or_effect',snapshot['counts']['messages']==snapshot['counts']['runs']==snapshot['counts']['proposals']==snapshot['counts']['executions']==snapshot['marker_count']['owned_marker_count']==0 and snapshot['movements']==[])
    check('setup_category_added_between_observations',snapshots['before']['category_counts']['owned_active']==0 and snapshots['ready']['category_counts']['owned_active']==1)
    check('ready_own_category',one(snapshots['ready']['own_active_categories'])=={'id':'1','user_id':'1','is_active':True})
    prepared=snapshots['prepared'];completed=snapshots['completed'];reopened=snapshots['reopened']
    check('first_human_response_without_effect',documents['first_human']['snapshot_sha256']==documents['prepared']['snapshot_sha256'])
    for phase in ('prepared','first_human'):
        snapshot=snapshots[phase];proposal=one(snapshot['proposals'])
        check(phase+'_ready_proposal_exact',proposal['id']==PROPOSAL and proposal['revision']==proposal['current_revision']==1 and proposal['hash']==HASH and proposal['state']=='ready')
        check(phase+'_no_confirmation_or_effect',snapshot['counts']['executions']==snapshot['counts']['execution_steps']==snapshot['counts']['challenges']==snapshot['marker_count']['owned_marker_count']==0)
    prepared_step=one(prepared['proposal_steps'])
    check('published_prepare_step',prepared_step['proposal_id']==PROPOSAL and prepared_step['proposal_revision']==1 and prepared_step['tool_name']==TOOL and prepared_step['subject_user_id']=='1')
    run=one(prepared['runs'])
    check('real_run_completed',run['id']==RUN and run['state']=='completed' and run['provider_dispatches_used']==2 and run['tool_calls_used']==4 and run['mcp_rpc_messages_used']==16)
    callbacks=prepared['callbacks']
    check('MCP_callback_names_exact',sorted(row['tool_name'] for row in callbacks)==sorted(['nodia_capabilities_select','nodia_finance_categories_get','nodia_knowledge_get',TOOL]))
    check('MCP_callbacks_completed',all(row['run_id']==RUN and row['state']=='completed' for row in callbacks))
    preparation=one([row for row in callbacks if row['tool_name']==TOOL])
    check('MCP_proposal_link',preparation['preparation_status']=='ready' and preparation['result_proposal_id']==PROPOSAL)
    for phase in ('completed','reopened'):
        snapshot=snapshots[phase];proposal=one(snapshot['proposals']);execution=one(snapshot['executions']);step=one(snapshot['execution_steps']);movement=one(snapshot['movements']);challenge=one(snapshot['challenges'])
        check(phase+'_one_effect_and_execution',snapshot['counts']['executions']==snapshot['counts']['execution_steps']==snapshot['marker_count']['owned_marker_count']==1)
        check(phase+'_confirmed_exact_proposal',proposal['id']==PROPOSAL and proposal['revision']==1 and proposal['state']=='confirmed' and proposal['hash']==HASH)
        check(phase+'_same_proposal_material',one(snapshot['proposal_steps'])==prepared_step)
        check(phase+'_execution_origin_exact',execution['id']==EXECUTION and execution['origin_proposal_id']==execution['proposal_id']==PROPOSAL and execution['origin_proposal_revision']==1 and execution['proposal_hash']==HASH and execution['actor_id']==execution['chat_owner_id']=='1' and execution['state']=='completed')
        check(phase+'_completed_same_step',step['id']==step['source_step_id']==prepared_step['id'] and step['execution_id']==EXECUTION and step['state']=='completed' and step['tool_name']==TOOL and re.fullmatch('[0-9a-f]{64}',step['bound_command_hash']) is not None)
        check(phase+'_receipt_effect_exact',step['minimal_receipt']=={'schema_version':1,'resource_key':'finance_movements','resource_id':movement['id'],'subject_user_id':'1'})
        check(phase+'_movement_values_exact',movement['id']=='1' and movement['user_id']==movement['category_id']=='1' and movement['test_marker']==MARKER and type(movement['amount']) is str and movement['amount']=='1' and movement['type']=='expense' and movement['status']=='pending' and movement['obligation_id'] is None and movement['is_active'] is True)
        check(phase+'_challenge_consumed_exact',challenge['proposal_id']==PROPOSAL and challenge['proposal_revision']==1 and challenge['actor_id']=='1' and challenge['expected_hash']==HASH and challenge['consumed'] is True and challenge['consumed_at'] is not None)
        grant=one([row for row in snapshot['grants'] if row['execution_id']==EXECUTION])
        check(phase+'_effect_grant_revoked',grant['command_set_hash']==HASH and grant['actor_id']=='1' and grant['revoked_at'] is not None)
        check(phase+'_SQL_quiet',documents[phase]['global_quiet']=={'pending_jobs':0,'open_attempts':0,'retained_slots':0} and snapshot['conversation']['active_job_id'] is None)
    check('reopening_entire_projection_unchanged',documents['completed']['snapshot_sha256']==documents['reopened']['snapshot_sha256'] and completed==reopened)
    setup=documents['setup'];s=setup['snapshot']
    check('setup_real_read_only',setup['transaction']=={'read_only':True,'isolation':'repeatable read'} and setup['configured_SQL_writes']==setup['provider_requests']==0)
    check('setup_only_known_subject_assignment',s['counts']['users_total']==s['counts']['personal_finance_assignments_all_users']==s['finance_assignment_count']==1 and s['counts']['subject_module_assignments']==8 and s['other_subject_assignment_count']==7)
    check('setup_finance_category_owned',one(s['categories'])=={'id':'1','user_id':'1','key':'ai38_acceptance','is_active':True})
    native=documents['native'];native_run=one(native['SQL']['runs']);native_attempts=native['per_attempt']
    check('native_run_matches',native_run['id']==RUN and native_run['state']=='completed' and native_run['provider_dispatches_used']==2)
    SQL_attempt_ids={row['id'] for row in prepared['attempts'] if row['native_operation_reference_present']}
    check('native_attempts_correlated',len(SQL_attempt_ids)==2 and {row['attempt_id'] for row in native_attempts}==SQL_attempt_ids)
    check('native_each_HTTP_ACK_observed',len(native_attempts)==2 and all(row['HTTP_200_ACK_count']==1 and row['ACK_HTTP_metadata_observed'] for row in native_attempts) and native['all_attempt_ACK_HTTP_200_observed'] is True)
    check('native_no_pending_artifacts',native['global_native_artifacts_absent'] is True and all(value==0 for value in native['native_artifact_counts'].values()))
    check('native_observer_no_effect',native['provider_requests']==native['configured_SQL_writes']==0 and native['ACK_or_reconcile_requested'] is False and native['same_container_epoch_after'] is True)
    human=documents['http_human'];http=documents['http_final'];start=documents['http_start']
    check('first_human_no_HTTP_confirmation',not any(row['endpoint'] in ('acceptance_confirmation','acceptance_confirmation_challenge') for row in human['counts']))
    check('HTTP_final_valid_observation',http['status']=='bounded_metadata_observed_not_Google_or_UI_acceptance')
    for name,value in (('conversation',CHAT),('proposal',PROPOSAL),('execution',EXECUTION),('movement','1')):
        check('HTTP_'+name+'_correlation',http['acceptance_'+name+'_sha256']==sha(value.encode()))
    check('HTTP_original_cursor_correlated',http['cursor_sha256']==human['cursor_sha256']==start['cursor_sha256'])
    counts=http['counts']
    for endpoint,status in (('acceptance_conversation_messages',202),('acceptance_confirmation_challenge',200),('acceptance_confirmation',202)):
        rows=[row for row in counts if row['endpoint']==endpoint and row['method']=='POST']
        check('HTTP_one_'+endpoint,rows==[{'endpoint':endpoint,'method':'POST','status':status,'count':1}])
    check('HTTP_execution_observed',any(row['endpoint']=='acceptance_execution' and row['method']=='GET' and row['status']==200 and row['count']>=1 for row in counts))
    check('HTTP_authenticated_window',any(row['endpoint']=='auth_me' and row['method']=='GET' and row['status']==200 and row['count']>=1 for row in counts))
    return checks

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--http-final',default='nodia-ai-ai38-live-http-final-r03.json')
    parser.add_argument('--output')
    args=parser.parse_args()
    assert Path(args.http_final).name==args.http_final,'evidence_filename_only'
    names={'before':'nodia-ai-ai38-live-sql-before-r01.json','ready':'nodia-ai-ai38-live-sql-ready-r01.json',
        'prepared':'nodia-ai-ai38-live-sql-prepared-r01.json','first_human':'nodia-ai-ai38-live-sql-confirmed-r01.json',
        'completed':'nodia-ai-ai38-live-sql-completed-r02.json','reopened':'nodia-ai-ai38-live-sql-reopened-r01.json',
        'setup':'nodia-ai-ai38-live-setup-r01.json','native':'nodia-ai-ai38-live-native-r01.json',
        'http_start':'nodia-ai-ai38-live-http-start-r01.json','http_human':'nodia-ai-ai38-live-http-human-r01.json',
        'http_final':args.http_final}
    documents={key:json.loads((EVIDENCE/name).read_bytes()) for key,name in names.items()}
    checks=validate(documents)
    rejections=[]
    for name,edit in (
        ('duplicate_effect_count',lambda d:d['reopened']['snapshot']['marker_count'].__setitem__('owned_marker_count',2)),
        ('missing_receipt',lambda d:d['completed']['snapshot']['execution_steps'][0].__setitem__('minimal_receipt',None)),
        ('wrong_proposal_hash',lambda d:d['prepared']['snapshot']['proposals'][0].__setitem__('hash','0'*64)),
        ('numeric_amount_instead_of_bigint_string',lambda d:d['completed']['snapshot']['movements'][0].__setitem__('amount',1)),
        ('missing_confirmation_HTTP',lambda d:d['http_final'].__setitem__('counts',[r for r in d['http_final']['counts'] if r['endpoint']!='acceptance_confirmation'])),
        ('missing_ACK',lambda d:d['native']['per_attempt'][0].__setitem__('HTTP_200_ACK_count',0)),
    ):
        variant=deepcopy(documents);edit(variant)
        # Rehash altered SQL projections so rejection tests reach semantic checks.
        for phase in ('before','ready','prepared','first_human','completed','reopened'):
            variant[phase]['snapshot_sha256']=sha(canonical(variant[phase]['snapshot']))
        try:validate(variant)
        except (AssertionError,KeyError,TypeError):rejections.append(name)
        else:raise AssertionError('tampered_evidence_accepted_'+name)
    record={'schema':'ai38-live-ui-validation-r01','status':'passed_offline_evidence_chain',
        'source_sha256':sha(Path(__file__).read_bytes()),'checks_passed':len(checks),'checks':checks,
        'tampered_evidence_rejected':rejections,'source_files_sha256':{name:sha((EVIDENCE/name).read_bytes()) for name in names.values()},
        'identities':{'conversation_id':CHAT,'proposal_id':PROPOSAL,'proposal_revision':1,'proposal_hash':HASH,'execution_id':EXECUTION,'movement_id':'1'},
        'network_requests':0,'runtime_mutations':0,
        'limits':['Offline consistency checks do not independently observe a physical human gesture or the DOM.',
                  'No duplicate on reopen is observed; HTTP retry/SIGKILL/COMMIT-loss scenarios are not repeated here.',
                  'Native terminal diagnostic records were absent; only correlated ACK HTTP metadata is verified.',
                  'Any HTTP rotation continuation retains its own explicit limits; failed earlier observations remain historical.']}
    text=json.dumps(record,indent=2)+'\n'
    if args.output:
        destination=Path(args.output).resolve();assert destination.parent==EVIDENCE
        with destination.open('x',encoding='utf-8') as output:output.write(text)
    else:print(text,end='')

if __name__=='__main__':
    try:main()
    except (AssertionError,KeyError,TypeError,ValueError,OSError) as error:
        print(json.dumps({'schema':'ai38-live-ui-validation-r01','status':'failed_offline_evidence_chain',
                          'failure_class':type(error).__name__,'failure':str(error)[:180]}))
        raise SystemExit(1)
