import { describe, expect, it, vi } from 'vitest';
import type { DataSource } from 'typeorm';
import { ImportProvidersUseCase } from './import-providers.use-case.js';
import type { ImportProvidersDto } from '../dto/import-providers.dto.js';
const business_id = '11111111-1111-4111-8111-111111111111';
const item = { business_id, name: 'Sur', tax: 0, is_active: false };
describe('ImportProvidersUseCase input guarantees', () => {
  it.each([
    { items: [] },
    { items: [item, item] },
    { items: [{ ...item, id: '9223372036854775808' }] },
    { items: [{ ...item, tax: 19.5 }] },
    {
      items: [
        item,
        {
          ...item,
          business_id: '22222222-2222-4222-8222-222222222222',
          name: 'Otra',
        },
      ],
    },
    {
      items: [
        {
          ...item,
          contacts: [
            {
              name: 'Persona',
              phone: [],
              email: null,
              description: null,
              schedule: { monday: [{ from: '12:00', to: '09:00' }] },
              is_active: true,
            },
          ],
        },
      ],
    },
    {
      items: [
        {
          ...item,
          contacts: [
            {
              id: '1',
              name: 'Persona',
              phone: [],
              email: null,
              description: null,
              schedule: {},
              is_active: true,
            },
          ],
        },
      ],
    },
  ])('rejects invalid import before persistence: %j', async (dto) => {
    const source = { transaction: vi.fn() };
    const useCase = new ImportProvidersUseCase(source as unknown as DataSource);
    await expect(useCase.execute(dto as ImportProvidersDto)).rejects.toThrow();
    expect(source.transaction).not.toHaveBeenCalled();
  });
});
