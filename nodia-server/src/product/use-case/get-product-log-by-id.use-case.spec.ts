import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetProductLogByIdUseCase } from './get-product-log-by-id.use-case.js';
import type { ProductService } from '../product.service.js';

describe('GetProductLogByIdUseCase', () => {
  let useCase: GetProductLogByIdUseCase;
  let productServiceMock: Partial<ProductService>;

  beforeEach(() => {
    productServiceMock = {
      findOneLog: vi.fn(),
    };
    useCase = new GetProductLogByIdUseCase(productServiceMock as ProductService);
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  it('should call productService.findOneLog with id and return the product log', async () => {
    const id = '265bf029-7b3b-4ce4-82ee-c61ecba01c71';
    const mockLog = {
      id,
      product_id: '1',
      code: 'PROD-001',
      name: 'Coca Cola 1.5L',
      cost_price: 1000,
      cost_price_tax: 190,
      profit_percentage: 30,
      sale_price: 1547,
      stock: 50,
      created_at: new Date(),
      updated_at: new Date(),
    };

    vi.mocked(productServiceMock.findOneLog!).mockResolvedValue(mockLog as any);

    const result = await useCase.execute(id);

    expect(productServiceMock.findOneLog).toHaveBeenCalledTimes(1);
    expect(productServiceMock.findOneLog).toHaveBeenCalledWith(id);
    expect(result).toEqual(mockLog);
  });
});
