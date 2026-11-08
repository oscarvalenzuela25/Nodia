import type { ActorReference } from '../../authorization/authority-transaction.js';
import { BadRequestException, Injectable } from '@nestjs/common';
import { ProviderService } from '../provider.service.js';
import { ExportProvidersCsvDto } from '../dto/export-providers-csv.dto.js';
import { validateContactId } from '../../provider-contact/use-case/contact-validation.js';

/** Internal consumer ceilings; the public HTTP DTO remains unchanged. */
export interface ProviderCsvExportLimits {
  readonly maxRows: number;
  readonly maxBytes: number;
  readonly signal?: AbortSignal;
}

@Injectable()
export class ExportProvidersCsvUseCase {
  constructor(private readonly providerService: ProviderService) {}

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

  private extractField(raw: unknown): { value: string; instructions: string } {
    if (!raw) return { value: '', instructions: '' };
    if (typeof raw === 'string') return { value: raw, instructions: '' };
    if (typeof raw === 'object' && raw !== null) {
      const obj = raw as Record<string, unknown>;
      return {
        value: typeof obj.value === 'string' ? obj.value : '',
        instructions:
          typeof obj.instructions === 'string' ? obj.instructions : '',
      };
    }
    return { value: '', instructions: '' };
  }

  async execute(
    dto: ExportProvidersCsvDto,
    limits?: ProviderCsvExportLimits,
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
      ? 'Name (name),Tax % (tax),Active (is_active),Code Column (field_code),Code Instructions (instructions_code),Net Cost Column (field_cost_price),Net Cost Instructions (instructions_cost_price),Tax Cost Column (field_cost_price_tax),Tax Cost Instructions (instructions_cost_price_tax),Packages Column (field_packages),Packages Instructions (instructions_packages),Units Per Package Column (field_units_per_package),Units Per Package Instructions (instructions_units_per_package),ID (id)'
      : 'Nombre (name),Impuesto % (tax),Activo (is_active),Columna Código (field_code),Instrucciones Código (instructions_code),Columna Costo Neto (field_cost_price),Instrucciones Costo Neto (instructions_cost_price),Columna Costo IVA (field_cost_price_tax),Instrucciones Costo IVA (instructions_cost_price_tax),Columna Bultos (field_packages),Instrucciones Bultos (instructions_packages),Columna Unidades por Bulto (field_units_per_package),Instrucciones Unidades por Bulto (instructions_units_per_package),ID (id)';

    dto.ids?.forEach(validateContactId);
    const { providers, contacts } = limits
      ? await this.providerService.findForExport(
          dto,
          {
            maxRows: limits.maxRows,
            maxBytes: Math.min(2 * 1024 * 1024, limits.maxBytes),
          },
          actor,
        )
      : await this.providerService.findForExport(dto, undefined, actor);
    limits?.signal?.throwIfAborted();
    if (limits && providers.length > limits.maxRows)
      throw new BadRequestException(
        'Export exceeds row limit; narrow the view',
      );
    const grouped = new Map<string, typeof contacts>();
    for (const contact of contacts) {
      const list = grouped.get(contact.provider_id) ?? [];
      list.push(contact);
      grouped.set(contact.provider_id, list);
      if (list.length > 100)
        throw new BadRequestException(
          'CSV supports up to 100 contacts per provider',
        );
    }
    const suffix = isEn
      ? ',Contacts JSON (contacts),Extra Mapping JSON (fields_json),CSV Version (csv_version)'
      : ',Contactos JSON (contacts),Mapeo adicional JSON (fields_json),Versión CSV (csv_version)';
    const lines = [header + suffix];
    let bytes = Buffer.byteLength(lines[0], 'utf8');
    if (bytes > Math.min(2 * 1024 * 1024, limits?.maxBytes ?? 2 * 1024 * 1024))
      throw new BadRequestException('CSV exceeds byte limit; narrow the view');

    for (const provider of providers) {
      limits?.signal?.throwIfAborted();
      const fields = provider.fields || {};
      const codeField = this.extractField(fields.code);
      const costPriceField = this.extractField(fields.cost_price);
      const costPriceTaxField = this.extractField(fields.cost_price_tax);
      const packagesField = this.extractField(fields.packages);
      const unitsPerPackageField = this.extractField(fields.units_per_package);

      const row = [
        this.escapeCsvValue(provider.name),
        this.escapeCsvValue(provider.tax),
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
        this.escapeCsvValue(
          JSON.stringify(
            (grouped.get(provider.id) ?? []).map(
              ({
                id,
                version,
                name,
                phone,
                email,
                schedule,
                description,
                is_active,
              }) => ({
                id,
                version,
                name,
                phone,
                email,
                schedule,
                description,
                is_active,
              }),
            ),
          ),
        ),
        this.escapeCsvValue(JSON.stringify(fields)),
        '2',
      ].join(',');
      bytes += Buffer.byteLength(row, 'utf8') + 1;
      if (
        bytes > Math.min(2 * 1024 * 1024, limits?.maxBytes ?? 2 * 1024 * 1024)
      )
        throw new BadRequestException(
          'CSV exceeds byte limit; narrow the view',
        );
      lines.push(row);
    }

    const csv = lines.join('\n');
    if (Buffer.byteLength(csv, 'utf8') > 2 * 1024 * 1024)
      throw new BadRequestException('CSV exceeds 2 MiB; narrow the view');
    return csv;
  }
}
