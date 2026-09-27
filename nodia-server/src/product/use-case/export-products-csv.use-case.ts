import { Injectable } from '@nestjs/common';
import { ProductService } from '../product.service.js';
import { ExportProductsCsvDto } from '../dto/export-products-csv.dto.js';
import { Product } from '../entities/product.entity.js';

@Injectable()
export class ExportProductsCsvUseCase {
  constructor(private readonly productService: ProductService) {}

  private escapeCsvValue(val: unknown): string {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  async execute(dto: ExportProductsCsvDto): Promise<string> {
    const isEn = dto.lang?.toLowerCase().startsWith('en');

    const header = isEn
      ? 'Code (code),Name (name),Base cost (cost_price),Tax (cost_price_tax),Margin % (profit_percentage),Sale price (sale_price),Stock (stock),Active (is_active),ID (id)'
      : 'Código (code),Nombre (name),Costo base (cost_price),Impuesto (cost_price_tax),Margen % (profit_percentage),Precio de venta (sale_price),Stock (stock),Activo (is_active),ID (id)';

    const queryParams: any = { all: true, includes: false };
    if (dto.business_id) {
      queryParams.q = { business_id_eq: dto.business_id };
    }

    const response = await this.productService.findAllProducts(queryParams);
    const products: Product[] = response.data || [];

    const lines = [header];

    for (const product of products) {
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
      lines.push(row);
    }

    return lines.join('\n');
  }
}
