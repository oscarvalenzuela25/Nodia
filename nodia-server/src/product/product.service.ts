import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, type EntityManager } from 'typeorm';
import { Product } from './entities/product.entity.js';
import { ProductLog } from './entities/product-log.entity.js';
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
import {
  GetProductsResponse,
  GetProductLogsResponse,
} from './types/product.types.js';

@Injectable()
export class ProductService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(ProductLog)
    private readonly productLogRepository: Repository<ProductLog>,
  ) {}

  private requireTransaction(manager: EntityManager): void {
    if (!manager.queryRunner?.isTransactionActive)
      throw new BadRequestException(
        'Product effect requires an active transaction',
      );
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

  /** Individual and legacy bulk writers share the same relation barrier. */
  private async validateReferenceSet(
    manager: EntityManager,
    references: readonly { business_id: string; provider_id?: string | null }[],
  ): Promise<void> {
    if (
      references.some(
        (item) => typeof item.business_id !== 'string' || !item.business_id,
      )
    )
      throw new BadRequestException('Invalid business ID');
    const businessIds = [
      ...new Set(references.map((item) => item.business_id.toLowerCase())),
    ].sort();
    const businesses: { id: string }[] = await manager.query(
      'SELECT id::text FROM businesses WHERE id=ANY($1::uuid[]) ORDER BY id FOR SHARE',
      [businessIds],
    );
    if (businesses.length !== businessIds.length)
      throw new NotFoundException('Business not found');
    const providerIds = [
      ...new Set(
        references.flatMap((item) =>
          item.provider_id == null ? [] : [this.referenceId(item.provider_id)],
        ),
      ),
    ].sort((a, b) =>
      BigInt(a) < BigInt(b) ? -1 : BigInt(a) > BigInt(b) ? 1 : 0,
    );
    if (!providerIds.length) return;
    const providers: { id: string; business_id: string }[] =
      await manager.query(
        'SELECT id::text,business_id::text FROM providers WHERE id=ANY($1::bigint[]) ORDER BY id FOR SHARE',
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
    )
      throw new BadRequestException(
        'Provider does not belong to this business',
      );
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

  // ---------------------------------------------------------------------------
  // Products
  // ---------------------------------------------------------------------------

  async findAllProducts(
    { page = 1, limit = 10, all = false, includes = true, q }: GetProductsDto,
    maxRows?: number,
  ): Promise<GetProductsResponse> {
    const qb = this.productRepository.createQueryBuilder('product');
    validateRansackEnvelope(q);

    if (includes) {
      qb.leftJoinAndSelect('product.business', 'business');
      qb.leftJoinAndSelect('product.provider', 'provider');
    }

    const { stock_status_in, price_change_in, ...cleanQ } = q ?? {};

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

      const prevPriceSql = `COALESCE(
        CASE
          WHEN (
            SELECT pl_top.sale_price
            FROM product_logs pl_top
            WHERE pl_top.product_id = product.id
            ORDER BY pl_top.created_at DESC
            LIMIT 1
          ) != product.sale_price
          THEN (
            SELECT pl_top.sale_price
            FROM product_logs pl_top
            WHERE pl_top.product_id = product.id
            ORDER BY pl_top.created_at DESC
            LIMIT 1
          )
          ELSE (
            SELECT pl_prev.sale_price
            FROM product_logs pl_prev
            WHERE pl_prev.product_id = product.id
              AND pl_prev.id != (
                SELECT pl_first.id
                FROM product_logs pl_first
                WHERE pl_first.product_id = product.id
                ORDER BY pl_first.created_at DESC
                LIMIT 1
              )
            ORDER BY pl_prev.created_at DESC
            LIMIT 1
          )
        END,
        product.sale_price
      )`;

      if (
        variations.includes('increased') ||
        variations.includes('up') ||
        variations.includes('subio')
      ) {
        conditions.push(`product.sale_price > (${prevPriceSql})`);
      }
      if (
        variations.includes('decreased') ||
        variations.includes('down') ||
        variations.includes('bajo')
      ) {
        conditions.push(`product.sale_price < (${prevPriceSql})`);
      }
      if (
        variations.includes('unchanged') ||
        variations.includes('same') ||
        variations.includes('mantuvo')
      ) {
        conditions.push(`product.sale_price = (${prevPriceSql})`);
      }
      if (conditions.length > 0) {
        qb.andWhere(`(${conditions.join(' OR ')})`);
      }
    }

    applyRansack(qb, cleanQ, 'product', RANSACK_POLICIES.product);

    if (!cleanQ?.s) {
      qb.addOrderBy('product.created_at', 'DESC');
    }
    if (!/^id(?:\s|$)/i.test(cleanQ?.s?.trim() ?? ''))
      qb.addOrderBy('product.id', 'ASC');

    if (all) {
      if (maxRows !== undefined) {
        if (!Number.isSafeInteger(maxRows) || maxRows < 1 || maxRows > 1000)
          throw new BadRequestException('Export row limit is invalid');
        qb.take(maxRows + 1);
      }
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

  async findOneProduct(id: string): Promise<Product> {
    const product = await this.productRepository.findOne({
      where: { id },
      relations: { business: true, provider: true },
    });
    if (!product) {
      throw new NotFoundException(`Product with ID "${id}" not found`);
    }
    return product;
  }

  async createProduct(
    createDto: CreateProductDto,
    manager?: EntityManager,
  ): Promise<Product> {
    if (!manager)
      return this.productRepository.manager.transaction((tx) =>
        this.createProduct(createDto, tx),
      );
    this.requireTransaction(manager);
    const products = manager.getRepository(Product);
    const logs = manager.getRepository(ProductLog);
    await this.validateReferences(
      manager,
      createDto.business_id,
      createDto.provider_id,
    );
    const product = products.create(createDto);
    const savedProduct = await products.save(product);

    // Automatically record snapshot in product_logs
    const log = logs.create({
      product_id: savedProduct.id,
      code: savedProduct.code,
      name: savedProduct.name,
      cost_price: savedProduct.cost_price,
      cost_price_tax: savedProduct.cost_price_tax,
      profit_percentage: savedProduct.profit_percentage,
      sale_price: savedProduct.sale_price,
      stock: savedProduct.stock,
    });
    await logs.save(log);

    return savedProduct;
  }

  async createBulkProducts(
    bulkDto: BulkCreateProductDto,
    manager?: EntityManager,
  ): Promise<Product[]> {
    if (!manager)
      return this.productRepository.manager.transaction((tx) =>
        this.createBulkProducts(bulkDto, tx),
      );
    this.requireTransaction(manager);
    const products = manager.getRepository(Product);
    const productLogs = manager.getRepository(ProductLog);
    await this.validateReferenceSet(manager, bulkDto.items);
    const savedProducts = await products.save(products.create(bulkDto.items));
    const logs = savedProducts.map((prod) =>
      productLogs.create({
        product_id: prod.id,
        code: prod.code,
        name: prod.name,
        cost_price: prod.cost_price,
        cost_price_tax: prod.cost_price_tax,
        profit_percentage: prod.profit_percentage,
        sale_price: prod.sale_price,
        stock: prod.stock,
      }),
    );
    await productLogs.save(logs);
    return savedProducts;
  }

  async updateProduct(
    id: string,
    updateDto: UpdateProductDto,
    manager?: EntityManager,
  ): Promise<Product> {
    if (!manager)
      return this.productRepository.manager.transaction((tx) =>
        this.updateProduct(id, updateDto, tx),
      );
    this.requireTransaction(manager);
    const products = manager.getRepository(Product);
    const logs = manager.getRepository(ProductLog);
    const product = await products.findOne({
      where: { id },
      lock: { mode: 'pessimistic_write' },
    });
    if (!product)
      throw new NotFoundException(`Product with ID "${id}" not found`);
    await this.validateReferences(
      manager,
      updateDto.business_id ?? product.business_id,
      updateDto.provider_id === undefined
        ? product.provider_id
        : updateDto.provider_id,
    );
    Object.assign(product, updateDto);
    const savedProduct = await products.save(product);

    // Automatically record snapshot in product_logs
    const log = logs.create({
      product_id: savedProduct.id,
      code: savedProduct.code,
      name: savedProduct.name,
      cost_price: savedProduct.cost_price,
      cost_price_tax: savedProduct.cost_price_tax,
      profit_percentage: savedProduct.profit_percentage,
      sale_price: savedProduct.sale_price,
      stock: savedProduct.stock,
    });
    await logs.save(log);

    return savedProduct;
  }

  async updateBulkProducts(
    bulkDto: BulkUpdateProductDto,
    manager?: EntityManager,
  ): Promise<Product[]> {
    if (!manager)
      return this.productRepository.manager.transaction((tx) =>
        this.updateBulkProducts(bulkDto, tx),
      );
    this.requireTransaction(manager);
    const products = manager.getRepository(Product);
    const productLogs = manager.getRepository(ProductLog);
    const ids = bulkDto.items.map((item) => this.referenceId(item.id));
    if (new Set(ids).size !== ids.length)
      throw new BadRequestException(
        'A product may appear only once in a bulk update',
      );
    const selected = await products
      .createQueryBuilder('product')
      .where('product.id IN (:...ids)', { ids })
      .orderBy('product.id', 'ASC')
      .setLock('pessimistic_write')
      .getMany();
    const locked = new Map(selected.map((product) => [product.id, product]));
    if (locked.size !== ids.length) {
      const missing = ids.find((id) => !locked.has(id));
      throw new NotFoundException(`Product with ID "${missing}" not found`);
    }
    const candidates = bulkDto.items.map((item, index) => {
      const { id: _id, ...attributes } = item;
      return Object.assign(new Product(), locked.get(ids[index])!, attributes);
    });
    await this.validateReferenceSet(manager, candidates);
    const savedProducts = await products.save(candidates);
    const logs = savedProducts.map((prod) =>
      productLogs.create({
        product_id: prod.id,
        code: prod.code,
        name: prod.name,
        cost_price: prod.cost_price,
        cost_price_tax: prod.cost_price_tax,
        profit_percentage: prod.profit_percentage,
        sale_price: prod.sale_price,
        stock: prod.stock,
      }),
    );
    await productLogs.save(logs);
    return savedProducts;
  }

  // ---------------------------------------------------------------------------
  // Product Logs
  // ---------------------------------------------------------------------------

  async findAllLogs({
    page = 1,
    limit = 10,
    all = false,
    includes = true,
    q,
  }: GetProductLogsDto): Promise<GetProductLogsResponse> {
    const qb = this.productLogRepository.createQueryBuilder('product_log');
    validateRansackEnvelope(q);

    if (includes) {
      qb.leftJoinAndSelect('product_log.product', 'product');
    }

    applyRansack(qb, q, 'product_log', RANSACK_POLICIES.product_log);
    if (!/^id(?:\s|$)/i.test(q?.s?.trim() ?? ''))
      qb.addOrderBy('product_log.id', 'ASC');

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

  async findOneLog(id: string): Promise<ProductLog> {
    const log = await this.productLogRepository.findOne({
      where: { id },
      relations: { product: true },
    });
    if (!log) {
      throw new NotFoundException(`ProductLog with ID "${id}" not found`);
    }
    return log;
  }

  async createLog(
    dto: CreateProductLogDto,
    manager?: EntityManager,
  ): Promise<ProductLog> {
    if (!manager)
      return this.productLogRepository.manager.transaction((tx) =>
        this.createLog(dto, tx),
      );
    this.requireTransaction(manager);
    const logs = manager.getRepository(ProductLog);
    if (
      !(
        await manager.query('SELECT id FROM products WHERE id=$1 FOR SHARE', [
          dto.product_id,
        ])
      ).length
    )
      throw new NotFoundException('Product not found');
    const log = logs.create(dto);
    return logs.save(log);
  }

  async createBulkLogs(dto: BulkCreateProductLogDto): Promise<ProductLog[]> {
    const logs = this.productLogRepository.create(dto.items);
    return this.productLogRepository.save(logs);
  }

  async updateLog(
    id: string,
    dto: UpdateProductLogDto,
    manager?: EntityManager,
  ): Promise<ProductLog> {
    if (!manager)
      return this.productLogRepository.manager.transaction((tx) =>
        this.updateLog(id, dto, tx),
      );
    this.requireTransaction(manager);
    const logs = manager.getRepository(ProductLog);
    const log = await logs.findOne({
      where: { id },
      lock: { mode: 'pessimistic_write' },
    });
    if (!log)
      throw new NotFoundException(`ProductLog with ID "${id}" not found`);
    if (
      !(
        await manager.query('SELECT id FROM products WHERE id=$1 FOR SHARE', [
          dto.product_id ?? log.product_id,
        ])
      ).length
    )
      throw new NotFoundException('Product not found');
    Object.assign(log, dto);
    return logs.save(log);
  }

  async updateBulkLogs(dto: BulkUpdateProductLogDto): Promise<ProductLog[]> {
    const updatedLogs: ProductLog[] = [];
    for (const item of dto.items) {
      const { id, ...attrs } = item;
      const log = await this.findOneLog(id);
      Object.assign(log, attrs);
      updatedLogs.push(log);
    }
    return this.productLogRepository.save(updatedLogs);
  }
}
