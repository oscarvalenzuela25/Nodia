// Freeze a completed official build. No application imports, secrets or deployment.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../../..');
const version = process.argv[2];
assert(/^[0][1-9]$/.test(version), 'explicit candidate version 01..09 required');
const stage = path.join(root, `.tmp/ai38-node-candidate${version}`);
const output = path.join(stage, 'nodia-server');
const referencePath = path.join(root, `docs/evidence/nodia-ai-ai38-candidate${version}.json`);
assert(!fs.existsSync(stage) && !fs.existsSync(referencePath), 'never replace a frozen candidate');
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const files = {};
function walk(folder) {
  return fs.readdirSync(path.join(root, 'nodia-server', folder), { withFileTypes: true })
    .flatMap(item => {
      assert(!item.isSymbolicLink(), 'no candidate symlinks');
      return item.isDirectory() ? walk(`${folder}/${item.name}`) : [`${folder}/${item.name}`];
    });
}
function copy(relative) {
  assert(!relative.split('/').some(part => ['.env', 'node_modules', '..'].includes(part)));
  const source = path.join(root, 'nodia-server', relative);
  assert(fs.lstatSync(source).isFile(), 'regular candidate files only');
  const target = path.join(output, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
  files[relative] = digest(fs.readFileSync(target));
}
const compiled = walk('dist').filter(name => !name.endsWith('.tsbuildinfo'));
assert(compiled.length > 2000 && compiled.length < 5000);
// Exact existing integration fixtures are separate from runtime outputs and
// cannot confer acceptance merely by being present in the packet.
const fixtures = fs.readdirSync(path.join(root, 'nodia-server/test'))
  .filter(name => name.endsWith('.mjs') && !name.startsWith('nodia-ai-ai38'))
  .map(name => `test/${name}`);
for (const name of [...compiled, ...fixtures, 'package.json', 'package-lock.json', 'scripts/prepare-nodia-ai-restore.mjs']) copy(name);
const productionSources = Object.fromEntries(walk('src')
  .filter(name => name.endsWith('.ts') && !name.endsWith('.spec.ts'))
  .map(name => [name, digest(fs.readFileSync(path.join(root, 'nodia-server', name)))]));
const knowledge = JSON.parse(fs.readFileSync(path.join(output, 'dist/nodia-ai/knowledge/manifest.json'), 'utf8'));
const manifest = {
  schema_version: 1, stage: 'AI-38', scope: 'compiled_candidate_not_operational_adoption',
  files, production_sources: productionSources,
  compiled_outputs: compiled.length,
  runtime_assets: compiled.filter(name => /\.(js|json|md)$/.test(name)).length,
  knowledge_release_id: knowledge.release_id,
  package_lock_sha256: files['package-lock.json'],
  source_script: { path: path.relative(root, __filename).replaceAll('\\', '/'), sha256: digest(fs.readFileSync(__filename)) },
  configured_database_read: false, provider_requests: 0, environment_or_profile_included: false,
};
fs.writeFileSync(path.join(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
const reference = {
  path: path.relative(root, output).replaceAll('\\', '/'),
  manifest_sha256: digest(fs.readFileSync(path.join(output, 'manifest.json'))),
  compiled_outputs: manifest.compiled_outputs, runtime_assets: manifest.runtime_assets,
  source_files: Object.keys(productionSources).length, knowledge_release_id: knowledge.release_id,
  package_lock_sha256: manifest.package_lock_sha256,
  release_authorized: false,
};
fs.writeFileSync(referencePath, JSON.stringify(reference, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(reference));
