import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { UpdateProviderContactUseCase } from './update-provider-contact.use-case.js';
import { ProviderContactService } from '../provider-contact.service.js';
const contact = {
  id: '1',
  provider_id: '2',
  name: 'María',
  phone: [],
  email: null,
  schedule: { monday: [{ from: '09:00', to: '12:00' }] },
  description: 'Original',
  is_active: true,
  version: 1,
};
describe('Update provider contact', () => {
  const service = { find: vi.fn(), updateVersion: vi.fn() };
  const useCase = new UpdateProviderContactUseCase(
    service as unknown as ProviderContactService,
  );
  beforeEach(() => {
    vi.resetAllMocks();
    service.find.mockResolvedValue(contact);
    service.updateVersion.mockResolvedValue(true);
  });
  it('cannot update a contact through another provider', async () => {
    service.find.mockResolvedValue(null);
    await expect(
      useCase.execute('3', '1', { version: 1, is_active: false }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(service.updateVersion).not.toHaveBeenCalled();
  });
  it('deactivates without deleting phones, comments or schedule', async () => {
    await useCase.execute('2', '1', { version: 1, is_active: false });
    expect(service.updateVersion).toHaveBeenCalledWith(
      '2',
      '1',
      1,
      expect.objectContaining({
        is_active: false,
        schedule: contact.schedule,
        description: 'Original',
      }),
    );
  });
  it('rejects stale edits instead of overwriting another session', async () => {
    service.updateVersion.mockResolvedValue(false);
    service.find.mockResolvedValue({
      ...contact,
      name: 'Otra edición',
      version: 2,
    });
    await expect(
      useCase.execute('2', '1', { ...contact, name: 'Mi edición', version: 1 }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
  it('recovers a committed update with lost response without writing twice', async () => {
    service.updateVersion.mockResolvedValue(false);
    service.find.mockResolvedValue({
      ...contact,
      name: 'Mi edición',
      version: 2,
    });
    expect(
      await useCase.execute('2', '1', {
        ...contact,
        name: 'Mi edición',
        version: 1,
      }),
    ).toMatchObject({ version: 2, name: 'Mi edición' });
  });
  it('permits explicitly clearing optional collections and comments', async () => {
    await useCase.execute('2', '1', {
      ...contact,
      schedule: {},
      phone: [],
      description: null,
      email: null,
    });
    expect(service.updateVersion).toHaveBeenCalledWith(
      '2',
      '1',
      1,
      expect.objectContaining({ phone: [], schedule: {}, description: null }),
    );
  });
});
