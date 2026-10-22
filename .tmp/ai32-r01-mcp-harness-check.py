"""Offline MCP harness safety checks; no SDK, network, DB or actual provider."""
import importlib.util
import io
import json
import sys
import tempfile
from pathlib import Path
from unittest.mock import patch

script=Path('docs/evidence/scripts/nodia-ai-ai32-r01-mcp-file-probe.py')
spec=importlib.util.spec_from_file_location('mcp_probe_under_test',script)
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)

class Reply(io.BytesIO):
    status=200

for scenario in ['success','poll_timeout','start_timeout','native_unverified']:
    with tempfile.TemporaryDirectory(prefix='nodia-ai32-r01-mcp-harness-') as directory:
        root=Path(directory);helper=root/'helper.py';output=root/'result.json';speech=root/'speech.wav';speech.write_bytes(b'RIFFsynthetic')
        helper.write_text("def configuration():\n return {'quiet':{'pending_jobs':0,'open_attempts':0,'held_or_unknown_slots':0},'selections':{'agentic':{'model_id':'configured-model','effort_id':None,'configuration_generation':'a'*64}},'url':'http://synthetic.invalid','token':'synthetic-test-token'}\ndef fixtures(path):\n return {'image':(b'synthetic','image/png','CANARY')}\n",encoding='utf-8')
        requests=[];values={'polls':0}
        def open_url(request,timeout):
            path=request.full_url;requests.append(path)
            if path.endswith('/observe'):value={'available':True,'resource_key':'gemini-profile:'+'b'*64,'session_generation':'c'*32,'verified_modalities':[] if scenario=='native_unverified' else ['image'],'supports_mcp':True}
            elif path.endswith('/mcp/start'):
                if scenario=='start_timeout':raise TimeoutError()
                value={'state':'running'}
            elif path.endswith('/mcp/events'):
                if scenario=='poll_timeout':raise TimeoutError()
                values['polls']+=1
                if values['polls']==1:value={'events':[{'seq':1,'kind':'tool_request','call_id':'fixture-call','name':'nodia_ai_canary_read','arguments':{}}]}
                else:value={'events':[{'seq':2,'kind':'answer','text':'CANARY\n'+values['nonce'],'terminal_proof':{'terminal_proof_id':'fixture-proof','outcome':'completed'}}]}
            elif path.endswith('/mcp/results'):
                values['nonce']=json.loads(request.data)['result']['nonce'];value={'accepted':True}
            elif path.endswith('/mcp/attest'):value={'verified':True}
            elif path.endswith('/mcp/cancel'):value={'state':'unknown'}
            elif path.endswith('/reconcile'):value={'terminal_proof_id':'fixture-proof','outcome':'abandoned_unknown'}
            elif path.endswith('/acknowledge'):value={'acknowledged':True}
            else:raise AssertionError('unexpected path')
            return Reply(json.dumps(value).encode())
        argv=[str(script),'--live','--historical-helper',str(helper),'--kind','image','--synthetic-speech',str(speech),'--output',str(output)]
        with patch.object(sys,'argv',argv),patch.object(module.urllib.request,'urlopen',open_url),patch.object(module.time,'sleep',lambda _:None):module.main()
        result=json.loads(output.read_text(encoding='utf-8'))
        assert sum(path.endswith('/mcp/start') for path in requests)==(0 if scenario=='native_unverified' else 1)
        assert 'synthetic-test-token' not in output.read_text(encoding='utf-8')
        if scenario=='native_unverified':
            assert result['status']=='exact_agentic_modality_unverified'
            assert result['generation_requests']==0
            continue
        assert sum(path.endswith('/acknowledge') for path in requests)==1
        assert result['native_acknowledged'] is True
        assert result['status']==('passed' if scenario=='success' else 'gates_open')
        if scenario!='success':
            assert sum(path.endswith('/mcp/cancel') for path in requests)==1
            assert sum(path.endswith('/reconcile') for path in requests)==1
print(json.dumps({'scope':'offline_synthetic_mcp_harness_failure_paths','scenarios':4,'provider_calls':0,'status':'passed'}))
