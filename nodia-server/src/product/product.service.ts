import { normalizeCatalogSalePrice } from './product-sale-price.js';
import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  Optional,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, type EntityManager } from 'typeorm';
import { Product } from './entities/product.entity.js';
import { ProductLog } from './entities/product-log.entity.js';
import { normalizeProductAlias } from './product-alias.js';
import { applyProductLookupFilters } from './product-lookup-filters.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { BulkCreateProductDto } from './dto/bulk-create-product.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';
import { BulkUpdateProductDto } from './dto/bulk-update-product.dto.js';
import { GetProductsDto } from './dto/get-products.dto.js';
import { CreateProductLogDto } from './dto/create-product-log.dto.js';
import { BulkCreateProductLogDto } from './dto/bulk-create-product-log.dto.js';
import { UpdateProductLogDto } from './dto/update-product-log.dto.js';
import { BulkUpdateProductLogDto } from './dto/bulk-update-product-log.dto.js';
import { GetProductLogsDto } from './dto/get-product-logs.dto.js';
import {
  applyRansack,
  validateRansackEnvelope,
} from '../common/utils/ransack-query.builder.js';
import { RANSACK_POLICIES } from '../common/utils/ransack-query.policies.js';
import type { ActorReference } from '../authorization/authority-transaction.js';
import {
  assertBusinessesAccess,
  resolveBusinessAccess,
  scopeBusinessQuery,
} from '../business-access/business-access.js';
import {
  GetProductsResponse,
  GetProductLogsResponse,
} from './types/product.types.js';
import {
  catalogPrice,
  checkProductVersion,
  productSnapshot,
  rejectRetiredProductFields,
  validateBarcode,
  validateCatalogProduct,
} from './product-catalog.js';
import { CheckModuleAccessUseCase } from '../authorization/use-case/check-module-access.use-case.js';
import { StorageService } from '../common/storage/storage.service.js';
import {
  normalizeProductCode,
  validateProductMeasurementUnit,
  type ProductMeasurementUnit,
} from './product-measurement-unit.js';
import type {
  OcrProductItem,
  OcrSavedProduct,
} from './ocr-confirmation-products.js';
import { CashWriteRejection } from '../business-cash/use-case/execute-cash-mutation.use-case.js';

type ProductReference = Pick<Product, 'id' | 'business_id' | 'provider_id'>;
type ProductProvider = { business_id: string; provider_id?: string | null };
type ProductUpdate = UpdateProductDto & { id: string };

@Injectable()
export class ProductService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(ProductLog)
    private readonly productLogRepository: Repository<ProductLog>,
    private readonly modules: CheckModuleAccessUseCase,
    @Optional() private readonly storage?: StorageService,
  ) {}

  private async authorizeBusinesses(manager: EntityManager, actor: ActorReference, ids: readonly string[], options: { lock?: boolean } = {}) {
    const scope = await assertBusinessesAccess(manager, actor, ids, options);
    await this.modules.execute(actor.userId, ['/business'], manager);
    return scope;
  }

  private actor(actor?: ActorReference): ActorReference {
    if (!actor) throw new UnauthorizedException('auth:session_expired');
    return actor;
  }

  /** Log-only writers hold parent SHARE locks; none upgrades or updates the product. */
  private async authorizeProducts(
    manager: EntityManager,
    ids: readonly string[],
    actor?: ActorReference,
  ): Promise<void> {
    const current = this.actor(actor);
    await this.authorizeBusinesses(manager, current, [], { lock: true });
    const productIds = [...new Set(ids.map((id) => this.referenceId(id)))];
    const candidates = await this.productReferences(manager, productIds);
    await this.authorizeBusinesses(
      manager,
      current,
      [...candidates.values()].map((product) => product.business_id),
      { lock: true },
    );
    const products: ProductReference[] = await manager.query(
      'SELECT p.id::text,p.business_id::text,p.provider_id::text FROM products p WHERE p.id=ANY($1::bigint[]) ORDER BY p.id FOR SHARE OF p',
      [productIds],
    );
    if (products.length !== productIds.length)
      throw new NotFoundException('Product not found');
    this.assertSameProductBusinesses(products, candidates);
  }

  private async productReferences(
    manager: EntityManager,
    ids: readonly string[],
  ): Promise<Map<string, ProductReference>> {
    if (!ids.length) return new Map();
    const rows: ProductReference[] = await manager.query(
      'SELECT p.id::text,p.business_id::text,p.provider_id::text FROM products p WHERE p.id=ANY($1::bigint[])',
      [ids],
    );
    return new Map(rows.map((row) => [row.id, row]));
  }

  private assertSameProductBusinesses(
    products: readonly ProductReference[],
    candidates: ReadonlyMap<string, ProductReference>,
  ): void {
    if (
      products.some((product) => product.business_id !== candidates.get(product.id)?.business_id)
    )
      throw new ConflictException('product:version_conflict');
  }

  private requireTransaction(manager: EntityManager): void {
    if (!manager.queryRunner?.isTransactionActive)
      throw new BadRequestException(
        'Product effect requires an active transaction',
      );
  }

  private async assertMovable(
    manager: EntityManager,
    product: Product,
    businessId: string,
  ): Promise<void> {
    if (product.business_id === businessId) return;
    const images: { present: boolean }[] = await manager.query(
      'SELECT EXISTS(SELECT 1 FROM product_images WHERE product_id=$1) AS present',
      [product.id],
    );
    if (images[0]?.present)
      throw new ConflictException('product:business_locked');
    const tables: { present: boolean }[] = await manager.query(
      "SELECT to_regclass('sale_items') IS NOT NULL AS present",
    );
    if (tables[0]?.present) {
      const sales: { present: boolean }[] = await manager.query(
        'SELECT EXISTS(SELECT 1 FROM sale_items WHERE product_id=$1) AS present',
        [product.id],
      );
      if (sales[0]?.present)
        throw new ConflictException('product:business_locked');
    }
  }

  private productResponse(product: Product): Product {
    return Object.assign(product, catalogPrice(product));
  }

  private catalogFields<
    T extends { code?: string | null; alias?: string | null; measurement_unit?: ProductMeasurementUnit },
  >(attributes: T, create = false): T {
    rejectRetiredProductFields(attributes);
    const normalized = { ...attributes };
    if (create || attributes.alias !== undefined)
      normalized.alias = normalizeProductAlias(attributes.alias) ?? null;
    else delete normalized.alias;
    if (create || attributes.code !== undefined)
      normalized.code = normalizeProductCode(attributes.code);
    else delete normalized.code;
    if (create && normalized.measurement_unit === undefined)
      normalized.measurement_unit = 'unit';
    else if (normalized.measurement_unit === undefined)
      delete normalized.measurement_unit;
    if (normalized.measurement_unit !== undefined)
      validateProductMeasurementUnit(normalized.measurement_unit);
    return normalized;
  }

  private async persist<T>(write: () => Promise<T>): Promise<T> {
    try {
      return await write();
    } catch (error) {
      const driver =
        error && typeof error === 'object' && 'driverError' in error
          ? error.driverError
          : error;
      if (
        driver &&
        typeof driver === 'object' &&
        'code' in driver &&
        driver.code === '23505'
      ) {
        const constraint =
          'constraint' in driver ? driver.constraint : undefined;
        throw new ConflictException(
          constraint === 'uq_products_business_barcode'
            ? 'product:barcode_conflict'
            : 'product:code_conflict',
        );
      }
      throw error;
    }
  }

  private async decorateProducts(
    products: Product[],
    images: boolean,
    actor: ActorReference,
  ): Promise<Product[]> {
    await this.authorizeBusinesses(this.productRepository.manager, actor, [...new Set(products.map(product => product.business_id))]);
    const result = products.map((product) => this.productResponse(product));
    if (!images || !products.length) return result;
    const previous: ProductLog[] = await this.productRepository.manager.query(
      `SELECT DISTINCT ON (pl.product_id) pl.* FROM product_logs pl
        JOIN products p ON p.id=pl.product_id
        WHERE pl.product_id=ANY($1::bigint[]) AND (pl.sale_price,pl.cost_price,pl.cost_price_tax,pl.measurement_unit) IS DISTINCT FROM
          (p.sale_price,p.cost_price,p.cost_price_tax,p.measurement_unit) AND pl.source<>'manual'
        ORDER BY pl.product_id,pl.created_at DESC,pl.id DESC`, [products.map((product) => product.id)],
    );
    const previousByProduct = new Map(previous.map((log) => [String(log.product_id), log]));
    for (const product of result) product.previous_price_snapshot = previousByProduct.get(product.id) ?? null;
    if (!this.storage) {
      await this.authorizeBusinesses(this.productRepository.manager, actor, [...new Set(products.map(product => product.business_id))]);
      return result;
    }
    const rows: {
      id: string;
      product_id: string;
      storage_key: string;
      mime_type: string;
      width: number;
      height: number;
      byte_size: number;
    }[] = await this.productRepository.manager.query(
      `SELECT id::text,product_id::text,storage_key,mime_type,width,height,byte_size
        FROM product_images WHERE product_id=ANY($1::bigint[]) AND is_current=true AND status='ready'`,
      [products.map((product) => product.id)],
    );
    const byId = new Map(rows.map((row) => [row.product_id, row]));
    for (const product of result) {
      const row = byId.get(product.id);
      product.image = row
        ? {
            id: row.id,
            url: await this.storage.getSignedFileUrl(row.storage_key, 300),
            mime_type: row.mime_type,
            width: row.width,
            height: row.height,
            byte_size: row.byte_size,
          }
        : null;
    }
    await this.authorizeBusinesses(this.productRepository.manager, actor, [...new Set(products.map(product => product.business_id))]);
    return result;
  }

  async availabilitySummary(
    businessId: string,
    activity: 'active' | 'inactive' | 'all',
    actor: ActorReference,
  ) {
    await this.authorizeBusinesses(
      this.productRepository.manager,
      this.actor(actor),
      [businessId],
    );
    if (!['active', 'inactive', 'all'].includes(activity))
      throw new BadRequestException('product:invalid_activity');
    const [row]: Record<string, string>[] =
      await this.productRepository.manager.query(
        `SELECT count(*)::text AS total,
      count(*) FILTER(WHERE has_stock=true)::text AS available,
      count(*) FILTER(WHERE has_stock=false)::text AS unavailable,
      count(*) FILTER(WHERE has_stock IS NULL)::text AS unknown
      FROM products WHERE business_id=$1 AND ($2::text='all' OR is_active=($2::text='active'))`,
        [businessId, activity],
      );
    const counts: Record<string, number> = {};
    for (const field of ['total', 'available', 'unavailable', 'unknown']) {
      if (
        !row ||
        !/^[0-9]+$/.test(row[field]) ||
        !Number.isSafeInteger(Number(row[field]))
      )
        throw new BadRequestException('product:invalid_aggregate');
      counts[field] = Number(row[field]);
    }
    return { ...counts, activity };
  }

  async findByBarcode(
    businessId: string,
    barcode: string,
    actor?: ActorReference,
  ): Promise<Product> {
    if (typeof barcode !== 'string') throw new BadRequestException('product:invalid_barcode');
    validateBarcode(barcode);
    const current = this.actor(actor);
    await this.authorizeBusinesses(this.productRepository.manager, current, [
      businessId,
    ]);
    const product = await this.productRepository.findOneBy({
      business_id: businessId,
      barcode,
    });
    if (!product) throw new NotFoundException('product:not_found');
    return (await this.decorateProducts([product], true, this.actor(actor)))[0];
  }

  private referenceId(value: string): string {
    if (
      typeof value !== 'string' ||
      value.length > 19 ||
      !/^[0-9]+$/.test(value) ||
      BigInt(value) < 1n ||
      BigInt(value) > 9223372036854775807n
    )
      throw new BadRequestException('Invalid product or provider ID');
    return BigInt(value).toString();
  }

  private logId(value: string): string {
    if (
      typeof value !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        value,
      )
    )
      throw new BadRequestException('Invalid product log ID');
    return value.toLowerCase();
  }

  /** Individual and legacy bulk writers share the same relation barrier. */
  private async validateReferenceSet(
    manager: EntityManager,
    references: readonly ProductProvider[],
    previousProviders: readonly (string | null)[] = [],
    concealProvider = false,
  ): Promise<void> {
    if (
      references.some(
        (item) => typeof item.business_id !== 'string' || !item.business_id,
      )
    )
      throw new BadRequestException('Invalid business ID');
    // Business existence, current ownership and parent locks were checked together.
    const providerIds = [
      ...new Set(
        [...previousProviders, ...references.map((item) => item.provider_id)]
          .filter((id): id is string => id != null)
          .map((id) => this.referenceId(id)),
      ),
    ].sort((a, b) =>
      BigInt(a) < BigInt(b) ? -1 : BigInt(a) > BigInt(b) ? 1 : 0,
    );
    if (!providerIds.length) return;
    const providers: { id: string; business_id: string }[] =
      await manager.query(
        'SELECT p.id::text,p.business_id::text FROM providers p WHERE p.id=ANY($1::bigint[]) ORDER BY p.id FOR SHARE OF p',
        [providerIds],
      );
    const byId = new Map(
      providers.map((provider) => [provider.id, provider.business_id]),
    );
    if (
      references.some(
        (item) =>
          item.provider_id != null &&
          byId.get(this.referenceId(item.provider_id))?.toLowerCase() !==
            item.business_id.toLowerCase(),
      )
    ) {
      if (concealProvider)
        throw new NotFoundException('business:resource_not_found');
      throw new BadRequestException(
        'Provider does not belong to this business',
      );
    }
  }

  private async validateReferences(
    manager: EntityManager,
    businessId: string,
    providerId: string | null | undefined,
  ): Promise<void> {
    return this.validateReferenceSet(manager, [
      { business_id: businessId, provider_id: providerId },
    ]);
  }

  private async lockProductUpdates(
    manager: EntityManager,
    actor: ActorReference,
    items: readonly ProductUpdate[],
    invoice?: { business_id: string; provider_id: string | null },
  ): Promise<Product[]> {
    await this.authorizeBusinesses(manager, actor, [], { lock: true });
    const ids = items.map((item) => this.referenceId(item.id));
    if (new Set(ids).size !== ids.length)
      throw new BadRequestException(
        'A product may appear only once in a bulk update',
      );
    const before = await this.productReferences(manager, ids);
    for (const id of ids) {
      const product = before.get(id);
      if (invoice && product?.business_id !== invoice.business_id)
        throw new NotFoundException('business:resource_not_found');
      if (!product)
        throw new NotFoundException(`Product with ID "${id}" not found`);
    }
    const destinations = items.map((item, index) => {
      const product = before.get(ids[index])!;
      return {
        business_id: item.business_id ?? product.business_id,
        provider_id:
          item.provider_id === undefined ? product.provider_id : item.provider_id,
      };
    });
    const current = [...before.values()];
    const references = invoice ? [...destinations, invoice] : destinations;
    await this.authorizeBusinesses(
      manager,
      actor,
      [...current, ...references].map((item) => item.business_id),
      { lock: true },
    );
    await this.validateReferenceSet(
      manager,
      references,
      current.map((item) => item.provider_id),
      invoice !== undefined,
    );
    if (!ids.length) return [];
    const selected = await manager
      .getRepository(Product)
      .createQueryBuilder('product')
      .where('product.id IN (:...ids)', { ids })
      .orderBy('product.id', 'ASC')
      .setLock('pessimistic_write')
      .getMany();
    this.assertSameProductBusinesses(selected, before);
    if (
      selected.some((product) => product.provider_id !== before.get(product.id)?.provider_id)
    )
      throw new ConflictException('product:version_conflict');
    const locked = new Map(selected.map((product) => [product.id, product]));
    return ids.map((id) => {
      const product = locked.get(id);
      if (!product)
        throw new NotFoundException(
          invoice
            ? 'business:resource_not_found'
            : `Product with ID "${id}" not found`,
        );
      return product;
    });
  }

  private productCreation(dto: CreateProductDto) {
    const attributes = normalizeCatalogSalePrice(this.catalogFields(dto, true));
    validateCatalogProduct(attributes, true);
    return {
      ...attributes,
      barcode: dto.barcode ?? null,
      offer_price: dto.offer_price ?? null,
      is_offer_enabled: dto.is_offer_enabled ?? false,
      stock: dto.stock ?? 0,
      is_active: dto.is_active ?? true,
      version: 1,
    };
  }

  private async productUpdate(
    manager: EntityManager,
    product: Product,
    dto: UpdateProductDto,
  ): Promise<{ candidate: Product; changedFields: string[] }> {
    const { expected_version, ...suppliedAttributes } = dto;
    const attributes = normalizeCatalogSalePrice(
      this.catalogFields(suppliedAttributes),
    );
    if (
      Object.hasOwn(attributes, 'has_stock') &&
      typeof attributes.has_stock !== 'boolean'
    )
      throw new BadRequestException('product:invalid_availability');
    const requiresVersion = [
      'alias',
      'barcode',
      'offer_price',
      'is_offer_enabled',
      'has_stock',
      'measurement_unit',
    ].some((key) => Object.hasOwn(attributes, key));
    checkProductVersion(product, expected_version, requiresVersion);
    if (product.version >= 2147483647)
      throw new ConflictException('product:version_conflict');
    await this.assertMovable(
      manager,
      product,
      attributes.business_id ?? product.business_id,
    );
    const candidate = Object.assign(new Product(), product, attributes, {
      version: (product.version ?? 1) + 1,
    });
    validateCatalogProduct(candidate);
    return { candidate, changedFields: Object.keys(attributes) };
  }

  /** Keep the same catalog validators and derived logs as native writers. */
  async prepareOcrConfirmation(
    manager: EntityManager,
    businessId: string,
    providerId: string | null,
    items: readonly OcrProductItem[],
    actor: ActorReference,
  ): Promise<() => Promise<OcrSavedProduct[]>> {
    this.requireTransaction(manager);
    try {
      const invoice = { business_id: businessId, provider_id: providerId };
      const updates = items.flatMap((item) =>
        item.kind === 'create'
          ? []
          : [{
              id: item.product_id,
              expected_version: item.expected_version,
              ...(item.kind === 'update'
                ? { ...item.product, provider_id: providerId }
                : item.changes),
            }],
      );
      const selected = await this.lockProductUpdates(
        manager,
        actor,
        updates,
        invoice,
      );
      const locked = new Map(selected.map((product) => [product.id, product]));
      const updateById = new Map(
        updates.map(({ id, ...attributes }) => [id, attributes]),
      );
      const products = manager.getRepository(Product);
      const logs = manager.getRepository(ProductLog);
      const staged: {
        candidate: Product;
        changedFields: string[];
        source: 'create' | 'update';
      }[] = [];
      for (const item of items) {
        if (item.kind === 'create') {
          const input = { ...invoice, ...item.product, has_stock: true };
          staged.push({
            candidate: products.create(this.productCreation(input)),
            changedFields: Object.keys(input),
            source: 'create',
          });
          continue;
        }
        const update = await this.productUpdate(
          manager,
          locked.get(item.product_id)!,
          updateById.get(item.product_id)!,
        );
        staged.push({ ...update, source: 'update' });
      }
      return async () => {
        try {
          const saved = await this.persist(() =>
            products.save(staged.map((entry) => entry.candidate)),
          );
          await logs.save(saved.map((product, index) => logs.create(
            productSnapshot(
              product,
              staged[index].source,
              actor.userId,
              staged[index].changedFields,
            ),
          )));
          return saved.map(({ id, version }) => ({ id, version }));
        } catch (error) {
          this.rethrowOcrFailure(error);
        }
      };
    } catch (error) {
      this.rethrowOcrFailure(error);
    }
  }

  private rethrowOcrFailure(error: unknown): never {
    if (error instanceof HttpException) {
      const status = error.getStatus();
      if (status === 400 || status === 404 || status === 409)
        throw new CashWriteRejection(status, error.message);
    }
    throw error;
  }

  // ---------------------------------------------------------------------------
  // Products
  // ---------------------------------------------------------------------------

  async findAllProducts(
    { page = 1, limit = 10, all = false, includes = true, q }: GetProductsDto,
    maxRows?: number,
    actor?: ActorReference,
  ): Promise<GetProductsResponse> {
    const scope = await resolveBusinessAccess(
      this.productRepository.manager,
      this.actor(actor),
    );
    await this.modules.execute(this.actor(actor).userId, ['/business'], this.productRepository.manager);
    const qb = this.productRepository.createQueryBuilder('product');
    validateRansackEnvelope(q);

    if (includes) {
      qb.leftJoinAndSelect('product.business', 'business');
      qb.leftJoinAndSelect(
        'product.provider',
        'provider',
        'provider.business_id = product.business_id',
      );
    }

    const {
      stock_status_in,
      price_change_in,
      availability_in,
      barcode_eq,
      barcode_cont,
      has_stock_eq,
      has_stock_null,
      is_offer_enabled_eq,
      search,
      code_presence,
      barcode_presence,
      ...cleanQ
    } = q ?? {};
    applyProductLookupFilters(qb, { search, code_presence, barcode_presence });
    if (availability_in !== undefined) {
      if (
        !Array.isArray(availability_in) ||
        !availability_in.length ||
        availability_in.some(
          (state) => !['available', 'unavailable', 'unknown'].includes(state),
        )
      )
        throw new BadRequestException('product:invalid_availability');
      const predicates = availability_in.map((state) =>
        state === 'unknown'
          ? 'product.has_stock IS NULL'
          : `product.has_stock=${state === 'available' ? 'true' : 'false'}`,
      );
      qb.andWhere(`(${predicates.join(' OR ')})`);
    }
    if (barcode_eq !== undefined) {
      if (typeof barcode_eq !== 'string') throw new BadRequestException('product:invalid_barcode');
      validateBarcode(barcode_eq);
      qb.andWhere('product.barcode = :catalogBarcode', {
        catalogBarcode: barcode_eq,
      });
    }
    if (barcode_cont !== undefined && (typeof barcode_cont !== 'string' || barcode_cont.length > 255)) throw new BadRequestException('product:invalid_barcode');
    for (const value of [has_stock_eq, has_stock_null, is_offer_enabled_eq]) if (value !== undefined && typeof value !== 'boolean') throw new BadRequestException('product:invalid_availability');
    if (barcode_cont !== undefined)
      qb.andWhere('product.barcode ILIKE :catalogBarcodePart', {
        catalogBarcodePart: `%${barcode_cont.replace(/[\\%_]/g, '\\$&')}%`,
      });
    if (has_stock_eq !== undefined)
      qb.andWhere('product.has_stock = :catalogAvailability', {
        catalogAvailability: has_stock_eq,
      });
    if (has_stock_null !== undefined)
      qb.andWhere(`product.has_stock IS ${has_stock_null ? '' : 'NOT '}NULL`);
    if (is_offer_enabled_eq !== undefined)
      qb.andWhere('product.is_offer_enabled = :catalogOffer', {
        catalogOffer: is_offer_enabled_eq,
      });

    if (stock_status_in) {
      const statuses = Array.isArray(stock_status_in)
        ? stock_status_in
        : [stock_status_in];
      const conditions: string[] = [];
      if (statuses.includes('out')) {
        conditions.push('product.stock <= 0');
      }
      if (
        statuses.includes('low') ||
        statuses.includes('medium') ||
        statuses.includes('medio')
      ) {
        conditions.push('(product.stock > 0 AND product.stock < 10)');
      }
      if (statuses.includes('normal')) {
        conditions.push('product.stock >= 10');
      }
      if (conditions.length > 0) {
        qb.andWhere(`(${conditions.join(' OR ')})`);
      }
    }

    if (price_change_in) {
      const variations = Array.isArray(price_change_in)
        ? price_change_in
        : [price_change_in];
      const conditions: string[] = [];

      const previousSnapshotSql = `SELECT jsonb_build_object('sale_price',pl.sale_price,'measurement_unit',pl.measurement_unit)
        FROM product_logs pl
        WHERE pl.product_id=product.id AND (pl.sale_price,pl.cost_price,pl.cost_price_tax,pl.measurement_unit)
          IS DISTINCT FROM (product.sale_price,product.cost_price,product.cost_price_tax,product.measurement_unit)
          AND pl.source<>'manual'
        ORDER BY pl.created_at DESC,pl.id DESC LIMIT 1`;
      const previousPrice = `(price_baseline.value->>'sale_price')::integer`;

      if (
        variations.includes('increased') ||
        variations.includes('up') ||
        variations.includes('subio')
      ) {
        conditions.push(`product.sale_price > ${previousPrice}`);
      }
      if (
        variations.includes('decreased') ||
        variations.includes('down') ||
        variations.includes('bajo')
      ) {
        conditions.push(`product.sale_price < ${previousPrice}`);
      }
      if (
        variations.includes('unchanged') ||
        variations.includes('same') ||
        variations.includes('mantuvo')
      ) {
        conditions.push(`product.sale_price = ${previousPrice}`);
      }
      if (conditions.length > 0) {
        // Select the latest actual snapshot first. A different unit cannot be
        // replaced by an older matching unit or be counted as an unchanged price.
        qb.andWhere(`EXISTS(SELECT 1 FROM (SELECT COALESCE((${previousSnapshotSql}),
          jsonb_build_object('sale_price',product.sale_price,'measurement_unit',product.measurement_unit)) AS value) price_baseline
          WHERE price_baseline.value->>'measurement_unit'=product.measurement_unit
          AND (${conditions.join(' OR ')}))`);
      }
    }

    applyRansack(qb, cleanQ, 'product', RANSACK_POLICIES.product);

    if (!cleanQ?.s) {
      qb.addOrderBy('product.created_at', 'DESC');
    }
    if (!/^id(?:\s|$)/i.test(cleanQ?.s?.trim() ?? ''))
      qb.addOrderBy('product.id', 'ASC');

    scopeBusinessQuery(qb, 'product.business_id', scope);
    if (all) {
      if (maxRows !== undefined) {
        if (!Number.isSafeInteger(maxRows) || maxRows < 1 || maxRows > 1000)
          throw new BadRequestException('Export row limit is invalid');
        qb.take(maxRows + 1);
      }
      const data = await this.decorateProducts(await qb.getMany(), includes, this.actor(actor));
      return {
        data,
        meta: {
          page: 1,
          limit: data.length,
          total_items: data.length,
          total_pages: 1,
        },
      };
    }

    const [data, total_items] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const total_pages = Math.ceil(total_items / limit);

    return {
      data: await this.decorateProducts(data, includes, this.actor(actor)),
      meta: {
        page,
        limit,
        total_items,
        total_pages,
      },
    };
  }

  async findOneProduct(id: string, actor?: ActorReference): Promise<Product> {
    const scope = await resolveBusinessAccess(
      this.productRepository.manager,
      this.actor(actor),
    );
    await this.modules.execute(this.actor(actor).userId, ['/business'], this.productRepository.manager);
    const qb = this.productRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.business', 'business')
      .leftJoinAndSelect(
        'product.provider',
        'provider',
        'provider.business_id = product.business_id',
      )
      .where('product.id = :productId', { productId: this.referenceId(id) });
    scopeBusinessQuery(qb, 'product.business_id', scope);
    const product = await qb.getOne();
    if (!product) {
      throw new NotFoundException(`Product with ID "${id}" not found`);
    }
    return (await this.decorateProducts([product], true, this.actor(actor)))[0];
  }

  async createProduct(
    createDto: CreateProductDto,
    manager?: EntityManager,
    actor?: ActorReference,
  ): Promise<Product> {
    const current = this.actor(actor);
    if (!manager)
      return this.productRepository.manager.transaction((tx) =>
        this.createProduct(createDto, tx, current),
      );
    this.requireTransaction(manager);
    await this.authorizeBusinesses(manager, current, [createDto.business_id], {
      lock: true,
    });
    const products = manager.getRepository(Product);
    const logs = manager.getRepository(ProductLog);
    const attributes = this.productCreation(createDto);
    await this.validateReferences(
      manager,
      createDto.business_id,
      createDto.provider_id,
    );
    const product = products.create(attributes);
    const savedProduct = await this.persist(() => products.save(product));

    // Automatically record snapshot in product_logs
    const log = logs.create(
      productSnapshot(
        savedProduct,
        'create',
        current.userId,
        Object.keys(createDto),
      ),
    );
    await logs.save(log);

    return this.productResponse(savedProduct);
  }

  async createBulkProducts(
    bulkDto: BulkCreateProductDto,
    manager?: EntityManager,
    actor?: ActorReference,
  ): Promise<Product[]> {
    const current = this.actor(actor);
    if (!manager)
      return this.productRepository.manager.transaction((tx) =>
        this.createBulkProducts(bulkDto, tx, current),
      );
    this.requireTransaction(manager);
    await this.authorizeBusinesses(
      manager,
      current,
      bulkDto.items.map((item) => item.business_id),
      { lock: true },
    );
    const products = manager.getRepository(Product);
    const productLogs = manager.getRepository(ProductLog);
    await this.validateReferenceSet(manager, bulkDto.items);
    const attributes = bulkDto.items.map((item) => this.productCreation(item));
    const savedProducts = await this.persist(() =>
      products.save(products.create(attributes)),
    );
    const logs = savedProducts.map((prod, index) =>
      productLogs.create(
        productSnapshot(
          prod,
          'create',
          current.userId,
          Object.keys(bulkDto.items[index] ?? {}),
        ),
      ),
    );
    await productLogs.save(logs);
    return savedProducts.map((product) => this.productResponse(product));
  }

  async updateProduct(
    id: string,
    updateDto: UpdateProductDto,
    manager?: EntityManager,
    actor?: ActorReference,
  ): Promise<Product> {
    const current = this.actor(actor);
    id = this.referenceId(id);
    if (!manager)
      return this.productRepository.manager.transaction((tx) =>
        this.updateProduct(id, updateDto, tx, current),
      );
    this.requireTransaction(manager);
    const products = manager.getRepository(Product);
    const logs = manager.getRepository(ProductLog);
    const [product] = await this.lockProductUpdates(manager, current, [
      { ...updateDto, id },
    ]);
    const { candidate, changedFields } = await this.productUpdate(
      manager,
      product,
      updateDto,
    );
    const savedProduct = await this.persist(() => products.save(candidate));

    // Automatically record snapshot in product_logs
    const log = logs.create(
      productSnapshot(
        savedProduct,
        'update',
        current.userId,
        changedFields,
      ),
    );
    await logs.save(log);

    return this.productResponse(savedProduct);
  }

  async updateBulkProducts(
    bulkDto: BulkUpdateProductDto,
    manager?: EntityManager,
    actor?: ActorReference,
  ): Promise<Product[]> {
    const current = this.actor(actor);
    if (!manager)
      return this.productRepository.manager.transaction((tx) =>
        this.updateBulkProducts(bulkDto, tx, current),
      );
    this.requireTransaction(manager);
    const products = manager.getRepository(Product);
    const productLogs = manager.getRepository(ProductLog);
    const selected = await this.lockProductUpdates(manager, current, bulkDto.items);
    const candidates: Product[] = [];
    for (const [index, item] of bulkDto.items.entries()) {
      const { id: _id, ...attributes } = item;
      candidates.push((await this.productUpdate(manager, selected[index], attributes)).candidate);
    }
    const savedProducts = await this.persist(() => products.save(candidates));
    const logs = savedProducts.map((prod, index) =>
      productLogs.create(
        productSnapshot(
          prod,
          'update',
          current.userId,
          Object.keys(bulkDto.items[index] ?? {}).filter(
            (key) => !['id', 'expected_version'].includes(key),
          ),
        ),
      ),
    );
    await productLogs.save(logs);
    return savedProducts.map((product) => this.productResponse(product));
  }

  // ---------------------------------------------------------------------------
  // Product Logs
  // ---------------------------------------------------------------------------

  async findAllLogs(
    {
      page = 1,
      limit = 10,
      all = false,
      includes = true,
      q,
    }: GetProductLogsDto,
    actor?: ActorReference,
  ): Promise<GetProductLogsResponse> {
    const scope = await resolveBusinessAccess(
      this.productLogRepository.manager,
      this.actor(actor),
    );
    await this.modules.execute(this.actor(actor).userId, ['/business'], this.productLogRepository.manager);
    const qb = this.productLogRepository.createQueryBuilder('product_log');
    validateRansackEnvelope(q);

    if (includes) {
      qb.leftJoinAndSelect('product_log.product', 'product');
    } else qb.innerJoin('product_log.product', 'product');

    applyRansack(qb, q, 'product_log', RANSACK_POLICIES.product_log);
    if (!/^id(?:\s|$)/i.test(q?.s?.trim() ?? ''))
      qb.addOrderBy('product_log.id', 'ASC');

    scopeBusinessQuery(qb, 'product.business_id', scope);
    if (all) {
      const data = await qb.getMany();
      return {
        data,
        meta: {
          page: 1,
          limit: data.length,
          total_items: data.length,
          total_pages: 1,
        },
      };
    }

    const [data, total_items] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const total_pages = Math.ceil(total_items / limit);

    return {
      data,
      meta: {
        page,
        limit,
        total_items,
        total_pages,
      },
    };
  }

  async findOneLog(id: string, actor?: ActorReference): Promise<ProductLog> {
    const scope = await resolveBusinessAccess(
      this.productLogRepository.manager,
      this.actor(actor),
    );
    await this.modules.execute(this.actor(actor).userId, ['/business'], this.productLogRepository.manager);
    const qb = this.productLogRepository
      .createQueryBuilder('product_log')
      .innerJoinAndSelect('product_log.product', 'product')
      .where('product_log.id = :logId', { logId: this.logId(id) });
    scopeBusinessQuery(qb, 'product.business_id', scope);
    const log = await qb.getOne();
    if (!log) {
      throw new NotFoundException(`ProductLog with ID "${id}" not found`);
    }
    return log;
  }

  async createLog(
    dto: CreateProductLogDto,
    manager?: EntityManager,
    actor?: ActorReference,
  ): Promise<ProductLog> {
    const current = this.actor(actor);
    if (!manager)
      return this.productLogRepository.manager.transaction((tx) =>
        this.createLog(dto, tx, current),
      );
    this.requireTransaction(manager);
    await this.authorizeProducts(manager, [dto.product_id], current);
    const logs = manager.getRepository(ProductLog);
    const log = logs.create({
      ...this.catalogFields(dto, true),
      source: 'manual',
      event_type: 'manual',
      actor_id: current.userId,
    });
    return logs.save(log);
  }

  async createBulkLogs(
    dto: BulkCreateProductLogDto,
    manager?: EntityManager,
    actor?: ActorReference,
  ): Promise<ProductLog[]> {
    const current = this.actor(actor);
    if (!manager)
      return this.productLogRepository.manager.transaction((tx) =>
        this.createBulkLogs(dto, tx, current),
      );
    this.requireTransaction(manager);
    await this.authorizeProducts(
      manager,
      dto.items.map((item) => item.product_id),
      current,
    );
    const logs = manager.getRepository(ProductLog);
    return logs.save(
      logs.create(
        dto.items.map((item) => ({
          ...this.catalogFields(item, true),
          source: 'manual',
          event_type: 'manual',
          actor_id: current.userId,
        })),
      ),
    );
  }

  async updateLog(
    id: string,
    dto: UpdateProductLogDto,
    manager?: EntityManager,
    actor?: ActorReference,
  ): Promise<ProductLog> {
    const current = this.actor(actor);
    id = this.logId(id);
    if (!manager)
      return this.productLogRepository.manager.transaction((tx) =>
        this.updateLog(id, dto, tx, current),
      );
    this.requireTransaction(manager);
    await this.authorizeBusinesses(manager, current, [], { lock: true });
    const logs = manager.getRepository(ProductLog);
    const log = await logs.findOne({
      where: { id },
      lock: { mode: 'pessimistic_write' },
    });
    if (!log)
      throw new NotFoundException(`ProductLog with ID "${id}" not found`);
    await this.authorizeProducts(
      manager,
      [log.product_id, dto.product_id ?? log.product_id],
      current,
    );
    Object.assign(log, this.catalogFields(dto), {
      source: 'manual',
      event_type: 'manual',
      actor_id: current.userId,
      product_version: null,
    });
    return logs.save(log);
  }

  async updateBulkLogs(
    dto: BulkUpdateProductLogDto,
    manager?: EntityManager,
    actor?: ActorReference,
  ): Promise<ProductLog[]> {
    const current = this.actor(actor);
    if (!manager)
      return this.productLogRepository.manager.transaction((tx) =>
        this.updateBulkLogs(dto, tx, current),
      );
    this.requireTransaction(manager);
    await this.authorizeBusinesses(manager, current, [], { lock: true });
    const ids = dto.items.map((item) => this.logId(item.id));
    if (new Set(ids.map((id) => id.toLowerCase())).size !== ids.length)
      throw new BadRequestException(
        'A product log may appear only once in a bulk update',
      );
    const logs = manager.getRepository(ProductLog);
    const selected = await logs
      .createQueryBuilder('product_log')
      .where('product_log.id IN (:...ids)', { ids })
      .orderBy('product_log.id', 'ASC')
      .setLock('pessimistic_write')
      .getMany();
    if (selected.length !== ids.length)
      throw new NotFoundException('ProductLog not found');
    const byId = new Map(selected.map((log) => [log.id.toLowerCase(), log]));
    const candidates = dto.items.map(({ id, ...attrs }) =>
      Object.assign(new ProductLog(), byId.get(id.toLowerCase())!, this.catalogFields(attrs), {
        source: 'manual',
        event_type: 'manual',
        actor_id: current.userId,
        product_version: null,
      }),
    );
    await this.authorizeProducts(
      manager,
      [...selected, ...candidates].map((log) => log.product_id),
      current,
    );
    return logs.save(candidates);
  }
}
