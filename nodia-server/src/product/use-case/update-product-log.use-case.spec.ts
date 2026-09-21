import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UpdateProductLogUseCase } from './update-product-log.use-case.js';
import type { ProductService } from '../product.service.js';
import type { UpdateProductLogDto } from '../dto/update-product-log.dto.js';

describe('UpdateProductLogUseCase', () => {
  let useCase: UpdateProductLogUseCase;
  let productServiceMock: Partial<ProductService>;

  beforeEach(() => {
    productServiceMock = {
      updateLog: vi.fn(),
    };
    useCase = new UpdateProductLogUseCase(productServiceMock as ProductService);
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  it('should call productService.updateLog with id and dto and return updated product log', async () => {
    const id = '265bf029-7b3b-4ce4-82ee-c61ecba01c71';
    const dto: UpdateProductLogDto = {
      name: 'Coca Cola 2.0L',
      sale_price: 2000,
    };

    const mockUpdated = {
      id,
      product_id: '1',
      code: 'PROD-001',
      name: 'Coca Cola 2.0L',
      cost_price: 1000,
      cost_price_tax: 190,
      profit_percentage: 30,
      sale_price: 2000,
      stock: 50,
      created_at: new Date(),
      updated_at: new Date(),
    };

    vi.mocked(productServiceMock.updateLog!).mockResolvedValue(mockUpdated as any);

    const result = await useCase.execute(id, dto);

    expect(productServiceMock.updateLog).toHaveBeenCalledTimes(1);
    expect(productServiceMock.updateLog).toHaveBeenCalledWith(id, dto);
    expect(result).toEqual(mockUpdated);
  });
});
