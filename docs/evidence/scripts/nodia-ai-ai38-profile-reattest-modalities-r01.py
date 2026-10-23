"""Eight sequential native-format canaries after a fresh, acknowledged MCP canary.

Inert on import. --preflight-files hashes local inputs only (no SQL/provider).
Live execution requires the explicit eight-canary flag, a fresh MCP report and
its container-epoch capture. No inference is retried and no old proof is loaded.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess


HELPER_SHA = '616077cd82abaad224002a9c8a758d8b8d7e98d0991679d290b7edd380763131'
PACKET_SHA = '0751160bb8cb146acec9dda21daa0226875a2c40f1c898a9c649e69a9583b8e3'
PACKET = Path('/opt/nodia/verification/ai38-node-candidate01/nodia-server')
API_ENV = '/opt/nodia/releases/nodia-server-ai15-20261016/.env'
FORMATS = {'png': ('image', 'image/png'), 'pdf': ('pdf', 'application/pdf'),
           'wav': ('audio', 'audio/wav'), 'webm': ('audio', 'audio/webm')}
MODES = ('agentic', 'web')

# New harness reads exactly connection2, with the production projection. Only
# the explicit observe argument constructs the transport or contacts a provider.
# Secrets never enter stdout; the frozen one-format helper owns its private pipe.
SNAPSHOT = r'''
import fs from 'node:fs';import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';import {createRequire} from 'node:module';import {pathToFileURL} from 'node:url';
const [packet,envFile,mode]=process.argv.slice(2),require=createRequire(packet+'/package.json');
require('reflect-metadata');const env=require('dotenv').parse(fs.readFileSync(envFile));
assert.notEqual(env.POSTGRES_SSL,'true');assert.ok(['127.0.0.1','localhost','::1','[::1]'].includes(env.POSTGRES_HOST));
const nativeURL=new URL(env.GEMINI_MICROSERVICE_URL);assert.equal(nativeURL.protocol,'http:');assert.equal(nativeURL.username,'');assert.equal(nativeURL.password,'');
assert.ok(['127.0.0.1','localhost','[::1]'].includes(nativeURL.hostname));assert.match(env.GEMINI_SERVICE_TOKEN,/^[a-f0-9]{64}$/i);
process.env.GEMINI_MICROSERVICE_URL=env.GEMINI_MICROSERVICE_URL;process.env.GEMINI_SERVICE_TOKEN=env.GEMINI_SERVICE_TOKEN;
const {DataSource}=require('typeorm');const db=await new DataSource({type:'postgres',host:env.POSTGRES_HOST,port:Number(env.POSTGRES_PORT),
database:env.POSTGRES_DB,username:env.POSTGRES_USER,password:env.POSTGRES_PASSWORD,entities:[],synchronize:false,migrationsRun:false,
extra:{options:'-c default_transaction_read_only=on',connectionTimeoutMillis:5000,statement_timeout:5000}}).initialize();
try{
 assert.equal((await db.query('SHOW default_transaction_read_only'))[0].default_transaction_read_only,'on');
 const [quiet]=await db.query(`SELECT (SELECT count(*)::int FROM nodia_ai_jobs WHERE state IN ('ready','leased','waiting','unknown')) jobs,
 (SELECT count(*)::int FROM nodia_ai_job_attempts WHERE ended_at IS NULL) attempts,
 (SELECT count(*)::int FROM nodia_ai_runtime_slots WHERE state IN ('held','unknown')) slots`);
 assert.ok(Object.values(quiet).every(value=>value===0));
 const rows=await db.query(`SELECT p.id::text,p.fields,p.updated_at,p.is_active,p.use_api_key,p.use_token_plan_web,p.use_token_plan_agentic,
 c.key provider_key,c.is_active catalog_active,c.can_use_api_key,c.can_use_token_plan_web,c.can_use_token_plan_agentic
 FROM ai_providers p JOIN ai_provider_catalog c ON c.id=p.catalog_id WHERE p.id=$1`,[2]);
 assert.equal(rows.length,1);const row=rows[0];assert.equal(row.id,'2');assert.equal(row.provider_key,'gemini');assert.ok(row.is_active&&row.catalog_active);
 // The unchanged frozen helper expects exactly one active Gemini. Assert the
 // same invariant before it runs, instead of letting its broad lookup choose.
 const [count]=await db.query(`SELECT count(*)::int n FROM ai_providers p JOIN ai_provider_catalog c ON c.id=p.catalog_id
 WHERE c.key='gemini' AND p.is_active AND c.is_active`);assert.equal(count.n,1);
 const load=file=>import(pathToFileURL(packet+'/dist/'+file+'.js').href);
 const {projectNodiaAiConnection:project}=await load('nodia-ai-conversation/use-case/list-nodia-ai-connections.use-case');
 const selections={};for(const key of ['agentic','web']){
  const item=project(row).modes.find(value=>value.mode==='token_plan_'+key);
  selections[key]=item?.configuration==='configured'?item.configured_selection:null;
 }
 const fields={token_plan_web:row.fields.token_plan_web,token_plan_agentic:row.fields.token_plan_agentic};
 const output={connection_id:row.id,provider_key:row.provider_key,selections,quiet,
  mode_fields_sha256:createHash('sha256').update(JSON.stringify(fields)).digest('hex'),updated_at:row.updated_at.toISOString()};
 if(mode!=='configuration'){
  assert.ok(['web','agentic'].includes(mode));
  const [{GeminiNodiaAiAdapterUseCase:Adapter},{NodiaAiAdapterTransport:Transport}]=await Promise.all([
   load('nodia-ai-adapter/use-case/gemini-nodia-ai-adapter.use-case'),load('nodia-ai-adapter/nodia-ai-adapter.service')]);
  if(selections[mode]===null){output.observed={available:false,reason:'mode_unconfigured',source:'configured_projection'};}
  else try{
   const value=await new Adapter(db,new Transport()).observe(selections[mode],AbortSignal.timeout(35000));
   assert.equal(typeof value.available,'boolean');
   if(value.available){assert.ok(value.resourceKey);assert.ok(value.sessionGeneration);assert.ok(value.configurationGeneration);}
   output.observed={available:value.available,source:'native_observation',reason:typeof value.reason==='string'&&/^[a-z_]{1,100}$/.test(value.reason)?value.reason:null,
    selection:selections[mode],configuration_generation:value.configurationGeneration,session_generation:value.sessionGeneration,
    resource_key:value.resourceKey,supports_mcp:value.supportsMcp,verified_attachment_media_types:value.verifiedAttachmentMediaTypes};
  }catch(error){
   const {NodiaAiAdapterError}=await load('nodia-ai-adapter/types/nodia-ai-adapter.types');
   if(!(error instanceof NodiaAiAdapterError))throw error;
   output.observed={available:null,source:'adapter_observation_error',reason:typeof error.code==='string'&&/^[a-z_]{1,100}$/.test(error.code)?error.code:null};
  }
 }
 process.stdout.write(JSON.stringify(output));
}finally{await db.destroy();}
'''


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


class ControlError(ValueError):
    """Only our fixed, safe control codes can enter a public report."""


def require(condition, code):
    if not condition:
        raise ControlError(code)


def exact_file(path, digest):
    require(path.is_file() and not path.is_symlink(), 'missing_or_symlink_input')
    require(re.fullmatch(r'[a-f0-9]{64}', digest) is not None and sha(path) == digest, 'input_hash_mismatch')


def verify_packet(packet):
    exact_file(packet / 'manifest.json', PACKET_SHA)
    manifest = json.loads((packet / 'manifest.json').read_text(encoding='utf-8'))
    require(isinstance(manifest.get('files'), dict) and bool(manifest['files']), 'packet_files_missing')
    root = packet.resolve()
    for name, digest in manifest['files'].items():
        path = packet / name
        require(path.resolve().is_relative_to(root), 'packet_path_outside_root')
        exact_file(path, digest)
    return len(manifest['files'])


def closed(value):
    return (isinstance(value, dict) and value.get('native_pending_identity') is False
            and value.get('native_acknowledged') is True and value.get('native_outcome') == 'completed'
            and type(value.get('generation_requests')) is int and value['generation_requests'] == 1
            and value.get('maximum_generations') == 1 and value.get('inference_replayed') is False)


def qualify(report, capture, report_sha):
    native = report.get('native_result', {})
    require(report.get('status') == native.get('status') == 'passed', 'MCP_qualification_failed')
    for key in ('diagnostic_nonce_verified', 'native_terminal_proof_acknowledged', 'supports_mcp_after'):
        require(native.get(key) is True, 'MCP_qualification_proof_missing')
    require(native.get('native_pending_identity') is False, 'MCP_identity_pending')
    require(native.get('configured_database_read_only') is True and native.get('configured_database_modified') is False
            and native.get('configured_selection_modified') is False and native.get('inference_replayed') is False,
            'MCP_qualification_mutated_or_replayed')
    require(type(native.get('real_provider_dispatch_requests')) is int and native['real_provider_dispatch_requests'] == 1
            and type(native.get('maximum_provider_dispatch_requests')) is int and native['maximum_provider_dispatch_requests'] == 1,
            'MCP_qualification_not_one_live_canary')
    diagnostic = native.get('diagnostics', {})
    selection = diagnostic.get('selection', {})
    require(selection.get('connection_id') == '2' and selection.get('mode') == 'token_plan_agentic', 'MCP_wrong_selection')
    require(capture.get('input_report_sha256') == report_sha and capture.get('attempt_id') == diagnostic.get('attempt_id')
            and bool(capture.get('attempt_id')), 'MCP_capture_not_bound')
    require(capture.get('same_container_epoch_after_capture') is True, 'MCP_epoch_not_bound')
    return {key: diagnostic[key] for key in ('selection', 'configuration_generation', 'session_generation')}


def configuration(snapshot):
    require(snapshot.get('connection_id') == '2' and snapshot.get('provider_key') == 'gemini', 'wrong_DB_connection')
    require(snapshot.get('quiet') == {'jobs': 0, 'attempts': 0, 'slots': 0}, 'SQL_not_quiet')
    return {key: snapshot[key] for key in ('connection_id', 'provider_key', 'selections', 'mode_fields_sha256', 'updated_at')}


def available_modes(gates):
    """A failed Web observation cannot authorize a probe or block Agentic proof."""
    require(gates['agentic']['available'] is True, 'fresh_Agentic_MCP_not_available')
    require(all(value['available'] is True or value['available'] is False or value['available'] is None for value in gates.values()),
            'invalid_availability_flag')
    return [mode for mode in MODES if gates[mode]['available'] is True]


def check_case(value, binding, fmt):
    require(closed(value), 'native_state_not_closed_completed_ACK')
    require(all(value.get(key) == binding[key] for key in ('selection', 'configuration_generation', 'session_generation')), 'format_binding_changed')
    require((value.get('kind'), value.get('media_type')) == FORMATS[fmt], 'format_contract_changed')
    require(value.get('status') == 'passed' and value.get('semantic_match') is True
            and value.get('exact_format_verified_after') is True, 'format_semantics_not_verified')


def epoch():
    template = '{"id":"{{.Id}}","image":"{{.Image}}","started_at_utc":"{{.State.StartedAt}}","running":{{.State.Running}}}'
    process = subprocess.run(['docker', 'inspect', '--format', template, 'nodia-gemini-microservice'], capture_output=True, check=True, timeout=15)
    value = json.loads(process.stdout)
    require(value.get('running') is True, 'container_not_running')
    return value


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--helper', type=Path, required=True)
    parser.add_argument('--packet', type=Path, default=PACKET, help='preflight may inspect a local frozen packet')
    parser.add_argument('--wav', type=Path, required=True)
    parser.add_argument('--wav-sha', required=True)
    parser.add_argument('--webm', type=Path, required=True)
    parser.add_argument('--webm-sha', required=True)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument('--preflight-files', action='store_true')
    group.add_argument('--execute-eight-live-sequential', action='store_true')
    parser.add_argument('--work', type=Path)
    parser.add_argument('--qualification-report', type=Path)
    parser.add_argument('--qualification-sha')
    parser.add_argument('--qualification-epoch', type=Path)
    parser.add_argument('--epoch-sha')
    parser.add_argument('--expected-image', help='exact deployed image digest from the FIX acceptance receipt')
    args = parser.parse_args()
    exact_file(args.helper, HELPER_SHA)
    outputs = verify_packet(args.packet)
    exact_file(args.wav, args.wav_sha)
    exact_file(args.webm, args.webm_sha)
    require(args.wav.stat().st_size < 1024 * 1024 and args.wav.read_bytes().startswith(b'RIFF'), 'invalid_WAV')
    require(args.webm.stat().st_size < 1024 * 1024 and args.webm.read_bytes().startswith(b'\x1aE\xdf\xa3'), 'invalid_WebM')
    if args.preflight_files:
        print(json.dumps({'status': 'passed', 'scope': 'files_only', 'packet_outputs_verified': outputs,
                          'SQL_calls': 0, 'provider_calls': 0, 'generations': 0, 'proofs_restored': False}))
        return 0
    require(args.packet == PACKET, 'live_packet_path_changed')
    require(args.work is not None and args.work.is_absolute() and args.work.parent == Path('/opt/nodia/verification')
            and re.fullmatch(r'ai38-modalities-[a-z0-9-]{1,30}', args.work.name) is not None, 'invalid_new_work_directory')
    for path, digest in ((args.qualification_report, args.qualification_sha), (args.qualification_epoch, args.epoch_sha)):
        require(path is not None and digest is not None, 'missing_fresh_MCP_qualification')
        exact_file(path, digest)
    qualified = qualify(json.loads(args.qualification_report.read_text(encoding='utf-8')),
                        json.loads(args.qualification_epoch.read_text(encoding='utf-8')), args.qualification_sha)
    capture = json.loads(args.qualification_epoch.read_text(encoding='utf-8'))
    current_epoch = epoch()
    require(args.expected_image is not None and current_epoch['image'] == args.expected_image, 'deployed_image_not_expected_FIX')
    require((current_epoch['id'], current_epoch['image'], current_epoch['started_at_utc']) == (
        capture['container_id'], capture['container_image'], capture['container_started_at_utc']), 'MCP_container_epoch_changed')
    targets = {(mode, fmt): args.work.parent / (args.work.name + '-' + mode + '-' + fmt) for mode in MODES for fmt in FORMATS}
    require(not args.work.exists() and all(not path.exists() for path in targets.values()), 'prior_attempt_must_not_be_overwritten')
    os.umask(0o077)
    args.work.mkdir(mode=0o700, exist_ok=False)
    environment = {'PATH': '/usr/local/bin:/usr/bin:/bin', 'HOME': str(args.work), 'NODE_ENV': 'test',
                   'DOTENV_CONFIG_PATH': '/dev/null', 'RATE_LIMIT_STORAGE': 'memory'}
    report = {'stage': 'AI-38', 'scope': 'eight_native_format_canaries_after_fresh_MCP', 'status': 'running',
              'started_at_utc': datetime.now(timezone.utc).isoformat(), 'source_sha256': sha(Path(__file__)),
              'helper_sha256': HELPER_SHA, 'packet_sha256': PACKET_SHA, 'qualification_sha256': args.qualification_sha,
              'qualification_epoch_sha256': args.epoch_sha, 'maximum_generations': 8, 'inference_replays': 0,
              'cases': [], 'bindings': {}, 'mode_gates': {}, 'generation_requests_declared': 0, 'unknown_native_state': False,
              'configured_SQL_writes': 0, 'business_effects': 0, 'epoch': current_epoch,
              'audio_source': 'known_synthetic_speech_not_current_physical_microphone'}

    def save():
        (args.work / 'public-report.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')

    serial = 0

    def snapshot(mode):
        nonlocal serial
        require(epoch() == current_epoch, 'provider_epoch_changed')
        serial += 1
        process = subprocess.run(['/usr/local/bin/node', '--input-type=module', '-', str(PACKET), API_ENV, mode],
                                 input=SNAPSHOT.encode(), env=environment, capture_output=True, timeout=60, check=False)
        (args.work / ('private-snapshot-' + str(serial) + '-stderr.log')).write_bytes(process.stderr)
        require(process.returncode == 0, 'readonly_projection_or_observation_failed')
        return json.loads(process.stdout)

    save()
    try:
        initial_config = configuration(snapshot('configuration'))
        report['configuration_before'] = initial_config
        for mode in MODES:
            preflight = snapshot(mode)
            require(configuration(preflight) == initial_config, 'preflight_configured_selection_changed')
            value = preflight['observed']
            report['mode_gates'][mode] = {key: value[key] for key in ('available', 'reason', 'source')}
        allowed_modes = available_modes(report['mode_gates'])
        save()
        for mode in MODES:
            if mode not in allowed_modes:
                continue
            for fmt in FORMATS:
                before = snapshot(mode)
                require(configuration(before) == initial_config, 'configured_selection_changed')
                binding = before['observed']
                require(binding['available'] is True, 'mode_became_unavailable')
                if mode == 'agentic':
                    require(all(binding[key] == qualified[key] for key in qualified), 'fresh_MCP_binding_changed')
                    require(binding['supports_mcp'] is True, 'fresh_MCP_proof_missing')
                else:
                    require(binding['supports_mcp'] is False, 'Web_must_not_claim_MCP')
                identity = {key: binding[key] for key in ('selection', 'configuration_generation', 'session_generation', 'resource_key')}
                if mode in report['bindings']:
                    require(report['bindings'][mode] == identity, 'format_cohort_binding_changed')
                else:
                    report['bindings'][mode] = identity
                case = {'mode': mode, 'format': fmt, 'work': str(targets[mode, fmt]), 'status': 'starting'}
                report['cases'].append(case)
                save()
                exact_file(args.helper, HELPER_SHA)
                argv = ['python3', str(args.helper), '--mode', mode, '--format', fmt,
                        '--work', str(targets[mode, fmt]), '--execute-one-live']
                if fmt in ('wav', 'webm'):
                    argv.extend(['--speech', str(getattr(args, fmt))])
                # The helper owns reconciliation/ACK. Never start a replacement
                # inference when the child exits, times out or leaves no report.
                report['unknown_native_state'] = True
                save()
                with (args.work / (mode + '-' + fmt + '-private-stdout.log')).open('xb') as out, (args.work / (mode + '-' + fmt + '-private-stderr.log')).open('xb') as err:
                    result = subprocess.run(argv, env=environment, stdout=out, stderr=err, timeout=600, check=False)
                path = targets[mode, fmt] / 'public-report.json'
                value = json.loads(path.read_text(encoding='utf-8'))
                case['report_sha256'] = sha(path)
                case['helper_report'] = value
                report['unknown_native_state'] = not closed(value)
                declared = value.get('generation_requests')
                require(type(declared) is int and declared == 1, 'unexpected_generation_count')
                report['generation_requests_declared'] += declared
                require(report['generation_requests_declared'] <= 8, 'generation_budget_exceeded')
                check_case(value, identity, fmt)
                require(isinstance(value.get('attempt_id'), str) and re.fullmatch(r'[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}', value['attempt_id']) is not None,
                        'invalid_attempt_identity')
                require(all(previous is case or previous.get('helper_report', {}).get('attempt_id') != value['attempt_id'] for previous in report['cases']),
                        'repeated_attempt_identity')
                require(result.returncode == 0 and epoch() == current_epoch, 'probe_failed_or_epoch_changed')
                case['status'] = 'passed'
                save()
        report['final_observations'] = {}
        for mode in allowed_modes:
            after = snapshot(mode)
            require(configuration(after) == initial_config, 'configuration_changed_after_probes')
            require(after['observed']['available'] is True, 'final_mode_unavailable')
            require(all(after['observed'][key] == value for key, value in report['bindings'][mode].items()), 'final_binding_changed')
            require(set(media for _, media in FORMATS.values()).issubset(set(after['observed']['verified_attachment_media_types'])), 'final_format_proofs_missing')
            require(after['observed']['supports_mcp'] is (mode == 'agentic'), 'final_MCP_contract_changed')
            report['final_observations'][mode] = after['observed']
        report['configuration_unchanged_after'] = True
        report['status'] = 'passed' if len(allowed_modes) == 2 else 'Agentic_passed_Web_gate_unverified'
    except Exception as error:
        report['status'] = 'stopped_no_replay_no_next_probe'
        report['failure_class'] = type(error).__name__
        if isinstance(error, ControlError):
            report['failure_code'] = str(error)
    finally:
        report['finished_at_utc'] = datetime.now(timezone.utc).isoformat()
        save()
    print(json.dumps(report, indent=2))
    return 0 if report['status'] == 'passed' else 1


if __name__ == '__main__':
    raise SystemExit(main())
