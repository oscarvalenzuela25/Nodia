import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  beforeAll,
  afterEach,
} from 'vitest';
import { GetAllInvoicesUseCase } from './get-all-invoices.use-case.js';
import { InvoiceService } from '../invoice.service.js';
import { GetInvoicesDto } from '../dto/get-invoices.dto.js';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { DataSource, EntitySchema, type SelectQueryBuilder } from 'typeorm';
import type { Invoice } from '../entities/invoice.entity.js';

describe('GetAllInvoicesUseCase', () => {
  let useCase: GetAllInvoicesUseCase;
  let invoiceServiceMock: Partial<InvoiceService>;

  beforeEach(() => {
    invoiceServiceMock = {
      findAllInvoices: vi.fn(),
    };
    useCase = new GetAllInvoicesUseCase(invoiceServiceMock as InvoiceService);
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  it('should call invoiceService.findAllInvoices with queryParams and return result', async () => {
    const queryParams: GetInvoicesDto = {
      page: 1,
      limit: 10,
      all: false,
      includes: true,
    };

    const mockResponse = {
      data: [
        {
          id: '1',
          business_id: 'b7b80a11-827c-4712-9c17-9150d0325d7b',
          provider_id: '1',
          code: 'INV-2026-001',
          total_amount: 154000,
          path_storage: '/invoices/inv-001.pdf',
          data: {},
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ],
      meta: {
        page: 1,
        limit: 10,
        total_items: 1,
        total_pages: 1,
      },
    };

    vi.mocked(invoiceServiceMock.findAllInvoices!).mockResolvedValue(
      mockResponse as any,
    );

    const result = await useCase.execute(queryParams);

    expect(invoiceServiceMock.findAllInvoices).toHaveBeenCalledTimes(1);
    expect(invoiceServiceMock.findAllInvoices).toHaveBeenCalledWith(
      queryParams,
    );
    expect(result).toEqual(mockResponse);
  });
});

class OfflineInvoiceDataSource extends DataSource {
  async prepare() {
    await this.buildMetadatas();
  }
}

describe('GetAllInvoicesUseCase: transformed HTTP filter regression', () => {
  let source: OfflineInvoiceDataSource;
  let useCase: GetAllInvoicesUseCase;
  let query: SelectQueryBuilder<Invoice>;
  let executeQuery: ReturnType<typeof vi.fn>;
  const pipe = new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  beforeAll(async () => {
    source = new OfflineInvoiceDataSource({
      type: 'postgres',
      entities: [
        new EntitySchema({
          name: 'Invoice',
          tableName: 'invoices',
          columns: {
            id: { type: 'bigint', primary: true },
            business_id: { type: 'uuid' },
            provider_id: { type: 'bigint', nullable: true },
            code: { type: 'varchar' },
            total_amount: { type: 'integer' },
            path_storage: { type: 'varchar' },
            data: { type: 'jsonb' },
            is_active: { type: 'boolean' },
            created_at: { type: 'timestamp' },
            updated_at: { type: 'timestamp' },
          },
          relations: {
            business: {
              type: 'many-to-one',
              target: 'Business',
              joinColumn: { name: 'business_id' },
            },
            provider: {
              type: 'many-to-one',
              target: 'Provider',
              joinColumn: { name: 'provider_id' },
            },
          },
        }),
        new EntitySchema({
          name: 'Business',
          tableName: 'businesses',
          columns: { id: { type: 'uuid', primary: true } },
        }),
        new EntitySchema({
          name: 'Provider',
          tableName: 'providers',
          columns: { id: { type: 'bigint', primary: true } },
        }),
      ],
    });
    await source.prepare();
  });
  beforeEach(() => {
    const repo = source.getRepository<Invoice>('Invoice');
    const create = repo.createQueryBuilder.bind(repo);
    executeQuery = vi.fn().mockResolvedValue([[], 0]);
    vi.spyOn(repo, 'createQueryBuilder').mockImplementation((alias) => {
      query = create(alias);
      vi.spyOn(query, 'getManyAndCount').mockImplementation(executeQuery);
      return query;
    });
    useCase = new GetAllInvoicesUseCase(new InvoiceService(repo));
  });
  afterEach(() => vi.restoreAllMocks());
  const business = '11111111-1111-4111-8111-111111111111';
  const transform = (input: object): Promise<GetInvoicesDto> =>
    pipe.transform(input, { type: 'query', metatype: GetInvoicesDto });

  it('accepts a business UUID with limit=1 and absent optional date fields', async () => {
    const dto = await transform({
      q: { business_id_eq: business },
      limit: '1',
    });
    expect(Object.hasOwn(dto.q!, 'issue_date_gteq')).toBe(true);
    expect(dto.q!.issue_date_gteq).toBeUndefined();
    await expect(useCase.execute(dto)).resolves.toMatchObject({
      meta: { page: 1, limit: 1, total_items: 0 },
    });
    expect(query.getQuery()).toContain('"invoice"."business_id" = :ransack_0');
    expect(query.getParameters()).toEqual({ ransack_0: business });
    expect(query.getQuery()).toContain('LEFT JOIN');
    expect(executeQuery).toHaveBeenCalledOnce();
  });
  it('accepts one optional issue-date boundary without requiring the other', async () => {
    await useCase.execute(
      await transform({
        q: { business_id_eq: business, issue_date_gteq: '2026-10-01' },
      }),
    );
    expect(query.getParameters()).toEqual({
      issueDateFrom: '2026-10-01',
      ransack_0: business,
    });
    expect(query.getQuery()).toContain('COALESCE');
  });
  it('accepts an empty filter DTO without producing any WHERE clause', async () => {
    await useCase.execute(await transform({ q: {} }));
    expect(query.getParameters()).toEqual({});
    expect(query.getQuery()).not.toContain(' WHERE ');
  });
  it('still rejects unknown filters supplied by HTTP before executing SQL', async () => {
    await expect(
      transform({ q: { private_field_eq: '' } }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(executeQuery).not.toHaveBeenCalled();
  });
  it('still rejects malformed UUIDs before executing SQL', async () => {
    await expect(
      useCase.execute(await transform({ q: { business_id_eq: 'invalid' } })),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(executeQuery).not.toHaveBeenCalled();
  });
});
