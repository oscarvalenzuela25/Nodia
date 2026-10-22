// Prepare the tested incremental runtime. This script never deploys or loads configured environment.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), cp = require('node:child_process'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../../..'), server = path.join(root, 'nodia-server');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const baseline = JSON.parse(fs.readFileSync(path.join(root, '.tmp/ai35-runtime-baseline.json'), 'utf8')).manifest;
const sqlFile = path.join(root, '.tmp/ai35-backend-sql-manifest.json'), sql = JSON.parse(fs.readFileSync(sqlFile, 'utf8'));
assert.equal(Object.keys(baseline).length, 931);
for (const [relative, digest] of Object.entries(sql.files)) assert.equal(hash(fs.readFileSync(path.join(server, relative))), digest, 'SQL candidate drift ' + relative);
const candidate = Object.fromEntries(Object.keys(baseline).sort().map(relative => { assert(sql.files[relative], relative); return [relative, sql.files[relative]]; }));
const migration = 'dist/migrations/1793100000000-AddNodiaAiTextSearchIndex.js';
assert(!candidate[migration] && sql.files[migration]); candidate[migration] = sql.files[migration];
const added = Object.keys(sql.files).filter(file => file.startsWith('dist/') && /\.(?:js|json)$/.test(file) && !/\.fixtures?\.js$/.test(file) && !baseline[file]);
assert.deepEqual(added, [migration]);
const ts = require(path.join(server, 'node_modules/typescript')); let imports = 0;
// Historical fixture outputs remain byte-identical in the baseline; they are not
// application entry points and their test-only dependency graph is not shipped.
for (const relative of Object.keys(candidate).filter(file => file.endsWith('.js') && !/\.fixtures?\.js$/.test(file))) {
  const source = ts.createSourceFile(relative, fs.readFileSync(path.join(server, relative), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const reference = value => { if (!value.startsWith('.')) return; const target = path.posix.normalize(path.posix.join(path.posix.dirname(relative), value)); assert(candidate[target], 'Missing runtime import ' + relative + ' -> ' + target); imports++; };
  const visit = node => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteralLike(node.moduleSpecifier)) reference(node.moduleSpecifier.text);
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && node.arguments.length === 1 && ts.isStringLiteralLike(node.arguments[0])) reference(node.arguments[0].text);
    ts.forEachChild(node, visit);
  }; visit(source);
}
const changed = Object.keys(baseline).filter(relative => baseline[relative] !== candidate[relative]).sort();
assert(changed.length && changed.every(relative => relative.includes('/nodia-ai-') || relative.startsWith('dist/nodia-ai/')));
const manifest = '.tmp/ai35-runtime-candidate-manifest.json', before = '.tmp/ai35-runtime-before-manifest.json', list = '.tmp/ai35-runtime-packet-files.txt';
fs.mkdirSync(path.join(server, '.tmp'), {recursive: true});
fs.writeFileSync(path.join(server, manifest), JSON.stringify(candidate, null, 2) + '\n');
fs.writeFileSync(path.join(server, before), JSON.stringify(baseline, null, 2) + '\n');
fs.writeFileSync(path.join(server, list), [...changed, ...added, manifest, before].join('\n') + '\n');
const archive = path.join(root, '.tmp/ai35-runtime-packet.tar');
cp.execFileSync('tar', ['-cf', archive, '-T', list], {cwd: server, stdio: 'pipe'});
const report = {stage: 'AI-35', scope: 'incremental_runtime_packet_preparation', status: 'prepared_not_activated',
  previous_compiled_files: 931, compiled_files: Object.keys(candidate).length, changed, added, relative_imports_verified: imports,
  sql_manifest_sha256: hash(fs.readFileSync(sqlFile)), candidate_manifest_sha256: hash(fs.readFileSync(path.join(server, manifest))),
  packet_sha256: hash(fs.readFileSync(archive)), native_restart_required: false, provider_generations: 0, configured_database_modified: false};
fs.writeFileSync(path.join(root, '.tmp/ai35-runtime-packet.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
