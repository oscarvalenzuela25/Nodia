import { ForbiddenException } from '@nestjs/common';
import { canonicalKnowledge, knowledgeHash } from '../../nodia-ai-context/use-case/load-nodia-ai-knowledge.use-case.js';
import type { NodiaAiJsonObject } from '../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';

export const ocrHash = (value: unknown): string => knowledgeHash(value === undefined ? 'undefined' : canonicalKnowledge(value));
export function ocrInvalid(code = 'invoice_ocr_invalid'): never {
  throw new ForbiddenException(`nodia_ai:${code}`);
}
export function ocrObject(value: unknown): NodiaAiJsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) ocrInvalid();
  return value as NodiaAiJsonObject;
}
export function invoiceOcrProviderFields(value: unknown): NodiaAiJsonObject | null {
  if (value == null) return null;
  const source = ocrObject(value), result: NodiaAiJsonObject = {};
  for (const key of ['code', 'cost_price', 'cost_price_tax', 'packages', 'units_per_package']) {
    const entry = source[key];
    if (entry === undefined) continue;
    if (entry === null || typeof entry === 'string' && entry.length <= 4096) result[key] = entry;
    else {
      const nested = ocrObject(entry);
      if (Object.keys(nested).some(k => !['value', 'instructions'].includes(k)) ||
          Object.values(nested).some(v => v !== null && !(typeof v === 'string' && v.length <= 4096))) ocrInvalid();
      result[key] = { ...nested };
    }
  }
  return result;
}
export function invoiceOcrRequestResult(id: string, snapshot: NodiaAiJsonObject): NodiaAiJsonObject {
  const source = ocrObject(snapshot.source);
  return { status: snapshot.preparation_id ? 'requested' : 'awaiting_supplier',
    analysis_id: snapshot.preparation_id ?? id, ...(snapshot.preparation_id ? { request_id: id } : {}), review_required: true,
    comparison_observed_at: null,
    business_id: snapshot.business_id, provider_id: snapshot.provider_id,
    attachment_id: source.attachment_id, compare_prices: snapshot.compare_prices,
    selection: snapshot.selection, source: { attachment_id: source.attachment_id,
      kind: source.kind, media_type: source.media_type, byte_count: source.byte_count } };
}
