import { describe, expect, it } from 'vitest';
import type { NodiaAiPreferenceService } from '../nodia-ai-preference.service.js';
import type { AuthorizeNodiaAiUseCase } from '../../nodia-ai/use-case/authorize-nodia-ai.use-case.js';
import { GetNodiaAiPreferenceOptionsUseCase } from './get-nodia-ai-preference-options.use-case.js';
import { GetNodiaAiPreferenceCatalogUseCase } from './get-nodia-ai-preference-catalog.use-case.js';
import { preferenceFixture } from './preference.fixture.js';
function fixture() {
  const f = preferenceFixture(),
    store = f.store as unknown as NodiaAiPreferenceService,
    auth = f.authorize as unknown as AuthorizeNodiaAiUseCase;
  return {
    ...f,
    options: new GetNodiaAiPreferenceOptionsUseCase(store, auth),
    catalog: new GetNodiaAiPreferenceCatalogUseCase(store, auth),
  };
}
describe('bounded named preference choices', () => {
  it.each([
    { scope_key: 'business', key: 'supplier_id' },
    { scope_key: 'finance', key: 'business_id' },
    {
      scope_key: 'finance',
      key: 'expense_category_id',
      business_id: '11111111-1111-4111-8111-111111111111',
    },
    { scope_key: 'rental', key: 'property_id', for_supplier_scope: true },
    { scope_key: 'business', key: 'business_id', for_supplier_scope: 'truthy' },
    {
      scope_key: 'finance',
      key: 'expense_category_id',
      search: 'x'.repeat(129),
    },
    { scope_key: 'finance', key: 'expense_category_id', page_limit: 51 },
  ])(
    'rejects cross-scope, invalid and excessive lookups before reading options %j',
    async (query) => {
      const f = fixture();
      await expect(f.options.execute(f.identity, query)).rejects.toThrow(
        'nodia_ai:invalid_input',
      );
    },
  );
  it('reauthorizes the target module instead of trusting a saved preference or route', async () => {
    const f = fixture();
    f.actor.modules = f.actor.modules.filter(
      (module) => module.route !== '/finances-personal',
    );
    await expect(
      f.options.execute(f.identity, {
        scope_key: 'finance',
        key: 'income_category_id',
      }),
    ).rejects.toThrow('nodia_ai:capability_denied');
  });
  it('exposes only registered metadata of currently assigned products', async () => {
    const f = fixture();
    f.actor.modules = f.actor.modules.filter(
      (module) =>
        module.route === '/finances-personal' ||
        module.route === '/nodia-ai',
    );
    expect(await f.catalog.execute(f.identity)).toEqual({
      items: [
        {
          scope_key: 'finance',
          key: 'expense_category_id',
          value_type: 'bigint',
          requires_business_scope: false,
        },
        {
          scope_key: 'finance',
          key: 'income_category_id',
          value_type: 'bigint',
          requires_business_scope: false,
        },
      ],
    });
  });
});
