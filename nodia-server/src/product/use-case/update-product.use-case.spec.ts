import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UpdateProductUseCase } from './update-product.use-case.js';
import type { ProductService } from '../product.service.js';
import type { UpdateProductDto } from '../dto/update-product.dto.js';

describe('UpdateProductUseCase', () => {
  let useCase: UpdateProductUseCase;
  let productServiceMock: Partial<ProductService>;

  beforeEach(() => {
    productServiceMock = {
      updateProduct: vi.fn(),
    };
    useCase = new UpdateProductUseCase(productServiceMock as ProductService);
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  it('should call productService.updateProduct with id and dto and return updated product', async () => {
    const id = '1';
    const dto: UpdateProductDto = {
      name: 'Coca Cola 2.0L',
      sale_price: 2000,
    };

    const mockUpdated = {
      id,
      business_id: 'b7b80a11-827c-4712-9c17-9150d0325d7b',
      provider_id: '1',
      code: 'PROD-001',
      name: 'Coca Cola 2.0L',
      cost_price: 1000,
      cost_price_tax: 190,
      profit_percentage: 30,
      sale_price: 2000,
      stock: 50,
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
    };

    vi.mocked(productServiceMock.updateProduct!).mockResolvedValue(mockUpdated as any);

    const result = await useCase.execute(id, dto);

    expect(productServiceMock.updateProduct).toHaveBeenCalledTimes(1);
    expect(productServiceMock.updateProduct).toHaveBeenCalledWith(id, dto);
    expect(result).toEqual(mockUpdated);
  });
});
