import { describe, expect, it, vi } from 'vitest';
import type { EntityManager, Repository } from 'typeorm';
import type { ActorReference } from '../authorization/authority-transaction.js';
import { InvoiceService } from './invoice.service.js';
import type { Invoice } from './entities/invoice.entity.js';
import { GetInvoiceViewUrlUseCase } from './use-case/get-invoice-view-url.use-case.js';
import { CreateInvoiceUseCase } from './use-case/create-invoice.use-case.js';
import type { StorageService } from '../common/storage/storage.service.js';
import type { DataSource } from 'typeorm';
import type { RecoverInvoiceUploadsUseCase } from './use-case/recover-invoice-uploads.use-case.js';
import { AnalyzeInvoiceUseCase } from './use-case/analyze-invoice.use-case.js';
import type { GeminiService } from '../common/ai/gemini.service.js';
import type { MistralService } from '../common/ai/mistral.service.js';
import type { ProviderService } from '../provider/provider.service.js';

const ownBusiness = '11111111-1111-4111-8111-111111111111';
const foreignBusiness = '22222222-2222-4222-8222-222222222222';
const actor: ActorReference = {
  userId: '42',
  sessionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
};

function fixture(
  businessId = ownBusiness,
  superAdmin = false,
  sessionActive = true,
) {
  const invoice = {
    id: '7',
    business_id: businessId,
    provider_id: null,
    path_storage: `invoices/${businessId}/synthetic.pdf`,
    code: 'private',
  } as Invoice;
  const repository = {
    findOne: vi.fn(async () => ({ ...invoice })),
    create: vi.fn((value: unknown) => value),
    save: vi.fn(async (value: unknown) => value),
  };
  const query = vi.fn(async (sql: string, args: unknown[] = []) => {
    if (sql.includes('FROM pg_locks')) return [{ authority_locks: 9 }];
    if (sql.includes('FROM users u JOIN auth_sessions'))
      return sessionActive
        ? [
            {
              actorId: actor.userId,
              sessionId: actor.sessionId,
              isSuperAdmin: superAdmin,
            },
          ]
        : [];
    if (sql.includes('FROM invoices')) return [{ ...invoice }];
    if (sql.includes('SELECT business.id::text'))
      return (args[0] as string[])
        .filter((id) => superAdmin || id === ownBusiness)
        .map((id) => ({ id }));
    if (sql.includes('FROM businesses'))
      return (args[0] as string[]).map((id) => ({ id }));
    throw new Error('Unexpected database boundary');
  });
  const manager = {
    query,
    getRepository: () => repository,
    queryRunner: { isTransactionActive: true },
  } as unknown as EntityManager;
  Object.assign(repository, { manager });
  const service = new InvoiceService(
    repository as unknown as Repository<Invoice>,
  );
  return { invoice, repository, manager, query, service };
}

describe('invoice business privacy', () => {
  it('rejects missing or revoked identity even if an inherited manager exists', async () => {
    const f = fixture();
    await expect(
      f.service.findOneInvoice('7', f.manager),
    ).rejects.toMatchObject({ status: 401 });
    expect(f.repository.findOne).not.toHaveBeenCalled();
    const revoked = fixture(ownBusiness, false, false);
    await expect(
      revoked.service.findOneInvoice('7', revoked.manager, actor),
    ).rejects.toMatchObject({ status: 401 });
    expect(revoked.repository.findOne).not.toHaveBeenCalled();
  });

  it.each([false, true])(
    'returns an own invoice with a real session (superadmin %s)',
    async (admin) => {
      const f = fixture(ownBusiness, admin);
      await expect(
        f.service.findOneInvoice('7', f.manager, actor),
      ).resolves.toMatchObject({ code: 'private' });
    },
  );

  it('blocks another business before creating a signed download URL', async () => {
    const f = fixture(foreignBusiness);
    const storage = { getSignedFileUrl: vi.fn() };
    const useCase = new GetInvoiceViewUrlUseCase(
      f.service,
      storage as unknown as StorageService,
    );
    await expect(
      useCase.execute('7', { ...actor, transaction: f.manager }),
    ).rejects.toMatchObject({ status: 404 });
    expect(storage.getSignedFileUrl).not.toHaveBeenCalled();
  });

  it('allows a superadministrator to read a foreign invoice and its attachment', async () => {
    const f = fixture(foreignBusiness, true);
    const storage = {
      getSignedFileUrl: vi.fn(
        async () => 'https://example.invalid/synthetic-signed',
      ),
    };
    const useCase = new GetInvoiceViewUrlUseCase(
      f.service,
      storage as unknown as StorageService,
    );
    await expect(
      useCase.execute('7', { ...actor, transaction: f.manager }),
    ).resolves.toHaveProperty('url');
    expect(storage.getSignedFileUrl).toHaveBeenCalledOnce();
  });

  it.each([ownBusiness, foreignBusiness])(
    'rejects a forbidden source or destination before saving: %s',
    async (source) => {
      const f = fixture(source);
      await expect(
        f.service.updateInvoice(
          '7',
          {
            business_id: source === ownBusiness ? foreignBusiness : ownBusiness,
          },
          f.manager,
          actor,
        ),
      ).rejects.toMatchObject({ status: 404 });
      expect(f.repository.save).not.toHaveBeenCalled();
    },
  );

  it('prevents attaching a foreign R2 key to an otherwise authorized invoice', async () => {
    const f = fixture();
    await expect(
      f.service.createInvoice(
        {
          business_id: ownBusiness,
          code: 'new',
          path_storage: `invoices/${foreignBusiness}/private.pdf`,
        },
        f.manager,
        actor,
      ),
    ).rejects.toMatchObject({ status: 409 });
    expect(f.repository.create).not.toHaveBeenCalled();
    expect(f.repository.save).not.toHaveBeenCalled();
  });

  it('denies a foreign business before an upload journal or storage operation', async () => {
    const f = fixture(foreignBusiness);
    const storage = { uploadFile: vi.fn() },
      dataSource = { query: vi.fn(), transaction: vi.fn() };
    const recovery = { execute: vi.fn() };
    const useCase = new CreateInvoiceUseCase(
      f.service,
      storage as unknown as StorageService,
      dataSource as unknown as DataSource,
      recovery as unknown as RecoverInvoiceUploadsUseCase,
    );
    const buffer = Buffer.from('%PDF-1.4 synthetic');
    const file = {
      buffer,
      size: buffer.length,
      mimetype: 'application/pdf',
      originalname: 'synthetic.pdf',
    } as Express.Multer.File;
    await expect(
      useCase.execute(
        { business_id: foreignBusiness, code: 'new' },
        file,
        undefined,
        actor,
      ),
    ).rejects.toMatchObject({ status: 404 });
    expect(dataSource.query).not.toHaveBeenCalled();
    expect(storage.uploadFile).not.toHaveBeenCalled();
  });

  it('denies OCR on another business before reading a provider or calling the AI', async () => {
    const f = fixture(foreignBusiness);
    const gemini = { extractInvoiceData: vi.fn() },
      provider = { findOne: vi.fn() };
    const useCase = new AnalyzeInvoiceUseCase(
      gemini as unknown as GeminiService,
      {} as MistralService,
      provider as unknown as ProviderService,
      undefined,
      undefined,
      undefined,
      f.service,
    );
    const buffer = Buffer.from('%PDF-1.4 synthetic');
    const file = {
      buffer,
      size: buffer.length,
      mimetype: 'application/pdf',
      originalname: 'synthetic.pdf',
    } as Express.Multer.File;
    await expect(
      useCase.execute(
        file,
        { business_id: foreignBusiness, provider_id: '9' },
        undefined,
        undefined,
        actor,
      ),
    ).rejects.toMatchObject({ status: 404 });
    expect(provider.findOne).not.toHaveBeenCalled();
    expect(gemini.extractInvoiceData).not.toHaveBeenCalled();
  });
});
