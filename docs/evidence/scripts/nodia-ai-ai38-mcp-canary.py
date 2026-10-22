"""One explicit, non-business MCP attestation; no activation, model replacement or inference retry."""
from datetime import datetime, timezone
from pathlib import Path
import hashlib
import json
import os
import subprocess
import sys

candidate = Path(sys.argv[1])
expected_manifest = sys.argv[2]
selection_file = Path(sys.argv[3])
assert candidate.is_absolute() and candidate.resolve().is_relative_to('/opt/nodia/verification')
assert selection_file.is_absolute() and selection_file.is_file()
sha = lambda data: hashlib.sha256(data).hexdigest()
manifest_file = candidate / 'manifest.json'
assert sha(manifest_file.read_bytes()) == expected_manifest
manifest = json.loads(manifest_file.read_text())
harness = candidate / 'test/nodia-ai-ai15-live-attest.mjs'
assert sha(harness.read_bytes()) == manifest['files']['test/nodia-ai-ai15-live-attest.mjs']
assert not (candidate / '.env').exists()
os.umask(0o077)
work = Path('/opt/nodia/verification/ai38-mcp-canary-r01')
work.mkdir(mode=0o700)
env = dict(os.environ)
env.update(NODIA_AI_ALLOW_LIVE='yes', NODIA_AI_ATTEST_CONFIGURED_DB='read_only',
           NODIA_AI_LAB_API_ENV='/opt/nodia/releases/nodia-server-ai15-20261016/.env',
           NODIA_AI_LAB_SELECTION_JSON=str(selection_file),
           NODIA_AI_LAB_REPORT_JSON=str(work / 'native-report.json'))
started = datetime.now(timezone.utc).isoformat()
try:
    result = subprocess.run(['/usr/local/bin/node', str(harness)], cwd=candidate,
                            env=env, capture_output=True, timeout=300)
    (work / 'stdout.log').write_bytes(result.stdout)
    (work / 'stderr.log').write_bytes(result.stderr)
    report = json.loads((work / 'native-report.json').read_text()) if (work / 'native-report.json').exists() else None
    assert report is None or report.get('real_provider_dispatch_requests', 0) <= 1
    public = {'stage': 'AI-38', 'scope': 'one_real_MCP_transport_nonce_not_domain_acceptance',
              'started_at_utc': started, 'finished_at_utc': datetime.now(timezone.utc).isoformat(),
              'context': {'environment_id': 'linux_lab_candidate_adapter',
                          'package_manifest_sha256': expected_manifest},
              'runner_sha256': sha(Path(__file__).read_bytes()),
              'harness_sha256': sha(harness.read_bytes()), 'selection_sha256': sha(selection_file.read_bytes()),
              'exit_code': result.returncode, 'native_result': report,
              'maximum_provider_dispatch_requests': 1, 'business_effects': 0,
              'configured_SQL_writes': 0, 'services_restarted': False,
              'candidate_adopted': False, 'automatic_inference_retries': 0,
              'raw_logs_retained_privately': True}
except subprocess.TimeoutExpired:
    public = {'stage': 'AI-38', 'scope': 'one_real_MCP_transport_nonce_not_domain_acceptance',
              'status': 'runner_timeout_native_state_requires_reconciliation_no_replay',
              'started_at_utc': started, 'finished_at_utc': datetime.now(timezone.utc).isoformat(),
              'maximum_provider_dispatch_requests': 1, 'automatic_inference_retries': 0,
              'services_restarted': False, 'candidate_adopted': False}
(work / 'public-report.json').write_text(json.dumps(public, indent=2) + '\n', encoding='utf8')
print(json.dumps(public, indent=2))
