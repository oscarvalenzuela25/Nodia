import assert from 'node:assert/strict';
import { it } from 'node:test';
import { assertPublishedCanaryCatalog, SALES_CAPABILITY_IDS } from './fixtures/published-canary-catalog.mjs';

const contracts = ids => ids.map(capability_id => ({ capability_id }));
const currentIds = [...SALES_CAPABILITY_IDS, 'nodia_invoices_ocr', 'synthetic_existing_capability'];

it('matches complete IDs without fixing the published count or order', () => {
  const registry = contracts(currentIds);
  assert.equal(assertPublishedCanaryCatalog(registry, [...registry].reverse(), ['nodia_invoices_ocr']), registry.length);
  const expanded = contracts([...currentIds, 'synthetic_future_capability']);
  assert.equal(assertPublishedCanaryCatalog(expanded, expanded), expanded.length);
});

it('rejects a truncated manifest even when every Sales capability remains', () => {
  assert.throws(() => assertPublishedCanaryCatalog(contracts(currentIds), contracts(currentIds.slice(0, -1))), /published_capability_ids_mismatch/);
});

it('rejects different IDs with equal collection sizes', () => {
  assert.throws(() => assertPublishedCanaryCatalog(contracts(currentIds), contracts([...currentIds.slice(0, -1), 'synthetic_replacement'])), /published_capability_ids_mismatch/);
});

it('rejects matching collections missing any of the seven Sales capabilities', () => {
  for (const omitted of SALES_CAPABILITY_IDS) {
    const incomplete = contracts(currentIds.filter(id => id !== omitted));
    assert.throws(() => assertPublishedCanaryCatalog(incomplete, incomplete), /required_capability_missing:nodia_sales_/);
  }
});

it('retains the capability required by the individual canary', () => {
  const withoutOcr = contracts(currentIds.filter(id => id !== 'nodia_invoices_ocr'));
  assert.throws(() => assertPublishedCanaryCatalog(withoutOcr, withoutOcr, ['nodia_invoices_ocr']), /required_capability_missing:nodia_invoices_ocr/);
});

it('rejects duplicate or malformed identities instead of treating them as a set', () => {
  const valid = contracts(currentIds);
  assert.throws(() => assertPublishedCanaryCatalog([...valid, valid[0]], [...valid, valid[0]]), /registry_capability_id_duplicate/);
  assert.throws(() => assertPublishedCanaryCatalog(valid, [...valid, valid[0]]), /knowledge_capability_id_duplicate/);
  assert.throws(() => assertPublishedCanaryCatalog([{ capability_id: null }], valid), /registry_capability_id_invalid/);
  assert.throws(() => assertPublishedCanaryCatalog(valid, []), /knowledge_contracts_missing/);
});
