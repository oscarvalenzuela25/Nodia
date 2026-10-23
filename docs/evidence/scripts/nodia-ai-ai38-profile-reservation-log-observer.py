"""Read-only closed projection of reservation diagnostic events, never raw logs.

Start/end must be supplied from an independently captured trial/UI window.
The observer does not call HTTP, infer, acknowledge, reconcile or alter admission.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
import subprocess

PURPOSES = {'legacy', 'health_status', 'eligibility', 'login', 'execution', 'mcp_execution',
            'discovery', 'startup', 'logout', 'refresh'}
ENGINES = {'web', 'agentic', 'unknown'}
FIELDS = {'event', 'engine', 'purpose', 'reservation_nonce', 'owner_engine', 'owner_purpose',
          'elapsed_ms', 'quarantined', 'reason'}
PREFIX = b'nodia_ai_profile_reservation '
DIAGNOSTIC = re.compile(rb'^([^ ]+) [0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3} \| INFO\s+\| profile_admission:_diagnostic:[0-9]+ - nodia_ai_profile_reservation (.+)$')
ACCESS = re.compile(rb'^([^ ]+) .*?"(GET|POST) ([^ ]+) HTTP/[0-9.]+" ([0-9]{3})(?: |$)')
ROUTES = {('GET', b'/engines/status'): 'health', ('POST', b'/nodia-ai/agentic/observe'): 'observe',
          ('GET', b'/agentic/status'): 'agentic_status', ('GET', b'/agentic/models'): 'agentic_models',
          ('GET', b'/health'): 'liveness'}


def timestamp(value):
    result = datetime.fromisoformat(value.replace('Z', '+00:00'))
    if result.tzinfo is None:
        raise ValueError('timezone_required')
    return result.astimezone(timezone.utc)


def project(payload, begin, end):
    events, requests = [], []
    invalid = 0
    for line in payload.splitlines():
        if PREFIX in line:
            try:
                origin = DIAGNOSTIC.fullmatch(line)
                assert origin is not None
                stamp = timestamp(origin[1].decode('ascii'))
                value = json.loads(origin[2])
                if not begin <= stamp <= end:
                    continue
                assert isinstance(value, dict) and set(value) == FIELDS
                assert value['event'] in {'acquire', 'reject', 'release'}
                assert value['engine'] in ENGINES and value['purpose'] in PURPOSES
                assert value['owner_engine'] is None or value['owner_engine'] in ENGINES
                assert value['owner_purpose'] is None or value['owner_purpose'] in PURPOSES
                assert value['reservation_nonce'] is None or re.fullmatch('[a-f0-9]{32}', value['reservation_nonce'])
                assert value['elapsed_ms'] is None or (type(value['elapsed_ms']) is int and value['elapsed_ms'] >= 0)
                assert type(value['quarantined']) is bool
                assert value['reason'] in {None, 'runtime_busy', 'runtime_unconfigured'}
                events.append(dict(timestamp_utc=stamp.isoformat(), **value))
            except (ValueError, TypeError, AssertionError, UnicodeDecodeError):
                invalid += 1
        else:
            match = ACCESS.match(line)
            if not match:
                continue
            endpoint = ROUTES.get((match[2].decode('ascii'), match[3].partition(b'?')[0]))
            if endpoint is None:
                continue
            stamp = timestamp(match[1].decode('ascii'))
            if begin <= stamp <= end:
                requests.append(dict(timestamp_utc=stamp.isoformat(), method=match[2].decode('ascii'),
                                     endpoint=endpoint, status=int(match[4])))
    events.sort(key=lambda item: item['timestamp_utc'])
    requests.sort(key=lambda item: item['timestamp_utc'])
    correlations = []
    for index, event in enumerate(events):
        if event['event'] != 'reject' or event['reason'] != 'runtime_busy':
            continue
        nonce = event['reservation_nonce']
        acquired = [item for item in events[:index] if nonce is not None and
                    item['event'] == 'acquire' and item['reservation_nonce'] == nonce]
        released_before = [item for item in events[:index] if nonce is not None and item['event'] == 'release' and
                           item['reservation_nonce'] == nonce and not item['quarantined']]
        released_after = [item for item in events[index + 1:] if nonce is not None and item['event'] == 'release' and
                          item['reservation_nonce'] == nonce and not item['quarantined']]
        correlations.append(dict(rejected_at_utc=event['timestamp_utc'], request_engine=event['engine'],
            request_purpose=event['purpose'], reservation_nonce=nonce, owner_engine=event['owner_engine'],
            owner_purpose=event['owner_purpose'], owner_age_ms=event['elapsed_ms'],
            owner_acquisition_observed=bool(acquired), owner_acquired_at_utc=acquired[-1]['timestamp_utc'] if acquired else None,
            owner_nonquarantined_release_before_rejection=bool(released_before),
            owner_nonquarantined_release_after_rejection=bool(released_after),
            owner_released_at_utc=released_after[0]['timestamp_utc'] if released_after else None,
            quarantined=event['quarantined'],
            live_owner_chain_observed=bool(acquired) and not released_before and not event['quarantined']))
    return dict(reservation_events=events, HTTP_metadata=requests, closed_owner_correlations=correlations,
                malformed_diagnostic_lines=invalid)


def self_test():
    start = timestamp('2026-10-22T00:00:00Z')
    end = timestamp('2026-10-22T00:00:03Z')
    base = dict(engine='agentic', purpose='health_status', reservation_nonce='a' * 32,
                owner_engine='agentic', owner_purpose='health_status', elapsed_ms=0, quarantined=False, reason=None)
    rows = []
    for second, event, purpose, reason in [(0, 'acquire', 'health_status', None),
                                         (1, 'reject', 'eligibility', 'runtime_busy'),
                                         (2, 'release', 'health_status', None)]:
        value = dict(base, event=event, purpose=purpose, reason=reason, elapsed_ms=second * 1000)
        rows.append(('2026-10-22T00:00:0' + str(second) + 'Z 2026-10-22 00:00:00.000 | INFO     | profile_admission:_diagnostic:100 - nodia_ai_profile_reservation ' + json.dumps(value)).encode())
    result = project(b'\n'.join(rows), start, end)
    assert len(result['reservation_events']) == 3 and result['closed_owner_correlations'][0]['live_owner_chain_observed']
    assert result['closed_owner_correlations'][0]['owner_nonquarantined_release_after_rejection']
    assert 'PRIVATE_LOG_PREFIX' not in json.dumps(result)
    untrusted = rows[0].replace(b'profile_admission:_diagnostic:100', b'agentic_service:provider_payload:100')
    assert not project(untrusted, start, end)['reservation_events']
    return dict(status='passed_offline_parser_and_owner_chain_checks', HTTP_requests=0, provider_generation_requests=0)


def main(args):
    if args.self_test:
        return self_test()
    begin, end = timestamp(args.since), timestamp(args.until)
    assert 0 < (end - begin).total_seconds() <= 600
    assert re.fullmatch('sha256:[a-f0-9]{64}', args.expected_image)
    def inspect():
        result = subprocess.run(['docker', 'inspect', 'nodia-gemini-microservice'], capture_output=True, timeout=10, check=True)
        value = json.loads(result.stdout)[0]
        assert value['State']['Running'] and value['Image'] == args.expected_image
        return dict(id=value['Id'], image=value['Image'], started_at=value['State']['StartedAt'])
    before = inspect()
    result = subprocess.run(['docker', 'logs', '--timestamps', '--since', begin.isoformat(), '--until', end.isoformat(),
                             '--tail', '20000', 'nodia-gemini-microservice'], capture_output=True, timeout=20, check=True)
    assert len(result.stdout) + len(result.stderr) <= 8 * 1024 * 1024
    projection = project(result.stdout + b'\n' + result.stderr, begin, end)
    after = inspect()
    assert before == after
    return dict(scope='closed_profile_reservation_events_and_HTTP_metadata_not_payloads', status='observed',
                source_sha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
                began_at_utc=begin.isoformat(), finished_at_utc=end.isoformat(), native_epoch=before,
                same_native_epoch_after=True, **projection, raw_logs_or_credential_bytes_saved=False,
                requested_since_window_may_omit_an_owner_acquired_before_it=True,
                holder_chain_is_based_on_instrumented_reservation_nonce_not_HTTP_coincidence=True,
                cross_request_origin_not_proven_without_separate_exclusive_trial=True,
                HTTP_requests=0, provider_generation_requests=0, service_changes=0)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--since')
    parser.add_argument('--until')
    parser.add_argument('--expected-image')
    parser.add_argument('--self-test', action='store_true')
    args = parser.parse_args()
    try:
        print(json.dumps(main(args), indent=2))
    except Exception:
        print(json.dumps(dict(status='failed_observation', raw_log_queries_credentials_emitted=False)))
        raise SystemExit(1)
