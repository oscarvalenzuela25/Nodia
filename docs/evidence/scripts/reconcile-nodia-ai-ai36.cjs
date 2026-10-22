// Update only the two reviewed runtime sources; endpoint/module contracts do not change.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), assert = require('node:assert/strict');
process.chdir(path.resolve(__dirname, '../../..'));
const mode = process.argv[2] ?? '--check'; assert(['--write', '--check'].includes(mode));
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const inventoryFile = 'docs/mvp/nodia-ai-current-endpoints.json';
const evidenceFile = 'docs/evidence/nodia-ai-ai36-catalog-delta.json';
const allowed = [
  'nodia-server/src/nodia-ai-runtime/use-case/checkpoint-nodia-ai-job.use-case.ts',
  'nodia-server/src/nodia-ai-runtime/use-case/run-nodia-ai-stage.use-case.ts',
];
const inventory = read(inventoryFile);
assert.equal(inventory.sourceChecksums.length, 849);
assert.equal(inventory.counts.handlerOperations, 217);
assert.equal(inventory.counts.httpMethodPathPairs, 336);
const changes = inventory.sourceChecksums.filter(item => sha(item.file) !== item.sha256)
  .map(item => ({file: item.file, previous_sha256: item.sha256, sha256: sha(item.file)}));
for (const item of changes) assert(allowed.includes(item.file), 'Unreviewed source drift: ' + item.file);
if (mode === '--write' && changes.length) {
  assert.equal(changes.length, allowed.length);
  const before = sha(inventoryFile);
  for (const item of changes) inventory.sourceChecksums.find(source => source.file === item.file).sha256 = item.sha256;
  fs.writeFileSync(inventoryFile, JSON.stringify(inventory, null, 2) + '\n');
  fs.writeFileSync(evidenceFile, JSON.stringify({stage: 'AI-36', status: 'passed', inventory_file: inventoryFile,
    before_inventory_sha256: before, after_inventory_sha256: sha(inventoryFile), source_deltas: changes,
    sources: 849, handlers: 217, aliases: 336, endpoint_contracts_changed: false,
    tool_publication_changed: false, rationale: 'Proven local arming rejection does not quarantine a never-dispatched profile; uncertain SQL responses stay unknown.'}, null, 2) + '\n');
}
assert(changes.length === 0 || mode === '--write', 'Run --write after source review');
const evidence = read(evidenceFile);
assert.equal(evidence.after_inventory_sha256, sha(inventoryFile));
assert.equal(evidence.source_deltas.length, 2);
for (const item of inventory.sourceChecksums) assert.equal(sha(item.file), item.sha256, item.file);
for (const item of evidence.source_deltas) {assert(allowed.includes(item.file)); assert.equal(sha(item.file), item.sha256);}
console.log(JSON.stringify({stage: 'AI-36', status: 'passed', source_deltas: evidence.source_deltas.length, sources: inventory.sourceChecksums.length, handlers: 217, aliases: 336}));
