import type { NodiaAiAdapterObservation } from '../../nodia-ai-adapter/types/nodia-ai-adapter.types.js';
import type { NodiaAiSelection } from '../../nodia-ai-conversation/types/nodia-ai-persistence.types.js';
import type { AnalyzeInvoiceResponse } from '../../invoice/types/invoice.types.js';
import type { NodiaAiRuntimeTerminalProof } from '../../nodia-ai-runtime/types/reconciliation.types.js';
import type { NodiaAiClaim } from '../../nodia-ai-runtime/types/worker.types.js';

export const NODIA_AI_INVOICE_OCR_TOOL = 'nodia_invoices_ocr';
export interface NodiaAiInvoiceOcrInput {
  readonly analysis_id: string;
  readonly business_id: string;
  readonly provider_id: string | null;
  readonly attachment_id: string;
  readonly compare_prices: boolean;
}
export interface NodiaAiInvoiceOcrSource {
  readonly attachment_id: string;
  readonly kind: 'image' | 'pdf';
  readonly media_type: string;
  readonly byte_count: number;
  readonly content_hash: string;
  readonly file_name: string;
  readonly buffer: Buffer;
}
/** Private, already authorized snapshots; never accept these fields from MCP arguments. */
export interface NodiaAiInvoiceOcrExecution {
  readonly claim: NodiaAiClaim;
  readonly assertLease: (signal: AbortSignal) => Promise<void>;
  readonly input: NodiaAiInvoiceOcrInput;
  readonly sources: readonly NodiaAiInvoiceOcrSource[];
  readonly commercial: {
    readonly providerFields: Readonly<Record<string, unknown>> | null;
    readonly tax: number | null;
  };
  readonly selection: NodiaAiSelection;
  readonly observation: NodiaAiAdapterObservation;
  readonly deadlineAt: Date;
  readonly signal: AbortSignal;
}
/** One actual, durably armed native OCR. No fallback and no inference retry. */
export abstract class NodiaAiInvoiceOcrPort {
  abstract assertSupported(selection: NodiaAiSelection, observation: NodiaAiAdapterObservation): void;
  abstract execute(input: NodiaAiInvoiceOcrExecution): Promise<{
    extraction: AnalyzeInvoiceResponse;
    terminalProof: NodiaAiRuntimeTerminalProof;
  }>;
}
