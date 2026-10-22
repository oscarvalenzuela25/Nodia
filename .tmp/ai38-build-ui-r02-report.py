from pathlib import Path
import hashlib
import json
from datetime import datetime

base=Path('docs/evidence')
read=lambda name:json.loads((base/name).read_bytes())
reference=lambda name:{'path':(base/name).as_posix(),'sha256':hashlib.sha256((base/name).read_bytes()).hexdigest()}
begin=read('nodia-ai-ai38-ui-retry-observer-begin-r01.json')
end=read('nodia-ai-ai38-ui-retry-observer-end-r01.json')
postbegin=read('nodia-ai-ai38-ui-retry-post-observer-begin-r01.json')
postend=read('nodia-ai-ai38-ui-retry-post-observer-end-r01.json')
before=read('nodia-ai-ai38-ui-history-before-r01.json')
after=read('nodia-ai-ai38-ui-history-after-r01.json')
assert before['message_articles_sha256']==after['message_articles_sha256']
assert before['article_count']==after['article_count']==2
assert read('nodia-ai-ai38-ui-chat-before-r01.json')['snapshot_sha256']==read('nodia-ai-ai38-ui-chat-after-r01.json')['snapshot_sha256']
passed=lambda value,endpoint,method:any(x['endpoint']==endpoint and x['method']==method and x['status']==200 and x['count']>0 for x in value['counts'])
assert passed(end,'auth_login','POST') and passed(end,'auth_me','GET')
assert passed(postend,'acceptance_conversation_messages','GET')
report={
 'stage':'AI-38','scope':'real_human_login_drawer_and_existing_chat_read_continuity_across_code_rollback',
 'status':'passed','started_at_utc':begin['began_at_utc'],'finished_at_utc':end['finished_at_utc'],
 'full_frozen_Client_shell':True,'fixture_session_or_token_injected':False,
 'authentication_kind':'human_Google_exchange','business_effects':0,
 'checks':{k:'passed' for k in ('auth_me','authorization_context','own_chat_history','drawer_exact_selection','away_return','deep_reload','drawer_cancel_without_selection_persistence','drawer_mobile_controls_and_no_horizontal_overflow','drawer_focus_return')},
 'drawer_observed_labels':{'connection':'Laboratorio Ubuntu gemini',
  'Web':{'model':'3.8 Flash','effort':'Sin intensidad asignada','availability':'Esta selección está disponible para el chat.','auto_agentic_switch':False,'target':'gemini-3.8-flash-high · Alto'},
  'Agentic':{'model':'Gemini 3.8 Flash (High)','effort':'Alto','availability':'Esta selección está disponible para el chat.','auto_agentic_switch_visible':False},
  'actions':['Web → Agentic → Web as local draft','Cancelled without Apply','Focus returned to Configuración'],
  'source':'Rendered DOM labels; stored IDs are independently projected by the read-only SQL snapshots, not read from hidden application state.'},
 'viewports':[{'width':1440,'height':900,'scope':'authenticated history and drawer','physical_device':False},
              {'width':390,'height':844,'scope':'Web drawer; fields and close/cancel/apply controls visible','physical_device':False}],
 'responsive_metrics':reference('nodia-ai-ai38-ui-drawer-mobile-metrics-r01.json'),
 'provider':{'browser_message_submissions':0,'native_requests':0,'terminal_ACKs':0,'completed':0,'unknown':0,'attempt_id':None,'semantic_match':None,'fixture_transport':False},
 'observer_reports':{'begin':(base/'nodia-ai-ai38-ui-retry-observer-begin-r01.json').as_posix(),'end':(base/'nodia-ai-ai38-ui-retry-observer-end-r01.json').as_posix()},
 'post_rollback_read':{'status':'passed','started_at_utc':postbegin['began_at_utc'],
  'finished_at_utc':Path('.tmp/ai38-ui-retry-post-finished-vm.txt').read_text().strip(),
  'observer_reports':{'begin':(base/'nodia-ai-ai38-ui-retry-post-observer-begin-r01.json').as_posix(),'end':(base/'nodia-ai-ai38-ui-retry-post-observer-end-r01.json').as_posix()},
  'fresh_messages_GET':True,'history_content_match':True,'loaded_SPA_retained_without_reload':True,
  'conversation_sha256':before['conversation_sha256'],
  'before_visible_history_sha256':before['message_articles_sha256'],'after_visible_history_sha256':after['message_articles_sha256'],
  'article_count':2,'DOM_before':reference('nodia-ai-ai38-ui-history-before-r01.json'),'DOM_after':reference('nodia-ai-ai38-ui-history-after-r01.json'),
  'navigation':'33d6… → existing Agentic chat d4f0… → 33d6… using the loaded SPA after rollback; no document reload.',
  'HTTP_observation':'Target detail and messages GET200 after original runtime restoration. One eligibility499 and another eligibility200 observed during the chat change; no provider failure inferred.'},
 'screenshots':[reference(name) for name in ('nodia-ai-ai38-ui-drawer-desktop-r01.png','nodia-ai-ai38-ui-drawer-agentic-r01.png','nodia-ai-ai38-ui-drawer-mobile-r01.png','nodia-ai-ai38-ui-history-before-r01.png','nodia-ai-ai38-ui-history-after-r01.png')],
 'limits':['Read continuity of an existing conversation; no new generation, message, chat, selection write or business effect was requested.',
  'The successful ordinary authentication may persist normal session/profile state; zero total database writes is not claimed.',
  'No physical phone, touch keyboard, R2 download, attachment upload, new Google account, API key or provider login was tested.',
  'nginx original root404 requires keeping the loaded SPA for this postrollback read. Reloading the page after rollback was not accepted.',
  'All ordering uses VM observations; the Windows clock offset remains unchanged.']}
activate=read('nodia-ai-ai38-adoption-activate-r04.json'); rollback=read('nodia-ai-ai38-adoption-rollback-r04.json')
assert datetime.fromisoformat(report['started_at_utc'])>=datetime.fromisoformat(activate['finished_at_utc'])
assert datetime.fromisoformat(report['finished_at_utc'])<=datetime.fromisoformat(rollback['started_at_utc'])
assert datetime.fromisoformat(report['post_rollback_read']['started_at_utc'])>=datetime.fromisoformat(rollback['finished_at_utc'])
target=base/'nodia-ai-ai38-adoption-ui-r02.json'
with target.open('x',encoding='utf-8') as stream:stream.write(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'status':report['status'],'path':target.as_posix(),'sha256':hashlib.sha256(target.read_bytes()).hexdigest()}))
