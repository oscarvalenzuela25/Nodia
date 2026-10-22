// Freeze only reviewed Python diagnostics; no runtime activation or secret-bearing context.
const assert = require('node:assert/strict');
const cp = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../..');
const source = path.join(root, 'nodia-gemini-microservice');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const [freezeArgument, version] = process.argv.slice(2);
assert.ok(freezeArgument, 'Require the final reviewed offline source/test freeze');
assert.match(version ?? '', /^0[1-9]$/);
const freezeBytes = fs.readFileSync(path.resolve(freezeArgument));
const freeze = JSON.parse(freezeBytes);
assert.equal(freeze.status, 'passed_local_offline_only');
const names = Object.keys(freeze.sources).sort();
assert.ok(names.includes('native_mcp_sessions.py') && names.includes('native_mcp_stdio.py'));
assert.ok(names.every(name => ['native_cli_diagnostics.py', 'native_mcp_sessions.py', 'native_mcp_stdio.py'].includes(name)));
assert.ok(Number.isSafeInteger(freeze.expected_applicable_tests) && freeze.expected_applicable_tests > 0);
const inventoryBytes = fs.readFileSync(path.join(root, 'docs/evidence/nodia-ai-ai38-mcp-r01-candidate-inventory.json'));
const inventory = JSON.parse(inventoryBytes);
assert.equal(inventory.base_image_id, 'sha256:0615520cd6d6682eddc08dd886d79952c80265fcf2e7814caa940b92ee8f27aa');
assert.equal(inventory.public_source_count, 47);
const localSources = Object.fromEntries(fs.readdirSync(source, { withFileTypes: true })
  .filter(entry => entry.isFile() && entry.name.endsWith('.py'))
  .map(entry => [entry.name, sha(fs.readFileSync(path.join(source, entry.name)))]));
const notAdopted = Object.fromEntries(Object.entries(inventory.public_source_hashes)
  .filter(([name, digest]) => !names.includes(name) && localSources[name] !== digest)
  .map(([name, digest]) => [name, { base_sha256: digest, local_sha256: localSources[name] }]));
assert.deepEqual(Object.keys(notAdopted).sort(), ['agentic_cli.py', 'agentic_service.py', 'main.py', 'nodia_ai_chat.py', 'request_guard.py']);
const localOnly = Object.fromEntries(Object.entries(localSources)
  .filter(([name]) => !Object.hasOwn(inventory.public_source_hashes, name)));
assert.deepEqual(Object.keys(localOnly), ['invoice_mcp_contract.py']);
const label = `ai38-mcp-r01-candidate-build${version}`;
const stage = path.join(root, '.tmp', label);
const archive = path.join(root, '.tmp', `${label}.tar`);
assert.equal(fs.existsSync(stage), false, 'Preserve closed candidate packets');
assert.equal(fs.existsSync(archive), false, 'Preserve closed candidate archives');
fs.mkdirSync(path.join(stage, 'context'), { recursive: true });
fs.mkdirSync(path.join(stage, 'tests'), { recursive: true });
for (const name of names) {
  const bytes = fs.readFileSync(path.join(source, name));
  assert.equal(sha(bytes), freeze.sources[name], `Reviewed source changed: ${name}`);
  assert.notEqual(sha(bytes), inventory.public_source_hashes[name], `Expected actual diagnostic delta: ${name}`);
  fs.writeFileSync(path.join(stage, 'context', name), bytes);
}
const excluded = {
  'test_invoice_mcp_contract.py': 'C03 invoice contract absent from base; diagnostics do not implement it',
  'test_agentic_cli_versions.py': 'R04 alternate CLI configuration absent from base and intentionally excluded',
  'test_agentic_observation_timeout.py': 'R05 outer metadata timeout change absent from base and intentionally excluded',
};
const tests = {};
const excludedMetadata = {};
const visit = (relative = '') => {
  for (const entry of fs.readdirSync(path.join(source, 'tests', relative), { withFileTypes: true })) {
    const name = path.posix.join(relative, entry.name);
    if (entry.isDirectory() && entry.name !== '__pycache__') visit(name);
    else if (entry.isFile() && /\.(py|json)$/.test(entry.name)) {
      const bytes = fs.readFileSync(path.join(source, 'tests', name));
      if (Object.hasOwn(excluded, name)) {
        excludedMetadata[name] = { sha256: sha(bytes), test_methods: (bytes.toString('utf8').match(/^    (?:async )?def test_/gm) ?? []).length, reason: excluded[name] };
      } else {
        assert.equal(sha(bytes), freeze.test_files[name], `Reviewed test changed: ${name}`);
        fs.mkdirSync(path.dirname(path.join(stage, 'tests', name)), { recursive: true });
        fs.writeFileSync(path.join(stage, 'tests', name), bytes);
        tests[name] = sha(bytes);
      }
    }
  }
};
visit();
assert.deepEqual(Object.keys(excludedMetadata).sort(), Object.keys(excluded).sort());
assert.deepEqual(Object.keys(freeze.test_files).sort(), Object.keys(tests).sort());
assert.deepEqual(freeze.excluded_test_modules.map(name => `${name}.py`).sort(), Object.keys(excludedMetadata).sort());
const dockerfile = `FROM ${inventory.base_image_id}\nCOPY --chown=10001:10001 ${names.join(' ')} /app/\n`;
fs.writeFileSync(path.join(stage, 'context/Dockerfile'), dockerfile);
const manifest = {
  stage: 'AI-38-MCP-R01', scope: 'minimal_public_diagnostics_candidate_offline_only', label,
  base_image_id: inventory.base_image_id, expected_active_container_id: inventory.container_id,
  expected_active_started_at: inventory.container_started_at,
  base_public_sources: inventory.public_source_hashes, image_sources: freeze.sources,
  local_public_deltas_intentionally_not_adopted: notAdopted,
  local_only_sources_intentionally_not_adopted: localOnly,
  test_files: tests, excluded_test_files: excludedMetadata,
  expected_applicable_tests: freeze.expected_applicable_tests,
  expected_MCP_execution_policy_sha256: '7820451f2eec37bfdff82b49c9f3e170cd051f9bfdde14eb119ec2d9fc1c85fc',
  dockerfile_sha256: sha(Buffer.from(dockerfile)), freeze_sha256: sha(freezeBytes),
  inventory_sha256: sha(inventoryBytes), stage_source_sha256: sha(fs.readFileSync(__filename)),
  profile_or_credentials_included: false, test_sources_mount_only: true,
  provider_requests: 0, candidate_activation: false, service_restart: false,
};
fs.writeFileSync(path.join(stage, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
cp.execFileSync('tar', ['-cf', archive, '-C', stage, 'manifest.json', 'context', 'tests']);
console.log(JSON.stringify({ stage, archive, archive_sha256: sha(fs.readFileSync(archive)),
  manifest_sha256: sha(fs.readFileSync(path.join(stage, 'manifest.json'))),
  image_sources: names, public_tests: Object.keys(tests).length, expected_applicable_tests: manifest.expected_applicable_tests,
  excluded_test_files: excludedMetadata }, null, 2));
