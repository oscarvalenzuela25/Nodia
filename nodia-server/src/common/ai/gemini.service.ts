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
import type {
  ExtractedInvoiceData,
  ExtractedInvoiceItem,
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
  ): Promise<ExtractedInvoiceData> {
    // 1. Try Gemini Microservice first (Gemini Pro)
    const microserviceResult = await this.extractViaMicroservice(
      buffer,
      mimeType,
      providerFields,
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

    let providerInstructions = '';

    const hasCodeConfig = Boolean(
      providerFields?.code && String(providerFields.code).trim().length > 0,
    );
    const hasCostPriceConfig = Boolean(
      providerFields?.cost_price && String(providerFields.cost_price).trim().length > 0,
    );
    const hasCostPriceTaxConfig = Boolean(
      providerFields?.cost_price_tax && String(providerFields.cost_price_tax).trim().length > 0,
    );

    const hasAnyConfig = hasCodeConfig || hasCostPriceConfig || hasCostPriceTaxConfig;

    if (hasAnyConfig) {
      providerInstructions = `
Plantilla de columnas/campos configurada para este proveedor:
${JSON.stringify(
  Object.fromEntries(
    Object.entries(providerFields || {}).filter(
      ([, v]) => v && String(v).trim().length > 0,
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
${
  hasCodeConfig
    ? `- "code": busca el código de producto / SKU correspondiente a la columna "${providerFields!.code}". Si no viene para ese ítem, devuelve null.`
    : `- "code": null (el proveedor NO tiene configurado campo de código; devuelve estrictamente null).`
}
- "name": descripción o nombre del producto (string obligatorio).
- "quantity": cantidad de unidades (número, si no aparece usa 1).
${
  hasCostPriceConfig
    ? `- "cost_price": costo unitario sin impuestos (neto) correspondiente a la columna "${providerFields!.cost_price}". Si no aparece en la fila, devuelve null.`
    : `- "cost_price": null (el proveedor NO tiene configurado costo sin impuestos en su plantilla; NO extraigas, NO calcules y NO inventes este valor, devuelve estrictamente null).`
}
${
  hasCostPriceTaxConfig
    ? `- "cost_price_tax": costo unitario con impuestos (bruto / con IVA) correspondiente a la columna "${providerFields!.cost_price_tax}". Si no aparece en la fila, devuelve null.`
    : `- "cost_price_tax": null (el proveedor NO tiene configurado costo con impuestos en su plantilla; NO extraigas, NO calcules y NO inventes este valor, devuelve estrictamente null).`
}
- "total_price": total o subtotal del renglón (número, si existe, o null).`;
    } else {
      providerInstructions = `
El proveedor no tiene plantilla de campos configurada. Aplica el criterio general de extracción contable completa:
Para cada ítem en "items":
- "code": código de barras, SKU o código de producto (string, si existe en la fila o comprobante, o null).
- "name": descripción o nombre del producto (string obligatorio).
- "quantity": cantidad adquirida (número, por defecto 1).
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
          hasAnyConfig,
          hasCodeConfig,
          hasCostPriceConfig,
          hasCostPriceTaxConfig,
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

      if (providerFields) {
        formData.append('provider_fields', JSON.stringify(providerFields));
      }

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

      const hasCodeConfig = Boolean(
        providerFields?.code && String(providerFields.code).trim().length > 0,
      );
      const hasCostPriceConfig = Boolean(
        providerFields?.cost_price &&
          String(providerFields.cost_price).trim().length > 0,
      );
      const hasCostPriceTaxConfig = Boolean(
        providerFields?.cost_price_tax &&
          String(providerFields.cost_price_tax).trim().length > 0,
      );
      const hasAnyConfig =
        hasCodeConfig || hasCostPriceConfig || hasCostPriceTaxConfig;

      const rawItems = parsed.data?.items || parsed.items || [];
      const items = this.normalizeItems(
        rawItems,
        hasAnyConfig,
        hasCodeConfig,
        hasCostPriceConfig,
        hasCostPriceTaxConfig,
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
  ): ExtractedInvoiceItem[] {
    if (!Array.isArray(rawItems)) {
      return [];
    }

    return rawItems.map((it: any) => {
      let code =
        it.code !== null && it.code !== undefined && String(it.code).trim() !== ''
          ? String(it.code).trim()
          : null;
      const name = String(it.name || 'Producto sin nombre').trim();
      const quantity = Number(it.quantity) > 0 ? Number(it.quantity) : 1;

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
        if (!hasCodeConfig) {
          code = null;
        }
        if (!hasCostPriceConfig) {
          cost_price = null;
        }
        if (!hasCostPriceTaxConfig) {
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
          // Both present
        } else if (cost_price !== null && cost_price_tax === null) {
          cost_price_tax = Math.round(cost_price * 1.19);
        } else if (cost_price_tax !== null && cost_price === null) {
          cost_price = Math.round(cost_price_tax / 1.19);
        } else if (rawUnitPrice !== null) {
          cost_price = rawUnitPrice;
          cost_price_tax = Math.round(cost_price * 1.19);
        } else if (rawTotalPrice !== null && quantity > 0) {
          cost_price = Math.round(rawTotalPrice / quantity);
          cost_price_tax = Math.round(cost_price * 1.19);
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
