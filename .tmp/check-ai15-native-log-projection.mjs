import fs from 'node:fs';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const baseline = JSON.parse(fs.readFileSync('docs/evidence/nodia-ai-ai15-live-configured-attestation-final.json', 'utf8')).native_terminal_diagnostic;
const valid = { state: 'observed', interpretation: 'text_indicator_not_verified_cause', bytes_read: 200, lines_scanned: 2, truncated: false, transport_indicators: ['io_timeout'], provider_error_indicators: ['RESOURCE_EXHAUSTED'], http_statuses: [429] };
const project = value => {
  const result = spawnSync('nodia-gemini-microservice/.venv/Scripts/python.exe', ['docs/evidence/scripts/read-nodia-ai-native-diagnostics.py'], { input: 'nodia_ai_mcp_terminal ' + JSON.stringify(value) + '\n', encoding: 'utf8' });
  assert.equal(result.status, 0);
  assert.equal(result.stderr, '');
  return result.stdout.trim();
};
assert.ok(project(baseline));
assert.ok(project({ ...baseline, cli_log: null }));
assert.deepEqual(JSON.parse(project({ ...baseline, cli_log: valid })).cli_log, valid);
const invalid = [
  { state: 'private-do-not-export' }, { bytes_read: true }, { bytes_read: 131073 },
  { lines_scanned: 129 }, { truncated: 'false' }, { raw: 'private-do-not-export' },
  { transport_indicators: ['private-do-not-export'] }, { transport_indicators: [[]] },
  { provider_error_indicators: ['UNAUTHENTICATED', 'UNAUTHENTICATED'] },
  { http_statuses: [true] }, { http_statuses: [200] }, { http_statuses: ['429'] },
  { http_statuses: [500, 429] }
];
for (const change of invalid) assert.equal(project({ ...baseline, cli_log: { ...valid, ...change } }), '');
console.log(JSON.stringify({ task: 'AI-15 native diagnostic projection', checks: invalid.length + 3, status: 'passed', provider_calls: 0 }));
