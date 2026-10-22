import type { NodiaAiSourceReportResult } from './report-result.types.js';
import type {
  ReportPeriod,
  ReportSourceRequest,
} from './report-query.types.js';

export interface NodiaAiReportQuery {
  catalog_version: string;
  combine: 'separate' | 'compare_compatible';
  sources: ReportSourceRequest[];
  page_limit?: number;
  cursor?: string;
}
export interface NodiaAiReportSourceError {
  source_alias: string;
  error: {
    code: string;
    message_key: string;
    field_errors: { field_key: string; code: string; message_key: string }[];
    retry_action: 'none' | 'recover_status' | 'manual_after_review';
    correlation_id: string;
  };
}
export interface NodiaAiReportProvenance {
  source_alias: string;
  source_key: string;
  observed_at: string;
  scope: ReportSourceRequest['scope'];
  measure_keys: string[];
  period: ReportPeriod | null;
  basis_key: string;
  matched_records: string | null;
}
/** Independent per-source snapshots: never a global total or a shared DB snapshot. */
export interface NodiaAiCrossReportResult {
  status: 'ok' | 'empty' | 'partial' | 'needs_clarification';
  report_id: string;
  catalog_version: string;
  combine: NodiaAiReportQuery['combine'];
  snapshot_consistency: 'independent_source_snapshots';
  source_results: NodiaAiSourceReportResult[];
  columns: NodiaAiSourceReportResult['columns'];
  rows: NodiaAiSourceReportResult['rows'];
  provenance: NodiaAiReportProvenance[];
  group_page_complete: boolean;
  next_cursor: string | null;
  clarification_keys: string[];
  source_errors: NodiaAiReportSourceError[];
}
