// Snapshot a completed build for isolated verification, never deploy or read .env.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../../..');
const version = process.argv[2] ?? '01';
assert(/^[0][1-9]$/.test(version), 'explicit candidate version required');
const stage = path.join(root, `.tmp/ai37-node-candidate${version}`);
const output = path.join(stage, 'nodia-server');
assert(!fs.existsSync(stage), 'never replace a frozen AI37 candidate');
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const files = {};
function copy(relative) {
  assert(!relative.split('/').some(part => part === '.env' || part === 'node_modules'));
  const source = path.join(root, 'nodia-server', relative);
  assert(fs.lstatSync(source).isFile(), 'candidate input must be a regular file');
  const target = path.join(output, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
  files[relative] = digest(fs.readFileSync(target));
}
function walk(folder) {
  return fs.readdirSync(path.join(root, 'nodia-server', folder), { withFileTypes: true })
    .flatMap(item => item.isDirectory() ? walk(`${folder}/${item.name}`) : [`${folder}/${item.name}`]);
}
const compiled = walk('dist').filter(name => !name.endsWith('.tsbuildinfo'));
assert(compiled.length > 2000 && compiled.length < 5000);
for (const name of compiled) copy(name);
for (const name of fs.readdirSync(path.join(root, 'nodia-server/test')))
  if (name.endsWith('.mjs') && !name.startsWith('nodia-ai-ai37')) copy(`test/${name}`);
for (const name of ['package.json', 'package-lock.json', 'scripts/prepare-nodia-ai-restore.mjs']) copy(name);
const productionSources = Object.fromEntries(walk('src')
  .filter(name => name.endsWith('.ts') && !name.endsWith('.spec.ts'))
  .map(name => [name, digest(fs.readFileSync(path.join(root, 'nodia-server', name)))]));
const manifest = { schema_version: 1, stage: 'AI-37',
  scope: 'compiled_candidate_not_operational_adoption', files,
  production_sources: productionSources,
  compiled_outputs: compiled.length,
  runtime_assets: compiled.filter(name => /\.(js|json|md)$/.test(name)).length,
  configured_database_read: false, provider_requests: 0,
};
fs.writeFileSync(path.join(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
const reference = { path: path.relative(root, output).replaceAll('\\', '/'),
  manifest_sha256: digest(fs.readFileSync(path.join(output, 'manifest.json'))),
  compiled_outputs: manifest.compiled_outputs, runtime_assets: manifest.runtime_assets,
  source_files: Object.keys(productionSources).length,
};
const referencePath = path.join(root, `docs/evidence/nodia-ai-ai37-candidate${version}.json`);
assert(!fs.existsSync(referencePath), 'never replace a candidate reference');
fs.writeFileSync(referencePath, JSON.stringify(reference, null, 2) + '\n');
console.log(JSON.stringify(reference));
