import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExportProductsCsvUseCase } from './export-products-csv.use-case.js';
import type { ProductService } from '../product.service.js';
import type { Product } from '../entities/product.entity.js';

describe('ExportProductsCsvUseCase', () => {
  let useCase: ExportProductsCsvUseCase;
  let productServiceMock: Partial<ProductService>;

  beforeEach(() => {
    productServiceMock = {
      findAllProducts: vi.fn(),
    };
    useCase = new ExportProductsCsvUseCase(
      productServiceMock as ProductService,
    );
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  it('should export products as Spanish CSV by default', async () => {
    const mockProducts: Partial<Product>[] = [
      {
        id: '101',
        business_id: 'b7b80a11-827c-4712-9c17-9150d0325d7b',
        code: 'PROD-001',
        name: 'Bebida Cola, 500ml',
        measurement_unit: 'unit',
        cost_price: 600,
        cost_price_tax: 114,
        sale_price: 1200,
        stock: 50,
        is_active: true,
      },
    ];

    vi.mocked(productServiceMock.findAllProducts!).mockResolvedValue({
      data: mockProducts as Product[],
      meta: { page: 1, limit: 1, total_items: 1, total_pages: 1 },
    });

    const csv = await useCase.execute({
      business_id: 'b7b80a11-827c-4712-9c17-9150d0325d7b',
    });

    const lines = csv.split('\n');
    expect(lines[0]).toBe(
      'Código proveedor (code),Código de barras (barcode),Nombre (name),Unidad de medida (measurement_unit),Costo base (cost_price),Costo con IVA (cost_price_tax),Precio normal (sale_price),Precio alternativo (offer_price),Alternativo habilitado (is_offer_enabled),Disponible (has_stock),Stock histórico (stock),Activo (is_active),ID (id),Versión (version)',
    );
    expect(lines[1]).toBe(
      'PROD-001,,"Bebida Cola, 500ml",unit,600,114,1200,,,,50,true,101,',
    );
    expect(productServiceMock.findAllProducts).toHaveBeenCalledWith({
      all: true,
      includes: false,
      q: { business_id_eq: 'b7b80a11-827c-4712-9c17-9150d0325d7b' },
    });
  });

  it('should export products as English CSV when lang is en', async () => {
    const mockProducts: Partial<Product>[] = [
      {
        id: '102',
        business_id: 'b7b80a11-827c-4712-9c17-9150d0325d7b',
        code: 'PROD-002',
        name: 'Potato Chips',
        measurement_unit: 'kg',
        cost_price: 450,
        cost_price_tax: 85,
        sale_price: 900,
        stock: 30,
        is_active: false,
      },
    ];

    vi.mocked(productServiceMock.findAllProducts!).mockResolvedValue({
      data: mockProducts as Product[],
      meta: { page: 1, limit: 1, total_items: 1, total_pages: 1 },
    });

    const csv = await useCase.execute({
      business_id: 'b7b80a11-827c-4712-9c17-9150d0325d7b',
      lang: 'en-US',
    });

    const lines = csv.split('\n');
    expect(lines[0]).toBe(
      'Supplier code (code),Barcode (barcode),Name (name),Measurement unit (measurement_unit),Base cost (cost_price),Tax-inclusive cost (cost_price_tax),Regular price (sale_price),Alternative price (offer_price),Alternative enabled (is_offer_enabled),Available (has_stock),Legacy stock (stock),Active (is_active),ID (id),Version (version)',
    );
    expect(lines[1]).toBe(
      'PROD-002,,Potato Chips,kg,450,85,900,,,,30,false,102,',
    );
  });

  it('neutralizes spreadsheet formulas while retaining zero/false and CSV quoting', async () => {
    vi.mocked(productServiceMock.findAllProducts!).mockResolvedValue({
      data: [
        {
          id: '1',
          code: '=SUM(1,2)',
          name: '  @CMD',
          cost_price: 0,
          stock: 0,
          is_active: false,
        },
      ] as Product[],
      meta: { page: 1, limit: 1, total_items: 1, total_pages: 1 },
    });
    const csv = await useCase.execute({}, { maxRows: 100, maxBytes: 4096 });
    expect(csv).toContain('"\'=SUM(1,2)",,\'  @CMD,,0');
    expect(csv).toContain(',0,false,1');
    expect(productServiceMock.findAllProducts).toHaveBeenCalledWith(
      { all: true, includes: false },
      100,
    );
  });

  it('exports a missing supplier code as an empty cell and preserves the measurement ID', async () => {
    vi.mocked(productServiceMock.findAllProducts!).mockResolvedValue({
      data: [{ id: '3', code: null, name: 'Rice', measurement_unit: 'kg' }] as Product[],
      meta: { page: 1, limit: 1, total_items: 1, total_pages: 1 },
    });
    expect((await useCase.execute({})).split('\n')[1]).toMatch(/^,,Rice,kg,/);
  });

  it('rejects an oversized row probe rather than silently truncating the export', async () => {
    vi.mocked(productServiceMock.findAllProducts!).mockResolvedValue({
      data: [{}, {}] as Product[],
      meta: { page: 1, limit: 2, total_items: 2, total_pages: 1 },
    });
    await expect(
      useCase.execute({}, { maxRows: 1, maxBytes: 4096 }),
    ).rejects.toThrow('Export exceeds row limit');
  });

  it('rejects header/row bytes and cancellation without returning partial CSV', async () => {
    vi.mocked(productServiceMock.findAllProducts!).mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 1, total_items: 0, total_pages: 0 },
    });
    await expect(
      useCase.execute({}, { maxRows: 100, maxBytes: 1 }),
    ).rejects.toThrow('Export exceeds byte limit');
    const controller = new AbortController();
    controller.abort();
    await expect(
      useCase.execute(
        {},
        { maxRows: 100, maxBytes: 4096, signal: controller.signal },
      ),
    ).rejects.toThrow();
  });
});
