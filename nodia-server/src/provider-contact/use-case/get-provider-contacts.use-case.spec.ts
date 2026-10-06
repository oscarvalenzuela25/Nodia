import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { GetProviderContactsUseCase } from './get-provider-contacts.use-case.js';
import { ProviderContactService } from '../provider-contact.service.js';
describe('List provider contacts', () => {
  const service = { providerExists: vi.fn(), list: vi.fn() };
  const useCase = new GetProviderContactsUseCase(
    service as unknown as ProviderContactService,
  );
  beforeEach(() => {
    vi.resetAllMocks();
    service.providerExists.mockResolvedValue(true);
  });
  it('keeps empty results distinct from a nonexistent provider', async () => {
    service.list.mockResolvedValue({ data: [], meta: { total_items: 0 } });
    expect(await useCase.execute('2', { page: 1, limit: 25 })).toMatchObject({
      data: [],
    });
    service.providerExists.mockResolvedValue(false);
    await expect(
      useCase.execute('2', { page: 1, limit: 25 }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
  it.each([
    { page: 0, limit: 25 },
    { page: 1, limit: 101 },
    { page: 1.5, limit: 25 },
    { page: 1, limit: 25, search: 'x'.repeat(256) },
  ])('rejects unbounded query %#', async (query) => {
    await expect(useCase.execute('1', query)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(service.list).not.toHaveBeenCalled();
  });
});
