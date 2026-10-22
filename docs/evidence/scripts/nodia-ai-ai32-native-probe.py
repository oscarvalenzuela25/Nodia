"""Explicit private-lab canaries. Never logs credentials, prompt, file or response text.

Run on the configured VM as its operator/root with --live and an explicitly
provided synthetic speech WAV. No fallback, provider mutation or inference retry.
"""
from __future__ import annotations
import argparse
import base64
import hashlib
import json
import subprocess
import time
import re
import unicodedata
import urllib.error
import urllib.request
from pathlib import Path
from uuid import uuid4

RUNTIME = Path('/opt/nodia/releases/nodia-server-ai15-20261016')


def configuration():
    # This stdout is an anonymous private parent/child pipe, never a log or file.
    # The public evidence projection below contains no service key or fields.
    code = r'''
import fs from 'node:fs'; import {createRequire} from 'node:module'; import {createHash} from 'node:crypto';
const runtime='/opt/nodia/releases/nodia-server-ai15-20261016',require=createRequire(runtime+'/package.json');
const env=require('dotenv').parse(fs.readFileSync(runtime+'/.env')); const {Client}=require('pg');
const db=new Client({host:env.POSTGRES_HOST,port:Number(env.POSTGRES_PORT),database:env.POSTGRES_DB,user:env.POSTGRES_USER,password:env.POSTGRES_PASSWORD});
function canonical(x){if(x instanceof Date)return x.toISOString();if(Array.isArray(x))return x.map(canonical);if(x&&typeof x==='object')return Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])]));return x;}
await db.connect();try{
const quiet=(await db.query(`SELECT (SELECT count(*)::int FROM nodia_ai_jobs WHERE state IN ('ready','leased','waiting','unknown')) pending_jobs,(SELECT count(*)::int FROM nodia_ai_job_attempts WHERE ended_at IS NULL) open_attempts,(SELECT count(*)::int FROM nodia_ai_runtime_slots WHERE state IN ('held','unknown')) held_or_unknown_slots`)).rows[0];
const rows=(await db.query(`SELECT p.id::text,p.fields,p.updated_at,p.use_token_plan_web,p.use_token_plan_agentic,c.key provider_key FROM ai_providers p JOIN ai_provider_catalog c ON c.id=p.catalog_id WHERE c.key='gemini' AND p.is_active AND c.is_active`)).rows;
if(rows.length!==1)throw Error('ambiguous configured connection');const row=rows[0];
const selections={};for(const engine of ['web','agentic']){const mode='token_plan_'+engine,fields=row.fields?.[mode];if(row['use_'+mode]!==true||typeof fields?.selected_model!=='string'||!fields.selected_model.trim())continue;
const model=fields.selected_model,effort=fields.thinking_levels?.[model]??fields.thinking_level??null;
selections[engine]={connection_id:row.id,model_id:model,effort_id:effort,configuration_generation:createHash('sha256').update(JSON.stringify(canonical({connection_id:row.id,provider_key:row.provider_key,mode,fields:row.fields?.[mode]??null,updated_at:row.updated_at,enabled:true}))).digest('hex')};}
process.stdout.write(JSON.stringify({quiet,selections,url:env.GEMINI_MICROSERVICE_URL,token:env.GEMINI_SERVICE_TOKEN}));
}finally{await db.end();}
'''
    value = subprocess.run(['/usr/local/bin/node', '--input-type=module'], input=code, text=True, capture_output=True, cwd=RUNTIME, check=False, timeout=20)
    if value.returncode:
        raise RuntimeError('private_configuration_observation_failed')
    result = json.loads(value.stdout)
    if any(result['quiet'][k] != 0 for k in ['pending_jobs', 'open_attempts', 'held_or_unknown_slots']):
        raise RuntimeError('configured_runtime_not_quiet')
    return result


def fixtures(speech: Path):
    # Generate visual files using the candidate's installed decoders, without a
    # provider call, runtime secret or external download.
    code = r'''
import base64,io,json,sys
from PIL import Image,ImageDraw,ImageFont
from pypdf import PdfWriter
from pypdf.generic import DictionaryObject,NameObject,DecodedStreamObject
text=sys.argv[1]
image=Image.new('RGB',(1200,200),'white');draw=ImageDraw.Draw(image)
font=ImageFont.truetype('/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',72)
draw.text((30,45),text,fill='black',font=font);png=io.BytesIO();image.save(png,format='PNG')
writer=PdfWriter();page=writer.add_blank_page(width=600,height=200)
fontdef=DictionaryObject({NameObject('/Type'):NameObject('/Font'),NameObject('/Subtype'):NameObject('/Type1'),NameObject('/BaseFont'):NameObject('/Helvetica')})
page[NameObject('/Resources')]=DictionaryObject({NameObject('/Font'):DictionaryObject({NameObject('/F1'):writer._add_object(fontdef)})})
content=DecodedStreamObject();content.set_data(('BT /F1 36 Tf 30 100 Td ('+text+') Tj ET').encode())
page[NameObject('/Contents')]=writer._add_object(content);pdf=io.BytesIO();writer.write(pdf)
print(json.dumps({'image':base64.b64encode(png.getvalue()).decode(),'pdf':base64.b64encode(pdf.getvalue()).decode()}))
'''
    marker = 'NODIA '+str(uuid4().int % 900000 + 100000)
    proc = subprocess.run(['docker', 'exec', '-i', '--user', '10001:10001', 'nodia-gemini-microservice', 'python', '-', marker], input=code, text=True, capture_output=True, timeout=20)
    if proc.returncode:
        raise RuntimeError('synthetic_fixture_generation_failed')
    visual = json.loads(proc.stdout)
    return {
        'image': (base64.b64decode(visual['image']), 'image/png', marker),
        'pdf': (base64.b64decode(visual['pdf']), 'application/pdf', marker),
        'audio': (speech.read_bytes(), 'audio/wav', 'The purple lantern is eleven.'),
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--live', action='store_true', required=True)
    parser.add_argument('--synthetic-speech-wav', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--engines', nargs='+', choices=['web', 'agentic'], default=['web', 'agentic'])
    parser.add_argument('--kinds', nargs='+', choices=['image', 'pdf', 'audio'], default=['image', 'pdf', 'audio'])
    args = parser.parse_args()
    config = configuration()
    data = fixtures(args.synthetic_speech_wav)
    report = {'stage': 'AI-32', 'scope': 'real_gemini_native_synthetic_modalities', 'status': 'running', 'observed_at_utc': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'maximum_generations': len(args.engines)*len(args.kinds), 'generation_requests': 0, 'probes': [], 'credentials_logged': False, 'provider_configuration_modified': False, 'provider_login_logout_requested': False, 'database_modified': False, 'automatic_inference_retries': 0}

    def save():
        args.output.write_text(json.dumps(report, indent=2)+'\n')

    def post(path, payload):
        raw = json.dumps(payload, separators=(',', ':')).encode()
        request = urllib.request.Request(config['url'].rstrip('/')+path, data=raw, headers={'Content-Type': 'application/json', 'X-Nodia-Service-Token': config['token']}, method='POST')
        try:
            with urllib.request.urlopen(request, timeout=150) as response:
                raw = response.read(131073)
                if len(raw) > 131072:
                    raise RuntimeError('response_exceeds_bound')
                return response.status, json.loads(raw)
        except urllib.error.HTTPError as error:
            raw = error.read(4097)
            value = json.loads(raw) if len(raw) <= 4096 else {}
            return error.code, {'code': value.get('code', 'remote_error')}

    save()
    stop = False
    for engine in args.engines:
        selection = config['selections'].get(engine)
        if not selection:
            report['probes'].append({'engine': engine, 'status': 'configuration_missing', 'verified': False})
            continue
        observation_payload = {key: selection[key] for key in ['model_id', 'effort_id', 'configuration_generation']}
        status, observed = post('/nodia-ai/'+engine+'/observe', observation_payload)
        if status != 200 or observed.get('available') is not True:
            report['probes'].append({'engine': engine, 'status': 'runtime_unavailable', 'reason': observed.get('reason') or observed.get('code'), 'verified': False})
            save()
            continue
        for kind in args.kinds:
            if stop:
                break
            content, media, expected = data[kind]
            attempt = str(uuid4())
            reference = {'resource_key': observed['resource_key'], 'session_generation': observed['session_generation'], 'operation_ref': attempt}
            normalization = 'speech_words_v1' if kind == 'audio' else 'literal'
            def digest_answer(text):
                value = ' '.join(re.findall(r'[a-z0-9]+', unicodedata.normalize('NFC', text).casefold())) if normalization == 'speech_words_v1' else text.strip()
                return hashlib.sha256(value.encode()).hexdigest()
            payload = {**observation_payload, 'attempt_id': attempt, 'canonical_prompt': 'Synthetic verification. The server substitutes its fixed probe instruction.', 'resource_key': observed['resource_key'], 'session_generation': observed['session_generation'], 'timeout_seconds': 120,
                'attachments': [{'kind': kind, 'media_type': media, 'sha256': hashlib.sha256(content).hexdigest(), 'content_base64': base64.b64encode(content).decode()}], 'expected_answer_sha256': digest_answer(expected), 'answer_normalization': normalization}
            item = {'engine': engine, 'kind': kind, 'model_id': selection['model_id'], 'effort_id': selection['effort_id'], 'configuration_generation': selection['configuration_generation'], 'session_generation': observed['session_generation'], 'attempt_id': attempt, 'file_bytes': len(content), 'file_sha256': hashlib.sha256(content).hexdigest(), 'expected_answer_sha256': payload['expected_answer_sha256'], 'verified': False, 'native_acknowledged': False}
            item['answer_normalization'] = normalization
            report['probes'].append(item)
            report['generation_requests'] += 1
            print(json.dumps({'engine': engine, 'kind': kind, 'state': 'one_generation_requested'}), flush=True)
            save()
            started = time.monotonic()
            try:
                status, result = post('/nodia-ai/'+engine+'/attachments/probe', payload)
                item['http_status'] = status
                item['elapsed_seconds'] = round(time.monotonic()-started, 2)
                proof = result.get('terminal_proof')
                if status == 200:
                    answer = result.get('reply', {}).get('text')
                    item['answer_sha256'] = digest_answer(answer) if isinstance(answer, str) else None
                    item['semantic_canary_matches'] = item['answer_sha256'] == item['expected_answer_sha256']
                    item['status'] = 'completed' if item['semantic_canary_matches'] else 'canary_mismatch'
                else:
                    item['status'] = 'native_rejected'
                    item['error_code'] = result.get('code')
                if proof is None:
                    reconcile_status, proof = post('/nodia-ai/'+engine+'/attempts/'+attempt+'/reconcile', reference)
                    item['reconciliation_http_status'] = reconcile_status
                    if reconcile_status != 200:
                        stop = True
                        item['status'] = 'requires_reconciliation'
                        save()
                        break
                item['native_outcome'] = proof['outcome']
                ack = {**reference, 'terminal_proof_id': proof['terminal_proof_id']}
                ack_status, ack_result = post('/nodia-ai/'+engine+'/attempts/'+attempt+'/acknowledge', ack)
                item['native_acknowledged'] = ack_status == 200 and ack_result.get('acknowledged') is True
                status_after, after = post('/nodia-ai/'+engine+'/observe', observation_payload)
                item['verified'] = status_after == 200 and after.get('available') is True and kind in after.get('verified_modalities', [])
                if item['native_outcome'] != 'completed' or not item['native_acknowledged']:
                    stop = True
            except Exception as error:
                item['status'] = 'transport_result_uncertain'
                item['safe_error_type'] = type(error).__name__
                stop = True
            save()
            print(json.dumps({'engine': engine, 'kind': kind, 'state': item['status'], 'verified': item['verified'], 'native_acknowledged': item['native_acknowledged']}), flush=True)
    after = configuration()
    report['quiet_after'] = after['quiet']
    report['status'] = 'passed' if len(report['probes']) == report['maximum_generations'] and all(item.get('verified') and item.get('native_acknowledged') for item in report['probes']) else 'gates_open'
    report['completed_at_utc'] = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
    save()
    print(json.dumps({'status': report['status'], 'generation_requests': report['generation_requests'], 'verified': sum(item['verified'] for item in report['probes'])}), flush=True)


if __name__ == '__main__':
    main()
