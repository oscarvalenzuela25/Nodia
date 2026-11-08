import { BadRequestException, Injectable } from '@nestjs/common';
import { ProductService } from '../product.service.js';
import { ExportProductsCsvDto } from '../dto/export-products-csv.dto.js';
import { Product } from '../entities/product.entity.js';
import type { GetProductsDto } from '../dto/get-products.dto.js';
import type { ActorReference } from '../../authorization/authority-transaction.js';

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
    if (
      str.includes(',') ||
      str.includes('"') ||
      str.includes('\n') ||
      str.includes('\r')
    ) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  async execute(
    dto: ExportProductsCsvDto,
    limits?: ProductCsvExportLimits,
    actor?: ActorReference,
  ): Promise<string> {
    limits?.signal?.throwIfAborted();
    if (
      limits &&
      (!Number.isSafeInteger(limits.maxRows) ||
        limits.maxRows < 1 ||
        limits.maxRows > 1000 ||
        !Number.isSafeInteger(limits.maxBytes) ||
        limits.maxBytes < 1)
    )
      throw new BadRequestException('Export resource limits are invalid');
    const isEn = dto.lang?.toLowerCase().startsWith('en');

    const header = isEn
      ? 'Supplier code (code),Barcode (barcode),Name (name),Measurement unit (measurement_unit),Base cost (cost_price),Tax-inclusive cost (cost_price_tax),Regular price (sale_price),Alternative price (offer_price),Alternative enabled (is_offer_enabled),Available (has_stock),Legacy stock (stock),Active (is_active),ID (id),Version (version)'
      : 'Código proveedor (code),Código de barras (barcode),Nombre (name),Unidad de medida (measurement_unit),Costo base (cost_price),Costo con IVA (cost_price_tax),Precio normal (sale_price),Precio alternativo (offer_price),Alternativo habilitado (is_offer_enabled),Disponible (has_stock),Stock histórico (stock),Activo (is_active),ID (id),Versión (version)';

    const queryParams: GetProductsDto = { all: true, includes: false };
    if (dto.business_id) {
      queryParams.q = { business_id_eq: dto.business_id };
    }

    const response = actor
      ? await this.productService.findAllProducts(
          queryParams,
          limits?.maxRows,
          actor,
        )
      : limits
        ? await this.productService.findAllProducts(queryParams, limits.maxRows)
        : await this.productService.findAllProducts(queryParams);
    if (!Array.isArray(response.data))
      throw new BadRequestException('Export source returned an invalid result');
    const products: Product[] = response.data;
    limits?.signal?.throwIfAborted();
    if (limits && products.length > limits.maxRows)
      throw new BadRequestException(
        'Export exceeds row limit; narrow the view',
      );

    const lines = [header];
    let bytes = Buffer.byteLength(header, 'utf8');
    if (limits && bytes > limits.maxBytes)
      throw new BadRequestException(
        'Export exceeds byte limit; narrow the view',
      );

    for (const product of products) {
      limits?.signal?.throwIfAborted();
      const row = [
        this.escapeCsvValue(product.code),
        this.escapeCsvValue(product.barcode),
        this.escapeCsvValue(product.name),
        this.escapeCsvValue(product.measurement_unit),
        this.escapeCsvValue(product.cost_price),
        this.escapeCsvValue(product.cost_price_tax),
        this.escapeCsvValue(product.sale_price),
        this.escapeCsvValue(product.offer_price),
        this.escapeCsvValue(product.is_offer_enabled),
        this.escapeCsvValue(product.has_stock),
        this.escapeCsvValue(product.stock),
        this.escapeCsvValue(product.is_active),
        this.escapeCsvValue(product.id),
        this.escapeCsvValue(product.version),
      ].join(',');
      bytes += Buffer.byteLength(row, 'utf8') + 1;
      if (limits && bytes > limits.maxBytes)
        throw new BadRequestException(
          'Export exceeds byte limit; narrow the view',
        );
      lines.push(row);
    }

    return lines.join('\n');
  }
}
