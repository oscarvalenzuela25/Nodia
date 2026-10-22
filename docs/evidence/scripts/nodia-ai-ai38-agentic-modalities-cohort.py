"""Four independent Agentic format probes, sequentially, never an inference retry.

VM: DRIVER HELPER HELPER_SHA --qualification-report CANARY --qualification-epoch CAPTURE --execute-four-live-sequential
Root must serialize this cohort against every other real-provider operation.
This module is inert when imported. A missing/incomplete report stops the cohort.
"""
from datetime import datetime, timezone
import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import subprocess


FORMATS = ('png', 'pdf', 'wav', 'webm')
EXPECTED_MEDIA = {'png': ('image', 'image/png'), 'pdf': ('pdf', 'application/pdf'),
                  'wav': ('audio', 'audio/wav'), 'webm': ('audio', 'audio/webm')}
HELPER_SHA = '616077cd82abaad224002a9c8a758d8b8d7e98d0991679d290b7edd380763131'
WAV_SHA = 'ded0091808665288f22fcc8947ffa098ef1149bd12a42591708856f50816abf0'
WEBM_SHA = '6faf3d9f76e7216b105a3b9291f9f671dcfb8edee74818108225405be260d8b0'


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def epoch():
    template = '{"id":"{{.Id}}","image":"{{.Image}}","started_at":"{{.State.StartedAt}}","running":{{.State.Running}}}'
    result = subprocess.run(['docker', 'inspect', '--format', template, 'nodia-gemini-microservice'],
                            capture_output=True, check=True, timeout=15)
    value = json.loads(result.stdout)
    assert value['running'] is True
    return value


def closed_result(value):
    """Only explicit, acknowledged native closure permits another independent format."""
    return (isinstance(value, dict) and value.get('native_pending_identity') is False
            and value.get('native_acknowledged') is True
            and value.get('native_outcome') in ('completed', 'abandoned_unknown')
            and type(value.get('generation_requests')) is int
            and value['generation_requests'] == 1
            and value.get('maximum_generations') == 1
            and value.get('inference_replayed') is False)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('helper', type=Path)
    parser.add_argument('helper_sha')
    parser.add_argument('--qualification-report', type=Path, required=True)
    parser.add_argument('--qualification-epoch', type=Path, required=True)
    parser.add_argument('--execute-four-live-sequential', action='store_true', required=True)
    args = parser.parse_args()
    assert args.helper.is_absolute() and args.helper.is_file()
    assert args.helper_sha == HELPER_SHA and sha(args.helper) == HELPER_SHA
    assert args.qualification_report.is_absolute() and args.qualification_epoch.is_absolute()
    qualified = json.loads(args.qualification_report.read_text(encoding='utf-8'))
    capture = json.loads(args.qualification_epoch.read_text(encoding='utf-8'))
    native = qualified['native_result']
    assert qualified['status'] == native['status'] == 'passed'
    assert native['diagnostic_nonce_verified'] is True and native['native_terminal_proof_acknowledged'] is True
    assert native['native_pending_identity'] is False and native['supports_mcp_after'] is True
    assert capture['input_report_sha256'] == sha(args.qualification_report)
    assert capture['attempt_id'] == native['diagnostics']['attempt_id']
    assert capture['same_container_epoch_after_capture'] is True
    expected_selection = {key: native['diagnostics'][key] for key in ('selection', 'configuration_generation', 'session_generation')}
    speech = {'wav': Path('/tmp/speech.wav'), 'webm': Path('/tmp/ai38-synthetic-speech.webm')}
    assert sha(speech['wav']) == WAV_SHA and sha(speech['webm']) == WEBM_SHA
    targets = {fmt: Path('/opt/nodia/verification') / ('ai38-modalities-agentic-' + fmt + '-01') for fmt in FORMATS}
    assert all(not target.exists() for target in targets.values()), 'Prior attempts must never be overwritten or replayed'
    work = Path('/opt/nodia/verification/ai38-modalities-agentic-cohort-02')
    os.umask(0o077)
    work.mkdir(mode=0o700, exist_ok=False)
    specification = importlib.util.spec_from_file_location('ai38_exact_format_helper', args.helper)
    helper = importlib.util.module_from_spec(specification)
    specification.loader.exec_module(helper)
    initial_epoch = epoch()
    assert (initial_epoch['id'], initial_epoch['image'], initial_epoch['started_at']) == (
        capture['container_id'], capture['container_image'], capture['container_started_at_utc'])
    report = {'stage': 'AI-38', 'scope': 'four_independent_Agentic_format_probes_sequential',
              'status': 'running', 'started_at_utc': datetime.now(timezone.utc).isoformat(),
              'source_sha256': sha(Path(__file__)), 'helper_sha256': HELPER_SHA,
              'qualification_report_sha256': sha(args.qualification_report),
              'qualification_epoch_sha256': sha(args.qualification_epoch),
              'historical_resource_key_compared': False,
              'maximum_probe_requests': 4, 'automatic_inference_retries': 0,
              'formats_order': list(FORMATS), 'cases': [], 'epoch_before': initial_epoch,
              'probe_requests_declared_in_reports': 0, 'configured_SQL_writes': 0,
              'services_restarted': False, 'selection_modified': False,
              'unknown_native_state': False}

    def save():
        (work / 'public-report.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')

    environment = {'PATH': '/usr/local/bin:/usr/bin:/bin', 'HOME': str(work),
                   'NODE_ENV': 'test', 'DOTENV_CONFIG_PATH': '/dev/null', 'RATE_LIMIT_STORAGE': 'memory'}
    binding = None
    save()
    try:
        for fmt in FORMATS:
            assert epoch() == initial_epoch, 'Provider epoch changed; do not inherit previous proof'
            # Non-generative fresh exact selection is compared before launching
            # the format helper, which independently revalidates its own snapshot.
            snapshot = subprocess.run(['/usr/local/bin/node', '--input-type=module', '-',
                                       '/opt/nodia/verification/ai38-node-candidate01/nodia-server',
                                       '/opt/nodia/releases/nodia-server-ai15-20261016/.env', 'agentic'],
                                      input=helper.SNAPSHOT.encode(), env=environment,
                                      capture_output=True, check=False, timeout=60)
            (work / (fmt + '-private-snapshot-stderr.log')).write_bytes(snapshot.stderr)
            assert snapshot.returncode == 0, 'Fresh exact-selection snapshot failed before format helper'
            observed = json.loads(snapshot.stdout)
            current = {key: observed[key] for key in ('selection', 'configuration_generation', 'session_generation', 'resource_key', 'provider_key')}
            assert current['provider_key'] == 'gemini' and current['selection']['mode'] == 'token_plan_agentic'
            assert all(current[key] == expected_selection[key] for key in expected_selection), 'Exact canary selection/configuration/session changed'
            if binding is None:
                binding = current
                report['binding'] = binding
            else:
                assert current == binding, 'Selection/configuration/session/resource changed; do not start next format'
            case = {'format': fmt, 'work': str(targets[fmt]), 'status': 'starting', 'native_state': 'not_yet_known'}
            report['cases'].append(case)
            save()
            argv = ['python3', str(args.helper), '--mode', 'agentic', '--format', fmt,
                    '--work', str(targets[fmt]), '--execute-one-live']
            if fmt in speech:
                argv.extend(['--speech', str(speech[fmt])])
            with (work / (fmt + '-private-stdout.log')).open('xb') as out, (work / (fmt + '-private-stderr.log')).open('xb') as err:
                try:
                    result = subprocess.run(argv, env=environment, stdout=out, stderr=err, timeout=600)
                    case['exit_code'] = result.returncode
                except subprocess.TimeoutExpired:
                    case['exit_code'] = 124
                    case['status'] = 'driver_timeout_requires_identity_reconciliation_no_replay'
            path = targets[fmt] / 'public-report.json'
            if not path.is_file():
                case['status'] = 'helper_report_absent_stop_before_any_next_format'
                report['unknown_native_state'] = True
                break
            value = json.loads(path.read_text(encoding='utf-8'))
            case['report_sha256'] = sha(path)
            case['probe_result'] = value
            declared = value.get('generation_requests')
            assert type(declared) is int and 0 <= declared <= 1
            report['probe_requests_declared_in_reports'] += declared
            assert report['probe_requests_declared_in_reports'] <= 4
            same_selection = all(value.get(key) == binding[key] for key in ('selection', 'configuration_generation', 'session_generation'))
            same_format = (value.get('kind'), value.get('media_type')) == EXPECTED_MEDIA[fmt]
            same_epoch = epoch() == initial_epoch
            case['same_binding'] = same_selection
            case['same_format'] = same_format
            case['same_epoch'] = same_epoch
            case['native_state'] = 'closed_acknowledged' if closed_result(value) else 'unproven_stop'
            if not closed_result(value) or not same_selection or not same_format or not same_epoch or case.get('exit_code') == 124:
                case['status'] = 'stop_requires_review_no_replay'
                report['unknown_native_state'] = not closed_result(value)
                break
            case['status'] = 'passed' if value.get('status') == 'passed' and case['exit_code'] == 0 else 'failed_format_closed_next_independent_format_allowed'
            save()
        report['status'] = ('passed' if len(report['cases']) == 4 and all(case['status'] == 'passed' for case in report['cases'])
                            else 'completed_with_closed_format_gates_open' if len(report['cases']) == 4 and all(case['native_state'] == 'closed_acknowledged' for case in report['cases'])
                            else 'stopped_no_next_probe')
    except Exception as error:
        report['status'] = 'control_failed_no_next_probe'
        report['failure_class'] = type(error).__name__
        if report['cases'] and report['cases'][-1]['native_state'] == 'not_yet_known':
            report['unknown_native_state'] = True
    finally:
        report['finished_at_utc'] = datetime.now(timezone.utc).isoformat()
        save()
    print(json.dumps(report, indent=2))
    return 0 if report['status'] == 'passed' else 1


if __name__ == '__main__':
    raise SystemExit(main())
