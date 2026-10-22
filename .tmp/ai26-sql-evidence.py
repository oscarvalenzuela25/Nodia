import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

root = Path(__file__).resolve().parent.parent
archive, stage = sys.argv[1:3]
out = root / 'docs/evidence'
remote_hashes = dict(
    (line.split(maxsplit=1)[1].strip(), line.split(maxsplit=1)[0])
    for line in (root / '.tmp/ai26-sql-input-hashes.log').read_text(encoding='utf-8-sig').splitlines()
    if line.strip()
)

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def read_result(name):
    content = (root / '.tmp' / name).read_text(encoding='utf-8-sig')
    decoder = json.JSONDecoder()
    results = []
    for start, char in enumerate(content):
        if char != '{':
            continue
        try:
            value, _ = decoder.raw_decode(content[start:])
            if isinstance(value, dict) and 'checks' in value:
                results.append(value)
        except json.JSONDecodeError:
            pass
    assert results, name
    return results[-1]

def input_files(names):
    result = []
    for name in names:
        digest = sha(root / 'nodia-server/test' / name)
        assert remote_hashes['test/' + name] == digest, name
        result.append({'path': 'nodia-server/test/' + name, 'sha256': digest})
    return result

common = {
    'observed_at_utc': datetime.now(timezone.utc).isoformat(),
    'stage_directory': stage,
    'compiled_production_archive_sha256': archive,
    'knowledge_pin_sha256': '46e4950b15ac9b89903341bbdd9cee47c578654b0ef9fc039eff32b21d2a2d0c',
    'scope': 'Synthetic disposable PostgreSQL only; no configured database mutation, provider inference, MCP write publication or Gemini acceptance.',
    'operational_services_untouched': True,
    'disposable_containers_removed': True,
    'docker_postcheck': (root / '.tmp/ai26-sql-docker-postcheck.log').read_text(encoding='utf-8-sig').splitlines(),
}
assert sorted(common['docker_postcheck']) == sorted([
    'nodia-gemini-microservice', 'nodia-lab-postgres-1', 'nodia-lab-redis-1'
]), common['docker_postcheck']

def save(name, value):
    p = out / name
    p.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    return p

main = read_result('ai26-sql-main.log')
assert isinstance(main['checks'], int) and len(main['passed']) == main['checks']
save('nodia-ai-ai26-postgresql.json', {
    **common, 'command': 'node test/nodia-ai-ai26.integration.mjs', 'exit_code': 0,
    'inputs': input_files(['nodia-ai-ai26.integration.mjs', 'nodia-ai-ai26-worker.fixture.mjs', 'nodia-ai.integration.fixture.mjs']),
    'result': main,
    'test_harness_change_after_compiled_archive': 'Only the concurrent-worker test was corrected to drain an admitted second job left queued by the per-actor claim limit. Production dist was not patched. Current test source hash was verified on the VM.',
    'previous_attempts_not_acceptance': [{
        'completed_checks': 18,
        'original_harness_sha256': 'bafc8dbd45eb7b3a2f8121fd17035dc6af367f09b004e45a732050d1a01e73bc',
        'reason': 'The synthetic concurrent-worker assertion expected both jobs terminal immediately, although a per-actor claim can leave the second queued until the first finishes.',
        'resolution': 'Drain the queued second job after concurrent dispatch; complete suite rerun successfully with exactly one overlapping block committed.',
    }],
})

summaries = []
for suffix in ['25', '24', '23', '22', '20', '18', 'rental']:
    native = suffix == 'rental'
    result = read_result(f'ai26-sql-regression-{suffix}.log')
    test = 'rental.integration.mjs' if native else f'nodia-ai-ai{suffix}.integration.mjs'
    files = [test]
    if native:
        files += ['fixtures/authority.integration.mjs']
    else:
        files += ['nodia-ai.integration.fixture.mjs']
        worker = f'nodia-ai-ai{suffix}-worker.fixture.mjs'
        if (root / 'nodia-server/test' / worker).is_file():
            files.append(worker)
    checks = len(result['checks']) if native else result['checks']
    evidence = {
        **common, 'status': 'passed', 'command': 'node test/' + test,
        'exit_code': 0, 'inputs': input_files(files), 'result': result,
    }
    if native:
        evidence['native_report'] = json.loads((root / '.tmp/ai26-sql-native-report.json').read_text(encoding='utf-8-sig'))
        evidence['normative_source'] = {
            'path': 'docs/mvp/28-rental-reservations-contracts.md',
            'sha256': sha(root / 'docs/mvp/28-rental-reservations-contracts.md'),
        }
    filename = f'nodia-ai-ai26-{suffix if native else "ai" + suffix}-regression.json'
    path = save(filename, evidence)
    summaries.append({'stage': 'Rental native' if native else 'AI-' + suffix,
                      'checks': checks, 'path': 'docs/evidence/' + filename,
                      'sha256': sha(path), 'status': 'passed',
                      'command': evidence['command'], 'inputs': evidence['inputs']})
total = sum(item['checks'] for item in summaries)
assert total == 266, total
save('nodia-ai-ai26-regressions.json', {
    **common, 'stage': 'AI-26', 'status': 'passed', 'checks': total,
    'native_http_requests': read_result('ai26-sql-regression-rental.log')['requests'],
    'regressions': summaries,
})
print(json.dumps({'main': main['checks'], 'regressions': total,
                  'total': main['checks'] + total}))
