// Artifact integrity only: no imports from the application, network or subprocess.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../../..');
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function relativeFile(relative) {
  assert(typeof relative === 'string' && relative.length < 1024 && !relative.includes('\\'));
  assert(!path.isAbsolute(relative) && !relative.split('/').some(part => !part || part === '.' || part === '..'));
  let current = root;
  for (const part of relative.split('/')) {
    current = path.join(current, part);
    assert(!fs.lstatSync(current).isSymbolicLink(), 'symlink not permitted in evidence path');
  }
  assert(fs.lstatSync(current).isFile(), 'regular evidence file required');
  return current;
}
function read(relative) {
  return JSON.parse(fs.readFileSync(relativeFile(relative), 'utf8'));
}
function reference(relative) {
  return { path: relative, sha256: digest(fs.readFileSync(relativeFile(relative))) };
}
const [candidateReference, inventoryReference, outputRelative, environmentId] = process.argv.slice(2);
assert(process.argv.length === 6 && /^[a-z][a-z0-9_]{1,63}$/.test(environmentId), 'reference inventory output environment_id required');
assert(/^docs\/evidence\/nodia-ai-ai38-delivery-preflight-r[0-9]{2}\.json$/.test(outputRelative));
const output = path.join(root, outputRelative);
assert(!fs.existsSync(output), 'never replace a preflight receipt');
const candidate = read(candidateReference);
const manifestRelative = `${candidate.path}/manifest.json`;
assert(reference(manifestRelative).sha256 === candidate.manifest_sha256, 'candidate manifest digest mismatch');
const manifest = read(manifestRelative);
assert(manifest.stage === 'AI-38' && manifest.scope === 'compiled_candidate_not_operational_adoption');
assert(manifest.environment_or_profile_included === false && manifest.provider_requests === 0);
const actual = [];
function walk(relative) {
  for (const name of fs.readdirSync(path.join(root, relative), { withFileTypes: true })) {
    assert(!name.isSymbolicLink(), 'candidate symlink rejected');
    const member = `${relative}/${name.name}`;
    assert(!['.env', 'node_modules'].includes(name.name), 'secret or dependencies in packet');
    if (name.isDirectory()) walk(member);
    else { assert(name.isFile()); actual.push(member.slice(candidate.path.length + 1)); }
  }
}
walk(candidate.path);
assert.deepEqual(actual.sort(), [...Object.keys(manifest.files), 'manifest.json'].sort(), 'packet contains missing or unlisted files');
for (const [member, expected] of Object.entries(manifest.files)) {
  assert(/^[a-f0-9]{64}$/.test(expected));
  assert(reference(`${candidate.path}/${member}`).sha256 === expected, 'packet member changed');
}
for (const [member, expected] of Object.entries(manifest.production_sources)) {
  assert(member.startsWith('src/') && member.endsWith('.ts') && !member.endsWith('.spec.ts'));
  assert(reference(`nodia-server/${member}`).sha256 === expected, 'production source differs from packet binding');
}
const compiled = Object.keys(manifest.files).filter(member => member.startsWith('dist/'));
assert(compiled.length === manifest.compiled_outputs && compiled.length === candidate.compiled_outputs);
assert(compiled.filter(member => /\.(js|json|md)$/.test(member)).length === manifest.runtime_assets);
const pkg = read(`${candidate.path}/package.json`);
const lock = read(`${candidate.path}/package-lock.json`);
assert.deepEqual(lock.packages[''].dependencies, pkg.dependencies, 'runtime dependency contract differs from lock');
assert.deepEqual(lock.packages[''].devDependencies, pkg.devDependencies, 'development dependency contract differs from lock');
assert(manifest.package_lock_sha256 === manifest.files['package-lock.json']);
const knowledge = read(`${candidate.path}/dist/nodia-ai/knowledge/manifest.json`);
assert(knowledge.release_id === manifest.knowledge_release_id && knowledge.release_id === candidate.knowledge_release_id);
const inventory = read(inventoryReference);
assert(inventory.stage === 'AI-38' && inventory.environment === environmentId);
assert(inventory.scope === 'read_only_delivery_inventory_not_acceptance');
assert(inventory.limits.release_authorized === false && inventory.limits.services_restarted === false);
const report = {
  schema_version: 1, stage: 'AI-38', status: 'artifact_integrity_verified_not_environment_acceptance',
  scope: 'artifact', context: { environment_id: environmentId, package_manifest_sha256: candidate.manifest_sha256 },
  candidate: { reference: reference(candidateReference), manifest: reference(manifestRelative), all_listed_files_verified: Object.keys(manifest.files).length, production_sources_verified: Object.keys(manifest.production_sources).length, compiled_outputs: compiled.length, runtime_assets: manifest.runtime_assets, knowledge_release_id: knowledge.release_id, capability_contracts: knowledge.capability_contracts.length, documents: knowledge.documents.length, fragments: knowledge.fragments.length, package_lock_sha256: manifest.package_lock_sha256, dependency_installation_or_runtime_verified: false },
  operational_antecedent: { reference: reference(inventoryReference), observed_at_utc: inventory.observed_at_utc, active_package_is_candidate: false, operational_node: inventory.operational_node, no_new_provider_availability_claim: true },
  source_script: reference(path.relative(root, __filename).replaceAll('\\', '/')),
  boundaries: { environment_activation_performed: false, configured_database_read: false, configured_database_writes: false, provider_requests: 0, storage_operations: 0, deployment: false, release_authorized: false, gates_evaluator: 'docs/evidence/scripts/nodia-ai-ai38-gates.cjs', acceptance_required_separately: true },
};
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ output: reference(outputRelative), context: report.context, files: report.candidate.all_listed_files_verified, release_authorized: false }));
