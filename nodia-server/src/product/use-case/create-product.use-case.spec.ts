import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateProductUseCase } from './create-product.use-case.js';
import type { ProductService } from '../product.service.js';
import type { CreateProductDto } from '../dto/create-product.dto.js';

describe('CreateProductUseCase', () => {
  let useCase: CreateProductUseCase;
  let productServiceMock: Partial<ProductService>;

  beforeEach(() => {
    productServiceMock = {
      createProduct: vi.fn(),
    };
    useCase = new CreateProductUseCase(productServiceMock as ProductService);
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  it('should call productService.createProduct with dto and return the created product', async () => {
    const dto: CreateProductDto = {
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
    };

    const mockCreated = {
      id: '1',
      ...dto,
      created_at: new Date(),
      updated_at: new Date(),
    };

    vi.mocked(productServiceMock.createProduct!).mockResolvedValue(mockCreated as any);

    const result = await useCase.execute(dto);

    expect(productServiceMock.createProduct).toHaveBeenCalledTimes(1);
    expect(productServiceMock.createProduct).toHaveBeenCalledWith(dto);
    expect(result).toEqual(mockCreated);
  });
});
