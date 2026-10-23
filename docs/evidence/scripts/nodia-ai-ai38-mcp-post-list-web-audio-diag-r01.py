"""Exact-attempt retrospective Web audio diagnostics: no native content exported."""
from datetime import datetime,timezone
import importlib.metadata,json,re,subprocess
ATTEMPT='7edcd65f-199c-450c-9957-f3ca1d56d383'
EXPECTED={'id':'9b07866b018c51efcb481a47fa8d81ef94b98dab430c1535b54b5d098488f267','image':'sha256:073f319ffa35c75d82be379a2d6d0d48a1c760b7f37103c8194120e51d71660e','started_at':'2026-10-22T19:48:35.342867871Z'}
PHASES={'activity_started','activity_completed','activity_failed','activity_cancelled','generation_started','generation_completed','generation_failed','generation_cancelled','request_started','response_opened','request_failed','request_cancelled','first_body_chunk','candidate_output','recovery_started','recovery_completed','recovery_failed','recovery_cancelled','stream_exit_started','stream_exit_completed','stream_exit_failed','stream_exit_cancelled','client_close_started','client_close_completed','client_close_failed','client_close_cancelled','cancellation_requested','upload_started','upload_http_completed','upload_failed','upload_cancelled'}
ERRORS={'TimeoutError','ServiceError','ValueError','TypeError','KeyError','AttributeError','RuntimeError','APIError','AuthError','ReadTimeout','JSONDecodeError','HTTPError','RequestException','GeminiError','UsageLimitExceededError','TemporarilyBlockedError','ConnectionError','SSLError','Timeout','ConnectTimeout','CancelledError'}
def count(v):return v if type(v) is int and 0<=v<=2**31 else None
def boolean(v):return v if type(v) is bool else None
def en(v,allowed):return v if v is None or type(v) is str and v in allowed else 'not_projected'
def run(args):return subprocess.run(args,capture_output=True,check=True,timeout=25).stdout
def epoch():
 v=json.loads(run(['docker','inspect','nodia-gemini-microservice']))[0];e=dict(id=v['Id'],image=v['Image'],started_at=v['State']['StartedAt']);assert e==EXPECTED and v['State']['Running'];return e
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
 return out
before=epoch()
r=subprocess.run(['docker','logs','--timestamps','--since','2026-10-22T20:53:57Z','--until','2026-10-22T20:56:04Z','--tail','5000','nodia-gemini-microservice'],capture_output=True,check=True,timeout=25)
assert len(r.stdout)+len(r.stderr)<=8*1024*1024
records=[]
for raw in (r.stdout+b'\n'+r.stderr).splitlines():
 for marker in (b'nodia_ai_web_progress ',b'nodia_ai_web_cancelled ',b'nodia_ai_web_success ',b'nodia_ai_chat_failure '):
  if marker not in raw:continue
  try:v=json.loads(raw.split(marker,1)[1])
  except (ValueError,UnicodeError):continue
  if type(v) is not dict or v.get('attempt_id')!=ATTEMPT:continue
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
print(json.dumps({'schema':'ai38-mcp-post-list-web-audio-diag-v1','observed_VM_utc':datetime.now(timezone.utc).isoformat(),'attempt_id':ATTEMPT,'window_begin_VM_utc':'2026-10-22T20:53:57Z','window_end_VM_utc':'2026-10-22T20:56:04Z','native_epoch':before,'same_epoch_after':True,'installed_SDK_versions':sdk,'records':sorted(records,key=lambda x:x['timestamp_VM_utc']),'record_count':len(records),'raw_logs_audio_text_messages_tokens_or_headers_saved':False,'HTTP_requests':0,'provider_generation_requests':0,'service_changes':0},indent=2))
