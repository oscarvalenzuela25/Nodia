import { createCanvas } from '@napi-rs/canvas';
import { describe, expect, it, vi } from 'vitest';
import type { EntityManager } from 'typeorm';
import { Product } from '../../product/entities/product.entity.js';
import { ProductImage } from '../entities/product-image.entity.js';
import { ProductLog } from '../../product/entities/product-log.entity.js';
import { ProductImageService } from '../product-image.service.js';
import { ManageProductImageUseCase } from './manage-product-image.use-case.js';
import type { StorageService } from '../../common/storage/storage.service.js';
import type { CheckModuleAccessUseCase } from '../../authorization/use-case/check-module-access.use-case.js';
import { assertBusinessesAccess } from '../../business-access/business-access.js';

// Identity/SQL are integration boundaries here; this suite exercises actual lifecycle and content rules.
vi.mock('../../business-access/business-access.js', () => ({
  assertBusinessesAccess: vi.fn(async () => ({})),
}));
const business = '11111111-1111-4111-8111-111111111111';
const actor = {
  userId: '1',
  sessionId: '22222222-2222-4222-8222-222222222222',
};

function fixture() {
  const images = new Map<string, ProductImage>();
  const logs: object[] = [];
  const product = Object.assign(new Product(), {
    id: '9',
    business_id: business,
    version: 1,
    code: 'SUP',
    barcode: '00009',
    name: 'Synthetic',
    cost_price: 1,
    cost_price_tax: 1,
    sale_price: 2,
    offer_price: null,
    is_offer_enabled: false,
    has_stock: true,
    stock: 0,
  });
  const imageRepo = {
    create: (input: object) =>
      Object.assign(new ProductImage(), { product_version: null }, input),
    save: async (input: ProductImage) => {
      images.set(input.id, input);
      return input;
    },
    findOne: async (input: { where: Record<string, unknown> }) =>
      [...images.values()].find((image) =>
        Object.entries(input.where).every(
          ([key, value]) => image[key as keyof ProductImage] === value,
        ),
      ) ?? null,
    findOneBy: async (where: Record<string, unknown>) =>
      imageRepo.findOne({ where }),
    createQueryBuilder: () => {
      const query = {
        update: () => query,
        set: () => query,
        where: () => query,
        execute: async () => {
          for (const image of images.values())
            if (image.is_current)
              Object.assign(image, {
                is_current: false,
                status: 'pending_delete',
              });
        },
      };
      return query;
    },
  };
  const manager = {
    getRepository: (entity: unknown) =>
      entity === ProductImage
        ? imageRepo
        : entity === Product
          ? {
              findOne: async () => product,
              findOneBy: async () => product,
              save: async () => product,
            }
          : entity === ProductLog
            ? {
                save: async (log: object) => {
                  logs.push(log);
                  return log;
                },
              }
            : undefined,
  } as unknown as EntityManager;
  const dataSource = {
    manager,
    query: vi.fn(async (_sql: string, _parameters?: unknown[]): Promise<unknown[]> => []),
    getRepository: manager.getRepository.bind(manager),
    transaction: async (work: (tx: EntityManager) => unknown) => work(manager),
  };
  let object: Buffer | undefined;
  let loseUploadResponse = false;
  const storage = {
    uploadFileOnce: vi.fn(async (_key: string, bytes: Buffer) => {
      object = bytes;
      if (loseUploadResponse) throw Error('response lost');
    }),
    downloadFile: vi.fn(async () => {
      if (!object) throw Object.assign(Error('NoSuchKey'), { name: 'NoSuchKey' });
      return object;
    }),
    deleteFile: vi.fn(async () => { object = undefined; }),
    getSignedFileUrl: vi.fn(async () => 'https://synthetic.invalid/private'),
  };
  const service = new ProductImageService(
    dataSource as unknown as ConstructorParameters<
      typeof ProductImageService
    >[0],
  );
  const modules = { execute: vi.fn(async () => undefined) };
  return {
    useCase: new ManageProductImageUseCase(
      service,
      storage as unknown as StorageService,
      modules as unknown as CheckModuleAccessUseCase,
    ),
    storage,
    product,
    logs,
    loseResponse: () => {
      loseUploadResponse = true;
    },
    images,
    modules,
    query: dataSource.query,
  };
}

describe('Product image durable lifecycle', () => {
  it('uses SELECT-shaped cleanup claims and stops when the database returns no pending row', async () => {
    const f = fixture();
    f.query.mockImplementation(async (sql) => sql.includes('WITH claimed AS') ? [] : [[], 0]);
    expect(await f.useCase.cleanup()).toEqual({ cleaned: 0 });
    expect(f.query).toHaveBeenCalledTimes(1);
    expect(f.storage.deleteFile).not.toHaveBeenCalled();
  });
  it('counts only actual cleanup claims and updates their exact tombstone identities', async () => {
    const f = fixture();
    let claimed = false;
    f.query.mockImplementation(async (sql) => {
      if (sql.includes('WITH claimed AS')) {
        if (claimed) return [];
        claimed = true;
        return [{ id: '33333333-3333-4333-8333-333333333333', storage_key: 'synthetic/key.jpg', cleanup_attempts: 1, status: 'pending_delete' }];
      }
      return [[], 1]; // PostgreSQL TypeORM UPDATE result is a tuple; not a row.
    });
    expect(await f.useCase.cleanup()).toEqual({ cleaned: 1 });
    expect(f.storage.deleteFile).toHaveBeenCalledOnce();
    expect(f.query).toHaveBeenCalledWith(expect.stringContaining("status='deleted'"), ['33333333-3333-4333-8333-333333333333']);
  });
  it('rejects a revoked module after authority locks and before creating an upload intent', async () => {
    const f = fixture();
    f.modules.execute.mockRejectedValueOnce(new Error('core:module_access_required'));
    await expect(f.useCase.reserve(actor, business, { product_id: '9', expected_product_version: 1 })).rejects.toThrow('core:module_access_required');
    expect(vi.mocked(assertBusinessesAccess)).toHaveBeenLastCalledWith(expect.anything(), actor, [business], { lock: true });
    expect(vi.mocked(assertBusinessesAccess).mock.invocationCallOrder.at(-1)).toBeLessThan(f.modules.execute.mock.invocationCallOrder[0]);
    expect(f.images.size).toBe(0);
    expect(f.storage.uploadFileOnce).not.toHaveBeenCalled();
  });
  it('recovers an uncertain reservation using its client-known identity before checking fresh product version', async () => {
    const f = fixture();
    const input = {
      product_id: '9',
      expected_product_version: 1,
      request_key: '33333333-3333-4333-8333-333333333333',
    };
    const attempt = await f.useCase.reserve(actor, business, input);
    f.product.version = 2;
    expect(await f.useCase.reserve(actor, business, input)).toEqual(attempt);
    await expect(
      f.useCase.reserve(actor, business, {
        ...input,
        expected_product_version: 2,
      }),
    ).rejects.toThrow('product:image_idempotency_conflict');
    expect(f.images.size).toBe(1);
    expect(f.storage.uploadFileOnce).not.toHaveBeenCalled();
  });
  it('recovers persisted PUT with lost response through readback and never sends the PUT twice', async () => {
    const f = fixture();
    const attempt = await f.useCase.reserve(actor, business, {
      product_id: '9',
      expected_product_version: 1,
    });
    expect(attempt.status).toBe('pending');
    expect(f.storage.uploadFileOnce).not.toHaveBeenCalled();
    const file = {
      buffer: await createCanvas(2, 2).encode('png'),
      mimetype: 'image/png',
    } as Express.Multer.File;
    f.loseResponse();
    await expect(
      f.useCase.upload(actor, business, attempt.id, file),
    ).rejects.toThrow('product:image_upload_unknown');
    await expect(
      f.useCase.upload(actor, business, attempt.id, file),
    ).rejects.toThrow('product:image_upload_not_repeatable');
    expect(f.storage.uploadFileOnce).toHaveBeenCalledTimes(1);
    expect(await f.useCase.status(actor, business, attempt.id)).toMatchObject({
      status: 'ready',
      is_current: false,
    });
    expect(
      await f.useCase.complete(actor, business, attempt.id, 1),
    ).toMatchObject({ is_current: true, product_version: 2 });
    expect(f.product.version).toBe(2);
    expect(f.logs).toHaveLength(1);
    f.product.version = 3;
    expect(
      await f.useCase.complete(actor, business, attempt.id, 1),
    ).toMatchObject({ product_version: 2 });
    expect(f.logs).toHaveLength(1);
  });
  it('rejects stale attach without replacing the current product photo', async () => {
    const f = fixture();
    const attempt = await f.useCase.reserve(actor, business, {
      product_id: '9',
      expected_product_version: 1,
    });
    await f.useCase.upload(actor, business, attempt.id, {
      buffer: await createCanvas(2, 2).encode('png'),
      mimetype: 'image/png',
    } as Express.Multer.File);
    f.product.version = 2;
    await expect(
      f.useCase.complete(actor, business, attempt.id, 1),
    ).rejects.toThrow('product:version_conflict');
    expect(f.images.get(attempt.id)?.is_current).toBe(false);
    expect(f.logs).toHaveLength(0);
  });
});
