// Public-only explicit CLI1.4.2 candidate; production sources and test inputs stay separate.
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
const sourceNames = ['agentic_cli.py', 'agentic_service.py', 'nodia_ai_chat.py'];
assert.deepEqual(freeze.production_delta.map(value => path.basename(value.path)).sort(), sourceNames);
assert.equal(freeze.Windows_official_suite.exit_code, 0);
const expectedTests = freeze.Windows_official_suite.total - 15;
assert.equal(expectedTests, 447);
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const stage = path.join(root, '.tmp/ai36-c05-r04-candidate-build01');
assert.equal(fs.existsSync(stage), false, 'Preserve each closed packet');
const base = 'sha256:0615520cd6d6682eddc08dd886d79952c80265fcf2e7814caa940b92ee8f27aa';
const expected = Object.fromEntries(freeze.production_delta.map(value => [path.basename(value.path), value.sha256]));
for (const digest of Object.values(expected)) assert.match(digest, /^[a-f0-9]{64}$/u);
fs.mkdirSync(path.join(stage, 'context'), { recursive: true });
fs.mkdirSync(path.join(stage, 'tests'), { recursive: true });
for (const [name, digest] of Object.entries(expected)) {
  const bytes = fs.readFileSync(path.join(source, name));
  assert.equal(sha(bytes), digest);
  fs.writeFileSync(path.join(stage, 'context', name), bytes);
}
fs.writeFileSync(path.join(stage, 'context/Dockerfile'), `FROM ${base}\nCOPY --chown=10001:10001 agentic_cli.py agentic_service.py nodia_ai_chat.py /app/\n`);
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
const previous = JSON.parse(fs.readFileSync(path.join(root, 'docs/evidence/nodia-ai-ai36-c05-r03-build01-report.json')));
const dependencies = Object.fromEntries(Object.entries(previous.production_dependency_comparison)
  .map(([name, comparison]) => [name, expected[name] ?? comparison.candidate_sha256]));
Object.assign(dependencies, {
  'native_execution_agents.py': '06871d65d2681257edcb2c8db9673ea8429688ac7ea894b91b8000b99f8004f6',
  'native_mcp_sessions.py': '01a9d1537d49fba9754161011f5897a257e9178c503140e4f15a166a01dc2a0c',
  'native_cli_diagnostics.py': 'fc19ab0655d9c06f2985c9fcebfc2f2d236f863fbb7fd3eecc7fb83991bd2ffe',
});
Object.assign(dependencies, expected);
for (const [name, digest] of Object.entries(dependencies)) assert.equal(sha(fs.readFileSync(path.join(source, name))), digest);
assert.equal(tests['test_agentic_cli_versions.py'], '6529fa8bf056abb72917c2f41b3acc4e5e77abdbf7b6dbfa7a8fdf8a80c37b8a');
const pinPath = path.join(root, 'docs/evidence/nodia-ai-ai36-c05-cli-1.4.2-package-pin.json');
const pinBytes = fs.readFileSync(pinPath), pin = JSON.parse(pinBytes);
assert.equal(pin.manifest.version, '1.4.2');
assert.equal(pin.package_sha512_verified, true);
assert.match(pin.binary_sha512, /^[a-f0-9]{128}$/u);
const excluded = fs.readFileSync(path.join(source, 'tests/test_invoice_mcp_contract.py'));
assert.equal((excluded.toString().match(/^    def test_/gm) ?? []).length, 15);
const manifest = {
  stage: 'AI-36-C05-R04', scope: 'immutable_explicit_CLI142_transport_candidate_build_and_offline_Linux_QA',
  base_image_id: base, expected_active_image_id: base,
  build_context: 'exact_Dockerfile_plus_three_public_sources_no_binary_or_account', image_sources: expected,
  test_files: tests, production_dependencies: dependencies,
  dockerfile_sha256: sha(fs.readFileSync(path.join(stage, 'context/Dockerfile'))),
  reviewed_source_freeze_sha256: sha(freezeBytes), expected_applicable_tests: expectedTests,
  expected_MCP_execution_policy_sha256: '7820451f2eec37bfdff82b49c9f3e170cd051f9bfdde14eb119ec2d9fc1c85fc',
  official_runner_path_in_image: '/app/run_tests.py', test_mount_path: '/app/tests',
  excluded_C03_test_file: { path: 'test_invoice_mcp_contract.py', sha256: sha(excluded), methods: 15,
    reason: 'C03_invoice_MCP_contract_absent_from_approved_base_and_candidate_image' },
  operational_environment_included: false, profile_or_credentials_included: false,
  provider_generations: 0, service_activation: false,
  binary_not_embedded_in_image: true,
  future_public_binary_readonly_mount: { version: pin.manifest.version, sha512: pin.binary_sha512,
    bytes: pin.binary_bytes, pin_sha256: sha(pinBytes), overrides_only: [
      'ANTIGRAVITY_CLI_PATH', 'ANTIGRAVITY_CLI_SHA512', 'ANTIGRAVITY_CLI_VERSION',
    ] },
};
fs.writeFileSync(path.join(stage, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
const archive = path.join(root, '.tmp/ai36-c05-r04-candidate-build01.tar');
assert.equal(fs.existsSync(archive), false);
cp.execFileSync('tar', ['-cf', archive, '-C', stage, 'manifest.json', 'context', 'tests']);
console.log(JSON.stringify({ archive, archive_sha256: sha(fs.readFileSync(archive)),
  manifest_sha256: sha(fs.readFileSync(path.join(stage, 'manifest.json'))), public_tests: Object.keys(tests).length }));
