"""One new Web text control; no attachment proof, retries, or SQL writes."""
import argparse
from datetime import datetime, timezone
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import secrets
import subprocess
from urllib.error import HTTPError
from urllib.parse import urlparse
from urllib.request import Request, build_opener
from uuid import uuid4

HELPER = Path('/opt/nodia/verification/ai38-profile-modalities-r01/nodia-ai-ai38-verifications-modalities.py')
HELPER_SHA = '616077cd82abaad224002a9c8a758d8b8d7e98d0991679d290b7edd380763131'
PACKET = Path('/opt/nodia/verification/ai38-node-candidate01/nodia-server')
PACKET_SHA = '0751160bb8cb146acec9dda21daa0226875a2c40f1c898a9c649e69a9583b8e3'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--work', type=Path, required=True)
    parser.add_argument('--execute-one-new-text-control', action='store_true', required=True)
    args = parser.parse_args()
    assert args.work.parent == Path('/opt/nodia/verification')
    assert args.work.name.startswith('ai38-web-stream-text-') and not args.work.exists()
    assert hashlib.sha256(HELPER.read_bytes()).hexdigest() == HELPER_SHA
    assert hashlib.sha256((PACKET / 'manifest.json').read_bytes()).hexdigest() == PACKET_SHA
    spec = importlib.util.spec_from_file_location('frozen_modalities', HELPER)
    helper = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(helper)
    os.umask(0o077)
    args.work.mkdir(mode=0o700)
    bootstrap = subprocess.run(['/usr/local/bin/node', '--input-type=module', '-', str(PACKET),
        '/opt/nodia/releases/nodia-server-ai15-20261016/.env', 'web'], input=helper.SNAPSHOT.encode(),
        capture_output=True, timeout=60, env={**os.environ, 'NODE_ENV': 'test', 'DOTENV_CONFIG_PATH': '/dev/null', 'RATE_LIMIT_STORAGE': 'memory'})
    assert bootstrap.returncode == 0, 'bootstrap_failed'
    config = json.loads(bootstrap.stdout)
    endpoint = urlparse(config['url'])
    assert endpoint.scheme == 'http' and endpoint.hostname in ('localhost', '127.0.0.1', '::1')
    assert not endpoint.username and not endpoint.password
    assert config['selection']['mode'] == 'token_plan_web'
    attempt = str(uuid4())
    reference = dict(resource_key=config['resource_key'], session_generation=config['session_generation'], operation_ref=attempt)
    selection = config['selection']
    observation = dict(model_id=selection['model_id'], effort_id=selection['effort_id'], configuration_generation=config['configuration_generation'])
    expected = 'NODIA_TEXT_' + secrets.token_hex(16)
    report = dict(schema='ai38-web-stream-text-control-v1', status='running', attempt_id=attempt,
        selection=selection, configuration_generation=config['configuration_generation'], reference=reference,
        started_VM_utc=datetime.now(timezone.utc).isoformat(), maximum_generations=1, generation_requests=0,
        inference_replayed=False, attachments=[], SQL_writes=0, business_effects=0,
        native_acknowledged=False, native_pending_identity=False, semantic_match=False,
        expected_answer_sha256=helper.sha(expected.encode()), helper_sha256=HELPER_SHA,
        source_sha256=helper.sha(Path(__file__).read_bytes()), private_payloads_emitted=False)

    def save():
        (args.work / 'public-report.json').write_text(json.dumps(report, indent=2) + '\n')

    def post(route, body):
        request = Request(config['url'].rstrip('/') + route, data=json.dumps(body).encode(),
            headers={'Content-Type': 'application/json', 'X-Nodia-Service-Token': config['token']}, method='POST')
        try:
            with build_opener(helper.NoRedirect()).open(request, timeout=150) as response:
                raw = response.read(131073)
                assert len(raw) <= 131072
                return response.status, json.loads(raw)
        except HTTPError as error:
            # Never print upstream bodies, headers, exceptions or credentials.
            return error.code, {}

    proof = None
    save()
    try:
        report.update(generation_requests=1, native_pending_identity=True)
        save()
        status, result = post('/nodia-ai/web/turn', {**observation, 'resource_key': reference['resource_key'],
            'session_generation': reference['session_generation'], 'attempt_id': attempt,
            'timeout_seconds': 120, 'canonical_prompt': 'Control sintético sin archivos ni herramientas. Devuelve exactamente este objeto JSON: '
            + json.dumps({'kind': 'answer', 'text': expected})})
        report['http_status'] = status
        if status == 200 and set(result) == {'reply', 'terminal_proof'}:
            proof = result['terminal_proof']
            reply = result['reply']
            if type(reply) is dict and set(reply) == {'kind', 'text'} and reply['kind'] == 'answer' and type(reply['text']) is str:
                report['actual_answer_sha256'] = helper.sha(reply['text'].encode())
                report['semantic_match'] = report['actual_answer_sha256'] == report['expected_answer_sha256']
    except Exception as error:
        report['failure_class'] = type(error).__name__
    finally:
        try:
            base = '/nodia-ai/web/attempts/' + attempt
            if not helper.valid_proof(proof, reference, attempt):
                status, proof = post(base + '/reconcile', reference)
                assert status == 200 and helper.valid_proof(proof, reference, attempt)
            report['native_outcome'] = proof['outcome']
            status, ack = post(base + '/acknowledge', {**reference, 'terminal_proof_id': proof['terminal_proof_id']})
            report['native_acknowledged'] = status == 200 and ack == {'acknowledged': True}
            report['native_pending_identity'] = not report['native_acknowledged']
        except Exception as error:
            report['reconciliation_failure_class'] = type(error).__name__
        report['status'] = 'passed' if report['semantic_match'] and report['native_acknowledged'] and report.get('native_outcome') == 'completed' else 'gates_open'
        report['finished_VM_utc'] = datetime.now(timezone.utc).isoformat()
        save()
    print(json.dumps(report, indent=2))
    return 0 if report['status'] == 'passed' else 1


if __name__ == '__main__':
    raise SystemExit(main())
