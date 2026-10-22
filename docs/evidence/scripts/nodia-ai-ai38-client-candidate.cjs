// Freeze the completed Client build for review. This does not select a deployment origin or activate nginx.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../../..');
const source = path.join(root, 'nodia-client');
const stage = path.join(root, '.tmp/ai38-client-candidate01');
const target = path.join(stage, 'nodia-client');
const referencePath = path.join(root, 'docs/evidence/nodia-ai-ai38-client-candidate01.json');
assert(!fs.existsSync(stage) && !fs.existsSync(referencePath), 'never overwrite a frozen Client candidate');
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function walk(folder) {
  return fs.readdirSync(path.join(source, folder), { withFileTypes: true }).flatMap(item => {
    assert(!item.isSymbolicLink(), 'no symlink input');
    return item.isDirectory() ? walk(`${folder}/${item.name}`) : [`${folder}/${item.name}`];
  });
}
const files = {};
const compiled = walk('dist');
assert(compiled.includes('dist/index.html') && compiled.length < 10000);
for (const name of [...compiled, 'package.json', 'package-lock.json', 'vite.config.ts',
  'tsconfig.json', 'tsconfig.app.json', 'tsconfig.node.json']) {
  assert(!name.split('/').some(part => ['.env', 'node_modules', '..'].includes(part)));
  const from = path.join(source, name);
  assert(fs.lstatSync(from).isFile());
  const to = path.join(target, name);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
  files[name] = sha(to);
}
const productionSources = Object.fromEntries(walk('src')
  .filter(name => !name.startsWith('src/test/') && /\.(tsx?|css|svg)$/.test(name))
  .map(name => [name, sha(path.join(source, name))]));
const manifest = { schema_version: 1, stage: 'AI-38', scope: 'local_Client_production_build_not_deployment',
  files, production_sources: productionSources, build_outputs: compiled.length,
  tests_and_manual_entrypoints_excluded_from_source_manifest: true,
  target_origin_and_proxy_verified: false, configured_private_environment_copied: false,
  deployment: false };
fs.writeFileSync(path.join(target, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
const reference = { path: '.tmp/ai38-client-candidate01/nodia-client',
  manifest_sha256: sha(path.join(target, 'manifest.json')), build_outputs: compiled.length,
  production_source_count: Object.keys(productionSources).length,
  package_lock_sha256: files['package-lock.json'],
  scope: manifest.scope, target_origin_and_proxy_verified: false, deployment: false };
fs.writeFileSync(referencePath, JSON.stringify(reference, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(reference));
