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
    useCase = new ExportProductsCsvUseCase(productServiceMock as ProductService);
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
        cost_price: 600,
        cost_price_tax: 114,
        profit_percentage: 30,
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
      'Código (code),Nombre (name),Costo base (cost_price),Impuesto (cost_price_tax),Margen % (profit_percentage),Precio de venta (sale_price),Stock (stock),Activo (is_active),ID (id)'
    );
    expect(lines[1]).toBe('PROD-001,"Bebida Cola, 500ml",600,114,30,1200,50,true,101');
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
        cost_price: 450,
        cost_price_tax: 85,
        profit_percentage: 35,
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
      'Code (code),Name (name),Base cost (cost_price),Tax (cost_price_tax),Margin % (profit_percentage),Sale price (sale_price),Stock (stock),Active (is_active),ID (id)'
    );
    expect(lines[1]).toBe('PROD-002,Potato Chips,450,85,35,900,30,false,102');
  });
});
