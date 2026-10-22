from pathlib import Path
from datetime import datetime
import hashlib
import json

base=Path('docs/evidence')
activate=json.loads((base/'nodia-ai-ai38-adoption-activate-r03.json').read_bytes())
end=json.loads((base/'nodia-ai-ai38-ui-adoption-observer-end-r01.json').read_bytes())
rollback=json.loads((base/'nodia-ai-ai38-adoption-rollback-r03.json').read_bytes())
after=Path('.tmp/ai38-ui-after-rollback-time.txt').read_text().strip()
screenshot=base/'nodia-ai-ai38-adoption-login-r01.png'
report={
 'stage':'AI-38','scope':'real_frozen_Client_login_UI_without_fixture_authentication',
 'status':'partial','started_at_utc':end['first_matched_request_utc'],
 'finished_at_utc':end['finished_at_utc'],
 'full_frozen_Client_shell':True,'fixture_session_or_token_injected':False,
 'authentication_kind':None,'business_effects':0,
 'checks':{'frozen_Client_login_render':'passed','same_origin_client_to_API':'passed',
           'Google_GIS_button_render':'passed','auth_me':'blocked','authorization_context':'blocked',
           'own_chat_history':'blocked','drawer_exact_selection':'blocked',
           'away_return':'not_exercised','deep_reload':'blocked'},
 'viewports':[{'width':1280,'height':720,'scope':'desktop_login_only','physical_device':False}],
 'provider':{'browser_message_submissions':0,'native_requests':0,'terminal_ACKs':0,
             'completed':0,'unknown':0,'attempt_id':None,'semantic_match':None,'fixture_transport':False},
 'post_rollback_read':{'status':'blocked','started_at_utc':after,'finished_at_utc':after,
                       'reason':'No authenticated Nodia session was obtained; retained loaded SPA still showed login. No history read or message submission was attempted.'},
 'observer_reports':{'begin':'docs/evidence/nodia-ai-ai38-ui-adoption-observer-begin-r01.json',
                     'end':'docs/evidence/nodia-ai-ai38-ui-adoption-observer-end-r01.json'},
 'screenshot':{'path':screenshot.as_posix(),'sha256':hashlib.sha256(screenshot.read_bytes()).hexdigest()},
 'facts':['The frozen full Client rendered its ordinary login after a deep-route reload.',
          'One auth refresh request returned HTTP401; no POST auth/login or GET auth/me was observed in the exclusive window.',
          'The official Google GIS account button rendered. Two automation clicks, including one with the browser visible, did not produce a visible completion or a Nodia login request.',
          'No popup tab or browser console error/warning was observed; this does not establish why GIS did not complete.',
          'Human sign-in was requested asynchronously. It was not completed during the candidate acceptance window.',
          'No auth storage, token, cookie or fixture session was read, injected or transferred.',
          'The original Server and descriptors were restored independently of the blocked authenticated UI checks.'],
 'limits':['This report does not accept an authenticated chat, drawer, mobile chat layout, business write, provider generation or cross-version history read.',
           'The Google account button is not evidence of a Nodia session or successful Google exchange.',
           'VM observer timestamps bound the window; the known Windows clock offset was not corrected or used to relax validation.']}
assert datetime.fromisoformat(report['started_at_utc']) >= datetime.fromisoformat(activate['finished_at_utc'])
assert datetime.fromisoformat(report['finished_at_utc']) <= datetime.fromisoformat(rollback['started_at_utc'])
assert datetime.fromisoformat(after) >= datetime.fromisoformat(rollback['finished_at_utc'])
target=base/'nodia-ai-ai38-adoption-ui-r01.json'
with target.open('x',encoding='utf-8') as stream: stream.write(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'path':target.as_posix(),'status':report['status'],'sha256':hashlib.sha256(target.read_bytes()).hexdigest()}))
