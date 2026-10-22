"""Offline failure-path check: one generation and terminal recovery after timeout."""
import importlib.util
import io
import json
import sys
import tempfile
from pathlib import Path
from unittest.mock import patch

script=Path('docs/evidence/scripts/nodia-ai-ai32-r01-native-probe.py')
spec=importlib.util.spec_from_file_location('probe_under_test',script)
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)

class Reply(io.BytesIO):
    status=200

for scenario in ['success','transport_timeout','closed_unknown','explicit_audio_oracle','semantic_mismatch_with_cached_proof','delegation_answer']:
    with tempfile.TemporaryDirectory(prefix='nodia-ai32-r01-harness-') as directory:
        root=Path(directory);helper=root/'helper.py';output=root/'result.json';speech=root/'speech.wav';speech.write_bytes(b'RIFFsynthetic')
        helper.write_text("def configuration():\n return {'quiet':{'pending_jobs':0,'open_attempts':0,'held_or_unknown_slots':0},'selections':{'web':{'model_id':'configured-model','effort_id':None,'configuration_generation':'a'*64}},'url':'http://synthetic.invalid','token':'synthetic-test-token'}\ndef fixtures(path):\n return {'image':(b'synthetic','image/png','CANARY'),'audio':(b'RIFFsynthetic','audio/wav','legacy oracle')}\n",encoding='utf-8')
        requests=[]
        def open_url(request,timeout):
            path=request.full_url;requests.append(path)
            if path.endswith('/observe'):value={'available':True,'resource_key':'gemini-profile:'+'b'*64,'session_generation':'c'*32,'verified_modalities':['image','audio']}
            elif path.endswith('/attachments/probe'):
                if scenario=='transport_timeout':raise TimeoutError()
                if scenario=='closed_unknown':
                    value={'code':'chat_result_unknown'}
                    import urllib.error
                    raise urllib.error.HTTPError(path,502,'fixture',{},io.BytesIO(json.dumps(value).encode()))
                if scenario=='explicit_audio_oracle':
                    payload=json.loads(request.data)
                    assert 'The purple lantern is glowing.' not in payload['canonical_prompt']
                    assert payload['expected_answer_sha256']=='a26c5e0dce40a892145850e954339118ffc1e0a8963c63cc27632916e9fbe215'
                answer='The purple lantern is glowing.' if scenario=='explicit_audio_oracle' else 'wrong canary' if scenario=='semantic_mismatch_with_cached_proof' else 'CANARY'
                value={'reply':{'kind':'answer','text':answer},'terminal_proof':{'terminal_proof_id':'fixture-proof','outcome':'completed'}}
                if scenario=='delegation_answer':value['reply']={'kind':'delegation_request','reason':'synthetic PRIVATE_SENTINEL audio archivo agentic'}
            elif path.endswith('/reconcile'):value={'terminal_proof_id':'fixture-proof','outcome':'abandoned_unknown'}
            elif path.endswith('/acknowledge'):value={'acknowledged':True}
            else:raise AssertionError('unexpected path')
            return Reply(json.dumps(value).encode())
        argv=[str(script),'--live','--historical-helper',str(helper),'--engine','web','--kind','image','--synthetic-speech',str(speech),'--output',str(output)]
        if scenario=='explicit_audio_oracle':
            argv[argv.index('--kind')+1]='audio'
            argv+=['--synthetic-speech-text','The purple lantern is glowing.']
        with patch.object(sys,'argv',argv),patch.object(module.urllib.request,'urlopen',open_url),patch.object(module,'diagnostics',lambda _:[]):
            module.main()
        result=json.loads(output.read_text(encoding='utf-8'))
        assert sum(path.endswith('/attachments/probe') for path in requests)==1
        assert sum(path.endswith('/acknowledge') for path in requests)==1
        assert result['probe']['native_acknowledged'] is True
        assert result['status']==('passed' if scenario in ['success','explicit_audio_oracle'] else 'gates_open')
        assert result['probe']['cached_modality_verified'] is True
        assert result['probe']['verified']==(scenario in ['success','explicit_audio_oracle'])
        if scenario=='delegation_answer':
            assert result['reply_kind']=='delegation_request'
            assert result['delegation_reason']['keyword_present']['audio'] is True
            assert result['delegation_reason']['keyword_present']['mcp'] is False
            assert 'PRIVATE_SENTINEL' not in output.read_text(encoding='utf-8')
        if scenario in ['transport_timeout','closed_unknown']:assert sum(path.endswith('/reconcile') for path in requests)==1
        assert 'synthetic-test-token' not in output.read_text(encoding='utf-8')
print(json.dumps({'scope':'offline_synthetic_harness_failure_paths','scenarios':6,'provider_calls':0,'status':'passed'}))
