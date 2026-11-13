import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import frontmatter from '../scripts/nodia-ai-knowledge/frontmatter.cjs';
import { auditSalesReadOnlyPublication } from '../scripts/check-nodia-ai-pos-candidate.mjs';

const root = new URL('../../', import.meta.url);
const load = name => JSON.parse(readFileSync(new URL(name, root), 'utf8'));
function current() {
  const candidate = load('nodia-server/config/nodia-ai-pos-publication.candidate.json');
  return { candidate,
    registry: load(candidate.registry_path), extension: load(candidate.catalog_extension_path),
    document: frontmatter.parseDocument(readFileSync(new URL(candidate.document_review.path, root), 'utf8')) };
}

describe('Sales publication only exposes authorized informational reads', () => {
  it('keeps the two reads and already-approved report semantics without approving a new document', () => {
    const value = current();
    const result = auditSalesReadOnlyPublication(value);
    assert.deepEqual(result.read_tools, ['nodia_sales_get', 'nodia_sales_list']);
    assert.deepEqual(result.context_sections, ['Filtros e informes']);
    assert.equal(result.approved_document_revision, 5);
    assert.equal(result.approval_created, false);
    assert.equal(result.retirement_catalog_release, value.candidate.catalog_release);
    assert.equal(result.catalog_release, value.registry.catalog_release);
  });
  it('allows an unrelated catalog revision while preserving the exact sales authority and approved document', () => {
    const value = current();
    const binding = structuredClone(value.registry.bindings.find(item => item.fragment_id === 'pos-sales-v1'));
    const approval = structuredClone(value.document.metadata.approval);
    value.registry.catalog_release += '-synthetic-unrelated';
    const result = auditSalesReadOnlyPublication(value);
    assert.equal(result.catalog_release, value.registry.catalog_release);
    assert.equal(result.approval_created, false);
    assert.deepEqual(value.registry.bindings.find(item => item.fragment_id === 'pos-sales-v1'), binding);
    assert.deepEqual(value.document.metadata.approval, approval);
  });
  it('rejects a stale binding revision or schema even when both named capabilities remain reads', () => {
    for (const field of ['revision', 'input_schema_sha256', 'output_schema_sha256']) {
      const value = current();
      const requirement = value.registry.bindings.find(item => item.fragment_id === 'pos-sales-v1').requires[0];
      requirement[field] = field === 'revision' ? requirement.revision + 1 : '0'.repeat(64);
      assert.throws(() => auditSalesReadOnlyPublication(value), /sales_read_contract_binding_mismatch/);
    }
  });
  it('rejects changing the required module, fragment purpose or projected document identity', () => {
    for (const [field, replacement] of [
      ['required_module_routes', ['/tools/reservations']],
      ['purpose', 'report_semantics'],
      ['fragment_id', 'synthetic-replacement'],
    ]) {
      const value = current();
      value.registry.bindings.find(item => item.fragment_id === 'pos-sales-v1')[field] = replacement;
      assert.throws(() => auditSalesReadOnlyPublication(value), /sales_read_only_binding_invalid/);
    }
    const scope = current();
    scope.registry.capabilities.find(item => item.capability_id === 'nodia_sales_get').required_module_routes = ['/tools/reservations'];
    assert.throws(() => auditSalesReadOnlyPublication(scope), /sales_read_contract_binding_mismatch/);
  });
  it('rejects a sales writer even when its declaration is structurally valid', () => {
    const value = current();
    const write = structuredClone(value.registry.capabilities.find(cap => cap.capability_id === 'nodia_sales_get'));
    write.capability_id = 'nodia_sales_prepare_create'; write.kind = 'prepare_change';
    value.registry.capabilities.push(write);
    assert.throws(() => auditSalesReadOnlyPublication(value), /sales_write_capability_published/);
  });
  it('rejects projecting a mixed write section from the unchanged historical document', () => {
    const value = current();
    value.registry.bindings.find(binding => binding.fragment_id === 'pos-sales-v1').sections.push('Operaciones y contratos');
    assert.throws(() => auditSalesReadOnlyPublication(value), /sales_read_only_binding_invalid/);
  });
  it('rejects a catalog writer and does not treat an unapproved revision as the old approval', () => {
    const value = current();
    const writer = structuredClone(value.extension.domainTools.find(tool => tool.name === 'nodia_sales_get'));
    writer.name = 'nodia_sales_prepare_update'; writer.kind = 'prepare_change';
    value.extension.domainTools.push(writer);
    assert.throws(() => auditSalesReadOnlyPublication(value), /sales_write_catalog_candidate_present/);
    const draft = current();
    draft.document.metadata.revision = 6; draft.document.metadata.document_status = 'draft'; draft.document.metadata.approval = null;
    assert.throws(() => auditSalesReadOnlyPublication(draft), /sales_approved_document_changed/);
  });
  it('the legacy --apply command fails before it can author registry, extensions or approval', () => {
    const value = current();
    const paths = [value.candidate.registry_path, value.candidate.catalog_extension_path, value.candidate.document_review.path];
    const before = paths.map(name => readFileSync(new URL(name, root)));
    const run = spawnSync(process.execPath, ['scripts/check-nodia-ai-pos-candidate.mjs', '--apply'], {
      cwd: fileURLToPath(new URL('nodia-server/', root)), encoding: 'utf8', timeout: 10_000,
    });
    assert.equal(run.status, 1);
    assert.equal(JSON.parse(run.stderr.trim()).code, 'sales_read_only_check_argument_invalid');
    paths.forEach((name, index) => assert.deepEqual(readFileSync(new URL(name, root)), before[index]));
  });
});
