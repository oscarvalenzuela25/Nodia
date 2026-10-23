"""Read-only metadata timeline from the already pinned AI-38 HTTP cursor.

No UI/API call, response body, arbitrary query value, identity or raw log output.
The historic observer supplies bounded/inode/anchor checks; only its projection
is replaced in memory. SQL-derived completion timestamps are optional explicit
inputs for temporal correlation and do not prove HTTP body semantics.
"""
import argparse
from collections import Counter
from datetime import datetime, timezone
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import sys
from urllib.parse import parse_qs

OBSERVER_SHA = '1587fd82495866362cc77d88b469ff4a0bc789bbc80d83356eb4223eeff63e9d'
CURSOR_SHA = '3401daa28e9a7d4b77ab20bde6fad1999eaafdf1d05ecf00a46a501e3baa91ca'
CHAT_SHA = 'ceb08fb97c86411d5e49d7ba5ed14a6eee471675b060ee13668b94b8869a96cb'
CURSOR = Path('/opt/nodia/verification/ai38-owner-ui-client-r01/private/http-cursor.json')
LINE = re.compile(rb'^\S+ \S+ \S+ \[([^\]\r\n]+)\] "((?:[^"\\\r\n]|\\.)*)" ([0-9]{3}) (?:[0-9]+|-)(?: |$)')
REQUEST = re.compile(rb'^([A-Z]+) ([^ ]+) HTTP/[0-9.]+$')


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def timestamp(value):
    result = datetime.fromisoformat(value.replace('Z', '+00:00'))
    if result.tzinfo is None:
        raise ValueError('explicit_timezone_required')
    return result.astimezone(timezone.utc)


def projection(data, conversation_id, *_):
    rows, counts = [], Counter()
    ignored = invalid = 0
    expected_message = '/api/v1/nodia-ai/conversations/' + conversation_id + '/messages'
    for line in data.splitlines():
        match = LINE.match(line)
        request = REQUEST.fullmatch(match[2]) if match else None
        if not request:
            invalid += 1
            continue
        try:
            method, target = request[1].decode('ascii'), request[2].decode('ascii')
        except UnicodeDecodeError:
            ignored += 1
            continue
        path, _, query = target.partition('?')
        eligibility = re.fullmatch(r'/api/v1/nodia-ai/connections/([0-9]+)/eligibility', path)
        if method == 'GET' and eligibility:
            label = 'connection_eligibility'
        elif method == 'POST' and path == expected_message:
            label = 'acceptance_message_admission'
        else:
            ignored += 1
            continue
        stamp = datetime.strptime(match[1].decode('ascii'), '%d/%b/%Y:%H:%M:%S %z').astimezone(timezone.utc)
        row = dict(timestamp_utc=stamp.isoformat(), method=method, endpoint=label, status=int(match[3]))
        if eligibility:
            # Exact target booleans only; arbitrary parameter names/values and
            # unknown connection/model/effort identifiers never leave memory.
            values = parse_qs(query, keep_blank_values=True, strict_parsing=False, max_num_fields=64)
            row['known_connection_matches'] = eligibility[1] == '2'
            row['known_mode_matches'] = values.get('mode') == ['token_plan_agentic']
            row['known_model_matches'] = values.get('model_id') == ['gemini-3.8-flash-high']
            row['known_effort_matches'] = values.get('effort_id') == ['high']
            row['known_selection_exact_match'] = all(row[key] for key in (
                'known_connection_matches', 'known_mode_matches', 'known_model_matches', 'known_effort_matches'))
        rows.append(row)
        counts[(label, method, int(match[3]))] += 1
    rows.sort(key=lambda row: row['timestamp_utc'])
    return dict(timeline=rows, matched_lines=len(rows), ignored_lines=ignored, unparseable_lines=invalid,
                counts=[dict(endpoint=k[0], method=k[1], status=k[2], count=v) for k, v in sorted(counts.items())])


def self_test():
    chat = '00000000-0000-4000-8000-000000000001'
    def line(method, target, second, status):
        return ('PRIVATE_ADDRESS PRIVATE_USER - [22/Oct/2026:17:54:' + str(second).zfill(2) + ' +0000] "' +
                method + ' ' + target + ' HTTP/1.1" ' + str(status) + ' 2 "PRIVATE_REFERER" "PRIVATE_AGENT"\n').encode()
    data = (line('GET', '/api/v1/nodia-ai/connections/2/eligibility?mode=token_plan_agentic&model_id=gemini-3.8-flash-high&effort_id=high&secret=NEVER_OUTPUT', 6, 200) +
            line('POST', '/api/v1/nodia-ai/conversations/' + chat + '/messages', 7, 202) +
            line('POST', '/api/v1/nodia-ai/conversations/00000000-0000-4000-8000-000000000002/messages', 8, 202) +
            line('GET', '/api/v1/nodia-ai/connections/99/eligibility?mode=PRIVATE_MODE&model_id=PRIVATE_MODEL', 9, 200))
    result = projection(data, chat)
    assert len(result['timeline']) == 3 and result['ignored_lines'] == 1
    assert result['timeline'][0]['known_selection_exact_match'] is True
    assert result['timeline'][1]['endpoint'] == 'acceptance_message_admission'
    assert result['timeline'][2]['known_selection_exact_match'] is False
    output = json.dumps(result)
    assert all(secret not in output for secret in ('NEVER_OUTPUT', 'PRIVATE_', chat, 'model_id=', '/api/v1/'))
    return dict(status='passed_offline_parser_checks', network_requests=0, provider_requests=0, services_changed=False)


def run(args):
    if args.self_test:
        return self_test()
    observer = Path(args.observer)
    if sha(observer) != OBSERVER_SHA or sha(CURSOR) != CURSOR_SHA:
        raise ValueError('source_or_cursor_pin_mismatch')
    spec = importlib.util.spec_from_file_location('pinned_http_metadata_observer', observer)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    # No entry point executes on import. Only end() reads the already-owned
    # cursor and log, retaining all original inode/anchor/rotation checks.
    module.project = projection
    result = module.end(argparse.Namespace(cursor=str(CURSOR), proposal_id=None, execution_id=None, movement_id=None))
    if result['acceptance_conversation_sha256'] != CHAT_SHA:
        raise ValueError('chat_pin_mismatch')
    correlations = []
    for label, raw in (('A', args.completed_a), ('B', args.completed_b)):
        if raw is None:
            continue
        completed = timestamp(raw)
        rows = [row for row in result['timeline'] if row['endpoint'] == 'connection_eligibility' and
                row['known_selection_exact_match'] and timestamp(row['timestamp_utc']) > completed]
        correlations.append(dict(turn=label, externally_supplied_completed_at_utc=completed.isoformat(),
                                 strictly_later_known_selection_GET_count=len(rows),
                                 first_strictly_later_GET_utc=rows[0]['timestamp_utc'] if rows else None))
    result.update(timeline_schema='ai38-turn-http-timeline-v1', timeline_source_sha256=sha(Path(__file__)),
                  status='bounded_chronological_metadata_observed_not_response_payload_acceptance',
                  supplied_completion_correlations=correlations,
                  timestamp_precision='nginx_seconds; same-second events are not ordered against SQL subsecond timestamps',
                  query_parameter_values_emitted=False, raw_request_targets_emitted=False,
                  HTTP_body_semantics_or_eligibility_reason_observed=False)
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--observer', default='/opt/nodia/verification/ai38-owner-ui-client-r01/http-observer.py')
    parser.add_argument('--completed-a')
    parser.add_argument('--completed-b')
    parser.add_argument('--self-test', action='store_true')
    arguments = parser.parse_args()
    try:
        value = run(arguments)
        print(json.dumps(value, indent=2))
    except Exception:
        print(json.dumps(dict(status='failed_observation', raw_log_queries_credentials_emitted=False)))
        sys.exit(1)
