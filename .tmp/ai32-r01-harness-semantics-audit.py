"""Sidecar only: preserve historical native reports with ambiguous cached flags."""
import hashlib
import json
from pathlib import Path

rows=[]
for path in sorted(Path('.tmp').glob('ai32-r01-*.json')):
    try:
        raw=path.read_bytes();value=json.loads(raw)
    except (OSError,ValueError):continue
    item=value.get('probe')
    if not isinstance(item,dict):continue
    if item.get('verified') is True and item.get('semantic_canary_matches') is not True:
        rows.append({'path':path.as_posix(),'sha256':hashlib.sha256(raw).hexdigest(),
            'attempt_id':item.get('attempt_id'),'engine':item.get('engine'),'kind':item.get('kind'),
            'historical_verified_field':True,'semantic_canary_matches':item.get('semantic_canary_matches'),
            'report_status':value.get('status'),'current_canary_is_verified':False})
report={'stage':'AI-32-R01','scope':'historical_native_report_cached_flag_interpretation',
    'historical_reports_modified':False,'provider_calls':0,
    'note':'Earlier probe.verified recorded a cached modality proof, not success of this file canary. A mismatch remains a failed current canary even if a previous file of the same kind verified successfully. New reports split cached_modality_verified and verified; their status was already gates_open on semantic mismatch.',
    'affected_reports':rows}
target=Path('.tmp/ai32-r01-harness-semantics-note.json')
if target.exists():raise RuntimeError('sidecar_exists_preserve_prior_snapshot')
target.write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'scope':report['scope'],'affected_reports':len(rows),'historical_reports_modified':False,'provider_calls':0}))
