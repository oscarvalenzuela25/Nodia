import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetProductByIdUseCase } from './get-product-by-id.use-case.js';
import type { ProductService } from '../product.service.js';

describe('GetProductByIdUseCase', () => {
  let useCase: GetProductByIdUseCase;
  let productServiceMock: Partial<ProductService>;

  beforeEach(() => {
    productServiceMock = {
      findOneProduct: vi.fn(),
    };
    useCase = new GetProductByIdUseCase(productServiceMock as ProductService);
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  it('should call productService.findOneProduct with id and return the product', async () => {
    const id = '1';
    const mockProduct = {
      id,
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
    };

    vi.mocked(productServiceMock.findOneProduct!).mockResolvedValue(mockProduct as any);

    const result = await useCase.execute(id);

    expect(productServiceMock.findOneProduct).toHaveBeenCalledTimes(1);
    expect(productServiceMock.findOneProduct).toHaveBeenCalledWith(id);
    expect(result).toEqual(mockProduct);
  });
});
