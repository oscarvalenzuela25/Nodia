import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UpdateInvoiceUseCase } from './update-invoice.use-case.js';
import { InvoiceService } from '../invoice.service.js';
import type { EntityManager, Repository } from 'typeorm';
import { Invoice } from '../entities/invoice.entity.js';
import type { UpdateInvoiceDto } from '../dto/update-invoice.dto.js';

const nativeBusiness = '11111111-1111-4111-8111-111111111111';
function nativeManager(repository: object, invoice: Invoice) {
  const before = { ...structuredClone(invoice), business_id: invoice.business_id ?? nativeBusiness, provider_id: invoice.provider_id ?? null };
  const query = vi.fn(async (sql: string, args: unknown[] = []) => {
    if (sql.includes('FROM invoices')) return [structuredClone(before)];
    if (sql.includes('FROM businesses')) return (args[0] as string[]).map(id => ({ id }));
    if (sql.includes('FROM providers')) return [{ id: args[0], business_id: before.business_id }];
    throw new Error('Unexpected SQL');
  });
  const manager = { getRepository: vi.fn(() => repository), query, queryRunner: { isTransactionActive: true } } as unknown as EntityManager;
  Object.assign(repository, { manager: { transaction: vi.fn(async (work: (transaction: EntityManager) => unknown) => work(manager)) } });
  return manager;
}

describe('UpdateInvoiceUseCase', () => {
  let useCase: UpdateInvoiceUseCase;
  let invoiceServiceMock: Partial<InvoiceService>;

  beforeEach(() => {
    invoiceServiceMock = {
      updateInvoice: vi.fn(),
    };
    useCase = new UpdateInvoiceUseCase(invoiceServiceMock as InvoiceService);
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  it('should call invoiceService.updateInvoice with id and dto, returning updated invoice', async () => {
    const id = '1';
    const dto: UpdateInvoiceDto = {
      path_storage: '/invoices/inv-001-updated.pdf',
      is_active: true,
    };

    const updated = {
      id,
      business_id: 'b7b80a11-827c-4712-9c17-9150d0325d7b',
      provider_id: '1',
      code: 'INV-2026-001',
      total_amount: 154000,
      path_storage: dto.path_storage,
      data: {},
      is_active: dto.is_active,
      created_at: new Date(),
      updated_at: new Date(),
    };

    vi.mocked(invoiceServiceMock.updateInvoice!).mockResolvedValue(updated as any);

    const result = await useCase.execute(id, dto);

    expect(invoiceServiceMock.updateInvoice).toHaveBeenCalledTimes(1);
    expect(invoiceServiceMock.updateInvoice).toHaveBeenCalledWith(id, dto);
    expect(result).toEqual(updated);
  });

  it('reads and writes the invoice exclusively through the inherited transaction repository', async () => {
    const invoice = { id: '7', code: 'old', path_storage: 'invoices/synthetic/file.pdf', total_amount: 19, data: { old: true } } as unknown as Invoice;
    const transactional = { findOne: vi.fn(async () => invoice), save: vi.fn(async (value: Invoice) => value) };
    const global = { findOne: vi.fn(() => { throw new Error('global read forbidden'); }), save: vi.fn(() => { throw new Error('global write forbidden'); }) };
    const manager = nativeManager(transactional, invoice);
    const real = new UpdateInvoiceUseCase(new InvoiceService(global as unknown as Repository<Invoice>));
    await expect(real.execute('7', { code: 'new', total_amount: 0, data: {} }, manager)).resolves.toMatchObject({ id: '7', code: 'new', total_amount: 0, data: {}, path_storage: 'invoices/synthetic/file.pdf' });
    expect(global.findOne).not.toHaveBeenCalled(); expect(global.save).not.toHaveBeenCalled();
    expect(manager.getRepository).toHaveBeenCalledWith(Invoice);
  });

  it('rejects an inactive inherited transaction before invoking persistence', async () => {
    await expect(useCase.execute('7', { code: 'new' }, {} as EntityManager)).rejects.toThrow('active transaction');
    expect(invoiceServiceMock.updateInvoice).not.toHaveBeenCalled();
  });

  it('preserves omitted total, data, file and inactive state on a code-only inherited update', async () => {
    const original = { id: '7', code: 'old', total_amount: 531, data: { items: [{ quantity: 0 }] }, path_storage: 'invoices/synthetic/kept.pdf', is_active: false } as unknown as Invoice;
    const repository = { findOne: vi.fn(async () => structuredClone(original)), save: vi.fn(async (value: Invoice) => value) };
    const manager = nativeManager(repository, original);
    const real = new UpdateInvoiceUseCase(new InvoiceService({} as Repository<Invoice>));
    const result = await real.execute('7', { code: 'new' }, manager);
    expect(result).toEqual({ ...original, code: 'new' });
  });

  it.each([null, '9'])('does not let a hydrated previous provider restore the FK when updating it to %s', async (providerId) => {
    const invoice = { id: '7', provider_id: '8', provider: { id: '8', name: 'Old provider' }, business_id: '11111111-1111-4111-8111-111111111111', business: { id: '11111111-1111-4111-8111-111111111111' } } as unknown as Invoice;
    const save = vi.fn(async (value: Invoice) => value);
    const repository = { findOne: vi.fn(async () => invoice), save };
    const manager = nativeManager(repository, invoice);
    const real = new UpdateInvoiceUseCase(new InvoiceService({} as Repository<Invoice>));
    const result = await real.execute('7', { provider_id: providerId }, manager);
    expect(result.provider_id).toBe(providerId);
    expect(result.provider).toBe(providerId === null ? null : undefined);
    expect(result.business).toEqual({ id: '11111111-1111-4111-8111-111111111111' });
    expect(save).toHaveBeenCalledWith(result);
  });

  it('clears only the stale hydrated business on transfer through the legacy writer', async () => {
    const source = '11111111-1111-4111-8111-111111111111';
    const destination = '22222222-2222-4222-8222-222222222222';
    const invoice = { id: '7', provider_id: '8', provider: { id: '8' }, business_id: source, business: { id: source }, total_amount: 12, path_storage: '', data: { kept: true }, is_active: false } as unknown as Invoice;
    const repository = { findOne: vi.fn(async () => invoice), save: vi.fn(async (value: Invoice) => value) };
    nativeManager(repository, invoice);
    const real = new UpdateInvoiceUseCase(new InvoiceService(repository as unknown as Repository<Invoice>));
    const result = await real.execute('7', { business_id: destination, provider_id: null });
    expect(result).toMatchObject({ business_id: destination, provider_id: null, provider: null, total_amount: 12, data: { kept: true }, is_active: false });
    expect(result.business).toBeUndefined();
  });

  it('preserves current hydrated relations when their foreign keys are omitted', async () => {
    const invoice = { id: '7', provider_id: '8', provider: { id: '8', name: 'Unchanged' }, business_id: '11111111-1111-4111-8111-111111111111', business: { id: '11111111-1111-4111-8111-111111111111' } } as unknown as Invoice;
    const repository = { findOne: vi.fn(async () => invoice), save: vi.fn(async (value: Invoice) => value) };
    nativeManager(repository, invoice);
    const real = new UpdateInvoiceUseCase(new InvoiceService(repository as unknown as Repository<Invoice>));
    const result = await real.execute('7', { code: 'new' });
    expect(result.provider).toEqual({ id: '8', name: 'Unchanged' });
    expect(result.business).toEqual({ id: '11111111-1111-4111-8111-111111111111' });
  });

  it('rejects a cross-business provider in the native writer before loading or saving the hydrated entity', async () => {
    const invoice = { id: '7', business_id: nativeBusiness, provider_id: '8' } as Invoice;
    const repository = { findOne: vi.fn(async () => invoice), save: vi.fn(async (value: Invoice) => value) };
    const manager = nativeManager(repository, invoice);
    vi.mocked(manager.query).mockResolvedValueOnce([invoice]).mockResolvedValueOnce([{ id: nativeBusiness }]).mockResolvedValueOnce([{ id: '9', business_id: '22222222-2222-4222-8222-222222222222' }]);
    const real = new UpdateInvoiceUseCase(new InvoiceService({} as Repository<Invoice>));
    await expect(real.execute('7', { provider_id: '9' }, manager)).rejects.toThrow('must belong to the invoice business');
    expect(repository.save).not.toHaveBeenCalled(); expect(repository.findOne).not.toHaveBeenCalled();
  });

  it('rejects an invoice changed while waiting for ordered reference locks, without overwriting it', async () => {
    const invoice = { id: '7', business_id: nativeBusiness, provider_id: null, total_amount: 12 } as Invoice;
    const repository = { findOne: vi.fn(async () => invoice), save: vi.fn(async (value: Invoice) => value) };
    const manager = nativeManager(repository, invoice);
    vi.mocked(manager.query).mockResolvedValueOnce([invoice]).mockResolvedValueOnce([{ id: nativeBusiness }]).mockResolvedValueOnce([{ ...invoice, total_amount: 13 }]);
    const real = new UpdateInvoiceUseCase(new InvoiceService({} as Repository<Invoice>));
    await expect(real.execute('7', { code: 'new' }, manager)).rejects.toThrow('Invoice changed');
    expect(repository.save).not.toHaveBeenCalled(); expect(repository.findOne).not.toHaveBeenCalled();
  });

  it('keeps malformed native FK syntax as a validation error rather than an unhandled DB error', async () => {
    const invoice = { id: '7', business_id: nativeBusiness, provider_id: '8' } as Invoice;
    const repository = { findOne: vi.fn(async () => invoice), save: vi.fn(async (value: Invoice) => value) };
    const manager = nativeManager(repository, invoice);
    vi.mocked(manager.query).mockResolvedValueOnce([invoice]).mockResolvedValueOnce([{ id: nativeBusiness }]).mockRejectedValueOnce({ code: '22P02' });
    const real = new UpdateInvoiceUseCase(new InvoiceService({} as Repository<Invoice>));
    await expect(real.execute('7', { provider_id: 'invalid' }, manager)).rejects.toMatchObject({ status: 400 });
    expect(repository.save).not.toHaveBeenCalled();
  });
});
