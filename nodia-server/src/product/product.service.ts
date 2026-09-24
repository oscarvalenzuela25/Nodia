import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
import { applyRansack } from '../common/utils/ransack-query.builder.js';
import { GetProductsResponse, GetProductLogsResponse } from './types/product.types.js';

@Injectable()
export class ProductService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(ProductLog)
    private readonly productLogRepository: Repository<ProductLog>,
  ) {}

  // ---------------------------------------------------------------------------
  // Products
  // ---------------------------------------------------------------------------

  async findAllProducts({
    page = 1,
    limit = 10,
    all = false,
    includes = true,
    q,
  }: GetProductsDto): Promise<GetProductsResponse> {
    const qb = this.productRepository.createQueryBuilder('product');

    if (includes) {
      qb.leftJoinAndSelect('product.business', 'business');
      qb.leftJoinAndSelect('product.provider', 'provider');
    }

    const { stock_status_in, ...cleanQ } = q ?? {};

    if (stock_status_in) {
      const statuses = Array.isArray(stock_status_in)
        ? stock_status_in
        : [stock_status_in];
      const conditions: string[] = [];
      if (statuses.includes('out')) {
        conditions.push('product.stock <= 0');
      }
      if (statuses.includes('low') || statuses.includes('medium') || statuses.includes('medio')) {
        conditions.push('(product.stock > 0 AND product.stock < 10)');
      }
      if (statuses.includes('normal')) {
        conditions.push('product.stock >= 10');
      }
      if (conditions.length > 0) {
        qb.andWhere(`(${conditions.join(' OR ')})`);
      }
    }

    applyRansack(qb, cleanQ, 'product');

    if (!cleanQ?.s) {
      qb.addOrderBy('product.created_at', 'DESC');
    }

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

  async createProduct(createDto: CreateProductDto): Promise<Product> {
    const product = this.productRepository.create(createDto);
    const savedProduct = await this.productRepository.save(product);

    // Automatically record snapshot in product_logs
    const log = this.productLogRepository.create({
      product_id: savedProduct.id,
      code: savedProduct.code,
      name: savedProduct.name,
      cost_price: savedProduct.cost_price,
      cost_price_tax: savedProduct.cost_price_tax,
      profit_percentage: savedProduct.profit_percentage,
      sale_price: savedProduct.sale_price,
      stock: savedProduct.stock,
    });
    await this.productLogRepository.save(log);

    return savedProduct;
  }

  async createBulkProducts(bulkDto: BulkCreateProductDto): Promise<Product[]> {
    const entities = this.productRepository.create(bulkDto.items);
    const savedProducts = await this.productRepository.save(entities);

    // Automatically record snapshot in product_logs
    const logs = savedProducts.map((prod) =>
      this.productLogRepository.create({
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
    await this.productLogRepository.save(logs);

    return savedProducts;
  }

  async updateProduct(id: string, updateDto: UpdateProductDto): Promise<Product> {
    const product = await this.findOneProduct(id);
    Object.assign(product, updateDto);
    const savedProduct = await this.productRepository.save(product);

    // Automatically record snapshot in product_logs
    const log = this.productLogRepository.create({
      product_id: savedProduct.id,
      code: savedProduct.code,
      name: savedProduct.name,
      cost_price: savedProduct.cost_price,
      cost_price_tax: savedProduct.cost_price_tax,
      profit_percentage: savedProduct.profit_percentage,
      sale_price: savedProduct.sale_price,
      stock: savedProduct.stock,
    });
    await this.productLogRepository.save(log);

    return savedProduct;
  }

  async updateBulkProducts(bulkDto: BulkUpdateProductDto): Promise<Product[]> {
    const updatedProducts: Product[] = [];
    for (const item of bulkDto.items) {
      const { id, ...attrs } = item;
      const product = await this.findOneProduct(id);
      Object.assign(product, attrs);
      updatedProducts.push(product);
    }
    const savedProducts = await this.productRepository.save(updatedProducts);

    // Automatically record snapshot in product_logs
    const logs = savedProducts.map((prod) =>
      this.productLogRepository.create({
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
    await this.productLogRepository.save(logs);

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

    if (includes) {
      qb.leftJoinAndSelect('product_log.product', 'product');
    }

    applyRansack(qb, q, 'product_log');

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

  async createLog(dto: CreateProductLogDto): Promise<ProductLog> {
    const log = this.productLogRepository.create(dto);
    return this.productLogRepository.save(log);
  }

  async createBulkLogs(dto: BulkCreateProductLogDto): Promise<ProductLog[]> {
    const logs = this.productLogRepository.create(dto.items);
    return this.productLogRepository.save(logs);
  }

  async updateLog(id: string, dto: UpdateProductLogDto): Promise<ProductLog> {
    const log = await this.findOneLog(id);
    Object.assign(log, dto);
    return this.productLogRepository.save(log);
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
