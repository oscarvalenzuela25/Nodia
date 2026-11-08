/** Private context hints only: the read/request contracts must reauthorize each ID. */
export type NodiaAiInvoiceOcrReference = {
  analysis_id: string;
  business_id: string;
  attachment_id: string;
  source_message_seq: string;
  provider_id: string | null;
  state_hint: 'awaiting_supplier' | 'requested' | 'stored_result' | 'unknown' | 'failed' | 'cancelled';
};
export type NodiaAiInvoiceOcrReferences = {
  schema_version: 1;
  references: NodiaAiInvoiceOcrReference[];
  more: boolean;
};
