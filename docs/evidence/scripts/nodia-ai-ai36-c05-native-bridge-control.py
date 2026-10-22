"""Offline diagnostic control: actual stdio/supervisor, synthetic CLI and results."""
import asyncio
import datetime
import hashlib
import platform
import json
from pathlib import Path
import sys

root = Path(__file__).resolve().parents[3]
sys.path[:0] = [str(root / 'nodia-gemini-microservice/tests'), str(root / 'nodia-gemini-microservice')]
import test_support
from test_native_mcp import NativeMcpSessionTests
from native_mcp_sessions import McpPoll, McpResult, McpTrace


async def main():
    trace = McpTrace()
    for state in ('IN_PROGRESS', 'DONE'):
        trace.feed((json.dumps({'event': 'step_update', 'step_update': {
            'step_type': 'tool', 'tool_name': 'call_mcp_tool', 'state': state}}) + '\n').encode())
    assert trace.diagnostic()['tool_event_counts']['call_mcp_tool'] == 2
    assert trace.diagnostic()['tool_completed_counts']['call_mcp_tool'] == 1
    case = NativeMcpSessionTests(methodName='test_real_stdio_two_callback_loop_is_bounded_and_fixture_only')
    case.setUp()
    received_reply_bytes = []
    try:
        async def fake_cli(_args, **kwargs):
            configuration = json.loads((kwargs['home'] / '.gemini/config/mcp_config.json').read_text())
            command = configuration['mcpServers']['nodia_runtime']
            # The fixture client deliberately accepts replies larger than 64 KiB;
            # the production bridge counts their full serialized bytes separately.
            process = await asyncio.create_subprocess_exec(command['command'], *command['args'],
                stdin=asyncio.subprocess.PIPE, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
                limit=262144)
            case.runner._processes.add(process)
            async def send(value, reply=True):
                process.stdin.write((json.dumps(value) + '\n').encode())
                await process.stdin.drain()
                if not reply:
                    return None
                raw = await asyncio.wait_for(process.stdout.readline(), 3)
                received_reply_bytes.append(len(raw))
                return json.loads(raw)
            try:
                await send({'jsonrpc': '2.0', 'id': 1, 'method': 'initialize', 'params': {'protocolVersion': '2025-11-25'}})
                await send({'jsonrpc': '2.0', 'method': 'notifications/initialized'}, False)
                await send({'jsonrpc': '2.0', 'id': 2, 'method': 'tools/list'})
                first = await send({'jsonrpc': '2.0', 'id': 3, 'method': 'tools/call',
                    'params': {'name': 'fixture_read', 'arguments': {'query': 'first'}}})
                assert len(first['result']['structuredContent']['marker']) == 48000
                second = await send({'jsonrpc': '2.0', 'id': 4, 'method': 'tools/call',
                    'params': {'name': 'fixture_prepare', 'arguments': {'query': 'second'}}})
                assert second['result']['structuredContent']['state'] == 'awaiting_human_confirmation'
                (kwargs['cwd'].parent / 'bridge/gate.jsonl').write_text('\n'.join(
                    json.dumps({'tool': name, 'allowed': True}) for name in ('fixture_read', 'fixture_prepare', 'finish')))
                return '\n'.join(json.dumps(event) for event in [
                    {'event': 'init', 'init': {'model': 'fixture-model'}},
                    {'event': 'result', 'result': {'status': 'SUCCESS', 'structured_output': {
                        'kind': 'answer', 'text': 'Synthetic bridge control completed.'}}}]), 0
            finally:
                process.stdin.close()
                await process.wait()
                case.runner._processes.discard(process)
        case.runner.run.side_effect = fake_cli
        await case.sessions.start(case.request)
        cursor = callbacks = 0
        async with asyncio.timeout(8):
            while True:
                value = case.sessions.poll(case.request.attempt_id, McpPoll(**case.reference.model_dump(), after=cursor))
                for event in value['events']:
                    cursor = event['seq']
                    if event['kind'] == 'tool_request':
                        callbacks += 1
                        result = {'marker': 'x' * 48000} if event['name'] == 'fixture_read' else {
                            'state': 'awaiting_human_confirmation', 'executed': False}
                        case.sessions.submit(case.request.attempt_id, McpResult(**case.reference.model_dump(),
                            call_id=event['call_id'], result=result))
                if value['state'] != 'running':
                    break
                await asyncio.sleep(.02)
        assert value['state'] == 'completed'
        assert callbacks == 2
        assert value['unforwarded_tool_requests'] == 0
        return {'scope': 'offline_actual_bridge_and_supervisor_synthetic_cli_and_callback_results',
            'one_call_progress_events': trace.diagnostic()['tool_event_counts']['call_mcp_tool'],
            'one_call_progress_done': trace.diagnostic()['tool_completed_counts']['call_mcp_tool'],
            'callbacks': callbacks, 'rpc_messages': value['rpc_messages'],
            'unforwarded_tool_requests': value['unforwarded_tool_requests'], 'state': value['state'],
            'rpc_reply_utf8_bytes': received_reply_bytes, 'real_cli_or_provider_requests': 0,
            'operational_profiles_or_services_accessed': False}
    finally:
        await case.asyncTearDown()
        case.doCleanups()

def local_import_hashes():
    """Hash imported repository source, never runtime profiles or credentials."""
    service_root = root / 'nodia-gemini-microservice'
    paths = set()
    for module in tuple(sys.modules.values()):
        source = getattr(module, '__file__', None)
        if source:
            path = Path(source).resolve()
            if (path.suffix == '.py' and path.is_relative_to(service_root)
                    and '.venv' not in path.relative_to(service_root).parts):
                paths.add(path)
    return [{'path': path.relative_to(root).as_posix(),
             'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}
            for path in sorted(paths)]


if __name__ == '__main__':
    result = asyncio.run(main())
    print(json.dumps({
        'stage': 'AI-36-C05',
        'scope': 'supplementary_offline_bridge_diagnostic_not_provider_acceptance',
        'observed_at_utc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'reproduce_command': r'.\nodia-gemini-microservice\.venv\Scripts\python.exe docs/evidence/scripts/nodia-ai-ai36-c05-native-bridge-control.py',
        'runtime': {'implementation': platform.python_implementation(), 'version': platform.python_version()},
        'script': {'path': Path(__file__).resolve().relative_to(root).as_posix(),
                   'sha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest()},
        'local_imports': local_import_hashes(),
        'result': result,
        'boundaries': {
            'real_stdio_bridge_and_supervisor': True,
            'cli_client_and_terminal_result': 'synthetic_test_fixture',
            'callback_results': 'synthetic_test_fixture',
            'subprocess': 'local_python_stdio_bridge_only',
            'external_network_blocked_by': 'tests/test_support.py installed before service imports',
            'production_services_started_or_restarted': False,
            'production_data_accessed': False,
            'real_cli_or_provider_acceptance': False,
        },
        'limitations': [
            'Does not execute the Antigravity CLI binary or infer with Gemini.',
            'Fixture client allows replies above 64 KiB; real CLI parsing limits are not measured.',
            'Does not identify the cause of the Live02 deadline.',
            'Two progress events with one DONE can represent one tool invocation.',
        ],
    }, indent=2))
