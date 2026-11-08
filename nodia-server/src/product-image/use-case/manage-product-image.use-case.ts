import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID, createHash } from 'node:crypto';
import type { EntityManager } from 'typeorm';
import type { ActorReference } from '../../authorization/authority-transaction.js';
import { CheckModuleAccessUseCase } from '../../authorization/use-case/check-module-access.use-case.js';
import { assertBusinessesAccess } from '../../business-access/business-access.js';
import { StorageService } from '../../common/storage/storage.service.js';
import { Product } from '../../product/entities/product.entity.js';
import { ProductLog } from '../../product/entities/product-log.entity.js';
import {
  checkProductVersion,
  productSnapshot,
} from '../../product/product-catalog.js';
import {
  ProductImage,
  type ProductImageStatus,
} from '../entities/product-image.entity.js';
import { ProductImageService } from '../product-image.service.js';
import {
  normalizeProductImage,
  PRODUCT_IMAGE_LIMITS,
} from '../product-image-content.js';
import type { ReserveProductImageDto } from '../dto/product-image.dto.js';

const grace = 10 * 60_000;
function publicImage(image: ProductImage) {
  return {
    id: image.id,
    status: image.status,
    product_id: image.product_id,
    is_current: image.is_current,
    mime_type: image.mime_type,
    byte_size: image.byte_size,
    width: image.width,
    height: image.height,
    product_version: image.product_version,
  };
}

@Injectable()
export class ManageProductImageUseCase {
  constructor(
    private readonly images: ProductImageService,
    private readonly storage: StorageService,
    private readonly modules: CheckModuleAccessUseCase,
  ) {}

  private async authorize(manager: EntityManager, actor: ActorReference, businessId: string) {
    await assertBusinessesAccess(manager, actor, [businessId], { lock: true });
    await this.modules.execute(actor.userId, ['/business'], manager);
  }

  private async product(
    manager: EntityManager,
    actor: ActorReference,
    businessId: string,
    productId: string,
  ) {
    await this.authorize(manager, actor, businessId);
    if (
      !/^[1-9][0-9]{0,18}$/.test(productId) ||
      BigInt(productId) > 9223372036854775807n
    )
      throw new BadRequestException('product:invalid_id');
    const product = await manager
      .getRepository(Product)
      .findOne({
        where: { id: productId, business_id: businessId },
        lock: { mode: 'pessimistic_write' },
      });
    if (!product) throw new NotFoundException('product:not_found');
    return product;
  }

  async reserve(
    actor: ActorReference,
    businessId: string,
    dto: ReserveProductImageDto,
  ) {
    return this.images.transaction(async (manager) => {
      const product = await this.product(
        manager,
        actor,
        businessId,
        dto.product_id,
      );
      const id = dto.request_key ?? randomUUID();
      if (
        !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(
          id,
        )
      )
        throw new BadRequestException('product:image_request_invalid');
      const previous = await this.images.find(manager, businessId, id, true);
      if (previous) {
        if (
          previous.uploaded_by !== actor.userId ||
          previous.product_id !== dto.product_id ||
          previous.reserved_product_version !== dto.expected_product_version
        )
          throw new ConflictException('product:image_idempotency_conflict');
        return publicImage(previous);
      }
      checkProductVersion(product, dto.expected_product_version, true);
      const now = new Date();
      const image = manager
        .getRepository(ProductImage)
        .create({
          id,
          business_id: businessId,
          product_id: product.id,
          uploaded_by: actor.userId,
          storage_key: `products/${businessId}/${id}.jpg`,
          status: 'pending',
          reserved_product_version: dto.expected_product_version,
          is_current: false,
          created_at: now,
          cleanup_after: new Date(now.getTime() + grace),
          retry_after: new Date(now.getTime() + grace),
          cleanup_attempts: 0,
        });
      return publicImage(await manager.getRepository(ProductImage).save(image));
    });
  }

  private async authorizedAttempt(
    actor: ActorReference,
    businessId: string,
    id: string,
  ) {
    return this.images.transaction(async manager => {
      await this.authorize(manager, actor, businessId);
      const image = await this.images.find(manager, businessId, id);
      if (!image || image.uploaded_by !== actor.userId) throw new NotFoundException('product:image_not_found');
      return image;
    });
  }

  async upload(
    actor: ActorReference,
    businessId: string,
    id: string,
    file: Express.Multer.File,
  ) {
    await this.authorizedAttempt(actor, businessId, id);
    const content = await normalizeProductImage(file);
    const claim = await this.images.transaction(async (manager) => {
      await this.authorize(manager, actor, businessId);
      const image = await this.images.find(manager, businessId, id, true);
      if (!image || image.uploaded_by !== actor.userId)
        throw new NotFoundException('product:image_not_found');
      if (image.status === 'ready' && image.sha256 === content.sha256)
        return { image, send: false };
      if (
        image.status !== 'pending' ||
        image.is_current ||
        image.cleanup_after.getTime() <= Date.now()
      )
        throw new ConflictException('product:image_upload_not_repeatable');
      const { buffer: _buffer, ...metadata } = content;
      Object.assign(image, {
        ...metadata,
        status: 'uploading',
        retry_after: new Date(Date.now() + grace),
        cleanup_after: new Date(Date.now() + grace),
      });
      await manager.getRepository(ProductImage).save(image);
      return { image, send: true };
    });
    if (claim.send) {
      try {
        await this.storage.uploadFileOnce(
          claim.image.storage_key,
          content.buffer,
          content.mime_type,
        );
      } catch {
        throw new ServiceUnavailableException('product:image_upload_unknown');
      }
    }
    return publicImage(await this.observe(actor, businessId, id));
  }

  private async observe(
    actor: ActorReference,
    businessId: string,
    id: string,
  ): Promise<ProductImage> {
    const image = await this.authorizedAttempt(actor, businessId, id);
    if (image.status !== 'uploading') return image;
    let bytes: Buffer;
    try {
      bytes = await this.storage.downloadFile(
        image.storage_key,
        PRODUCT_IMAGE_LIMITS.outputBytes,
        AbortSignal.timeout(15_000),
      );
    } catch {
      throw new ServiceUnavailableException('product:image_upload_unknown');
    }
    if (
      bytes.length !== image.byte_size ||
      createHash('sha256').update(bytes).digest('hex') !== image.sha256
    )
      throw new ConflictException('product:image_content_mismatch');
    return this.images.transaction(async (manager) => {
      await this.authorize(manager, actor, businessId);
      const current = await this.images.find(manager, businessId, id, true);
      if (!current || current.uploaded_by !== actor.userId)
        throw new NotFoundException('product:image_not_found');
      if (current.status !== 'uploading' && current.status !== 'ready')
        throw new ConflictException('product:image_cleanup_started');
      current.status = 'ready';
      current.ready_at ??= new Date();
      current.retry_after = new Date(Date.now() + grace);
      return manager.getRepository(ProductImage).save(current);
    });
  }

  async status(actor: ActorReference, businessId: string, id: string) {
    return publicImage(await this.observe(actor, businessId, id));
  }

  async complete(
    actor: ActorReference,
    businessId: string,
    id: string,
    expected: number,
  ) {
    await this.observe(actor, businessId, id);
    return this.images.transaction(async (manager) => {
      await this.authorize(manager, actor, businessId);
      const attempt = await this.images.find(manager, businessId, id);
      if (!attempt?.product_id || attempt.uploaded_by !== actor.userId)
        throw new NotFoundException('product:image_not_found');
      const product = await this.product(
        manager,
        actor,
        businessId,
        attempt.product_id,
      );
      const image = await this.images.find(manager, businessId, id, true);
      if (!image) throw new NotFoundException('product:image_not_found');
      if (image.is_current && image.product_version === expected + 1)
        return publicImage(image);
      checkProductVersion(product, expected, true);
      if (image.status !== 'ready' || image.is_current)
        throw new ConflictException('product:image_not_ready');
      await manager
        .getRepository(ProductImage)
        .createQueryBuilder()
        .update()
        .set({
          is_current: false,
          status: 'pending_delete',
          retry_after: new Date(),
        })
        .where('product_id=:productId AND is_current=true', {
          productId: product.id,
        })
        .execute();
      image.is_current = true;
      image.product_version = product.version + 1;
      product.version++;
      await manager.getRepository(Product).save(product);
      await manager.getRepository(ProductImage).save(image);
      await manager
        .getRepository(ProductLog)
        .save(
          productSnapshot(
            product,
            'image',
            actor.userId,
            ['image_id'],
            image.id,
          ),
        );
      return publicImage(image);
    });
  }

  async current(actor: ActorReference, businessId: string, productId: string) {
    const observed = await this.images.transaction(async manager => {
      await this.authorize(manager, actor, businessId);
      if (!/^[1-9][0-9]{0,18}$/.test(productId) || BigInt(productId) > 9223372036854775807n)
        throw new BadRequestException('product:invalid_id');
      const product = await manager.getRepository(Product).findOneBy({ id: productId, business_id: businessId });
      if (!product) throw new NotFoundException('product:not_found');
      const image = await manager.getRepository(ProductImage).findOneBy({ business_id: businessId, product_id: productId, is_current: true });
      return { product, image };
    });
    if (!observed.image) return null;
    const url = await this.storage.getSignedFileUrl(observed.image.storage_key, 300);
    await this.images.transaction(manager => this.authorize(manager, actor, businessId));
    return { ...publicImage(observed.image), url, product_version: observed.product.version };
  }

  async remove(
    actor: ActorReference,
    businessId: string,
    productId: string,
    expected: number,
  ) {
    return this.images.transaction(async (manager) => {
      const product = await this.product(manager, actor, businessId, productId);
      const image = await manager
        .getRepository(ProductImage)
        .findOne({
          where: {
            business_id: businessId,
            product_id: productId,
            is_current: true,
          },
          lock: { mode: 'pessimistic_write' },
        });
      if (!image) {
        const previous = await manager
          .getRepository(ProductImage)
          .findOneBy({
            business_id: businessId,
            product_id: productId,
            product_version: expected + 1,
            is_current: false,
          });
        if (previous && ['pending_delete', 'deleted'].includes(previous.status))
          return { removed: true, product_version: previous.product_version };
        checkProductVersion(product, expected, true);
        return { removed: false, product_version: product.version };
      }
      checkProductVersion(product, expected, true);
      image.is_current = false;
      image.status = 'pending_delete';
      image.retry_after = new Date();
      image.product_version = ++product.version;
      await manager.getRepository(ProductImage).save(image);
      await manager.getRepository(Product).save(product);
      await manager
        .getRepository(ProductLog)
        .save(
          productSnapshot(product, 'image', actor.userId, ['image_id'], null),
        );
      return { removed: true, product_version: product.version };
    });
  }

  /** Each durable claim excludes complete; late PUTs are covered by persistent tombstones. */
  async cleanup() {
    let cleaned = 0;
    for (let index = 0; index < 5; index++) {
      const [claim]: {
        id: string;
        storage_key: string;
        cleanup_attempts: number;
        status: ProductImageStatus;
      }[] = await this.images.dataSource.query(`
        WITH claimed AS (UPDATE product_images image SET status='pending_delete',cleanup_attempts=image.cleanup_attempts+1,
          retry_after=clock_timestamp()+interval '1 minute'
        FROM (SELECT id FROM product_images WHERE NOT is_current AND retry_after<=clock_timestamp()
          ORDER BY retry_after,id FOR UPDATE SKIP LOCKED LIMIT 1) pending
        WHERE image.id=pending.id AND NOT image.is_current RETURNING image.id,image.storage_key,image.cleanup_attempts,image.status)
        SELECT id,storage_key,cleanup_attempts,status FROM claimed`);
      if (!claim) break;
      try {
        await this.storage.deleteFile(claim.storage_key);
        let absent = false;
        try {
          await this.storage.downloadFile(
            claim.storage_key,
            1,
            AbortSignal.timeout(10_000),
          );
        } catch (error) {
          if (error && typeof error === 'object') {
            const name = 'name' in error ? error.name : undefined;
            const metadata = '$metadata' in error ? error.$metadata : undefined;
            absent =
              name === 'NoSuchKey' ||
              name === 'NotFound' ||
              (!!metadata &&
                typeof metadata === 'object' &&
                'httpStatusCode' in metadata &&
                metadata.httpStatusCode === 404);
          }
        }
        if (!absent)
          throw new ServiceUnavailableException(
            'product:image_delete_unverified',
          );
        // Keep checking tombstones: no claim that cancelling a caller cancels a remote PUT.
        await this.images.dataSource.query(
          "UPDATE product_images SET status='deleted',retry_after=clock_timestamp()+interval '1 day' WHERE id=$1 AND NOT is_current AND status='pending_delete'",
          [claim.id],
        );
        cleaned++;
      } catch {
        const seconds = Math.min(
          3600,
          60 * 2 ** Math.min(claim.cleanup_attempts, 6),
        );
        await this.images.dataSource.query(
          "UPDATE product_images SET retry_after=clock_timestamp()+$2*interval '1 second' WHERE id=$1 AND NOT is_current",
          [claim.id, seconds],
        );
      }
    }
    return { cleaned };
  }
}
