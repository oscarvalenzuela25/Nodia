"""Offline projection regression: no arbitrary provider/log fields escape."""
import importlib.util
import json
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

spec=importlib.util.spec_from_file_location('probe_diagnostic_test',Path('docs/evidence/scripts/nodia-ai-ai32-r01-native-probe.py'))
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
value={'engine':'agentic','attempt_id':'fixture-attempt','phase':'generation','error_type':'ServiceError',
       'provider_response':'PRIVATE_SENTINEL','reply_format':{'text_bytes':51,'leading_category':'object',
       'json_syntax':{'position':1,'category':'property_name','document_sha256':'a'*64,'doc':'PRIVATE_SENTINEL'}},
       'agentic_generation':{'phase':'document_read_failed','document_read_completed':False,'result_status':'ERROR',
       'raw_arguments':'PRIVATE_SENTINEL','tool_error_categories':['hook','PRIVATE_SENTINEL'],
       'tool_event_counts':{'view_file':2,'PRIVATE_SENTINEL':2,'finish':True},
       'tool_completed_counts':{'view_file':1},'tool_error_counts':{'view_file':1}}}
fake=SimpleNamespace(returncode=0,stdout='nodia_ai_chat_failure '+json.dumps(value),stderr='')
with patch.object(module.subprocess,'run',lambda *a,**k:fake):
    result=module.diagnostics('fixture-attempt')
    wrong=module.diagnostics('other-attempt')
assert len(result)==1 and wrong==[]
assert 'PRIVATE_SENTINEL' not in json.dumps(result)
assert result[0]['agentic_generation']['tool_event_counts']=={'view_file':2}
assert result[0]['reply_format']['json_syntax']=={'category':'property_name','position':1,'document_sha256':'a'*64}
print(json.dumps({'scope':'offline_synthetic_diagnostics_projection','assertions':5,'provider_calls':0,'status':'passed'}))
