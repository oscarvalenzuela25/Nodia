import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import { CreateProviderContactUseCase } from './create-provider-contact.use-case.js';
import { ProviderContactService } from '../provider-contact.service.js';
import { CreateProviderContactDto } from '../dto/provider-contact.dto.js';
const payload = (): CreateProviderContactDto => ({
  name: '  María Pérez  ',
  phone: [],
  email: null,
  description: null,
  schedule: {},
  is_active: false,
  request_key: '36d6d027-7e83-46df-86ab-75c929e9e10d',
});
describe('Create provider contact', () => {
  const service = { providerExists: vi.fn(), createOnce: vi.fn() };
  let useCase: CreateProviderContactUseCase;
  beforeEach(() => {
    vi.resetAllMocks();
    service.providerExists.mockResolvedValue(true);
    service.createOnce.mockImplementation(
      async (provider_id, creation_key, creation_hash, values) => ({
        ...values,
        id: '1',
        provider_id,
        version: 1,
        creation_key,
        creation_hash,
      }),
    );
    useCase = new CreateProviderContactUseCase(
      service as unknown as ProviderContactService,
    );
  });
  it('preserves personal name casing, optional data and false; hides persistence keys', async () => {
    const result = await useCase.execute('1', payload());
    expect(result).toMatchObject({
      name: 'María Pérez',
      phone: [],
      email: null,
      is_active: false,
      schedule: {},
    });
    expect(result).not.toHaveProperty('creation_hash');
    expect(result).not.toHaveProperty('creation_key');
  });
  it('rejects a missing provider without writing', async () => {
    service.providerExists.mockResolvedValue(false);
    await expect(useCase.execute('1', payload())).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(service.createOnce).not.toHaveBeenCalled();
  });
  it.each(['0', '-1', '9223372036854775808', '1 OR 1=1'])(
    'rejects invalid id %s',
    async (id) => {
      await expect(useCase.execute(id, payload())).rejects.toBeInstanceOf(
        BadRequestException,
      );
    },
  );
  it('accepts mobile and landline numbers and independent contact schedules', async () => {
    const dto = {
      ...payload(),
      phone: [{ number: '+56987654321' }, { number: '+56223456789' }],
      schedule: {
        monday: [{ from: '09:00', to: '12:00', description: ' Visita ' }],
      },
    };
    expect(await useCase.execute('1', dto)).toMatchObject({
      phone: dto.phone,
      schedule: {
        monday: [{ from: '09:00', to: '12:00', description: 'Visita' }],
      },
    });
  });
  it.each([
    { name: ' ' },
    { phone: [{ number: '912345678' }] },
    { phone: [{ number: '+569123' }] },
    { email: 'broken' },
    { schedule: { lunes: [] } },
    { schedule: { monday: [{ from: '12:00', to: '09:00' }] } },
    { schedule: { monday: [{ from: '09:00', to: '09:00' }] } },
    { schedule: { monday: [{ from: '24:00', to: '25:00' }] } },
    { schedule: { monday: [{ from: '09:00' }] } },
    { schedule: { monday: [{ from: '09:00', to: '10:00', arbitrary: true }] } },
    {
      schedule: {
        monday: [
          { from: '09:00', to: '10:00' },
          { from: '10:00', to: '11:00' },
        ],
      },
    },
    { description: 'x'.repeat(2001) },
    { is_active: null },
  ])(
    'rejects malformed contact data %# without persisting',
    async (changes) => {
      await expect(
        useCase.execute('1', {
          ...payload(),
          ...changes,
        } as CreateProviderContactDto),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(service.createOnce).not.toHaveBeenCalled();
    },
  );
  it('rejects duplicate valid international numbers before writing', async () => {
    await expect(
      useCase.execute('1', {
        ...payload(),
        phone: [{ number: '+56987654321' }, { number: '+56987654321' }],
      }),
    ).rejects.toThrow('duplicate phone');
    expect(service.createOnce).not.toHaveBeenCalled();
  });
  it('rejects replaying a creation key with different data', async () => {
    service.createOnce.mockResolvedValue({ creation_hash: 'different' });
    await expect(useCase.execute('1', payload())).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
  it('validates nested HTTP fields and rejects unknown body properties', async () => {
    const pipe = new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    await expect(
      pipe.transform(
        { ...payload(), phone: [{ number: '+56912345678', secret: true }] },
        { type: 'body', metatype: CreateProviderContactDto },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
