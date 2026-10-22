"""Four independent Web attachment probes; inert until an explicit serialized GO.

Reuse the reviewed generic helper without changing provider/runtime code. No
inference retry; unknown native closure stops before the next independent format.
Historical routing records Web selection/epoch and combined mode-fields hash,
not historical Web configuration/session. Bind those freshly and disclose it.
"""
from datetime import datetime, timezone
import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import subprocess


FORMATS = ('png', 'pdf', 'wav', 'webm')
HELPER_SHA = '616077cd82abaad224002a9c8a758d8b8d7e98d0991679d290b7edd380763131'
MEDIA = {'png': ('image', 'image/png'), 'pdf': ('pdf', 'application/pdf'),
         'wav': ('audio', 'audio/wav'), 'webm': ('audio', 'audio/webm')}
WAV_SHA = 'ded0091808665288f22fcc8947ffa098ef1149bd12a42591708856f50816abf0'
WEBM_SHA = '6faf3d9f76e7216b105a3b9291f9f671dcfb8edee74818108225405be260d8b0'
PACKET = '/opt/nodia/verification/ai38-node-candidate01/nodia-server'
API_ENV = '/opt/nodia/releases/nodia-server-ai15-20261016/.env'

MODE_FIELDS = r'''
import fs from 'node:fs';import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';import {createRequire} from 'node:module';
const [packet,envFile]=process.argv.slice(2),require=createRequire(packet+'/package.json');
require('reflect-metadata');const {DataSource}=require('typeorm'),env=require('dotenv').parse(fs.readFileSync(envFile));
const source=await new DataSource({type:'postgres',host:env.POSTGRES_HOST,port:Number(env.POSTGRES_PORT),
database:env.POSTGRES_DB,username:env.POSTGRES_USER,password:env.POSTGRES_PASSWORD,
entities:[],synchronize:false,migrationsRun:false,extra:{options:'-c default_transaction_read_only=on'}}).initialize();
try{
assert.equal((await source.query('SHOW default_transaction_read_only'))[0].default_transaction_read_only,'on');
const rows=await source.query(`SELECT p.id::text,p.fields,p.updated_at FROM ai_providers p
JOIN ai_provider_catalog c ON c.id=p.catalog_id WHERE c.key='gemini' AND p.is_active AND c.is_active`);
assert.equal(rows.length,1);const row=rows[0],fields={token_plan_web:row.fields.token_plan_web,token_plan_agentic:row.fields.token_plan_agentic};
process.stdout.write(JSON.stringify({connection_id:row.id,mode_fields_sha256:createHash('sha256').update(JSON.stringify(fields)).digest('hex'),
updated_at:row.updated_at.toISOString()}));
}finally{await source.destroy();}
'''


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def epoch():
    template = '{"id":"{{.Id}}","image":"{{.Image}}","started_at_utc":"{{.State.StartedAt}}","running":{{.State.Running}}}'
    result = subprocess.run(['docker', 'inspect', '--format', template, 'nodia-gemini-microservice'],
                            capture_output=True, check=True, timeout=15)
    value = json.loads(result.stdout)
    assert value['running'] is True
    return value


def closed(value):
    return (isinstance(value, dict) and value.get('native_pending_identity') is False
            and value.get('native_acknowledged') is True
            and value.get('native_outcome') in ('completed', 'abandoned_unknown')
            and type(value.get('generation_requests')) is int and value['generation_requests'] == 1
            and value.get('maximum_generations') == 1 and value.get('inference_replayed') is False)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--helper', type=Path, required=True)
    parser.add_argument('--helper-sha', required=True)
    parser.add_argument('--routing-report', type=Path, required=True)
    parser.add_argument('--routing-sha', required=True)
    parser.add_argument('--execute-four-live-sequential', action='store_true', required=True)
    args = parser.parse_args()
    assert args.helper.is_absolute() and args.helper.is_file()
    assert args.routing_report.is_absolute() and args.routing_report.is_file()
    assert args.helper_sha == HELPER_SHA and sha(args.helper) == HELPER_SHA
    assert re.fullmatch(r'[a-f0-9]{64}', args.routing_sha) and sha(args.routing_report) == args.routing_sha
    qualification = json.loads(args.routing_report.read_text(encoding='utf-8'))
    native = qualification['native_result']
    assert qualification['status'] == native['status'] == 'passed'
    assert qualification['phase'] == 'routing' and qualification['native_pending_identity'] is False
    assert native['configured_snapshot_unchanged_after'] is True
    assert native['provider_dispatch_requests'] == 5 and len(native['terminal_ACKs']) == 5
    selected_web = native['selections']['web']
    assert selected_web['mode'] == 'token_plan_web'
    expected_epoch = qualification['container_after']
    assert expected_epoch == qualification['container_before']
    speech = {'wav': Path('/tmp/speech.wav'), 'webm': Path('/tmp/ai38-synthetic-speech.webm')}
    assert sha(speech['wav']) == WAV_SHA and sha(speech['webm']) == WEBM_SHA
    targets = {fmt: Path('/opt/nodia/verification/ai38-modalities-web-' + fmt + '-01') for fmt in FORMATS}
    assert all(not target.exists() for target in targets.values()), 'Preserve every prior attempt; no replay or overwrite'
    work = Path('/opt/nodia/verification/ai38-modalities-web-cohort-01')
    os.umask(0o077)
    work.mkdir(mode=0o700, exist_ok=False)
    specification = importlib.util.spec_from_file_location('ai38_reviewed_format_helper', args.helper)
    helper = importlib.util.module_from_spec(specification)
    specification.loader.exec_module(helper)
    environment = {'PATH': '/usr/local/bin:/usr/bin:/bin', 'HOME': str(work),
                   'NODE_ENV': 'test', 'DOTENV_CONFIG_PATH': '/dev/null', 'RATE_LIMIT_STORAGE': 'memory'}
    initial_epoch = epoch()
    assert initial_epoch == expected_epoch
    report = {'stage': 'AI-38', 'scope': 'four_independent_Web_format_probes_sequential',
              'status': 'running', 'started_at_utc': datetime.now(timezone.utc).isoformat(),
              'source_sha256': sha(Path(__file__)), 'helper_sha256': args.helper_sha,
              'routing_report_sha256': args.routing_sha,
              'historical_Web_selection_and_epoch_compared': True,
              'historical_Web_configuration_session_compared': False,
              'binding_provenance': 'fresh_exact_Web_snapshot_plus_routing_selection_epoch_and_mode_fields_hash',
              'maximum_probe_requests': 4, 'automatic_inference_retries': 0,
              'formats_order': list(FORMATS), 'cases': [], 'epoch_before': initial_epoch,
              'probe_requests_declared_in_reports': 0, 'configured_SQL_writes': 0,
              'services_restarted': False, 'selection_modified': False,
              'audio_source': 'known_synthetic_speech_not_current_physical_microphone',
              'unknown_native_state': False}
    binding = None

    def save():
        (work / 'public-report.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')

    def run_snapshot(script, label, extra):
        snapshot = subprocess.run(['/usr/local/bin/node', '--input-type=module', '-', PACKET, API_ENV, *extra],
                                  input=script.encode(), env=environment, capture_output=True, check=False, timeout=60)
        (work / (label + '-private-snapshot-stderr.log')).write_bytes(snapshot.stderr)
        assert snapshot.returncode == 0, 'Read-only fresh observation failed; no next probe'
        return json.loads(snapshot.stdout)

    def snapshot_binding(label):
        observed = run_snapshot(helper.SNAPSHOT, label, ['web'])
        current = {key: observed[key] for key in ('selection', 'configuration_generation', 'session_generation', 'resource_key', 'provider_key')}
        assert current['provider_key'] == 'gemini' and current['selection'] == selected_web
        # URL/token stay only inside the private parent/child stdout pipe and are
        # never persisted or copied into this closed structural binding.
        return current

    save()
    try:
        mode_fields = run_snapshot(MODE_FIELDS, 'initial-config', [])
        assert mode_fields['connection_id'] == selected_web['connection_id']
        assert mode_fields['mode_fields_sha256'] == native['public_mode_fields_sha256']
        report['mode_fields_binding'] = mode_fields
        for fmt in FORMATS:
            assert epoch() == initial_epoch
            current = snapshot_binding(fmt + '-before')
            if binding is None:
                binding = current
                report['binding'] = binding
            else:
                assert current == binding, 'Web selection/configuration/session/resource changed; no next probe'
            case = {'format': fmt, 'work': str(targets[fmt]), 'status': 'starting', 'native_state': 'not_yet_known'}
            report['cases'].append(case); save()
            argv = ['python3', str(args.helper), '--mode', 'web', '--format', fmt,
                    '--work', str(targets[fmt]), '--execute-one-live']
            if fmt in speech:
                argv.extend(['--speech', str(speech[fmt])])
            with (work / (fmt + '-private-stdout.log')).open('xb') as out, (work / (fmt + '-private-stderr.log')).open('xb') as err:
                try:
                    result = subprocess.run(argv, env=environment, stdout=out, stderr=err, timeout=600)
                    case['exit_code'] = result.returncode
                except subprocess.TimeoutExpired:
                    case['exit_code'] = 124
                    case['status'] = 'driver_timeout_identity_requires_reconciliation_no_replay'
            case_report = targets[fmt] / 'public-report.json'
            if not case_report.is_file():
                case['status'] = 'helper_report_missing_stop_before_next_probe'
                report['unknown_native_state'] = True
                break
            value = json.loads(case_report.read_text(encoding='utf-8'))
            case['report_sha256'] = sha(case_report)
            case['probe_result'] = value
            declared = value.get('generation_requests')
            assert type(declared) is int and 0 <= declared <= 1
            report['probe_requests_declared_in_reports'] += declared
            assert report['probe_requests_declared_in_reports'] <= 4
            same_binding = all(value.get(key) == binding[key] for key in ('selection', 'configuration_generation', 'session_generation'))
            same_format = (value.get('kind'), value.get('media_type')) == MEDIA[fmt]
            same_epoch = epoch() == initial_epoch
            case.update(same_binding=same_binding, same_format=same_format, same_epoch=same_epoch,
                        native_state='closed_acknowledged' if closed(value) else 'unproven_stop')
            if not closed(value) or not same_binding or not same_format or not same_epoch or case.get('exit_code') == 124:
                case['status'] = 'stop_requires_review_no_replay'
                report['unknown_native_state'] = not closed(value)
                break
            assert snapshot_binding(fmt + '-after') == binding
            assert epoch() == initial_epoch
            case['status'] = 'passed' if value.get('status') == 'passed' and case['exit_code'] == 0 else 'failed_format_closed_next_independent_format_allowed'
            save()
        assert run_snapshot(MODE_FIELDS, 'final-config', []) == mode_fields
        report['mode_fields_and_updated_at_unchanged_after'] = True
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
