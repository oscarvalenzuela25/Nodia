"""One non-generative /model command inside the exclusively owned original image."""
import asyncio
from datetime import datetime, timezone
import hashlib
import json
import os
import sys
import time
from pathlib import Path

sys.path.insert(0, '/app')
from agentic_cli import CliConfig, CliRunner
from agentic_observation import command_data
from service_errors import ServiceError

async def main():
    selection = json.loads(sys.stdin.read())
    assert set(selection) == {'connection_id', 'mode', 'model_id', 'effort_id'}
    assert selection['mode'] == 'token_plan_agentic' and os.getuid() == 10001
    assert isinstance(selection['model_id'], str) and 0 < len(selection['model_id']) <= 1024
    assert selection['effort_id'] is None or isinstance(selection['effort_id'], str)
    config = CliConfig.from_environment()
    assert config is not None and config.version == '1.3.1'
    assert hashlib.sha512(config.binary.read_bytes()).hexdigest() == config.sha512
    info = config.binary.stat()
    args = ['-p', '/model', '--output-format', 'json', '--print-timeout', '45s', '--model', selection['model_id']]
    if selection['effort_id'] is not None:
        args += ['--effort', selection['effort_id']]
    runner = CliRunner(config)
    report = {'stage': 'AI-36-C05-R02', 'scope': 'exclusive_non_generative_exact_selection_model_45s_diagnostic',
        'started_at_utc': datetime.now(timezone.utc).isoformat(), 'command_class': 'model', 'command_requests': 1,
        'runner_timeout_seconds': 45, 'CLI_print_timeout_seconds': 45,
        'selection_sha256': hashlib.sha256(json.dumps(selection, sort_keys=True).encode()).hexdigest(),
        'version_binary_previously_accredited_and_hash_rechecked': True, 'additional_version_commands': 0,
        'initialize_or_profile_policy_writes_by_tool': 0, 'provider_inference_requests': 0,
        'raw_stdout_or_stderr_emitted': False, 'observed_num_turns': None, 'observed_total_tokens': None,
        'exit_code': None, 'command_data_validated': False, 'exact_model_match': None}
    started = time.monotonic()
    try:
        raw, code = await runner.run(args, timeout=45)
        report['elapsed_ms'] = (time.monotonic() - started) * 1000
        report['exit_code'] = code
        report['stdout_bytes'] = len(raw.encode('utf-8'))
        # Validation proves SUCCESS, exact command name, zero turns and tokens.
        data = command_data(raw, 'model')
        report['command_data_validated'] = True
        report['observed_num_turns'] = 0
        report['observed_total_tokens'] = 0
        report['exact_model_match'] = data.get('id') == selection['model_id']
        report['status'] = 'passed' if code == 0 and report['exact_model_match'] else 'model_selection_or_exit_mismatch'
    except ServiceError as error:
        report['status'] = 'bounded_command_failed'
        report['safe_error_code'] = error.code
        report['elapsed_ms'] = (time.monotonic() - started) * 1000
    finally:
        await runner.close()
        report['retained_runner_processes'] = len(runner._processes)
        report['binary_stat_unchanged'] = (info.st_mtime_ns, info.st_size) == (config.binary.stat().st_mtime_ns, config.binary.stat().st_size)
        report['finished_at_utc'] = datetime.now(timezone.utc).isoformat()
        print(json.dumps(report))

if __name__ == '__main__':
    asyncio.run(main())
