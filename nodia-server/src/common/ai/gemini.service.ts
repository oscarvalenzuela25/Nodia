import {
  BadGatewayException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { envs } from '../../config/envs.config.js';
import {
  type ExtractedInvoiceData,
  type ExtractedInvoiceItem,
  extractProviderConfig,
} from './ai.types.js';

export type { ExtractedInvoiceData, ExtractedInvoiceItem };

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);

  async extractInvoiceData(
    buffer: Buffer,
    mimeType: string,
    providerFields?: Record<string, any>,
    providerTax: number = 19,
  ): Promise<ExtractedInvoiceData> {
    const baseUrl = envs.GEMINI_MICROSERVICE_URL;
    if (!baseUrl) {
      throw new ServiceUnavailableException(
        'El microservicio de Gemini no está configurado.',
      );
    }

    const formData = new FormData();
    const extension =
      mimeType === 'application/pdf'
        ? 'pdf'
        : mimeType.replace('image/', '') || 'jpg';
    const blob = new Blob([new Uint8Array(buffer)], { type: mimeType });
    formData.append('file', blob, `invoice.${extension}`);
    formData.append(
      'provider_fields',
      JSON.stringify({ ...providerFields, tax: providerTax }),
    );
    formData.append('provider_tax', String(providerTax));

    let response: Response;
    try {
      response = await fetch(`${baseUrl}/analyze-invoice`, {
        method: 'POST',
        body: formData,
        signal: AbortSignal.timeout(140000),
      });
    } catch (error) {
      this.logger.warn(
        `Gemini microservice request failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new ServiceUnavailableException(
        'No se pudo conectar con el microservicio de Gemini.',
      );
    }

    if (!response.ok) {
      this.logger.warn(`Gemini microservice returned HTTP ${response.status}`);
      if (response.status === 400 || response.status === 415) {
        throw new BadGatewayException('Gemini rechazó el archivo enviado.');
      }
      throw new ServiceUnavailableException(
        response.status === 401 || response.status === 503
          ? 'La sesión de Gemini Web necesita renovarse. Inicie sesión nuevamente en el microservicio.'
          : 'Gemini Web no pudo procesar la factura. Reintente más tarde.',
      );
    }

    let parsed: any;
    try {
      parsed = await response.json();
    } catch {
      throw new BadGatewayException('Gemini devolvió una respuesta inválida.');
    }
    const rawItems = parsed?.data?.items ?? parsed?.items;
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      !Array.isArray(rawItems) ||
      rawItems.length === 0
    ) {
      throw new BadGatewayException(
        'Gemini no pudo extraer productos de la imagen.',
      );
    }

    const config = extractProviderConfig(providerFields);
    const items = this.normalizeItems(
      rawItems,
      config.hasAnyConfig,
      config.hasCodeConfig,
      config.hasCostPriceConfig,
      config.hasCostPriceTaxConfig,
      providerTax,
    );
    const {
      issue_date: _issueDate,
      items: _rawItems,
      ...metadata
    } = parsed.data && typeof parsed.data === 'object' ? parsed.data : {};

    return {
      code: String(parsed.code || 'SIN-NUMERO'),
      total_amount: Math.round(Number(parsed.total_amount) || 0),
      issue_date: parsed.data?.issue_date || parsed.issue_date || undefined,
      items,
      raw_data: metadata,
    };
  }
  /**
   * Normalizes invoice items according to the provider template configuration and tax calculation rules.
   */
  private normalizeItems(
    rawItems: any[],
    hasAnyConfig: boolean,
    hasCodeConfig: boolean,
    hasCostPriceConfig: boolean,
    hasCostPriceTaxConfig: boolean,
    providerTax: number = 19,
  ): ExtractedInvoiceItem[] {
    if (!Array.isArray(rawItems)) {
      return [];
    }

    const taxMultiplier = 1 + providerTax / 100;

    return rawItems.map((it: any) => {
      let code =
        it.code !== null &&
        it.code !== undefined &&
        String(it.code).trim() !== ''
          ? String(it.code).trim()
          : null;
      const name = String(it.name || 'Producto sin nombre').trim();

      const rawPackages =
        it.packages !== null &&
        it.packages !== undefined &&
        !isNaN(Number(it.packages)) &&
        Number(it.packages) > 0
          ? Number(it.packages)
          : null;

      const rawUnitsPerPackage =
        it.units_per_package !== null &&
        it.units_per_package !== undefined &&
        !isNaN(Number(it.units_per_package)) &&
        Number(it.units_per_package) > 0
          ? Number(it.units_per_package)
          : null;

      let quantity: number;
      if (rawPackages !== null && rawUnitsPerPackage !== null) {
        quantity = Math.round(rawPackages * rawUnitsPerPackage);
      } else if (rawPackages !== null) {
        quantity = Math.round(rawPackages);
      } else if (rawUnitsPerPackage !== null) {
        quantity = Math.round(rawUnitsPerPackage);
      } else {
        quantity =
          Number(it.quantity) > 0 ? Number(it.quantity) : hasAnyConfig ? 0 : 1;
      }

      let cost_price =
        it.cost_price !== null &&
        it.cost_price !== undefined &&
        !isNaN(Number(it.cost_price))
          ? Math.round(Number(it.cost_price))
          : null;

      let cost_price_tax =
        it.cost_price_tax !== null &&
        it.cost_price_tax !== undefined &&
        !isNaN(Number(it.cost_price_tax))
          ? Math.round(Number(it.cost_price_tax))
          : null;

      if (hasAnyConfig) {
        // 1. Regla de código estricto
        if (!hasCodeConfig) {
          code = null;
        }

        // 2. Reglas de costos basadas en campos configurados del proveedor
        if (hasCostPriceConfig && !hasCostPriceTaxConfig) {
          // Solo se configuró costo sin impuestos -> extraerlo y calcular el impuesto
          if (
            cost_price === null &&
            it.unit_price !== null &&
            it.unit_price !== undefined &&
            !isNaN(Number(it.unit_price))
          ) {
            cost_price = Math.round(Number(it.unit_price));
          }
          cost_price_tax =
            cost_price !== null ? Math.round(cost_price * taxMultiplier) : null;
        } else if (!hasCostPriceConfig && hasCostPriceTaxConfig) {
          // Solo se configuró costo con impuestos -> extraerlo y calcular el costo base
          if (
            cost_price_tax === null &&
            it.unit_price !== null &&
            it.unit_price !== undefined &&
            !isNaN(Number(it.unit_price))
          ) {
            cost_price_tax = Math.round(Number(it.unit_price));
          }
          cost_price =
            cost_price_tax !== null
              ? Math.round(cost_price_tax / taxMultiplier)
              : null;
        } else if (hasCostPriceConfig && hasCostPriceTaxConfig) {
          // Ambos están configurados -> se toman de sus respectivas columnas sin recálculo
          if (
            cost_price === null &&
            it.unit_price !== null &&
            it.unit_price !== undefined &&
            !isNaN(Number(it.unit_price))
          ) {
            cost_price = Math.round(Number(it.unit_price));
          }
          if (
            cost_price_tax === null &&
            it.unit_price !== null &&
            it.unit_price !== undefined &&
            !isNaN(Number(it.unit_price))
          ) {
            cost_price_tax = Math.round(Number(it.unit_price));
          }
        } else {
          // Ni costo neto ni bruto configurados (ej. solo código)
          cost_price = null;
          cost_price_tax = null;
        }

        const unit_price = cost_price_tax ?? cost_price ?? null;
        const total_price =
          it.total_price !== null &&
          it.total_price !== undefined &&
          !isNaN(Number(it.total_price))
            ? Math.round(Number(it.total_price))
            : cost_price_tax
              ? cost_price_tax * quantity
              : cost_price
                ? cost_price * quantity
                : null;

        return {
          code,
          name,
          quantity,
          packages: rawPackages,
          units_per_package: rawUnitsPerPackage,
          cost_price,
          cost_price_tax,
          unit_price,
          total_price,
        };
      } else {
        // Criterio general contable libre si el proveedor no tiene campos configurados
        const rawUnitPrice =
          it.unit_price !== null &&
          it.unit_price !== undefined &&
          !isNaN(Number(it.unit_price))
            ? Math.round(Number(it.unit_price))
            : null;

        const rawTotalPrice =
          it.total_price !== null &&
          it.total_price !== undefined &&
          !isNaN(Number(it.total_price))
            ? Math.round(Number(it.total_price))
            : null;

        if (cost_price !== null && cost_price_tax !== null) {
          // Ambos presentes
        } else if (cost_price !== null && cost_price_tax === null) {
          cost_price_tax = Math.round(cost_price * taxMultiplier);
        } else if (cost_price_tax !== null && cost_price === null) {
          cost_price = Math.round(cost_price_tax / taxMultiplier);
        } else if (rawUnitPrice !== null) {
          cost_price = rawUnitPrice;
          cost_price_tax = Math.round(cost_price * taxMultiplier);
        } else if (rawTotalPrice !== null && quantity > 0) {
          cost_price = Math.round(rawTotalPrice / quantity);
          cost_price_tax = Math.round(cost_price * taxMultiplier);
        }

        const unit_price = cost_price_tax ?? cost_price ?? rawUnitPrice;
        const total_price =
          rawTotalPrice ??
          (cost_price_tax
            ? cost_price_tax * quantity
            : cost_price
              ? cost_price * quantity
              : null);

        return {
          code,
          name,
          quantity,
          packages: rawPackages,
          units_per_package: rawUnitsPerPackage,
          cost_price,
          cost_price_tax,
          unit_price,
          total_price,
        };
      }
    });
  }
}
