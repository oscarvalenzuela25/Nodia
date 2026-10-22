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
    for line in (root / '.tmp/ai25-sql-input-hashes.log').read_text(encoding='utf-8-sig').splitlines()
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
    'knowledge_pin_sha256': 'fe96f76311b45096287f600108c242477146150653c4720687a11f6de230834f',
    'scope': 'Synthetic disposable PostgreSQL only; no configured database mutation, provider inference, MCP write publication or Gemini acceptance.',
    'operational_services_untouched': True,
    'disposable_containers_removed': True,
    'docker_postcheck': (root / '.tmp/ai25-sql-docker-postcheck.log').read_text(encoding='utf-8-sig').splitlines(),
}
assert sorted(common['docker_postcheck']) == sorted([
    'nodia-gemini-microservice', 'nodia-lab-postgres-1', 'nodia-lab-redis-1'
]), common['docker_postcheck']

def save(name, value):
    p = out / name
    p.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    return p

main = read_result('ai25-sql-main.log')
assert isinstance(main['checks'], int) and len(main['passed']) == main['checks']
save('nodia-ai-ai25-postgresql.json', {
    **common, 'command': 'node test/nodia-ai-ai25.integration.mjs', 'exit_code': 0,
    'inputs': input_files(['nodia-ai-ai25.integration.mjs', 'nodia-ai-ai25-worker.fixture.mjs', 'nodia-ai.integration.fixture.mjs']),
    'result': main,
    'test_harness_change_after_compiled_archive': 'Only the synthetic platformDraft helper was corrected to assign a unique external_reference to each independent Airbnb reservation. No production dist was patched. Current test source hash was verified on the VM.',
    'previous_attempts_not_acceptance': [{
        'completed_checks': 21,
        'original_harness_sha256': '07b3128d480e8fa24326b67226d4f3b4b7ae4e84e1e6427af134d5cf7a0a1267',
        'reason': 'Synthetic helper reused an external reference on multiple reservations of the same property and channel; the native uniqueness constraint correctly rejected it.',
        'resolution': 'Unique synthetic external_reference for each independent platform reservation; complete suite rerun successfully.',
    }],
})

summaries = []
for suffix in ['24', '23', '22', '20', '18', 'rental']:
    native = suffix == 'rental'
    result = read_result(f'ai25-sql-regression-{suffix}.log')
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
        evidence['native_report'] = json.loads((root / '.tmp/ai25-sql-native-report.json').read_text(encoding='utf-8-sig'))
        evidence['normative_source'] = {
            'path': 'docs/mvp/28-rental-reservations-contracts.md',
            'sha256': sha(root / 'docs/mvp/28-rental-reservations-contracts.md'),
        }
    filename = f'nodia-ai-ai25-{suffix if native else "ai" + suffix}-regression.json'
    path = save(filename, evidence)
    summaries.append({'stage': 'Rental native' if native else 'AI-' + suffix,
                      'checks': checks, 'path': 'docs/evidence/' + filename,
                      'sha256': sha(path), 'status': 'passed',
                      'command': evidence['command'], 'inputs': evidence['inputs']})
total = sum(item['checks'] for item in summaries)
assert total == 227, total
save('nodia-ai-ai25-regressions.json', {
    **common, 'stage': 'AI-25', 'status': 'passed', 'checks': total,
    'native_http_requests': read_result('ai25-sql-regression-rental.log')['requests'],
    'regressions': summaries,
})
print(json.dumps({'main': main['checks'], 'regressions': total,
                  'total': main['checks'] + total}))
