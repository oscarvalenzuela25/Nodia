import assert from 'node:assert/strict';

export const SALES_CAPABILITY_IDS = Object.freeze([
  'nodia_sales_get',
  'nodia_sales_list',
  'nodia_sales_prepare_create',
  'nodia_sales_prepare_update',
  'nodia_sales_prepare_complete',
  'nodia_sales_prepare_cancel',
  'nodia_sales_prepare_discard',
]);

function capabilityIds(contracts, source) {
  assert.ok(Array.isArray(contracts) && contracts.length > 0, `${source}_contracts_missing`);
  const ids = contracts.map(contract => contract?.capability_id);
  assert.ok(ids.every(id => typeof id === 'string' && id.length > 0), `${source}_capability_id_invalid`);
  assert.equal(new Set(ids).size, ids.length, `${source}_capability_id_duplicate`);
  return ids.sort();
}

// Compare the complete collections, rather than a fixed count or selected tools.
// Requiring Sales also rejects the mutually consistent pre-POS publication.
export function assertPublishedCanaryCatalog(registryContracts, knowledgeContracts, requiredCapabilities = []) {
  const registered = capabilityIds(registryContracts, 'registry');
  const published = capabilityIds(knowledgeContracts, 'knowledge');
  assert.deepEqual(registered, published, 'published_capability_ids_mismatch');
  const ids = new Set(registered);
  for (const id of [...SALES_CAPABILITY_IDS, ...requiredCapabilities]) {
    assert.ok(ids.has(id), `required_capability_missing:${id}`);
  }
  return registered.length;
}
