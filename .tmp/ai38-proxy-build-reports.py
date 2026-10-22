from pathlib import Path
import json,hashlib

base=Path('docs/evidence')
load=lambda name:json.loads((base/name).read_bytes())
ref=lambda name:{'path':(base/name).as_posix(),'sha256':hashlib.sha256((base/name).read_bytes()).hexdigest()}
ready=load('nodia-ai-ai38-attachment-r2-ready-r01.json');absent=load('nodia-ai-ai38-attachment-r2-absent-r01.json')
assert ready['status']==absent['status']=='passed'
runtime=load('nodia-ai-ai38-proxy-runtime-final-r01.json')
entry=load('nodia-ai-ai38-proxy-entry-r01.json')
chat=load('nodia-ai-ai38-attachment-chat-final-r01.json')
assert chat['snapshot']['counts']['messages']==chat['snapshot']['counts']['runs']==0
assert all(value==0 for value in chat['global_quiet'].values())
assert runtime['Gemini']==entry['Gemini'] and runtime['units']==entry['units']
opened=load('nodia-ai-ai38-proxy-ui-open-r01.json');closed=load('nodia-ai-ai38-proxy-ui-close-r01.json')
assert closed['site_after_sha256']==load('nodia-ai-ai38-proxy-final-r01.json')['site_after_sha256']
UI={'stage':'AI-38-proxy-attachments','status':'passed','authentication_kind':'existing_legitimate_session_restored',
 'fixture_session_or_token_injected':False,'started_at_utc':opened['finished_at_utc'],'finished_at_utc':closed['started_at_utc'],
 'time_basis':'VM open/close receipts bound the actual UI sequence; Windows clock is not used for ordering.',
 'conversation_id':ready['conversation_id'],'attachment_id':ready['attachment_id'],
 'synthetic_chat_title':'AI-38 proxy 20 MiB — prueba sintética','uploaded_file_bytes':20971520,
 'upload_success':True,'over_limit_frontend_rejected':True,'owned_attachment_discarded':True,
 'message_draft_preserved_on_size_rejection':True,'oversize_created_intents':0,'application_download_exercised':False,
 'R2_private_download_verified_by_operator':True,'provider_generations':0,'business_effects':0,
 'new_messages':0,'chat_archived_via_UI':True,'message_draft_cleared':True,
 'SQL_chat_final':ref('nodia-ai-ai38-attachment-chat-final-r01.json'),
 'HTTP_observer':{'begin':ref('nodia-ai-ai38-attachment-observer-begin-r01.json'),'end':ref('nodia-ai-ai38-attachment-observer-end-r01.json')},
 'observations':['Existing legitimate session restored; normal session refresh was observed, without reading tokens/cookies.',
 'A new clearly named synthetic chat was created; only its own selection was configured from the existing Gemini Web catalog.',
 'The +1 byte PDF selection showed the localized error, created no card or SQL reservation, and retained the message draft.',
 'Exactly one reservation POST201 and one content PUT200 were observed for the 20 MiB fixture.',
 'The UI displayed Archivo validado, 20971520 bytes, and the one-page PDF synthetic extraction.',
 'Quitar adjunto showed Adjunto retirado; the worker subsequently removed the exact R2 object.',
 'No Enviar mensaje action, provider generation, OCR or business operation was requested.',
 'The chat was left empty and archived through the ordinary reversible UI, not hard-deleted.'],
 'screenshots':[ref(name) for name in ('nodia-ai-ai38-attachment-over-limit-ui-r01.png','nodia-ai-ai38-attachment-ready-ui-r01.png','nodia-ai-ai38-attachment-removed-ui-r01.png')],
 'limits':['The draft attachment panel has no download action. The 20 MiB GET digest was checked using the private R2 operator observer, not attributed to an application/UI download.',
 'The existing 4-file/40 MiB message aggregate, other formats and new inference with a 20 MiB native attachment were not reaccepted by this test.',
 'During initial configuration session renewal was observed and the unapplied drawer had to be reopened; the cause of its closing was not established. Upload and size rejection occurred afterwards.',
 'Normal archived chat metadata and expired attachment metadata remain subject to existing retention; no extra data archive is created.']}
target=base/'nodia-ai-ai38-attachment-ui-r01.json';target.open('x',encoding='utf-8').write(json.dumps(UI,ensure_ascii=False,indent=2)+'\n')
closure={'stage':'AI-38-proxy-attachments','status':'passed','observed_at_utc_VM':Path('.tmp/ai38-proxy-local-closure-vm-time.txt').read_text().strip(),
 'owned_R2_objects_remaining':0,'SQL_and_native_pending':0,'original_services_active':4,'Gemini_restarts':0,
 'original_Node932_unchanged':True,'owned_tunnel_and_tab_closed':True,'owned_tunnel_pid':95496,
 'owned_tunnel_identity_and_loopback_listener_verified':True,'port_5174_listeners_remaining':0,'unrelated_processes_stopped':0,
 'temporary_viewport_override_reset':True,'final_proxy_site_sha256':closed['site_after_sha256'],
 'original_database_restored':False,'API_or_worker_restarts':0,'private_owned_R2_ledger_removed':True,
 'chat_archived_not_deleted':True,'chat_new_messages':0,'chat_new_runs':0,
 'runtime_receipt':ref('nodia-ai-ai38-proxy-runtime-final-r01.json'),
 'cleanup_receipt':ref('nodia-ai-ai38-attachment-ledger-cleanup-r01.json'),
 'limits':['Normal archived chat/expired attachment metadata retain their ordinary retention; all test cloud objects and private observation ledgers are removed.',
 'The durable scoped 20m proxy change remains; only the temporary Client root serving was reverted to404.']}
target=base/'nodia-ai-ai38-attachment-closure-r01.json';target.open('x',encoding='utf-8').write(json.dumps(closure,indent=2)+'\n')
print(json.dumps({'UI_status':UI['status'],'closure_status':closure['status']}))
