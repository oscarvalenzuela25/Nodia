// Public-only metadata timeout classification fix; production sources and test inputs stay separate.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const cp = require('node:child_process');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../../..');
const source = path.join(root, 'nodia-gemini-microservice');
const freezeFile = process.argv[2];
assert.ok(freezeFile, 'Require the reviewed final source/test freeze');
const freezeBytes = fs.readFileSync(path.resolve(freezeFile));
const freeze = JSON.parse(freezeBytes);
assert.equal(freeze.status, 'passed_local_offline_only');
assert.equal(freeze.production_delta.length, 1);
assert.equal(freeze.production_delta[0].path, 'nodia-gemini-microservice/agentic_service.py');
assert.equal(freeze.production_delta[0].sha256, 'a8ca51286a3c69f1055f8e9392d2e006ef4c0ee4df011fa00b116793b29fa200');
assert.equal(freeze.Windows_official_suite.total, 467);
assert.equal(freeze.Windows_official_suite.exit_code, 0);
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const stage = path.join(root, '.tmp/ai36-c05-r05-candidate-build01');
assert.equal(fs.existsSync(stage), false, 'Preserve each closed packet');
const base = 'sha256:9482df4c8ad2db5d591e3f1ac76e2c7cdc2a8fe7b296fa76374dc139c234a47e';
const expected = { 'agentic_service.py': 'a8ca51286a3c69f1055f8e9392d2e006ef4c0ee4df011fa00b116793b29fa200' };
fs.mkdirSync(path.join(stage, 'context'), { recursive: true });
fs.mkdirSync(path.join(stage, 'tests'), { recursive: true });
for (const [name, digest] of Object.entries(expected)) {
  const bytes = fs.readFileSync(path.join(source, name));
  assert.equal(sha(bytes), digest);
  fs.writeFileSync(path.join(stage, 'context', name), bytes);
}
fs.writeFileSync(path.join(stage, 'context/Dockerfile'), `FROM ${base}\nCOPY --chown=10001:10001 agentic_service.py /app/\n`);
const tests = {};
const copyTests = (relative = '') => {
  for (const entry of fs.readdirSync(path.join(source, 'tests', relative), { withFileTypes: true })) {
    const rel = path.posix.join(relative, entry.name);
    if (entry.isDirectory() && entry.name !== '__pycache__') copyTests(rel);
    else if (entry.isFile() && /\.(py|json)$/.test(entry.name) && rel !== 'test_invoice_mcp_contract.py') {
      const bytes = fs.readFileSync(path.join(source, 'tests', rel));
      fs.mkdirSync(path.dirname(path.join(stage, 'tests', rel)), { recursive: true });
      fs.writeFileSync(path.join(stage, 'tests', rel), bytes);
      tests[rel] = sha(bytes);
    }
  }
};
copyTests();
assert.equal(tests['test_native_mcp_manifest.py'], '69655bede44e04b20ab449f1c07be5fbecdd7c8db8a85810112554ed298080b6');
assert.equal(tests['test_agentic_observation_timeout.py'], '61ac25b286dcddeaac483eeecebaf6e7b34f4ef1be5cad64baf36ff131de28ec');
const previous = JSON.parse(fs.readFileSync(path.join(root, 'docs/evidence/nodia-ai-ai36-c05-r04-build01-report.json')));
const dependencies = Object.fromEntries(Object.entries(previous.production_dependency_comparison)
  .map(([name, comparison]) => [name, expected[name] ?? comparison.candidate_sha256]));
Object.assign(dependencies, {
  'native_execution_agents.py': '06871d65d2681257edcb2c8db9673ea8429688ac7ea894b91b8000b99f8004f6',
  'native_mcp_sessions.py': '01a9d1537d49fba9754161011f5897a257e9178c503140e4f15a166a01dc2a0c',
  'native_cli_diagnostics.py': 'fc19ab0655d9c06f2985c9fcebfc2f2d236f863fbb7fd3eecc7fb83991bd2ffe',
});
for (const [name, digest] of Object.entries(dependencies)) assert.equal(sha(fs.readFileSync(path.join(source, name))), digest);
const excluded = fs.readFileSync(path.join(source, 'tests/test_invoice_mcp_contract.py'));
assert.equal((excluded.toString().match(/^    def test_/gm) ?? []).length, 15);
const manifest = {
  stage: 'AI-36-C05-R05', scope: 'immutable_outer_metadata_timeout_reason_fix_build_and_offline_Linux_QA',
  base_image_id: base, expected_active_image_id: 'sha256:0615520cd6d6682eddc08dd886d79952c80265fcf2e7814caa940b92ee8f27aa',
  build_context: 'exact_Dockerfile_plus_one_public_source', image_sources: expected,
  test_files: tests, production_dependencies: dependencies,
  dockerfile_sha256: sha(fs.readFileSync(path.join(stage, 'context/Dockerfile'))),
  reviewed_source_freeze_sha256: sha(freezeBytes), expected_applicable_tests: 452,
  expected_MCP_execution_policy_sha256: '7820451f2eec37bfdff82b49c9f3e170cd051f9bfdde14eb119ec2d9fc1c85fc',
  official_runner_path_in_image: '/app/run_tests.py', test_mount_path: '/app/tests',
  excluded_C03_test_file: { path: 'test_invoice_mcp_contract.py', sha256: sha(excluded), methods: 15,
    reason: 'C03_invoice_MCP_contract_absent_from_approved_base_and_candidate_image' },
  operational_environment_included: false, profile_or_credentials_included: false,
  provider_generations: 0, service_activation: false,
  future_execution: { CLI_version: '1.3.1', original_operational_mounts: 6,
    external_CLI_1_4_2_mount: false, operational_Node_deployed: false },
};
fs.writeFileSync(path.join(stage, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
const archive = path.join(root, '.tmp/ai36-c05-r05-candidate-build01.tar');
assert.equal(fs.existsSync(archive), false);
cp.execFileSync('tar', ['-cf', archive, '-C', stage, 'manifest.json', 'context', 'tests']);
console.log(JSON.stringify({ archive, archive_sha256: sha(fs.readFileSync(archive)),
  manifest_sha256: sha(fs.readFileSync(path.join(stage, 'manifest.json'))), public_tests: Object.keys(tests).length }));
