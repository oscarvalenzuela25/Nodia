import { describe, expect, it } from 'vitest';
import type { DataSource, EntityManager } from 'typeorm';
import { SeedRentalNavigationUseCase } from './seed-rental-navigation.use-case.js';
import { RentalNavigationService } from '../rental-navigation.service.js';

function fixture(failTranslation = false) {
  let writes = 0,
    committed = 0;
  const manager = {
    async query(sql: string) {
      if (sql.startsWith('SET LOCAL')) return [];
      if (sql.includes('translations') && failTranslation)
        throw new Error('Synthetic translation failure');
      if (sql.startsWith('INSERT')) writes++;
      if (sql.includes('module_groups')) return [{ id: '30' }];
      if (sql.includes('modules')) return [{ id: '31' }];
      return [];
    },
  } as unknown as EntityManager;
  const source = {
    async transaction(
      _isolation: string,
      callback: (manager: EntityManager) => Promise<unknown>,
    ) {
      const previous = writes;
      try {
        const result = await callback(manager);
        committed = writes;
        return result;
      } catch (error) {
        writes = previous;
        throw error;
      }
    },
  } as unknown as DataSource;
  return {
    useCase: new SeedRentalNavigationUseCase(
      source,
      new RentalNavigationService(),
    ),
    committed: () => committed,
    writes: () => writes,
  };
}
describe('Seed rental navigation as one unit of work', () => {
  it('returns the existing navigation identities after both language records finish', async () => {
    const f = fixture();
    expect(await f.useCase.execute()).toEqual({
      group_id: '30',
      module_id: '31',
    });
    expect(f.committed()).toBe(4);
  });
  it('propagates a translation failure so partial navigation cannot commit', async () => {
    const f = fixture(true);
    await expect(f.useCase.execute()).rejects.toThrow(
      'Synthetic translation failure',
    );
    expect(f.writes()).toBe(0);
    expect(f.committed()).toBe(0);
  });
});
