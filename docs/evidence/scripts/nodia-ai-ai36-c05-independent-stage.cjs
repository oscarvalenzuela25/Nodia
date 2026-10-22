// Immutable candidate packet; no environment, profile, account or storage bytes.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const cp = require('node:child_process');
const assert = require('node:assert/strict');
const control = process.argv.includes('--semantic-control');
const discovery = process.argv.includes('--discovery-only');
const observer = process.argv.includes('--owned-log-observer');
assert.ok(!observer || discovery && !control);
assert.equal(observer, false, 'Independent acceptance cases have no native log observer');
const prefix = control ? 'ai36-c05-cases-control' : 'ai36-c05-cases-live';
const root = path.resolve(__dirname, '../../..');
const server = path.join(root, 'nodia-server');
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const walk = relative => fs.readdirSync(path.join(server, relative), { withFileTypes: true })
  .flatMap(entry => entry.isDirectory() ? walk(relative + '/' + entry.name) : [relative + '/' + entry.name]);
const compiled = walk('dist').sort();
const publication = JSON.parse(fs.readFileSync(path.join(server, 'dist/nodia-ai/knowledge/manifest.json'), 'utf8'));
assert.equal(publication.capability_contracts.length, 74);
const expectedCapabilities = ['nodia_finance_movements_prepare_create', 'nodia_proposals_get',
  'nodia_operations_get', 'nodia_workflows_prepare', 'nodia_attachments_describe',
  'nodia_preferences_list', 'nodia_preferences_prepare'];
assert.ok(fs.existsSync(path.join(server, 'dist/nodia-ai-tools/use-case/nodia-ai-tool-selection-flow.use-case.js')),
  'Require the compiled automatic discovery and selection coordinator');
assert.ok(expectedCapabilities.every(id => publication.capability_contracts.some(item => item.capability_id === id && item.publication === 'published')),
  'Do not package an unpublished or stale candidate for real acceptance');
const input = [...compiled, 'package.json', 'package-lock.json',
  'test/nodia-ai.integration.fixture.mjs', 'test/nodia-ai-ai36-c05-live.integration.mjs',
  'test/nodia-ai-ai36-c05-independent-cases.fixture.mjs',
  'test/nodia-ai-ai36-c05-owned-log-observer.mjs',
  ...(control ? ['test/nodia-ai-ai36-c05-semantic-control.fixture.mjs', 'test/nodia-ai-context-budget.fixture.mjs'] : [])];
const manifest = { stage: 'AI-36-C05', scope: 'explicit_bundle_real_Gemini_disposable_SQL_candidate',
  fixture_namespace: control ? 'ai3607' : 'ai3605', semantic_control_only: control,
  case_contract_version: 'nodia-ai-c05-independent-cases/1', case_ids: ['reads', 'preferences', 'finance', 'workflow'],
  maximum_generations_per_case: 2, maximum_generations_per_cohort: 8,
  discovery_only: discovery, owned_log_observer: observer,
  compiled_files: compiled.length, configured_environment_included: false,
  knowledge_release: publication.release_id, selection_mode: 'automatic_discovery_then_bounded_execution',
  files: Object.fromEntries(input.map(file => [file, sha(fs.readFileSync(path.join(server, file)))])) };
fs.mkdirSync(path.join(server, '.tmp'), { recursive: true });
fs.mkdirSync(path.join(root, '.tmp'), { recursive: true });
if (observer) {
  const tools = [
    ['docs/evidence/scripts/nodia-ai-ai36-c05-live-owned-log-observer.py', '.tmp/c05-owned-log-observer.py'],
    ['nodia-gemini-microservice/native_cli_diagnostics.py', '.tmp/c05-native-cli-diagnostics.py'],
  ];
  for (const [source, destination] of tools) {
    fs.copyFileSync(path.join(root, source), path.join(server, destination));
    input.push(destination); manifest.files[destination] = sha(fs.readFileSync(path.join(server, destination)));
  }
}
const manifestPath = `.tmp/${prefix}-stage-manifest.json`;
fs.writeFileSync(path.join(server, manifestPath), JSON.stringify(manifest, null, 2) + '\n');
const listPath = `.tmp/${prefix}-stage-files.txt`;
fs.writeFileSync(path.join(server, listPath), [...input, manifestPath].join('\n') + '\n');
const archive = path.join(root, `.tmp/${prefix}-stage.tar`);
cp.execFileSync('tar', ['-cf', archive, '-T', listPath], { cwd: server, stdio: 'pipe' });
console.log(JSON.stringify({ stage: 'AI-36-C05', compiled_files: compiled.length,
  manifest_sha256: sha(fs.readFileSync(path.join(server, manifestPath))),
  archive_sha256: sha(fs.readFileSync(archive)), archive_bytes: fs.statSync(archive).size,
  harness_sha256: manifest.files['test/nodia-ai-ai36-c05-live.integration.mjs'] }));
