import { describe, expect, it } from 'vitest';
import type { NodiaAiPreferenceService } from '../nodia-ai-preference.service.js';
import type { AuthorizeNodiaAiUseCase } from '../../nodia-ai/use-case/authorize-nodia-ai.use-case.js';
import { NodiaAiPreferenceReaderUseCase } from './nodia-ai-preference-reader.use-case.js';
import { ListNodiaAiPreferencesUseCase } from './list-nodia-ai-preferences.use-case.js';
import { preferenceFixture } from './preference.fixture.js';
function fixture() {
  const f = preferenceFixture(),
    store = f.store as unknown as NodiaAiPreferenceService,
    auth = f.authorize as unknown as AuthorizeNodiaAiUseCase;
  return {
    ...f,
    list: new ListNodiaAiPreferencesUseCase(
      store,
      auth,
      new NodiaAiPreferenceReaderUseCase(store, auth),
    ),
  };
}
describe('own preference inspection', () => {
  it('keeps unavailable own values visible for explicit forgetting, without stale names', async () => {
    const f = fixture(),
      row = f.seed();
    f.labels.clear();
    const result = await f.list.execute(f.identity, {});
    expect(result.items).toEqual([
      {
        preference_id: row.id,
        scope_key: 'finance',
        scope: {},
        key: 'expense_category_id',
        value: '7',
        revision: 1,
        value_label: null,
        scope_label: null,
        available: false,
      },
    ]);
  });
  it.each([
    { owner_id: '2' },
    { owner_user_id: '2' },
    { view: 'all' },
    { scope_key: 'system' },
    { page_limit: 51 },
    { cursor: null },
  ])(
    'rejects unregistered inspection or unbounded pagination %j',
    async (query) => {
      const f = fixture();
      f.actor.isSuperAdmin = true;
      await expect(f.list.execute(f.identity, query)).rejects.toThrow();
    },
  );
  it('binds paged cursors to the actor, session and scope', async () => {
    const f = fixture();
    const a = f.seed(),
      b = f.seed({ key: 'income_category_id' });
    f.rows.sort((a, b) => a.id.localeCompare(b.id));
    const page = await f.list.execute(f.identity, { page_limit: 1 });
    expect(page.items).toHaveLength(1);
    expect(page.next_cursor).toBeTruthy();
    const next = await f.list.execute(f.identity, {
      page_limit: 1,
      cursor: page.next_cursor,
    });
    expect(
      new Set([...page.items, ...next.items].map((item) => item.preference_id)),
    ).toEqual(new Set([a.id, b.id]));
    await expect(
      f.list.execute(f.identity, {
        cursor: page.next_cursor,
        scope_key: 'finance',
      }),
    ).rejects.toThrow('nodia_ai:invalid_cursor');
  });
});
