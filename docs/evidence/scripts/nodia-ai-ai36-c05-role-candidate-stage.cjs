// Closed, public-only image context and separate readonly unit-test inputs.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const cp = require('node:child_process');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../../..');
const source = path.join(root, 'nodia-gemini-microservice');
const stage = path.join(root, '.tmp/ai36-c05-role-candidate-build01');
assert.equal(fs.existsSync(stage), false, 'Preserve each closed packet');
const expected = {
  'native_execution_agents.py': '634ff3981e81e2bc0b4b14da6d783a5049fee0a76d17f378119b86cd3ae08e87',
  'native_mcp_sessions.py': '01a9d1537d49fba9754161011f5897a257e9178c503140e4f15a166a01dc2a0c',
  'native_cli_diagnostics.py': 'fc19ab0655d9c06f2985c9fcebfc2f2d236f863fbb7fd3eecc7fb83991bd2ffe',
};
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
fs.mkdirSync(path.join(stage, 'context'), { recursive: true });
fs.mkdirSync(path.join(stage, 'tests'), { recursive: true });
for (const [file, digest] of Object.entries(expected)) {
  const bytes = fs.readFileSync(path.join(source, file));
  assert.equal(sha(bytes), digest);
  fs.writeFileSync(path.join(stage, 'context', file), bytes);
}
const base = 'sha256:b110dbdc78b0f6ec80c98d7ca5c0afe8e8e7fab3a9c46dc60b7eeee0f6855532';
fs.writeFileSync(path.join(stage, 'context/Dockerfile'), `FROM ${base}\nCOPY --chown=10001:10001 native_execution_agents.py native_mcp_sessions.py native_cli_diagnostics.py /app/\n`);
const tests = {};
const copyTests = (relative = '') => {
  for (const e of fs.readdirSync(path.join(source, 'tests', relative), { withFileTypes: true })) {
    const rel = path.posix.join(relative, e.name);
    if (e.isDirectory() && e.name !== '__pycache__') copyTests(rel);
    else if (e.isFile() && /\.(py|json)$/.test(e.name)) {
      const b = fs.readFileSync(path.join(source, 'tests', rel));
      fs.mkdirSync(path.dirname(path.join(stage, 'tests', rel)), { recursive: true });
      fs.writeFileSync(path.join(stage, 'tests', rel), b); tests[rel] = sha(b);
    }
  }
};
copyTests();
const manifest = {
  stage: 'AI-36-C05-R01', scope: 'immutable_owned_MCP_role_candidate_build_and_offline_Linux_QA',
  base_image_id: base, build_context: 'exact_Dockerfile_plus_three_public_sources',
  image_sources: expected, test_files: tests,
  dockerfile_sha256: sha(fs.readFileSync(path.join(stage, 'context/Dockerfile'))),
  role_source_changes: 2, diagnostic_source_changes: 1,
  official_runner_path_in_image: '/app/run_tests.py', test_mount_path: '/app/tests',
  operational_environment_included: false, profile_or_credentials_included: false,
  provider_generations: 0, service_activation: false,
};
fs.writeFileSync(path.join(stage, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
const archive = path.join(root, '.tmp/ai36-c05-role-candidate-build01.tar');
assert.equal(fs.existsSync(archive), false);
cp.execFileSync('tar', ['-cf', archive, '-C', stage, 'manifest.json', 'context', 'tests']);
console.log(JSON.stringify({ archive, archive_sha256: sha(fs.readFileSync(archive)), manifest_sha256: sha(fs.readFileSync(path.join(stage, 'manifest.json'))), public_tests: Object.keys(tests).length }));
