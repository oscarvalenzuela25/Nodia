"""One deliberate new MCP diagnostic after the closed R01, in the same FIX epoch.

Reuse the pinned driver and harness unchanged. No loop, inference replay,
restart, login or model substitution. Root owns the exclusive provider window;
the original driver performs its read-only SQL quiet/selection check.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import importlib.util
import json
from pathlib import Path
import sys
from types import SimpleNamespace


DRIVER_SHA = '118554a41d3403695c41a9c86007eb36a610f98855f5cc7c8c22d542fdaab7ba'
HARNESS_SHA = '95cdfdc53e86cf44c892273185c11ee2d319c636fbb0db6cd39980b12d42c87d'
PRIOR_SHA = 'ac7e222e730f8ffa454562753d57d40e8ceafd6c05964da29b14cca9459f5a94'
TERMINAL_SHA = '08ff1610072052ac787605e2cf1e627364cdeb1e47579e8c22584dfa3fe54b7c'
WORK = Path('/opt/nodia/verification/ai38-profile-reservation-fix-mcp-post-list-r01')


def require(ok, code):
    if not ok:
        raise ValueError(code)


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read_pinned(path, digest):
    require(path.is_file() and not path.is_symlink() and sha(path) == digest, 'input_pin_mismatch')
    return json.loads(path.read_text(encoding='utf-8'))


def validate_prior(prior, terminal):
    native = prior.get('native_result', {})
    require(prior.get('status') == 'failed_no_replay' and native.get('error_code') == 'mcp_result_unknown', 'prior_not_expected_closed_diagnostic')
    require(prior.get('native_pending_identity') is False and native.get('native_pending_identity') is False
            and native.get('native_terminal_proof_acknowledged') is True, 'prior_identity_not_closed_ACK')
    require(native.get('inference_replayed') is False and native.get('real_provider_dispatch_requests') == 1
            and native.get('diagnostics', {}).get('callbacks') == 0, 'prior_diagnostic_binding_changed')
    previous_epoch = prior['native_epoch_before']
    require(prior.get('same_native_epoch_after') is True and terminal.get('native_epoch') == previous_epoch, 'prior_epoch_not_bound')
    attempt = native['diagnostics']['attempt_id']
    require(any(item.get('attempt_id') == attempt for item in terminal.get('terminal_records', [])), 'prior_terminal_attempt_missing')
    return previous_epoch, attempt


def execute_once(base, args, prior, terminal):
    before, prior_attempt = validate_prior(prior, terminal)
    require(args.execute_one_new_diagnostic is True, 'explicit_new_diagnostic_required')
    require(args.expected_image == before['image'] and base.epoch(args.expected_image) == before, 'same_FIX_epoch_required')
    require(not WORK.exists(), 'new_diagnostic_work_exists_no_replay')
    # Only this process-local work target changes; source, adapter and harness
    # remain frozen. The old attempt ID is never passed to the new harness.
    base.WORK = WORK
    code = base.run(SimpleNamespace(expected_image=args.expected_image, harness=str(args.harness), execute_one_live=True))
    fresh = json.loads((WORK / 'public-report.json').read_text(encoding='utf-8'))
    new_attempt = fresh.get('native_result', {}).get('diagnostics', {}).get('attempt_id')
    require(new_attempt is None or new_attempt != prior_attempt, 'old_attempt_identity_reused')
    require(base.epoch(args.expected_image) == before, 'epoch_changed_after_new_diagnostic')
    control = dict(scope='one_deliberate_new_diagnostic_not_automatic_retry', source_sha256=sha(Path(__file__)),
                   base_driver_sha256=DRIVER_SHA, harness_sha256=HARNESS_SHA, prior_report_sha256=PRIOR_SHA,
                   prior_terminal_sha256=TERMINAL_SHA, prior_closed_attempt_id=prior_attempt, new_attempt_id=new_attempt,
                   prior_identity_passed_to_harness=False, maximum_new_generations=1, automatic_retries=0,
                   configured_SQL_writes=0, services_restarted=False, same_native_epoch=True,
                   new_report_sha256=sha(WORK / 'public-report.json'), observed_at_utc=datetime.now(timezone.utc).isoformat())
    with (WORK / 'post-list-control.json').open('x', encoding='utf-8') as output:
        output.write(json.dumps(control, indent=2) + '\n')
    return code


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base-driver', type=Path, required=True)
    parser.add_argument('--harness', type=Path, required=True)
    parser.add_argument('--prior-report', type=Path, required=True)
    parser.add_argument('--prior-terminal', type=Path, required=True)
    parser.add_argument('--expected-image', required=True)
    parser.add_argument('--execute-one-new-diagnostic', action='store_true')
    args = parser.parse_args()
    require(args.base_driver.is_file() and not args.base_driver.is_symlink() and sha(args.base_driver) == DRIVER_SHA, 'base_driver_pin_mismatch')
    require(args.harness.is_file() and not args.harness.is_symlink() and sha(args.harness) == HARNESS_SHA, 'harness_pin_mismatch')
    prior, terminal = read_pinned(args.prior_report, PRIOR_SHA), read_pinned(args.prior_terminal, TERMINAL_SHA)
    spec = importlib.util.spec_from_file_location('ai38_frozen_MCP_driver', args.base_driver)
    base = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(base)
    return execute_once(base, args, prior, terminal)


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except (OSError, ValueError, KeyError, TypeError):
        print(json.dumps({'status': 'new_diagnostic_control_failed_no_replay', 'raw_details_emitted': False}))
        raise SystemExit(1)
