"""Offline subprocess shutdown comparison; never import an application or CLI."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import time
from uuid import uuid4


def run_case(helper, parser, stop):
    with tempfile.TemporaryDirectory(prefix='nodia-observer-shutdown-fixture-') as directory:
        base = Path(directory)
        home, state = base / 'profile', base / 'state'
        home.mkdir()
        state.mkdir()
        attempt = str(uuid4())
        config = {'schema_version': 1, 'attempt_id': attempt, 'operation_ref': attempt,
            'resource_key': 'gemini-profile:' + 'a' * 64, 'session_generation': 'b' * 32,
            'marker_path': str(state / ('a' * 64 + '.unknown')), 'profile_home': str(home),
            'parser_path': str(parser), 'parser_sha256': hashlib.sha256(parser.read_bytes()).hexdigest(),
            'maximum_seconds': 3, 'expected_policy': {'tools': [{'name': 'fixture_read', 'description': 'Synthetic only',
                'input_schema': {'type': 'object', 'additionalProperties': False}}],
                'rpc_budget': 128, 'tool_budget': 12, 'timeout_seconds': 3,
                'cli_json_string_arguments': True, 'documents': [],
                'context_budget': {'schema_version': 1, 'initial_utf8_bytes': 100, 'maximum_utf8_bytes': 262144}}}
        process = subprocess.Popen([sys.executable, '-I', '-B', str(helper)],
            stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        try:
            process.stdin.write(json.dumps(config) + '\n')
            process.stdin.flush()
            ready = json.loads(process.stdout.readline())
            assert ready['kind'] == 'ready'
            if stop:
                process.stdin.write(json.dumps({'kind': 'stop', 'attempt_id': attempt}) + '\n')
                process.stdin.flush()
            else:
                marker = Path(config['marker_path'])
                marker.write_text(json.dumps({key: config[key] for key in (
                    'attempt_id', 'resource_key', 'session_generation', 'operation_ref')}))
                owned = home / 'nodia-mcp-fixture'
                (owned / 'bridge').mkdir(parents=True)
                (owned / 'bridge/manifest.json').write_text(json.dumps(config['expected_policy']))
                (owned / 'cli.log').write_text('Synthetic structural log only\n')
                time.sleep(0.4)
                marker.unlink()
            result = json.loads(process.stdout.readline())
            # Keep stdin open until the interpreter exits: closing it here hides
            # the v1 daemon-thread failure by releasing its buffered read lock.
            process.wait(timeout=6)
            error = process.stderr.read()
            code = process.returncode
            return {'exit_code': code,
                'normalized_shell_exit_code': 128 - code if code < 0 else code,
                'stderr_bytes': len(error.encode()),
                'buffered_stdin_shutdown_error': '_enter_buffered_busy' in error,
                'fatal_python_error': 'Fatal Python error:' in error,
                'daemon_thread_shutdown_indicator': 'daemon threads' in error,
                'result_reason': result['reason'],
                'stdin_was_kept_open': True}
        finally:
            if process.poll() is None:
                process.kill()
                process.wait()
            for stream in (process.stdin, process.stdout, process.stderr):
                stream.close()


if __name__ == '__main__':
    helper, parser = (Path(item).resolve() for item in sys.argv[1:3])
    if os.name != 'nt':
        import resource
        resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
    print(json.dumps({'scope': 'offline_owned_observer_lifecycle_with_synthetic_files_only',
        'helper_sha256': hashlib.sha256(helper.read_bytes()).hexdigest(),
        'parser_sha256': hashlib.sha256(parser.read_bytes()).hexdigest(),
        'ownership_ended_stdin_open': run_case(helper, parser, False),
        'explicit_stop': run_case(helper, parser, True),
        'provider_requests': 0, 'application_imports': 0, 'runtime_mutations': 0,
        'raw_stderr_emitted': False}, indent=2))
