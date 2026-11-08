import type { NodiaAiJsonObject } from '../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
import { ocrObject } from './types/invoice-ocr-state.js';

// The completed OCR is rendered without spending a fourth model generation.
// This text carries no write authority; changes still require the normal proposal review.
const label = (value: unknown): string => Array.from(String(value ?? ''), char => char.charCodeAt(0) < 32 ? ' ' : char).join('').trim();
const amount = (value: unknown): string => typeof value === 'number' && Number.isFinite(value) ? String(value) : 'sin dato';

export function formatInvoiceOcrResult(result: NodiaAiJsonObject): string {
  const extraction = ocrObject(result.extraction), data = ocrObject(extraction.data);
  if (!Array.isArray(data.items)) throw new Error('nodia_ai:invoice_ocr_invalid_result');
  const lines = [
    `Factura analizada${extraction.code ? `: ${label(extraction.code)}` : ''}.`,
    `Proveedor comercial: ${label(result.provider_id)}.`,
    `Total: ${amount(extraction.total_amount)}. Fecha: ${label(data.issue_date) || 'sin dato'}.`,
    '',
    'Precios de compra extraídos (neto / con impuesto):',
    ...data.items.map((item, index) => {
      const row = ocrObject(item);
      return `${index + 1}. ${label(row.name)}${row.code ? ` [${label(row.code)}]` : ''}: ${amount(row.cost_price)} / ${amount(row.cost_price_tax)}.`;
    }),
  ];
  if (Array.isArray(result.comparison)) {
    lines.push('', 'Comparación con los productos del negocio:');
    if (typeof result.comparison_observed_at === 'string') lines.push(`Consulta realizada: ${label(result.comparison_observed_at)}.`);
    for (const value of result.comparison) {
      const row = ocrObject(value);
      const match = row.match;
      if (match !== 'unique') {
        const reason = match === 'ambiguous' ? 'más de un producto coincide' : match === 'missing_code' ? 'falta el código' : 'sin producto coincidente';
        lines.push(`${label(row.name)}: ${reason}; requiere revisión.`);
        continue;
      }
      const describe = (value: unknown): string => {
        const change = ocrObject(value);
        const direction = change.direction === 'up' ? 'subió' : change.direction === 'down' ? 'bajó' : change.direction === 'same' ? 'sin cambio' : 'no comparable';
        return `${amount(change.previous)} → ${amount(change.current)} (${direction}${typeof change.delta === 'number' ? `, diferencia ${amount(change.delta)}` : ''}${typeof change.percent === 'number' ? `, ${amount(change.percent)} %` : ''})`;
      };
      lines.push(`${label(row.name)}: neto ${describe(row.net)}; con impuesto ${describe(row.gross)}.`);
    }
    lines.push('', '¿Quieres preparar los cambios para guardarlos? Podrás revisar y confirmar cada propuesta antes de aplicarla.');
  } else {
    lines.push('', 'Puedes pedirme que compare estos precios con los productos del negocio para ver qué subió o bajó.');
  }
  lines.push(`Análisis: ${label(result.analysis_id)}. No se han guardado cambios en productos, stock ni facturas.`);
  return lines.join('\n');
}
