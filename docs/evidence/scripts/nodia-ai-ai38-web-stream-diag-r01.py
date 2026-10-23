"""Read-only exact-attempt stream diagnostics, with bounded private log capture.

No raw log, response, ID, path, text, header or credential is emitted. The single
attempt identity comes from the caller; this script does not dispatch requests.
"""
from datetime import datetime, timezone
import argparse, json, os, re, selectors, subprocess, time, uuid
PHASES={'activity_started','activity_completed','activity_failed','activity_cancelled','generation_started','generation_completed','generation_failed','generation_cancelled','request_started','response_opened','request_failed','request_cancelled','first_body_chunk','candidate_output','recovery_started','recovery_completed','recovery_failed','recovery_cancelled','stream_exit_started','stream_exit_completed','stream_exit_failed','stream_exit_cancelled','client_close_started','client_close_completed','client_close_failed','client_close_cancelled','cancellation_requested','upload_started','upload_http_completed','upload_failed','upload_cancelled'}
ERRORS={'TimeoutError','ServiceError','ValueError','TypeError','KeyError','AttributeError','RuntimeError','APIError','AuthError','ReadTimeout','JSONDecodeError','HTTPError','RequestException','GeminiError','UsageLimitExceededError','TemporarilyBlockedError','ConnectionError','SSLError','Timeout','ConnectTimeout','CancelledError'}
def count(v):return v if type(v) is int and 0<=v<=2**31 else None
def boolean(v):return v if type(v) is bool else None
def en(v,allowed):return v if v is None or type(v) is str and v in allowed else 'not_projected'
def run(args):return subprocess.run(args,capture_output=True,check=True,timeout=25).stdout
def epoch():
 v=json.loads(run(['docker','inspect','nodia-gemini-microservice']))[0]
 assert v['State']['Running']
 return dict(id=v['Id'],image=v['Image'],started_at=v['State']['StartedAt'])
def event(v):
 return {'phase':en(v.get('phase'),PHASES),'task_role':en(v.get('task_role'),{'generation','caller','background_activity','background_refresh'}),'elapsed_ms':count(v.get('elapsed_ms'))}
def upload(v):
 out={k:count(v.get(k)) for k in ('ordinal','started_elapsed_ms','completed_elapsed_ms','duration_ms','http_status')}
 out.update(outcome=en(v.get('outcome'),{'pending','http_completed','failed','cancelled'}),reference_nonempty=boolean(v.get('reference_nonempty')),reference_prefix_matches=boolean(v.get('reference_prefix_matches')));return out
def snapshot(v):
 out={k:count(v.get(k)) for k in ('elapsed_ms','http_status','byte_chunks','body_bytes','candidate_outputs','activity_calls','recovery_calls','client_close_calls','sink_errors','upstream_eof_elapsed_ms')}
 out.update(attached=boolean(v.get('attached')),last_phase=en(v.get('last_phase'),PHASES),cancelled_at_phase=en(v.get('cancelled_at_phase'),PHASES),upstream_eof_seen=boolean(v.get('upstream_eof_seen')))
 out['events']=[event(x) for x in v.get('events',[])[:16] if type(x) is dict]
 u=v.get('uploads')
 if type(u) is dict:out['uploads']={**{k:count(u.get(k)) for k in ('requests','roundtrips_completed','failed','cancelled','sink_errors','metadata_errors')},'records':[upload(x) for x in u.get('records',[])[:4] if type(x) is dict]}
 p=v.get('body_pacing')
 if type(p) is dict:out['body_pacing']={k:count(p.get(k)) for k in ('first_chunk_elapsed_ms','last_chunk_elapsed_ms','max_inter_chunk_gap_ms')}
 a=v.get('audio_transport')
 if type(a) is dict:out['audio_transport']={**{k:boolean(a.get(k)) for k in ('scoped','applied')},**{k:count(a.get(k)) for k in ('input_files','audio_files')},'audio_media_types':[en(x,{'audio/wav','audio/ogg','audio/webm','audio/mpeg','audio/mp4'}) for x in a.get('audio_media_types',[])[:4]],'descriptor_version':en(a.get('descriptor_version'),{'explicit-audio/1'})}
 o=v.get('output_shape')
 if type(o) is dict:out['output_shape']={**{k:boolean(o.get(k)) for k in ('text_nonempty','text_delta_nonempty','thoughts_present','thoughts_empty')},**{k:count(o.get(k)) for k in ('candidates_count','media_count','first_yield_elapsed_ms','last_yield_elapsed_ms','first_text_elapsed_ms','text_outputs','thoughts_only_outputs','empty_outputs','unclassified_outputs')}}
 f=v.get('stream_frames')
 if type(f) is dict:
  out['stream_frames']={**{k:count(f.get(k)) for k in ('streams','inspected_bytes','frames','parts','unclassified_parts','invalid_json_frames','inner_json_parts','invalid_inner_json_parts','status_list_parts','candidate_list_parts','candidates','candidate_id_parts','completed_indicator_parts','final_context_parts','data_analysis_parts','observer_errors')},**{k:boolean(f.get(k)) for k in ('enabled','cid_present','rid_present','limit_exceeded','incomplete_at_close')}}
  errors=f.get('error_categories')
  if type(errors) is dict:out['stream_frames']['error_categories']={k:count(errors.get(k)) for k in ('usage_limit','model_inconsistent','model_header_invalid','ip_blocked','temporary_1013','other')}
 return out

def logs(since, until):
 process=subprocess.Popen(['docker','logs','--timestamps','--since',since,'--until',until,'--tail','5000','nodia-gemini-microservice'],stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
 captured=bytearray()
 deadline=time.monotonic()+25
 try:
  with selectors.DefaultSelector() as selector:
   selector.register(process.stdout,selectors.EVENT_READ)
   while selector.get_map():
    remaining=deadline-time.monotonic()
    if remaining<=0:raise TimeoutError('Diagnostic log read deadline')
    for key,_ in selector.select(remaining):
     data=os.read(key.fileobj.fileno(),65536)
     if not data:selector.unregister(key.fileobj);continue
     if len(captured)+len(data)>8*1024*1024:raise ValueError('Diagnostic log byte budget')
     captured.extend(data)
  assert process.wait(timeout=max(0.1,deadline-time.monotonic()))==0
  return bytes(captured)
 finally:
  if process.poll() is None:process.kill();process.wait(timeout=5)
  process.stdout.close()

def read(attempt, since, until):
 before=epoch()
 raw_logs=logs(since, until)
 records=[]
 for raw in raw_logs.splitlines():
  for marker in (b'nodia_ai_web_progress ',b'nodia_ai_web_cancelled ',b'nodia_ai_web_success ',b'nodia_ai_chat_failure '):
   if marker not in raw:continue
   try:v=json.loads(raw.split(marker,1)[1])
   except (ValueError,UnicodeError):continue
   if type(v) is not dict or v.get('attempt_id')!=attempt:continue
   stamp=raw.split(b' ',1)[0].decode('ascii');assert re.fullmatch(r'[0-9TZ:.+\-]+',stamp)
   item={'timestamp_VM_utc':stamp,'event':marker.decode('ascii').strip()}
   if marker==b'nodia_ai_web_progress ':item.update(event(v))
   else:
    item.update(engine=en(v.get('engine'),{'web','agentic'}),phase=en(v.get('phase'),{'generation','reply_validation','cookie_persistence','terminal_record'}),error_type=en(v.get('error_type'),ERRORS),failure_category=en(v.get('failure_category'),{'provider_timeout','response_error','provider_response_error','chat_result_unknown','invalid_model','native_context_exceeded'}),elapsed_ms=count(v.get('elapsed_ms')))
    if type(v.get('web_generation')) is dict:item['web_generation']=snapshot(v['web_generation'])
   if type(v.get('upload')) is dict:item['upload']=upload(v['upload'])
   records.append(item)
   break
 assert epoch()==before
 sdk=json.loads(run(['docker','exec','--user','10001:10001','nodia-gemini-microservice','python','-B','-c',"import importlib.metadata,json;print(json.dumps({'gemini-webapi':importlib.metadata.version('gemini-webapi'),'curl-cffi':importlib.metadata.version('curl-cffi')}))"]))
 return {'schema':'ai38-web-stream-diag-v1','observed_VM_utc':datetime.now(timezone.utc).isoformat(),'attempt_id':attempt,'window_begin_VM_utc':since,'window_end_VM_utc':until,'native_epoch':before,'same_epoch_after':True,'installed_SDK_versions':sdk,'records':sorted(records,key=lambda x:x['timestamp_VM_utc']),'record_count':len(records),'raw_logs_audio_text_messages_tokens_or_headers_saved':False,'HTTP_requests':0,'provider_generation_requests':0,'service_changes':0}

def main():
 parser=argparse.ArgumentParser(description=__doc__)
 parser.add_argument('--attempt',required=True)
 parser.add_argument('--since',required=True)
 parser.add_argument('--until',required=True)
 args=parser.parse_args()
 assert str(uuid.UUID(args.attempt))==args.attempt
 dates=[]
 for value in (args.since,args.until):
  assert re.fullmatch(r'[0-9TZ:.+\-]{20,40}',value)
  stamp=datetime.fromisoformat(value.replace('Z','+00:00'))
  assert stamp.utcoffset() is not None and stamp.utcoffset().total_seconds()==0
  dates.append(stamp)
 assert 0<=(dates[1]-dates[0]).total_seconds()<=900
 print(json.dumps(read(args.attempt,args.since,args.until),indent=2))

if __name__=='__main__':
 try:main()
 except Exception:
  # Exception messages from subprocesses or decoders may contain private data.
  raise SystemExit('Read-only diagnostic failed; no private output exported') from None
