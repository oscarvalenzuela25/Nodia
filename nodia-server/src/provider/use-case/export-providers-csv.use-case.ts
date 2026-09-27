import { Injectable } from '@nestjs/common';
import { ProviderService } from '../provider.service.js';
import { ExportProvidersCsvDto } from '../dto/export-providers-csv.dto.js';
import { Provider } from '../entities/provider.entity.js';

@Injectable()
export class ExportProvidersCsvUseCase {
  constructor(private readonly providerService: ProviderService) {}

  private escapeCsvValue(val: unknown): string {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  private extractField(raw: unknown): { value: string; instructions: string } {
    if (!raw) return { value: '', instructions: '' };
    if (typeof raw === 'string') return { value: raw, instructions: '' };
    if (typeof raw === 'object' && raw !== null) {
      const obj = raw as Record<string, unknown>;
      return {
        value: typeof obj.value === 'string' ? obj.value : '',
        instructions: typeof obj.instructions === 'string' ? obj.instructions : '',
      };
    }
    return { value: '', instructions: '' };
  }

  async execute(dto: ExportProvidersCsvDto): Promise<string> {
    const isEn = dto.lang?.toLowerCase().startsWith('en');

    const header = isEn
      ? 'Name (name),Tax % (tax),Active (is_active),Code Column (field_code),Code Instructions (instructions_code),Net Cost Column (field_cost_price),Net Cost Instructions (instructions_cost_price),Tax Cost Column (field_cost_price_tax),Tax Cost Instructions (instructions_cost_price_tax),Packages Column (field_packages),Packages Instructions (instructions_packages),Units Per Package Column (field_units_per_package),Units Per Package Instructions (instructions_units_per_package),ID (id)'
      : 'Nombre (name),Impuesto % (tax),Activo (is_active),Columna Código (field_code),Instrucciones Código (instructions_code),Columna Costo Neto (field_cost_price),Instrucciones Costo Neto (instructions_cost_price),Columna Costo IVA (field_cost_price_tax),Instrucciones Costo IVA (instructions_cost_price_tax),Columna Bultos (field_packages),Instrucciones Bultos (instructions_packages),Columna Unidades por Bulto (field_units_per_package),Instrucciones Unidades por Bulto (instructions_units_per_package),ID (id)';

    const queryParams: any = { all: true, includes: false };
    if (dto.business_id) {
      queryParams.q = { business_id_eq: dto.business_id };
    }

    const response = await this.providerService.findAll(queryParams);
    const providers: Provider[] = response.data || [];

    const lines = [header];

    for (const provider of providers) {
      const fields = provider.fields || {};
      const codeField = this.extractField(fields.code);
      const costPriceField = this.extractField(fields.cost_price);
      const costPriceTaxField = this.extractField(fields.cost_price_tax);
      const packagesField = this.extractField(fields.packages);
      const unitsPerPackageField = this.extractField(fields.units_per_package);

      const row = [
        this.escapeCsvValue(provider.name),
        this.escapeCsvValue(provider.tax ?? 19),
        this.escapeCsvValue(provider.is_active),
        this.escapeCsvValue(codeField.value),
        this.escapeCsvValue(codeField.instructions),
        this.escapeCsvValue(costPriceField.value),
        this.escapeCsvValue(costPriceField.instructions),
        this.escapeCsvValue(costPriceTaxField.value),
        this.escapeCsvValue(costPriceTaxField.instructions),
        this.escapeCsvValue(packagesField.value),
        this.escapeCsvValue(packagesField.instructions),
        this.escapeCsvValue(unitsPerPackageField.value),
        this.escapeCsvValue(unitsPerPackageField.instructions),
        this.escapeCsvValue(provider.id),
      ].join(',');
      lines.push(row);
    }

    return lines.join('\n');
  }
}
