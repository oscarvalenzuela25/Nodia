import { BadRequestException, Injectable } from '@nestjs/common';
import { ProductService } from '../product.service.js';
import { ExportProductsCsvDto } from '../dto/export-products-csv.dto.js';
import { Product } from '../entities/product.entity.js';
import type { GetProductsDto } from '../dto/get-products.dto.js';

/** Internal resource ceilings; never accepted as HTTP DTO fields. */
export interface ProductCsvExportLimits {
  readonly maxRows: number;
  readonly maxBytes: number;
  readonly signal?: AbortSignal;
}

@Injectable()
export class ExportProductsCsvUseCase {
  constructor(private readonly productService: ProductService) {}

  private escapeCsvValue(val: unknown): string {
    if (val === null || val === undefined) return '';
    const raw = String(val);
    const str = /^(?:[=+\-@\t\r']|\s+[=+\-@])/.test(raw) ? `'${raw}` : raw;
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  async execute(dto: ExportProductsCsvDto, limits?: ProductCsvExportLimits): Promise<string> {
    limits?.signal?.throwIfAborted();
    if (limits && (!Number.isSafeInteger(limits.maxRows) || limits.maxRows < 1 || limits.maxRows > 1000 || !Number.isSafeInteger(limits.maxBytes) || limits.maxBytes < 1))
      throw new BadRequestException('Export resource limits are invalid');
    const isEn = dto.lang?.toLowerCase().startsWith('en');

    const header = isEn
      ? 'Code (code),Name (name),Base cost (cost_price),Tax (cost_price_tax),Margin % (profit_percentage),Sale price (sale_price),Stock (stock),Active (is_active),ID (id)'
      : 'Código (code),Nombre (name),Costo base (cost_price),Impuesto (cost_price_tax),Margen % (profit_percentage),Precio de venta (sale_price),Stock (stock),Activo (is_active),ID (id)';

    const queryParams: GetProductsDto = { all: true, includes: false };
    if (dto.business_id) {
      queryParams.q = { business_id_eq: dto.business_id };
    }

    const response = limits
      ? await this.productService.findAllProducts(queryParams, limits.maxRows)
      : await this.productService.findAllProducts(queryParams);
    if (!Array.isArray(response.data)) throw new BadRequestException('Export source returned an invalid result');
    const products: Product[] = response.data;
    limits?.signal?.throwIfAborted();
    if (limits && products.length > limits.maxRows)
      throw new BadRequestException('Export exceeds row limit; narrow the view');

    const lines = [header];
    let bytes = Buffer.byteLength(header, 'utf8');
    if (limits && bytes > limits.maxBytes)
      throw new BadRequestException('Export exceeds byte limit; narrow the view');

    for (const product of products) {
      limits?.signal?.throwIfAborted();
      const row = [
        this.escapeCsvValue(product.code),
        this.escapeCsvValue(product.name),
        this.escapeCsvValue(product.cost_price),
        this.escapeCsvValue(product.cost_price_tax),
        this.escapeCsvValue(product.profit_percentage),
        this.escapeCsvValue(product.sale_price),
        this.escapeCsvValue(product.stock),
        this.escapeCsvValue(product.is_active),
        this.escapeCsvValue(product.id),
      ].join(',');
      bytes += Buffer.byteLength(row, 'utf8') + 1;
      if (limits && bytes > limits.maxBytes)
        throw new BadRequestException('Export exceeds byte limit; narrow the view');
      lines.push(row);
    }

    return lines.join('\n');
  }
}
