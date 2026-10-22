// AI-05 documentation integrity only. Does not publish context or execute the backend.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../../..');
const text = file => fs.readFileSync(path.join(root, file), 'utf8');
const fm = require(path.join(root, 'nodia-server/scripts/nodia-ai-knowledge/frontmatter.cjs'));
const json = file => JSON.parse(text(file));
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex');
const coveragePath = 'docs/mvp/nodia-ai-ai05-knowledge-coverage.json';
const reportPath = 'docs/evidence/nodia-ai-ai05-knowledge-validation.json';
const inventory = json('docs/mvp/nodia-ai-current-endpoints.json');
const catalog = json('docs/mvp/nodia-ai-v1-tool-catalog.json');
const operations = inventory.controllers.flatMap(c => c.operations);
const handlers = new Map(operations.map(o => [o.operationId, o]));
const treatments = new Map(catalog.handlerCoverage.map(h => [h.operationId, h]));
const productIds = ['businesses', 'personal-finance', 'reservations', 'general-settings'];
const productSpecs = {
  businesses: 'docs/features/businesses/01-prd.md',
  'personal-finance': 'docs/mvp/22-personal-finance-contracts.md',
  reservations: 'docs/mvp/28-rental-reservations-contracts.md',
  'general-settings': 'docs/mvp/02-prd-v1.md',
};
const expectedFeatures = new Map();
for (const line of text('docs/mvp/45-nodia-ai-implementation-plan.md').split(/\r?\n/)) {
  const cells = line.split('|').map(s => s.trim());
  if (productIds.includes(cells[1])) expectedFeatures.set(cells[1], cells[2].split('; '));
}
assert.equal(expectedFeatures.size, 4, 'Plan product partition missing');
const section = (doc, title) => doc.split('## ' + title + '\n')[1]?.split('\n## ')[0];
const featureSections = ['Qué resuelve y qué significa', 'Solicitudes en lenguaje natural',
  'Operaciones y contratos', 'Datos mínimos y resolución de dudas', 'Reglas, acceso y restricciones',
  'Filtros e informes', 'Vista previa, confirmación y recuperación', 'Integración y evidencia',
  'Evolución y compatibilidad'];
const productSections = ['Propósito y alcance', 'Conceptos y relaciones', 'Módulos y autoridad',
  'Índice de funcionalidades', 'Interpretación de solicitudes que combinan funciones',
  'Restricciones y pendientes', 'Evolución y trazabilidad'];

function keys(value, expected) {
  assert(value && typeof value === 'object' && !Array.isArray(value), 'Expected object');
  assert.deepEqual(Object.keys(value).sort(), [...expected].sort(), 'Unknown/missing fields');
}

function validateCoverage(matrix, readDoc = text) {
  keys(matrix, ['date', 'kind', 'status', 'inventory', 'catalog', 'products', 'features', 'handlers', 'infrastructureExclusions']);
  assert.equal(matrix.kind, 'documentation_coverage_not_runtime_registry');
  assert.equal(matrix.status, 'draft_unregistered');
  assert.equal(matrix.inventory, 'docs/mvp/nodia-ai-current-endpoints.json');
  assert.equal(matrix.catalog, 'docs/mvp/nodia-ai-v1-tool-catalog.json');
  assert.deepEqual(matrix.products.map(p => p.id).sort(), [...productIds].sort(), 'Product coverage');
  assert.equal(new Set(matrix.features.map(f => f.id)).size, matrix.features.length, 'Duplicate feature');
  assert.equal(matrix.features.length, 27, 'Feature count');
  const features = new Map(matrix.features.map(f => [f.id, f]));
  const documents = new Map();
  for (const p of matrix.products) {
    keys(p, ['id', 'path']);
    assert.equal(p.path, `docs/nodia-ai/knowledge/${p.id}/README.md`, 'Product path');
    assert.deepEqual(matrix.features.filter(f => f.productId === p.id).map(f => f.id).sort(),
      expectedFeatures.get(p.id).map(id => p.id + '.' + id).sort(), 'Plan feature partition');
    documents.set(p.path, readDoc(p.path));
  }
  for (const f of matrix.features) {
    keys(f, ['id', 'productId', 'path']);
    assert(productIds.includes(f.productId), 'Unknown product');
    const key = f.id.slice(f.productId.length + 1);
    assert(/^[a-z][a-z0-9-]*$/.test(key), 'Invalid feature key');
    assert.equal(f.id, f.productId + '.' + key, 'Feature identity');
    assert.equal(f.path, `docs/nodia-ai/knowledge/${f.productId}/features/${key}.md`, 'Feature path');
    documents.set(f.path, readDoc(f.path));
  }
  for (const [file, doc] of documents) {
    const metadata = fm.parseDocument(doc).metadata;
    const feature = matrix.features.find(f => f.path === file);
    const id = feature?.id ?? matrix.products.find(p => p.path === file).id;
    assert.equal(metadata.document_id, id, 'Document identity');
    assert(Number.isInteger(metadata.revision) && metadata.revision >= 2, 'Document revision after AI-06 migration');
    assert.equal(metadata.document_status, 'draft', 'No automatic approval');
    assert.equal(metadata.approval, null, 'No automatic approval');
    assert.equal(metadata.integration_status, 'unregistered', 'No automatic publication');
    assert.equal(metadata.implementation.status, 'partial', 'Implementation scope');
    assert(metadata.maintainer && metadata.verification, 'Missing metadata');
    for (const title of feature ? featureSections : productSections) assert(section(doc, title)?.trim(), 'Missing section: ' + title);
    if (feature) {
      assert(metadata.sources.length > 0, 'Missing sources');
      assert((section(doc, 'Solicitudes en lenguaje natural').match(/^\| «/gm) ?? []).length >= 3, 'Missing examples');
      assert(doc.includes('../README.md'), 'Missing product backlink');
      assert(doc.includes('Pendientes con efecto sobre disponibilidad:'), 'Missing availability gates');
      const productDoc = documents.get(`docs/nodia-ai/knowledge/${feature.productId}/README.md`);
      assert(productDoc.includes(`features/${feature.id.split('.').at(-1)}.md`), 'Missing feature index link');
    }
  }
  assert.equal(matrix.handlers.length, handlers.size, 'Handler count');
  assert.equal(new Set(matrix.handlers.map(h => h.operationId)).size, handlers.size, 'Duplicate handler');
  const excluded = new Map(matrix.infrastructureExclusions.map(x => [x.operationId, x]));
  assert.equal(excluded.size, matrix.infrastructureExclusions.length, 'Duplicate exclusion');
  for (const entry of matrix.infrastructureExclusions) keys(entry, ['operationId', 'reason']);
  assert.deepEqual([...excluded.keys()].sort(), catalog.handlerCoverage.filter(h => h.treatment === 'infrastructure_only')
    .map(h => h.operationId).sort(), 'Unexplained infrastructure exclusion set');
  const allRows = new Map([...documents].filter(([p]) => p.includes('/features/')).map(([p, doc]) =>
    [p, [...doc.matchAll(/^\| \[([A-Za-z]+Controller\.\w+)\]/gm)].map(m => m[1])]));
  let aliases = 0;
  const mentionedTools = new Set();
  for (const h of matrix.handlers) {
    keys(h, ['operationId', 'featureId']);
    const op = handlers.get(h.operationId);
    assert(op, 'Unknown handler');
    const source = treatments.get(h.operationId);
    if (source.treatment === 'infrastructure_only') {
      assert.equal(h.featureId, null, 'Infrastructure is not a product tool');
      assert(excluded.get(h.operationId)?.reason, 'Unexplained infrastructure exclusion');
    } else {
      assert(features.has(h.featureId), 'Unmapped product handler');
      const f = features.get(h.featureId), doc = documents.get(f.path);
      assert.equal(allRows.get(f.path).filter(id => id === h.operationId).length, 1, 'Handler missing/duplicated in feature');
      assert(doc.includes('`' + op.method + ' ' + op.paths[0] + '`'), 'Incorrect route');
      for (const name of source.toolNames) {
        assert(doc.includes('`' + name + '`'), 'Missing catalog tool');
        mentionedTools.add(name);
      }
      if (source.treatment === 'deferred_bulk') assert(doc.includes('Excluida de v1'), 'Bulk exception missing');
      aliases += op.paths.length;
    }
  }
  for (const [file, rowIds] of allRows) assert.deepEqual([...rowIds].sort(),
    matrix.handlers.filter(h => features.get(h.featureId)?.path === file).map(h => h.operationId).sort(), 'Unexpected documented handler');
  for (const f of matrix.features) {
    const actual = new Set([...section(documents.get(f.path), 'Operaciones y contratos')
      .matchAll(/`(nodia_[a-z0-9_]+)`/g)].map(m => m[1]));
    const expected = new Set(matrix.handlers.filter(h => h.featureId === f.id)
      .flatMap(h => treatments.get(h.operationId).toolNames));
    assert.deepEqual([...actual].sort(), [...expected].sort(), 'Unknown documented tool');
  }
  for (const t of [...catalog.domainTools, ...catalog.secureFlowTools]) {
    assert(mentionedTools.has(t.name), 'Missing candidate tool coverage');
    const ids = new Set(t.sourceHandlerIds.map(id => matrix.handlers.find(h => h.operationId === id).featureId));
    assert.equal(ids.size, 1, 'One candidate split across incompatible feature bindings');
  }
  assert.equal(mentionedTools.size, catalog.domainTools.length + catalog.secureFlowTools.length, 'Unknown candidate tool');
  return { documents, productHandlers: matrix.handlers.filter(h => h.featureId).length,
    methodPathPairs: aliases, candidateTools: mentionedTools.size };
}

function validateLinks(file, doc, writing) {
  assert(!doc.includes('\uFFFD'), 'Invalid encoding');
  assert(!doc.split(/\r?\n/).some(l => /[\t ]+$/.test(l)), 'Trailing whitespace');
  const targets = [];
  if (doc.startsWith('---\n')) {
    const m = fm.parseDocument(doc).metadata;
    const references = [...m.sources.map(s => s.path), ...m.verification.evidence_paths];
    for (const reference of references) {
      assert(!reference.split('/').some(p => p === '..' || p === '.' || p.startsWith('.')), 'Invalid metadata path');
      const target = path.resolve(root, reference);
      assert(target.startsWith(root + path.sep) && fs.existsSync(target), 'Missing metadata reference');
      targets.push(reference);
    }
  }
  for (const m of doc.matchAll(/\[[^\]\n]+\]\(([^)\n]+)\)/g)) {
    const link = m[1].replace(/^<|>$/g, '').split('#')[0];
    if (!link || /^[a-z][a-z0-9+.-]*:\/\//i.test(link)) continue;
    const target = path.resolve(root, path.dirname(file), link);
    assert(target.startsWith(root + path.sep), 'Link outside repository');
    assert((writing && target === path.join(root, reportPath)) || fs.existsSync(target), 'Broken local link: ' + file + ' -> ' + link);
    targets.push(path.relative(root, target).replaceAll('\\', '/'));
  }
  return targets;
}

function main() {
  const matrix = json(coveragePath), validated = validateCoverage(matrix), negativeFixtures = [];
  function reject(name, mutate, pattern, override = null) {
    const copy = structuredClone(matrix); mutate(copy);
    assert.throws(() => validateCoverage(copy, file => override?.(file) ?? text(file)), pattern, name);
    negativeFixtures.push(name);
  }
  reject('duplicate feature', c => c.features[1] = structuredClone(c.features[0]), /Duplicate feature/);
  reject('missing feature', c => c.features.pop(), /Feature count/);
  reject('missing product', c => c.products.pop(), /Product coverage/);
  reject('outside feature path', c => c.features[0].path = '../outside.md', /Feature path/);
  reject('invented feature binding', c => c.handlers[0].featureId = 'invented.feature', /Unmapped product/);
  reject('missing handler', c => c.handlers.pop(), /Handler count/);
  reject('duplicate handler', c => c.handlers[1] = structuredClone(c.handlers[0]), /Duplicate handler/);
  reject('unknown handler', c => c.handlers[0].operationId = 'ImaginaryController.create', /Unknown handler/);
  reject('bulk cannot disappear', c => c.handlers.find(h => h.operationId === 'ProviderController.importCsv').featureId = null, /Unmapped product/);
  reject('infrastructure cannot become tool', c => c.handlers.find(h => h.operationId === 'AuthController.seed').featureId = 'general-settings.users', /Infrastructure is not/);
  reject('no unexplained exclusion', c => c.infrastructureExclusions.pop(), /Unexplained infrastructure/);
  reject('unknown manifest field', c => c.publish_all = true, /Unknown\/missing fields/);
  const first = matrix.features[0].path;
  function editMetadata(file, mutate) {
    if (file !== first) return null;
    const parsed = fm.parseDocument(text(file)); mutate(parsed.metadata);
    return fm.serializeDocument(parsed.metadata, parsed.body);
  }
  reject('no automatic approval', () => {}, /No automatic approval/,
    file => editMetadata(file, m => m.document_status = 'approved'));
  reject('no automatic publication', () => {}, /No automatic publication/,
    file => editMetadata(file, m => m.integration_status = 'published'));
  reject('minimum section required', () => {}, /Missing section/,
    file => file === first ? text(file).replace('## Datos mínimos y resolución de dudas', '## Other') : null);
  reject('candidate name cannot drift', () => {}, /Missing catalog tool/,
    file => file === first ? text(file).replace('`nodia_businesses_list`', '`invented_tool`') : null);
  reject('extra invented candidate rejected', () => {}, /Unknown documented tool/,
    file => file === first ? text(file).replace('Candidato; sin publicar', '`nodia_invented` Candidato; sin publicar') : null);
  assert.throws(() => validateLinks(first, '[bad](./missing-ai05-file.md)', false), /Broken local link/);
  negativeFixtures.push('broken local link rejected');

  const linkedSources = new Set(); let localLinksChecked = 0;
  for (const [file, doc] of validated.documents) {
    const links = validateLinks(file, doc, process.argv.includes('--write'));
    localLinksChecked += links.length;
    for (const link of links) if (link.startsWith('nodia-server/src/') || /^docs\/(mvp|features|architecture)\//.test(link)) linkedSources.add(link);
  }
  for (const p of matrix.products) {
    const index = text(productSpecs[p.id]);
    assert(index.includes(path.posix.relative(path.posix.dirname(productSpecs[p.id]), p.path)), 'Missing spec backlink: ' + p.id);
    const actual = fs.readdirSync(path.join(root, path.posix.dirname(p.path), 'features')).filter(p => p.endsWith('.md'));
    assert.equal(actual.length, matrix.features.filter(f => f.productId === p.id).length, 'Unindexed feature document');
  }
  for (const s of inventory.sourceChecksums) assert.equal(hash(s.file), s.sha256, 'Inventory source drift: ' + s.file);
  const summaryPath = 'docs/mvp/51-nodia-ai-ai05-product-knowledge.md';
  localLinksChecked += validateLinks(summaryPath, text(summaryPath), process.argv.includes('--write')).length;
  const artifacts = [...validated.documents.keys(), coveragePath, summaryPath, 'docs/evidence/scripts/validate-nodia-ai-ai05.cjs'];
  const report = {
    date: '2026-10-15', task: 'AI-05', status: 'documentation_complete_draft_unregistered',
    scope: 'Static AI-05 coverage/source integrity with canonical AI-06 frontmatter; not semantic runtime certification or publication',
    products: matrix.products.length, features: matrix.features.length, documents: validated.documents.size,
    inventoriedHandlers: handlers.size, productHandlersMapped: validated.productHandlers,
    infrastructureExcluded: matrix.infrastructureExclusions, productMethodPathPairs: validated.methodPathPairs,
    candidateToolsCovered: validated.candidateTools, deferredBulkHandlers: catalog.handlerCoverage.filter(h => h.treatment === 'deferred_bulk').length,
    negativeFixtures, localLinksChecked, sourceInventoryHashesChecked: inventory.sourceChecksums.length,
    linkedSourceHashes: [...linkedSources].sort().map(file => ({ file, sha256: hash(file) })),
    artifacts: artifacts.map(file => ({ file, sha256: hash(file) })),
    servicesStarted: false, businessWrites: 0, providerCalls: 0, publishedTools: 0,
    limitations: ['Natural-language facts reviewed against cited sources; structural checks do not prove semantic completeness',
      'No DB/HTTP/authentication/permission/transaction/provider tests executed for this documentation task',
      'Publication metadata/frontmatter contract, registry compilation and selective loading remain AI-06/12',
      'Source authority gaps and new super_admin behavior remain AI-07/08 and relevant domain stages',
      'No document approval, runtime deployment or migration']
  };
  if (process.argv.includes('--write')) fs.writeFileSync(path.join(root, reportPath), JSON.stringify(report, null, 2) + '\n');
  else assert.deepEqual(json(reportPath), report, 'Recorded AI-05 evidence drift; review then regenerate with --write');
  console.log(JSON.stringify({ status: report.status, products: report.products, features: report.features,
    productHandlersMapped: report.productHandlersMapped, inventoriedHandlers: report.inventoriedHandlers,
    productMethodPathPairs: report.productMethodPathPairs, candidateToolsCovered: report.candidateToolsCovered,
    negativeFixtures: negativeFixtures.length, localLinksChecked, sourceInventoryHashesChecked: report.sourceInventoryHashesChecked,
    publishedTools: 0, wroteEvidence: process.argv.includes('--write') }, null, 2));
}

if (require.main === module) main();
module.exports = { validateCoverage, validateLinks };
