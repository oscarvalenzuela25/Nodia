// Prepare the current compiled SQL candidate; never includes configured environment or dependencies.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), cp = require('node:child_process');
const root = path.resolve(__dirname, '../../..'), server = path.join(root, 'nodia-server');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const walk = relative => fs.readdirSync(path.join(server, relative), { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(relative + '/' + entry.name) : [relative + '/' + entry.name]);
const compiled = walk('dist').sort();
fs.mkdirSync(path.join(server, '.tmp'), { recursive: true });
const commonSchemaPath = '.tmp/ai36-regressions-common-schema.json';
fs.copyFileSync(path.join(root, 'docs/mvp/nodia-ai-v1-common-contracts.schema.json'), path.join(server, commonSchemaPath));
const input = [...compiled, 'package.json', 'package-lock.json', ...walk('test').filter(name => name.endsWith('.mjs')), 'scripts/nodia-ai-knowledge/contracts.schema.json', 'scripts/reconcile-nodia-ai-runtime.mjs', commonSchemaPath];
const files = Object.fromEntries(input.map(relative => [relative, hash(fs.readFileSync(path.join(server, relative)))]));
fs.mkdirSync(path.join(server, '.tmp'), { recursive: true });
const manifestPath = '.tmp/ai36-regressions-stage-manifest.json';
const manifest = { stage: 'AI-36', scope: 'compiled_disposable_sql_candidate', compiled_files: compiled.length, configured_environment_included: false, files };
fs.writeFileSync(path.join(server, manifestPath), JSON.stringify(manifest, null, 2) + '\n');
const archive = path.join(root, '.tmp/ai36-regressions-stage.tar');
const listPath = '.tmp/ai36-regressions-stage-files.txt';
fs.writeFileSync(path.join(server, listPath), [...input, manifestPath].join('\n') + '\n');
cp.execFileSync('tar', ['-cf', archive, '-T', listPath], { cwd: server, stdio: 'pipe' });
console.log(JSON.stringify({ stage: 'AI-36', compiled_files: compiled.length, manifest_sha256: hash(fs.readFileSync(path.join(server, manifestPath))), archive_sha256: hash(fs.readFileSync(archive)), archive_bytes: fs.statSync(archive).size, test_sha256: files['test/nodia-ai-ai36.integration.mjs'] }));


