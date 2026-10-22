import json,time
from pathlib import Path
from session_store import SESSION_FILE
from login_request_store import LoginRequestStore
store=LoginRequestStore(SESSION_FILE.parent/'login_requests')
rows=[]
with store.locked():
 for path in store.directory.glob('*.json'):
  record=store.read(path.stem)
  rows.append({'engine':record['engine'],'state':record['state'],'candidate_state':record.get('candidate_state'),'closure_proof':record['closure_proof'],'acknowledged':record.get('acknowledged'),'remaining_seconds':round(record['expires_at']-time.time()),'updated_epoch':path.stat().st_mtime})
print(json.dumps(sorted(rows,key=lambda row:row['updated_epoch'])[-12:]))
