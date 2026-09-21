import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateProductLogUseCase } from './create-product-log.use-case.js';
import type { ProductService } from '../product.service.js';
import type { CreateProductLogDto } from '../dto/create-product-log.dto.js';

describe('CreateProductLogUseCase', () => {
  let useCase: CreateProductLogUseCase;
  let productServiceMock: Partial<ProductService>;

  beforeEach(() => {
    productServiceMock = {
      createLog: vi.fn(),
    };
    useCase = new CreateProductLogUseCase(productServiceMock as ProductService);
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  it('should call productService.createLog with dto and return the created product log', async () => {
    const dto: CreateProductLogDto = {
      product_id: '1',
      code: 'PROD-001',
      name: 'Coca Cola 1.5L',
      cost_price: 1000,
      cost_price_tax: 190,
      profit_percentage: 30,
      sale_price: 1547,
      stock: 50,
    };

    const mockCreated = {
      id: '265bf029-7b3b-4ce4-82ee-c61ecba01c71',
      ...dto,
      created_at: new Date(),
      updated_at: new Date(),
    };

    vi.mocked(productServiceMock.createLog!).mockResolvedValue(mockCreated as any);

    const result = await useCase.execute(dto);

    expect(productServiceMock.createLog).toHaveBeenCalledTimes(1);
    expect(productServiceMock.createLog).toHaveBeenCalledWith(dto);
    expect(result).toEqual(mockCreated);
  });
});
