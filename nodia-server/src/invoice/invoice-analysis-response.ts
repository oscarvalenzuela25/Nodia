import type { ExtractedInvoiceData } from '../common/ai/ai.types.js';
import type { AnalyzeInvoiceResponse } from './types/invoice.types.js';

/** Formatting only; extraction never creates an invoice or changes inventory. */
export function invoiceAnalysisResponse(
  businessId: string,
  providerId: string | null,
  extraction: ExtractedInvoiceData,
): AnalyzeInvoiceResponse {
  return {
    business_id: businessId,
    provider_id: providerId,
    code: extraction.code,
    total_amount: extraction.total_amount,
    data: {
      issue_date: extraction.issue_date,
      items: extraction.items,
      ...extraction.raw_data,
    },
  };
}
