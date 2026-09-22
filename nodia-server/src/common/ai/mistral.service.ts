import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { envs } from '../../config/envs.config.js';
import {
  type ExtractedInvoiceData,
  type ExtractedInvoiceItem,
  type ProviderParsedConfig,
  extractProviderConfig,
} from './ai.types.js';

interface MistralOcrPage {
  index: number;
  markdown: string;
  images?: any[];
  tables?: any[];
}

interface MistralOcrResponse {
  pages: MistralOcrPage[];
  model: string;
}

@Injectable()
export class MistralService {
  private readonly logger = new Logger(MistralService.name);
  private readonly apiKey: string;
  private readonly chatModelName: string;
  private readonly ocrModelName: string;

  constructor() {
    this.apiKey = envs.MISTRAL_API_KEY || '';
    this.chatModelName = envs.MISTRAL_MODEL || 'open-mistral-nemo';
    this.ocrModelName = envs.MISTRAL_OCR_MODEL || 'mistral-ocr-latest';
  }

  /**
   * Analyzes an invoice document (image or PDF) using Mistral OCR + LLM structuring.
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
    if (!this.apiKey) {
      throw new InternalServerErrorException(
        'Mistral AI service is not configured. Missing MISTRAL_API_KEY.',
      );
    }

    const isPdf =
      mimeType === 'application/pdf' || mimeType.includes('pdf');

    const base64Data = buffer.toString('base64');
    const dataUri = `data:${mimeType};base64,${base64Data}`;

    const documentPayload = isPdf
      ? { type: 'document_url', document_url: dataUri }
      : { type: 'image_url', image_url: dataUri };

    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
      attempt++;
      try {
        // Step 1: Extract high-fidelity markdown using Mistral OCR
        let markdown = '';
        try {
          const ocrData = await this.performOcr(documentPayload);
          markdown = (ocrData.pages || [])
            .map((p) => p.markdown || '')
            .join('\n\n--- PAGE BREAK ---\n\n')
            .trim();
        } catch (ocrError: any) {
          const { statusCode, cleanMessage } = this.analyzeMistralError(ocrError);
          // If OCR endpoint is rate-limited (code 1300 / quota 0 on free tier) or restricted, fallback to Vision for images
          if (!isPdf && (statusCode === 429 || statusCode === 400 || cleanMessage.includes('rate limit'))) {
            this.logger.warn(
              `Mistral OCR endpoint restricted or rate-limited (${statusCode} - ${cleanMessage}). Falling back to Mistral Vision (pixtral-12b-2409)...`,
            );
            return await this.extractViaVision(dataUri, providerFields, providerTax);
          }
          throw ocrError;
        }

        if (!markdown) {
          if (!isPdf) {
            this.logger.warn('No text extracted from Mistral OCR. Falling back to Mistral Vision...');
            return await this.extractViaVision(dataUri, providerFields, providerTax);
          }
          throw new BadRequestException(
            'El documento fue procesado pero no se detectó texto legible por OCR.',
          );
        }

        // Step 2: Structure markdown into accounting JSON schema
        const structured = await this.structureInvoiceMarkdown(
          markdown,
          providerFields,
          providerTax,
        );

        return structured;
      } catch (error: any) {
        if (error instanceof BadRequestException) {
          throw error;
        }

        const { isTransient, statusCode, cleanMessage } =
          this.analyzeMistralError(error);

        if (isTransient && attempt < maxRetries) {
          const delayMs = attempt * 1500;
          this.logger.warn(
            `Mistral API transient error (${statusCode || 'UNAVAILABLE'} - ${cleanMessage}). Retrying attempt ${attempt}/${maxRetries} in ${delayMs}ms...`,
          );
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          continue;
        }

        this.handleFinalMistralError(error);
      }
    }

    throw new ServiceUnavailableException(
      'El servicio de Mistral AI no pudo responder tras varios intentos. Por favor, reintente en unos instantes.',
    );
  }

  private async performOcr(documentPayload: Record<string, any>): Promise<MistralOcrResponse> {
    const response = await fetch('https://api.mistral.ai/v1/ocr', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.ocrModelName,
        document: documentPayload,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      const errorObj = new Error(
        errorBody.message || errorBody.detail || response.statusText || 'Mistral OCR call failed',
      ) as any;
      errorObj.status = response.status;
      errorObj.response = { status: response.status, data: errorBody };
      throw errorObj;
    }

    return (await response.json()) as MistralOcrResponse;
  }

  private buildProviderInstructions(
    providerFields: Record<string, any> | undefined,
    config: ProviderParsedConfig,
  ): string {
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

      return `
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
    }

    return `
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
          cost_price = null;
          cost_price_tax = null;
        }

        const unit_price = cost_price ?? cost_price_tax ?? null;
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

  private async structureInvoiceMarkdown(
    markdown: string,
    providerFields?: Record<string, any>,
    providerTax: number = 19,
  ): Promise<ExtractedInvoiceData> {
    const config = extractProviderConfig(providerFields);

    const providerInstructions = this.buildProviderInstructions(
      providerFields,
      config,
    );

    const userPrompt = `
Texto extraído por OCR de la factura:
${markdown}

Instrucciones de estructuración:
Extrae los siguientes datos estrictamente en un objeto JSON:
- "code": número de factura, folio o comprobante (string).
- "total_amount": monto total a pagar de la factura como número entero (sin decimales ni signos de moneda).
- "issue_date": fecha de emisión de la factura en formato ISO YYYY-MM-DD (string, opcional).
- "items": arreglo con cada producto listado en la factura.
${providerInstructions}
- "raw_data": metadatos contables adicionales detectados (ej. subtotal, impuesto, razón social).

Devuelve únicamente el objeto JSON.`;

    const chatResponse = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.chatModelName,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'Eres un asistente contable y de inventario de alta precisión. Devuelve única y estrictamente un objeto JSON válido.',
          },
          {
            role: 'user',
            content: userPrompt,
          },
        ],
      }),
    });

    if (!chatResponse.ok) {
      const errorBody = await chatResponse.json().catch(() => ({}));
      const errorObj = new Error(
        errorBody.message || errorBody.detail || chatResponse.statusText || 'Mistral chat completions call failed',
      ) as any;
      errorObj.status = chatResponse.status;
      errorObj.response = { status: chatResponse.status, data: errorBody };
      throw errorObj;
    }

    const completionData = await chatResponse.json();
    const rawContent =
      completionData.choices?.[0]?.message?.content || '{}';

    const cleanJson = rawContent
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();

    const parsed = JSON.parse(cleanJson);

    const items = this.normalizeItems(
      parsed.items || [],
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
  }

  /**
   * Directly extracts invoice data from an image document using Mistral's Vision model (pixtral-12b-2409).
   * Used as a high-compatibility fallback when the dedicated /v1/ocr endpoint is rate-limited or restricted on free tier.
   */
  private async extractViaVision(
    dataUri: string,
    providerFields?: Record<string, any>,
    providerTax: number = 19,
  ): Promise<ExtractedInvoiceData> {
    const config = extractProviderConfig(providerFields);

    const providerInstructions = this.buildProviderInstructions(
      providerFields,
      config,
    );

    const userPrompt = `
Analiza detenidamente la factura o comprobante adjunto y extrae los siguientes datos estrictamente en un objeto JSON:
- "code": número de factura, folio o comprobante (string).
- "total_amount": monto total a pagar de la factura como número entero sin decimales ni signos de moneda.
- "issue_date": fecha de emisión de la factura en formato ISO YYYY-MM-DD (string, opcional).
- "items": arreglo con cada producto listado en la factura.
${providerInstructions}
- "raw_data": metadatos contables adicionales detectados (ej. subtotal, impuesto, razón social).

Devuelve únicamente el objeto JSON.`;

    const chatResponse = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'pixtral-12b-2409',
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'Eres un asistente contable y de inventario de alta precisión. Devuelve única y estrictamente un objeto JSON válido.',
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: userPrompt },
              { type: 'image_url', image_url: dataUri },
            ],
          },
        ],
      }),
    });

    if (!chatResponse.ok) {
      const errorBody = await chatResponse.json().catch(() => ({}));
      const errorObj = new Error(
        errorBody.message || errorBody.detail || chatResponse.statusText || 'Mistral Vision call failed',
      ) as any;
      errorObj.status = chatResponse.status;
      errorObj.response = { status: chatResponse.status, data: errorBody };
      throw errorObj;
    }

    const completionData = await chatResponse.json();
    const rawContent =
      completionData.choices?.[0]?.message?.content || '{}';

    const cleanJson = rawContent
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();

    const parsed = JSON.parse(cleanJson);

    const items = this.normalizeItems(
      parsed.items || [],
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
  }

  private analyzeMistralError(error: any): {
    isTransient: boolean;
    statusCode?: number;
    cleanMessage: string;
  } {
    let statusCode = error?.status || error?.code || error?.response?.status;
    let message = error?.message || '';

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
        // Ignore
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
      msgLower.includes('rate limit') ||
      msgLower.includes('rate_limited') ||
      msgLower.includes('quota') ||
      msgLower.includes('timeout');

    return {
      isTransient,
      statusCode,
      cleanMessage: message,
    };
  }

  private handleFinalMistralError(error: any): never {
    const { statusCode, cleanMessage } = this.analyzeMistralError(error);
    const msgLower = cleanMessage.toLowerCase();

    if (
      statusCode === 503 ||
      msgLower.includes('unavailable') ||
      msgLower.includes('high demand')
    ) {
      throw new ServiceUnavailableException(
        'El servicio de Mistral AI está experimentando alta demanda temporalmente. Por favor, reintente en unos instantes.',
      );
    }

    if (
      statusCode === 429 ||
      msgLower.includes('rate limit') ||
      msgLower.includes('rate_limited') ||
      msgLower.includes('quota')
    ) {
      throw new HttpException(
        'Se ha superado temporalmente la cuota de solicitudes de Mistral AI. Por favor, espere unos segundos antes de reintentar.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (
      statusCode === 400 ||
      msgLower.includes('invalid_argument') ||
      msgLower.includes('bad request')
    ) {
      throw new BadRequestException(
        'El archivo no pudo ser interpretado por el servicio de Mistral AI. Verifique que sea legible y en formato PDF, PNG o JPEG.',
      );
    }

    if (statusCode === 401 || msgLower.includes('unauthorized')) {
      throw new InternalServerErrorException(
        'Error de autenticación con Mistral AI. Verifique la clave MISTRAL_API_KEY.',
      );
    }

    throw new InternalServerErrorException(
      `No se pudo procesar la factura con Mistral AI: ${cleanMessage || 'Error inesperado'}`,
    );
  }
}
