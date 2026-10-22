"""Offline real nine-tool materialization/stdio; synthetic CLI and business replies only."""
import asyncio
import hashlib
import json
from pathlib import Path
import sys
import tempfile
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

ROOT = Path(__file__).resolve().parents[3]
SERVICE = ROOT / 'nodia-gemini-microservice'
sys.path.insert(0, str(SERVICE))
sys.path.insert(0, str(SERVICE / 'tests'))
import test_support  # installs isolation before application imports
from agentic_cli import CliConfig
from native_context_budget import mcp_catalog_text
from native_execution_agents import execution_agent_definition, mcp_execution_policy_hash
from native_mcp_sessions import NativeMcpSessions, McpChatRequest, McpPoll, McpResult
from native_attempts import ReconcileAttempt, AcknowledgeAttempt
from native_mcp_stdio import gate_detail, read_manifest
from nodia_ai_chat import ChatAdapter
from profile_admission import ProfileAdmission

sha = lambda value: hashlib.sha256(value).hexdigest()
EXPECT_DEPTH_REJECTION = sys.argv[1:] == ['--expect-manifest-depth-rejection']
assert sys.argv[1:] in ([], ['--expect-manifest-depth-rejection'])


def json_depth(value):
    children = value.values() if isinstance(value, dict) else value if isinstance(value, list) else ()
    return max([0] + [1 + json_depth(child) for child in children])


async def main():
    catalog_path = ROOT / 'docs/evidence/nodia-ai-ai36-c05-preferences-catalog-control.json'
    catalog = json.loads(catalog_path.read_text(encoding='utf-8'))
    tools = catalog['tools']
    assert len(tools) == 9
    assert sha(json.dumps(tools, ensure_ascii=False, separators=(',', ':')).encode()) == catalog['catalog_sha256']
    wire_tools = [{'name': t['name'], 'description': t['description'], 'input_schema': t['inputSchema']} for t in tools]
    checks = {}
    actual_callbacks = []
    synthetic_failure = []
    rejection_evidence = {}
    with tempfile.TemporaryDirectory(prefix='nodia-offline-pref-nine-tools-') as directory:
        base = Path(directory)
        profile = base / 'profile'
        profile.mkdir()
        # A source-profile server must never be inherited by the disposable MCP config.
        foreign = profile / '.gemini/config/mcp_config.json'
        foreign.parent.mkdir(parents=True)
        foreign.write_text(json.dumps({'mcpServers': {'synthetic_foreign': {'command': 'never-execute'}}}))
        original_foreign = foreign.read_bytes()
        profiles = ProfileAdmission(base / 'web', profile, base / 'state')
        runner = SimpleNamespace(config=CliConfig(Path(sys.executable), '', profile), _processes=set(), run=AsyncMock())
        service = SimpleNamespace(runner=runner, is_available=lambda: True, session_generation='a' * 32,
            get_status=AsyncMock(return_value={'has_active_session': True, 'models': [{'id': 'synthetic-model'}]}))
        adapter = ChatAdapter(None, service, profiles)
        sessions = NativeMcpSessions(adapter)
        adapter.mcp_sessions = sessions
        request = McpChatRequest(attempt_id=str(uuid4()), model_id='synthetic-model', effort_id=None,
            canonical_prompt='Synthetic offline transport control. No business execution.',
            resource_key=profiles.identity('agentic'), session_generation='a' * 32,
            timeout_seconds=10, configuration_generation='b' * 64, tools=wire_tools, diagnostic=True)
        reference = ReconcileAttempt(resource_key=request.resource_key, session_generation=request.session_generation,
            operation_ref=request.attempt_id)
        assert len(mcp_catalog_text(request.tools).encode('utf-8')) == catalog['native_catalog_utf8_bytes'] == 21873
        checks['native_catalog_21873_bytes_exact'] = True

        async def synthetic_cli(args, **kwargs):
            name, document = execution_agent_definition('mcp', False)
            assert args[args.index('--agent') + 1] == name
            assert (kwargs['cwd'] / '.agents/agents' / name / 'agent.md').read_text(encoding='utf-8') == document
            assert 'inheritMcp: true\n' in document and '  - call_mcp_tool\n' not in document
            config = json.loads((kwargs['home'] / '.gemini/config/mcp_config.json').read_text(encoding='utf-8'))
            assert set(config) == {'mcpServers'} and set(config['mcpServers']) == {'nodia_runtime'}
            assert kwargs['home'] != profile
            checks['owned_role_exact_and_single_temporary_server'] = True
            settings = json.loads((kwargs['home'] / '.gemini/antigravity-cli/settings.json').read_text(encoding='utf-8'))
            assert set(settings['permissions']['allow']) == {'mcp(nodia_runtime/' + t['name'] + ')' for t in tools}
            assert {'command(*)', 'unsandboxed(*)', 'read_file(*)', 'write_file(*)', 'read_url(*)', 'execute_url(*)'} <= set(settings['permissions']['deny'])
            checks['settings_exact_nine_allowlist_and_native_denials'] = True
            command = config['mcpServers']['nodia_runtime']
            manifest = Path(command['args'][-1])
            policy = json.loads(manifest.read_text(encoding='utf-8'))
            assert policy['tools'] == wire_tools and policy['rpc_budget'] == 128 and policy['tool_budget'] == 12
            assert policy['documents'] == []
            own_tools = {t['name'] for t in tools}
            for server, tool, category in [('foreign', 'nodia_preferences_prepare', 'foreign_server'),
                    ('nodia_runtime', 'nodia_confirm', 'unregistered_tool')]:
                decision = gate_detail({'toolCall': {'name': 'call_mcp_tool', 'args': {
                    'ServerName': server, 'ToolName': tool, 'Arguments': '{}'}}}, own_tools)
                assert decision[1] is False and decision[2] == category
            assert gate_detail({'toolCall': {'name': 'run_command', 'args': {}}}, own_tools)[1] is False
            checks['foreign_server_unknown_tool_and_shell_denied'] = True
            try:
                read_manifest(manifest)
            except ValueError as error:
                assert str(error) == 'JSON depth'
                rejected = await asyncio.create_subprocess_exec(command['command'], *command['args'], cwd=command['cwd'],
                    stdin=asyncio.subprocess.PIPE, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
                output, error_bytes = await asyncio.wait_for(rejected.communicate(json.dumps({
                    'jsonrpc': '2.0', 'id': 1, 'method': 'initialize', 'params': {'protocolVersion': '2025-11-25'}}).encode() + b'\n'), 3)
                assert rejected.returncode == 2 and not output and not error_bytes
                rejection_evidence.update(manifest_depth=json_depth(policy), catalog_depth=json_depth(policy['tools']),
                    schema_depths={t['name']: json_depth(t['input_schema']) for t in policy['tools']},
                    tools_list_response_depth=json_depth({'jsonrpc': '2.0', 'id': 2, 'result': {'tools': tools}}),
                    real_stdio_exit_code=2, stdout_bytes=0, stderr_bytes=0, initialize_reply_received=False,
                    exception_type='ValueError', exception_category='JSON depth')
                raise
            bridge = await asyncio.create_subprocess_exec(command['command'], *command['args'], cwd=command['cwd'],
                stdin=asyncio.subprocess.PIPE, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
            runner._processes.add(bridge)
            async def send(value, reply=True):
                bridge.stdin.write((json.dumps(value) + '\n').encode())
                await bridge.stdin.drain()
                return json.loads(await asyncio.wait_for(bridge.stdout.readline(), 3)) if reply else None
            async def checked_gate(payload):
                gate = await asyncio.create_subprocess_exec(sys.executable, str(SERVICE / 'native_mcp_stdio.py'),
                    'gate', str(manifest), str(manifest.parent / 'gate.jsonl'), stdin=asyncio.subprocess.PIPE,
                    stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
                output, error = await asyncio.wait_for(gate.communicate(json.dumps(payload).encode()), 3)
                assert gate.returncode == 0 and not error
                assert json.loads(output)['decision'] == 'allow'
            try:
                await send({'jsonrpc': '2.0', 'id': 1, 'method': 'initialize', 'params': {'protocolVersion': '2025-11-25'}})
                await send({'jsonrpc': '2.0', 'method': 'notifications/initialized'}, False)
                listed = await send({'jsonrpc': '2.0', 'id': 2, 'method': 'tools/list'})
                assert listed['result']['tools'] == tools
                checks['real_stdio_tools_list_exact_nine_descriptions_and_schemas'] = True
                for index, tool in enumerate(('nodia_preferences_prepare', 'nodia_preferences_list'), 3):
                    arguments = catalog['valid_synthetic_arguments'][tool]
                    await checked_gate({'toolCall': {'name': 'call_mcp_tool', 'args': {
                        'ServerName': 'nodia_runtime', 'ToolName': tool,
                        'Arguments': json.dumps(arguments)}}})
                    result = await send({'jsonrpc': '2.0', 'id': index, 'method': 'tools/call',
                        'params': {'name': tool, 'arguments': json.dumps(arguments)}})
                    assert result['result']['structuredContent'] == {'fixture_only': True, 'business_effects': False}
                checks['valid_prepare_and_list_dispatcher_gate_and_real_stdio_roundtrip'] = True
                await checked_gate({'toolCall': {'name': 'finish', 'args': {}}})
                return '\n'.join(json.dumps(event) for event in [
                    {'event': 'init', 'init': {'model': request.model_id, 'agent': name}},
                    {'event': 'result', 'result': {'status': 'SUCCESS', 'structured_output': {'kind': 'answer', 'text': 'Synthetic bridge control completed.'}}}]), 0
            finally:
                bridge.stdin.close()
                await asyncio.wait_for(bridge.wait(), 3)
                error = await bridge.stderr.read()
                assert bridge.returncode == 0, error.decode('utf-8', errors='replace')
                assert not error
                runner._processes.discard(bridge)

        async def retained_synthetic_cli(*args, **kwargs):
            try:
                return await synthetic_cli(*args, **kwargs)
            except BaseException as error:
                synthetic_failure.append(error)
                raise
        runner.run.side_effect = retained_synthetic_cli
        cursor = 0
        terminal = None
        try:
            await sessions.start(request)
            async with asyncio.timeout(15):
                while True:
                    value = sessions.poll(request.attempt_id, McpPoll(**reference.model_dump(), after=cursor))
                    for event in value['events']:
                        cursor = event['seq']
                        if event['kind'] == 'tool_request':
                            actual_callbacks.append(event['name'])
                            assert event['arguments'] == catalog['valid_synthetic_arguments'][event['name']]
                            sessions.submit(request.attempt_id, McpResult(**reference.model_dump(), call_id=event['call_id'],
                                result={'fixture_only': True, 'business_effects': False}))
                        else:
                            terminal = event
                    if value['state'] != 'running':
                        break
                    await asyncio.sleep(.01)
            if EXPECT_DEPTH_REJECTION:
                assert len(synthetic_failure) == 1 and isinstance(synthetic_failure[0], ValueError)
                assert str(synthetic_failure[0]) == 'JSON depth' and rejection_evidence
                assert value['state'] == 'unknown' and actual_callbacks == []
            elif synthetic_failure:
                raise synthetic_failure[0]
            else:
                assert value['state'] == 'completed', value['state']
                assert actual_callbacks == ['nodia_preferences_prepare', 'nodia_preferences_list']
                assert terminal['terminal_proof']['outcome'] == 'completed' and terminal['terminal_proof']['process_closed'] is True
            proof = adapter.reconcile('agentic', request.attempt_id, reference)
            adapter.acknowledge('agentic', request.attempt_id, AcknowledgeAttempt(**reference.model_dump(), terminal_proof_id=proof['terminal_proof_id']))
            assert not sessions.jobs and not runner._processes
            assert foreign.read_bytes() == original_foreign
            assert not list(profile.glob('nodia-mcp-*'))
            checks['synthetic_terminal_cleanup_ACK_and_source_profile_preserved'] = True
        finally:
            await sessions.close()
    result = {'schema_version': 1, 'status': 'reproduced_manifest_depth_rejection' if EXPECT_DEPTH_REJECTION else 'passed', 'scope': 'offline_exact_preferences_nine_tool_native_materialization_and_stdio_control',
        'checks': checks, 'tool_count': 9, 'catalog_sha256': catalog['catalog_sha256'], 'native_catalog_utf8_bytes': 21873,
        'pre_fix_rejection': rejection_evidence if EXPECT_DEPTH_REJECTION else None,
        'catalog_artifact_sha256': sha(catalog_path.read_bytes()), 'script_sha256': sha(Path(__file__).read_bytes()),
        'MCP_execution_policy_sha256': mcp_execution_policy_hash(),
        'source_hashes': {name: sha((SERVICE / name).read_bytes()) for name in ('native_mcp_sessions.py', 'native_execution_agents.py', 'native_mcp_stdio.py', 'native_context_budget.py')},
        'provider_CLI_executions': 0, 'provider_requests': 0, 'operational_database_access': 0,
        'synthetic_business_callbacks': actual_callbacks, 'business_preparers_executed': 0, 'business_effects': 0,
        'interpretation': 'Exact public descriptors and real Nodia materialization/gate/stdio are exercised. The CLI consumer and business replies are synthetic; this does not prove CLI inheritance, runtime availability, or capability acceptance.'}
    output = ROOT / ('docs/evidence/nodia-ai-ai36-c05-preferences-stdio-control-pre-fix.json' if EXPECT_DEPTH_REJECTION else 'docs/evidence/nodia-ai-ai36-c05-preferences-stdio-control.json')
    output.write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    asyncio.run(main())
