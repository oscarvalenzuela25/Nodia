"""Run an explicit historical regression allowlist against one compiled candidate.

Each harness creates and tears down its own PostgreSQL16 container. No live,
Gemini, R2 or configured-environment harness is included in this allowlist.
"""
from __future__ import annotations
import datetime
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys

attempt, group = sys.argv[1:3]
layout = sys.argv[3] if len(sys.argv) > 3 else 'flat'
assert layout in ('flat', 'workspace')
assert re.fullmatch(r'attempt[0-9]{2}', attempt)
groups = {
    'priority': ['ai21', 'ai22', 'ai23', 'ai24', 'ai25', 'ai26', 'ai27', 'ai28', 'ai29', 'ai29-r01', 'ai30', 'ai31', 'ai33', 'ai34'],
    'foundation': ['ai10', 'ai11', 'ai12', 'ai12-routing', 'ai14', 'ai15', 'ai15-external', 'ai15-artifacts', 'ai15-worker-metadata', 'ai15-quota-gateway', 'ai16-events', 'ai16-observation', 'ai17', 'ai18', 'ai19', 'ai20'],
    'adapter-revalidation': ['ai31', 'ai33'],
    'foundation-revalidation': ['ai12', 'ai12-routing', 'ai14', 'ai15-quota-gateway', 'ai16-events'],
    'context-diagnostic': ['ai15'],
    'full-read-revalidation': ['ai15'],
    'runtime-fix-revalidation': ['ai11', 'ai12', 'ai12-routing', 'ai31', 'ai33', 'ai34', 'ai36'],
    'routing-only': ['ai12-routing'],
}
assert group in groups
root = Path('/opt/nodia/verification/ai36-regressions-' + attempt)
if layout == 'workspace':
    root = root / 'nodia-server'
manifest_file = root / '.tmp/ai36-regressions-stage-manifest.json'
manifest = json.loads(manifest_file.read_text())
os.umask(0o077)

def containers():
    names = subprocess.check_output(['docker', 'ps', '-a', '--format', '{{.Names}}'], text=True).splitlines()
    return set(name for name in names if re.fullmatch(r'template_ai[0-9]+_[0-9]+_[a-f0-9]+', name))

def digest(file):
    return hashlib.sha256(file.read_bytes()).hexdigest()

def extract_result(text):
    for candidate in [text[text.rfind('\n{') + 1:], text]:
        try:
            value = json.loads(candidate)
            if isinstance(value, dict):
                return value
        except ValueError:
            pass
    return None

report = {'stage': 'AI-36', 'scope': 'compiled_historical_regression_revalidation', 'group': group, 'attempt': attempt, 'status': 'running', 'results': [], 'manifest_sha256': digest(manifest_file), 'configured_database_used': False, 'provider_generations': 0, 'storage_cloud_operations': 0, 'services_restarted': False}
destination = root / f'.tmp/ai36-regressions-{group}-{attempt}.json'
assert not destination.exists()
for name in groups[group]:
    path = f'test/nodia-ai-{name}.integration.mjs'
    assert digest(root / path) == manifest['files'][path]
    out_file, err_file = root / f'.tmp/{group}-{name}.stdout', root / f'.tmp/{group}-{name}.stderr'
    assert not out_file.exists() and not err_file.exists()
    started = datetime.datetime.now(datetime.timezone.utc).isoformat()
    before = containers()
    timed_out = False
    with out_file.open('x') as out, err_file.open('x') as err:
        try:
            environment = {'PATH': '/usr/local/bin:/usr/bin:/bin', 'HOME': '/root', 'NODE_ENV': 'test', 'DOTENV_CONFIG_PATH': '/dev/null'}
            if name == 'ai15-quota-gateway':
                environment.update(NODIA_AI_LAB_KNOWLEDGE_ROOT=str(root / 'dist/nodia-ai/knowledge'), NODIA_AI_LAB_KNOWLEDGE_PIN=str(root / 'dist/nodia-ai-context/config/knowledge-pin.json'))
            if group == 'context-diagnostic':
                environment['NODIA_AI_TEST_CONTEXT_DIAGNOSTIC'] = str(root / '.tmp/ai36-full-catalog-context.json')
            completed = subprocess.run(['/usr/local/bin/node', path], cwd=root, stdout=out, stderr=err, env=environment, timeout=300)
            code = completed.returncode
        except subprocess.TimeoutExpired:
            timed_out, code = True, -1
    rawout, rawerr = out_file.read_text(), err_file.read_text()
    remaining = containers() - before
    # Only containers created by this isolated subprocess are eligible for cleanup.
    # Production containers and pre-existing test containers are never selected.
    removed = []
    for container in sorted(remaining):
        assert re.fullmatch(r'template_ai[0-9]+_[0-9]+_[a-f0-9]+', container)
        subprocess.run(['docker', 'rm', '-f', container], check=True, capture_output=True)
        removed.append(container)
    result = {'harness': name, 'status': 'passed' if code == 0 else 'failed', 'exit_code': code, 'timed_out': timed_out, 'started_at_utc': started, 'completed_at_utc': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'test_sha256': manifest['files'][path], 'stdout_sha256': digest(out_file), 'stderr_sha256': digest(err_file), 'assertion_result': extract_result(rawout), 'orphan_disposable_containers_removed': len(removed), 'new_disposable_containers_remaining': len(containers() - before)}
    if code:
        result['error_category'] = next((kind for kind in ['AssertionError', 'UnknownDependenciesException', 'QueryFailedError', 'BadRequestException', 'ForbiddenException', 'ServiceUnavailableException', 'TimeoutError', 'Error:'] if kind in rawerr), 'unclassified_harness_failure')
    report['results'].append(result)
    report['status'] = 'passed' if all(item['status'] == 'passed' for item in report['results']) and len(report['results']) == len(groups[group]) else 'running'
    destination.write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({'stage': 'AI-36', 'harness': name, 'status': result['status'], 'checks': (result['assertion_result'] or {}).get('checks'), 'error_category': result.get('error_category')}), flush=True)
report['status'] = 'passed' if all(item['status'] == 'passed' for item in report['results']) else 'failed'
destination.write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps({'stage': 'AI-36', 'group': group, 'status': report['status'], 'harnesses': len(report['results']), 'failed': [item['harness'] for item in report['results'] if item['status'] != 'passed']}), flush=True)
sys.exit(0 if report['status'] == 'passed' else 1)
