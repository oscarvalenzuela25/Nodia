import { describe, expect, it, vi } from 'vitest';
import { ValidationPipe } from '@nestjs/common';
import { BusinessService } from '../business.service.js';
import { CreateBusinessDto } from '../dto/create-business.dto.js';
import { UpdateBusinessDto } from '../dto/update-business.dto.js';
import { Business } from '../entities/business.entity.js';
import { CreateBusinessUseCase } from './create-business.use-case.js';
import { UpdateBusinessUseCase } from './update-business.use-case.js';

type Dependencies = ConstructorParameters<typeof BusinessService>;
const pipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true });

function fixture() {
  const business = Object.assign(new Business(), {
    id: '9601aa95-dd70-4af3-a5cf-50dd553a4ae9', owner_id: '42',
    name: 'Existing business', has_description: true, is_active: true,
  });
  const repository = {
    create: vi.fn((data: Partial<Business>) => Object.assign(business, data)),
    save: vi.fn(async (data: Business) => data),
  };
  const rolesQuery = { innerJoin() { return this; }, where() { return this; },
    andWhere() { return this; }, async getCount() { return 0; } };
  const translations = { saveTranslations: vi.fn(), updateTranslations: vi.fn() };
  const service = new BusinessService(
    repository as unknown as Dependencies[0], {} as Dependencies[1],
    {} as Dependencies[2], {} as Dependencies[3], {} as Dependencies[4],
    { createQueryBuilder: () => rolesQuery } as unknown as Dependencies[5],
    translations as unknown as Dependencies[6],
  );
  vi.spyOn(service, 'findOne').mockResolvedValue(business);
  return { service, business, repository, translations };
}

describe('Business description through create/update use cases', () => {
  it.each([
    { name: 'No description' },
    { name: 'No description', translates: [] },
    { name: 'No description', translates: [{ key: 'description', es: '', en: '' }] },
    { name: 'No description', translates: [{ key: 'description' }] },
  ])('creates without a description: %j', async (body) => {
    const { service, repository } = fixture();
    const dto = await pipe.transform(body, { type: 'body', metatype: CreateBusinessDto });
    const result = await new CreateBusinessUseCase(service).execute('42', dto);
    expect(result.has_description).toBe(false);
    expect(repository.save).toHaveBeenCalledWith(expect.objectContaining({ owner_id: '42', has_description: false }));
  });

  it.each([
    { key: 'description', es: 'Descripción', en: '' },
    { key: 'description', es: '', en: 'Description' },
    { key: 'comment', es: 'Comentario', en: '' },
  ])('accepts a description in only one language: %j', async (description) => {
    const { service } = fixture();
    const dto = await pipe.transform({ name: 'Business', translates: [description] }, { type: 'body', metatype: CreateBusinessDto });
    expect((await new CreateBusinessUseCase(service).execute('42', dto)).has_description).toBe(true);
  });

  it('clears an existing description on update', async () => {
    const { service, translations } = fixture();
    const dto = await pipe.transform({ translates: [{ key: 'description', es: '', en: '' }] }, { type: 'body', metatype: UpdateBusinessDto });
    const result = await new UpdateBusinessUseCase(service).execute('9601aa95-dd70-4af3-a5cf-50dd553a4ae9', '42', dto);
    expect(result.has_description).toBe(false);
    expect(translations.updateTranslations).toHaveBeenCalledWith('businesses', result.id, [{ key: 'description', es: '', en: '' }]);
  });

  it.each([
    { name: '' },
    { name: 'Business', translates: [{ key: 'description', es: 123, en: '' }] },
    { name: 'Business', translates: [{ key: 'description', es: '', en: {} }] },
    { name: 'Business', translates: [{ key: '', es: '', en: '' }] },
    { name: 'Business', translates: [{ key: 'name', es: 'Nombre', en: '' }] },
  ])('rejects malformed input and retains required translation validation: %j', async (body) => {
    await expect(pipe.transform(body, { type: 'body', metatype: CreateBusinessDto })).rejects.toMatchObject({ status: 400 });
  });
});
