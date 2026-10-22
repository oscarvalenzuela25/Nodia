import test_support
import asyncio
import json
import stat
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock,patch
from uuid import uuid4

from agentic_cli import CliConfig,CliRunner
from native_mcp_stdio import StdioBridge,atomic as native_atomic,gate,gate_detail,bounded_json
from native_mcp_sessions import NativeMcpSessions,McpChatRequest,McpPoll,McpResult,McpTrace,McpJob,capture_gate_diagnostic,capture_cli_log_diagnostic
from native_cli_diagnostics import _classify_admitted_log_windows
from nodia_ai_chat import ChatAdapter
from profile_admission import ProfileAdmission
from native_attempts import ReconcileAttempt,AcknowledgeAttempt
from service_errors import ServiceError
from native_execution_agents import execution_agent_definition,mcp_execution_policy_hash,prepare_execution_agent
from native_context_budget import controlled_native_context_bytes

TOOLS=[{'name':'fixture_read','description':'Synthetic read','input_schema':{'type':'object','properties':{'query':{'type':'string'}},'required':['query'],'additionalProperties':False}},
       {'name':'fixture_prepare','description':'Synthetic preview only','input_schema':{'type':'object','properties':{'query':{'type':'string'}},'required':['query'],'additionalProperties':False}}]


def atomic(path, value, **options):
    # These stdio fixtures have no native prompt. Runtime manifests always supply
    # their measured original prompt cost; never infer zero in production.
    if path.name == 'manifest.json' and isinstance(value, dict) and 'tools' in value:
        value = {**value, 'context_budget': {'schema_version': 1, 'initial_utf8_bytes': 0,
            'maximum_utf8_bytes': 262144}}
    return native_atomic(path, value, **options)


class NativeStdioTests(unittest.TestCase):
    def test_denied_tools_consume_budget_before_validation_and_thirteenth_terminates(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);(root/'requests').mkdir();(root/'responses').mkdir()
            manifest=root/'manifest.json';atomic(manifest,{'tools':TOOLS,'rpc_budget':128,'tool_budget':12,'timeout_seconds':1,'cli_json_string_arguments':True})
            bridge=StdioBridge(manifest)
            for identity in range(1,13):
                # Invalid envelope and pre-initialize calls must still count.
                rejected=bridge.handle({'jsonrpc':'invalid','id':identity,'method':'tools/call','params':{}})
                self.assertIn('error',rejected)
                self.assertEqual(bounded_json((root/'requests'/f'{identity:04}.json').read_bytes())['tool_requests'],identity)
            with self.assertRaisesRegex(ValueError,'Tool budget'):
                bridge.handle({'jsonrpc':'2.0','id':13,'method':'tools/call','params':{}})
            self.assertEqual(bridge.tool_calls,13)
            self.assertEqual(len(list((root/'responses').glob('*.json'))),0)

    def test_replay_counts_again_without_repeating_callback(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);(root/'requests').mkdir();(root/'responses').mkdir()
            manifest=root/'manifest.json';atomic(manifest,{'tools':TOOLS,'rpc_budget':128,'tool_budget':12,'timeout_seconds':1,'cli_json_string_arguments':True})
            bridge=StdioBridge(manifest)
            bridge.handle({'jsonrpc':'2.0','id':1,'method':'initialize','params':{'protocolVersion':'2025-11-25'}})
            bridge.handle({'jsonrpc':'2.0','method':'notifications/initialized'})
            def respond(path,value):
                atomic(path,value)
                if value.get('kind')=='tool_request':atomic(root/'responses'/(value['call_id']+'.json'),{'result':{'fixture':True}})
            request={'jsonrpc':'2.0','id':2,'method':'tools/call','params':{'name':'fixture_read','arguments':{'query':'x'}}}
            with patch('native_mcp_stdio.atomic',side_effect=respond):
                first=bridge.handle(request)
                replay=bridge.handle(request)
            self.assertEqual(first,replay)
            self.assertEqual(bridge.tool_calls,2)
            events=[bounded_json(path.read_bytes()) for path in sorted((root/'requests').glob('*.json'))]
            self.assertEqual([event['tool_requests'] for event in events],[0,0,1,2])
            self.assertEqual(sum(event['kind']=='tool_request' for event in events),1)

    def test_hook_diagnostics_classify_rejection_without_exporting_values(self):
        secret='synthetic-secret-value'
        base={'ServerName':'nodia_runtime','ToolName':'fixture_read','Arguments':'{}'}
        cases=[({**base,'ServerName':secret},'foreign_server'),
               ({**base,'ToolName':secret},'unregistered_tool'),
               ({**base,secret:secret},'dispatcher_extra_fields'),
               ({**base,'Arguments':[]},'arguments_type'),
               ({**base,'Arguments':'invalid '+secret},'arguments_json'),
               ({**base,'Arguments':'[]'},'arguments_shape')]
        for arguments,category in cases:
            value=gate_detail({'toolCall':{'name':'call_mcp_tool','args':arguments}},{'fixture_read'})
            self.assertEqual(value,('other',False,category,'dispatcher'))
            self.assertNotIn(secret,json.dumps(value))

    def test_terminal_diagnostics_keep_only_structure_without_native_content(self):
        trace=McpTrace()
        secret='synthetic-do-not-export-prompt-token-path'
        for value in [
            {'event':'init','init':{'model':secret,'tools':[secret]}},
            {'event':'step_update','step_update':{'step_type':'tool','tool_name':secret,'state':'ACTIVE','tool_info':{'parameters':{'secret':secret},'error':secret}}},
            {'event':'result','result':{'status':secret,'response':secret,'structured_output':{'text':secret},'denied_actions':[secret]}},
        ]:trace.feed((json.dumps(value)+'\n').encode())
        trace.feed_error(secret.encode())
        diagnostic=trace.diagnostic()
        self.assertNotIn(secret,json.dumps(diagnostic))
        self.assertEqual(diagnostic['last_tool'],'other')
        self.assertEqual(diagnostic['terminal_status'],'unrecognized')
        self.assertEqual(diagnostic['denied_count'],1)
        self.assertEqual(diagnostic['stderr_bytes'],len(secret))

    def test_result_error_and_fragmented_stderr_export_only_closed_categories_and_counts(self):
        trace=McpTrace()
        secret='synthetic-secret-account-code-path-prompt'
        result={'event':'result','result':{'status':'ERROR','error':{'code':secret,
            'message':'Unknown tool '+secret,'details':{'message':'invalid agent configuration '+secret}}}}
        trace.feed((json.dumps(result)+'\n').encode())
        for chunk in (b'Unknown too',b'l private-token HTTP status 429'):
            trace.feed_error(chunk)
        diagnostic=trace.diagnostic()
        self.assertEqual(diagnostic['terminal_status'],'ERROR')
        self.assertIn('unknown_tool',diagnostic['result_error_categories'])
        self.assertIn('invalid_agent',diagnostic['result_error_categories'])
        self.assertIn('unknown_tool',diagnostic['stderr_error_categories'])
        self.assertNotIn('quota',diagnostic['stderr_error_categories'])
        self.assertGreater(diagnostic['result_error_json_utf8_bytes'],0)
        self.assertEqual(diagnostic['error_indicator_interpretation'],'text_indicator_not_verified_cause')
        self.assertNotIn(secret,json.dumps(diagnostic))
        self.assertNotIn('private-token',json.dumps(diagnostic))
        unknown=McpTrace()
        unknown.feed((json.dumps({'event':'result','result':{'status':'ERROR','error':secret}})+'\n').encode())
        self.assertEqual(unknown.diagnostic()['result_error_categories'],['unclassified'])

    def test_diagnostic_classifier_failure_does_not_raise_or_change_terminal_status(self):
        trace=McpTrace()
        with (patch('native_mcp_sessions.result_error_diagnostic',side_effect=RuntimeError('synthetic-secret')),
              patch('native_mcp_sessions.cli_error_indicators',side_effect=RuntimeError('synthetic-secret'))):
            trace.feed(b'{"event":"result","result":{"status":"ERROR","error":"synthetic-secret"}}\n')
            trace.feed_error(b'synthetic-secret')
        self.assertEqual(trace.diagnostic()['terminal_status'],'ERROR')
        self.assertEqual(trace.diagnostic()['stderr_bytes'],16)
        self.assertNotIn('synthetic-secret',json.dumps(trace.diagnostic()))

    def test_hook_denies_native_tools_and_unknown_catalog_names(self):
        tools={'fixture_read'}
        for name in ['run_command','view_file','read_url','subagent','mcp_nodia_runtime_sql']:
            self.assertFalse(gate({'toolCall':{'name':name,'args':{}}},tools)[1])
        self.assertTrue(gate({'toolCall':{'name':'finish','args':{}}},tools)[1])
        self.assertTrue(gate({'toolCall':{'name':'call_mcp_tool','args':{'ServerName':'nodia_runtime','ToolName':'fixture_read','Arguments':'{"query":"x"}'}}},tools)[1])
        self.assertFalse(gate({'toolCall':{'name':'call_mcp_tool','args':{'ServerName':'foreign','ToolName':'fixture_read','Arguments':'{}'}}},tools)[1])

    def test_dispatcher_accepts_equivalent_bounded_json_object_and_string(self):
        arguments={'query':'synthetic','nested':{'number':0,'flag':False,'optional':None}}
        for value in (arguments,json.dumps(arguments)):
            payload={'toolCall':{'name':'call_mcp_tool','args':{'ServerName':'nodia_runtime','ToolName':'fixture_read','Arguments':value}}}
            self.assertEqual(gate_detail(payload,{'fixture_read'}),('fixture_read',True,'allowed_registered','dispatcher'))

    def test_dispatcher_object_compatibility_preserves_type_depth_size_and_identity_limits(self):
        base={'ServerName':'nodia_runtime','ToolName':'fixture_read','Arguments':{}}
        deep={}
        for _ in range(18):deep={'nested':deep}
        for value in ([],True,False,0,1.5,None):
            self.assertEqual(gate_detail({'toolCall':{'name':'call_mcp_tool','args':{**base,'Arguments':value}}},{'fixture_read'})[1:3],(False,'arguments_type'))
        for value in (deep,{'content':'x'*65536},{'number':float('nan')},{'number':float('inf')},{'not_json':object()}):
            self.assertEqual(gate_detail({'toolCall':{'name':'call_mcp_tool','args':{**base,'Arguments':value}}},{'fixture_read'})[1:3],(False,'arguments_json'))
        for change in ({'ServerName':'foreign'},{'ToolName':'unregistered'},{'extra':True}):
            self.assertFalse(gate({'toolCall':{'name':'call_mcp_tool','args':{**base,**change}}},{'fixture_read'})[1])
        self.assertFalse(gate({'toolCall':{'name':'finish','args':'{}'}},{'fixture_read'})[1])

    def test_strict_json_limits_duplicate_keys_external_numbers_and_depth(self):
        for raw in [b'{"x":1,"x":2}',b'{"x":NaN}',b'['*18+b'0'+b']'*18,b'"'+b'x'*65536+b'"']:
            with self.assertRaises(ValueError):bounded_json(raw)

    def test_rpc_and_tool_budget_reject_before_callback(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);(root/'requests').mkdir();(root/'responses').mkdir()
            manifest=root/'manifest.json';atomic(manifest,{'tools':TOOLS,'rpc_budget':3,'tool_budget':1,'timeout_seconds':1,'cli_json_string_arguments':True})
            bridge=StdioBridge(manifest)
            bridge.handle({'jsonrpc':'2.0','id':1,'method':'initialize','params':{'protocolVersion':'2025-11-25'}})
            bridge.handle({'jsonrpc':'2.0','method':'notifications/initialized'})
            bridge.handle({'jsonrpc':'2.0','id':2,'method':'tools/list'})
            with self.assertRaises(ValueError):bridge.handle({'jsonrpc':'2.0','id':3,'method':'ping'})
            self.assertEqual(bridge.tool_calls,0)


class NativeMcpCatalogEnvelopeTests(unittest.TestCase):
    """Catalog ceilings do not enlarge ordinary RPC or callback envelopes."""
    @staticmethod
    def tools(count):
        return [{'name':f'fixture_read_{i:02}', 'description':'Synthetic read', 'input_schema':{'type':'object','properties':{},'additionalProperties':False}} for i in range(count)]

    @staticmethod
    def request(tools):
        return McpChatRequest(attempt_id=str(uuid4()),model_id='fixture-discovered-model',effort_id=None,
            canonical_prompt='Synthetic catalog only',resource_key='gemini-profile:'+'a'*64,
            session_generation='b'*32,timeout_seconds=5,configuration_generation='c'*64,tools=tools)

    def test_catalog_74_count_75_rejection_and_duplicate_identity(self):
        from pydantic import ValidationError
        self.assertEqual(len(self.request(self.tools(74)).tools),74)
        for tools in [self.tools(75),self.tools(73)+[self.tools(1)[0]]]:
            with self.assertRaises(ValidationError):self.request(tools)

    def test_catalog_exact_utf8_boundary_and_ordinary_rpc_still_64_kib(self):
        from native_mcp_stdio import MAX_BYTES,MAX_CATALOG_BYTES
        from pydantic import ValidationError
        tools=self.tools(4)
        for tool in tools:tool['input_schema']['description']='x'*30000
        raw=lambda value:json.dumps(value,ensure_ascii=False,separators=(',',':')).encode()
        tools[0]['input_schema']['description']+='x'*(MAX_CATALOG_BYTES-len(raw(tools)))
        self.assertEqual(len(raw(tools)),MAX_CATALOG_BYTES)
        self.assertEqual(len(self.request(tools).tools),4)
        tools[0]['input_schema']['description']+='x'
        with self.assertRaises(ValidationError):self.request(tools)
        self.assertEqual(MAX_BYTES,65536)
        with self.assertRaises(ValueError):bounded_json(b'"'+b'x'*MAX_BYTES+b'"')

    def test_descriptor_description_uses_utf8_bytes_not_only_codepoint_count(self):
        from pydantic import ValidationError
        tools=self.tools(1);tools[0]['description']='é'*1024
        self.assertEqual(len(self.request(tools).tools),1)
        tools[0]['description']+='é'
        with self.assertRaises(ValidationError):self.request(tools)

    def test_current_report_catalog_lists_all_74_without_replacing_historical_fixture(self):
        from native_mcp_stdio import MAX_MANIFEST_BYTES
        fixture=Path(__file__).parent/'fixtures'/'nodia-ai-ai31-mcp-tools.json'
        historical=json.loads((fixture.parent/'nodia-ai-ai15-mcp-tools.json').read_text(encoding='utf-8'))
        tools=json.loads(fixture.read_text(encoding='utf-8'))
        self.assertEqual(len(historical),72)
        self.assertEqual(tools[:72],historical)
        self.assertEqual([item['name'] for item in tools[72:]],['nodia_reports_describe','nodia_reports_run'])
        self.assertEqual(len(self.request(tools).tools),74)
        self.assertIn('catalog_version',tools[-1]['input_schema']['properties'])
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);(root/'requests').mkdir();(root/'responses').mkdir()
            manifest=root/'manifest.json'
            atomic(manifest,{'tools':tools,'rpc_budget':128,'tool_budget':12,'timeout_seconds':1,'cli_json_string_arguments':True},max_bytes=MAX_MANIFEST_BYTES)
            bridge=StdioBridge(manifest)
            bridge.handle({'jsonrpc':'2.0','id':1,'method':'initialize','params':{'protocolVersion':'2025-11-25'}})
            bridge.handle({'jsonrpc':'2.0','method':'notifications/initialized'})
            listed=bridge.handle({'jsonrpc':'2.0','id':2,'method':'tools/list'})['result']['tools']
            self.assertEqual(len(listed),74)
            self.assertEqual(listed[-1]['name'],'nodia_reports_run')

    def test_manifest_budget_and_count_rejected_without_truncation(self):
        from native_mcp_stdio import MAX_MANIFEST_BYTES
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);(root/'requests').mkdir();(root/'responses').mkdir()
            manifest=root/'manifest.json'
            policy={'tools':self.tools(74),'rpc_budget':128,'tool_budget':12,'timeout_seconds':1,'cli_json_string_arguments':True}
            atomic(manifest,policy,max_bytes=MAX_MANIFEST_BYTES)
            self.assertEqual(len(StdioBridge(manifest).tools),74)
            policy['tools']=self.tools(75)
            atomic(manifest,policy,max_bytes=MAX_MANIFEST_BYTES)
            with self.assertRaisesRegex(ValueError,'Catalog tool budget'):StdioBridge(manifest)
            manifest.write_bytes(b'x'*(MAX_MANIFEST_BYTES+1))
            with self.assertRaisesRegex(ValueError,'Message budget'):StdioBridge(manifest)

    def test_stdio_process_lists_all_calls_last_replays_denies_and_accepts_cancel_notification(self):
        import subprocess
        import threading
        import time
        from native_mcp_stdio import MAX_MANIFEST_BYTES
        fixture=Path(__file__).parent/'fixtures'/'nodia-ai-ai15-mcp-tools.json'
        tools=json.loads(fixture.read_text(encoding='utf-8'))
        self.assertEqual(len(tools),72)
        self.assertEqual(len(self.request(tools).tools),72)
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);(root/'requests').mkdir();(root/'responses').mkdir()
            manifest=root/'manifest.json'
            atomic(manifest,{'tools':tools,'rpc_budget':128,'tool_budget':12,'timeout_seconds':4,'cli_json_string_arguments':True},max_bytes=MAX_MANIFEST_BYTES)
            stopped=threading.Event();callbacks=[]
            def respond():
                deadline=time.monotonic()+4
                while not stopped.is_set() and time.monotonic()<deadline:
                    for path in (root/'requests').glob('*.json'):
                        event=bounded_json(path.read_bytes())
                        if event.get('kind')=='tool_request' and event['call_id'] not in callbacks:
                            callbacks.append(event['call_id']);atomic(root/'responses'/(event['call_id']+'.json'),{'result':{'ok':True}})
                    time.sleep(.01)
            thread=threading.Thread(target=respond);thread.start()
            def rpc(identity,method,params=None):
                return {'jsonrpc':'2.0',**({'id':identity} if identity is not None else {}),'method':method,**({'params':params} if params is not None else {})}
            call=rpc(3,'tools/call',{'name':tools[-1]['name'],'arguments':{}})
            requests=[rpc(1,'initialize',{'protocolVersion':'2025-11-25'}),rpc(None,'notifications/initialized'),rpc(2,'tools/list'),call,call,rpc(4,'tools/call',{'name':'unregistered_sql','arguments':{}}),rpc(None,'notifications/cancelled',{'requestId':3})]
            process=subprocess.Popen([sys.executable,str(Path(__file__).parents[1]/'native_mcp_stdio.py'),str(manifest)],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,encoding='utf-8')
            try:
                output,error=process.communicate('\n'.join(json.dumps(r) for r in requests)+'\n',timeout=6)
            finally:
                if process.poll() is None:process.kill();process.wait()
                stopped.set();thread.join(timeout=5)
            self.assertEqual(process.returncode,0,error)
            replies=[json.loads(line) for line in output.splitlines()]
            self.assertEqual(replies[1]['result']['tools'],[
                {'name':tool['name'],'description':tool['description'],'inputSchema':tool['input_schema']}
                for tool in tools])
            self.assertEqual(replies[2],replies[3])
            self.assertTrue(replies[2]['result']['structuredContent']['ok'])
            self.assertEqual(replies[4]['error']['code'],-32602)
            self.assertEqual(len(callbacks),1)
            events=[bounded_json(path.read_bytes()) for path in sorted((root/'requests').glob('*.json'))]
            self.assertEqual(events[-1]['tool_requests'],3)
            self.assertEqual(events[-1]['rpc_messages'],7)
            allowed={tool['name'] for tool in tools}
            self.assertTrue({
                'nodia_invoices_eligible_invoice_connections','nodia_ai_providers_health',
                'nodia_ai_providers_gemini_engines','nodia_ai_providers_codex_session',
                'nodia_ai_providers_models','nodia_invoices_file',
                'nodia_products_export_csv','nodia_providers_export_csv',
            }.issubset(allowed))
            for tool in tools:
                self.assertTrue(gate({'toolCall':{'name':'call_mcp_tool','args':{'ServerName':'nodia_runtime','ToolName':tool['name'],'Arguments':'{}'}}},allowed)[1])


class NativeCliLogDiagnosticTests(unittest.TestCase):
    def test_pure_window_classifier_rejects_unadmitted_inputs_and_keeps_closed_fields(self):
        for windows in ((),(b'a',b'b',b'c'),[b'a'],(bytearray(b'a'),),(b'x'*131073,)):
            with self.subTest(kind=type(windows).__name__,length=len(windows)):
                with self.assertRaises(ValueError):
                    _classify_admitted_log_windows(windows)
        result=_classify_admitted_log_windows((b'HTTP status ',b'503'))
        self.assertEqual(set(result),{'transport_indicators','provider_error_indicators','http_statuses'})
        self.assertEqual(result['http_statuses'],[])

    def test_indicators_anywhere_in_bounded_read_survive_line_window_sampling(self):
        secret='synthetic-private-marker-do-not-export'
        harmless=(secret+' harmless line\n').encode()
        indicator=b'HTTP status 503 RESOURCE_EXHAUSTED context deadline exceeded\n'
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)/'cli.log'
            for location,content in (
                ('head',indicator+harmless*130),
                ('middle',harmless*65+indicator+harmless*65),
                ('tail',harmless*130+indicator),
            ):
                with self.subTest(location=location):
                    path.write_bytes(content)
                    value=capture_cli_log_diagnostic(path)
                    self.assertLess(value['bytes_read'],131072)
                    self.assertEqual(value['lines_scanned'],128)
                    self.assertTrue(value['truncated'])
                    self.assertEqual(value['http_statuses'],[503])
                    self.assertEqual(value['provider_error_indicators'],['RESOURCE_EXHAUSTED'])
                    self.assertEqual(value['transport_indicators'],['context_deadline'])
                    self.assertNotIn(secret,json.dumps(value))

    def test_byte_window_stays_bounded_and_does_not_claim_unread_middle(self):
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)/'cli.log'
            path.write_bytes(b'HTTP status 401 UNAUTHENTICATED\n'+b'x\n'*70000+
                             b'HTTP status 429 RESOURCE_EXHAUSTED\n'+b'x\n'*70000+
                             b'HTTP status 504 DEADLINE_EXCEEDED\n')
            value=capture_cli_log_diagnostic(path)
            self.assertLessEqual(value['bytes_read'],131072)
            self.assertEqual(value['lines_scanned'],128)
            self.assertTrue(value['truncated'])
            self.assertEqual(value['http_statuses'],[401,504])
            self.assertEqual(value['provider_error_indicators'],['DEADLINE_EXCEEDED','UNAUTHENTICATED'])
            path.write_bytes(b'x'*(65536-len(b'HTTP status '))+b'HTTP status '+b'x'*140000+b' harmless tail')
            value=capture_cli_log_diagnostic(path)
            self.assertLessEqual(value['bytes_read'],131072)
            self.assertEqual(value['http_statuses'],[])
            # Head and tail are not adjacent in the source file. Joining their
            # whitespace must not fabricate a status across the unread center.
            path.write_bytes(b'x'*(65536-len(b'\nHTTP status '))+b'\nHTTP status '+
                             b'z'*140000+b'503 '+b'x'*(65536-len(b'503 ')))
            value=capture_cli_log_diagnostic(path)
            self.assertLessEqual(value['bytes_read'],131072)
            self.assertTrue(value['truncated'])
            self.assertEqual(value['http_statuses'],[])

    def test_untrusted_middle_cannot_add_categories_statuses_or_raw_content(self):
        secret='synthetic-private-account-cookie-prompt'
        harmless=(secret+' harmless line\n').encode()
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)/'cli.log'
            for content in (harmless*131,
                            harmless*65+('HTTP status 200 status_code=418 status_code=5030 '+
                                         'FAKE_CATEGORY unrecognized_cause '+secret+'\n').encode()+harmless*65):
                path.write_bytes(content)
                value=capture_cli_log_diagnostic(path)
                self.assertEqual(value['transport_indicators'],[])
                self.assertEqual(value['provider_error_indicators'],[])
                self.assertEqual(value['http_statuses'],[])
                self.assertNotIn(secret,json.dumps(value))
                self.assertNotIn('FAKE_CATEGORY',json.dumps(value))

    def test_closed_text_indicators_never_export_raw_log_or_imply_a_cause(self):
        secret='synthetic-secret-token-prompt-url-account'
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)/'cli.log'
            path.write_bytes((secret+' https://private.invalid/'+secret+'\nHTTP status 429 RESOURCE_EXHAUSTED\ncontext deadline exceeded; i/o timeout; TLS handshake timeout\nno such host; connection refused; network is unreachable\nstatus_code=503 status_code=200 status_code=123456\n').encode())
            value=capture_cli_log_diagnostic(path)
        self.assertEqual(value['state'],'observed')
        self.assertEqual(value['interpretation'],'text_indicator_not_verified_cause')
        self.assertEqual(value['provider_error_indicators'],['RESOURCE_EXHAUSTED'])
        self.assertEqual(value['http_statuses'],[429,503])
        self.assertEqual(set(value['transport_indicators']),{'context_deadline','io_timeout','tls_timeout','dns_failure','connection_refused','network_unreachable'})
        self.assertNotIn(secret,json.dumps(value))
        self.assertNotIn('private.invalid',json.dumps(value))
        self.assertNotIn('verified',value)

    def test_log_reads_and_lines_remain_bounded_with_invalid_bytes_and_large_input(self):
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)/'cli.log'
            path.write_bytes(b'\xffinvalid synthetic-content\n'*10000+b'HTTP status 504 DEADLINE_EXCEEDED\n')
            value=capture_cli_log_diagnostic(path)
            self.assertLessEqual(value['bytes_read'],131072)
            self.assertEqual(value['lines_scanned'],128)
            self.assertTrue(value['truncated'])
            self.assertEqual(value['http_statuses'],[504])
            self.assertEqual(value['provider_error_indicators'],['DEADLINE_EXCEEDED'])
            path.write_bytes(b'\xff{bad-json synthetic-secret')
            value=capture_cli_log_diagnostic(path)
            self.assertEqual(value['state'],'observed')
            self.assertEqual(value['transport_indicators'],[])
            self.assertEqual(value['http_statuses'],[])
            path.write_bytes(b'')
            self.assertEqual(capture_cli_log_diagnostic(path)['state'],'empty')

    def test_missing_io_errors_and_symlinks_are_not_followed_or_exported(self):
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)/'cli.log'
            self.assertEqual(capture_cli_log_diagnostic(path)['state'],'missing')
            path.write_text('synthetic-secret')
            with patch('native_mcp_sessions.os.open',side_effect=OSError('synthetic-secret')):
                value=capture_cli_log_diagnostic(path)
            self.assertEqual(value['state'],'read_error')
            self.assertNotIn('synthetic-secret',json.dumps(value))
            with patch.object(Path,'lstat',return_value=SimpleNamespace(st_mode=stat.S_IFLNK,st_file_attributes=0)),patch('native_mcp_sessions.os.open') as opened:
                self.assertEqual(capture_cli_log_diagnostic(path)['state'],'unsafe_file')
                opened.assert_not_called()


class NativeHookDiagnosticTests(unittest.TestCase):
    def test_receipt_classes_counts_and_category_privacy(self):
        secret='synthetic-secret-prompt-path-token'
        cases=[(None,'missing'),(b'x'*65537,'oversize'),(b'{' + secret.encode(),'invalid_json'),
               (json.dumps({'tool':'fixture_read','allowed':True,'args':secret}).encode(),'invalid_shape'),
               (json.dumps({'tool':secret,'allowed':False}).encode(),'denied_tool'),
               (json.dumps({'tool':secret,'allowed':True}).encode(),'unregistered'),
               (json.dumps({'tool':'fixture_read','allowed':True}).encode(),'verified')]
        for raw,expected in cases:
            with self.subTest(expected=expected),tempfile.TemporaryDirectory() as directory:
                root=Path(directory)
                if raw is not None:(root/'gate.jsonl').write_bytes(raw)
                (root/'gate-diagnostic.jsonl').write_text(json.dumps({'category':'finish_arguments','call_kind':'finish'}))
                diagnostic=capture_gate_diagnostic(root,{'fixture_read','finish'})
                self.assertEqual(diagnostic['receipt_class'],expected)
                self.assertEqual(diagnostic['categories'],{'finish_arguments':1})
                self.assertNotIn(secret,json.dumps(diagnostic))
                self.assertEqual(diagnostic['rejected_count'],1 if expected=='denied_tool' else 0 if expected in ('verified','unregistered') else None)

    def test_untrusted_categories_and_receipts_are_bounded_and_closed(self):
        secret='synthetic-secret-not-a-category'
        malformed=[b'{',b'\xff',json.dumps({'category':secret,'call_kind':'finish'}).encode(),
                   json.dumps({'category':'allowed_finish','call_kind':secret}).encode(),
                   json.dumps({'category':'allowed_finish','call_kind':'finish','payload':secret}).encode(),
                   b'{}\n'*129,b'x'*65537]
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory)
            for raw in malformed:
                (root/'gate-diagnostic.jsonl').write_bytes(raw)
                diagnostic=capture_gate_diagnostic(root,{'finish'})
                self.assertIn(diagnostic['categories_state'],('invalid_json','invalid_shape','oversize'))
                self.assertEqual(diagnostic['categories'],{})
                self.assertNotIn(secret,json.dumps(diagnostic))
            for raw in (b'{}\n'*129,b'[]',b'{"tool":"finish","allowed":true,"allowed":false}',b'{"tool":"finish","allowed":1}'):
                (root/'gate.jsonl').write_bytes(raw)
                diagnostic=capture_gate_diagnostic(root,{'finish'})
                self.assertIn(diagnostic['receipt_class'],('oversize','invalid_json','invalid_shape'))
            with patch.object(Path,'open',side_effect=OSError(secret)):
                diagnostic=capture_gate_diagnostic(root,{'finish'})
            self.assertEqual(diagnostic['receipt_class'],'missing')
            self.assertNotIn(secret,json.dumps(diagnostic))


class NativeMcpSessionTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.root=Path(self.enterContext(tempfile.TemporaryDirectory()))
        self.profile=self.root/'cli';self.profile.mkdir()
        self.profiles=ProfileAdmission(self.root/'web',self.profile,self.root/'state')
        self.runner=SimpleNamespace(config=CliConfig(Path(sys.executable),'',self.profile),_processes=set(),run=AsyncMock())
        self.service=SimpleNamespace(runner=self.runner,is_available=lambda:True,session_generation='a'*32,get_status=AsyncMock(return_value={'has_active_session':True,'models':[{'id':'fixture-model'}]}))
        self.adapter=ChatAdapter(None,self.service,self.profiles)
        self.sessions=NativeMcpSessions(self.adapter);self.adapter.mcp_sessions=self.sessions
        self.request=McpChatRequest(attempt_id=str(uuid4()),model_id='fixture-model',effort_id=None,canonical_prompt='Synthetic fixture only',resource_key=self.profiles.identity('agentic'),session_generation='a'*32,timeout_seconds=5,configuration_generation='b'*64,tools=TOOLS,diagnostic=True)
        self.reference=ReconcileAttempt(resource_key=self.request.resource_key,session_generation='a'*32,operation_ref=self.request.attempt_id)

    async def asyncTearDown(self):await self.sessions.close()

    async def test_missing_foreign_or_duplicate_native_agent_is_never_a_known_success(self):
        for variant in ('missing','foreign','duplicate'):
            with self.subTest(variant=variant):
                self.synthetic_terminal({'tool':'finish','allowed':True},{'category':'allowed_finish','call_kind':'finish'})
                valid=self.runner.run.side_effect
                async def run(args,**kwargs):
                    raw,code=await valid(args,**kwargs)
                    events=[json.loads(line) for line in raw.splitlines()]
                    if variant=='missing':events[0]['init'].pop('agent')
                    elif variant=='foreign':events[0]['init']['agent']='synthetic-foreign-agent'
                    else:events.insert(0,events[0])
                    return '\n'.join(json.dumps(event) for event in events),code
                self.runner.run.side_effect=run
                job=McpJob(self.request,None,None)
                with self.assertRaisesRegex(ValueError,'MCP native agent mismatch'):
                    await self.sessions.generate(job)
                self.assertFalse(job.gate_verified)
                self.assertEqual(list(self.profile.glob('nodia-mcp-*')),[])

    async def test_role_modified_before_dispatch_is_rejected_without_starting_CLI(self):
        def modified(workspace,kind,attached):
            path=prepare_execution_agent(workspace,kind,attached)
            path.write_text('synthetic unauthorized role',encoding='utf-8')
            return path
        with patch('native_mcp_sessions.prepare_execution_agent',side_effect=modified):
            with self.assertRaises(ServiceError) as caught:
                await self.sessions.generate(McpJob(self.request,None,None))
        self.assertEqual(caught.exception.code,'native_cli_agent_invalid')
        self.runner.run.assert_not_awaited()
        self.assertEqual(list(self.profile.glob('nodia-mcp-*')),[])

    async def test_role_modified_during_CLI_cannot_certify_a_terminal_success(self):
        self.synthetic_terminal({'tool':'finish','allowed':True},{'category':'allowed_finish','call_kind':'finish'})
        valid=self.runner.run.side_effect
        async def run(args,**kwargs):
            raw,code=await valid(args,**kwargs)
            name=execution_agent_definition('mcp',False)[0]
            (kwargs['cwd']/'.agents'/'agents'/name/'agent.md').write_text('synthetic role changed during CLI',encoding='utf-8')
            return raw,code
        self.runner.run.side_effect=run
        job=McpJob(self.request,None,None)
        with self.assertRaises(ServiceError) as caught:
            await self.sessions.generate(job)
        self.assertEqual(caught.exception.code,'native_cli_agent_invalid')
        self.assertFalse(job.gate_verified)
        self.assertEqual(list(self.profile.glob('nodia-mcp-*')),[])

    def test_old_MCP_proof_key_cannot_grant_the_owned_execution_policy(self):
        values=(self.request.resource_key,self.request.session_generation,self.request.model_id,
                self.request.effort_id,self.request.configuration_generation)
        from nodia_ai_chat import CONTRACT_VERSION
        legacy=(*values[:3],values[3] or '',values[4],CONTRACT_VERSION)
        self.sessions.verified.add(legacy)
        self.assertFalse(self.sessions.supports(*values))
        self.sessions.verified.add(self.sessions.key(*values))
        self.assertTrue(self.sessions.supports(*values))
        with patch('native_mcp_sessions.mcp_execution_policy_hash',return_value='c'*64):
            self.assertFalse(self.sessions.supports(*values))

    def test_completed_job_of_a_different_execution_policy_cannot_attest_the_new_one(self):
        runner=CliRunner(CliConfig(Path(sys.executable),'',self.profile))
        runner._verified_stat=(0,0)
        self.service.runner=runner
        proof=self.adapter.ledger.arm(self.request.attempt_id,'agentic',self.reference)
        job=McpJob(self.request,None,proof)
        job.state='completed';job.callbacks=1;job.gate_verified=True
        self.sessions.jobs[self.request.attempt_id]=job
        with patch('native_mcp_sessions.mcp_execution_policy_hash',return_value='c'*64):
            with self.assertRaises(ServiceError) as caught:
                self.sessions.attest(self.request.attempt_id,self.reference)
        self.assertEqual(caught.exception.code,'mcp_probe_unverified')
        self.assertEqual(self.sessions.verified,set())
        self.assertEqual(job.execution_policy_hash,mcp_execution_policy_hash())

    def synthetic_terminal(self,receipt,category_receipt):
        async def run(args,**kwargs):
            bridge=kwargs['cwd'].parent/'bridge'
            (bridge/'gate.jsonl').write_text(json.dumps(receipt))
            (bridge/'gate-diagnostic.jsonl').write_text(json.dumps(category_receipt))
            events=[{'event':'init','init':{'model':self.request.model_id,'agent':execution_agent_definition('mcp',False)[0]}}]
            events.append({'event':'result','result':{'status':'SUCCESS','structured_output':{'kind':'answer','text':'Synthetic answer'}}})
            return '\n'.join(json.dumps(event) for event in events),0
        self.runner.run.side_effect=run

    async def test_context_budget_failure_cannot_be_hidden_by_cli_success_when_watcher_loses_the_race(self):
        from native_mcp_stdio import mark_context_failure
        async def run(args, **kwargs):
            bridge = kwargs['cwd'].parent/'bridge'
            (bridge/'gate.jsonl').write_text(json.dumps({'tool':'finish','allowed':True}))
            mark_context_failure(bridge, 'context_budget_exceeded')
            return json.dumps({'event':'result','result':{'status':'SUCCESS',
                'structured_output':{'kind':'answer','text':'Do not accept synthetic false success'}}}), 0
        self.runner.run.side_effect = run
        async def dormant_watch(_job):
            await asyncio.Future()
        with patch.object(self.sessions, 'watch', side_effect=dormant_watch):
            await self.sessions.start(self.request)
            await self.sessions.jobs[self.request.attempt_id].task
        job = self.sessions.jobs[self.request.attempt_id]
        self.assertEqual(job.state, 'unknown')
        self.assertEqual(job.phase, 'context_budget_failed')
        self.assertEqual(self.runner.run.await_count, 1)
        proof = self.adapter.reconcile('agentic', self.request.attempt_id, self.reference)
        self.assertTrue(proof['process_closed'])
        self.assertEqual(proof['outcome'], 'abandoned_unknown')
        self.adapter.acknowledge('agentic', self.request.attempt_id,
            AcknowledgeAttempt(**self.reference.model_dump(), terminal_proof_id=proof['terminal_proof_id']))
        with self.assertRaises(ServiceError): await self.sessions.start(self.request)
        self.assertEqual(self.runner.run.await_count, 1)

    async def test_denied_hook_keeps_cli_success_unknown_with_safe_terminal_diagnostic(self):
        secret='synthetic-secret-denied-tool'
        self.synthetic_terminal({'tool':secret,'allowed':False},{'category':'unregistered_native','call_kind':'other'})
        with self.assertLogs('native_mcp_sessions',level='INFO') as logs:
            await self.sessions.start(self.request)
            await self.sessions.jobs[self.request.attempt_id].task
        job=self.sessions.jobs[self.request.attempt_id]
        self.assertEqual(job.state,'unknown')
        self.assertFalse(job.gate_verified)
        self.assertEqual(job.hook_diagnostic['receipt_class'],'denied_tool')
        self.assertEqual(job.hook_diagnostic['decision_count'],1)
        self.assertEqual(job.hook_diagnostic['rejected_count'],1)
        self.assertEqual(job.hook_diagnostic['categories'],{'unregistered_native':1})
        self.assertEqual(job.exit_code,0)
        self.assertEqual(list(self.profile.glob('nodia-mcp-*')),[])
        self.assertNotIn(secret,'\n'.join(logs.output))
        emitted=json.loads(logs.output[-1].split('nodia_ai_mcp_terminal ',1)[1])
        self.assertEqual(emitted['hook'],job.hook_diagnostic)
        with self.assertRaises(ServiceError):self.sessions.attest(self.request.attempt_id,self.reference)

    async def test_malformed_supplemental_categories_do_not_reject_valid_proof(self):
        self.synthetic_terminal({'tool':'finish','allowed':True},{'category':'synthetic-secret','call_kind':'finish'})
        job=McpJob(self.request,None,None)
        answer=await self.sessions.generate(job)
        self.assertEqual(answer.text,'Synthetic answer')
        self.assertTrue(job.gate_verified)
        self.assertEqual(job.hook_diagnostic['receipt_class'],'verified')
        self.assertEqual(job.hook_diagnostic['categories_state'],'invalid_shape')
        self.assertEqual(job.hook_diagnostic['categories'],{})
        self.assertEqual(list(self.profile.glob('nodia-mcp-*')),[])

    async def test_diagnostic_failure_does_not_change_valid_or_denied_authorization(self):
        for allowed in (True,False):
            self.synthetic_terminal({'tool':'finish','allowed':allowed},{'category':'allowed_finish','call_kind':'finish'})
            job=McpJob(self.request,None,None)
            with patch('native_mcp_sessions.capture_gate_diagnostic',side_effect=RuntimeError('synthetic-secret')):
                if allowed:self.assertEqual((await self.sessions.generate(job)).text,'Synthetic answer')
                else:
                    with self.assertRaisesRegex(ValueError,'Tool gate failed'):await self.sessions.generate(job)
            self.assertEqual(job.gate_verified,allowed)
            self.assertIsNone(job.hook_diagnostic)
            self.assertEqual(list(self.profile.glob('nodia-mcp-*')),[])

    async def test_cli_log_diagnostic_failure_preserves_valid_and_denied_hook_outcomes(self):
        for allowed in (True,False):
            self.synthetic_terminal({'tool':'finish','allowed':allowed},{'category':'allowed_finish','call_kind':'finish'})
            job=McpJob(self.request,None,None)
            with patch('native_mcp_sessions.capture_cli_log_diagnostic',side_effect=ValueError('synthetic-secret')):
                if allowed:self.assertEqual((await self.sessions.generate(job)).text,'Synthetic answer')
                else:
                    with self.assertRaisesRegex(ValueError,'Tool gate failed'):await self.sessions.generate(job)
            self.assertEqual(job.gate_verified,allowed)
            self.assertIsNone(job.cli_log_diagnostic)
            self.assertEqual(list(self.profile.glob('nodia-mcp-*')),[])

    async def test_cancel_captures_safe_log_before_removing_owned_workspace_without_replay(self):
        entered=asyncio.Event()
        async def pending(args,**kwargs):
            (kwargs['cwd'].parent/'cli.log').write_text('synthetic-secret HTTP status 503 context deadline exceeded')
            kwargs['stdout_observer'](b'{"event":"init","init":{}}\n{"event":"step_update","step_update":{"step_type":"user_input"}}\n')
            entered.set()
            await asyncio.Event().wait()
        self.runner.run.side_effect=pending
        with self.assertLogs('native_mcp_sessions',level='WARNING') as logs:
            await self.sessions.start(self.request)
            await entered.wait()
            result=await self.sessions.cancel(self.request.attempt_id,self.reference)
        job=self.sessions.jobs[self.request.attempt_id]
        self.assertEqual(result['state'],'unknown')
        self.assertEqual(job.trace.diagnostic()['stage'],'prompt_received')
        self.assertEqual(job.cli_log_diagnostic['http_statuses'],[503])
        self.assertEqual(job.cli_log_diagnostic['interpretation'],'text_indicator_not_verified_cause')
        self.assertFalse(job.gate_verified)
        self.assertEqual(self.runner.run.await_count,1)
        self.assertEqual(list(self.profile.glob('nodia-mcp-*')),[])
        self.assertNotIn('synthetic-secret','\n'.join(logs.output))
        diagnostic=json.loads(logs.output[-1].split('nodia_ai_mcp_terminal ',1)[1])
        self.assertEqual(diagnostic['cli_log'],job.cli_log_diagnostic)
        proof=self.adapter.reconcile('agentic',self.request.attempt_id,self.reference)
        self.adapter.acknowledge('agentic',self.request.attempt_id,AcknowledgeAttempt(**self.reference.model_dump(),terminal_proof_id=proof['terminal_proof_id']))
        self.assertNotIn(self.request.attempt_id,self.sessions.jobs)

    async def test_supervisor_reports_unforwarded_requests_and_validates_monotonic_progress(self):
        directory=self.root/'bridge';(directory/'requests').mkdir(parents=True)
        job=McpJob(self.request,None,None,directory=directory)
        self.sessions.jobs[self.request.attempt_id]=job
        for sequence,requests,kind in [(1,1,'rpc'),(2,2,'tool_request'),(3,3,'rpc')]:
            event={'kind':kind,'rpc_messages':sequence,'tool_requests':requests}
            if kind=='tool_request':event.update(call_id=str(uuid4()),name='fixture_read',arguments={'query':'x'})
            atomic(directory/'requests'/f'{sequence:04}.json',event)
        await self.sessions.read_requests(job)
        self.assertEqual(job.tool_requests,3)
        self.assertEqual(job.callbacks,1)
        self.assertEqual(job.tool_requests-job.callbacks,2)
        atomic(directory/'requests'/'0004.json',{'kind':'rpc','rpc_messages':4,'tool_requests':2})
        with self.assertRaisesRegex(ValueError,'Tool request order'):await self.sessions.read_requests(job)

    async def test_supervisor_stops_at_thirteenth_request_without_forwarding(self):
        directory=self.root/'bridge';(directory/'requests').mkdir(parents=True)
        job=McpJob(self.request,None,None,directory=directory)
        for sequence in range(1,14):atomic(directory/'requests'/f'{sequence:04}.json',{'kind':'rpc','rpc_messages':sequence,'tool_requests':sequence})
        with self.assertRaisesRegex(ValueError,'Tool budget'):await self.sessions.read_requests(job)
        self.assertEqual(job.tool_requests,13)
        self.assertEqual(job.callbacks,0)
        self.assertEqual(job.events,[])

    async def test_unverified_product_mcp_cannot_dispatch_or_fake_attestation(self):
        with self.assertRaises(ServiceError) as caught:await self.sessions.start(self.request.model_copy(update={'diagnostic':False}))
        self.assertEqual(caught.exception.code,'mcp_adapter_unverified')
        self.runner.run.assert_not_awaited()

    async def test_real_stdio_two_callback_loop_is_bounded_and_fixture_only(self):
        foreign=self.profile/'.gemini'/'config'/'mcp_config.json'
        foreign.parent.mkdir(parents=True)
        foreign.write_text(json.dumps({'mcpServers':{'synthetic_foreign_server':{'command':'never-execute-fixture'}}}),encoding='utf-8')
        async def run(args,**kwargs):
            prompt=json.loads(kwargs['stdin'])['message']['content']
            agent_name,agent_document=execution_agent_definition('mcp',False)
            self.assertEqual(args[args.index('--agent')+1],agent_name)
            self.assertEqual((kwargs['cwd']/'.agents'/'agents'/agent_name/'agent.md').read_text(encoding='utf-8'),agent_document)
            self.assertIn('inheritMcp: true\n',agent_document)
            self.assertNotIn('  - call_mcp_tool\n',agent_document)
            self.assertNotEqual(kwargs['home'],self.profile)
            manifest=json.loads((kwargs['cwd'].parent/'bridge'/'manifest.json').read_text(encoding='utf-8'))
            self.assertEqual(manifest['context_budget']['initial_utf8_bytes'],controlled_native_context_bytes('agentic',prompt,False,True))
            self.assertIn('CATALOGO_AUTORIZADO',prompt)
            self.assertIn('Arguments como string JSON',prompt)
            self.assertIn('fixture_read',prompt)
            config=json.loads((kwargs['home']/'.gemini/config/mcp_config.json').read_text())
            self.assertEqual(set(config),{'mcpServers'})
            self.assertEqual(set(config['mcpServers']),{'nodia_runtime'})
            self.assertNotIn('synthetic_foreign_server',prompt)
            command=config['mcpServers']['nodia_runtime']
            process=await asyncio.create_subprocess_exec(command['command'],*command['args'],stdin=asyncio.subprocess.PIPE,stdout=asyncio.subprocess.PIPE,stderr=asyncio.subprocess.PIPE)
            self.runner._processes.add(process)
            async def send(value,reply=True):
                process.stdin.write((json.dumps(value)+'\n').encode());await process.stdin.drain()
                return json.loads(await asyncio.wait_for(process.stdout.readline(),3)) if reply else None
            try:
                await send({'jsonrpc':'2.0','id':1,'method':'initialize','params':{'protocolVersion':'2025-11-25'}})
                await send({'jsonrpc':'2.0','method':'notifications/initialized'},False)
                catalog=await send({'jsonrpc':'2.0','id':2,'method':'tools/list'})
                self.assertEqual(len(catalog['result']['tools']),2)
                read=await send({'jsonrpc':'2.0','id':3,'method':'tools/call','params':{'name':'fixture_read','arguments':'{"query":"read"}'}})
                prepare=await send({'jsonrpc':'2.0','id':4,'method':'tools/call','params':{'name':'fixture_prepare','arguments':{'query':'prepare'}}})
                (kwargs['cwd'].parent/'bridge'/'gate.jsonl').write_text('\n'.join(json.dumps({'tool':name,'allowed':True}) for name in ('fixture_read','fixture_prepare','finish')))
                text=read['result']['structuredContent']['marker']+' '+prepare['result']['structuredContent']['state']
                return '\n'.join(json.dumps(item) for item in [{'event':'init','init':{'model':'fixture-model','agent':agent_name}},{'event':'result','result':{'status':'SUCCESS','structured_output':{'kind':'answer','text':text}}}]),0
            finally:
                process.stdin.close();await process.wait();self.runner._processes.discard(process)
        self.runner.run.side_effect=run
        await self.sessions.start(self.request)
        cursor=0;callbacks=0;last=None
        async with asyncio.timeout(8):
            while True:
                value=self.sessions.poll(self.request.attempt_id,McpPoll(**self.reference.model_dump(),after=cursor))
                for event in value['events']:
                    cursor=event['seq']
                    if event['kind']=='tool_request':
                        callbacks+=1
                        result={'marker':'SYNTHETIC_NONCE'} if event['name']=='fixture_read' else {'state':'awaiting_human_confirmation','executed':False}
                        answer=McpResult(**self.reference.model_dump(),call_id=event['call_id'],result=result)
                        self.assertTrue(self.sessions.submit(self.request.attempt_id,answer)['accepted'])
                        self.assertTrue(self.sessions.submit(self.request.attempt_id,answer)['accepted'])
                    else:last=event
                if value['state']!='running':break
                await asyncio.sleep(.02)
        self.assertEqual(callbacks,2);self.assertEqual(value['rpc_messages'],5)
        self.assertEqual(value['unforwarded_tool_requests'],0)
        self.assertEqual({key:value for key,value in last.items() if key!='terminal_proof'},{'seq':3,'kind':'answer','text':'SYNTHETIC_NONCE awaiting_human_confirmation'})
        self.assertEqual(last['terminal_proof']['outcome'],'completed')
        self.assertEqual(self.runner.run.await_count,1)
        self.assertEqual(self.runner._processes,set())
        self.assertEqual(list(self.profile.glob('nodia-mcp-*')),[])
        with self.assertRaises(ServiceError):self.sessions.attest(self.request.attempt_id,self.reference)
        proof=self.adapter.reconcile('agentic',self.request.attempt_id,self.reference)
        self.adapter.acknowledge('agentic',self.request.attempt_id,AcknowledgeAttempt(**self.reference.model_dump(),terminal_proof_id=proof['terminal_proof_id']))
        self.assertNotIn(self.request.attempt_id,self.sessions.jobs)

    async def test_cancel_before_start_or_during_cli_preserves_unknown_proof_no_replay(self):
        entered=asyncio.Event()
        async def pending(*args,**kwargs):entered.set();await asyncio.Event().wait()
        self.runner.run.side_effect=pending
        await self.sessions.start(self.request)
        await entered.wait()
        value=await self.sessions.cancel(self.request.attempt_id,self.reference)
        self.assertEqual(value['state'],'unknown')
        proof=self.adapter.reconcile('agentic',self.request.attempt_id,self.reference)
        self.assertEqual(proof['outcome'],'abandoned_unknown')
        self.runner.run.assert_awaited_once()
        with self.assertRaises(ServiceError):await self.sessions.start(self.request)
