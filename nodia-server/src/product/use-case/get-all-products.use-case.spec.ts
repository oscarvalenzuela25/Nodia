import { describe, it, expect, vi, beforeEach } from 'vitest';
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

    vi.mocked(productServiceMock.findAllProducts!).mockResolvedValue(mockResponse as any);

    const result = await useCase.execute(queryParams);

    expect(productServiceMock.findAllProducts).toHaveBeenCalledTimes(1);
    expect(productServiceMock.findAllProducts).toHaveBeenCalledWith(queryParams);
    expect(result).toEqual(mockResponse);
  });
});
