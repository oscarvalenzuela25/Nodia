// Prepare an additive packet from the tested compiled candidate. This never activates a runtime.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), cp = require('node:child_process'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../../..'), server = path.join(root, 'nodia-server');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const baseline = JSON.parse(fs.readFileSync(path.join(root, '.tmp/ai34-runtime-baseline.json'), 'utf8')).manifest;
assert.equal(Object.keys(baseline).length, 923);
const stage = JSON.parse(fs.readFileSync(path.join(server, '.tmp/ai34-stage-manifest.json'), 'utf8'));
for (const [relative, digest] of Object.entries(stage.files)) assert.equal(hash(fs.readFileSync(path.join(server, relative))), digest, 'SQL candidate drift ' + relative);
const candidate = Object.fromEntries(Object.keys(baseline).sort().map(relative => [relative, stage.files[relative] ?? baseline[relative]]));
for (const relative of Object.keys(stage.files).filter(file => file.startsWith('dist/') && file.endsWith('.js') && !/\.fixtures?\.js$/.test(file))) {
  if (candidate[relative]) continue;
  assert(relative.includes('/nodia-ai-') || relative === 'dist/migrations/1793000000000-CreateNodiaAiContextSnapshots.js', 'Unexpected added runtime output ' + relative);
  candidate[relative] = stage.files[relative];
}
const ts = require(path.join(server, 'node_modules/typescript')); let imports = 0;
for (const relative of Object.keys(candidate).filter(file => file.endsWith('.js') && !/\.fixtures?\.js$/.test(file))) {
  const sf = ts.createSourceFile(relative, fs.readFileSync(path.join(server, relative), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const reference = value => { if (!value.startsWith('.')) return; const target = path.posix.normalize(path.posix.join(path.posix.dirname(relative), value)); assert(candidate[target], 'Missing runtime import ' + relative + ' -> ' + target); imports++; };
  const visit = node => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteralLike(node.moduleSpecifier)) reference(node.moduleSpecifier.text);
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && node.arguments.length === 1 && ts.isStringLiteralLike(node.arguments[0])) reference(node.arguments[0].text);
    ts.forEachChild(node, visit);
  }; visit(sf);
}
const changed = Object.keys(baseline).filter(relative => candidate[relative] !== baseline[relative]).sort(), added = Object.keys(candidate).filter(relative => !baseline[relative]).sort();
const manifest = '.tmp/ai34-runtime-candidate-manifest.json', before = '.tmp/ai34-runtime-before-manifest.json', list = '.tmp/ai34-runtime-packet-files.txt';
fs.writeFileSync(path.join(server, manifest), JSON.stringify(candidate, null, 2) + '\n');
fs.writeFileSync(path.join(server, before), JSON.stringify(baseline, null, 2) + '\n');
fs.writeFileSync(path.join(server, list), [...changed, ...added, manifest, before].join('\n') + '\n');
const archive = path.join(root, '.tmp/ai34-runtime-packet.tar');
cp.execFileSync('tar', ['-cf', archive, '-T', list], { cwd: server, stdio: 'pipe' });
const report = { stage: 'AI-34', scope: 'additive_runtime_packet_preparation', status: 'prepared_not_activated', compiled_files: Object.keys(candidate).length, previous_compiled_files: 923, changed, added, relative_imports_verified: imports, sql_compiled_manifest_sha256: hash(fs.readFileSync(path.join(server, '.tmp/ai34-stage-manifest.json'))), candidate_manifest_sha256: hash(fs.readFileSync(path.join(server, manifest))), packet_sha256: hash(fs.readFileSync(archive)), test_sha256: stage.files['test/nodia-ai-ai34.integration.mjs'], production_database_migrated: false, services_restarted: false, provider_generations: 0, storage_operations: 0 };
fs.writeFileSync(path.join(root, '.tmp/ai34-runtime-packet.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
