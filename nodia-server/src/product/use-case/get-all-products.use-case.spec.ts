import 'reflect-metadata';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { DataSource, EntitySchema } from 'typeorm';
import type { SelectQueryBuilder } from 'typeorm';
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  beforeAll,
  afterEach,
} from 'vitest';
import { ProductService as RealProductService } from '../product.service.js';
import { GetProductsDto as RuntimeGetProductsDto } from '../dto/get-products.dto.js';
import type { Product } from '../entities/product.entity.js';
import type { ProductLog } from '../entities/product-log.entity.js';
import { GetAllProductsUseCase } from './get-all-products.use-case.js';
import type { ProductService } from '../product.service.js';
import type { GetProductsDto } from '../dto/get-products.dto.js';

describe('GetAllProductsUseCase', () => {
  let useCase: GetAllProductsUseCase;
  let productServiceMock: Partial<ProductService>;

  beforeEach(() => {
    productServiceMock = {
      findAllProducts: vi.fn(),
    };
    useCase = new GetAllProductsUseCase(productServiceMock as ProductService);
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  it('should call productService.findAllProducts with queryParams and return result', async () => {
    const queryParams: GetProductsDto = {
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
          code: 'PROD-001',
          name: 'Coca Cola 1.5L',
          cost_price: 1000,
          cost_price_tax: 190,
          profit_percentage: 30,
          sale_price: 1547,
          stock: 50,
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

    vi.mocked(productServiceMock.findAllProducts!).mockResolvedValue(
      mockResponse as any,
    );

    const result = await useCase.execute(queryParams);

    expect(productServiceMock.findAllProducts).toHaveBeenCalledTimes(1);
    expect(productServiceMock.findAllProducts).toHaveBeenCalledWith(
      queryParams,
    );
    expect(result).toEqual(mockResponse);
  });
});

// Exercise the real use case, service and query compiler; only DB execution is simulated.
// Offline metadata construction does not initialize a PostgreSQL connection.
class OfflineDataSource extends DataSource {
  async prepare(): Promise<void> {
    await this.buildMetadatas();
  }
}

describe('GetAllProductsUseCase: Ransack query contract', () => {
  let source: OfflineDataSource;
  let useCase: GetAllProductsUseCase;
  let query: SelectQueryBuilder<Product>;
  let executeQuery: ReturnType<typeof vi.fn>;

  beforeAll(async () => {
    source = new OfflineDataSource({
      type: 'postgres',
      entities: [
        new EntitySchema({
          name: 'Product',
          tableName: 'products',
          columns: {
            id: { type: 'bigint', primary: true },
            business_id: { type: 'uuid' },
            provider_id: { type: 'bigint', nullable: true },
            code: { type: 'varchar' },
            name: { type: 'varchar' },
            stock: { type: 'integer' },
            cost_price: { type: 'integer' },
            cost_price_tax: { type: 'integer' },
            profit_percentage: { type: 'integer' },
            sale_price: { type: 'integer' },
            is_active: { type: 'boolean' },
            created_at: { type: 'timestamp' },
            updated_at: { type: 'timestamp' },
          },
        }),
        new EntitySchema({
          name: 'ProductLog',
          columns: { id: { type: 'bigint', primary: true } },
        }),
      ],
    });
    await source.prepare();
  });

  beforeEach(() => {
    const repository = source.getRepository<Product>('Product');
    const createQuery = repository.createQueryBuilder.bind(repository);
    executeQuery = vi.fn().mockResolvedValue([]);
    vi.spyOn(repository, 'createQueryBuilder').mockImplementation((alias) => {
      query = createQuery(alias);
      vi.spyOn(query, 'getMany').mockImplementation(executeQuery);
      return query;
    });
    useCase = new GetAllProductsUseCase(
      new RealProductService(
        repository,
        source.getRepository<ProductLog>('ProductLog'),
      ),
    );
  });

  afterEach(() => vi.restoreAllMocks());

  const list = (q: Record<string, unknown>) =>
    useCase.execute({
      all: true,
      includes: false,
      q: q as GetProductsDto['q'],
    });

  it('keeps valid filters, parameterized values and caller sorting', async () => {
    await list({
      name_cont: 'cafe',
      is_active_eq: false,
      stock_gteq: 0,
      s: 'created_at desc',
    });
    expect(query.getQuery()).toContain('"product"."name" ILIKE :ransack_0');
    expect(query.getQuery()).toContain('"product"."is_active" = :ransack_1');
    expect(query.getQuery()).toContain('"product"."stock" >= :ransack_2');
    expect(query.getParameters()).toEqual({
      ransack_0: '%cafe%',
      ransack_1: false,
      ransack_2: 0,
    });
    expect(query.getQuery()).toContain('ORDER BY "product"."created_at" DESC');
    expect(executeQuery).toHaveBeenCalledOnce();
  });

  it.each([
    'id,(SELECT(1)) asc',
    'name desc NULLS LAST',
    'name sideways',
    'business.name asc',
    'fields asc',
    'constructor asc',
    'name asc, id desc',
  ])('rejects unsupported sort %s before database execution', async (s) => {
    await expect(list({ s })).rejects.toBeInstanceOf(BadRequestException);
    expect(executeQuery).not.toHaveBeenCalled();
  });

  it.each([
    { 'name) OR 1=1 --_eq': 'x' },
    { name_unknown: 'x' },
    { constructor_eq: 'x' },
    { fields_eq: '{}' },
    { business_id_cont: 'x' },
    { name_eq: { nested: 'x' } },
    { name_eq: ['x'] },
    { stock_gteq: 'Infinity' },
    { stock_gteq: true },
    { is_active_eq: 'yes' },
    { provider_id_eq: 'abc' },
    { business_id_eq: 'invalid-uuid' },
    { provider_id_null: 'yes' },
    { created_at_eq: '2026-02-30' },
    { created_at_eq: 'invalid-date' },
    { code_in: ['x', null] },
    { s: ['name asc'] },
    { created_at_eq: '2026-10-03T24:00:00Z' },
    { stock_status_in: [{ nested: 'x' }] },
  ])(
    'rejects invalid fields, operators and values without execution: %j',
    async (q) => {
      await expect(list(q)).rejects.toBeInstanceOf(BadRequestException);
      expect(executeQuery).not.toHaveBeenCalled();
    },
  );

  it('parses complete negative suffixes, including underscores in fields', async () => {
    await list({
      name_not_eq: 'x',
      code_not_in: ['A', 'B'],
      provider_id_not_null: true,
    });
    expect(query.getQuery()).toContain('"product"."name" != :ransack_0');
    expect(query.getQuery()).toContain(
      '"product"."code" NOT IN (:...ransack_1)',
    );
    expect(query.getQuery()).toContain('"product"."provider_id" IS NOT NULL');
    expect(query.getQuery()).not.toContain('name_not');
    expect(query.getQuery()).not.toContain('provider_id_not IS');
  });

  it('treats disabled null predicates as omitted and empty IN as no matches', async () => {
    await list({
      provider_id_null: false,
      provider_id_not_null: 'false',
      code_in: [],
    });
    expect(query.getQuery()).toContain('1 = 0');
    expect(query.getQuery()).not.toContain('IS NULL');
    expect(query.getQuery()).not.toContain('IS NOT NULL');
  });

  it('empty NOT IN does not exclude any records', async () => {
    await list({ code_not_in: [] });
    expect(query.expressionMap.wheres).toHaveLength(0);
  });

  it('uses literal wildcard characters and never interpolates user text', async () => {
    const text = "50%_! ' OR 1=1 --";
    await list({ name_not_cont: text });
    expect(query.getQuery()).toContain("NOT ILIKE :ransack_0 ESCAPE '!'");
    expect(query.getQuery()).not.toContain(text);
    expect(query.getParameters()).toEqual({
      ransack_0: "%50!%!_!! ' OR 1=1 --%",
    });
  });

  it.each(['cont', 'start', 'end'])(
    'supports literal %s matching',
    async (predicate) => {
      await list({ [`name_${predicate}`]: 'A_B' });
      const expected =
        predicate === 'start'
          ? 'A!_B%'
          : predicate === 'end'
            ? '%A!_B'
            : '%A!_B%';
      expect(query.getParameters()).toEqual({ ransack_0: expected });
    },
  );

  it('preserves bigint IDs beyond JavaScript integer precision', async () => {
    await list({ provider_id_eq: '9007199254740993' });
    expect(query.getParameters()).toEqual({ ransack_0: '9007199254740993' });
  });

  it.each([
    { code_in: Array.from({ length: 1001 }, () => 'x') },
    { name_cont: 'x'.repeat(2049) },
    { stock_status_in: Array.from({ length: 1001 }, () => 'low') },
    Object.fromEntries(
      Array.from({ length: 33 }, (_, i) => [`unknown_${i}_eq`, 'x']),
    ),
  ])('rejects queries over the filter budgets: case %#', async (q) => {
    await expect(list(q)).rejects.toBeInstanceOf(BadRequestException);
    expect(executeQuery).not.toHaveBeenCalled();
  });

  it('validates the whole ordinary filter set before adding any clause', async () => {
    await expect(
      list({ name_eq: 'valid', unknown_eq: 'x' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(query.expressionMap.wheres).toHaveLength(0);
    expect(query.getParameters()).toEqual({});
  });

  it('keeps stock and price-change domain filters alongside ordinary search', async () => {
    await list({
      stock_status_in: ['low'],
      price_change_in: ['up'],
      name_cont: 'cafe',
    });
    expect(query.getQuery()).toContain(
      '"product"."stock" > 0 AND "product"."stock" < 10',
    );
    expect(query.getQuery()).toContain('"product"."name" ILIKE');
    expect(executeQuery).toHaveBeenCalledOnce();
  });

  it('allows the new product predicates through the real HTTP DTO validation', async () => {
    const pipe = new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    const dto = await pipe.transform(
      {
        all: 'true',
        includes: 'false',
        q: {
          name_not_eq: 'x',
          code_not_in: ['A'],
          provider_id_not_null: 'true',
          stock_gteq: '0',
          s: 'name asc',
        },
      },
      { type: 'query', metatype: RuntimeGetProductsDto },
    );
    await useCase.execute(dto);
    expect(query.getQuery()).toContain('"product"."name" !=');
    expect(query.getParameters()).toMatchObject({
      ransack_0: 'x',
      ransack_1: ['A'],
      ransack_2: 0,
    });
  });
});
