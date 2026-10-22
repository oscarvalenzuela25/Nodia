"""One real, read-only synthetic MCP loop; no product DB writes or retries."""
import argparse, importlib.util, json, secrets, time, urllib.request, urllib.error
from pathlib import Path
from uuid import uuid4

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--live',action='store_true',required=True);parser.add_argument('--output',type=Path,required=True);parser.add_argument('--native-probe-script',type=Path,required=True);args=parser.parse_args()
    spec=importlib.util.spec_from_file_location('native_probe',args.native_probe_script);module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    config=module.configuration();selection=config['selections']['agentic']
    report={'stage':'AI-32','scope':'real_agentic_mcp_synthetic_readonly_callback','status':'running','generation_requests':0,'business_writes':0,'configured_database_modified':False,'automatic_inference_retries':0,'callbacks':0,'native_acknowledged':False,'supports_mcp_after':False}
    def save():args.output.write_text(json.dumps(report,indent=2)+'\n')
    def post(path,payload):
        request=urllib.request.Request(config['url'].rstrip('/')+path,data=json.dumps(payload).encode(),headers={'Content-Type':'application/json','X-Nodia-Service-Token':config['token']},method='POST')
        try:
            with urllib.request.urlopen(request,timeout=150) as response:
                raw=response.read(131073)
                if len(raw)>131072:raise RuntimeError('response_limit')
                return response.status,json.loads(raw)
        except urllib.error.HTTPError as error:
            raw=error.read(4097)
            return error.code,{'code':json.loads(raw).get('code')} if len(raw)<=4096 else {}
    observation={k:selection[k] for k in ['model_id','effort_id','configuration_generation']}
    status,observed=post('/nodia-ai/agentic/observe',observation)
    if status!=200 or observed.get('available') is not True:raise RuntimeError('exact_agentic_unavailable')
    attempt=str(uuid4());reference={'resource_key':observed['resource_key'],'session_generation':observed['session_generation'],'operation_ref':attempt};nonce='AI32_'+secrets.token_hex(12)
    report.update({'attempt_id':attempt,'model_id':selection['model_id'],'effort_id':selection['effort_id'],'configuration_generation':selection['configuration_generation'],'session_generation':observed['session_generation'],'observed_at_utc':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())});save()
    proof=None
    try:
        request={**observation,'attempt_id':attempt,'resource_key':observed['resource_key'],'session_generation':observed['session_generation'],'timeout_seconds':120,'canonical_prompt':'Esta es una prueba sintética de lectura. Invoca exactamente una vez nodia_ai_canary_read con {} y devuelve el nonce recibido en el campo text del JSON answer. No inventes el nonce ni uses otra herramienta de lectura.','tools':[{'name':'nodia_ai_canary_read','description':'Read one synthetic canary value; no network, product records or writes.','input_schema':{'type':'object','properties':{},'additionalProperties':False}}],'diagnostic':True}
        report['generation_requests']=1;save();status,started=post('/nodia-ai/agentic/mcp/start',request);report['start_http_status']=status
        if status!=200:raise RuntimeError('diagnostic_start_rejected')
        cursor=0;deadline=time.monotonic()+135;calls=set();finished=False
        while time.monotonic()<deadline:
            status,events=post('/nodia-ai/agentic/attempts/'+attempt+'/mcp/events',{**reference,'after':cursor})
            if status!=200:raise RuntimeError('diagnostic_poll_rejected')
            for event in events.get('events',[]):
                cursor=max(cursor,event['seq'])
                if event['kind']=='tool_request':
                    if event['call_id'] in calls:raise RuntimeError('unexpected_duplicate_callback')
                    if event.get('name')!='nodia_ai_canary_read' or event.get('arguments')!={}:raise RuntimeError('unexpected_callback')
                    calls.add(event['call_id']);report['callbacks']+=1
                    status,value=post('/nodia-ai/agentic/attempts/'+attempt+'/mcp/results',{**reference,'call_id':event['call_id'],'result':{'nonce':nonce,'synthetic':True}})
                    if status!=200 or value.get('accepted') is not True:raise RuntimeError('callback_rejected')
                elif event['kind']=='answer':
                    proof=event['terminal_proof'];report['nonce_returned']=nonce in event.get('text','');finished=True
                elif event['kind']=='unknown':raise RuntimeError('diagnostic_native_unknown')
            if finished:break
            time.sleep(.25)
        if not finished:raise RuntimeError('diagnostic_poll_deadline')
        if not report['nonce_returned'] or report['callbacks']!=1:raise RuntimeError('diagnostic_callback_semantic_mismatch')
        status,attested=post('/nodia-ai/agentic/attempts/'+attempt+'/mcp/attest',reference)
        report['attested']=status==200 and attested.get('verified') is True
        report['status']='passed' if report['nonce_returned'] and report['attested'] and report['callbacks']==1 else 'gates_open'
    except Exception as error:
        report['status']='gates_open';report['safe_error_type']=type(error).__name__
        report['safe_error_category']=str(error) if isinstance(error,RuntimeError) else 'transport_error'
    finally:
        if proof is None:
            status,value=post('/nodia-ai/agentic/attempts/'+attempt+'/reconcile',reference)
            report['reconciliation_http_status']=status
            if status==200:proof=value
        if proof is not None:
            status,value=post('/nodia-ai/agentic/attempts/'+attempt+'/acknowledge',{**reference,'terminal_proof_id':proof['terminal_proof_id']})
            report['native_acknowledged']=status==200 and value.get('acknowledged') is True
        status,after=post('/nodia-ai/agentic/observe',observation);report['supports_mcp_after']=status==200 and after.get('supports_mcp') is True
        report['quiet_after']=module.configuration()['quiet'];report['completed_at_utc']=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime());save()
    print(json.dumps({k:report[k] for k in ['status','generation_requests','callbacks','native_acknowledged','supports_mcp_after']}))

if __name__=='__main__':main()
