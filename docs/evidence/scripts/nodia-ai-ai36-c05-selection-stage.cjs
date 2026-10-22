// Compiled real publication packet; account/env/profile data are excluded.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const cp = require('node:child_process');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../../..'), server = path.join(root, 'nodia-server');
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const walk = relative => fs.readdirSync(path.join(server, relative), { withFileTypes: true })
  .flatMap(entry => entry.isDirectory() ? walk(relative + '/' + entry.name) : [relative + '/' + entry.name]);
const compiled = walk('dist').sort();
const manifest = JSON.parse(fs.readFileSync(path.join(server, 'dist/nodia-ai/knowledge/manifest.json'), 'utf8'));
assert.equal(manifest.capability_contracts.length, 74);
const names = ['nodia_finance_movements_prepare_create', 'nodia_proposals_get', 'nodia_operations_get',
  'nodia_attachments_describe', 'nodia_preferences_list', 'nodia_preferences_prepare', 'nodia_workflows_prepare'];
assert.ok(names.every(id => manifest.capability_contracts.some(item => item.capability_id === id && item.publication === 'published')));
assert.ok(compiled.includes('dist/nodia-ai-tools/use-case/nodia-ai-tool-selection-flow.use-case.js'));
const input = [...compiled, 'package.json', 'package-lock.json', 'test/nodia-ai.integration.fixture.mjs',
  'test/nodia-ai-context-budget.fixture.mjs', 'test/nodia-ai-ai36-c05-selection.integration.mjs'];
const packet = { stage: 'AI-36-C05', scope: 'automatic_selection_actual_SQL_synthetic_transport',
  fixture_namespace: 'ai3606', configured_environment_included: false, compiled_files: compiled.length,
  knowledge_release: manifest.release_id,
  files: Object.fromEntries(input.map(file => [file, sha(fs.readFileSync(path.join(server, file)))])) };
fs.mkdirSync(path.join(server, '.tmp'), { recursive: true }); fs.mkdirSync(path.join(root, '.tmp'), { recursive: true });
const manifestPath = '.tmp/ai36-c05-selection-stage-manifest.json';
fs.writeFileSync(path.join(server, manifestPath), JSON.stringify(packet, null, 2) + '\n');
const listPath = '.tmp/ai36-c05-selection-stage-files.txt';
fs.writeFileSync(path.join(server, listPath), [...input, manifestPath].join('\n') + '\n');
const archive = path.join(root, '.tmp/ai36-c05-selection-stage.tar');
cp.execFileSync('tar', ['-cf', archive, '-T', listPath], { cwd: server, stdio: 'pipe' });
console.log(JSON.stringify({ stage: 'AI-36-C05', compiled_files: compiled.length,
  manifest_sha256: sha(fs.readFileSync(path.join(server, manifestPath))), archive_sha256: sha(fs.readFileSync(archive)),
  archive_bytes: fs.statSync(archive).size, harness_sha256: packet.files['test/nodia-ai-ai36-c05-selection.integration.mjs'] }));
