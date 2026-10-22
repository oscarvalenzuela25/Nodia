// Negative artifact tests. Touches only a new synthetic copy in .tmp, never VM.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '../../..');
const stageRelative = '.tmp/ai38-delivery-control-r01';
const stage = path.join(root, stageRelative);
const outputRelative = 'docs/evidence/nodia-ai-ai38-delivery-control-r01.json';
assert(!fs.existsSync(stage) && !fs.existsSync(path.join(root, outputRelative)), 'preserve all attempts');
const sourceReference = JSON.parse(fs.readFileSync(path.join(root, 'docs/evidence/nodia-ai-ai38-candidate01.json'), 'utf8'));
const originalManifest = fs.readFileSync(path.join(root, sourceReference.path, 'manifest.json'));
const candidateRelative = `${stageRelative}/nodia-server`;
fs.mkdirSync(stage, { recursive: true });
fs.cpSync(path.join(root, sourceReference.path), path.join(root, candidateRelative), { recursive: true, errorOnExist: true });
const candidateReference = `${stageRelative}/reference.json`;
const testReference = { ...sourceReference, path: candidateRelative };
const saveReference = () => fs.writeFileSync(path.join(root, candidateReference), JSON.stringify(testReference));
saveReference();
const checks = [];
function failsClosed(name, expected, options = {}) {
  const output = options.output ?? `docs/evidence/nodia-ai-ai38-delivery-preflight-r${90 + checks.length}.json`;
  if (!options.output) assert(!fs.existsSync(path.join(root, output)));
  const result = spawnSync(process.execPath, [
    path.join(root, 'docs/evidence/scripts/nodia-ai-ai38-delivery-preflight.cjs'),
    candidateReference, 'docs/evidence/nodia-ai-ai38-delivery-inventory-r02.json', output,
    options.environment ?? 'linux_lab',
  ], { cwd: root, encoding: 'utf8', timeout: 30000 });
  assert(result.error === undefined && result.status !== 0 && result.stderr.includes(expected), `unexpected guard result: ${name}`);
  if (!options.output) assert(!fs.existsSync(path.join(root, output)), `guard wrote receipt: ${name}`);
  checks.push({ name, passed: true, no_receipt_written: true });
}
failsClosed('existing_receipt_is_never_replaced', 'never replace a preflight receipt', { output: 'docs/evidence/nodia-ai-ai38-delivery-preflight-r01.json' });
failsClosed('another_environment_cannot_relabel_the_inventory', 'AssertionError', { environment: 'production' });
testReference.manifest_sha256 = '0'.repeat(64); saveReference();
failsClosed('manifest_digest_mismatch', 'candidate manifest digest mismatch');
testReference.manifest_sha256 = sourceReference.manifest_sha256; saveReference();
const secretFixture = path.join(root, candidateRelative, '.env');
fs.writeFileSync(secretFixture, 'SYNTHETIC_FIXTURE_ONLY=not-a-real-secret\n');
failsClosed('environment_file_in_packet_is_rejected', 'secret or dependencies in packet');
fs.unlinkSync(secretFixture);
const unknownFixture = path.join(root, candidateRelative, 'unlisted-synthetic.txt');
fs.writeFileSync(unknownFixture, 'synthetic');
failsClosed('unlisted_file_is_rejected', 'packet contains missing or unlisted files');
fs.unlinkSync(unknownFixture);
const entrypoint = path.join(root, candidateRelative, 'dist/main.js');
const originalEntrypoint = fs.readFileSync(entrypoint);
fs.appendFileSync(entrypoint, '\n// synthetic tamper\n');
failsClosed('runtime_tampering_is_rejected', 'packet member changed');
fs.writeFileSync(entrypoint, originalEntrypoint);
const lock = path.join(root, candidateRelative, 'package-lock.json');
const originalLock = fs.readFileSync(lock);
fs.writeFileSync(lock, '{}\n');
failsClosed('dependency_lock_tampering_is_rejected', 'packet member changed');
fs.writeFileSync(lock, originalLock);
const manifest = JSON.parse(originalManifest);
const listed = Object.keys(manifest.files).find(member => member.startsWith('dist/') && member.endsWith('.d.ts'));
const listedPath = path.join(root, candidateRelative, listed);
const originalListed = fs.readFileSync(listedPath);
fs.unlinkSync(listedPath);
failsClosed('missing_compiled_member_is_rejected', 'packet contains missing or unlisted files');
fs.writeFileSync(listedPath, originalListed);
assert.deepEqual(fs.readFileSync(path.join(root, sourceReference.path, 'manifest.json')), originalManifest);
const sha = relative => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, relative))).digest('hex');
const report = {
  schema_version: 1, stage: 'AI-38', scope: 'synthetic_artifact_security_controls_no_environment_acceptance',
  context: { environment_id: 'linux_lab', package_manifest_sha256: sourceReference.manifest_sha256 },
  passed: checks.length, checks,
  source: { path: path.relative(root, __filename).replaceAll('\\', '/'), sha256: sha(path.relative(root, __filename)) },
  preflight: { path: 'docs/evidence/scripts/nodia-ai-ai38-delivery-preflight.cjs', sha256: sha('docs/evidence/scripts/nodia-ai-ai38-delivery-preflight.cjs') },
  original_candidate_unchanged: true, fixture_scope: stageRelative,
  remote_operations: 0, database_operations: 0, provider_requests: 0, release_authorized: false,
};
fs.writeFileSync(path.join(root, outputRelative), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ report: outputRelative, passed: checks.length, release_authorized: false }));
