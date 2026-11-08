import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { auditCurrentCatalog, assertNoAdministrativeModuleFields, mergeCatalogExtensions } from '../scripts/nodia-ai-knowledge/catalog-audit.mjs';

function fixture() {
  const catalog = {
    domainTools: [{ name: 'nodia_fixture_get', kind: 'read', targetModuleRoute: '/tools/fixture', sourceHandlerIds: ['Fixture.get'], publication: { published: false } }],
    commonTools: [{ name: 'nodia_fixture_search', kind: 'read' }], secureFlowTools: [],
    handlerCoverage: [
      { operationId: 'Fixture.get', treatment: 'domain_tool', toolNames: ['nodia_fixture_get'] },
      { operationId: 'Fixture.bulk', treatment: 'deferred_bulk', toolNames: [] },
      { operationId: 'Fixture.recover', treatment: 'coordinator_internal', toolNames: [] },
    ],
  };
  const manifest = { capability_contracts: [{ capability_id: 'nodia_fixture_get', publication: 'published', kind: 'read', required_module_routes: ['/tools/fixture'] }] };
  const selection = { technical_tool_names: ['nodia_fixture_search'], default_profile_id: 'fixture', profiles: [{ profile_id: 'fixture', capability_ids: ['nodia_fixture_get'], required_capability_ids: ['nodia_fixture_get'] }] };
  return { catalog, manifest, selection, limits: { tools: 3, utf8Bytes: 1024 } };
}
const audit = ({ catalog, manifest, selection, limits }) => auditCurrentCatalog(catalog, manifest, selection, limits, 'nodia_fixture_select');

function extensionFixture() {
  const derivation = { kind: 'semantic_derivation', note: 'Shared native core; no legacy HTTP invocation.' };
  return { schema_version: 1,
    domainTools: [{ name: 'nodia_fixture_ocr', kind: 'analyze_attachment', targetModuleRoute: '/tools/fixture',
      sourceHandlerIds: ['Fixture.get'], backendBindings: [], derivation,
      publication: { published: false }, inputContract: { actions: ['prepare', 'request', 'read'] } }],
    handlerCoverage: [{ operationId: 'Fixture.get', toolNames: ['nodia_fixture_ocr'], derivation }],
  };
}

function newResourceExtension() {
  const extension = extensionFixture();
  Object.assign(extension.domainTools[0], {name:'nodia_sales_list',kind:'read',sourceHandlerIds:['SaleController.list']});
  Object.assign(extension.handlerCoverage[0], {operationId:'SaleController.list',toolNames:['nodia_sales_list']});
  extension.newHandlers=[{operationId:'SaleController.list',treatment:'domain_tool',toolNames:[],sourcePath:'nodia-server/src/sale/sale.controller.ts',method:'GET',path:'/api/v1/businesses/:businessId/sales'}];
  return extension;
}

describe('Explicit new resource cohorts remain metadata without publication authority', () => {
  it('adds a reviewed handler cohort without rewriting history or publishing its tool', () => {
    const f=fixture(),extension=newResourceExtension(),before=structuredClone(f.catalog);
    const merged=mergeCatalogExtensions(f.catalog,extension);
    assert.deepEqual(f.catalog,before);
    assert.deepEqual(merged.handlerCoverage.find(item=>item.operationId==='SaleController.list').toolNames,['nodia_sales_list']);
    assert.deepEqual(audit({...f,catalog:merged}).unpublished_candidates,['nodia_sales_list']);
  });
  for (const [label,mutate,code] of [
    ['path outside controller sources', e=>{e.newHandlers[0].sourcePath='../outside.ts';},'catalog_extension_new_handlers_invalid'],
    ['unsupported HTTP method',e=>{e.newHandlers[0].method='CONNECT';},'catalog_extension_new_handlers_invalid'],
    ['duplicate handler identity',e=>{e.newHandlers.push(structuredClone(e.newHandlers[0]));},'catalog_extension_handler_collision'],
    ['missing reciprocal coverage',e=>{e.handlerCoverage=[];},'catalog_extension_coverage_inconsistent'],
  ]) it(`rejects ${label}`,()=>{
    const extension=newResourceExtension();mutate(extension);
    assert.throws(()=>mergeCatalogExtensions(fixture().catalog,extension),{message:code});
  });
});

describe('Explicit catalog extensions preserve the historical baseline', () => {
  it('adds a semantic candidate and reciprocal coverage without modifying either input or counts', () => {
    const f = fixture(), extension = extensionFixture(); f.catalog.counts = { totalProposedTools: 2 };
    const before = structuredClone({ catalog: f.catalog, extension });
    const merged = mergeCatalogExtensions(f.catalog, extension);
    assert.equal(merged.domainTools.length, 2);
    assert.deepEqual(merged.counts, f.catalog.counts, 'counts remain the historical snapshot');
    assert.deepEqual(merged.handlerCoverage[0].toolNames, ['nodia_fixture_get', 'nodia_fixture_ocr']);
    assert.deepEqual(merged.handlerCoverage[1], f.catalog.handlerCoverage[1]);
    f.manifest.capability_contracts.push({ capability_id: 'nodia_fixture_ocr', publication: 'published', kind: 'analyze_attachment', required_module_routes: ['/tools/fixture'] });
    assert.throws(() => audit(f), { message: 'published_candidate_missing' });
    assert.equal(audit({ ...f, catalog: merged }).published_capabilities, 2);
    assert.deepEqual(audit({ ...f, catalog: merged }).historical_publication_flag_differences, ['nodia_fixture_get', 'nodia_fixture_ocr']);
    merged.domainTools[1].inputContract.actions.push('changed');
    merged.domainTools[0].publication.published = true;
    assert.deepEqual({ catalog: f.catalog, extension }, before, 'nested objects are independently cloned');
  });
  for (const [label, mutate, code] of [
    ['unknown schema version', (_f, e) => { e.schema_version = 2; }, 'catalog_extension_invalid'],
    ['unsupported top-level additions', (_f, e) => { e.commonTools = []; }, 'catalog_extension_invalid'],
    ['collision with historical candidate', (_f, e) => { e.domainTools[0].name = 'nodia_fixture_get'; }, 'catalog_extension_candidate_collision'],
    ['duplicate new candidate', (_f, e) => { e.domainTools.push(structuredClone(e.domainTools[0])); }, 'catalog_extension_candidate_collision'],
    ['unknown source handler', (_f, e) => { e.domainTools[0].sourceHandlerIds = ['Fixture.unknown']; }, 'catalog_extension_handler_unknown'],
    ['unknown coverage handler', (_f, e) => { e.handlerCoverage[0].operationId = 'Fixture.unknown'; }, 'catalog_extension_handler_unknown'],
    ['excluded handler promotion', (_f, e) => { e.domainTools[0].sourceHandlerIds = ['Fixture.bulk']; }, 'catalog_extension_handler_excluded'],
    ['legacy HTTP binding', (_f, e) => { e.domainTools[0].backendBindings = [{ operationId: 'Fixture.get' }]; }, 'catalog_extension_http_binding_denied'],
    ['publication flag promotion', (_f, e) => { e.domainTools[0].publication.published = true; }, 'catalog_extension_publication_denied'],
    ['missing semantic derivation', (_f, e) => { delete e.domainTools[0].derivation; }, 'catalog_extension_derivation_invalid'],
    ['orphan coverage', (_f, e) => { e.handlerCoverage[0].toolNames = ['nodia_unknown']; }, 'catalog_extension_coverage_inconsistent'],
    ['missing reciprocal coverage', (_f, e) => { e.handlerCoverage = []; }, 'catalog_extension_coverage_inconsistent'],
    ['duplicate coverage addition', (_f, e) => { e.handlerCoverage.push(structuredClone(e.handlerCoverage[0])); }, 'catalog_extension_coverage_duplicate'],
  ]) it(`rejects ${label} without changing inputs`, () => {
    const f = fixture(), extension = extensionFixture(); mutate(f, extension);
    const before = structuredClone({ catalog: f.catalog, extension });
    assert.throws(() => mergeCatalogExtensions(f.catalog, extension), { message: code });
    assert.deepEqual({ catalog: f.catalog, extension }, before);
  });
  it('admits the maintained OCR extension only as semantic lineage, not an HTTP or publication binding', () => {
    const read = (relative) => JSON.parse(readFileSync(new URL(relative, import.meta.url), 'utf8'));
    const baseline = read('../../docs/mvp/nodia-ai-v1-tool-catalog.json');
    const extension = read('../../docs/mvp/nodia-ai-v1-tool-catalog.extensions.json');
    const before = JSON.stringify(baseline), merged = mergeCatalogExtensions(baseline, extension);
    const tool = merged.domainTools.find((entry) => entry.name === 'nodia_invoices_ocr');
    assert.deepEqual(tool.backendBindings, []);
    assert.equal(tool.derivation.kind, 'semantic_derivation');
    assert.equal(tool.publication.published, false);
    assert.deepEqual(tool.inputContract.actions, ['prepare', 'request', 'read']);
    assert.equal(tool.implementationContract.schemaPath, 'nodia-server/src/nodia-ai-invoice-ocr/contracts/invoice-ocr.json');
    assert.ok(merged.handlerCoverage.find((entry) => entry.operationId === 'InvoiceController.analyze').toolNames.includes(tool.name));
    assert.equal(JSON.stringify(baseline), before);
  });
});

describe('Current publication audit independent of historical counts/flags', () => {
  it('uses the explicit publication and classifies technical/excluded handlers without granting them', () => {
    const f = fixture(); const before = structuredClone(f); const result = audit(f);
    assert.equal(result.published_capabilities, 1);
    assert.deepEqual(result.historical_publication_flag_differences, ['nodia_fixture_get']);
    assert.deepEqual(result.technical_candidates, ['nodia_fixture_search']);
    assert.deepEqual(result.unpublished_candidates, []);
    assert.deepEqual(result.excluded_handlers_by_treatment.deferred_bulk, ['Fixture.bulk']);
    assert.equal(result.generation_limits.discovery_tools, 2);
    assert.equal(result.generation_limits.selected_capabilities_maximum, 2);
    assert.deepEqual(f, before, 'audit must not author registry, catalog or profiles');
  });
  it('accepts growth through new explicit candidates and publication rather than a fixed release size', () => {
    const f = fixture();
    f.catalog.domainTools.push({ name: 'nodia_other_get', kind: 'read', sourceHandlerIds: ['Fixture.other'] });
    f.catalog.handlerCoverage.push({ operationId: 'Fixture.other', treatment: 'domain_tool', toolNames: ['nodia_other_get'] });
    f.manifest.capability_contracts.push({ capability_id: 'nodia_other_get', publication: 'published', kind: 'read' });
    assert.equal(audit(f).published_capabilities, 2);
    f.manifest.capability_contracts.pop();
    assert.deepEqual(audit(f).unpublished_candidates, ['nodia_other_get']);
  });
  for (const [label, mutate, code] of [
    ['duplicate candidate IDs', (f) => f.catalog.commonTools.push(f.catalog.domainTools[0]), 'candidate_duplicate'],
    ['duplicate published IDs', (f) => f.manifest.capability_contracts.push(f.manifest.capability_contracts[0]), 'published_duplicate'],
    ['orphan publication', (f) => { f.manifest.capability_contracts[0].capability_id = 'nodia_unknown_get'; }, 'published_candidate_missing'],
    ['changed operation kind', (f) => { f.manifest.capability_contracts[0].kind = 'prepare_change'; }, 'published_kind_mismatch'],
    ['missing target module', (f) => { f.manifest.capability_contracts[0].required_module_routes = ['/tools/other']; }, 'published_target_module_mismatch'],
    ['bulk candidate bound to publication', (f) => { f.catalog.domainTools[0].sourceHandlerIds.push('Fixture.bulk'); f.catalog.handlerCoverage[1].toolNames.push('nodia_fixture_get'); }, 'candidate_handler_excluded'],
    ['unmapped source handler', (f) => { f.catalog.domainTools[0].sourceHandlerIds.push('Missing.get'); }, 'candidate_handler_unmapped'],
    ['domain candidate without native handler', (f) => { f.catalog.domainTools[0].sourceHandlerIds = []; }, 'candidate_source_handlers_missing'],
    ['unpublished selected capability', (f) => { f.selection.profiles[0].capability_ids.push('nodia_unpublished_get'); }, 'selection_unpublished'],
    ['duplicate selection', (f) => { f.selection.profiles[0].capability_ids.push('nodia_fixture_get'); }, 'selection_capability_duplicate'],
    ['selection exceeds generation ceiling', (f) => { f.limits.tools = 1; }, 'catalog_limits_invalid'],
    ['required capability outside profile', (f) => { f.selection.profiles[0].required_capability_ids = ['nodia_unknown_get']; }, 'selection_required_missing'],
    ['technical capability included in product publication', (f) => { f.selection.technical_tool_names.push('nodia_fixture_get'); }, 'technical_published_overlap'],
  ]) it(`rejects ${label}`, () => {
    const f = fixture(); mutate(f); assert.throws(() => audit(f), { message: code });
  });
});

describe('Published Core module metadata stays outside MCP', () => {
  it('rejects administrative fields through the reachable schema graph', () => {
    const schema = { $defs: { Parent: { properties: { ordering: { type: 'object' } } } } };
    assert.throws(() => assertNoAdministrativeModuleFields('nodia_modules_get', schema), { message: 'administrative_module_field_published' });
    assert.throws(() => assertNoAdministrativeModuleFields('nodia_module_groups_prepare_create', { properties: { sort_order: {} } }), { message: 'administrative_module_field_published' });
  });
  it('allows ordinary module fields and does not invent restrictions for other products', () => {
    assert.doesNotThrow(() => assertNoAdministrativeModuleFields('nodia_modules_list', { properties: { id: {}, key: {}, module_group: { properties: { name: {} } } } }));
    assert.doesNotThrow(() => assertNoAdministrativeModuleFields('nodia_other_list', { properties: { sort_order: {} } }));
  });
  for (const pattern of ['^sort_order$', '.*', '^(?:expected_neighbor|safe)$'])
    it(`rejects a pattern admitting administrative fields: ${pattern}`, () => {
      const schema = { type: 'object', additionalProperties: false, patternProperties: { [pattern]: { type: 'integer' } } };
      assert.throws(() => assertNoAdministrativeModuleFields('nodia_modules_list', schema), { message: 'administrative_module_field_published' });
    });
  it('inspects patterns reached through references and schema composition', () => {
    const schema = { allOf: [{ $ref: '#/$defs/Parent' }], $defs: { Parent: { anyOf: [{ type: 'object', patternProperties: { '^ordering$': {} } }] } } };
    assert.throws(() => assertNoAdministrativeModuleFields('nodia_module_groups_get', schema), { message: 'administrative_module_field_published' });
  });
  it('allows constrained patterns that admit no administrative name and other products maps', () => {
    assert.doesNotThrow(() => assertNoAdministrativeModuleFields('nodia_modules_get', { type: 'object', patternProperties: { '^label_[a-z]+$': { type: 'string' } } }));
    assert.doesNotThrow(() => assertNoAdministrativeModuleFields('nodia_other_get', { properties: { fields: { patternProperties: { '.*': {} } } } }));
  });
});
