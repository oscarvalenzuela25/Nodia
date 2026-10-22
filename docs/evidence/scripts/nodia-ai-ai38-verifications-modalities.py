"""One exact-selection native attachment probe. VM-only; no inference retry.

Secrets travel only through a private parent/child pipe. All generated documents
and speech are synthetic. Each invocation requires a new work directory.
"""
from datetime import datetime, timezone
import argparse
import base64
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import unicodedata
from urllib.error import HTTPError
from urllib.parse import urlparse
from urllib.request import HTTPRedirectHandler, Request, build_opener
from uuid import uuid4


SNAPSHOT = r'''
import fs from 'node:fs'; import assert from 'node:assert/strict';
import {createRequire} from 'node:module'; import {pathToFileURL} from 'node:url';
const [packet,envPath,mode]=process.argv.slice(2), require=createRequire(packet+'/package.json');
require('reflect-metadata'); const env=require('dotenv').parse(fs.readFileSync(envPath));
// envs.config captures process.env on first import, before Transport construction.
process.env.GEMINI_MICROSERVICE_URL=env.GEMINI_MICROSERVICE_URL;
process.env.GEMINI_SERVICE_TOKEN=env.GEMINI_SERVICE_TOKEN;
const {DataSource}=require('typeorm');
const db=await new DataSource({type:'postgres',host:env.POSTGRES_HOST,port:Number(env.POSTGRES_PORT),
 username:env.POSTGRES_USER,password:env.POSTGRES_PASSWORD,database:env.POSTGRES_DB,entities:[],
 synchronize:false,migrationsRun:false,extra:{options:'-c default_transaction_read_only=on'}}).initialize();
try {
 assert.equal((await db.query('SHOW default_transaction_read_only'))[0].default_transaction_read_only,'on');
 const [quiet]=await db.query(`SELECT
 (SELECT count(*)::int FROM nodia_ai_jobs WHERE state IN ('ready','leased','waiting','unknown')) jobs,
 (SELECT count(*)::int FROM nodia_ai_job_attempts WHERE ended_at IS NULL) attempts,
 (SELECT count(*)::int FROM nodia_ai_runtime_slots WHERE state IN ('held','unknown')) slots`);
 assert.ok(Object.values(quiet).every(value=>value===0));
 const rows=await db.query(`SELECT p.id::text,p.fields,p.updated_at,p.is_active,p.use_api_key,p.use_token_plan_web,
 p.use_token_plan_agentic,c.key provider_key,c.is_active catalog_active,c.can_use_api_key,
 c.can_use_token_plan_web,c.can_use_token_plan_agentic FROM ai_providers p
 JOIN ai_provider_catalog c ON c.id=p.catalog_id WHERE c.key='gemini' AND p.is_active AND c.is_active`);
 assert.equal(rows.length,1);
 const load=file=>import(pathToFileURL(packet+'/dist/'+file+'.js').href);
 const [{projectNodiaAiConnection:project},{GeminiNodiaAiAdapterUseCase:Adapter},{NodiaAiAdapterTransport:Transport}]=await Promise.all([
 load('nodia-ai-conversation/use-case/list-nodia-ai-connections.use-case'),
 load('nodia-ai-adapter/use-case/gemini-nodia-ai-adapter.use-case'),load('nodia-ai-adapter/nodia-ai-adapter.service')]);
 const projection=project(rows[0]).modes.find(item=>item.mode==='token_plan_'+mode);
 assert.equal(projection.configuration,'configured'); const selection=projection.configured_selection; assert.ok(selection);
 const observed=await new Adapter(db,new Transport()).observe(selection,AbortSignal.timeout(35000));
 assert.equal(observed.available,true); assert.ok(observed.resourceKey);
 process.stdout.write(JSON.stringify({url:env.GEMINI_MICROSERVICE_URL,token:env.GEMINI_SERVICE_TOKEN,
 provider_key:rows[0].provider_key,selection,configuration_generation:observed.configurationGeneration,resource_key:observed.resourceKey,
 session_generation:observed.sessionGeneration,quiet}));
} finally { await db.destroy(); }
'''

VISUAL_FIXTURE = r'''
import io,json,base64,sys
from PIL import Image,ImageDraw,ImageFont
from pypdf import PdfWriter
from pypdf.generic import DictionaryObject,NameObject,DecodedStreamObject
text=sys.argv[1]
image=Image.new('RGB',(1200,200),'white')
ImageDraw.Draw(image).text((30,45),text,fill='black',font=ImageFont.truetype('/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',72))
png=io.BytesIO();image.save(png,format='PNG')
writer=PdfWriter();page=writer.add_blank_page(width=600,height=200)
font=DictionaryObject({NameObject('/Type'):NameObject('/Font'),NameObject('/Subtype'):NameObject('/Type1'),NameObject('/BaseFont'):NameObject('/Helvetica')})
page[NameObject('/Resources')]=DictionaryObject({NameObject('/Font'):DictionaryObject({NameObject('/F1'):writer._add_object(font)})})
content=DecodedStreamObject();content.set_data(('BT /F1 36 Tf 30 100 Td ('+text+') Tj ET').encode())
page[NameObject('/Contents')]=writer._add_object(content);pdf=io.BytesIO();writer.write(pdf)
print(json.dumps({'png':base64.b64encode(png.getvalue()).decode(),'pdf':base64.b64encode(pdf.getvalue()).decode()}))
'''


def sha(data):
    return hashlib.sha256(data).hexdigest()


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, request, file, code, message, headers, new_url):
        return None


def digest_answer(text, speech):
    if speech:
        text = ' '.join(re.findall(r'[a-z0-9]+', unicodedata.normalize('NFC', text).casefold()))
    return sha(text.strip().encode())


def valid_proof(proof, reference, attempt):
    if not isinstance(proof, dict) or set(proof) != {*reference, 'attempt_id', 'terminal_proof_id', 'process_closed', 'outcome', 'observed_at'}:
        return False
    if any(proof.get(key) != value for key, value in reference.items()) or proof.get('attempt_id') != attempt:
        return False
    if proof.get('process_closed') is not True or proof.get('outcome') not in ('completed', 'abandoned_unknown'):
        return False
    if not isinstance(proof.get('terminal_proof_id'), str) or not re.fullmatch(r'[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}', proof['terminal_proof_id']):
        return False
    try:
        return datetime.fromisoformat(proof['observed_at']).tzinfo is not None
    except (ValueError, TypeError, KeyError):
        return False


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--mode', choices=('web', 'agentic'), required=True)
    parser.add_argument('--format', choices=('png', 'pdf', 'wav', 'webm'), required=True)
    parser.add_argument('--speech', type=Path)
    parser.add_argument('--work', type=Path, required=True)
    parser.add_argument('--execute-one-live', action='store_true', required=True)
    args = parser.parse_args()
    assert args.work.is_absolute() and args.work.parent == Path('/opt/nodia/verification')
    assert re.fullmatch(r'ai38-modalities-[a-z0-9-]{1,50}', args.work.name)
    packet = Path('/opt/nodia/verification/ai38-node-candidate01/nodia-server')
    assert sha((packet / 'manifest.json').read_bytes()) == '0751160bb8cb146acec9dda21daa0226875a2c40f1c898a9c649e69a9583b8e3'
    os.umask(0o077)
    args.work.mkdir(mode=0o700, exist_ok=False)
    observed_process = subprocess.run(['/usr/local/bin/node', '--input-type=module', '-', str(packet),
                                      '/opt/nodia/releases/nodia-server-ai15-20261016/.env', args.mode],
                                     input=SNAPSHOT.encode(), capture_output=True, timeout=60, check=False)
    (args.work / 'private-bootstrap-stderr.log').write_bytes(observed_process.stderr)
    assert observed_process.returncode == 0, 'readonly_exact_selection_observation_failed'
    config = json.loads(observed_process.stdout)
    service_url = urlparse(config['url'])
    assert service_url.scheme in ('http', 'https') and service_url.hostname in ('localhost', '127.0.0.1', '::1')
    assert service_url.username is None and service_url.password is None
    assert re.fullmatch(r'[a-f0-9]{64}', config['token'])
    selection = config['selection']
    assert selection['mode'] == 'token_plan_' + args.mode and config['provider_key'] == 'gemini'
    observation = {'model_id': selection['model_id'], 'effort_id': selection['effort_id'],
                   'configuration_generation': config['configuration_generation']}
    if args.format in ('png', 'pdf'):
        expected = 'NODIA ' + str(uuid4().int % 900000 + 100000)
        generated = subprocess.run(['docker', 'exec', '-i', '--user', '10001:10001', 'nodia-gemini-microservice', 'python', '-', expected],
                                   input=VISUAL_FIXTURE.encode(), capture_output=True, timeout=20, check=True)
        content = base64.b64decode(json.loads(generated.stdout)[args.format], validate=True)
        kind, media = ('image', 'image/png') if args.format == 'png' else ('pdf', 'application/pdf')
    else:
        assert args.speech and args.speech.is_file() and args.speech.stat().st_size < 1024 * 1024
        content = args.speech.read_bytes()
        assert content.startswith(b'RIFF') if args.format == 'wav' else content.startswith(b'\x1aE\xdf\xa3')
        expected, kind, media = 'The blue train arrived early today', 'audio', 'audio/' + args.format
    attempt = str(uuid4())
    reference = {'resource_key': config['resource_key'], 'session_generation': config['session_generation'], 'operation_ref': attempt}
    report = {'stage': 'AI-38', 'scope': 'exact_native_format_semantic_canary', 'status': 'running',
              'started_at_utc': datetime.now(timezone.utc).isoformat(), 'source_sha256': sha(Path(__file__).read_bytes()),
              'selection': selection, 'configuration_generation': config['configuration_generation'],
              'session_generation': config['session_generation'], 'attempt_id': attempt,
              'kind': kind, 'media_type': media, 'file_bytes': len(content), 'file_sha256': sha(content),
              'expected_answer_sha256': digest_answer(expected, kind == 'audio'), 'maximum_generations': 1,
              'generation_requests': 0, 'inference_replayed': False, 'configured_SQL_writes': 0,
              'business_effects': 0, 'provider_login_logout': False, 'semantic_match': False,
              'native_acknowledged': False, 'native_pending_identity': False,
              'raw_provider_output_exported': False, 'quiet_before': config['quiet']}

    def save():
        (args.work / 'public-report.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')

    def post(route, payload):
        request = Request(config['url'].rstrip('/') + route, data=json.dumps(payload, separators=(',', ':')).encode(),
                          headers={'Content-Type': 'application/json', 'X-Nodia-Service-Token': config['token']}, method='POST')
        try:
            with build_opener(NoRedirect()).open(request, timeout=150) as response:
                raw = response.read(131073)
                assert len(raw) <= 131072, 'response_bound'
                return response.status, json.loads(raw)
        except HTTPError as error:
            raw = error.read(4097)
            try:
                value = json.loads(raw) if len(raw) <= 4096 else {}
            except ValueError:
                value = {}
            code = value.get('code') if isinstance(value, dict) else None
            return error.code, {'code': code if isinstance(code, str) and re.fullmatch(r'[a-z_]{1,100}', code) else 'remote_error'}

    proof = None
    save()
    try:
        report['native_pending_identity'] = True
        report['generation_requests'] = 1
        save()
        status, value = post('/nodia-ai/' + args.mode + '/attachments/probe', {
            **observation, 'attempt_id': attempt, 'canonical_prompt': 'Synthetic native format probe.',
            'resource_key': reference['resource_key'], 'session_generation': reference['session_generation'],
            'timeout_seconds': 120, 'attachments': [{'kind': kind, 'media_type': media, 'sha256': sha(content),
                                                    'content_base64': base64.b64encode(content).decode()}],
            'expected_answer_sha256': report['expected_answer_sha256'],
            'answer_normalization': 'speech_words_v1' if kind == 'audio' else 'literal'})
        report['http_status'] = status
        if status == 200 and set(value) == {'reply', 'terminal_proof'}:
            proof = value['terminal_proof']
            assert valid_proof(proof, reference, attempt), 'terminal_proof_mismatch'
            reply = value['reply']
            if isinstance(reply, dict) and set(reply) == {'kind', 'text'} and reply['kind'] == 'answer' and isinstance(reply['text'], str):
                report['actual_answer_sha256'] = digest_answer(reply['text'], kind == 'audio')
                report['semantic_match'] = report['actual_answer_sha256'] == report['expected_answer_sha256']
        else:
            report['error_code'] = value.get('code', 'native_response_invalid') if isinstance(value, dict) else 'native_response_invalid'
    except Exception as error:
        report['failure_class'] = type(error).__name__
    finally:
        try:
            base = '/nodia-ai/' + args.mode + '/attempts/' + attempt
            if not valid_proof(proof, reference, attempt):
                status, proof = post(base + '/reconcile', reference)
                assert status == 200 and valid_proof(proof, reference, attempt), 'native_reconciliation_unresolved'
            report['native_outcome'] = proof['outcome']
            status, ack = post(base + '/acknowledge', {**reference, 'terminal_proof_id': proof['terminal_proof_id']})
            report['native_acknowledged'] = status == 200 and ack == {'acknowledged': True}
            report['native_pending_identity'] = not report['native_acknowledged']
        except Exception as error:
            report['recovery_failure_class'] = type(error).__name__
            (args.work / 'private-recovery.json').write_text(json.dumps({'attempt_id': attempt, 'reference': reference, 'proof': proof}), encoding='utf-8')
        try:
            status, value = post('/nodia-ai/' + args.mode + '/observe', observation)
            report['exact_format_verified_after'] = (status == 200 and value.get('available') is True
                and value.get('resource_key') == reference['resource_key'] and value.get('session_generation') == reference['session_generation']
                and media in value.get('verified_attachment_media_types', []))
        except Exception:
            report['exact_format_verified_after'] = False
        report['status'] = 'passed' if (report['semantic_match'] and report['native_acknowledged']
            and report.get('native_outcome') == 'completed' and report.get('exact_format_verified_after')) else 'gates_open'
        report['finished_at_utc'] = datetime.now(timezone.utc).isoformat()
        save()
        print(json.dumps(report))
    return 0 if report['status'] == 'passed' else 1


if __name__ == '__main__':
    raise SystemExit(main())
