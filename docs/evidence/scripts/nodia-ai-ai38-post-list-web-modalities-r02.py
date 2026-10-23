"""Four new Web canaries, only after a changed Web session is observed.

Agentic is observed and its prior four format/MCP proofs checked, never rerun.
The frozen helper owns each new attempt's closure/ACK. Root serializes providers.
"""
import argparse
from datetime import datetime, timezone
import importlib.util
import json
import os
from pathlib import Path
import subprocess


BASE_SHA = 'f51d16a67b73a5eb5f5eaa6beee4bad1ae06d0e1af0d7641487887835af843d3'
MCP_SHA = '4b9f81b07217e5d01b28158edc6e60b2a46c78e1117b5101a1cb7ff48c81dbdd'
EPOCH_SHA = '2de48ac8425fcdee787668f7e9e5c2b756ec40d8e7bf2679d30c01b9ef7379e9'
PRIOR_SHA = '4ec350c3e20a580eaa8df80a65f5fd5a325a7cc4608721a5ddd051ed26914fe4'
WORK = Path('/opt/nodia/verification/ai38-modalities-post-list-web-r02')
ORDER = ('wav', 'webm', 'png', 'pdf')


def prior_guard(base, prior):
    base.require(prior['qualification_sha256'] == MCP_SHA and prior['qualification_epoch_sha256'] == EPOCH_SHA,
                 'prior_MCP_qualification_changed')
    base.require(prior['status'] == 'stopped_no_replay_no_next_probe' and type(prior['generation_requests_declared']) is int
                 and prior['generation_requests_declared'] == 7, 'prior_cohort_status_or_generation_count_changed')
    cases = {(item['mode'], item['format']): item for item in prior['cases']}
    base.require(len(cases) == len(prior['cases']) == 7, 'prior_cohort_not_closed_expected_shape')
    for fmt in base.FORMATS:
        case = cases['agentic', fmt]
        base.require(case['status'] == 'passed', 'prior_Agentic_format_not_verified')
        base.check_case(case['helper_report'], prior['bindings']['agentic'], fmt)
    for fmt in ('png', 'pdf'):
        base.require(cases['web', fmt]['status'] == 'passed', 'prior_Web_visual_format_not_verified')
        base.check_case(cases['web', fmt]['helper_report'], prior['bindings']['web'], fmt)
    failed = cases['web', 'wav']['helper_report']
    base.require(failed['native_acknowledged'] is True and failed['native_pending_identity'] is False
                 and failed['native_outcome'] == 'abandoned_unknown' and failed['inference_replayed'] is False
                 and type(failed['generation_requests']) is int and failed['generation_requests'] == 1,
                 'prior_Web_WAV_not_closed_ACK')
    return {item['helper_report']['attempt_id'] for item in prior['cases']}


def validate_observed(base, snapshot, prior, mode, fresh_web=None):
    base.require(base.configuration(snapshot) == prior['configuration_before'], 'configured_DB2_selection_changed')
    value = snapshot['observed']
    base.require(value['available'] is True, 'mode_not_available')
    identity = {key: value[key] for key in ('selection', 'configuration_generation', 'session_generation', 'resource_key')}
    old = prior['bindings'][mode]
    if mode == 'agentic':
        base.require(identity == old and value['supports_mcp'] is True, 'Agentic_binding_or_MCP_proof_changed')
        base.require({media for _, media in base.FORMATS.values()}.issubset(value['verified_attachment_media_types']), 'Agentic_existing_format_proofs_missing')
    else:
        base.require(value['supports_mcp'] is False and all(identity[key] == old[key] for key in ('selection', 'configuration_generation', 'resource_key')),
                     'Web_selection_configuration_or_resource_changed')
        base.require(identity['session_generation'] != old['session_generation'], 'Web_new_session_not_observed')
        if fresh_web is not None:
            base.require(identity == fresh_web, 'Web_new_session_changed_again')
    return identity


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('cohort-base', 'helper', 'mcp-report', 'mcp-epoch', 'prior-cohort', 'wav', 'webm'):
        parser.add_argument('--' + name, type=Path, required=True)
    parser.add_argument('--execute-four-new-Web-canaries', action='store_true', required=True)
    args = parser.parse_args()
    import hashlib
    digest = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
    if digest(args.cohort_base) != BASE_SHA:
        raise ValueError('cohort_base_pin_mismatch')
    spec = importlib.util.spec_from_file_location('ai38_frozen_format_cohort', args.cohort_base)
    base = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(base)
    for path, pin in ((args.helper, base.HELPER_SHA), (args.mcp_report, MCP_SHA), (args.mcp_epoch, EPOCH_SHA), (args.prior_cohort, PRIOR_SHA),
                      (args.wav, 'ded0091808665288f22fcc8947ffa098ef1149bd12a42591708856f50816abf0'),
                      (args.webm, '6faf3d9f76e7216b105a3b9291f9f671dcfb8edee74818108225405be260d8b0')):
        base.exact_file(path, pin)
    prior = json.loads(args.prior_cohort.read_text())
    old_attempts = prior_guard(base, prior)
    capture = json.loads(args.mcp_epoch.read_text())
    qualified = base.qualify(json.loads(args.mcp_report.read_text()), capture, MCP_SHA)
    base.require(all(prior['bindings']['agentic'][key] == qualified[key] for key in qualified), 'prior_Agentic_MCP_binding_changed')
    current_epoch = base.epoch()
    base.require(current_epoch == prior['epoch'] and (current_epoch['id'], current_epoch['image'], current_epoch['started_at_utc']) == (
        capture['container_id'], capture['container_image'], capture['container_started_at_utc']), 'same_native_epoch_required')
    base.verify_packet(base.PACKET)
    targets = {fmt: WORK.parent / (WORK.name + '-' + fmt) for fmt in base.FORMATS}
    base.require(not WORK.exists() and all(not path.exists() for path in targets.values()), 'new_work_exists_no_replay')
    os.umask(0o077)
    WORK.mkdir(mode=0o700)
    environment = {'PATH': '/usr/local/bin:/usr/bin:/bin', 'HOME': str(WORK), 'NODE_ENV': 'test', 'DOTENV_CONFIG_PATH': '/dev/null', 'RATE_LIMIT_STORAGE': 'memory'}
    report = dict(stage='AI-38', scope='four_new_Web_format_canaries_no_Agentic_generation', status='running',
                  source_sha256=digest(Path(__file__)), cohort_base_sha256=BASE_SHA, helper_sha256=base.HELPER_SHA,
                  MCP_sha256=MCP_SHA, MCP_epoch_sha256=EPOCH_SHA, prior_cohort_sha256=PRIOR_SHA, maximum_generations=4,
                  generation_requests_declared=0, inference_replays=0, Agentic_generations=0, cases=[], unknown_native_state=False,
                  epoch=current_epoch, formats_order=list(ORDER), configured_SQL_writes=0, services_restarted=False, business_effects=0,
                  started_at_utc=datetime.now(timezone.utc).isoformat())

    def save():
        (WORK / 'public-report.json').write_text(json.dumps(report, indent=2) + '\n')

    serial = 0

    def snapshot(mode):
        nonlocal serial
        base.require(base.epoch() == current_epoch, 'epoch_changed')
        serial += 1
        result = subprocess.run(['/usr/local/bin/node', '--input-type=module', '-', str(base.PACKET), base.API_ENV, mode],
                                input=base.SNAPSHOT.encode(), env=environment, capture_output=True, timeout=60, check=False)
        (WORK / ('private-snapshot-' + str(serial) + '-stderr.log')).write_bytes(result.stderr)
        base.require(result.returncode == 0, 'fresh_readonly_snapshot_failed')
        return json.loads(result.stdout)

    save()
    try:
        agentic = snapshot('agentic')
        report['Agentic_binding'] = validate_observed(base, agentic, prior, 'agentic')
        web = snapshot('web')
        binding = validate_observed(base, web, prior, 'web')
        report['Web_binding'] = binding
        report['Web_session_changed_from_prior'] = True
        save()
        for fmt in ORDER:
            validate_observed(base, snapshot('web'), prior, 'web', binding)
            base.exact_file(args.helper, base.HELPER_SHA)
            case = dict(mode='web', format=fmt, work=str(targets[fmt]), status='starting')
            report['cases'].append(case)
            report['unknown_native_state'] = True
            save()
            argv = ['python3', str(args.helper), '--mode', 'web', '--format', fmt, '--work', str(targets[fmt]), '--execute-one-live']
            if fmt in ('wav', 'webm'):
                argv.extend(['--speech', str(getattr(args, fmt))])
            with (WORK / (fmt + '-private-stdout.log')).open('xb') as out, (WORK / (fmt + '-private-stderr.log')).open('xb') as err:
                result = subprocess.run(argv, env=environment, stdout=out, stderr=err, timeout=600, check=False)
            path = targets[fmt] / 'public-report.json'
            value = json.loads(path.read_text())
            case.update(helper_report=value, report_sha256=base.sha(path))
            # ACK of abandoned_unknown closes the old attempt, but does not
            # verify the format or authorize another independent generation.
            report['unknown_native_state'] = not (value.get('native_acknowledged') is True and value.get('native_pending_identity') is False)
            declared = value.get('generation_requests')
            base.require(type(declared) is int and declared == 1, 'unexpected_generation_count')
            report['generation_requests_declared'] += declared
            base.require(report['generation_requests_declared'] <= 4, 'generation_budget_exceeded')
            base.check_case(value, binding, fmt)
            base.require(value['attempt_id'] not in old_attempts, 'old_attempt_identity_reused')
            old_attempts.add(value['attempt_id'])
            base.require(result.returncode == 0 and base.epoch() == current_epoch, 'format_failed_or_epoch_changed')
            case['status'] = 'passed'
            save()
        agentic, web = snapshot('agentic'), snapshot('web')
        validate_observed(base, agentic, prior, 'agentic')
        validate_observed(base, web, prior, 'web', binding)
        base.require({media for _, media in base.FORMATS.values()}.issubset(web['observed']['verified_attachment_media_types']), 'Web_four_new_format_proofs_missing')
        report.update(status='passed', final_observations={'agentic': agentic['observed'], 'web': web['observed']}, configuration_unchanged=True)
    except Exception as error:
        report.update(status='stopped_no_replay_no_next_probe', failure_class=type(error).__name__)
        if isinstance(error, base.ControlError):
            report['failure_code'] = str(error)
    finally:
        report['finished_at_utc'] = datetime.now(timezone.utc).isoformat()
        save()
    print(json.dumps(report, indent=2))
    return 0 if report['status'] == 'passed' else 1


if __name__ == '__main__':
    raise SystemExit(main())
