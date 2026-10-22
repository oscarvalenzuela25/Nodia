import type { NodiaAiJsonObject } from '../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
export interface InvoiceAnalysisContractInput {
  readonly providerFields: NodiaAiJsonObject | null;
  readonly tax: number | null;
  readonly signal: AbortSignal;
  readonly deadlineAt: number;
}
/** Pure native invoice rules. This port never generates or starts a provider session. */
export abstract class NodiaAiInvoiceAnalysisContract {
  abstract prepare(
    input: InvoiceAnalysisContractInput,
  ): Promise<{ instructions: string }>;
  abstract normalize(
    input: InvoiceAnalysisContractInput & { extraction: NodiaAiJsonObject },
  ): Promise<{ extraction: NodiaAiJsonObject }>;
}
export const NODIA_AI_INVOICE_ANALYSIS_TOOL = 'nodia_invoices_analyze';
export const NODIA_AI_INVOICE_ANALYSIS_CONTRACT_VERSION =
  'nodia-ai-invoice-analysis/1';
