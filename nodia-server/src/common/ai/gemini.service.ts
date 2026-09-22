import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { GoogleGenAI } from '@google/genai';
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
  private readonly aiClient: GoogleGenAI | null = null;
  private readonly modelName: string;

  constructor() {
    this.modelName = envs.GEMINI_MODEL || 'gemini-3.6-flash';
    if (envs.GEMINI_API_KEY) {
      this.aiClient = new GoogleGenAI({
        apiKey: envs.GEMINI_API_KEY,
      });
    }
  }

  /**
   * Analyzes an invoice document (image or PDF) and extracts structured data.
   * Prioritizes Gemini Microservice (Gemini Pro via Web API) and falls back
   * to the official Gemini API Key if the microservice is offline or fails.
   * @param buffer Document binary buffer
   * @param mimeType Document MIME type (e.g. "application/pdf", "image/png", "image/jpeg")
   * @param providerFields Optional template/fields mapping registered for the provider
   */
  async extractInvoiceData(
    buffer: Buffer,
    mimeType: string,
    providerFields?: Record<string, any>,
    providerTax: number = 19,
  ): Promise<ExtractedInvoiceData> {
    // 1. Try Gemini Microservice first (Gemini Pro)
    const microserviceResult = await this.extractViaMicroservice(
      buffer,
      mimeType,
      providerFields,
      providerTax,
    );
    if (microserviceResult) {
      return microserviceResult;
    }

    // 2. Fall back to official Gemini API Key
    if (!this.aiClient) {
      throw new InternalServerErrorException(
        'El servicio de Gemini AI no está disponible. El microservicio está inaccesible y no hay GEMINI_API_KEY configurada.',
      );
    }

    const config = extractProviderConfig(providerFields);
    let providerInstructions = '';

    if (config.hasAnyConfig) {
      const codeRule = config.hasCodeConfig
        ? `- "code": busca el código de producto / SKU correspondiente estrictamente a la columna "${config.codeConfig!.value}".${config.codeConfig!.instructions ? ` Instrucciones adicionales para este campo: ${config.codeConfig!.instructions}.` : ''} Si no viene para ese ítem, devuelve null.`
        : `- "code": null (el proveedor NO tiene configurado campo de código; devuelve estrictamente null).`;

      const costPriceRule = config.hasCostPriceConfig
        ? `- "cost_price": costo unitario sin impuestos (neto) correspondiente estrictamente a la columna "${config.costPriceConfig!.value}".${config.costPriceConfig!.instructions ? ` Instrucciones adicionales para este campo: ${config.costPriceConfig!.instructions}.` : ''} Si no aparece en la fila, devuelve null.`
        : `- "cost_price": null (el proveedor NO tiene configurado costo sin impuestos en su plantilla; NO extraigas, NO calcules y NO inventes este valor, devuelve estrictamente null).`;

      const costPriceTaxRule = config.hasCostPriceTaxConfig
        ? `- "cost_price_tax": costo unitario con impuestos (bruto / con IVA) correspondiente estrictamente a la columna "${config.costPriceTaxConfig!.value}".${config.costPriceTaxConfig!.instructions ? ` Instrucciones adicionales para este campo: ${config.costPriceTaxConfig!.instructions}.` : ''} Si no aparece en la fila, devuelve null.`
        : `- "cost_price_tax": null (el proveedor NO tiene configurado costo con impuestos en su plantilla; NO extraigas, NO calcules y NO inventes este valor, devuelve estrictamente null).`;

      const packagesRule = config.hasPackagesConfig
        ? `- "packages": cantidad de cajas/bultos/embalajes comprados correspondiente estrictamente a la columna "${config.packagesConfig!.value}".${config.packagesConfig!.instructions ? ` Instrucciones adicionales para este campo: ${config.packagesConfig!.instructions}.` : ''} (número entero o float, o null si no aparece).`
        : `- "packages": null (no configurado en la plantilla).`;

      const unitsPerPackageRule = config.hasUnitsPerPackageConfig
        ? `- "units_per_package": cantidad de unidades o productos por caja/embalaje correspondiente estrictamente a la columna "${config.unitsPerPackageConfig!.value}".${config.unitsPerPackageConfig!.instructions ? ` Instrucciones adicionales para este campo: ${config.unitsPerPackageConfig!.instructions}.` : ''} (número entero o float, o null si no aparece).`
        : `- "units_per_package": null (no configurado en la plantilla).`;

      providerInstructions = `
Plantilla de columnas/campos configurada para este proveedor:
${JSON.stringify(
  Object.fromEntries(
    Object.entries(providerFields || {}).filter(
      ([k, v]) => k !== 'tax' && Boolean(v),
    ),
  ),
  null,
  2,
)}

REGLAS ESTRICTAS DE EXTRACCIÓN SEGÚN LA PLANTILLA DEL PROVEEDOR:
El usuario ha configurado explícitamente cuáles campos desea extraer automáticamente.
SOLO se deben extraer los campos que están configurados en la plantilla.
CUALQUIER OTRO CAMPO NO CONFIGURADO DEBE DEVOLVERSE ESTRICTAMENTE COMO null, INCLUSO SI LA FACTURA CONTIENE ESE DATO.

Para cada ítem en "items":
${codeRule}
- "name": descripción o nombre del producto (string obligatorio).
${costPriceRule}
${costPriceTaxRule}
${packagesRule}
${unitsPerPackageRule}
- "quantity": si se detectan "packages" y "units_per_package", calcula su multiplicación como la cantidad total de unidades. Si solo existe uno, usa ese valor. Si no existe ninguno, usa la cantidad detectada o 0.
- "total_price": total o subtotal del renglón (número, si existe, o null).`;
    } else {
      providerInstructions = `
El proveedor no tiene plantilla de campos configurada. Aplica el criterio general de extracción contable completa:
Para cada ítem en "items":
- "code": código de barras, SKU o código de producto (string, si existe en la fila o comprobante, o null).
- "name": descripción o nombre del producto (string obligatorio).
- "packages": cantidad de bultos/cajas si existe, o null.
- "units_per_package": unidades por caja si existe, o null.
- "quantity": cantidad adquirida total (número, por defecto 1).
- "cost_price": costo unitario neto sin impuestos (número, si se indica o calcula en la factura, o null).
- "cost_price_tax": costo unitario bruto con impuestos / IVA incluido (número, si se indica o calcula en la factura, o null).
- "unit_price": precio unitario indicado (número, si existe).
- "total_price": subtotal o precio total del renglón (número, si existe).`;
    }

    const prompt = `
Eres un asistente contable y de inventario de alta precisión. Analiza la factura o comprobante adjunto.

Debes extraer y estructurar los siguientes campos estrictamente en formato JSON:
- "code": número de factura, folio o comprobante (string). Si no se distingue con claridad, genera uno identificativo con la fecha.
- "total_amount": monto total a pagar de la factura como número entero (sin decimales ni signos de moneda).
- "issue_date": fecha de emisión de la factura en formato ISO YYYY-MM-DD (string, opcional).
- "items": arreglo con cada ítem o producto listado en la factura.
${providerInstructions}
- "raw_data": cualquier metadato contable adicional relevante detectado (ej. subtotal, impuesto, razón social del proveedor).

Devuelve exclusivamente el objeto JSON válido.`;

    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
      attempt++;
      try {
        const response = await this.aiClient.models.generateContent({
          model: this.modelName,
          contents: [
            {
              inlineData: {
                data: buffer.toString('base64'),
                mimeType,
              },
            },
            prompt,
          ],
          config: {
            responseMimeType: 'application/json',
          },
        });

        const rawText = response.text || '{}';
        // Clean possible markdown wrapper if present
        const cleanJson = rawText
          .replace(/^```json\s*/i, '')
          .replace(/^```\s*/i, '')
          .replace(/```\s*$/i, '')
          .trim();

        const parsed = JSON.parse(cleanJson);

        const items = this.normalizeItems(
          parsed.items,
          config.hasAnyConfig,
          config.hasCodeConfig,
          config.hasCostPriceConfig,
          config.hasCostPriceTaxConfig,
          providerTax,
        );

        return {
          code: String(parsed.code || 'SIN-NUMERO'),
          total_amount: Math.round(Number(parsed.total_amount) || 0),
          issue_date: parsed.issue_date || undefined,
          items,
          raw_data: parsed.raw_data || undefined,
        };
      } catch (error: any) {
        const { isTransient, statusCode, cleanMessage } = this.analyzeGeminiError(error);

        if (isTransient && attempt < maxRetries) {
          const delayMs = attempt * 1500;
          this.logger.warn(
            `Gemini API transient error (${statusCode || 'UNAVAILABLE'} - ${cleanMessage}). Retrying attempt ${attempt}/${maxRetries} in ${delayMs}ms...`,
          );
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          continue;
        }

        this.handleFinalGeminiError(error);
      }
    }

    throw new ServiceUnavailableException(
      'El servicio de inteligencia artificial no pudo responder tras varios intentos. Por favor, reintente en unos instantes.',
    );
  }

  /**
   * Attempts to extract invoice data using the local/remote Gemini Microservice (Gemini Pro Web).
   * Returns null if the microservice is unreachable, times out, or encounters an error.
   */
  private async extractViaMicroservice(
    buffer: Buffer,
    mimeType: string,
    providerFields?: Record<string, any>,
    providerTax: number = 19,
  ): Promise<ExtractedInvoiceData | null> {
    const baseUrl = envs.GEMINI_MICROSERVICE_URL;
    if (!baseUrl) {
      return null;
    }

    try {
      this.logger.log(
        `Attempting invoice extraction via Gemini Microservice (${baseUrl}/analyze-invoice)...`,
      );

      const formData = new FormData();
      const extension =
        mimeType === 'application/pdf'
          ? 'pdf'
          : mimeType.replace('image/', '') || 'jpg';
      const blob = new Blob([new Uint8Array(buffer)], { type: mimeType });
      formData.append('file', blob, `invoice.${extension}`);

      const mergedFields = {
        ...providerFields,
        tax: providerTax,
      };
      formData.append('provider_fields', JSON.stringify(mergedFields));
      formData.append('provider_tax', String(providerTax));

      const response = await fetch(`${baseUrl}/analyze-invoice`, {
        method: 'POST',
        body: formData,
        signal: AbortSignal.timeout(60000),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        this.logger.warn(
          `Gemini Microservice returned HTTP ${response.status}: ${errorText}`,
        );
        return null;
      }

      const parsed = (await response.json()) as any;
      if (!parsed || typeof parsed !== 'object') {
        this.logger.warn('Gemini Microservice returned invalid response format');
        return null;
      }

      const config = extractProviderConfig(providerFields);

      const rawItems = parsed.data?.items || parsed.items || [];
      const hasRawOutput = Boolean(parsed.data?.raw_output || parsed.raw_output);

      // Si el microservicio devolvió 0 items y contiene un mensaje de error o raw_output de rechazo, hacer fallback a API Key
      if (rawItems.length === 0 && (hasRawOutput || (!parsed.code && !parsed.total_amount))) {
        this.logger.warn(
          'Gemini Microservice returned empty extraction / non-invoice response. Falling back to official Gemini API Key...',
        );
        return null;
      }

      const items = this.normalizeItems(
        rawItems,
        config.hasAnyConfig,
        config.hasCodeConfig,
        config.hasCostPriceConfig,
        config.hasCostPriceTaxConfig,
        providerTax,
      );

      this.logger.log(
        'Invoice successfully analyzed via Gemini Microservice (Gemini Pro).',
      );

      return {
        code: String(parsed.code || 'SIN-NUMERO'),
        total_amount: Math.round(Number(parsed.total_amount) || 0),
        issue_date: parsed.data?.issue_date || parsed.issue_date || undefined,
        items,
        raw_data: parsed.data || undefined,
      };
    } catch (error: any) {
      this.logger.warn(
        `Gemini Microservice unavailable (${error.message}). Falling back to official Gemini API Key...`,
      );
      return null;
    }
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
        it.code !== null && it.code !== undefined && String(it.code).trim() !== ''
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
          Number(it.quantity) > 0
            ? Number(it.quantity)
            : hasAnyConfig
              ? 0
              : 1;
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

  private analyzeGeminiError(error: any): {
    isTransient: boolean;
    statusCode?: number;
    cleanMessage: string;
  } {
    let statusCode = error?.status || error?.code || error?.response?.status;
    let message = error?.message || '';

    // Check if error message is a JSON string from Google GenAI SDK
    if (
      typeof message === 'string' &&
      (message.trim().startsWith('{') || message.includes('{"error":'))
    ) {
      try {
        const jsonStart = message.indexOf('{');
        const parsed = JSON.parse(message.slice(jsonStart));
        if (parsed.error) {
          statusCode = parsed.error.code || statusCode;
          message = parsed.error.message || message;
        }
      } catch {
        // Ignore parsing failure and keep message
      }
    }

    const msgLower = (message || '').toLowerCase();
    const isTransient =
      statusCode === 503 ||
      statusCode === 429 ||
      statusCode === 500 ||
      statusCode === 502 ||
      statusCode === 504 ||
      msgLower.includes('unavailable') ||
      msgLower.includes('high demand') ||
      msgLower.includes('spikes in demand') ||
      msgLower.includes('overloaded') ||
      msgLower.includes('resource_exhausted') ||
      msgLower.includes('rate limit') ||
      msgLower.includes('quota');

    return {
      isTransient,
      statusCode,
      cleanMessage: message,
    };
  }

  private handleFinalGeminiError(error: any): never {
    const { statusCode, cleanMessage } = this.analyzeGeminiError(error);
    const msgLower = cleanMessage.toLowerCase();

    if (
      statusCode === 503 ||
      msgLower.includes('unavailable') ||
      msgLower.includes('high demand') ||
      msgLower.includes('spikes in demand') ||
      msgLower.includes('overloaded')
    ) {
      throw new ServiceUnavailableException(
        'El servicio de inteligencia artificial está experimentando alta demanda temporalmente. Por favor, reintente en unos instantes.',
      );
    }

    if (
      statusCode === 429 ||
      msgLower.includes('resource_exhausted') ||
      msgLower.includes('rate limit') ||
      msgLower.includes('quota')
    ) {
      throw new HttpException(
        'Se ha superado temporalmente la cuota de solicitudes de IA. Por favor, espere unos segundos antes de reintentar.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (
      statusCode === 400 ||
      msgLower.includes('invalid_argument') ||
      msgLower.includes('unsupported mime type')
    ) {
      throw new BadRequestException(
        'El archivo no pudo ser interpretado por el servicio de IA. Verifique que sea legible y en formato PDF, PNG o JPEG.',
      );
    }

    if (
      statusCode === 404 ||
      msgLower.includes('not_found') ||
      msgLower.includes('no longer available')
    ) {
      throw new InternalServerErrorException(
        `El modelo de IA configurado no está disponible actualmente. Detalle: ${cleanMessage}`,
      );
    }

    throw new InternalServerErrorException(
      `No se pudo procesar la factura con el servicio de IA: ${cleanMessage || 'Error inesperado'}`,
    );
  }
}
