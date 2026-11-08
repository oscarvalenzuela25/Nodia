import { BadGatewayException } from '@nestjs/common';
import type { ExtractedInvoiceData, ExtractedInvoiceItem } from './ai.types.js';

function numberOrUnknown(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0)
    throw new BadGatewayException('Gemini devolvió valores numéricos inválidos.');
  return value;
}

function invoiceItem(raw: unknown): ExtractedInvoiceItem {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw))
    throw new BadGatewayException('Gemini devolvió un producto inválido.');
  const item = raw as Record<string, unknown>;
  if (typeof item.name !== 'string' || !item.name.trim() ||
      (item.code != null && typeof item.code !== 'string'))
    throw new BadGatewayException('Gemini devolvió un producto inválido.');
  return {
    code: typeof item.code === 'string' ? item.code.trim() : null,
    name: item.name.trim(),
    quantity: numberOrUnknown(item.quantity),
    packages: numberOrUnknown(item.packages),
    units_per_package: numberOrUnknown(item.units_per_package),
    cost_price: numberOrUnknown(item.cost_price),
    cost_price_tax: numberOrUnknown(item.cost_price_tax),
    unit_price: numberOrUnknown(item.unit_price),
    total_price: numberOrUnknown(item.total_price),
  };
}

/** One Products OCR response projection, shared with conversational extraction. */
export function parseGeminiInvoiceExtraction(input: unknown): ExtractedInvoiceData {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new BadGatewayException('Gemini devolvió una respuesta inválida.');
  const body = input as Record<string, unknown>;
  if (!body.data || typeof body.data !== 'object' || Array.isArray(body.data))
    throw new BadGatewayException('Gemini devolvió una respuesta inválida.');
  const data = body.data as Record<string, unknown>;
  if (!Array.isArray(data.items) || !data.items.length)
    throw new BadGatewayException('Gemini no pudo extraer productos de la imagen.');
  if (body.code != null && typeof body.code !== 'string')
    throw new BadGatewayException('Gemini devolvió un folio inválido.');
  if (data.issue_date != null && typeof data.issue_date !== 'string')
    throw new BadGatewayException('Gemini devolvió una fecha inválida.');
  return {
    code: typeof body.code === 'string' ? body.code.trim() : '',
    total_amount: numberOrUnknown(body.total_amount),
    issue_date: typeof data.issue_date === 'string' ? data.issue_date : undefined,
    items: data.items.map(invoiceItem),
  };
}
