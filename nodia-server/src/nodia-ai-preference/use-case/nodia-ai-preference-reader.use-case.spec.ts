import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { NodiaAiPreferenceService } from '../nodia-ai-preference.service.js';
import type { AuthorizeNodiaAiUseCase } from '../../nodia-ai/use-case/authorize-nodia-ai.use-case.js';
import { preferenceFingerprint } from '../types/preference.types.js';
import { NodiaAiPreferenceReaderUseCase } from './nodia-ai-preference-reader.use-case.js';
import { preferenceFixture } from './preference.fixture.js';
const reader = (f: ReturnType<typeof preferenceFixture>) =>
  new NodiaAiPreferenceReaderUseCase(
    f.store as unknown as NodiaAiPreferenceService,
    f.authorize as unknown as AuthorizeNodiaAiUseCase,
  );
describe('context preferences remain data, scoped and reauthorized', () => {
  it('loads only available own memories and takes the shared owner lock before reading', async () => {
    const f = preferenceFixture(),
      first = f.seed();
    f.seed({ key: 'income_category_id', value: '99' });
    const values = await reader(f).loadForContext(
      f.manager,
      f.identity,
      f.context.moduleRoutes,
    );
    expect(values).toHaveLength(1);
    expect(values[0]).toMatchObject({
      id: first.id,
      key: 'expense_category_id',
      value: '7',
      revision: 1,
    });
    expect(f.store.lockOwner.mock.invocationCallOrder[0]).toBeLessThan(
      f.store.list.mock.invocationCallOrder[0],
    );
  });
  it('restricts reference reads to the current authorized routes intersection', async () => {
    const f = preferenceFixture();
    f.seed();
    await reader(f).loadForContext(f.manager, f.identity, [
      '/reservations',
      '/unregistered',
    ]);
    expect(f.store.references.mock.calls[0][2]).toEqual([
      '/reservations',
    ]);
  });
  it('refuses a corrupt owner or scope hash instead of injecting it into context', async () => {
    const f = preferenceFixture();
    f.seed({ owner_id: '2' });
    await expect(
      reader(f).loadForContext(f.manager, f.identity, f.context.moduleRoutes),
    ).rejects.toThrow('nodia_ai:invalid_persisted_state');
    f.rows[0].owner_id = '1';
    f.rows[0].scope_hash = 'a'.repeat(64);
    await expect(
      reader(f).loadForContext(f.manager, f.identity, f.context.moduleRoutes),
    ).rejects.toThrow('nodia_ai:invalid_persisted_state');
  });
  it('does not silently truncate an excessive persisted collection', async () => {
    const f = preferenceFixture();
    for (let i = 0; i < 51; i++) f.seed();
    await expect(
      reader(f).loadForContext(f.manager, f.identity, f.context.moduleRoutes),
    ).rejects.toThrow('nodia_ai:invalid_persisted_state');
  });
  it('fingerprints the exact data independent of order and detects edit/delete/name changes', async () => {
    const f = preferenceFixture();
    f.seed();
    f.seed({ key: 'income_category_id', value: '8' });
    const values = await reader(f).loadForContext(
        f.manager,
        f.identity,
        f.context.moduleRoutes,
      ),
      hash = preferenceFingerprint(values);
    expect(preferenceFingerprint([...values].reverse())).toBe(hash);
    expect(preferenceFingerprint(values.slice(1))).not.toBe(hash);
    expect(
      preferenceFingerprint(
        values.map((item, index) => (index ? item : { ...item, revision: 2 })),
      ),
    ).not.toBe(hash);
    expect(
      preferenceFingerprint(
        values.map((item, index) =>
          index ? item : { ...item, value_label: 'Renamed' },
        ),
      ),
    ).not.toBe(hash);
    expect(
      preferenceFingerprint([
        { ...values[0], scope: { business_id: randomUUID() } },
      ]),
    ).not.toBe(hash);
  });
});
